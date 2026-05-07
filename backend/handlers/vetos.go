package handlers

import (
	"github.com/gofiber/fiber/v2"
)

type vetoInput struct {
	Amount      float64  `json:"amount"`
	Description string   `json:"description"`
	GoalID      *int64   `json:"goal_id"`
}

func (h *Handler) CreateVeto(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var input vetoInput
	if err := c.BodyParser(&input); err != nil || input.Amount <= 0 || input.Description == "" {
		return c.Status(400).JSON(fiber.Map{"error": "amount and description are required"})
	}

	tx, err := h.db.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "internal error"})
	}
	defer tx.Rollback()

	var goalID *int64
	if input.GoalID != nil && *input.GoalID > 0 {
		goalID = input.GoalID
	} else if input.GoalID == nil {
		var gid int64
		if err := tx.QueryRow(
			`SELECT id FROM goals WHERE user_id = $1 AND status = 'active' LIMIT 1`, userID,
		).Scan(&gid); err == nil {
			goalID = &gid
		}
	}

	var vetoID int64
	if goalID != nil {
		err = tx.QueryRow(
			`INSERT INTO vetos (user_id, goal_id, amount, description) VALUES ($1, $2, $3, $4) RETURNING id`,
			userID, *goalID, input.Amount, input.Description,
		).Scan(&vetoID)
	} else {
		err = tx.QueryRow(
			`INSERT INTO vetos (user_id, amount, description) VALUES ($1, $2, $3) RETURNING id`,
			userID, input.Amount, input.Description,
		).Scan(&vetoID)
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create veto"})
	}

	var goalCompleted bool
	var goalTitle string
	if goalID != nil {
		tx.Exec(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, input.Amount, *goalID)

		var currentAmount, targetAmount float64
		tx.QueryRow(
			`SELECT current_amount, target_amount, title FROM goals WHERE id = $1`, *goalID,
		).Scan(&currentAmount, &targetAmount, &goalTitle)

		if currentAmount >= targetAmount {
			tx.Exec(`UPDATE goals SET status = 'completed' WHERE id = $1`, *goalID)
			goalCompleted = true
		}
	}

	tx.Exec(`UPDATE users SET total_saved = total_saved + $1 WHERE id = $2`, input.Amount, userID)

	if err := tx.Commit(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to commit"})
	}

	var username string
	h.db.QueryRow(`SELECT username FROM users WHERE id = $1`, userID).Scan(&username)
	go h.notifyGroupMembers(userID, vetoID, username, input.Description, input.Amount)
	if goalCompleted {
		go h.notifyGoalCompleted(userID, goalTitle)
	}

	return c.Status(201).JSON(fiber.Map{"id": vetoID, "success": true, "goal_completed": goalCompleted})
}

func (h *Handler) MoveVetoGoal(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	vetoID := c.Params("id")

	var input struct {
		GoalID *int64 `json:"goal_id"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid input"})
	}

	var ownerID string
	var oldGoalID *int64
	var amount float64
	err := h.db.QueryRow(
		`SELECT user_id, goal_id, amount FROM vetos WHERE id = $1`, vetoID,
	).Scan(&ownerID, &oldGoalID, &amount)
	if err != nil || ownerID != userID {
		return c.Status(404).JSON(fiber.Map{"error": "veto not found"})
	}

	tx, _ := h.db.Begin()
	defer tx.Rollback()

	if oldGoalID != nil {
		tx.Exec(`UPDATE goals SET current_amount = GREATEST(0, current_amount - $1) WHERE id = $2`, amount, *oldGoalID)
		tx.Exec(`UPDATE goals SET status = 'active' WHERE id = $1 AND status = 'completed'`, *oldGoalID)
	}

	if input.GoalID != nil && *input.GoalID > 0 {
		tx.Exec(`UPDATE vetos SET goal_id = $1 WHERE id = $2`, *input.GoalID, vetoID)
		tx.Exec(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2 AND user_id = $3`, amount, *input.GoalID, userID)
		var cur, tgt float64
		var title string
		tx.QueryRow(`SELECT current_amount, target_amount, title FROM goals WHERE id = $1`, *input.GoalID).Scan(&cur, &tgt, &title)
		if cur >= tgt {
			tx.Exec(`UPDATE goals SET status = 'completed' WHERE id = $1`, *input.GoalID)
			go h.notifyGoalCompleted(userID, title)
		}
	} else {
		tx.Exec(`UPDATE vetos SET goal_id = NULL WHERE id = $1`, vetoID)
	}

	tx.Commit()
	return c.JSON(fiber.Map{"success": true})
}

func (h *Handler) GetFeed(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	rows, err := h.db.Query(`
		SELECT v.id, u.username, u.display_name, v.amount, v.description, v.created_at,
		       COUNT(r.id) AS respect_count,
		       COUNT(CASE WHEN r.from_user_id = $1 THEN 1 END) AS has_respected
		FROM vetos v
		JOIN users u ON u.id = v.user_id
		LEFT JOIN respects r ON r.veto_id = v.id
		GROUP BY v.id, u.username, u.display_name, v.amount, v.description, v.created_at
		ORDER BY v.created_at DESC
		LIMIT 50
	`, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch feed"})
	}
	defer rows.Close()

	feed := make([]fiber.Map, 0)
	for rows.Next() {
		var id int64
		var username, displayName, description, createdAt string
		var amount float64
		var respectCount, hasRespected int
		if err := rows.Scan(&id, &username, &displayName, &amount, &description, &createdAt, &respectCount, &hasRespected); err != nil {
			continue
		}
		feed = append(feed, fiber.Map{
			"id": id, "username": username, "display_name": displayName,
			"amount": amount, "description": description, "created_at": createdAt,
			"respect_count": respectCount, "has_respected": hasRespected > 0,
		})
	}
	return c.JSON(feed)
}

func (h *Handler) GetVetos(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	rows, err := h.db.Query(`
		SELECT id, goal_id, amount, description, created_at
		FROM vetos WHERE user_id = $1 ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch history"})
	}
	defer rows.Close()

	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id int64
		var goalID *int64
		var amount float64
		var description, createdAt string
		if err := rows.Scan(&id, &goalID, &amount, &description, &createdAt); err != nil {
			continue
		}
		items = append(items, fiber.Map{
			"id": id, "goal_id": goalID,
			"amount": amount, "description": description, "created_at": createdAt,
		})
	}
	return c.JSON(items)
}

func (h *Handler) CreateRespect(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var input struct {
		VetoID int64 `json:"veto_id"`
	}
	if err := c.BodyParser(&input); err != nil || input.VetoID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "veto_id is required"})
	}

	h.db.Exec(
		`INSERT INTO respects (veto_id, from_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		input.VetoID, userID,
	)
	return c.JSON(fiber.Map{"success": true})
}
