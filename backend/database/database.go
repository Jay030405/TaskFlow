package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func ConnectDB() *sql.DB {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")

	sslmode := os.Getenv("DB_SSLMODE")
	if sslmode == "" {
		sslmode = "disable"
	}

	connectionString := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host,
		port,
		user,
		password,
		dbname,
		sslmode,
	)

	db, err := sql.Open("postgres", connectionString)
	if err != nil {
		log.Fatal("Error opening database:", err)
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		log.Fatal("Error connecting to PostgreSQL:", err)
	}

	fmt.Println("Successfully connected to PostgreSQL!")

	return db
}
