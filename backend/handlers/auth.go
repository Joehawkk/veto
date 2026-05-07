package handlers

import (
	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

type registerInput struct {
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Password    string `json:"password"`
}

type loginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *Handler) Register(c *fiber.Ctx) error {
	var input registerInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid input"})
	}
	if input.Username == "" || input.DisplayName == "" || input.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Заполни все поля"})
	}
	if len(input.Password) < 6 {
		return c.Status(400).JSON(fiber.Map{"error": "Пароль должен быть не менее 6 символов"})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Внутренняя ошибка, попробуй снова"})
	}

	var userID string
	err = h.db.QueryRow(
		`INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id`,
		input.Username, string(hash), input.DisplayName,
	).Scan(&userID)
	if err != nil {
		return c.Status(409).JSON(fiber.Map{"error": "Логин уже занят, выбери другой"})
	}

	token, err := h.generateToken(userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Внутренняя ошибка, попробуй снова"})
	}

	return c.Status(201).JSON(fiber.Map{
		"token":        token,
		"user_id":      userID,
		"username":     input.Username,
		"display_name": input.DisplayName,
	})
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var input loginInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid input"})
	}
	if input.Username == "" || input.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Введи логин и пароль"})
	}

	var userID, passwordHash, displayName string
	var onboarded bool
	var profileData []byte
	err := h.db.QueryRow(
		`SELECT id, password_hash, display_name, onboarded, profile_data FROM users WHERE username = $1`,
		input.Username,
	).Scan(&userID, &passwordHash, &displayName, &onboarded, &profileData)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Аккаунт не найден"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(input.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Неверный пароль"})
	}

	token, err := h.generateToken(userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Внутренняя ошибка, попробуй снова"})
	}

	return c.JSON(fiber.Map{
		"token":        token,
		"user_id":      userID,
		"username":     input.Username,
		"display_name": displayName,
		"onboarded":    onboarded,
		"profile_data": string(profileData),
	})
}
