package handlers

import (
	"github.com/gofiber/fiber/v2"
)

type goalInput struct {
	Title        string  `json:"title"`
	TargetAmount float64 `json:"target_amount"`
}

func (h *Handler) GetGoals(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	rows, err := h.db.Query(
		`SELECT id, title, target_amount, current_amount, status, created_at
		 FROM goals WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch goals"})
	}
	defer rows.Close()

	goals := make([]fiber.Map, 0)
	for rows.Next() {
		var id int64
		var title, status, createdAt string
		var targetAmount, currentAmount float64
		if err := rows.Scan(&id, &title, &targetAmount, &currentAmount, &status, &createdAt); err != nil {
			continue
		}
		goals = append(goals, fiber.Map{
			"id": id, "title": title,
			"target_amount": targetAmount, "current_amount": currentAmount,
			"status": status, "created_at": createdAt,
		})
	}

	return c.JSON(goals)
}

func (h *Handler) CreateGoal(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var input goalInput
	if err := c.BodyParser(&input); err != nil || input.Title == "" || input.TargetAmount <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "title and target_amount are required"})
	}

	h.db.Exec(`UPDATE goals SET status = 'inactive' WHERE user_id = $1 AND status = 'active'`, userID)

	var goalID int64
	err := h.db.QueryRow(
		`INSERT INTO goals (user_id, title, target_amount) VALUES ($1, $2, $3) RETURNING id`,
		userID, input.Title, input.TargetAmount,
	).Scan(&goalID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create goal"})
	}

	return c.Status(201).JSON(fiber.Map{
		"id": goalID, "title": input.Title,
		"target_amount": input.TargetAmount, "current_amount": 0,
		"status": "active",
	})
}

func (h *Handler) UpdateGoal(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	goalID := c.Params("id")

	var input goalInput
	if err := c.BodyParser(&input); err != nil || input.Title == "" || input.TargetAmount <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "title and target_amount are required"})
	}

	result, err := h.db.Exec(
		`UPDATE goals SET title = $1, target_amount = $2 WHERE id = $3 AND user_id = $4`,
		input.Title, input.TargetAmount, goalID, userID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to update goal"})
	}

	n, _ := result.RowsAffected()
	if n == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "goal not found"})
	}

	return c.JSON(fiber.Map{"success": true})
}
