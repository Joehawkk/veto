package db

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

func Connect(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // SQLite supports single writer
	if err := db.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}
