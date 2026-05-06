package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type aiCheckRequest struct {
	Name          string           `json:"name"`
	Price         float64          `json:"price"`
	HasDiscount   bool             `json:"hasDiscount"`
	Answers       aiCheckAnswers   `json:"answers"`
	LocalVerdict  string           `json:"localVerdict"`
	Profile       *aiCheckProfile  `json:"profile"`
	RecentHistory []aiHistoryEntry `json:"recentHistory"`
}

type aiCheckAnswers struct {
	NeedNow         bool   `json:"needNow"`
	HasSimilar      bool   `json:"hasSimilar"`
	ThoughtDuration string `json:"thoughtDuration"`
	Mood            string `json:"mood"`
}

type aiCheckProfile struct {
	Goal            string   `json:"goal"`
	MonthlySpend    float64  `json:"monthlySpend"`
	SpendingTrigger string   `json:"spendingTrigger"`
	Interests       []string `json:"interests"`
	SavingsTarget   float64  `json:"savingsTarget"`
	SavingsMonths   int      `json:"savingsMonths"`
}

type aiHistoryEntry struct {
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	AIVerdict string  `json:"aiVerdict"`
	Outcome   string  `json:"outcome"`
}

type aiCheckResponse struct {
	Verdict string `json:"verdict"`
	Tip     string `json:"tip"`
	Source  string `json:"source,omitempty"`
}

func (h *Handler) CheckAI(c *fiber.Ctx) error {
	var input aiCheckRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid input"})
	}

	if strings.TrimSpace(input.Name) == "" || input.Price <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "name and price are required"})
	}

	if !isValidVerdict(input.LocalVerdict) {
		input.LocalVerdict = "wait"
	}

	if response, ok := h.tryOpenRouter(c.BaseURL(), input); ok {
		return c.JSON(response)
	}

	return c.JSON(buildFallbackAIResponse(input))
}

func (h *Handler) tryOpenRouter(baseURL string, input aiCheckRequest) (aiCheckResponse, bool) {
	if strings.TrimSpace(h.cfg.OpenRouterAPIKey) == "" {
		return aiCheckResponse{}, false
	}

	payload := map[string]any{
		"model": h.cfg.OpenRouterModel,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": buildAIPrompt(input),
			},
		},
		"max_tokens":  220,
		"temperature": 0.6,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return aiCheckResponse{}, false
	}

	req, err := http.NewRequest(http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return aiCheckResponse{}, false
	}

	req.Header.Set("Authorization", "Bearer "+h.cfg.OpenRouterAPIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", baseURL)
	req.Header.Set("X-Title", "Veto")

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return aiCheckResponse{}, false
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return aiCheckResponse{}, false
	}

	var data struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return aiCheckResponse{}, false
	}

	if len(data.Choices) == 0 {
		return aiCheckResponse{}, false
	}

	parsed, ok := parseAIContent(data.Choices[0].Message.Content, input.LocalVerdict)
	if !ok {
		return aiCheckResponse{}, false
	}

	parsed.Source = "openrouter"
	return parsed, true
}

func buildFallbackAIResponse(input aiCheckRequest) aiCheckResponse {
	verdict := deriveAIVerdict(input)
	reasons := make([]string, 0, 5)

	if isRiskyTime() {
		reasons = append(reasons, "сейчас не лучшее время для холодной оценки покупки")
	}
	switch input.Answers.Mood {
	case "stressed", "tired":
		reasons = append(reasons, "усталость или стресс повышают риск импульсивного решения")
	case "sad", "angry":
		reasons = append(reasons, "эмоции могут смещать оценку покупки")
	}
	if input.Answers.HasSimilar {
		reasons = append(reasons, "у тебя уже есть похожая вещь")
	}
	if input.Answers.ThoughtDuration == "30min" || input.Answers.ThoughtDuration == "1hour" {
		reasons = append(reasons, "желание появилось слишком недавно")
	}
	if input.HasDiscount {
		reasons = append(reasons, "скидка сама по себе не делает покупку нужной")
	}
	if input.Profile != nil && strings.TrimSpace(input.Profile.Goal) != "" {
		reasons = append(reasons, fmt.Sprintf("эти %.0f ₽ можно сохранить для цели «%s»", input.Price, input.Profile.Goal))
	}

	if len(reasons) == 0 {
		reasons = append(reasons, "по твоим ответам решение выглядит достаточно обдуманным")
	}

	var nextStep string
	switch verdict {
	case "go":
		nextStep = "Если берешь, просто проверь итоговую цену и что эта вещь реально пригодится в ближайшее время."
	case "wait":
		nextStep = "Дай себе хотя бы сутки и проверь, останется ли это желание таким же уверенным завтра."
	default:
		nextStep = "Сейчас разумнее отказаться и оставить деньги на более важную цель или действительно нужную покупку."
	}

	return aiCheckResponse{
		Verdict: verdict,
		Tip: strings.Join(compactSentences(
			buildVerdictLead(verdict, input.Name),
			buildReasonSentence(reasons),
			nextStep,
		), " "),
		Source: "fallback",
	}
}

func deriveAIVerdict(input aiCheckRequest) string {
	score := 0

	if input.Answers.NeedNow {
		score += 2
	} else {
		score -= 2
	}

	if input.Answers.HasSimilar {
		score -= 1
	} else {
		score += 1
	}

	switch input.Answers.ThoughtDuration {
	case "3days":
		score += 2
	case "24hours":
		score += 1
	case "30min":
		score -= 1
	}

	switch input.Answers.Mood {
	case "good", "neutral":
		score += 1
	case "stressed", "tired":
		score -= 2
	case "sad", "angry":
		score -= 1
	}

	if isRiskyTime() {
		score -= 1
	}
	if input.HasDiscount {
		score -= 1
	}

	stoppedCount := 0
	for _, entry := range input.RecentHistory {
		if entry.Outcome == "stopped" {
			stoppedCount++
		}
	}
	if stoppedCount >= 3 {
		score -= 1
	}

	if score >= 3 {
		return "go"
	}
	if score >= 0 {
		return "wait"
	}
	return "veto"
}

func buildVerdictLead(verdict, name string) string {
	switch verdict {
	case "go":
		return fmt.Sprintf("Похоже, покупка «%s» сейчас выглядит оправданной.", name)
	case "wait":
		return fmt.Sprintf("С покупкой «%s» лучше немного притормозить.", name)
	default:
		return fmt.Sprintf("Покупку «%s» лучше пропустить.", name)
	}
}

func buildReasonSentence(reasons []string) string {
	if len(reasons) == 0 {
		return ""
	}

	text := strings.Join(reasons, ", ")
	runes := []rune(text)
	if len(runes) == 0 {
		return ""
	}
	runes[0] = []rune(strings.ToUpper(string(runes[0])))[0]
	return string(runes) + "."
}

func compactSentences(parts ...string) []string {
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func isRiskyTime() bool {
	hour := time.Now().Hour()
	return hour < 6 || hour >= 21
}

func buildAIPrompt(input aiCheckRequest) string {
	profileSummary := "без профиля"
	if input.Profile != nil {
		profileSummary = fmt.Sprintf(
			"цель: %s; месячные импульсивные траты: %.0f ₽; интересы: %s",
			emptyFallback(input.Profile.Goal, "не указана"),
			input.Profile.MonthlySpend,
			emptyFallback(strings.Join(input.Profile.Interests, ", "), "не указаны"),
		)
	}

	historySummary := "нет истории"
	if len(input.RecentHistory) > 0 {
		items := make([]string, 0, len(input.RecentHistory))
		for _, item := range input.RecentHistory {
			items = append(items, fmt.Sprintf("%s %.0f ₽ (%s)", item.Name, item.Price, item.Outcome))
		}
		historySummary = strings.Join(items, "; ")
	}

	return fmt.Sprintf(`Ты помощник Veto. Отвечай строго на русском языке.
Нужен только JSON без markdown и пояснений: {"verdict":"go|wait|veto","tip":"2-3 коротких предложения"}.

Покупка: %s
Цена: %.0f ₽
Есть скидка: %t
Нужно прямо сейчас: %t
Есть похожее: %t
Думал о покупке: %s
Настроение: %s
Локальный вердикт: %s
Профиль: %s
История: %s

Учитывай риск импульсивной покупки вечером, ночью, при стрессе и усталости. Совет должен быть честным, коротким и без морализаторства.`,
		input.Name,
		input.Price,
		input.HasDiscount,
		input.Answers.NeedNow,
		input.Answers.HasSimilar,
		input.Answers.ThoughtDuration,
		input.Answers.Mood,
		input.LocalVerdict,
		profileSummary,
		historySummary,
	)
}

func parseAIContent(content, fallbackVerdict string) (aiCheckResponse, bool) {
	content = strings.TrimSpace(content)
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start == -1 || end == -1 || end < start {
		return aiCheckResponse{}, false
	}

	var parsed aiCheckResponse
	if err := json.Unmarshal([]byte(content[start:end+1]), &parsed); err != nil {
		return aiCheckResponse{}, false
	}

	if !isValidVerdict(parsed.Verdict) {
		parsed.Verdict = fallbackVerdict
	}
	parsed.Tip = strings.TrimSpace(parsed.Tip)
	if parsed.Tip == "" {
		return aiCheckResponse{}, false
	}
	return parsed, true
}

func isValidVerdict(verdict string) bool {
	return verdict == "go" || verdict == "wait" || verdict == "veto"
}

func emptyFallback(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
