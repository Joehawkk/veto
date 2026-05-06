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
		return nil // Already seeded
	}

	log.Println("Seeding database with test data...")

	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	pw := string(hash)

	type seedUser struct {
		email, username string
		totalSaved      float64
	}

	users := []seedUser{
		{"alex@veto.app", "alex", 14500},
		{"marina@veto.app", "marina", 31200},
		{"dmitry@veto.app", "dmitry", 8700},
		{"kate@veto.app", "kate", 52400},
	}

	userIDs := make([]int, len(users))
	for i, u := range users {
		err := db.QueryRow(
			`INSERT INTO users (email, password_hash, username, total_saved) VALUES (?, ?, ?, ?) RETURNING id`,
			u.email, pw, u.username, u.totalSaved,
		).Scan(&userIDs[i])
		if err != nil {
			return err
		}
	}

	// Goals
	type seedGoal struct {
		userIdx       int
		title         string
		target, saved float64
		status        string
	}
	goals := []seedGoal{
		{0, "Путешествие в Токио", 150000, 14500, "active"},
		{1, "MacBook Pro M3", 200000, 31200, "active"},
		{1, "AirPods Pro", 20000, 20000, "completed"},
		{2, "Новый iPhone 16", 90000, 8700, "active"},
		{3, "Ремонт квартиры", 500000, 52400, "active"},
		{3, "PlayStation 5", 55000, 55000, "completed"},
	}

	goalIDs := make([]int, len(goals))
	for i, g := range goals {
		db.QueryRow(
			`INSERT INTO goals (user_id, title, target_amount, current_amount, status) VALUES (?, ?, ?, ?, ?) RETURNING id`,
			userIDs[g.userIdx], g.title, g.target, g.saved, g.status,
		).Scan(&goalIDs[i])
	}

	// Vetos
	type seedVeto struct {
		userIdx, goalIdx int
		amount           float64
		description      string
		daysAgo          string
	}
	vetos := []seedVeto{
		{0, 0, 350, "Кофе в Старбакс", "2 hours"},
		{0, 0, 1200, "Такси домой", "5 hours"},
		{0, 0, 4800, "Куртка в Zara", "1 day"},
		{0, 0, 8150, "Ужин в ресторане", "3 days"},
		{1, 1, 990, "Подписка на стриминг", "1 hour"},
		{1, 1, 3500, "Новые кроссовки", "6 hours"},
		{1, 1, 7200, "Концерт", "2 days"},
		{1, 1, 19510, "Планшет", "4 days"},
		{2, 3, 500, "Кофе и круассан", "3 hours"},
		{2, 3, 2800, "Игра в Steam", "1 day"},
		{2, 3, 5400, "Наушники JBL", "2 days"},
		{3, 4, 1500, "Доставка еды", "30 minutes"},
		{3, 4, 8900, "Новый телефон (б/у)", "4 hours"},
		{3, 4, 15000, "Тур выходного дня", "1 day"},
		{3, 4, 27000, "Диван", "3 days"},
	}

	vetoIDs := make([]int, len(vetos))
	for i, v := range vetos {
		db.QueryRow(
			`INSERT INTO vetos (user_id, goal_id, amount, description, created_at)
			 VALUES (?, ?, ?, ?, datetime('now', ?)) RETURNING id`,
			userIDs[v.userIdx], goalIDs[v.goalIdx], v.amount, v.description, "-"+v.daysAgo,
		).Scan(&vetoIDs[i])
	}

	// Respects (cross-users)
	respects := [][2]int{
		{1, 0}, {2, 0}, {3, 0}, // veto[0] liked by marina, dmitry, kate
		{0, 4}, {2, 4}, {3, 4}, // veto[4] liked by alex, dmitry, kate
		{0, 8}, {1, 8}, {3, 8}, // veto[8] liked by alex, marina, kate
		{0, 11}, {1, 11}, {2, 11}, // veto[11] liked by all
		{0, 3}, {1, 3},
		{2, 6}, {3, 6},
	}
	for _, r := range respects {
		db.Exec(
			`INSERT OR IGNORE INTO respects (veto_id, from_user_id) VALUES (?, ?)`,
			vetoIDs[r[1]], userIDs[r[0]],
		)
	}

	// Groups
	var g1, g2 int
	db.QueryRow(
		`INSERT INTO groups (name, invite_code, owner_id) VALUES ('Финансисты', 'FIN001', ?) RETURNING id`,
		userIDs[0],
	).Scan(&g1)
	db.QueryRow(
		`INSERT INTO groups (name, invite_code, owner_id) VALUES ('Челлендж 30 дней', 'CHAL30', ?) RETURNING id`,
		userIDs[2],
	).Scan(&g2)

	// Group members
	// Финансисты: alex, marina, kate
	for _, uid := range []int{userIDs[0], userIDs[1], userIDs[3]} {
		db.Exec(`INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`, g1, uid)
	}
	// Челлендж 30 дней: dmitry, kate
	for _, uid := range []int{userIDs[2], userIDs[3]} {
		db.Exec(`INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`, g2, uid)
	}

	// Notifications
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES (?, 'group_veto', ?)`,
		userIDs[0], "@marina ветировала «Планшет» на 19510 ₽")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES (?, 'group_veto', ?)`,
		userIDs[0], "@kate ветировала «Диван» на 27000 ₽")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES (?, 'goal_completed', ?)`,
		userIDs[1], "🎉 Цель «AirPods Pro» выполнена!")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES (?, 'goal_completed', ?)`,
		userIDs[3], "🎉 Цель «PlayStation 5» выполнена!")

	log.Println("Seed complete: 4 users, 2 groups, 15 vetos")
	return nil
}
