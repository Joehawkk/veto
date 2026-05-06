package handlers

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
)

func (h *Handler) GetProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	var id int
	var email, username, createdAt string
	var totalSaved float64
	err := h.db.QueryRow(
		`SELECT id, email, username, total_saved, created_at FROM users WHERE id = ?`, userID,
	).Scan(&id, &email, &username, &totalSaved, &createdAt)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	// All goals (not just active)
	rows, _ := h.db.Query(
		`SELECT id, title, target_amount, current_amount, status FROM goals WHERE user_id = ? ORDER BY created_at DESC`,
		userID,
	)
	goals := make([]fiber.Map, 0)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var gid int
			var title, status string
			var target, current float64
			if rows.Scan(&gid, &title, &target, &current, &status) == nil {
				goals = append(goals, fiber.Map{
					"id": gid, "title": title,
					"target_amount": target, "current_amount": current,
					"status": status,
				})
			}
		}
	}

	var activeGoal fiber.Map
	for _, g := range goals {
		if g["status"] == "active" {
			activeGoal = g
			break
		}
	}

	return c.JSON(fiber.Map{
		"id":          id,
		"email":       email,
		"username":    username,
		"total_saved": totalSaved,
		"created_at":  createdAt,
		"active_goal": activeGoal,
		"goals":       goals,
	})
}

func (h *Handler) DeleteProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	// Transfer owned groups or delete them
	h.db.Exec(`DELETE FROM groups WHERE owner_id = ?`, userID)
	h.db.Exec(`DELETE FROM users WHERE id = ?`, userID)

	return c.JSON(fiber.Map{"success": true})
}

// getActiveGoalForUser returns (goalID, title, exists)
func (h *Handler) getActiveGoalForUser(userID int) (int, string, bool) {
	var id int
	var title string
	err := h.db.QueryRow(
		`SELECT id, title FROM goals WHERE user_id = ? AND status = 'active' LIMIT 1`, userID,
	).Scan(&id, &title)
	if err == sql.ErrNoRows || err != nil {
		return 0, "", false
	}
	return id, title, true
}
