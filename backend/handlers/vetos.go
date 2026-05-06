package handlers

import (
	"github.com/gofiber/fiber/v2"
)

type vetoInput struct {
	Amount      float64 `json:"amount"`
	Description string  `json:"description"`
	GoalID      *int    `json:"goal_id"`
}

func (h *Handler) CreateVeto(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	var input vetoInput
	if err := c.BodyParser(&input); err != nil || input.Amount <= 0 || input.Description == "" {
		return c.Status(400).JSON(fiber.Map{"error": "amount and description are required"})
	}

	tx, err := h.db.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "internal error"})
	}
	defer tx.Rollback()

	// Resolve goal: use provided goal_id, or find active goal
	var goalID *int
	if input.GoalID != nil && *input.GoalID > 0 {
		goalID = input.GoalID
	} else if input.GoalID == nil {
		var gid int
		if err := tx.QueryRow(
			`SELECT id FROM goals WHERE user_id = ? AND status = 'active' LIMIT 1`, userID,
		).Scan(&gid); err == nil {
			goalID = &gid
		}
	}

	var vetoID int
	if goalID != nil {
		err = tx.QueryRow(
			`INSERT INTO vetos (user_id, goal_id, amount, description) VALUES (?, ?, ?, ?) RETURNING id`,
			userID, *goalID, input.Amount, input.Description,
		).Scan(&vetoID)
	} else {
		err = tx.QueryRow(
			`INSERT INTO vetos (user_id, amount, description) VALUES (?, ?, ?) RETURNING id`,
			userID, input.Amount, input.Description,
		).Scan(&vetoID)
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create veto"})
	}

	// Update goal progress
	var goalCompleted bool
	var goalTitle string
	if goalID != nil {
		tx.Exec(`UPDATE goals SET current_amount = current_amount + ? WHERE id = ?`, input.Amount, *goalID)

		var currentAmount, targetAmount float64
		tx.QueryRow(
			`SELECT current_amount, target_amount, title FROM goals WHERE id = ?`, *goalID,
		).Scan(&currentAmount, &targetAmount, &goalTitle)

		if currentAmount >= targetAmount {
			tx.Exec(`UPDATE goals SET status = 'completed' WHERE id = ?`, *goalID)
			goalCompleted = true
		}
	}

	tx.Exec(`UPDATE users SET total_saved = total_saved + ? WHERE id = ?`, input.Amount, userID)

	if err := tx.Commit(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to commit"})
	}

	// Async side-effects: notifications
	var username string
	h.db.QueryRow(`SELECT username FROM users WHERE id = ?`, userID).Scan(&username)
	go h.notifyGroupMembers(userID, vetoID, username, input.Description, input.Amount)
	if goalCompleted {
		go h.notifyGoalCompleted(userID, goalTitle)
	}

	return c.Status(201).JSON(fiber.Map{"id": vetoID, "success": true, "goal_completed": goalCompleted})
}

func (h *Handler) MoveVetoGoal(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	vetoID := c.Params("id")

	var input struct {
		GoalID *int `json:"goal_id"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid input"})
	}

	// Verify ownership
	var ownerID int
	var oldGoalID *int
	var amount float64
	err := h.db.QueryRow(
		`SELECT user_id, goal_id, amount FROM vetos WHERE id = ?`, vetoID,
	).Scan(&ownerID, &oldGoalID, &amount)
	if err != nil || ownerID != userID {
		return c.Status(404).JSON(fiber.Map{"error": "veto not found"})
	}

	tx, _ := h.db.Begin()
	defer tx.Rollback()

	// Subtract from old goal
	if oldGoalID != nil {
		tx.Exec(`UPDATE goals SET current_amount = MAX(0, current_amount - ?) WHERE id = ?`, amount, *oldGoalID)
		tx.Exec(`UPDATE goals SET status = 'active' WHERE id = ? AND status = 'completed'`, *oldGoalID)
	}

	// Assign to new goal
	if input.GoalID != nil && *input.GoalID > 0 {
		tx.Exec(`UPDATE vetos SET goal_id = ? WHERE id = ?`, *input.GoalID, vetoID)
		tx.Exec(`UPDATE goals SET current_amount = current_amount + ? WHERE id = ? AND user_id = ?`, amount, *input.GoalID, userID)
		// Check completion
		var cur, tgt float64
		var title string
		tx.QueryRow(`SELECT current_amount, target_amount, title FROM goals WHERE id = ?`, *input.GoalID).Scan(&cur, &tgt, &title)
		if cur >= tgt {
			tx.Exec(`UPDATE goals SET status = 'completed' WHERE id = ?`, *input.GoalID)
			go h.notifyGoalCompleted(userID, title)
		}
	} else {
		tx.Exec(`UPDATE vetos SET goal_id = NULL WHERE id = ?`, vetoID)
	}

	tx.Commit()
	return c.JSON(fiber.Map{"success": true})
}

func (h *Handler) GetFeed(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	rows, err := h.db.Query(`
		SELECT v.id, u.username, v.amount, v.description, v.created_at,
		       COUNT(r.id) AS respect_count,
		       COUNT(CASE WHEN r.from_user_id = ? THEN 1 END) AS has_respected
		FROM vetos v
		JOIN users u ON u.id = v.user_id
		LEFT JOIN respects r ON r.veto_id = v.id
		GROUP BY v.id, u.username, v.amount, v.description, v.created_at
		ORDER BY v.created_at DESC
		LIMIT 50
	`, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch feed"})
	}
	defer rows.Close()

	feed := make([]fiber.Map, 0)
	for rows.Next() {
		var id int
		var username, description, createdAt string
		var amount float64
		var respectCount, hasRespected int
		if err := rows.Scan(&id, &username, &amount, &description, &createdAt, &respectCount, &hasRespected); err != nil {
			continue
		}
		feed = append(feed, fiber.Map{
			"id": id, "username": username, "amount": amount,
			"description": description, "created_at": createdAt,
			"respect_count": respectCount, "has_respected": hasRespected > 0,
		})
	}
	return c.JSON(feed)
}

func (h *Handler) CreateRespect(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	var input struct {
		VetoID int `json:"veto_id"`
	}
	if err := c.BodyParser(&input); err != nil || input.VetoID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "veto_id is required"})
	}

	h.db.Exec(
		`INSERT INTO respects (veto_id, from_user_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
		input.VetoID, userID,
	)
	return c.JSON(fiber.Map{"success": true})
}
