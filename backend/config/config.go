package config

import "os"

type Config struct {
	DBPath           string
	JWTSecret        string
	Port             string
	OpenRouterAPIKey string
	OpenRouterModel  string
}

func Load() *Config {
	return &Config{
		DBPath:           getEnv("DB_PATH", "./veto.db"),
		JWTSecret:        getEnv("JWT_SECRET", "dev-secret-key-change-in-production"),
		Port:             getEnv("PORT", "8080"),
		OpenRouterAPIKey: getEnv("OPENROUTER_API_KEY", ""),
		OpenRouterModel:  getEnv("OPENROUTER_MODEL", "openai/gpt-oss-20b:free"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
