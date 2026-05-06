package handlers

import (
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"veto/config"
)

type Handler struct {
	db  *sql.DB
	cfg *config.Config
}

func New(db *sql.DB, cfg *config.Config) *Handler {
	return &Handler{db: db, cfg: cfg}
}

func (h *Handler) generateToken(userID string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(7 * 24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.cfg.JWTSecret))
}

func (h *Handler) GetMe(c *fiber.Ctx) error {
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

	return c.JSON(fiber.Map{
		"id":           id,
		"username":     username,
		"display_name": displayName,
		"email":        nullStr(email),
		"phone":        nullStr(phone),
		"avatar_url":   nullStr(avatarURL),
		"total_saved":  totalSaved,
		"created_at":   createdAt,
	})
}

func nullStr(ns sql.NullString) interface{} {
	if ns.Valid {
		return ns.String
	}
	return nil
}

func (h *Handler) ListUsers(c *fiber.Ctx) error {
	rows, err := h.db.Query(`
		SELECT u.id, u.username, u.display_name, u.total_saved, u.created_at,
		       COUNT(v.id) AS veto_count
		FROM users u
		LEFT JOIN vetos v ON v.user_id = u.id
		GROUP BY u.id, u.username, u.display_name, u.total_saved, u.created_at
		ORDER BY u.total_saved DESC
	`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "db error"})
	}
	defer rows.Close()

	users := make([]fiber.Map, 0)
	for rows.Next() {
		var id, username, displayName, createdAt string
		var totalSaved float64
		var vetoCount int
		if err := rows.Scan(&id, &username, &displayName, &totalSaved, &createdAt, &vetoCount); err != nil {
			continue
		}
		users = append(users, fiber.Map{
			"id":           id,
			"username":     username,
			"display_name": displayName,
			"total_saved":  totalSaved,
			"created_at":   createdAt,
			"veto_count":   vetoCount,
		})
	}
	return c.JSON(users)
}
