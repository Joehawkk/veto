package db

import "database/sql"

func Migrate(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			username      TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			display_name  TEXT NOT NULL,
			email         TEXT UNIQUE,
			phone         TEXT,
			avatar_url    TEXT,
			total_saved   NUMERIC(12,2) NOT NULL DEFAULT 0,
			created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS goals (
			id             BIGSERIAL PRIMARY KEY,
			user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title          TEXT NOT NULL,
			target_amount  NUMERIC(12,2) NOT NULL,
			current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
			status         TEXT NOT NULL DEFAULT 'active',
			created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS vetos (
			id          BIGSERIAL PRIMARY KEY,
			user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			goal_id     BIGINT REFERENCES goals(id) ON DELETE SET NULL,
			amount      NUMERIC(12,2) NOT NULL,
			description TEXT NOT NULL,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS respects (
			id           BIGSERIAL PRIMARY KEY,
			veto_id      BIGINT NOT NULL REFERENCES vetos(id) ON DELETE CASCADE,
			from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			UNIQUE(veto_id, from_user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS groups (
			id          BIGSERIAL PRIMARY KEY,
			name        TEXT NOT NULL,
			invite_code TEXT UNIQUE NOT NULL,
			owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS group_members (
			id        BIGSERIAL PRIMARY KEY,
			group_id  BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
			user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(group_id, user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS notifications (
			id         BIGSERIAL PRIMARY KEY,
			user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			type       TEXT NOT NULL,
			message    TEXT NOT NULL,
			read       BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS checks (
			id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name           TEXT NOT NULL,
			price          NUMERIC(12,2) NOT NULL,
			has_discount   BOOLEAN NOT NULL DEFAULT false,
			answers        JSONB NOT NULL DEFAULT '{}',
			ai_verdict     TEXT NOT NULL DEFAULT 'wait',
			ai_comment     TEXT NOT NULL DEFAULT '',
			outcome        TEXT NOT NULL DEFAULT 'pending',
			timer_deadline TIMESTAMPTZ,
			created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`CREATE TABLE IF NOT EXISTS check_likes (
			id      BIGSERIAL PRIMARY KEY,
			check_id UUID NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
			user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			UNIQUE(check_id, user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS group_invites (
			id              BIGSERIAL PRIMARY KEY,
			group_id        BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
			invited_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			status          TEXT NOT NULL DEFAULT 'pending',
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(group_id, invited_user_id)
		)`,
		`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id BIGINT`,
		`ALTER TABLE checks ADD COLUMN IF NOT EXISTS ai_source TEXT NOT NULL DEFAULT 'unknown'`,
		`CREATE TABLE IF NOT EXISTS group_goals (
    id             BIGSERIAL PRIMARY KEY,
    group_id       BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    target_amount  NUMERIC(12,2) NOT NULL,
    current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
		`ALTER TABLE group_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'`,
		`UPDATE group_members gm SET role = 'owner' FROM groups g WHERE g.id = gm.group_id AND g.owner_id = gm.user_id AND gm.role = 'member'`,
		`ALTER TABLE checks ADD COLUMN IF NOT EXISTS ai_suggestion TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT false`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_data JSONB NOT NULL DEFAULT '{}'::jsonb`,
		// Flame reactions: extend check_likes to support multiple reaction types per user per check
		`ALTER TABLE check_likes ADD COLUMN IF NOT EXISTS reaction_type TEXT NOT NULL DEFAULT 'heart'`,
		`ALTER TABLE check_likes DROP CONSTRAINT IF EXISTS check_likes_check_id_user_id_key`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_likes_check_user_reaction_key') THEN ALTER TABLE check_likes ADD CONSTRAINT check_likes_check_user_reaction_key UNIQUE (check_id, user_id, reaction_type); END IF; END $$`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}
