package handlers

import (
	"database/sql"
	"encoding/json"

	"github.com/gofiber/fiber/v2"
)

func (h *Handler) CreateCheck(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var input struct {
		Name          string          `json:"name"`
		Price         float64         `json:"price"`
		HasDiscount   bool            `json:"has_discount"`
		Answers       json.RawMessage `json:"answers"`
		AIVerdict     string          `json:"ai_verdict"`
		AIComment     string          `json:"ai_comment"`
		AISuggestion  string          `json:"ai_suggestion"`
		AISource      string          `json:"ai_source"`
		Outcome       string          `json:"outcome"`
		TimerDeadline *string         `json:"timer_deadline"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid input"})
	}
	if input.Name == "" || input.Price <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "name and price required"})
	}
	if input.Outcome == "" {
		input.Outcome = "pending"
	}
	if len(input.Answers) == 0 {
		input.Answers = json.RawMessage("{}")
	}

	var id string
	err := h.db.QueryRow(
		`INSERT INTO checks (user_id, name, price, has_discount, answers, ai_verdict, ai_comment, ai_suggestion, ai_source, outcome, timer_deadline)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
		userID, input.Name, input.Price, input.HasDiscount,
		[]byte(input.Answers), input.AIVerdict, input.AIComment, input.AISuggestion, input.AISource, input.Outcome, input.TimerDeadline,
	).Scan(&id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if input.Outcome == "stopped" {
		h.db.Exec(`UPDATE users SET total_saved = total_saved + $1 WHERE id = $2`, input.Price, userID)
		var username string
		h.db.QueryRow(`SELECT username FROM users WHERE id = $1`, userID).Scan(&username)
		go h.notifyGroupMembersAboutCheck(userID, username, input.Name, input.Price)
	}

	return c.Status(201).JSON(fiber.Map{"id": id})
}

func (h *Handler) ListChecks(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	rows, err := h.db.Query(
		`SELECT id, name, price, has_discount, answers, ai_verdict, ai_comment, ai_source, outcome, timer_deadline, created_at
		 FROM checks WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	result := make([]fiber.Map, 0)
	for rows.Next() {
		var id, name, aiVerdict, aiComment, aiSource, outcome, createdAt string
		var price float64
		var hasDiscount bool
		var answers []byte
		var timerDeadline sql.NullString

		if err := rows.Scan(&id, &name, &price, &hasDiscount, &answers, &aiVerdict, &aiComment, &aiSource, &outcome, &timerDeadline, &createdAt); err != nil {
			continue
		}

		var answersMap interface{}
		json.Unmarshal(answers, &answersMap)

		entry := fiber.Map{
			"id": id, "name": name, "price": price, "has_discount": hasDiscount,
			"answers": answersMap, "ai_verdict": aiVerdict, "ai_comment": aiComment,
			"ai_source": aiSource, "outcome": outcome, "created_at": createdAt,
		}
		if timerDeadline.Valid {
			entry["timer_deadline"] = timerDeadline.String
		} else {
			entry["timer_deadline"] = nil
		}
		result = append(result, entry)
	}

	return c.JSON(result)
}

func (h *Handler) UpdateCheck(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	checkID := c.Params("id")

	var input struct {
		Outcome       *string `json:"outcome"`
		TimerDeadline *string `json:"timer_deadline"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid input"})
	}

	if input.Outcome != nil {
		var currentOutcome string
		var price float64
		err := h.db.QueryRow(
			`SELECT outcome, price FROM checks WHERE id = $1 AND user_id = $2`,
			checkID, userID,
		).Scan(&currentOutcome, &price)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "check not found"})
		}

		h.db.Exec(`UPDATE checks SET outcome = $1 WHERE id = $2 AND user_id = $3`, *input.Outcome, checkID, userID)

		if *input.Outcome == "stopped" && currentOutcome != "stopped" {
			h.db.Exec(`UPDATE users SET total_saved = total_saved + $1 WHERE id = $2`, price, userID)
			var checkName string
			h.db.QueryRow(`SELECT name FROM checks WHERE id = $1`, checkID).Scan(&checkName)
			var username string
			h.db.QueryRow(`SELECT username FROM users WHERE id = $1`, userID).Scan(&username)
			go h.notifyGroupMembersAboutCheck(userID, username, checkName, price)
		} else if currentOutcome == "stopped" && *input.Outcome != "stopped" {
			h.db.Exec(`UPDATE users SET total_saved = GREATEST(0, total_saved - $1) WHERE id = $2`, price, userID)
		}
	}

	if input.TimerDeadline != nil {
		h.db.Exec(`UPDATE checks SET timer_deadline = $1 WHERE id = $2 AND user_id = $3`, *input.TimerDeadline, checkID, userID)
	}

	return c.JSON(fiber.Map{"ok": true})
}
