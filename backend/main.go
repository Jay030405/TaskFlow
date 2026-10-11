package main

import (
	"fmt"
	"net/http"
	"strings"

	"taskflow-backend/database"
	"taskflow-backend/handlers"
	"taskflow-backend/middleware"
)

func homeHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "TaskFlow backend is running!")
}

func main() {
	db := database.ConnectDB()
	defer db.Close()

	http.HandleFunc("/", homeHandler)

	http.HandleFunc("/api/register", handlers.Register(db))
	http.HandleFunc("/api/login", handlers.Login(db))

	http.Handle(
		"/api/me",
		middleware.AuthMiddleware(handlers.GetMe(db)),
	)

	http.Handle(
		"/api/projects",
		middleware.AuthMiddleware(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.Method {
				case http.MethodGet:
					handlers.GetProjects(db)(w, r)
				case http.MethodPost:
					handlers.CreateProject(db)(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
			}),
		),
	)

	http.Handle(
		"/api/projects/",
		middleware.AuthMiddleware(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if strings.Contains(r.URL.Path, "/members") {
					if strings.HasSuffix(r.URL.Path, "/members") {
						switch r.Method {
						case http.MethodGet:
							handlers.GetProjectMembers(db)(w, r)
						case http.MethodPost:
							handlers.AddProjectMember(db)(w, r)
						default:
							http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
						}
						return
					}

					if strings.Contains(r.URL.Path, "/members/") {
						switch r.Method {
						case http.MethodPut:
							handlers.UpdateProjectMemberRole(db)(w, r)
						case http.MethodDelete:
							handlers.DeleteProjectMember(db)(w, r)
						default:
							http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
						}
						return
					}
				}

				if strings.HasSuffix(r.URL.Path, "/tasks") {
					switch r.Method {
					case http.MethodGet:
						handlers.GetProjectTasks(db)(w, r)
					case http.MethodPost:
						handlers.CreateTask(db)(w, r)
					default:
						http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
					}
					return
				}

				switch r.Method {
				case http.MethodGet:
					handlers.GetProject(db)(w, r)
				case http.MethodPut:
					handlers.UpdateProject(db)(w, r)
				case http.MethodDelete:
					handlers.DeleteProject(db)(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
			}),
		),
	)

	http.Handle(
		"/api/tasks/",
		middleware.AuthMiddleware(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if strings.HasSuffix(r.URL.Path, "/comments") {
					switch r.Method {
					case http.MethodGet:
						handlers.GetTaskComments(db)(w, r)
					case http.MethodPost:
						handlers.CreateComment(db)(w, r)
					default:
						http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
					}
					return
				}

				if strings.Contains(r.URL.Path, "/comments/") &&
					r.Method == http.MethodDelete {
					handlers.DeleteComment(db)(w, r)
					return
				}

				switch r.Method {
				case http.MethodGet:
					handlers.GetTask(db)(w, r)
				case http.MethodPut:
					handlers.UpdateTask(db)(w, r)
				case http.MethodDelete:
					handlers.DeleteTask(db)(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
			}),
		),
	)

	fmt.Println("TaskFlow backend is running on http://localhost:8080")

	if err := http.ListenAndServe(":8080", nil); err != nil {
		fmt.Println("Server error:", err)
	}
}
