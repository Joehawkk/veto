package handlers

import (
	"database/sql"
	"regexp"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

var (
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	phoneRegex = regexp.MustCompile(`^\+[1-9]\d{6,14}$`)
)

func (h *Handler) GetProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var id, username, displayName string
	var email, phone, avatarURL sql.NullString
	var totalSaved float64
	var createdAt string

	err := h.db.QueryRow(
		`SELECT id, username, display_name, email, phone, avatar_url, total_saved, created_at
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&id, &username, &displayName, &email, &phone, &avatarURL, &totalSaved, &createdAt)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	rows, _ := h.db.Query(
		`SELECT id, title, target_amount, current_amount, status FROM goals
		 WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	goals := make([]fiber.Map, 0)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var gid int64
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
		"id":           id,
		"username":     username,
		"display_name": displayName,
		"email":        nullStr(email),
		"phone":        nullStr(phone),
		"avatar_url":   nullStr(avatarURL),
		"total_saved":  totalSaved,
		"created_at":   createdAt,
		"active_goal":  activeGoal,
		"goals":        goals,
	})
}

func (h *Handler) UpdateProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var input struct {
		DisplayName     string  `json:"display_name"`
		Username        *string `json:"username"`
		Email           *string `json:"email"`
		Phone           *string `json:"phone"`
		AvatarURL       *string `json:"avatar_url"`
		CurrentPassword *string `json:"current_password"`
		NewPassword     *string `json:"new_password"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid input"})
	}

	if input.Email != nil {
		trimmed := strings.TrimSpace(*input.Email)
		if trimmed != "" && !emailRegex.MatchString(trimmed) {
			return c.Status(400).JSON(fiber.Map{"error": "invalid email format"})
		}
		*input.Email = trimmed
	}

	if input.Phone != nil {
		trimmed := strings.TrimSpace(*input.Phone)
		if trimmed != "" && !phoneRegex.MatchString(trimmed) {
			return c.Status(400).JSON(fiber.Map{"error": "phone must be in international format (e.g. +79001234567)"})
		}
		*input.Phone = trimmed
	}

	// Build dynamic SET clause for only provided fields
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if input.DisplayName != "" {
		setClauses = append(setClauses, "display_name = $"+itoa(argIdx))
		args = append(args, input.DisplayName)
		argIdx++
	}
	if input.Email != nil {
		if *input.Email == "" {
			setClauses = append(setClauses, "email = NULL")
		} else {
			setClauses = append(setClauses, "email = $"+itoa(argIdx))
			args = append(args, *input.Email)
			argIdx++
		}
	}
	if input.Phone != nil {
		if *input.Phone == "" {
			setClauses = append(setClauses, "phone = NULL")
		} else {
			setClauses = append(setClauses, "phone = $"+itoa(argIdx))
			args = append(args, *input.Phone)
			argIdx++
		}
	}
	if input.AvatarURL != nil {
		if *input.AvatarURL == "" {
			setClauses = append(setClauses, "avatar_url = NULL")
		} else {
			setClauses = append(setClauses, "avatar_url = $"+itoa(argIdx))
			args = append(args, *input.AvatarURL)
			argIdx++
		}
	}

	if input.Username != nil && *input.Username != "" {
		uname := strings.TrimSpace(*input.Username)
		setClauses = append(setClauses, "username = $"+itoa(argIdx))
		args = append(args, uname)
		argIdx++
	}

	if input.NewPassword != nil && *input.NewPassword != "" {
		if input.CurrentPassword == nil || *input.CurrentPassword == "" {
			return c.Status(400).JSON(fiber.Map{"error": "current_password required to change password"})
		}
		var hash string
		h.db.QueryRow(`SELECT password_hash FROM users WHERE id = $1`, userID).Scan(&hash)
		if bcrypt.CompareHashAndPassword([]byte(hash), []byte(*input.CurrentPassword)) != nil {
			return c.Status(401).JSON(fiber.Map{"error": "current password is incorrect"})
		}
		if len(*input.NewPassword) < 6 {
			return c.Status(400).JSON(fiber.Map{"error": "new password must be at least 6 characters"})
		}
		newHash, _ := bcrypt.GenerateFromPassword([]byte(*input.NewPassword), bcrypt.DefaultCost)
		setClauses = append(setClauses, "password_hash = $"+itoa(argIdx))
		args = append(args, string(newHash))
		argIdx++
	}

	if len(setClauses) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "no fields to update"})
	}

	args = append(args, userID)
	query := "UPDATE users SET " + strings.Join(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)

	_, err := h.db.Exec(query, args...)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "username") {
			return c.Status(409).JSON(fiber.Map{"error": "username already taken"})
		}
		return c.Status(409).JSON(fiber.Map{"error": "email already in use"})
	}

	return h.GetMe(c)
}

func (h *Handler) DeleteProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	h.db.Exec(`DELETE FROM groups WHERE owner_id = $1`, userID)
	h.db.Exec(`DELETE FROM users WHERE id = $1`, userID)
	return c.JSON(fiber.Map{"success": true})
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
