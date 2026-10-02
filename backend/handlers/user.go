package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"taskflow-backend/middleware"
)

func GetMe(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userIDValue := r.Context().Value(middleware.UserIDKey)

		userID, ok := userIDValue.(int)
		if !ok {
			http.Error(w, "User ID not found", http.StatusUnauthorized)
			return
		}

		var id int
		var name string
		var email string

		err := db.QueryRow(
			`SELECT id, name, email
			 FROM users
			 WHERE id = $1`,
			userID,
		).Scan(&id, &name, &email)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "User not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":    id,
			"name":  name,
			"email": email,
		})
	}
}
