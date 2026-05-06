package handlers

import (
	"database/sql"
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// notifyGroupMembers sends a notification to all group members except the actor.
func (h *Handler) notifyGroupMembers(actorID int, vetoID int, actorUsername, description string, amount float64) {
	rows, err := h.db.Query(`
		SELECT DISTINCT gm.user_id
		FROM group_members gm
		WHERE gm.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)
		  AND gm.user_id != ?
	`, actorID, actorID)
	if err != nil {
		return
	}
	defer rows.Close()

	msg := fmt.Sprintf("@%s ветировал «%s» на %.0f ₽", actorUsername, description, amount)
	for rows.Next() {
		var uid int
		if rows.Scan(&uid) != nil {
			continue
		}
		h.db.Exec(
			`INSERT INTO notifications (user_id, type, message) VALUES (?, 'group_veto', ?)`,
			uid, msg,
		)
	}
}

// notifyGoalCompleted sends a notification to the goal owner.
func (h *Handler) notifyGoalCompleted(userID int, goalTitle string) {
	msg := fmt.Sprintf("🎉 Цель «%s» выполнена!", goalTitle)
	h.db.Exec(
		`INSERT INTO notifications (user_id, type, message) VALUES (?, 'goal_completed', ?)`,
		userID, msg,
	)
}

func (h *Handler) GetNotifications(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	rows, err := h.db.Query(`
		SELECT id, type, message, read, created_at
		FROM notifications
		WHERE user_id = ?
		ORDER BY created_at DESC
		LIMIT 30
	`, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch notifications"})
	}
	defer rows.Close()

	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id, read int
		var typ, message, createdAt string
		if err := rows.Scan(&id, &typ, &message, &read, &createdAt); err != nil {
			continue
		}
		items = append(items, fiber.Map{
			"id": id, "type": typ, "message": message,
			"read": read == 1, "created_at": createdAt,
		})
	}

	var unread int
	h.db.QueryRow(`SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = 0`, userID).Scan(&unread)

	return c.JSON(fiber.Map{"items": items, "unread": unread})
}

func (h *Handler) MarkNotificationsRead(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	h.db.Exec(`UPDATE notifications SET read = 1 WHERE user_id = ?`, userID)
	return c.JSON(fiber.Map{"success": true})
}

// GetGoals reuses the existing one; here we add a helper for goal lookup.
func (h *Handler) getActiveGoal(userID int) (id int, title string, err error) {
	err = h.db.QueryRow(
		`SELECT id, title FROM goals WHERE user_id = ? AND status = 'active' LIMIT 1`, userID,
	).Scan(&id, &title)
	if err == sql.ErrNoRows {
		return 0, "", nil
	}
	return
}
