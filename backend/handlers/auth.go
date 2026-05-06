package handlers

import (
	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

type registerInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Username string `json:"username"`
}

type loginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) Register(c *fiber.Ctx) error {
	var input registerInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid input"})
	}
	if input.Email == "" || input.Password == "" || input.Username == "" {
		return c.Status(400).JSON(fiber.Map{"error": "email, password and username are required"})
	}
	if len(input.Password) < 6 {
		return c.Status(400).JSON(fiber.Map{"error": "password must be at least 6 characters"})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "internal error"})
	}

	var userID int
	err = h.db.QueryRow(
		`INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id`,
		input.Email, string(hash), input.Username,
	).Scan(&userID)
	if err != nil {
		return c.Status(409).JSON(fiber.Map{"error": "email or username already taken"})
	}

	token, err := h.generateToken(userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to generate token"})
	}

	return c.Status(201).JSON(fiber.Map{
		"token":    token,
		"user_id":  userID,
		"username": input.Username,
	})
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var input loginInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid input"})
	}

	var userID int
	var passwordHash, username string
	err := h.db.QueryRow(
		`SELECT id, password_hash, username FROM users WHERE email = $1`,
		input.Email,
	).Scan(&userID, &passwordHash, &username)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(input.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "invalid credentials"})
	}

	token, err := h.generateToken(userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to generate token"})
	}

	return c.JSON(fiber.Map{
		"token":    token,
		"user_id":  userID,
		"username": username,
	})
}
