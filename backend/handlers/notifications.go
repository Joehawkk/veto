package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)


func (h *Handler) notifyGroupMembers(actorID string, vetoID int64, actorUsername, description string, amount float64) {
	rows, err := h.db.Query(`
		SELECT DISTINCT gm.user_id
		FROM group_members gm
		WHERE gm.group_id IN (SELECT group_id FROM group_members WHERE user_id = $1)
		  AND gm.user_id != $1
	`, actorID)
	if err != nil {
		return
	}
	defer rows.Close()

	msg := fmt.Sprintf("@%s ветировал «%s» на %.0f ₽", actorUsername, description, amount)
	for rows.Next() {
		var uid string
		if rows.Scan(&uid) != nil {
			continue
		}
		h.db.Exec(
			`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'group_veto', $2)`,
			uid, msg,
		)
	}
}

func (h *Handler) notifyGoalCompleted(userID string, goalTitle string) {
	msg := fmt.Sprintf("🎉 Цель «%s» выполнена!", goalTitle)
	h.db.Exec(
		`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'goal_completed', $2)`,
		userID, msg,
	)
}

func (h *Handler) GetNotifications(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	rows, err := h.db.Query(`
		SELECT id, type, message, read, created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 30
	`, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch notifications"})
	}
	defer rows.Close()

	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id int64
		var typ, message, createdAt string
		var read bool
		if err := rows.Scan(&id, &typ, &message, &read, &createdAt); err != nil {
			continue
		}
		items = append(items, fiber.Map{
			"id": id, "type": typ, "message": message,
			"read": read, "created_at": createdAt,
		})
	}

	var unread int
	h.db.QueryRow(`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false`, userID).Scan(&unread)

	return c.JSON(fiber.Map{"items": items, "unread": unread})
}

func (h *Handler) MarkNotificationsRead(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	h.db.Exec(`UPDATE notifications SET read = true WHERE user_id = $1`, userID)
	return c.JSON(fiber.Map{"success": true})
}
