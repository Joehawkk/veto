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
		totalSaved                       float64
	}

	users := []seedUser{
		{"alex", "Алекс", "/uploads/626457731d0ab3dc14118c6c4f348661.jpg", 18500},
		{"mika", "Мика", "/uploads/8478ebe165b0bfe2ff91654442540e35.jpg", 32000},
		{"dima", "Дима", "/uploads/851acfc242e03dbe748c4347272490b2.jpg", 15000},
		{"kata", "Катя", "/uploads/d6f4e1fdcdceb83ac1a8a944975143a3.jpg", 45000},
		{"ivan", "Иван", "/uploads/f0bf470f239b6b17d76859ec149a3301.jpg", 4800},
	}

	userIDs := make([]string, len(users))
	for i, u := range users {
		err := db.QueryRow(
			`INSERT INTO users (username, password_hash, display_name, avatar_url, total_saved) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			u.username, pw, u.displayName, u.avatarURL, u.totalSaved,
		).Scan(&userIDs[i])
		if err != nil {
			return err
		}
	}

	// Active goals for each user
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

	// Vetos (saved purchases)
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

	// Respects
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

	// Groups
	var g1, g2 int64
	db.QueryRow(
		`INSERT INTO groups (name, invite_code, owner_id) VALUES ('Финансисты', 'FIN2025', $1) RETURNING id`,
		userIDs[0], // alex — owner
	).Scan(&g1)
	db.QueryRow(
		`INSERT INTO groups (name, invite_code, owner_id) VALUES ('Экономим вместе', 'ECO2025', $1) RETURNING id`,
		userIDs[3], // kata — owner
	).Scan(&g2)

	// Group members
	for _, uid := range []string{userIDs[0], userIDs[1], userIDs[2]} {
		db.Exec(`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, g1, uid)
	}
	for _, uid := range []string{userIDs[3], userIDs[4], userIDs[0]} {
		db.Exec(`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, g2, uid)
	}

	// Set roles
	db.Exec(`UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2`, g1, userIDs[0])
	db.Exec(`UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2`, g2, userIDs[3])
	db.Exec(`UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2`, g1, userIDs[1])

	// Notifications
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'group_veto', $2)`,
		userIDs[0], "@mika ветировала «Планшет Xiaomi» на 20310 ₽")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'group_veto', $2)`,
		userIDs[3], "@ivan ветировал «Наушники Xiaomi» на 2050 ₽")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'goal_completed', $2)`,
		userIDs[1], "Цель «AirPods Pro 2» выполнена!")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'goal_completed', $2)`,
		userIDs[3], "Цель «Курс по фотографии» выполнена!")

	log.Println("Seed complete: 5 users, 2 groups, 18 vetos")
	return nil
}

// Ensure sql.ErrNoRows is imported for potential use elsewhere.
var _ = sql.ErrNoRows
