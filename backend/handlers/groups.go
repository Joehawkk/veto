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
		SELECT u.id, u.username, u.display_name, u.total_saved, u.avatar_url, gm.role
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
		var uid, username, displayName, role string
		var totalSaved float64
		var avatarURL sql.NullString
		if err := rows.Scan(&uid, &username, &displayName, &totalSaved, &avatarURL, &role); err != nil {
			continue
		}
		members = append(members, fiber.Map{
			"id": uid, "username": username, "display_name": displayName,
			"total_saved": totalSaved, "rank": rank,
			"is_me": uid == userID, "avatar_url": nullStr(avatarURL),
			"role": role,
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
		SELECT ch.id, u.username, u.display_name, u.avatar_url, ch.price, ch.name, ch.created_at,
		       COUNT(CASE WHEN cl.reaction_type = 'heart' THEN 1 END) AS like_count,
		       COUNT(CASE WHEN cl.reaction_type = 'flame' THEN 1 END) AS flame_count,
		       COUNT(CASE WHEN cl.user_id = $1 AND cl.reaction_type = 'heart' THEN 1 END) AS has_liked,
		       COUNT(CASE WHEN cl.user_id = $1 AND cl.reaction_type = 'flame' THEN 1 END) AS has_flamed
		FROM checks ch
		JOIN users u ON u.id = ch.user_id
		JOIN group_members gm ON gm.user_id = ch.user_id AND gm.group_id = $2
		LEFT JOIN check_likes cl ON cl.check_id = ch.id
		WHERE ch.outcome = 'stopped'
		GROUP BY ch.id, u.username, u.display_name, u.avatar_url, ch.price, ch.name, ch.created_at
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
		var avatarURL sql.NullString
		var price float64
		var likeCount, flameCount, hasLiked, hasFlamed int
		if err := rows.Scan(&id, &username, &displayName, &avatarURL, &price, &checkName, &createdAt, &likeCount, &flameCount, &hasLiked, &hasFlamed); err != nil {
			continue
		}
		feed = append(feed, fiber.Map{
			"id": id, "username": username, "display_name": displayName,
			"avatar_url": nullStr(avatarURL),
			"amount": price, "description": checkName, "created_at": createdAt,
			"like_count": likeCount, "flame_count": flameCount,
			"has_liked": hasLiked > 0, "has_flamed": hasFlamed > 0,
		})
	}
	return c.JSON(feed)
}

func (h *Handler) LikeCheck(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	checkID := c.Params("id")

	reactionType := c.Query("reaction", "heart")
	if reactionType != "heart" && reactionType != "flame" {
		reactionType = "heart"
	}

	_, err := h.db.Exec(
		`INSERT INTO check_likes (check_id, user_id, reaction_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		checkID, userID, reactionType,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to like"})
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *Handler) UnlikeCheck(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	checkID := c.Params("id")

	reactionType := c.Query("reaction", "heart")
	if reactionType != "heart" && reactionType != "flame" {
		reactionType = "heart"
	}

	h.db.Exec(`DELETE FROM check_likes WHERE check_id = $1 AND user_id = $2 AND reaction_type = $3`, checkID, userID, reactionType)
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

// GetGroupGoals returns all goals for a group
func (h *Handler) GetGroupGoals(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	groupID := c.Params("id")

	var memberCheck int
	h.db.QueryRow(`SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID).Scan(&memberCheck)
	if memberCheck == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Ты не в этой группе"})
	}

	rows, err := h.db.Query(`
        SELECT id, title, target_amount, current_amount, status, created_at
        FROM group_goals WHERE group_id = $1 ORDER BY created_at DESC
    `, groupID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch goals"})
	}
	defer rows.Close()

	goals := make([]fiber.Map, 0)
	for rows.Next() {
		var id int64
		var title, status, createdAt string
		var target, current float64
		if err := rows.Scan(&id, &title, &target, &current, &status, &createdAt); err != nil {
			continue
		}
		goals = append(goals, fiber.Map{
			"id": id, "title": title, "target_amount": target,
			"current_amount": current, "status": status, "created_at": createdAt,
		})
	}
	return c.JSON(goals)
}

// CreateGroupGoal creates a new group goal (admin+ only)
func (h *Handler) CreateGroupGoal(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	groupID := c.Params("id")

	var role string
	h.db.QueryRow(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID).Scan(&role)
	if role != "owner" && role != "admin" {
		return c.Status(403).JSON(fiber.Map{"error": "Только админы могут создавать цели"})
	}

	var input struct {
		Title        string  `json:"title"`
		TargetAmount float64 `json:"target_amount"`
	}
	if err := c.BodyParser(&input); err != nil || input.Title == "" || input.TargetAmount <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "title and target_amount required"})
	}

	var id int64
	err := h.db.QueryRow(
		`INSERT INTO group_goals (group_id, title, target_amount) VALUES ($1, $2, $3) RETURNING id`,
		groupID, input.Title, input.TargetAmount,
	).Scan(&id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create goal"})
	}

	return c.Status(201).JSON(fiber.Map{
		"id": id, "title": input.Title, "target_amount": input.TargetAmount,
		"current_amount": 0, "status": "active",
	})
}

// ContributeGroupGoal adds amount to a group goal's current_amount
func (h *Handler) ContributeGroupGoal(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	groupID := c.Params("id")
	goalID := c.Params("goalId")

	var memberCheck int
	h.db.QueryRow(`SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID).Scan(&memberCheck)
	if memberCheck == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Ты не в этой группе"})
	}

	var input struct {
		Amount float64 `json:"amount"`
	}
	if err := c.BodyParser(&input); err != nil || input.Amount <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "amount required"})
	}

	var id int64
	var title, status string
	var target, current float64
	err := h.db.QueryRow(`
        UPDATE group_goals SET current_amount = LEAST(current_amount + $1, target_amount),
        status = CASE WHEN current_amount + $1 >= target_amount THEN 'completed' ELSE status END
        WHERE id = $2 AND group_id = $3
        RETURNING id, title, target_amount, current_amount, status
    `, input.Amount, goalID, groupID).Scan(&id, &title, &target, &current, &status)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Goal not found"})
	}

	return c.JSON(fiber.Map{
		"id": id, "title": title, "target_amount": target,
		"current_amount": current, "status": status,
	})
}

// SetMemberRole promotes or demotes a group member (owner only)
func (h *Handler) SetMemberRole(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	groupID := c.Params("id")
	targetUserID := c.Params("userId")

	var actorRole string
	h.db.QueryRow(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID).Scan(&actorRole)
	if actorRole != "owner" {
		return c.Status(403).JSON(fiber.Map{"error": "Только владелец может назначать админов"})
	}

	var input struct {
		Role string `json:"role"`
	}
	if err := c.BodyParser(&input); err != nil || (input.Role != "admin" && input.Role != "member") {
		return c.Status(400).JSON(fiber.Map{"error": "role must be 'admin' or 'member'"})
	}

	if targetUserID == userID {
		return c.Status(400).JSON(fiber.Map{"error": "Нельзя изменить собственную роль"})
	}

	res, err := h.db.Exec(
		`UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3 AND role != 'owner'`,
		input.Role, groupID, targetUserID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to update role"})
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Member not found"})
	}
	return c.JSON(fiber.Map{"success": true})
}

// KickMember removes a member from the group
func (h *Handler) KickMember(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	groupID := c.Params("id")
	targetUserID := c.Params("userId")

	if targetUserID == userID {
		return c.Status(400).JSON(fiber.Map{"error": "Use /leave to leave the group"})
	}

	var actorRole string
	h.db.QueryRow(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID).Scan(&actorRole)
	if actorRole != "owner" && actorRole != "admin" {
		return c.Status(403).JSON(fiber.Map{"error": "Нет прав"})
	}

	var targetRole string
	h.db.QueryRow(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, targetUserID).Scan(&targetRole)
	if targetRole == "owner" || (actorRole == "admin" && targetRole == "admin") {
		return c.Status(403).JSON(fiber.Map{"error": "Недостаточно прав"})
	}

	h.db.Exec(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, targetUserID)
	return c.JSON(fiber.Map{"success": true})
}

// TransferOwnership transfers group ownership to another member
func (h *Handler) TransferOwnership(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	groupID := c.Params("id")

	var ownerID string
	h.db.QueryRow(`SELECT owner_id FROM groups WHERE id = $1`, groupID).Scan(&ownerID)
	if ownerID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Только владелец может передать права"})
	}

	var input struct {
		NewOwnerID string `json:"new_owner_id"`
	}
	if err := c.BodyParser(&input); err != nil || input.NewOwnerID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "new_owner_id required"})
	}
	if input.NewOwnerID == userID {
		return c.Status(400).JSON(fiber.Map{"error": "Нельзя передать права себе"})
	}

	var memberCheck int
	h.db.QueryRow(`SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, input.NewOwnerID).Scan(&memberCheck)
	if memberCheck == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Пользователь не в группе"})
	}

	tx, _ := h.db.Begin()
	defer tx.Rollback()
	tx.Exec(`UPDATE groups SET owner_id = $1 WHERE id = $2`, input.NewOwnerID, groupID)
	tx.Exec(`UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2`, groupID, userID)
	tx.Exec(`UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2`, groupID, input.NewOwnerID)
	tx.Commit()

	return c.JSON(fiber.Map{"success": true})
}
