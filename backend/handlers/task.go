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

func CreateTask(db *sql.DB) http.HandlerFunc {
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

		projectIDString := strings.TrimPrefix(r.URL.Path, "/api/projects/")

		parts := strings.Split(strings.Trim(projectIDString, "/"), "/")

		if len(parts) != 2 || parts[1] != "tasks" {
			http.Error(w, "Invalid task URL", http.StatusBadRequest)
			return
		}

		projectID, err := strconv.Atoi(parts[0])
		if err != nil {
			http.Error(w, "Invalid project ID", http.StatusBadRequest)
			return
		}

		var input struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Status      string `json:"status"`
			Priority    string `json:"priority"`
			DueDate     string `json:"due_date"`
			AssignedTo  int    `json:"assigned_to"`
		}

		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if input.Title == "" {
			http.Error(w, "Task title is required", http.StatusBadRequest)
			return
		}

		var ownerID int

		err = db.QueryRow(
			`SELECT owner_id
			 FROM projects
			 WHERE id = $1`,
			projectID,
		).Scan(&ownerID)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Project not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Error checking project", http.StatusInternalServerError)
			return
		}

		if ownerID != userID {
			http.Error(w, "Only project owner can create tasks", http.StatusForbidden)
			return
		}

		if input.Status == "" {
			input.Status = "todo"
		}

		if input.Priority == "" {
			input.Priority = "medium"
		}

		var dueDate interface{}

		if input.DueDate != "" {
			parsedDate, err := time.Parse("2006-01-02", input.DueDate)

			if err != nil {
				http.Error(w, "Invalid due date", http.StatusBadRequest)
				return
			}

			dueDate = parsedDate
		} else {
			dueDate = nil
		}

		var assignedTo interface{}

		if input.AssignedTo > 0 {

			var memberExists bool

			err := db.QueryRow(
				`SELECT EXISTS (
					SELECT 1
					FROM project_members
					WHERE project_id = $1
					AND user_id = $2

					UNION

					SELECT 1
					FROM projects
					WHERE id = $1
					AND owner_id = $2
				)`,
				projectID,
				input.AssignedTo,
			).Scan(&memberExists)

			if err != nil {
				http.Error(w, "Error checking task assignee", http.StatusInternalServerError)
				return
			}

			if !memberExists {
				http.Error(w, "Assigned user is not a project member", http.StatusBadRequest)
				return
			}

			assignedTo = input.AssignedTo

		} else {
			assignedTo = nil
		}

		var taskID int

		err = db.QueryRow(
			`INSERT INTO tasks (
				project_id,
				assigned_to,
				title,
				description,
				status,
				priority,
				due_date
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id`,
			projectID,
			assignedTo,
			input.Title,
			input.Description,
			input.Status,
			input.Priority,
			dueDate,
		).Scan(&taskID)

		if err != nil {
			http.Error(w, "Error creating task", http.StatusInternalServerError)
			return
		}

		var task struct {
			ID           int        `json:"id"`
			ProjectID    int        `json:"project_id"`
			AssignedTo   *int       `json:"assigned_to"`
			AssignedName string     `json:"assigned_name"`
			Title        string     `json:"title"`
			Description  string     `json:"description"`
			Status       string     `json:"status"`
			Priority     string     `json:"priority"`
			DueDate      *time.Time `json:"due_date"`
		}

		err = db.QueryRow(
			`SELECT
				t.id,
				t.project_id,
				t.assigned_to,
				COALESCE(u.name, '') AS assigned_name,
				t.title,
				t.description,
				t.status,
				t.priority,
				t.due_date
			 FROM tasks t
			 LEFT JOIN users u
				ON t.assigned_to = u.id
			 WHERE t.id = $1`,
			taskID,
		).Scan(
			&task.ID,
			&task.ProjectID,
			&task.AssignedTo,
			&task.AssignedName,
			&task.Title,
			&task.Description,
			&task.Status,
			&task.Priority,
			&task.DueDate,
		)

		if err != nil {
			http.Error(w, "Task created but could not be fetched", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Task created successfully",
			"task":    task,
		})
	}
}

func GetProjectTasks(db *sql.DB) http.HandlerFunc {
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
			parts[1] != "projects" ||
			parts[3] != "tasks" {

			http.Error(w, "Invalid task URL", http.StatusBadRequest)
			return
		}

		projectID, err := strconv.Atoi(parts[2])

		if err != nil {
			http.Error(w, "Invalid project ID", http.StatusBadRequest)
			return
		}

		var ownerID int

		err = db.QueryRow(
			`SELECT owner_id
			 FROM projects
			 WHERE id = $1`,
			projectID,
		).Scan(&ownerID)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Project not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Error checking project", http.StatusInternalServerError)
			return
		}

		var access bool

		if ownerID == userID {
			access = true
		} else {
			err = db.QueryRow(
				`SELECT EXISTS (
					SELECT 1
					FROM project_members
					WHERE project_id = $1
					AND user_id = $2
				)`,
				projectID,
				userID,
			).Scan(&access)

			if err != nil {
				http.Error(w, "Error checking project access", http.StatusInternalServerError)
				return
			}
		}

		if !access {
			http.Error(w, "You do not have access to this project", http.StatusForbidden)
			return
		}

		rows, err := db.Query(
			`SELECT
				t.id,
				t.project_id,
				t.assigned_to,
				t.title,
				t.description,
				t.status,
				t.priority,
				t.due_date,
				t.created_at,
				t.updated_at,
				COALESCE(u.name, '') AS assigned_name
			 FROM tasks t
			 LEFT JOIN users u
				ON t.assigned_to = u.id
			 WHERE t.project_id = $1
			 ORDER BY t.id ASC`,
			projectID,
		)

		if err != nil {
			http.Error(w, "Error fetching tasks", http.StatusInternalServerError)
			return
		}

		defer rows.Close()

		type TaskResponse struct {
			ID           int        `json:"id"`
			ProjectID    int        `json:"project_id"`
			AssignedTo   *int       `json:"assigned_to"`
			AssignedName string     `json:"assigned_name"`
			Title        string     `json:"title"`
			Description  string     `json:"description"`
			Status       string     `json:"status"`
			Priority     string     `json:"priority"`
			DueDate      *time.Time `json:"due_date"`
			CreatedAt    time.Time  `json:"created_at"`
			UpdatedAt    time.Time  `json:"updated_at"`
		}

		tasks := []TaskResponse{}

		for rows.Next() {

			var task TaskResponse

			err := rows.Scan(
				&task.ID,
				&task.ProjectID,
				&task.AssignedTo,
				&task.Title,
				&task.Description,
				&task.Status,
				&task.Priority,
				&task.DueDate,
				&task.CreatedAt,
				&task.UpdatedAt,
				&task.AssignedName,
			)

			if err != nil {
				http.Error(w, "Error reading task data", http.StatusInternalServerError)
				return
			}

			tasks = append(tasks, task)
		}

		if err := rows.Err(); err != nil {
			http.Error(w, "Error reading tasks", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"project_id": projectID,
			"tasks":      tasks,
		})
	}
}

func GetTask(db *sql.DB) http.HandlerFunc {
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

		if len(parts) != 3 ||
			parts[0] != "api" ||
			parts[1] != "tasks" {

			http.Error(w, "Invalid task URL", http.StatusBadRequest)
			return
		}

		taskID, err := strconv.Atoi(parts[2])

		if err != nil {
			http.Error(w, "Invalid task ID", http.StatusBadRequest)
			return
		}

		var task struct {
			ID           int        `json:"id"`
			ProjectID    int        `json:"project_id"`
			AssignedTo   *int       `json:"assigned_to"`
			AssignedName string     `json:"assigned_name"`
			Title        string     `json:"title"`
			Description  string     `json:"description"`
			Status       string     `json:"status"`
			Priority     string     `json:"priority"`
			DueDate      *time.Time `json:"due_date"`
			CreatedAt    time.Time  `json:"created_at"`
			UpdatedAt    time.Time  `json:"updated_at"`
		}

		err = db.QueryRow(
			`SELECT
				t.id,
				t.project_id,
				t.assigned_to,
				COALESCE(u.name, '') AS assigned_name,
				t.title,
				t.description,
				t.status,
				t.priority,
				t.due_date,
				t.created_at,
				t.updated_at
			 FROM tasks t
			 LEFT JOIN users u
				ON t.assigned_to = u.id
			 JOIN projects p
				ON t.project_id = p.id
			 WHERE t.id = $1
			 AND (
				p.owner_id = $2
				OR EXISTS (
					SELECT 1
					FROM project_members pm
					WHERE pm.project_id = t.project_id
					AND pm.user_id = $2
				)
			 )
			 LIMIT 1`,
			taskID,
			userID,
		).Scan(
			&task.ID,
			&task.ProjectID,
			&task.AssignedTo,
			&task.AssignedName,
			&task.Title,
			&task.Description,
			&task.Status,
			&task.Priority,
			&task.DueDate,
			&task.CreatedAt,
			&task.UpdatedAt,
		)

		if err != nil {

			if err == sql.ErrNoRows {
				http.Error(w, "Task not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Error fetching task", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(task)
	}
}

func UpdateTask(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodPut {
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

		if len(parts) != 3 ||
			parts[0] != "api" ||
			parts[1] != "tasks" {

			http.Error(w, "Invalid task URL", http.StatusBadRequest)
			return
		}

		taskID, err := strconv.Atoi(parts[2])

		if err != nil {
			http.Error(w, "Invalid task ID", http.StatusBadRequest)
			return
		}

		var input struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Status      string `json:"status"`
			Priority    string `json:"priority"`
			DueDate     string `json:"due_date"`
			AssignedTo  int    `json:"assigned_to"`
		}

		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		var projectOwnerID int
		var projectID int

		err = db.QueryRow(
			`SELECT project_id, p.owner_id
			 FROM tasks t
			 JOIN projects p ON t.project_id = p.id
			 WHERE t.id = $1`,
			taskID,
		).Scan(&projectID, &projectOwnerID)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Task not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Error finding task", http.StatusInternalServerError)
			return
		}

		if projectOwnerID != userID {
			http.Error(w, "Only project owner can update tasks", http.StatusForbidden)
			return
		}

		if input.Title == "" {
			http.Error(w, "Task title is required", http.StatusBadRequest)
			return
		}

		if input.Status == "" {
			input.Status = "todo"
		}

		if input.Priority == "" {
			input.Priority = "medium"
		}

		var dueDate interface{}

		if input.DueDate != "" {
			parsedDate, err := time.Parse("2006-01-02", input.DueDate)

			if err != nil {
				http.Error(w, "Invalid due date", http.StatusBadRequest)
				return
			}

			dueDate = parsedDate
		} else {
			dueDate = nil
		}

		var assignedTo interface{}

		if input.AssignedTo > 0 {

			var memberExists bool

			err := db.QueryRow(
				`SELECT EXISTS (
					SELECT 1
					FROM project_members
					WHERE project_id = $1
					AND user_id = $2

					UNION

					SELECT 1
					FROM projects
					WHERE id = $1
					AND owner_id = $2
				)`,
				projectID,
				input.AssignedTo,
			).Scan(&memberExists)

			if err != nil {
				http.Error(w, "Error checking task assignee", http.StatusInternalServerError)
				return
			}

			if !memberExists {
				http.Error(w, "Assigned user is not a project member", http.StatusBadRequest)
				return
			}

			assignedTo = input.AssignedTo

		} else {
			assignedTo = nil
		}

		_, err = db.Exec(
			`UPDATE tasks
			 SET
				title = $1,
				description = $2,
				status = $3,
				priority = $4,
				due_date = $5,
				assigned_to = $6,
				updated_at = CURRENT_TIMESTAMP
			 WHERE id = $7`,
			input.Title,
			input.Description,
			input.Status,
			input.Priority,
			dueDate,
			assignedTo,
			taskID,
		)

		if err != nil {
			http.Error(w, "Error updating task", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Task updated successfully",
		})
	}
}

func DeleteTask(db *sql.DB) http.HandlerFunc {
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

		if len(parts) != 3 ||
			parts[0] != "api" ||
			parts[1] != "tasks" {

			http.Error(w, "Invalid task URL", http.StatusBadRequest)
			return
		}

		taskID, err := strconv.Atoi(parts[2])

		if err != nil {
			http.Error(w, "Invalid task ID", http.StatusBadRequest)
			return
		}

		var ownerID int

		err = db.QueryRow(
			`SELECT p.owner_id
			 FROM tasks t
			 JOIN projects p ON t.project_id = p.id
			 WHERE t.id = $1`,
			taskID,
		).Scan(&ownerID)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Task not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Error finding task", http.StatusInternalServerError)
			return
		}

		if ownerID != userID {
			http.Error(w, "Only project owner can delete tasks", http.StatusForbidden)
			return
		}

		_, err = db.Exec(
			`DELETE FROM tasks
			 WHERE id = $1`,
			taskID,
		)

		if err != nil {
			http.Error(w, "Error deleting task", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Task deleted successfully",
			"task_id": taskID,
		})
	}
}
