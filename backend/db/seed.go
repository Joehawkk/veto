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

	log.Println("Seeding database with test data...")

	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	pw := string(hash)

	type seedUser struct {
		username, displayName string
		totalSaved            float64
	}

	users := []seedUser{
		{"alex", "Алекс", 14500},
		{"marina", "Марина", 31200},
		{"dmitry", "Дмитрий", 8700},
		{"kate", "Катя", 52400},
	}

	userIDs := make([]string, len(users))
	for i, u := range users {
		err := db.QueryRow(
			`INSERT INTO users (username, password_hash, display_name, total_saved) VALUES ($1, $2, $3, $4) RETURNING id`,
			u.username, pw, u.displayName, u.totalSaved,
		).Scan(&userIDs[i])
		if err != nil {
			return err
		}
	}

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

	goalIDs := make([]int64, len(goals))
	for i, g := range goals {
		db.QueryRow(
			`INSERT INTO goals (user_id, title, target_amount, current_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			userIDs[g.userIdx], g.title, g.target, g.saved, g.status,
		).Scan(&goalIDs[i])
	}

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

	vetoIDs := make([]int64, len(vetos))
	for i, v := range vetos {
		db.QueryRow(
			`INSERT INTO vetos (user_id, goal_id, amount, description, created_at)
			 VALUES ($1, $2, $3, $4, NOW() - $5::INTERVAL) RETURNING id`,
			userIDs[v.userIdx], goalIDs[v.goalIdx], v.amount, v.description, v.ago,
		).Scan(&vetoIDs[i])
	}

	respects := [][2]int{
		{1, 0}, {2, 0}, {3, 0},
		{0, 4}, {2, 4}, {3, 4},
		{0, 8}, {1, 8}, {3, 8},
		{0, 11}, {1, 11}, {2, 11},
		{0, 3}, {1, 3},
		{2, 6}, {3, 6},
	}
	for _, r := range respects {
		db.Exec(
			`INSERT INTO respects (veto_id, from_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			vetoIDs[r[1]], userIDs[r[0]],
		)
	}

	var g1, g2 int64
	db.QueryRow(
		`INSERT INTO groups (name, invite_code, owner_id) VALUES ('Финансисты', 'FIN001', $1) RETURNING id`,
		userIDs[0],
	).Scan(&g1)
	db.QueryRow(
		`INSERT INTO groups (name, invite_code, owner_id) VALUES ('Челлендж 30 дней', 'CHAL30', $1) RETURNING id`,
		userIDs[2],
	).Scan(&g2)

	for _, uid := range []string{userIDs[0], userIDs[1], userIDs[3]} {
		db.Exec(`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, g1, uid)
	}
	for _, uid := range []string{userIDs[2], userIDs[3]} {
		db.Exec(`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, g2, uid)
	}

	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'group_veto', $2)`,
		userIDs[0], "@marina ветировала «Планшет» на 19510 ₽")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'group_veto', $2)`,
		userIDs[0], "@kate ветировала «Диван» на 27000 ₽")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'goal_completed', $2)`,
		userIDs[1], "🎉 Цель «AirPods Pro» выполнена!")
	db.Exec(`INSERT INTO notifications (user_id, type, message) VALUES ($1, 'goal_completed', $2)`,
		userIDs[3], "🎉 Цель «PlayStation 5» выполнена!")

	log.Println("Seed complete: 4 users, 2 groups, 15 vetos")
	return nil
}

// Ensure sql.ErrNoRows is imported for potential use elsewhere.
var _ = sql.ErrNoRows
