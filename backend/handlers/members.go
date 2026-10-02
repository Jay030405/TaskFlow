package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"taskflow-backend/middleware"
)

type AddMemberRequest struct {
	UserID int    `json:"user_id"`
	Role   string `json:"role"`
}

func AddProjectMember(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userIDValue := r.Context().Value(middleware.UserIDKey)

		ownerID, ok := userIDValue.(int)
		if !ok {
			http.Error(w, "User ID not found", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")

		if len(parts) != 4 ||
			parts[0] != "api" ||
			parts[1] != "projects" ||
			parts[3] != "members" {

			http.Error(w, "Invalid member URL", http.StatusBadRequest)
			return
		}

		projectID, err := strconv.Atoi(parts[2])
		if err != nil {
			http.Error(w, "Invalid project ID", http.StatusBadRequest)
			return
		}

		var request AddMemberRequest

		err = json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if request.UserID <= 0 {
			http.Error(w, "Valid user ID is required", http.StatusBadRequest)
			return
		}

		request.Role = strings.TrimSpace(request.Role)

		if request.Role == "" {
			request.Role = "member"
		}

		var projectOwnerID int

		err = db.QueryRow(
			`SELECT owner_id
			 FROM projects
			 WHERE id = $1`,
			projectID,
		).Scan(&projectOwnerID)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Project not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if projectOwnerID != ownerID {
			http.Error(w, "Only the project owner can add members", http.StatusForbidden)
			return
		}

		var userName string
		var userEmail string

		err = db.QueryRow(
			`SELECT name, email
			 FROM users
			 WHERE id = $1`,
			request.UserID,
		).Scan(&userName, &userEmail)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "User not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		var memberID int

		err = db.QueryRow(
			`INSERT INTO project_members (project_id, user_id, role)
			 VALUES ($1, $2, $3)
			 RETURNING id`,
			projectID,
			request.UserID,
			request.Role,
		).Scan(&memberID)

		if err != nil {
			http.Error(w, "User is already a member of this project", http.StatusConflict)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Project member added successfully",
			"member": map[string]interface{}{
				"id":         memberID,
				"project_id": projectID,
				"user_id":    request.UserID,
				"name":       userName,
				"email":      userEmail,
				"role":       request.Role,
			},
		})
	}
}

func GetProjectMembers(db *sql.DB) http.HandlerFunc {
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
			parts[3] != "members" {

			http.Error(w, "Invalid member URL", http.StatusBadRequest)
			return
		}

		projectID, err := strconv.Atoi(parts[2])
		if err != nil {
			http.Error(w, "Invalid project ID", http.StatusBadRequest)
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
			`SELECT u.id, u.name, u.email, pm.role
			 FROM project_members pm
			 JOIN users u
				ON pm.user_id = u.id
			 WHERE pm.project_id = $1
			 ORDER BY pm.joined_at ASC`,
			projectID,
		)

		if err != nil {
			http.Error(w, "Error fetching project members", http.StatusInternalServerError)
			return
		}

		defer rows.Close()

		type MemberResponse struct {
			ID    int    `json:"id"`
			Name  string `json:"name"`
			Email string `json:"email"`
			Role  string `json:"role"`
		}

		members := []MemberResponse{}

		for rows.Next() {

			var member MemberResponse

			err := rows.Scan(
				&member.ID,
				&member.Name,
				&member.Email,
				&member.Role,
			)

			if err != nil {
				http.Error(w, "Error reading member data", http.StatusInternalServerError)
				return
			}

			members = append(members, member)
		}

		if err := rows.Err(); err != nil {
			http.Error(w, "Error reading project members", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"project_id": projectID,
			"members":    members,
		})
	}
}

func DeleteProjectMember(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodDelete {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userIDValue := r.Context().Value(middleware.UserIDKey)

		ownerID, ok := userIDValue.(int)
		if !ok {
			http.Error(w, "User ID not found", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")

		if len(parts) != 5 ||
			parts[0] != "api" ||
			parts[1] != "projects" ||
			parts[3] != "members" {

			http.Error(w, "Invalid member URL", http.StatusBadRequest)
			return
		}

		projectID, err := strconv.Atoi(parts[2])
		if err != nil {
			http.Error(w, "Invalid project ID", http.StatusBadRequest)
			return
		}

		memberUserID, err := strconv.Atoi(parts[4])
		if err != nil {
			http.Error(w, "Invalid member user ID", http.StatusBadRequest)
			return
		}

		var projectOwnerID int

		err = db.QueryRow(
			`SELECT owner_id
			 FROM projects
			 WHERE id = $1`,
			projectID,
		).Scan(&projectOwnerID)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Project not found", http.StatusNotFound)
				return
			}

			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if projectOwnerID != ownerID {
			http.Error(w, "Only the project owner can remove members", http.StatusForbidden)
			return
		}

		result, err := db.Exec(
			`DELETE FROM project_members
			 WHERE project_id = $1 AND user_id = $2`,
			projectID,
			memberUserID,
		)

		if err != nil {
			http.Error(w, "Error removing project member", http.StatusInternalServerError)
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			http.Error(w, "Error checking member removal", http.StatusInternalServerError)
			return
		}

		if rowsAffected == 0 {
			http.Error(w, "Project member not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]interface{}{
			"message":    "Project member removed successfully",
			"project_id": projectID,
			"user_id":    memberUserID,
		})
	}
}
