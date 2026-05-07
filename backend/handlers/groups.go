package handlers

import (
	"crypto/rand"
	"database/sql"
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
	userID := c.Locals("user_id").(string)

	rows, err := h.db.Query(`
		SELECT g.id, g.name, g.invite_code, g.owner_id,
		       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count,
		       COALESCE((SELECT SUM(u2.total_saved) FROM group_members gm2
		                 JOIN users u2 ON u2.id = gm2.user_id
		                 WHERE gm2.group_id = g.id), 0) AS group_total
		FROM groups g
		JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
		ORDER BY g.created_at DESC
	`, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch groups"})
	}
	defer rows.Close()

	groups := make([]fiber.Map, 0)
	for rows.Next() {
		var id int64
		var ownerID, name, inviteCode string
		var memberCount int
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
	userID := c.Locals("user_id").(string)

	var input struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&input); err != nil || input.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name is required"})
	}

	var code string
	for {
		code = generateInviteCode()
		var exists int
		h.db.QueryRow(`SELECT COUNT(*) FROM groups WHERE invite_code = $1`, code).Scan(&exists)
		if exists == 0 {
			break
		}
	}

	tx, _ := h.db.Begin()
	defer tx.Rollback()

	var groupID int64
	err := tx.QueryRow(
		`INSERT INTO groups (name, invite_code, owner_id) VALUES ($1, $2, $3) RETURNING id`,
		input.Name, code, userID,
	).Scan(&groupID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create group"})
	}

	tx.Exec(`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)`, groupID, userID)
	tx.Commit()

	return c.Status(201).JSON(fiber.Map{
		"id": groupID, "name": input.Name,
		"invite_code": code, "owner_id": userID,
		"member_count": 1, "is_owner": true,
	})
}

func (h *Handler) InviteToGroup(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	groupID := c.Params("id")

	var memberCheck int
	h.db.QueryRow(
		`SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID,
	).Scan(&memberCheck)
	if memberCheck == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Ты не в этой группе"})
	}

	var input struct {
		Username string `json:"username"`
	}
	if err := c.BodyParser(&input); err != nil || input.Username == "" {
		return c.Status(400).JSON(fiber.Map{"error": "username is required"})
	}

	var targetUserID string
	err := h.db.QueryRow(`SELECT id FROM users WHERE username = $1`, input.Username).Scan(&targetUserID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Пользователь не найден"})
	}
	if targetUserID == userID {
		return c.Status(400).JSON(fiber.Map{"error": "Нельзя пригласить себя"})
	}

	var alreadyMember int
	h.db.QueryRow(
		`SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, targetUserID,
	).Scan(&alreadyMember)
	if alreadyMember > 0 {
		return c.Status(409).JSON(fiber.Map{"error": "Пользователь уже в группе"})
	}

	var groupName string
	h.db.QueryRow(`SELECT name FROM groups WHERE id = $1`, groupID).Scan(&groupName)

	var inviterUsername string
	h.db.QueryRow(`SELECT username FROM users WHERE id = $1`, userID).Scan(&inviterUsername)

	var inviteID int64
	err = h.db.QueryRow(
		`INSERT INTO group_invites (group_id, invited_by, invited_user_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (group_id, invited_user_id) DO UPDATE SET status = 'pending', created_at = NOW()
		 RETURNING id`,
		groupID, userID, targetUserID,
	).Scan(&inviteID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create invite"})
	}

	msg := "@" + inviterUsername + " приглашает тебя в группу «" + groupName + "»"
	h.db.Exec(
		`INSERT INTO notifications (user_id, type, message, reference_id)
		 VALUES ($1, 'group_invite', $2, $3)`,
		targetUserID, msg, inviteID,
	)

	return c.JSON(fiber.Map{"success": true, "invite_id": inviteID})
}

func (h *Handler) JoinGroup(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var input struct {
		InviteCode string `json:"invite_code"`
	}
	if err := c.BodyParser(&input); err != nil || input.InviteCode == "" {
		return c.Status(400).JSON(fiber.Map{"error": "invite_code is required"})
	}

	var groupID int64
	var groupName string
	err := h.db.QueryRow(
		`SELECT id, name FROM groups WHERE invite_code = $1`, input.InviteCode,
	).Scan(&groupID, &groupName)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Группа не найдена"})
	}

	_, err = h.db.Exec(
		`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		groupID, userID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to join group"})
	}

	return c.JSON(fiber.Map{"id": groupID, "name": groupName, "success": true})
}

func (h *Handler) GetGroupDetail(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	groupID := c.Params("id")

	var memberCheck int
	h.db.QueryRow(
		`SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID,
	).Scan(&memberCheck)
	if memberCheck == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Ты не в этой группе"})
	}

	var id int64
	var ownerID, name, inviteCode string
	err := h.db.QueryRow(
		`SELECT id, name, invite_code, owner_id FROM groups WHERE id = $1`, groupID,
	).Scan(&id, &name, &inviteCode, &ownerID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Группа не найдена"})
	}

	rows, err := h.db.Query(`
		SELECT u.id, u.username, u.display_name, u.total_saved, u.avatar_url
		FROM group_members gm
		JOIN users u ON u.id = gm.user_id
		WHERE gm.group_id = $1
		ORDER BY u.total_saved DESC
	`, groupID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch members"})
	}
	defer rows.Close()

	members := make([]fiber.Map, 0)
	rank := 1
	for rows.Next() {
		var uid, username, displayName string
		var totalSaved float64
		var avatarURL sql.NullString
		if err := rows.Scan(&uid, &username, &displayName, &totalSaved, &avatarURL); err != nil {
			continue
		}
		members = append(members, fiber.Map{
			"id": uid, "username": username, "display_name": displayName,
			"total_saved": totalSaved, "rank": rank,
			"is_me": uid == userID, "avatar_url": nullStr(avatarURL),
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
	userID := c.Locals("user_id").(string)
	groupID := c.Params("id")

	var memberCheck int
	h.db.QueryRow(
		`SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID,
	).Scan(&memberCheck)
	if memberCheck == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Ты не в этой группе"})
	}

	rows, err := h.db.Query(`
		SELECT ch.id, u.username, u.display_name, ch.price, ch.name, ch.created_at,
		       COUNT(cl.id) AS like_count,
		       COUNT(CASE WHEN cl.user_id = $1 THEN 1 END) AS has_liked
		FROM checks ch
		JOIN users u ON u.id = ch.user_id
		JOIN group_members gm ON gm.user_id = ch.user_id AND gm.group_id = $2
		LEFT JOIN check_likes cl ON cl.check_id = ch.id
		WHERE ch.outcome = 'stopped'
		GROUP BY ch.id, u.username, u.display_name, ch.price, ch.name, ch.created_at
		ORDER BY ch.created_at DESC
		LIMIT 50
	`, userID, groupID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch feed"})
	}
	defer rows.Close()

	feed := make([]fiber.Map, 0)
	for rows.Next() {
		var id, checkName, username, displayName, createdAt string
		var price float64
		var likeCount, hasLiked int
		if err := rows.Scan(&id, &username, &displayName, &price, &checkName, &createdAt, &likeCount, &hasLiked); err != nil {
			continue
		}
		feed = append(feed, fiber.Map{
			"id": id, "username": username, "display_name": displayName,
			"amount": price, "description": checkName, "created_at": createdAt,
			"like_count": likeCount, "has_liked": hasLiked > 0,
		})
	}
	return c.JSON(feed)
}

func (h *Handler) LikeCheck(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	checkID := c.Params("id")

	_, err := h.db.Exec(
		`INSERT INTO check_likes (check_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		checkID, userID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to like"})
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *Handler) UnlikeCheck(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	checkID := c.Params("id")

	h.db.Exec(`DELETE FROM check_likes WHERE check_id = $1 AND user_id = $2`, checkID, userID)
	return c.JSON(fiber.Map{"success": true})
}

func (h *Handler) LeaveGroup(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	groupID := c.Params("id")

	var ownerID string
	h.db.QueryRow(`SELECT owner_id FROM groups WHERE id = $1`, groupID).Scan(&ownerID)
	if ownerID == userID {
		h.db.Exec(`DELETE FROM groups WHERE id = $1`, groupID)
		return c.JSON(fiber.Map{"success": true, "deleted": true})
	}

	h.db.Exec(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID)
	return c.JSON(fiber.Map{"success": true})
}
