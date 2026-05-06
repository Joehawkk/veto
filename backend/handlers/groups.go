package handlers

import (
	"crypto/rand"
	"math/big"

	"github.com/gofiber/fiber/v2"
)

const inviteChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func generateInviteCode() string {
	code := make([]byte, 6)
	for i := range code {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(inviteChars))))
		code[i] = inviteChars[n.Int64()]
	}
	return string(code)
}

func (h *Handler) GetGroups(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	rows, err := h.db.Query(`
		SELECT g.id, g.name, g.invite_code, g.owner_id,
		       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
		       COALESCE((SELECT SUM(u2.total_saved) FROM group_members gm2 JOIN users u2 ON u2.id = gm2.user_id WHERE gm2.group_id = g.id), 0) as group_total
		FROM groups g
		JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
		ORDER BY g.created_at DESC
	`, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch groups"})
	}
	defer rows.Close()

	groups := make([]fiber.Map, 0)
	for rows.Next() {
		var id, ownerID, memberCount int
		var name, inviteCode string
		var groupTotal float64
		if err := rows.Scan(&id, &name, &inviteCode, &ownerID, &memberCount, &groupTotal); err != nil {
			continue
		}
		groups = append(groups, fiber.Map{
			"id": id, "name": name, "invite_code": inviteCode,
			"owner_id": ownerID, "member_count": memberCount,
			"group_total": groupTotal, "is_owner": ownerID == userID,
		})
	}
	return c.JSON(groups)
}

func (h *Handler) CreateGroup(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	var input struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&input); err != nil || input.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name is required"})
	}

	// Generate unique invite code
	var code string
	for {
		code = generateInviteCode()
		var exists int
		h.db.QueryRow(`SELECT COUNT(*) FROM groups WHERE invite_code = ?`, code).Scan(&exists)
		if exists == 0 {
			break
		}
	}

	tx, _ := h.db.Begin()
	defer tx.Rollback()

	var groupID int
	err := tx.QueryRow(
		`INSERT INTO groups (name, invite_code, owner_id) VALUES (?, ?, ?) RETURNING id`,
		input.Name, code, userID,
	).Scan(&groupID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create group"})
	}

	tx.Exec(`INSERT INTO group_members (group_id, user_id) VALUES (?, ?)`, groupID, userID)
	tx.Commit()

	return c.Status(201).JSON(fiber.Map{
		"id": groupID, "name": input.Name,
		"invite_code": code, "owner_id": userID,
		"member_count": 1, "is_owner": true,
	})
}

func (h *Handler) JoinGroup(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	var input struct {
		InviteCode string `json:"invite_code"`
	}
	if err := c.BodyParser(&input); err != nil || input.InviteCode == "" {
		return c.Status(400).JSON(fiber.Map{"error": "invite_code is required"})
	}

	var groupID int
	var groupName string
	err := h.db.QueryRow(
		`SELECT id, name FROM groups WHERE invite_code = ?`, input.InviteCode,
	).Scan(&groupID, &groupName)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "group not found"})
	}

	_, err = h.db.Exec(
		`INSERT INTO group_members (group_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
		groupID, userID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to join group"})
	}

	return c.JSON(fiber.Map{"id": groupID, "name": groupName, "success": true})
}

func (h *Handler) GetGroupDetail(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	groupID := c.Params("id")

	// Verify membership
	var memberCheck int
	h.db.QueryRow(
		`SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, userID,
	).Scan(&memberCheck)
	if memberCheck == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "not a member"})
	}

	var id, ownerID int
	var name, inviteCode string
	err := h.db.QueryRow(
		`SELECT id, name, invite_code, owner_id FROM groups WHERE id = ?`, groupID,
	).Scan(&id, &name, &inviteCode, &ownerID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "group not found"})
	}

	// Members leaderboard
	rows, err := h.db.Query(`
		SELECT u.id, u.username, u.total_saved
		FROM group_members gm
		JOIN users u ON u.id = gm.user_id
		WHERE gm.group_id = ?
		ORDER BY u.total_saved DESC
	`, groupID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch members"})
	}
	defer rows.Close()

	members := make([]fiber.Map, 0)
	rank := 1
	for rows.Next() {
		var uid int
		var username string
		var totalSaved float64
		if err := rows.Scan(&uid, &username, &totalSaved); err != nil {
			continue
		}
		members = append(members, fiber.Map{
			"id": uid, "username": username,
			"total_saved": totalSaved, "rank": rank,
			"is_me": uid == userID,
		})
		rank++
	}

	return c.JSON(fiber.Map{
		"id": id, "name": name, "invite_code": inviteCode,
		"owner_id": ownerID, "is_owner": ownerID == userID,
		"members": members,
	})
}

func (h *Handler) GetGroupFeed(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	groupID := c.Params("id")

	var memberCheck int
	h.db.QueryRow(
		`SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, userID,
	).Scan(&memberCheck)
	if memberCheck == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "not a member"})
	}

	rows, err := h.db.Query(`
		SELECT v.id, u.username, v.amount, v.description, v.created_at,
		       COUNT(r.id) AS respect_count,
		       COUNT(CASE WHEN r.from_user_id = ? THEN 1 END) AS has_respected
		FROM vetos v
		JOIN users u ON u.id = v.user_id
		JOIN group_members gm ON gm.user_id = v.user_id AND gm.group_id = ?
		LEFT JOIN respects r ON r.veto_id = v.id
		GROUP BY v.id, u.username, v.amount, v.description, v.created_at
		ORDER BY v.created_at DESC
		LIMIT 50
	`, userID, groupID)
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

func (h *Handler) LeaveGroup(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	groupID := c.Params("id")

	// Owner can't leave — must delete or transfer
	var ownerID int
	h.db.QueryRow(`SELECT owner_id FROM groups WHERE id = ?`, groupID).Scan(&ownerID)
	if ownerID == userID {
		// Delete the group if owner leaves
		h.db.Exec(`DELETE FROM groups WHERE id = ?`, groupID)
		return c.JSON(fiber.Map{"success": true, "deleted": true})
	}

	h.db.Exec(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, userID)
	return c.JSON(fiber.Map{"success": true})
}
