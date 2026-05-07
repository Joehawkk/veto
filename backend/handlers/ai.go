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
	Verdict    string `json:"verdict"`
	Tip        string `json:"tip"`
	Suggestion string `json:"suggestion,omitempty"`
	Source     string `json:"source,omitempty"`
}

const aiSystemPrompt = `Ты — Veto, финансовый коуч для студентов. Анализируй ГЛУБОКО. Отвечай строго JSON без markdown.

Формат: {"verdict":"go|wait|veto","tip":"2-3 предложения","suggestion":"1 предложение про альтернативу"}

═══ АЛГОРИТМ АНАЛИЗА ═══

1. КАТЕГОРИЯ: лекарство/базовые продукты → go. Кофе/фастфуд/доставка → veto.
2. ЦЕНА vs БЮДЖЕТ: если цена > 25% месячных трат → строже.
3. ИМПУЛЬС: думал < 1ч + плохое настроение = явный импульс → veto.
4. ТРИГГЕР: если триггер пользователя совпадает с текущим настроением → назови прямо.
5. ЦЕЛЬ: если есть цель накоплений → укажи цену как % от цели.
6. ИСТОРИЯ: если есть похожие покупки → укажи паттерн.
7. СКИДКА: нейтральный факт, не повод для go.
8. НОЧЬ (22:00–06:00): выше риск эмоциональных решений.

═══ ВЕРДИКТЫ ═══

"veto": думал <1ч И (плохое настроение ИЛИ есть похожее) ИЛИ еда вне дома >400₽ ИЛИ цена >30% бюджета И думал <24ч
"go": нужно сейчас И думал 3+ дней И нет похожего И настроение норм/хорошее ИЛИ лекарства/базовое
"wait": всё остальное

═══ ПРАВИЛА ДЛЯ ПОЛЕЙ ═══

tip (2-3 предложения):
- Обязательно цифры из данных: % бюджета, % от цели накоплений, конкретные суммы
- Если совпадает триггер → "Ты сам назвал X своим триггером — и сейчас именно X"
- Для go: где купить выгоднее (Авито, маркетплейсы, сравни.ру)
- Тон: умный бро, конкретно. Никаких: "взвесь", "подумай", "не торопись", "поблагодаришь себя"

suggestion (1 предложение — альтернатива через интересы пользователя):
- Для wait/veto: как эту же сумму потратить на интерес из профиля — КОНКРЕТНО с ценой
- Пример: "400₽ = 2 месяца Яндекс Музыки без рекламы — раз уж ты любишь музыку"
- Пример: "400₽ — это инди-игра в Steam для геймера"
- Для go: suggestion = "" (пустая строка)
- Если нет интересов: suggestion = "" (пустая строка)

ПЛОХИЕ ПРИМЕРЫ (никогда так):
- "Откажись и поблагодаришь себя позже" ← клише
- "Взвесь все за и против" ← клише
- "Кинопоиск или ИВИ дают первый месяц за 1₽" для кофе ← нерелевантно

ХОРОШИЕ ПРИМЕРЫ:
- "Кофе за 400₽ в день = 12 000₽/мес. Домашняя кофемашина окупается за месяц."
- "Ты выбрал 'стресс' как главный триггер — сейчас у тебя стресс. Это учебниковый импульс."
- "3500₽ = 14% от твоей цели накопить 25 000₽. За 7 таких отказов — цель достигнута."`

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

	// Try Anthropic first (direct API)
	if resp, ok := h.tryAnthropic(input); ok {
		return c.JSON(resp)
	}

	// Try OpenRouter as fallback
	if resp, ok := h.tryOpenRouter(c.BaseURL(), input); ok {
		return c.JSON(resp)
	}

	// Smart deterministic fallback
	return c.JSON(buildFallbackAIResponse(input))
}

func (h *Handler) tryAnthropic(input aiCheckRequest) (aiCheckResponse, bool) {
	if strings.TrimSpace(h.cfg.AnthropicAPIKey) == "" {
		return aiCheckResponse{}, false
	}

	payload := map[string]any{
		"model":      h.cfg.AnthropicModel,
		"max_tokens": 500,
		"system":     aiSystemPrompt,
		"messages": []map[string]string{
			{"role": "user", "content": buildAIPrompt(input)},
		},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return aiCheckResponse{}, false
	}

	req.Header.Set("x-api-key", h.cfg.AnthropicAPIKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return aiCheckResponse{}, false
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return aiCheckResponse{}, false
	}

	var data struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil || len(data.Content) == 0 {
		return aiCheckResponse{}, false
	}

	parsed, ok := parseAIContent(data.Content[0].Text, input.LocalVerdict)
	if !ok {
		return aiCheckResponse{}, false
	}

	parsed = applyHardRules(parsed, input)
	parsed.Source = "anthropic"
	return parsed, true
}

func (h *Handler) tryOpenRouter(baseURL string, input aiCheckRequest) (aiCheckResponse, bool) {
	if strings.TrimSpace(h.cfg.OpenRouterAPIKey) == "" {
		return aiCheckResponse{}, false
	}

	payload := map[string]any{
		"model": h.cfg.OpenRouterModel,
		"messages": []map[string]string{
			{"role": "system", "content": aiSystemPrompt},
			{"role": "user", "content": buildAIPrompt(input)},
		},
		"max_tokens":  500,
		"temperature": 0.7,
	}

	body, _ := json.Marshal(payload)
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
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil || len(data.Choices) == 0 {
		return aiCheckResponse{}, false
	}

	parsed, ok := parseAIContent(data.Choices[0].Message.Content, input.LocalVerdict)
	if !ok {
		return aiCheckResponse{}, false
	}

	parsed = applyHardRules(parsed, input)
	parsed.Source = "openrouter"
	return parsed, true
}

// applyHardRules enforces category and impulse overrides regardless of AI output.
func applyHardRules(parsed aiCheckResponse, input aiCheckRequest) aiCheckResponse {
	cat := detectCategory(input.Name)

	if cat == categoryMedicine || cat == categoryFood || cat == categoryEssentialHygiene ||
		(cat == categoryBasicClothing && input.Price <= 1500) {
		parsed.Verdict = "go"
	}
	if isImpulseItem(input.Name) {
		if parsed.Verdict == "go" {
			parsed.Verdict = "wait"
		}
		if input.Price > 400 && parsed.Verdict == "wait" {
			parsed.Verdict = "veto"
		}
	}
	localVerdict := deriveAIVerdict(input)
	if localVerdict == "wait" && parsed.Verdict == "veto" {
		parsed.Verdict = "wait"
	}
	return parsed
}

// ─── Smart deterministic fallback ────────────────────────────────────────────

func buildFallbackAIResponse(input aiCheckRequest) aiCheckResponse {
	cat := detectCategory(input.Name)

	// Essential categories
	switch cat {
	case categoryMedicine:
		tip := fmt.Sprintf("«%s» — лекарство, берёшь без раздумий.", input.Name)
		if input.Price > 3000 {
			tip += " Цена высокая — спроси фармацевта про дженерик, может быть на 30–50% дешевле."
		} else {
			tip += " Здоровье не та статья, на которой экономят."
		}
		return aiCheckResponse{Verdict: "go", Tip: tip, Source: "fallback"}

	case categoryFood:
		tip := fmt.Sprintf("«%s» — базовые продукты, покупай.", input.Name)
		if input.HasDiscount {
			tip += " Со скидкой — вообще хорошее время."
		}
		return aiCheckResponse{Verdict: "go", Tip: tip, Source: "fallback"}

	case categoryBasicClothing:
		if input.Price <= 1500 {
			return aiCheckResponse{
				Verdict: "go",
				Tip:     fmt.Sprintf("«%s» по %.0f ₽ — базовая необходимость. Берёшь.", input.Name, input.Price),
				Source:  "fallback",
			}
		}

	case categoryEssentialHygiene:
		return aiCheckResponse{
			Verdict: "go",
			Tip:     fmt.Sprintf("«%s» — базовая гигиена. Без вопросов.", input.Name),
			Source:  "fallback",
		}
	}

	verdict := deriveAIVerdict(input)
	tip := buildSmartTip(verdict, input)
	suggestion := buildSmartSuggestion(verdict, input)

	return aiCheckResponse{
		Verdict:    verdict,
		Tip:        tip,
		Suggestion: suggestion,
		Source:     "fallback",
	}
}

func buildSmartTip(verdict string, input aiCheckRequest) string {
	parts := []string{}

	opening := buildSpecificOpening(verdict, input)
	if opening != "" {
		parts = append(parts, opening)
	}

	// For go — skip budget warnings, add where-to-buy advice
	if verdict == "go" {
		actionLine := buildActionLine(verdict, input)
		if actionLine != "" {
			parts = append(parts, actionLine)
		}
		return strings.Join(parts, " ")
	}

	// For wait/veto — show budget context and trigger match
	budgetLine := buildBudgetLine(input)
	if budgetLine != "" {
		parts = append(parts, budgetLine)
	}

	triggerLine := buildTriggerLine(input)
	if triggerLine != "" {
		parts = append(parts, triggerLine)
	}

	actionLine := buildActionLine(verdict, input)
	if actionLine != "" {
		parts = append(parts, actionLine)
	}

	return strings.Join(parts[:min(len(parts), 3)], " ")
}

func buildSpecificOpening(verdict string, input aiCheckRequest) string {
	name := input.Name
	price := input.Price

	isImpulse := isImpulseItem(name)

	switch verdict {
	case "go":
		if input.Answers.ThoughtDuration == "3days" && !input.Answers.HasSimilar {
			return fmt.Sprintf("«%s» — обдуманное решение, 3+ дня — достаточно.", name)
		}
		return fmt.Sprintf("«%s» по %.0f ₽ выглядит как осознанная покупка.", name, price)

	case "wait":
		if isImpulse {
			return fmt.Sprintf("«%s» за %.0f ₽ — классическая спонтанная трата.", name, price)
		}
		if input.Answers.ThoughtDuration == "30min" {
			return fmt.Sprintf("30 минут — слишком мало, чтобы быть уверенным в «%s».", name)
		}
		return fmt.Sprintf("С «%s» не всё однозначно — есть пара вопросов.", name)

	default: // veto
		if isImpulse {
			return fmt.Sprintf("«%s» за %.0f ₽ — это точно импульс, не потребность.", name, price)
		}
		if input.Answers.HasSimilar {
			return fmt.Sprintf("У тебя уже есть похожее на «%s» — зачем дублировать?", name)
		}
		return fmt.Sprintf("«%s» сейчас — не лучший момент.", name)
	}
}

func buildBudgetLine(input aiCheckRequest) string {
	if input.Profile == nil {
		return ""
	}
	p := input.Profile
	price := input.Price

	if p.MonthlySpend > 0 {
		pct := (price / p.MonthlySpend) * 100
		if pct >= 10 {
			budgetStr := fmt.Sprintf("%.0f ₽ = %.0f%% твоего месячного бюджета на спонтанные траты", price, pct)
			if p.SavingsTarget > 0 {
				goalPct := (price / p.SavingsTarget) * 100
				return budgetStr + fmt.Sprintf(", и %.0f%% от цели накопить %.0f ₽", goalPct, p.SavingsTarget)
			}
			return budgetStr + "."
		}
	} else if p.SavingsTarget > 0 {
		goalPct := (price / p.SavingsTarget) * 100
		if goalPct >= 5 {
			return fmt.Sprintf("%.0f ₽ = %.0f%% от твоей цели накопить %.0f ₽.", price, goalPct, p.SavingsTarget)
		}
	}
	return ""
}

func buildTriggerLine(input aiCheckRequest) string {
	if input.Profile == nil {
		return ""
	}
	trigger := strings.ToLower(input.Profile.SpendingTrigger)
	mood := input.Answers.Mood

	stressTrigger := strings.Contains(trigger, "стресс") || strings.Contains(trigger, "тревог")
	tiredTrigger := strings.Contains(trigger, "усталост") || strings.Contains(trigger, "учёб")
	bordomTrigger := strings.Contains(trigger, "скук")
	saleTrigger := strings.Contains(trigger, "скидк") || strings.Contains(trigger, "акци")

	switch {
	case (stressTrigger) && (mood == "stressed" || mood == "angry"):
		return "Ты сам назвал стресс своим триггером — сейчас именно он. Классика."
	case tiredTrigger && mood == "tired":
		return "Твой триггер — усталость после учёбы. Сейчас ты устал. Мозг ищет быстрое удовольствие."
	case bordomTrigger && mood == "neutral":
		return "Скука — твой триггер. Нейтральное настроение без занятия часто ведёт к случайным тратам."
	case saleTrigger && input.HasDiscount:
		return "Скидки — твой триггер. Именно сейчас скидка создаёт давление 'купи пока дают'."
	}
	return ""
}

func buildActionLine(verdict string, input aiCheckRequest) string {
	price := input.Price
	name := input.Name

	isImpulse := isImpulseItem(name)

	switch verdict {
	case "go":
		h := hashStr(name)
		tips := []string{
			fmt.Sprintf("Проверь на Авито — б/у «%s» часто на 20–40%% дешевле.", name),
			fmt.Sprintf("Перед покупкой сравни цены на Яндекс.Маркете — разброс бывает до %.0f ₽.", price*0.15),
			fmt.Sprintf("Хорошее решение. Убедись, что %.0f ₽ не выходят за бюджет этой недели.", price),
		}
		return tips[h%len(tips)]

	case "wait":
		if isImpulse {
			return fmt.Sprintf("Подожди 24 часа. Если завтра захочется так же — это уже не импульс.")
		}
		h := hashStr(name)
		tips := []string{
			"Дай себе 24 часа — импульс либо пройдёт, либо подтвердится.",
			fmt.Sprintf("Поставь напоминание через 3 дня. Если желание осталось — %.0f ₽ того стоят.", price),
			fmt.Sprintf("Посмотри на Авито — тот же товар б/у, сэкономишь до %.0f ₽.", price*0.3),
		}
		return tips[h%len(tips)]

	default: // veto
		if isImpulse && price <= 500 {
			return fmt.Sprintf("Дома выйдет в 5–10 раз дешевле. Сэкономишь %.0f ₽ минимум.", price-price/8)
		}
		return fmt.Sprintf("Сохрани %.0f ₽ — это реальный прогресс к тому, что важнее.", price)
	}
}

func buildSmartSuggestion(verdict string, input aiCheckRequest) string {
	if verdict == "go" {
		return ""
	}
	if input.Profile == nil || len(input.Profile.Interests) == 0 {
		return ""
	}

	price := input.Price
	interest := input.Profile.Interests[0]

	type rangeEntry struct {
		maxPrice float64
		tips     map[string]string
	}

	ranges := []rangeEntry{
		{300, map[string]string{
			"Игры":           fmt.Sprintf("%.0f ₽ — это инди-игра в Steam по акции, если ты геймер.", price),
			"Музыка":         fmt.Sprintf("%.0f ₽ = месяц Яндекс Музыки без рекламы.", price),
			"Мода":           fmt.Sprintf("%.0f ₽ на Авито — найдёшь нормальную вещь secondhand.", price),
			"Технологии":     fmt.Sprintf("%.0f ₽ — хорошая книга по теме или курс на Stepik.", price),
			"Спорт":          fmt.Sprintf("%.0f ₽ = разовое занятие в зале или новые резинки.", price),
			"Книги":          fmt.Sprintf("%.0f ₽ = 1–2 книги на Озоне или месяц Bookmate.", price),
			"Путешествия":    fmt.Sprintf("%.0f ₽ в копилку — шаг к следующей поездке.", price),
			"Еда":            fmt.Sprintf("%.0f ₽ на хорошие продукты для блюда, которое давно хотел.", price),
			"Творчество":     fmt.Sprintf("%.0f ₽ на материалы — скетчбук, краски, новый холст.", price),
			"Кино и сериалы": fmt.Sprintf("%.0f ₽ = 1.5 месяца Кинопоиска.", price),
		}},
		{1000, map[string]string{
			"Игры":           fmt.Sprintf("%.0f ₽ — AAA-игра на распродаже в Steam для геймера.", price),
			"Музыка":         fmt.Sprintf("%.0f ₽ — 5 месяцев Яндекс Музыки без рекламы.", price),
			"Мода":           fmt.Sprintf("%.0f ₽ на Вайлдберриз — найдёшь то же лучше и дешевле.", price),
			"Технологии":     fmt.Sprintf("%.0f ₽ — полноценный курс на Stepik по интересующей теме.", price),
			"Спорт":          fmt.Sprintf("%.0f ₽ = месяц занятий в зале или комплект для дома.", price),
			"Книги":          fmt.Sprintf("%.0f ₽ = 3–4 книги или годовая подписка на электронную библиотеку.", price),
			"Путешествия":    fmt.Sprintf("%.0f ₽ в копилку — уже серьёзный вклад в поездку.", price),
			"Еда":            fmt.Sprintf("%.0f ₽ на кулинарный мастер-класс или дегустацию — новый опыт.", price),
			"Творчество":     fmt.Sprintf("%.0f ₽ на хорошие инструменты — кисти, планшет Wacom базовый.", price),
			"Кино и сериалы": fmt.Sprintf("%.0f ₽ = 5 месяцев Кинопоиска с 4K.", price),
		}},
		{5000, map[string]string{
			"Игры":           fmt.Sprintf("%.0f ₽ — геймпад или несколько новых игр.", price),
			"Музыка":         fmt.Sprintf("%.0f ₽ — хорошие наушники или колонка для твоей музыки.", price),
			"Мода":           fmt.Sprintf("%.0f ₽ на вещь, которая прослужит годами — инвестиция в качество.", price),
			"Технологии":     fmt.Sprintf("%.0f ₽ — продвинутый курс или технический гаджет.", price),
			"Спорт":          fmt.Sprintf("%.0f ₽ — качественный спортивный инвентарь на долгий срок.", price),
			"Книги":          fmt.Sprintf("%.0f ₽ — библиотека из 10+ книг любимого автора или серии.", price),
			"Путешествия":    fmt.Sprintf("%.0f ₽ — билет на поезд или автобус в соседний город.", price),
			"Еда":            fmt.Sprintf("%.0f ₽ — качественный кухонный инструмент, который будет служить годами.", price),
			"Творчество":     fmt.Sprintf("%.0f ₽ — планшет для рисования или профессиональные краски.", price),
			"Кино и сериалы": fmt.Sprintf("%.0f ₽ — саундбар или улучши домашний просмотр.", price),
		}},
		{1e18, map[string]string{
			"Игры":           fmt.Sprintf("%.0f ₽ — серьёзное обновление игровой периферии.", price),
			"Музыка":         fmt.Sprintf("%.0f ₽ — вложи в звук: наушники, которые изменят восприятие музыки.", price),
			"Мода":           fmt.Sprintf("%.0f ₽ — одна вещь премиум-качества лучше трёх дешёвых.", price),
			"Технологии":     fmt.Sprintf("%.0f ₽ — серьёзный гаджет или профессиональное оборудование.", price),
			"Спорт":          fmt.Sprintf("%.0f ₽ — снаряжение для любимого вида спорта, надолго.", price),
			"Книги":          fmt.Sprintf("%.0f ₽ — полная коллекция + красивое издание.", price),
			"Путешествия":    fmt.Sprintf("%.0f ₽ — уже приличная часть бюджета на поездку мечты.", price),
			"Еда":            fmt.Sprintf("%.0f ₽ — профессиональный кухонный прибор навсегда.", price),
			"Творчество":     fmt.Sprintf("%.0f ₽ — камера, хороший планшет или полный набор материалов.", price),
			"Кино и сериалы": fmt.Sprintf("%.0f ₽ — проектор или серьёзный апгрейд домашнего кино.", price),
		}},
	}

	for _, r := range ranges {
		if price <= r.maxPrice {
			if tip, ok := r.tips[interest]; ok {
				return tip
			}
		}
	}
	return ""
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func hashStr(s string) int {
	h := 0
	for _, c := range s {
		h = h*31 + int(c)
	}
	if h < 0 {
		h = -h
	}
	return h
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func isImpulseItem(name string) bool {
	lower := strings.ToLower(name)
	keywords := []string{
		"кофе", "капучино", "латте", "эспрессо", "американо", "раф", "смузи",
		"фраппе", "макиато", "матча", "чай", "какао",
		"ресторан", "рестик", "кафе", "бар", "паб", "клуб",
		"фастфуд", "фаст-фуд", "макдак", "макдоналдс", "бургер", "пицца",
		"суши", "роллы", "шаурма", "хинкали", "доставка еды", "доставка",
		"яндекс еда", "деливери",
		"снек", "чипсы", "сухарики", "конфет", "шоколад", "мороженое",
		"пиво", "вино", "алкоголь", "коктейль", "энергетик",
		"концерт", "кино", "театр", "билет", "вечеринка",
	}
	for _, kw := range keywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

type itemCategory int

const (
	categoryGeneral         itemCategory = iota
	categoryMedicine
	categoryFood
	categoryBasicClothing
	categoryEssentialHygiene
)

func detectCategory(name string) itemCategory {
	lower := strings.ToLower(name)

	impulseKeywords := []string{
		"кофе", "капучино", "латте", "эспрессо", "американо", "раф", "смузи",
		"фраппе", "макиато", "матча", "чай", "какао",
		"ресторан", "рестик", "кафе", "бар", "паб", "клуб",
		"фастфуд", "фаст-фуд", "макдак", "макдоналдс", "бургер", "пицца",
		"суши", "роллы", "шаурма", "хинкали", "доставка еды", "доставка",
		"яндекс еда", "деливери", "delivery",
		"снек", "чипсы", "сухарики", "конфет", "шоколад", "мороженое",
		"пиво", "вино", "алкоголь", "коктейль", "энергетик",
		"концерт", "кино", "театр", "билет", "вечеринка",
	}
	for _, kw := range impulseKeywords {
		if strings.Contains(lower, kw) {
			return categoryGeneral
		}
	}

	medicine := []string{
		"лекарств", "таблетк", "витамин", "антибиотик", "анальгин", "ибупрофен",
		"аспирин", "мазь", "капли глазные", "капли ушные", "сироп от", "бинт",
		"пластырь", "жаропонижающ", "обезболивающ", "антисептик", "перекись",
		"зелёнка", "зеленка", "активированный уголь", "но-шпа", "парацетамол",
		"нурофен", "колдрекс", "терафлю", "медикамент", "препарат",
	}
	food := []string{
		"хлеб", "молоко", "яйц", "гречка", "рис ", "рис,", "картошка", "картофель",
		"макарон", "вода питьевая", "вода минеральная", " вода", "мясо", "куриц",
		"рыба", "соль ", "сахар", "масло подсолнечное", "масло сливочное",
		"кефир", "творог", "сметана", "крупа", "овощ", "фрукт",
	}
	basicClothing := []string{
		"носки", "носок", "трусы", "трусов", "нижнее бельё", "нижнее белье",
		"нательная майка", "нательные", "термобельё", "термобелье", "колготки",
	}
	hygiene := []string{
		"зубная паста", "зубной порошок", "мыло туалетное", "шампунь", "гель для душа",
		"дезодорант", "прокладки", "тампоны", "туалетная бумага",
	}

	for _, kw := range medicine {
		if strings.Contains(lower, kw) {
			return categoryMedicine
		}
	}
	for _, kw := range food {
		if strings.Contains(lower, kw) {
			return categoryFood
		}
	}
	for _, kw := range basicClothing {
		if strings.Contains(lower, kw) {
			return categoryBasicClothing
		}
	}
	for _, kw := range hygiene {
		if strings.Contains(lower, kw) {
			return categoryEssentialHygiene
		}
	}
	return categoryGeneral
}

func deriveAIVerdict(input aiCheckRequest) string {
	cat := detectCategory(input.Name)

	if cat == categoryMedicine {
		return "go"
	}
	if cat == categoryFood || cat == categoryEssentialHygiene {
		return "go"
	}
	if cat == categoryBasicClothing && input.Price <= 1500 {
		return "go"
	}

	score := -1
	lower := strings.ToLower(input.Name)

	impulse := []string{
		"кофе", "капучино", "латте", "эспрессо", "американо", "раф", "смузи",
		"ресторан", "рестик", "кафе", "бар", "паб", "клуб",
		"фастфуд", "бургер", "пицца", "суши", "роллы", "шаурма", "доставка",
		"снек", "чипсы", "конфет", "шоколад", "мороженое",
		"пиво", "вино", "алкоголь", "коктейль", "энергетик",
		"концерт", "кино", "театр", "билет", "вечеринка",
	}
	for _, kw := range impulse {
		if strings.Contains(lower, kw) {
			score -= 2
			break
		}
	}

	if input.Price >= 5000 {
		score -= 1
	}
	if input.Price >= 15000 {
		score -= 1
	}

	if input.Answers.NeedNow {
		score += 2
	} else {
		score -= 2
	}

	if input.Answers.HasSimilar {
		score -= 2
	} else {
		score += 1
	}

	switch input.Answers.ThoughtDuration {
	case "3days":
		score += 3
	case "24hours":
		score += 1
	case "1hour":
		score -= 1
	case "30min":
		score -= 2
	}

	switch input.Answers.Mood {
	case "good", "neutral":
		score += 1
	case "stressed", "tired":
		score -= 2
	case "sad", "angry":
		score -= 2
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

	if score >= 4 {
		return "go"
	}
	if score >= 1 {
		return "wait"
	}
	return "veto"
}

func isRiskyTime() bool {
	hour := time.Now().Hour()
	return hour < 6 || hour >= 21
}

func buildAIPrompt(input aiCheckRequest) string {
	profileLines := []string{}
	if input.Profile != nil {
		p := input.Profile
		profileLines = append(profileLines, fmt.Sprintf("Цель пользователя: %s", emptyFallback(p.Goal, "не указана")))
		profileLines = append(profileLines, fmt.Sprintf("Месячный бюджет на спонтанные траты: %.0f ₽", p.MonthlySpend))
		if p.MonthlySpend > 0 {
			pct := (input.Price / p.MonthlySpend) * 100
			profileLines = append(profileLines, fmt.Sprintf("Цена = %.0f%% месячного бюджета", pct))
		}
		if len(p.Interests) > 0 {
			profileLines = append(profileLines, fmt.Sprintf("Интересы: %s", strings.Join(p.Interests, ", ")))
		}
		if p.SpendingTrigger != "" {
			profileLines = append(profileLines, fmt.Sprintf("Триггер трат: %s", p.SpendingTrigger))
		}
		if p.SavingsTarget > 0 {
			pct := (input.Price / p.SavingsTarget) * 100
			profileLines = append(profileLines, fmt.Sprintf("Цель накоплений: %.0f ₽ за %d мес — покупка = %.0f%% от цели", p.SavingsTarget, p.SavingsMonths, pct))
		}
	}

	historySummary := "нет истории"
	if len(input.RecentHistory) > 0 {
		items := make([]string, 0, len(input.RecentHistory))
		boughtCount := 0
		for _, item := range input.RecentHistory {
			items = append(items, fmt.Sprintf("%s %.0f₽ [%s]", item.Name, item.Price, item.Outcome))
			if item.Outcome == "bought" {
				boughtCount++
			}
		}
		historySummary = strings.Join(items, "; ")
		if boughtCount >= 3 {
			historySummary += fmt.Sprintf(" | ПАТТЕРН: %d покупок подряд — возможен импульсивный цикл", boughtCount)
		}
	}

	hour := time.Now().Hour()
	timeNote := ""
	if hour < 6 || hour >= 22 {
		timeNote = "\nВРЕМЯ: ночь — повышенный риск эмоциональных решений."
	} else if hour >= 18 {
		timeNote = "\nВРЕМЯ: вечер — усталость влияет на решения."
	}

	impulseNote := ""
	if isImpulseItem(input.Name) {
		impulseNote = "\nКАТЕГОРИЯ: еда/напитки вне дома — в suggestion укажи домашнюю альтернативу с ценой."
	}

	thoughtMap := map[string]string{
		"30min": "30 минут", "1hour": "1 час",
		"24hours": "1 день", "3days": "3+ дня",
	}
	moodMap := map[string]string{
		"good": "хорошее", "neutral": "нейтральное",
		"sad": "грустное", "angry": "злой/раздражён",
		"stressed": "стресс/тревога", "tired": "усталость",
	}

	thought := thoughtMap[input.Answers.ThoughtDuration]
	if thought == "" {
		thought = input.Answers.ThoughtDuration
	}
	mood := moodMap[input.Answers.Mood]
	if mood == "" {
		mood = input.Answers.Mood
	}

	return fmt.Sprintf(`=== АНАЛИЗ ===
Товар: «%s»
Цена: %.0f ₽%s
Нужно сейчас: %s
Есть похожее: %s
Думал: %s
Настроение: %s
%s
История: %s%s%s`,
		input.Name,
		input.Price,
		func() string {
			if input.HasDiscount {
				return " (скидка)"
			}
			return ""
		}(),
		boolRu(input.Answers.NeedNow),
		boolRu(input.Answers.HasSimilar),
		thought,
		mood,
		strings.Join(profileLines, "\n"),
		historySummary,
		timeNote,
		impulseNote,
	)
}

func boolRu(b bool) string {
	if b {
		return "да"
	}
	return "нет"
}

func parseAIContent(content, fallbackVerdict string) (aiCheckResponse, bool) {
	content = strings.TrimSpace(content)
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start == -1 || end == -1 || end < start {
		return aiCheckResponse{}, false
	}

	var parsed struct {
		Verdict    string `json:"verdict"`
		Tip        string `json:"tip"`
		Suggestion string `json:"suggestion"`
	}
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

	return aiCheckResponse{
		Verdict:    parsed.Verdict,
		Tip:        parsed.Tip,
		Suggestion: strings.TrimSpace(parsed.Suggestion),
	}, true
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
