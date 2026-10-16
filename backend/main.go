package main

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"taskflow-backend/database"
	"taskflow-backend/handlers"
	"taskflow-backend/middleware"
)

func homeHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "TaskFlow backend is running!")
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigin := strings.TrimRight(
			os.Getenv("FRONTEND_URL"),
			"/",
		)
		origin := strings.TrimRight(r.Header.Get("Origin"), "/")

		// Permit local development and the local Docker frontend.
		isLocalOrigin := origin == "http://localhost:5173" ||
			origin == "http://localhost:3000"

		if origin != "" && (origin == allowedOrigin ||
			(allowedOrigin == "" && isLocalOrigin)) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set(
				"Access-Control-Allow-Methods",
				"GET, POST, PUT, DELETE, OPTIONS",
			)
			w.Header().Set(
				"Access-Control-Allow-Headers",
				"Authorization, Content-Type",
			)
		}

		if r.Method == http.MethodOptions {
			if origin == "" ||
				(origin != allowedOrigin &&
					!(allowedOrigin == "" && isLocalOrigin)) {
				http.Error(
					w,
					"Origin not allowed",
					http.StatusForbidden,
				)
				return
			}

			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	db := database.ConnectDB()
	defer db.Close()

	mux := http.NewServeMux()

	mux.HandleFunc("/", homeHandler)

	mux.HandleFunc("/api/register", handlers.Register(db))
	mux.HandleFunc("/api/login", handlers.Login(db))

	mux.Handle(
		"/api/me",
		middleware.AuthMiddleware(handlers.GetMe(db)),
	)

	mux.Handle(
		"/api/projects",
		middleware.AuthMiddleware(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.Method {
				case http.MethodGet:
					handlers.GetProjects(db)(w, r)
				case http.MethodPost:
					handlers.CreateProject(db)(w, r)
				default:
					http.Error(
						w,
						"Method not allowed",
						http.StatusMethodNotAllowed,
					)
				}
			}),
		),
	)

	mux.Handle(
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
							http.Error(
								w,
								"Method not allowed",
								http.StatusMethodNotAllowed,
							)
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
							http.Error(
								w,
								"Method not allowed",
								http.StatusMethodNotAllowed,
							)
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
						http.Error(
							w,
							"Method not allowed",
							http.StatusMethodNotAllowed,
						)
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
					http.Error(
						w,
						"Method not allowed",
						http.StatusMethodNotAllowed,
					)
				}
			}),
		),
	)

	mux.Handle(
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
						http.Error(
							w,
							"Method not allowed",
							http.StatusMethodNotAllowed,
						)
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
					http.Error(
						w,
						"Method not allowed",
						http.StatusMethodNotAllowed,
					)
				}
			}),
		),
	)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	handler := corsMiddleware(mux)

	fmt.Printf("TaskFlow backend is running on port %s\n", port)

	if err := http.ListenAndServe("0.0.0.0:"+port, handler); err != nil {
		fmt.Println("Server error:", err)
	}
}
