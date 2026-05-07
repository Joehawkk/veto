package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	DatabaseURL      string
	JWTSecret        string
	Port             string
	AnthropicAPIKey  string
	AnthropicModel   string
	OpenRouterAPIKey string
	OpenRouterModel  string
}

func Load() *Config {
	// Try multiple .env locations: next to exe, CWD, and parent backend dir
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		loadDotEnv(filepath.Join(exeDir, ".env"))
		loadDotEnv(filepath.Join(exeDir, "..", "backend", ".env"))
	}
	loadDotEnv(".env")

	return &Config{
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://veto:veto@localhost:5432/veto?sslmode=disable"),
		JWTSecret:        getEnv("JWT_SECRET", "dev-secret-key-change-in-production"),
		Port:             getEnv("PORT", "8080"),
		AnthropicAPIKey:  getEnv("ANTHROPIC_API_KEY", ""),
		AnthropicModel:   getEnv("ANTHROPIC_MODEL", "haiku-4-5-20251001"),
		OpenRouterAPIKey: getEnv("OPENROUTER_API_KEY", ""),
		OpenRouterModel:  getEnv("OPENROUTER_MODEL", "openai/gpt-oss-20b:free"),
	}
}

func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
