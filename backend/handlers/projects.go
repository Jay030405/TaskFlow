package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"taskflow-backend/middleware"
)

type CreateProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func CreateProject(db *sql.DB) http.HandlerFunc {
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

		var request CreateProjectRequest

		err := json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		request.Name = strings.TrimSpace(request.Name)
		request.Description = strings.TrimSpace(request.Description)

		if request.Name == "" {
			http.Error(w, "Project name is required", http.StatusBadRequest)
			return
		}

		var projectID int

		err = db.QueryRow(
			`INSERT INTO projects (name, description, owner_id)
			 VALUES ($1, $2, $3)
			 RETURNING id`,
			request.Name,
			request.Description,
			userID,
		).Scan(&projectID)

		if err != nil {
			http.Error(w, "Error creating project", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Project created successfully",
			"project": map[string]interface{}{
				"id":          projectID,
				"name":        request.Name,
				"description": request.Description,
				"owner_id":    userID,
			},
		})
	}
}

func GetProjects(db *sql.DB) http.HandlerFunc {
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

		rows, err := db.Query(
			`SELECT id, name, description, owner_id, created_at
			 FROM projects
			 WHERE owner_id = $1
			 ORDER BY created_at DESC`,
			userID,
		)

		if err != nil {
			http.Error(w, "Error fetching projects", http.StatusInternalServerError)
			return
		}

		defer rows.Close()

		type ProjectResponse struct {
			ID          int    `json:"id"`
			Name        string `json:"name"`
			Description string `json:"description"`
			OwnerID     int    `json:"owner_id"`
			CreatedAt   string `json:"created_at"`
		}

		projects := []ProjectResponse{}

		for rows.Next() {
			var project ProjectResponse

			err := rows.Scan(
				&project.ID,
				&project.Name,
				&project.Description,
				&project.OwnerID,
				&project.CreatedAt,
			)

			if err != nil {
				http.Error(w, "Error reading project data", http.StatusInternalServerError)
				return
			}

			projects = append(projects, project)
		}

		if err := rows.Err(); err != nil {
			http.Error(w, "Error reading projects", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"projects": projects,
		})
	}
}

func GetProject(db *sql.DB) http.HandlerFunc {
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

		if len(parts) != 3 || parts[0] != "api" || parts[1] != "projects" {
			http.Error(w, "Invalid project URL", http.StatusBadRequest)
			return
		}

		projectID, err := strconv.Atoi(parts[2])
		if err != nil {
			http.Error(w, "Invalid project ID", http.StatusBadRequest)
			return
		}

		var project struct {
			ID          int    `json:"id"`
			Name        string `json:"name"`
			Description string `json:"description"`
			OwnerID     int    `json:"owner_id"`
			CreatedAt   string `json:"created_at"`
		}

		err = db.QueryRow(
			`SELECT id, name, description, owner_id, created_at
			 FROM projects
			 WHERE id = $1 AND owner_id = $2`,
			projectID,
			userID,
		).Scan(
			&project.ID,
			&project.Name,
			&project.Description,
			&project.OwnerID,
			&project.CreatedAt,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Project not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Error fetching project", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(project)
	}
}

func UpdateProject(db *sql.DB) http.HandlerFunc {
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

		if len(parts) != 3 || parts[0] != "api" || parts[1] != "projects" {
			http.Error(w, "Invalid project URL", http.StatusBadRequest)
			return
		}

		projectID, err := strconv.Atoi(parts[2])
		if err != nil {
			http.Error(w, "Invalid project ID", http.StatusBadRequest)
			return
		}

		var request UpdateProjectRequest

		err = json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		request.Name = strings.TrimSpace(request.Name)
		request.Description = strings.TrimSpace(request.Description)

		if request.Name == "" {
			http.Error(w, "Project name is required", http.StatusBadRequest)
			return
		}

		result, err := db.Exec(
			`UPDATE projects
			 SET name = $1, description = $2
			 WHERE id = $3 AND owner_id = $4`,
			request.Name,
			request.Description,
			projectID,
			userID,
		)

		if err != nil {
			http.Error(w, "Error updating project", http.StatusInternalServerError)
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			http.Error(w, "Error checking project update", http.StatusInternalServerError)
			return
		}

		if rowsAffected == 0 {
			http.Error(w, "Project not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Project updated successfully",
			"project": map[string]interface{}{
				"id":          projectID,
				"name":        request.Name,
				"description": request.Description,
				"owner_id":    userID,
			},
		})
	}
}

func DeleteProject(db *sql.DB) http.HandlerFunc {
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

		if len(parts) != 3 || parts[0] != "api" || parts[1] != "projects" {
			http.Error(w, "Invalid project URL", http.StatusBadRequest)
			return
		}

		projectID, err := strconv.Atoi(parts[2])
		if err != nil {
			http.Error(w, "Invalid project ID", http.StatusBadRequest)
			return
		}

		result, err := db.Exec(
			`DELETE FROM projects
			 WHERE id = $1 AND owner_id = $2`,
			projectID,
			userID,
		)

		if err != nil {
			http.Error(w, "Error deleting project", http.StatusInternalServerError)
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			http.Error(w, "Error checking project deletion", http.StatusInternalServerError)
			return
		}

		if rowsAffected == 0 {
			http.Error(w, "Project not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"message":    "Project deleted successfully",
			"project_id": projectID,
		})
	}
}
