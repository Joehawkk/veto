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
	Verdict  string `json:"verdict"`
	Tip      string `json:"tip"`
	HobbyTip string `json:"hobby_tip,omitempty"`
	Source   string `json:"source,omitempty"`
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
				"role":    "system",
				"content": "You are Veto — a strict Russian-language impulse purchase guard for students. Your default is to say NO or WAIT. Only approve if the item is clearly essential (medicine, basic groceries) or the user has thought about it for 3+ days with no red flags. Be blunt, not encouraging. You MUST respond in Russian only. Return only valid JSON without markdown.",
			},
			{
				"role":    "user",
				"content": buildAIPrompt(input),
			},
		},
		"max_tokens":  350,
		"temperature": 0.8,
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

	// Override for essential categories — don't trust the model with these
	cat := detectCategory(input.Name)
	if cat == categoryMedicine || cat == categoryFood || cat == categoryEssentialHygiene ||
		(cat == categoryBasicClothing && input.Price <= 1500) {
		parsed.Verdict = "go"
	}

	parsed.Source = "openrouter"
	return parsed, true
}

func buildFallbackAIResponse(input aiCheckRequest) aiCheckResponse {
	cat := detectCategory(input.Name)
	verdict := deriveAIVerdict(input)

	// Специальные ответы для жизненно важных категорий
	if cat == categoryMedicine {
		tip := fmt.Sprintf("«%s» — это лекарство, бери без сомнений.", input.Name)
		if input.Price > 3000 {
			tip += " Цена высокая — уточни у фармацевта наличие более доступного аналога."
		} else {
			tip += " Здоровье важнее экономии."
		}
		return aiCheckResponse{Verdict: "go", Tip: tip, Source: "fallback"}
	}

	if cat == categoryFood {
		tip := fmt.Sprintf("«%s» — базовый продукт, покупай смело.", input.Name)
		if input.HasDiscount {
			tip += " Со скидкой — тем более хороший момент."
		}
		return aiCheckResponse{Verdict: "go", Tip: tip, Source: "fallback"}
	}

	if cat == categoryBasicClothing && input.Price <= 1500 {
		tip := fmt.Sprintf("«%s» по %.0f ₽ — базовая необходимость, всё ок.", input.Name, input.Price)
		return aiCheckResponse{Verdict: "go", Tip: tip, Source: "fallback"}
	}

	if cat == categoryEssentialHygiene {
		tip := fmt.Sprintf("«%s» — предмет первой необходимости, бери.", input.Name)
		return aiCheckResponse{Verdict: "go", Tip: tip, Source: "fallback"}
	}

	// Общая логика для остальных товаров
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

	h := 0
	for _, c := range input.Name {
		h = h*31 + int(c)
	}
	h += int(input.Price)
	if h < 0 {
		h = -h
	}

	var nextStep string
	switch verdict {
	case "go":
		steps := []string{
			fmt.Sprintf("Проверь финальную цену и убедись, что %.0f ₽ вписываются в бюджет.", input.Price),
			"Если уверен — действуй, ты достаточно подумал.",
			fmt.Sprintf("%.0f ₽ — сумма обдуманная, покупай без лишних сомнений.", input.Price),
		}
		nextStep = steps[h%len(steps)]
	case "wait":
		steps := []string{
			fmt.Sprintf("Дай себе хотя бы день — если через 24 часа желание останется, %.0f ₽ того стоят.", input.Price),
			"Подожди до завтра и посмотри, будет ли желание таким же сильным.",
			fmt.Sprintf("Отложи решение на сутки: %.0f ₽ никуда не денутся, а импульс может пройти.", input.Price),
		}
		nextStep = steps[h%len(steps)]
	default:
		steps := []string{
			fmt.Sprintf("Сохрани %.0f ₽ — это реальный вклад в то, что важнее.", input.Price),
			"Откажись сейчас и поблагодаришь себя позже.",
			fmt.Sprintf("%.0f ₽ лучше отложить на действительно нужную покупку.", input.Price),
		}
		nextStep = steps[h%len(steps)]
	}

	return aiCheckResponse{
		Verdict: verdict,
		Tip: strings.Join(compactSentences(
			buildVerdictLead(verdict, input.Name),
			buildReasonSentence(reasons),
			nextStep,
		), " "),
		HobbyTip: "",
		Source:   "fallback",
	}
}

// buildFallbackHobbyTip возвращает предложение альтернативы по хобби при wait/veto.
func buildFallbackHobbyTip(profile *aiCheckProfile, price float64, verdict string) string {
	if verdict == "go" {
		return ""
	}
	if profile == nil || len(profile.Interests) == 0 {
		return ""
	}

	type priceRange struct {
		max  float64
		tips map[string]string
	}

	ranges := []priceRange{
		{500, map[string]string{
			"Игры":           "за эту сумму можно взять инди-игру в Steam — там часто топовые тайтлы за 200–500 ₽",
			"Музыка":         "хватит на месяц стримингового сервиса с хорошей музыкой без рекламы",
			"Мода":           "загляни на Авито или Vinted — за эту сумму найдётся крутая вещь secondhand",
			"Технологии":     "купи хорошую техническую книгу или доступ к онлайн-курсу на Stepik",
			"Спорт":          "на эту сумму можно взять разовое занятие или пробный абонемент в зал",
			"Книги":          "купи бумажную книгу или оформи подписку Bookmate на месяц",
			"Путешествия":    "отложи — это первый шаг к новой поездке, даже маленькая сумма в копилке считается",
			"Еда":            "попробуй новый ресторан или купи ингредиенты для блюда, которое давно хотел приготовить",
			"Творчество":     "купи новые скетчбуки, краски или другие материалы для любимого хобби",
			"Кино и сериалы": "хватит на подписку стримингового сервиса с огромным каталогом фильмов",
		}},
		{2000, map[string]string{
			"Игры":           "за эту сумму можно взять AAA-игру на распродаже или несколько инди-хитов",
			"Музыка":         "хватит на качественные наушники для бюджета или несколько месяцев стриминга",
			"Мода":           "отличный вариант — найти качественную вещь на Авито или в секонд-хенде",
			"Технологии":     "можно купить курс по интересующей теме или несколько профессиональных книг",
			"Спорт":          "месячный абонемент в зал или набор для домашних тренировок — резинки, коврик",
			"Книги":          "купи 3–4 книги любимых авторов или годовую подписку на электронную библиотеку",
			"Путешествия":    "начни копить на следующую поездку — эта сумма уже ощутимый вклад",
			"Еда":            "закажи набор продуктов для приготовления нескольких новых блюд из разных кухонь",
			"Творчество":     "купи качественные материалы: хорошие кисти, холст или набор для нового хобби",
			"Кино и сериалы": "возьми годовую подписку на стриминг или купи коллекционное издание любимого фильма",
		}},
		{10000, map[string]string{
			"Игры":           "за эту сумму реально взять несколько новинок или DLC к любимой игре",
			"Музыка":         "хватит на хорошие проводные наушники или колонку для дома",
			"Мода":           "отличный бюджет для качественной базовой вещи или аксессуара на долгие годы",
			"Технологии":     "можно купить крутой технический гаджет или полноценный обучающий курс",
			"Спорт":          "купи качественный спортивный инвентарь или несколько месяцев тренировок с тренером",
			"Книги":          "собери библиотеку из 10–15 книг — это инвестиция в знания на годы",
			"Путешествия":    "уже серьёзная сумма для короткого трипа внутри страны — добавь и езжай",
			"Еда":            "закажи кулинарный мастер-класс или купи профессиональный кухонный инструмент",
			"Творчество":     "инвестируй в качественные инструменты: хорошая камера, планшет для рисования",
			"Кино и сериалы": "купи саундбар или улучши домашний кинотеатр для лучшего опыта просмотра",
		}},
		{1e18, map[string]string{
			"Игры":           "за эту сумму можно взять игровые аксессуары, геймпад или обновить периферию",
			"Музыка":         "вложи в качественный звук — наушники или колонка изменят восприятие музыки",
			"Мода":           "купи одну вещь, которая будет служить годами — инвестиция в качество",
			"Технологии":     "это бюджет для серьёзного гаджета или профессионального оборудования",
			"Спорт":          "купи качественное снаряжение для любимого вида спорта — это надолго",
			"Книги":          "собери полную коллекцию любимого автора или серию книг по интересующей теме",
			"Путешествия":    "это уже приличный вклад в поездку мечты — откладывай регулярно",
			"Еда":            "купи профессиональный кухонный прибор, который будет радовать каждый день",
			"Творчество":     "вложи в серьёзный инструмент для творчества — это окупится сторицей",
			"Кино и сериалы": "улучши домашний кинотеатр: новый монитор, проектор или саундсистема",
		}},
	}

	interest := profile.Interests[0]

	for _, r := range ranges {
		if price <= r.max {
			if tip, ok := r.tips[interest]; ok {
				return tip
			}
			return fmt.Sprintf("отложи %.0f ₽ на что-то, что действительно поддержит твоё увлечение «%s»", price, interest)
		}
	}

	return ""
}

type itemCategory int

const (
	categoryGeneral         itemCategory = iota
	categoryMedicine                     // лекарства — всегда go
	categoryFood                         // базовая еда/вода — почти всегда go
	categoryBasicClothing                // носки, бельё, термобельё — go если цена разумная
	categoryEssentialHygiene             // зубная паста, мыло — go если цена разумная
)

func detectCategory(name string) itemCategory {
	lower := strings.ToLower(name)

	medicine := []string{
		"лекарств", "таблетк", "витамин", "антибиотик", "анальгин", "ибупрофен",
		"аспирин", "мазь", "капли глазные", "капли ушные", "сироп от", "бинт",
		"пластырь", "жаропонижающ", "обезболивающ", "антисептик", "перекись",
		"зелёнка", "зеленка", "активированный уголь", "но-шпа", "парацетамол",
		"нурофен", "колдрекс", "терафлю", "медикамент", "препарат",
	}
	// Всё связанное с едой/развлечениями вне дома — не базовые продукты
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

	// Лекарства — всегда go
	if cat == categoryMedicine {
		return "go"
	}
	// Еда, базовая гигиена, базовая одежда при низкой цене — go
	if cat == categoryFood || cat == categoryEssentialHygiene {
		return "go"
	}
	if cat == categoryBasicClothing && input.Price <= 1500 {
		return "go"
	}

	// Базовый штраф — по умолчанию скептичны
	score := -1

	lower := strings.ToLower(input.Name)

	// Еда вне дома / развлечения / спонтанные траты — строже
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

	// Дорогая покупка — дополнительный штраф
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
		score -= 1 // скидка создаёт давление, а не необходимость
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

	// Порог выше — "go" только если реально обдуманно
	if score >= 4 {
		return "go"
	}
	if score >= 1 {
		return "wait"
	}
	return "veto"
}

func buildVerdictLead(verdict, name string) string {
	h := 0
	for _, c := range name {
		h = h*31 + int(c)
	}
	if h < 0 {
		h = -h
	}
	switch verdict {
	case "go":
		leads := []string{
			fmt.Sprintf("«%s» — покупка выглядит оправданной.", name),
			fmt.Sprintf("Похоже, «%s» тебе действительно нужны.", name),
			fmt.Sprintf("Берёшь «%s» — выглядит как осознанное решение.", name),
		}
		return leads[h%len(leads)]
	case "wait":
		leads := []string{
			fmt.Sprintf("С «%s» лучше не спешить.", name),
			fmt.Sprintf("«%s» — стоит взять паузу перед покупкой.", name),
			fmt.Sprintf("Не факт, что «%s» нужны прямо сейчас.", name),
		}
		return leads[h%len(leads)]
	default:
		leads := []string{
			fmt.Sprintf("«%s» — лучше отложить эту покупку.", name),
			fmt.Sprintf("Сейчас не лучший момент для «%s».", name),
			fmt.Sprintf("«%s» выглядит как импульсивное решение — лучше пропустить.", name),
		}
		return leads[h%len(leads)]
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

	hobbyInstruction := ""
	if input.Profile != nil && len(input.Profile.Interests) > 0 {
		hobbyInstruction = fmt.Sprintf(
			`"hobby_tip": "Только для wait/veto: назови 1 конкретную альтернативу по интересам [%s] за схожую сумму ~%.0f ₽. Формат: конкретный товар/сервис + цена + где купить. Пример: 'Курс по иллюстрации на Stepik — 990 ₽'. Если покупка сама по себе связана с интересами пользователя — верни пустую строку. Для go всегда верни пустую строку."`,
			strings.Join(input.Profile.Interests, ", "),
			input.Price,
		)
	} else {
		hobbyInstruction = `"hobby_tip": ""`
	}

	return fmt.Sprintf(`Ты помощник Veto. Отвечай строго на русском языке.
Нужен только JSON без markdown и пояснений:
{"verdict":"go|wait|veto","tip":"2-3 коротких предложения", %s}.

ПРАВИЛА — нарушать нельзя:

ВСЕГДА "go" (только для):
- Лекарства, препараты, медикаменты
- Базовые продукты из магазина: хлеб, молоко, крупа, яйца, мясо, вода, овощи
- Базовая гигиена: зубная паста, мыло, шампунь, прокладки
- Базовая одежда: носки, трусы, нижнее бельё при цене до 1500 ₽

ВСЕГДА scrutinize (никогда не "go" автоматически):
- Еда вне дома: ресторан, кафе, фастфуд, бар, доставка, суши, пицца, бургер
- Напитки: кофе, коктейли, алкоголь, энергетики
- Развлечения: концерт, кино, клуб, вечеринка
- Любая дорогая покупка (> 3000 ₽) без многодневного обдумывания
- Спонтанные покупки одежды, гаджетов, аксессуаров, подписок

ОБЩИЙ ПРИНЦИП: твоя работа — ЗАЩИЩАТЬ кошелёк пользователя. При сомнении — "wait" или "veto". "go" только если покупка явно необходима или обдумывалась 3+ дня без тревожных факторов.

Покупка: %s
Цена: %.0f ₽
Товар по скидке/акции: %t (если true — учти, что скидка создаёт искусственное давление "сейчас или никогда"; спроси себя, купил бы без неё)
Нужно прямо сейчас: %t
Есть похожее: %t
Думал о покупке: %s
Настроение: %s
Локальный вердикт: %s
Профиль: %s
История: %s

Для НЕ-необходимых товаров: учитывай риск импульсивной покупки вечером, ночью, при стрессе и усталости. Совет — честный, короткий, без морализаторства.`,
		hobbyInstruction,
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
	parsed.HobbyTip = strings.TrimSpace(parsed.HobbyTip)
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
