package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"

	"veto/config"
	"veto/db"
	"veto/handlers"
	"veto/middleware"
)

func main() {
	cfg := config.Load()

	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		log.Fatal("Failed to run migrations:", err)
	}

	if err := db.Seed(database); err != nil {
		log.Printf("Seed warning: %v", err)
	}

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		},
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
	}))
	app.Use(logger.New())

	h := handlers.New(database, cfg)

	// Serve uploaded avatars
	app.Static("/uploads", "./uploads")

	api := app.Group("/api")

	// Auth (public)
	auth := api.Group("/auth")
	auth.Post("/register", h.Register)
	auth.Post("/login", h.Login)
	// Protected
	p := api.Group("", middleware.AuthRequired(cfg.JWTSecret))

	// AI check (protected — needs user_id for suggestion dedup)
	p.Post("/ai/check", h.CheckAI)

	// Current user
	p.Get("/me", h.GetMe)

	// Profile
	p.Get("/profile", h.GetProfile)
	p.Patch("/profile", h.UpdateProfile)
	p.Delete("/profile", h.DeleteProfile)
	p.Post("/profile/avatar", h.UploadAvatar)

	// Goals
	p.Get("/goals", h.GetGoals)
	p.Post("/goals", h.CreateGoal)
	p.Put("/goals/:id", h.UpdateGoal)

	// Vetos (history)
	p.Get("/vetos", h.GetVetos)
	p.Post("/vetos", h.CreateVeto)
	p.Patch("/vetos/:id/goal", h.MoveVetoGoal)

	// Feed & Respects
	p.Get("/feed", h.GetFeed)
	p.Post("/respects", h.CreateRespect)

	// Groups
	p.Get("/groups", h.GetGroups)
	p.Post("/groups", h.CreateGroup)
	p.Post("/groups/join", h.JoinGroup)
	p.Get("/groups/:id", h.GetGroupDetail)
	p.Get("/groups/:id/feed", h.GetGroupFeed)
	p.Delete("/groups/:id/leave", h.LeaveGroup)
	p.Post("/groups/:id/invite", h.InviteToGroup)

	// Group goals
	p.Get("/groups/:id/goals", h.GetGroupGoals)
	p.Post("/groups/:id/goals", h.CreateGroupGoal)
	p.Post("/groups/:id/goals/:goalId/contribute", h.ContributeGroupGoal)

	// Group admin
	p.Patch("/groups/:id/members/:userId/role", h.SetMemberRole)
	p.Delete("/groups/:id/members/:userId", h.KickMember)
	p.Patch("/groups/:id/transfer", h.TransferOwnership)

	// Check likes
	p.Post("/checks/:id/like", h.LikeCheck)
	p.Delete("/checks/:id/like", h.UnlikeCheck)

	// Notifications
	p.Get("/notifications", h.GetNotifications)
	p.Post("/notifications/read", h.MarkNotificationsRead)
	p.Post("/invites/:id/accept", h.AcceptGroupInvite)
	p.Post("/invites/:id/decline", h.DeclineGroupInvite)

	// Checks (purchase history)
	p.Post("/checks", h.CreateCheck)
	p.Get("/checks", h.ListChecks)
	p.Patch("/checks/:id", h.UpdateCheck)

	// Users list
	p.Get("/users", h.ListUsers)

	log.Printf("VETO backend on :%s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
