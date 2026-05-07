package handlers

import (
	"database/sql"
	"fmt"

	"github.com/gofiber/fiber/v2"
)

func (h *Handler) notifyGroupMembersAboutCheck(actorID, actorUsername, checkName string, price float64) {
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

	msg := fmt.Sprintf("@%s отказался от «%s» и сэкономил %.0f ₽ 💪", actorUsername, checkName, price)
	for rows.Next() {
		var uid string
		if rows.Scan(&uid) != nil {
			continue
		}
		h.db.Exec(
			`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'group_save', $2)`,
			uid, msg,
		)
	}
}

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
		SELECT id, type, message, read, created_at, reference_id
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 50
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
		var refID sql.NullInt64
		if err := rows.Scan(&id, &typ, &message, &read, &createdAt, &refID); err != nil {
			continue
		}
		item := fiber.Map{
			"id": id, "type": typ, "message": message,
			"read": read, "created_at": createdAt,
		}
		if refID.Valid {
			item["reference_id"] = refID.Int64
		}
		items = append(items, item)
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

func (h *Handler) AcceptGroupInvite(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	inviteID := c.Params("id")

	var groupID int64
	var invitedUserID string
	err := h.db.QueryRow(
		`SELECT group_id, invited_user_id FROM group_invites WHERE id = $1 AND status = 'pending'`,
		inviteID,
	).Scan(&groupID, &invitedUserID)
	if err != nil || invitedUserID != userID {
		return c.Status(404).JSON(fiber.Map{"error": "invite not found"})
	}

	h.db.Exec(`UPDATE group_invites SET status = 'accepted' WHERE id = $1`, inviteID)
	h.db.Exec(
		`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		groupID, userID,
	)
	h.db.Exec(
		`UPDATE notifications SET read = true WHERE user_id = $1 AND reference_id = $2`,
		userID, inviteID,
	)

	var groupName string
	h.db.QueryRow(`SELECT name FROM groups WHERE id = $1`, groupID).Scan(&groupName)

	return c.JSON(fiber.Map{"success": true, "group_id": groupID, "group_name": groupName})
}

func (h *Handler) DeclineGroupInvite(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	inviteID := c.Params("id")

	var invitedUserID string
	err := h.db.QueryRow(
		`SELECT invited_user_id FROM group_invites WHERE id = $1 AND status = 'pending'`,
		inviteID,
	).Scan(&invitedUserID)
	if err != nil || invitedUserID != userID {
		return c.Status(404).JSON(fiber.Map{"error": "invite not found"})
	}

	h.db.Exec(`UPDATE group_invites SET status = 'declined' WHERE id = $1`, inviteID)
	h.db.Exec(
		`UPDATE notifications SET read = true WHERE user_id = $1 AND reference_id = $2`,
		userID, inviteID,
	)

	return c.JSON(fiber.Map{"success": true})
}
