package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"taskflow-backend/middleware"
)

type CreateCommentRequest struct {
	Content string `json:"content"`
}

func CreateComment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userIDValue := r.Context().Value(middleware.UserIDKey)

		userID, ok := userIDValue.(int)
		if !ok {
			http.Error(w, "User ID not found", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")

		if len(parts) != 4 ||
			parts[0] != "api" ||
			parts[1] != "tasks" ||
			parts[3] != "comments" {

			http.Error(w, "Invalid comment URL", http.StatusBadRequest)
			return
		}

		taskID, err := strconv.Atoi(parts[2])

		if err != nil {
			http.Error(w, "Invalid task ID", http.StatusBadRequest)
			return
		}

		var projectID int

		err = db.QueryRow(
			`SELECT project_id
			 FROM tasks
			 WHERE id = $1`,
			taskID,
		).Scan(&projectID)

		if err != nil {

			if err == sql.ErrNoRows {
				http.Error(w, "Task not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		var accessCount int

		err = db.QueryRow(
			`SELECT COUNT(*)
			 FROM projects p
			 LEFT JOIN project_members pm
				ON p.id = pm.project_id
			 WHERE p.id = $1
			 AND (p.owner_id = $2 OR pm.user_id = $2)`,
			projectID,
			userID,
		).Scan(&accessCount)

		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if accessCount == 0 {
			http.Error(w, "You do not have access to this project", http.StatusForbidden)
			return
		}

		var request CreateCommentRequest

		err = json.NewDecoder(r.Body).Decode(&request)

		if err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		request.Content = strings.TrimSpace(request.Content)

		if request.Content == "" {
			http.Error(w, "Comment content is required", http.StatusBadRequest)
			return
		}

		var commentID int

		err = db.QueryRow(
			`INSERT INTO comments
				(task_id, user_id, content)
			 VALUES
				($1, $2, $3)
			 RETURNING id`,
			taskID,
			userID,
			request.Content,
		).Scan(&commentID)

		if err != nil {
			http.Error(w, "Error creating comment", http.StatusInternalServerError)
			return
		}

		var userName string
		var userEmail string

		err = db.QueryRow(
			`SELECT name, email
			 FROM users
			 WHERE id = $1`,
			userID,
		).Scan(&userName, &userEmail)

		if err != nil {
			http.Error(w, "Error fetching user information", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Comment created successfully",
			"comment": map[string]interface{}{
				"id":         commentID,
				"task_id":    taskID,
				"user_id":    userID,
				"user_name":  userName,
				"user_email": userEmail,
				"content":    request.Content,
			},
		})
	}
}

func GetTaskComments(db *sql.DB) http.HandlerFunc {
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

		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")

		if len(parts) != 4 ||
			parts[0] != "api" ||
			parts[1] != "tasks" ||
			parts[3] != "comments" {

			http.Error(w, "Invalid comment URL", http.StatusBadRequest)
			return
		}

		taskID, err := strconv.Atoi(parts[2])

		if err != nil {
			http.Error(w, "Invalid task ID", http.StatusBadRequest)
			return
		}

		var projectID int

		err = db.QueryRow(
			`SELECT project_id
			 FROM tasks
			 WHERE id = $1`,
			taskID,
		).Scan(&projectID)

		if err != nil {

			if err == sql.ErrNoRows {
				http.Error(w, "Task not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		var accessCount int

		err = db.QueryRow(
			`SELECT COUNT(*)
			 FROM projects p
			 LEFT JOIN project_members pm
				ON p.id = pm.project_id
			 WHERE p.id = $1
			 AND (p.owner_id = $2 OR pm.user_id = $2)`,
			projectID,
			userID,
		).Scan(&accessCount)

		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if accessCount == 0 {
			http.Error(w, "You do not have access to this project", http.StatusForbidden)
			return
		}

		rows, err := db.Query(
			`SELECT
				c.id,
				c.task_id,
				c.user_id,
				u.name,
				u.email,
				c.content,
				c.created_at
			 FROM comments c
			 JOIN users u
				ON c.user_id = u.id
			 WHERE c.task_id = $1
			 ORDER BY c.created_at ASC`,
			taskID,
		)

		if err != nil {
			http.Error(w, "Error fetching comments", http.StatusInternalServerError)
			return
		}

		defer rows.Close()

		type CommentResponse struct {
			ID        int       `json:"id"`
			TaskID    int       `json:"task_id"`
			UserID    int       `json:"user_id"`
			UserName  string    `json:"user_name"`
			UserEmail string    `json:"user_email"`
			Content   string    `json:"content"`
			CreatedAt time.Time `json:"created_at"`
		}

		comments := []CommentResponse{}

		for rows.Next() {

			var comment CommentResponse

			err := rows.Scan(
				&comment.ID,
				&comment.TaskID,
				&comment.UserID,
				&comment.UserName,
				&comment.UserEmail,
				&comment.Content,
				&comment.CreatedAt,
			)

			if err != nil {
				http.Error(w, "Error reading comment data", http.StatusInternalServerError)
				return
			}

			comments = append(comments, comment)
		}

		if err := rows.Err(); err != nil {
			http.Error(w, "Error reading comments", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"task_id":  taskID,
			"comments": comments,
		})
	}
}

func DeleteComment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodDelete {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userIDValue := r.Context().Value(middleware.UserIDKey)

		userID, ok := userIDValue.(int)
		if !ok {
			http.Error(w, "User ID not found", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")

		if len(parts) != 5 ||
			parts[0] != "api" ||
			parts[1] != "tasks" ||
			parts[3] != "comments" {

			http.Error(w, "Invalid comment URL", http.StatusBadRequest)
			return
		}

		commentID, err := strconv.Atoi(parts[4])

		if err != nil {
			http.Error(w, "Invalid comment ID", http.StatusBadRequest)
			return
		}

		var commentUserID int

		err = db.QueryRow(
			`SELECT user_id
			 FROM comments
			 WHERE id = $1`,
			commentID,
		).Scan(&commentUserID)

		if err != nil {

			if err == sql.ErrNoRows {
				http.Error(w, "Comment not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if commentUserID != userID {
			http.Error(w, "Only the comment author can delete this comment", http.StatusForbidden)
			return
		}

		result, err := db.Exec(
			`DELETE FROM comments
			 WHERE id = $1`,
			commentID,
		)

		if err != nil {
			http.Error(w, "Error deleting comment", http.StatusInternalServerError)
			return
		}

		rowsAffected, err := result.RowsAffected()

		if err != nil {
			http.Error(w, "Error checking comment deletion", http.StatusInternalServerError)
			return
		}

		if rowsAffected == 0 {
			http.Error(w, "Comment not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"message":    "Comment deleted successfully",
			"comment_id": commentID,
		})
	}
}
