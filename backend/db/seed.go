package db

import (
	"database/sql"
	"log"

	"golang.org/x/crypto/bcrypt"
)

func Seed(db *sql.DB) error {
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&count)
	if count > 0 {
		return nil
	}

	log.Println("Seeding database with 5 test users...")

	hash, _ := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)
	pw := string(hash)

	type seedUser struct {
		username, displayName, avatarURL string
		profileData                      string
	}

	users := []seedUser{
		{
			"alex", "Алекс", "/uploads/626457731d0ab3dc14118c6c4f348661.jpg",
			`{"goal":"Коплю на конкретную цель","spendingTriggers":["Скидки и акции","Реклама в соцсетях"],"interests":["Технологии","Игры"],"monthlySpend":5000,"savingsTarget":90000,"savingsMonths":6}`,
		},
		{
			"mika", "Мика", "/uploads/8478ebe165b0bfe2ff91654442540e35.jpg",
			`{"goal":"Хочу тратить осознаннее","spendingTriggers":["Стресс или тревога","Скука"],"interests":["Музыка","Технологии"],"monthlySpend":8000,"savingsTarget":120000,"savingsMonths":8}`,
		},
		{
			"dima", "Дима", "/uploads/851acfc242e03dbe748c4347272490b2.jpg",
			`{"goal":"Коплю на конкретную цель","spendingTriggers":["Влияние друзей","Скидки и акции"],"interests":["Игры","Кино и сериалы"],"monthlySpend":4000,"savingsTarget":60000,"savingsMonths":5}`,
		},
		{
			"kata", "Катя", "/uploads/d6f4e1fdcdceb83ac1a8a944975143a3.jpg",
			`{"goal":"Справляюсь с финансовым стрессом","spendingTriggers":["Стресс или тревога","Реклама в соцсетях"],"interests":["Путешествия","Мода"],"monthlySpend":10000,"savingsTarget":200000,"savingsMonths":12}`,
		},
		{
			"ivan", "Иван", "/uploads/f0bf470f239b6b17d76859ec149a3301.jpg",
			`{"goal":"Хочу тратить осознаннее","spendingTriggers":["Скука","Усталость после учёбы"],"interests":["Игры","Технологии"],"monthlySpend":3000,"savingsTarget":12000,"savingsMonths":3}`,
		},
	}

	userIDs := make([]string, len(users))
	for i, u := range users {
		err := db.QueryRow(
			`INSERT INTO users (username, password_hash, display_name, avatar_url, total_saved, onboarded, profile_data)
			 VALUES ($1, $2, $3, $4, 0, true, $5::jsonb) RETURNING id`,
			u.username, pw, u.displayName, u.avatarURL, u.profileData,
		).Scan(&userIDs[i])
		if err != nil {
			return err
		}
	}

	// ── Goals ──────────────────────────────────────────────────────────────
	type seedGoal struct {
		userIdx       int
		title         string
		target, saved float64
		status        string
	}
	goals := []seedGoal{
		{0, "Новый iPhone 16 Pro", 90000, 18500, "active"},
		{1, "MacBook Air M2", 120000, 32000, "active"},
		{1, "AirPods Pro 2", 22000, 22000, "completed"},
		{2, "PlayStation 5 Pro", 60000, 15000, "active"},
		{3, "Путешествие в Японию", 200000, 45000, "active"},
		{3, "Курс по фотографии", 8000, 8000, "completed"},
		{4, "Механическая клавиатура", 12000, 4800, "active"},
	}

	goalIDs := make([]int64, len(goals))
	for i, g := range goals {
		db.QueryRow(
			`INSERT INTO goals (user_id, title, target_amount, current_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			userIDs[g.userIdx], g.title, g.target, g.saved, g.status,
		).Scan(&goalIDs[i])
	}

	// ── Vetos (home screen VETO button records) ────────────────────────────
	type seedVeto struct {
		userIdx, goalIdx int
		amount           float64
		description      string
		ago              string
	}
	vetos := []seedVeto{
		{0, 0, 350, "Кофе в Старбакс", "2 hours"},
		{0, 0, 1200, "Такси домой", "5 hours"},
		{0, 0, 4800, "Куртка в Zara", "1 day"},
		{0, 0, 12150, "Ужин в ресторане", "3 days"},
		{1, 1, 990, "Подписка на стриминг", "1 hour"},
		{1, 1, 3500, "Новые кроссовки", "6 hours"},
		{1, 1, 7200, "Концерт", "2 days"},
		{1, 1, 20310, "Планшет Xiaomi", "4 days"},
		{2, 3, 500, "Кофе и круассан", "3 hours"},
		{2, 3, 2800, "Игра в Steam", "1 day"},
		{2, 3, 11700, "Наушники JBL", "2 days"},
		{3, 4, 1500, "Доставка еды", "30 minutes"},
		{3, 4, 8900, "Телефон б/у", "4 hours"},
		{3, 4, 15000, "Тур выходного дня", "1 day"},
		{3, 4, 19600, "Диван", "3 days"},
		{4, 6, 650, "Кофе с десертом", "1 hour"},
		{4, 6, 2100, "Футболка в H&M", "6 hours"},
		{4, 6, 2050, "Наушники Xiaomi", "2 days"},
	}

	vetoIDs := make([]int64, len(vetos))
	for i, v := range vetos {
		db.QueryRow(
			`INSERT INTO vetos (user_id, goal_id, amount, description, created_at)
			 VALUES ($1, $2, $3, $4, NOW() - $5::INTERVAL) RETURNING id`,
			userIDs[v.userIdx], goalIDs[v.goalIdx], v.amount, v.description, v.ago,
		).Scan(&vetoIDs[i])
	}

	// ── Checks (AI purchase analysis history) ──────────────────────────────
	// answers format: {"needNow":bool,"hasSimilar":bool,"thoughtDuration":"30min|1hour|24hours|3days","mood":"good|neutral|sad|angry|stressed|tired"}
	type seedCheck struct {
		userIdx     int
		name        string
		price       float64
		hasDiscount bool
		answers     string
		verdict     string // go / wait / veto
		comment     string // AI comment
		suggestion  string // interest-based alternative (empty for go)
		outcome     string // stopped / bought / pending
		ago         string
	}

	checks := []seedCheck{
		// ── Алекс (iPhone цель, интересы: Технологии, Игры) ───────────────
		{
			userIdx: 0, name: "Кроссовки Nike Air Max", price: 7200,
			answers:  `{"needNow":false,"hasSimilar":true,"thoughtDuration":"30min","mood":"neutral"}`,
			verdict:  "veto",
			comment:  "Ты думал об этом 30 минут, да ещё и похожие кроссовки уже есть. Это чистый импульс. 7200 ₽ — реальный вклад в твой iPhone, не трать их на третью пару обуви.",
			outcome:  "stopped", ago: "13 days",
		},
		{
			userIdx: 0, name: "AirPods Pro (реплика)", price: 1800,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"1hour","mood":"good"}`,
			verdict:  "veto",
			comment:  "Цена 1800 ₽ за «AirPods Pro» — это красный флаг. Оригинал стоит 15 000+ ₽. Почти наверняка подделка: плохой звук, сломается через месяц. Не трать деньги.",
			outcome:  "stopped", ago: "9 days",
		},
		{
			userIdx: 0, name: "Подписка Xbox Game Pass", price: 499,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"3days","mood":"good"}`,
			verdict:  "go",
			comment:  "Сотни игр за 499 ₽ в месяц — разумно для геймера. Ты думал 3+ дня, настроение хорошее, альтернативы нет. Отличное соотношение цены и ценности.",
			outcome:  "bought", ago: "6 days",
		},
		{
			userIdx: 0, name: "Бургер King", price: 380,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"30min","mood":"stressed"}`,
			verdict:  "veto",
			comment:  "Фастфуд на стрессе — классическая ловушка. Дома бургер обойдётся в 100–150 ₽: булка, котлета, овощи. Сохрани 380 ₽ для iPhone — каждая сотня считается.",
			outcome:  "stopped", ago: "2 days",
		},

		// ── Мика (MacBook цель, интересы: Музыка, Технологии) ─────────────
		{
			userIdx: 1, name: "Sony WH-1000XM5", price: 22000,
			answers:  `{"needNow":false,"hasSimilar":true,"thoughtDuration":"1hour","mood":"neutral"}`,
			verdict:  "veto",
			comment:  "22 000 ₽ — серьёзная сумма, и ты думала об этом всего час. Плюс похожие наушники уже есть. Подожди 2 недели: если желание не исчезнет и найдёшь скидку — тогда да.",
			suggestion: "Месяц Яндекс Музыки или Spotify — музыка без рекламы за ~200 ₽",
			outcome:  "stopped", ago: "14 days",
		},
		{
			userIdx: 1, name: "Кофе Starbucks латте", price: 450,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"30min","mood":"tired"}`,
			verdict:  "veto",
			comment:  "450 ₽ за один кофе — при ежедневной привычке это 13 500 ₽ в месяц. Купи хорошие зёрна и вари дома за 30–50 ₽ за кружку. Или найди кофейню с капучино за 150 ₽.",
			outcome:  "stopped", ago: "10 days",
		},
		{
			userIdx: 1, name: "Курс Python на Udemy", price: 990,
			hasDiscount: true,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"3days","mood":"good"}`,
			verdict:  "go",
			comment:  "Инвестиция в навыки, которая окупится. Ты думала 3+ дня, настроение отличное, скидка реальная. Это не покупка — это вложение в себя. Бери.",
			outcome:  "bought", ago: "7 days",
		},
		{
			userIdx: 1, name: "Платье Zara", price: 3200,
			answers:  `{"needNow":false,"hasSimilar":true,"thoughtDuration":"1hour","mood":"stressed"}`,
			verdict:  "wait",
			comment:  "Стресс — плохой советчик при покупках одежды. Похожие платья уже есть, а желание появилось час назад. Поставь таймер на 2 дня: поищи на Авито или Vinted — та же вещь втрое дешевле.",
			suggestion: "Загляни на Авито или Vinted — те же вещи в разы дешевле",
			outcome:  "stopped", ago: "4 days",
		},

		// ── Дима (PS5 цель, интересы: Игры, Кино) ─────────────────────────
		{
			userIdx: 2, name: "Elden Ring (PC)", price: 2499,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"3days","mood":"good"}`,
			verdict:  "go",
			comment:  "Топовая игра, которую ты ждал несколько дней. Настроение хорошее, аналогов нет, цена разумная. Осознанное решение — бери и наслаждайся.",
			outcome:  "bought", ago: "12 days",
		},
		{
			userIdx: 2, name: "Доставка Pizza Hut", price: 1200,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"30min","mood":"tired"}`,
			verdict:  "veto",
			comment:  "Пицца с доставкой втрое дороже магазинной. Купи готовую пиццу в супермаркете за 250–350 ₽ или замороженную — не хуже, и 850 ₽ останутся на PS5.",
			outcome:  "stopped", ago: "8 days",
		},
		{
			userIdx: 2, name: "Кепка Supreme", price: 8500,
			answers:  `{"needNow":false,"hasSimilar":false,"thoughtDuration":"1hour","mood":"sad"}`,
			verdict:  "veto",
			comment:  "8500 ₽ за кепку, когда настроение на нуле — учебниковый импульс. Грусть провоцирует «шопинг-терапию», но потом жалеешь. Подожди неделю — скорее всего не захочешь.",
			suggestion: "Кинопоиск или ИВИ дают первый месяц за 1 ₽",
			outcome:  "stopped", ago: "5 days",
		},
		{
			userIdx: 2, name: "Чипсы Pringles × 3", price: 450,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"30min","mood":"neutral"}`,
			verdict:  "wait",
			comment:  "Три пачки сразу — перебор. Купи одну если очень хочется, а две других сэкономь. 300 ₽ мелочь? На PS5 таких «мелочей» хватит на месяц.",
			outcome:  "stopped", ago: "1 day",
		},

		// ── Катя (Япония цель, интересы: Путешествия, Мода) ───────────────
		{
			userIdx: 3, name: "Сумка Michael Kors", price: 15000,
			answers:  `{"needNow":false,"hasSimilar":true,"thoughtDuration":"1hour","mood":"stressed"}`,
			verdict:  "veto",
			comment:  "15 000 ₽ — это почти 8% от твоей цели на Японию. Ты думала об этом час в стрессовом состоянии, и похожая сумка уже есть. Через неделю этот порыв пройдёт, а деньги останутся.",
			suggestion: "Загляни на Авито или Vinted — те же вещи в разы дешевле",
			outcome:  "stopped", ago: "15 days",
		},
		{
			userIdx: 3, name: "Авиабилет Москва–Бангкок", price: 28500,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"3days","mood":"good"}`,
			verdict:  "go",
			comment:  "Это прямо в твою цель! Ты давно планировала путешествие, настроение отличное, ты всё взвесила. Бери — это не трата, это инвестиция в мечту.",
			outcome:  "bought", ago: "10 days",
		},
		{
			userIdx: 3, name: "Маска для волос Kerastase", price: 2800,
			hasDiscount: true,
			answers:  `{"needNow":false,"hasSimilar":true,"thoughtDuration":"24hours","mood":"neutral"}`,
			verdict:  "wait",
			comment:  "Уход за собой важен, но 2800 ₽ — дорого даже со скидкой, и похожее средство уже есть. Поищи аналог за 400–700 ₽ — состав часто идентичный, бренд другой.",
			outcome:  "stopped", ago: "6 days",
		},
		{
			userIdx: 3, name: "Ужин в ресторане Nobu", price: 6500,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"30min","mood":"stressed"}`,
			verdict:  "veto",
			comment:  "Премиум-ресторан на импульсе в стрессовый день — типичная ловушка. Это не про еду, это про «я заслужила». Приготовь любимое блюдо дома или выбери кафе до 1000 ₽.",
			outcome:  "stopped", ago: "3 days",
		},

		// ── Иван (Клавиатура цель, интересы: Игры, Технологии) ───────────
		{
			userIdx: 4, name: "Мышь Logitech G Pro X", price: 6500,
			answers:  `{"needNow":false,"hasSimilar":true,"thoughtDuration":"24hours","mood":"neutral"}`,
			verdict:  "wait",
			comment:  "Хорошая мышь, но 6500 ₽ при цели 12 000 ₽ — это половина копилки. Похожая мышь уже есть. Подожди до ноябрьских скидок — такие мышки падают на 30–40%.",
			suggestion: "Поищи игру на распродаже в Steam — часто топ за 100–300 ₽",
			outcome:  "stopped", ago: "11 days",
		},
		{
			userIdx: 4, name: "Наушники Xiaomi Redmi Buds", price: 2050,
			answers:  `{"needNow":false,"hasSimilar":true,"thoughtDuration":"1hour","mood":"tired"}`,
			verdict:  "wait",
			comment:  "Второй раз смотришь на наушники — похожие уже есть. Усталость делает всё привлекательнее. Дай себе 2 дня: если старые работают, зачем вторые?",
			outcome:  "stopped", ago: "7 days",
		},
		{
			userIdx: 4, name: "Кофе и булка в кафе", price: 650,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"30min","mood":"tired"}`,
			verdict:  "veto",
			comment:  "650 ₽ за кофе и булку — в три раза дороже магазина. Возьми кофе навынос за 150 ₽ или сделай дома. 500 ₽ разницы — реальный вклад в клавиатуру.",
			outcome:  "stopped", ago: "4 days",
		},
		{
			userIdx: 4, name: "Подписка Яндекс Плюс", price: 299,
			answers:  `{"needNow":true,"hasSimilar":false,"thoughtDuration":"3days","mood":"good"}`,
			verdict:  "go",
			comment:  "Музыка, кино, скидки на такси и доставку — за 299 ₽ в месяц это выгодно. Ты думал 3+ дня и точно знаешь, что будешь пользоваться. Разумно.",
			outcome:  "bought", ago: "2 days",
		},
	}

	checkIDs := make([]string, len(checks))
	for i, ch := range checks {
		err := db.QueryRow(
			`INSERT INTO checks (user_id, name, price, has_discount, answers, ai_verdict, ai_comment, ai_suggestion, ai_source, outcome, created_at)
			 VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,'openrouter',$9, NOW() - $10::INTERVAL)
			 RETURNING id`,
			userIDs[ch.userIdx], ch.name, ch.price, ch.hasDiscount,
			ch.answers, ch.verdict, ch.comment, ch.suggestion, ch.outcome, ch.ago,
		).Scan(&checkIDs[i])
		if err != nil {
			log.Printf("check insert error [%s]: %v", ch.name, err)
		}
	}

	// ── Recalculate total_saved from both vetos + stopped checks ───────────
	for _, uid := range userIDs {
		db.Exec(`
			UPDATE users SET total_saved = COALESCE((
				SELECT SUM(amount) FROM vetos WHERE user_id = $1
			), 0) + COALESCE((
				SELECT SUM(price) FROM checks WHERE user_id = $1 AND outcome = 'stopped'
			), 0)
			WHERE id = $1`, uid)
	}

	// ── Respects on vetos ──────────────────────────────────────────────────
	respects := [][2]int{
		{1, 0}, {2, 0}, {3, 0}, {4, 0},
		{0, 4}, {2, 4}, {3, 4},
		{0, 8}, {1, 8}, {3, 8}, {4, 8},
		{0, 11}, {1, 11}, {2, 11}, {4, 11},
		{0, 3}, {1, 3}, {4, 3},
		{2, 6}, {3, 6},
		{0, 15}, {1, 15}, {2, 15}, {3, 15},
	}
	for _, r := range respects {
		db.Exec(
			`INSERT INTO respects (veto_id, from_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			vetoIDs[r[1]], userIDs[r[0]],
		)
	}

	// ── Groups ─────────────────────────────────────────────────────────────
	var g1, g2 int64
	db.QueryRow(
		`INSERT INTO groups (name, invite_code, owner_id) VALUES ('Финансисты', 'FIN2025', $1) RETURNING id`,
		userIDs[0],
	).Scan(&g1)
	db.QueryRow(
		`INSERT INTO groups (name, invite_code, owner_id) VALUES ('Экономим вместе', 'ECO2025', $1) RETURNING id`,
		userIDs[3],
	).Scan(&g2)

	for _, uid := range []string{userIDs[0], userIDs[1], userIDs[2]} {
		db.Exec(`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, g1, uid)
	}
	for _, uid := range []string{userIDs[3], userIDs[4], userIDs[0]} {
		db.Exec(`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, g2, uid)
	}
	db.Exec(`UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2`, g1, userIDs[0])
	db.Exec(`UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2`, g2, userIDs[3])
	db.Exec(`UPDATE group_members SET role = 'admin'  WHERE group_id = $1 AND user_id = $2`, g1, userIDs[1])

	// ── Notifications ──────────────────────────────────────────────────────
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'group_veto', $2)`,
		userIDs[0], "@mika ветировала «Платье Zara» на 3200 ₽ — молодец!")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'group_veto', $2)`,
		userIDs[0], "@dima ветировал «Кепка Supreme» на 8500 ₽")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'group_veto', $2)`,
		userIDs[3], "@ivan ветировал «Наушники Xiaomi» на 2050 ₽")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'goal_completed', $2)`,
		userIDs[1], "Цель «AirPods Pro 2» выполнена! Так держать 🎉")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'goal_completed', $2)`,
		userIDs[3], "Цель «Курс по фотографии» выполнена!")

	log.Println("Seed complete: 5 users, 7 goals, 20 checks with AI comments, 18 vetos, 2 groups")
	return nil
}

// Ensure sql.ErrNoRows is imported for potential use elsewhere.
var _ = sql.ErrNoRows
