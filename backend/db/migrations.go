package db

import "database/sql"

func Migrate(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id            INTEGER PRIMARY KEY AUTOINCREMENT,
			email         TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			username      TEXT UNIQUE NOT NULL,
			total_saved   REAL NOT NULL DEFAULT 0,
			created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS goals (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title          TEXT NOT NULL,
			target_amount  REAL NOT NULL,
			current_amount REAL NOT NULL DEFAULT 0,
			status         TEXT NOT NULL DEFAULT 'active',
			created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS vetos (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			goal_id     INTEGER REFERENCES goals(id) ON DELETE SET NULL,
			amount      REAL NOT NULL,
			description TEXT NOT NULL,
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS respects (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			veto_id      INTEGER NOT NULL REFERENCES vetos(id) ON DELETE CASCADE,
			from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			UNIQUE(veto_id, from_user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS groups (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			name        TEXT NOT NULL,
			invite_code TEXT UNIQUE NOT NULL,
			owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS group_members (
			id        INTEGER PRIMARY KEY AUTOINCREMENT,
			group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
			user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(group_id, user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS notifications (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			type       TEXT NOT NULL,
			message    TEXT NOT NULL,
			read       INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}
