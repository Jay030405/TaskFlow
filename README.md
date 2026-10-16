# TaskFlow — Project & Task Management System

TaskFlow is a full-stack project and task management application that helps users organize projects, manage tasks, collaborate with team members, track task progress, and communicate through comments.

The application is built using React, Go, and PostgreSQL, with Docker Compose for containerized local development.

## Features

- **User Authentication:** Register and log in securely using password hashing and JWT-based authentication.
- **Project Management:** Create, view, update, and delete projects.
- **Task Management:** Create tasks, view project tasks, update task details, and track task status and priority.
- **My Tasks:** Navigate to tasks associated with your work.
- **Team Collaboration:** Add team members to projects and view project membership.
- **Role Management:** Allow project owners to manage member roles and remove members.
- **Task Comments:** Add, view, and delete comments associated with tasks.
- **Responsive Interface:** Use the application across desktop and mobile screen sizes.
- **REST API:** Connect the React frontend to a Go backend through HTTP endpoints.
- **Database Persistence:** Store users, projects, tasks, memberships, and comments in PostgreSQL.
- **Containerization:** Run the frontend, backend, and database using Docker Compose.

## Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | Styling and responsive layouts |
| JavaScript | Frontend functionality |
| React | User interface |
| Vite | Frontend development and production builds |
| Go | Backend application and REST API |
| PostgreSQL | Relational database |
| JWT | Authentication tokens |
| bcrypt | Password hashing |
| Docker | Application containerization |
| Docker Compose | Multi-container orchestration |
| Nginx | Frontend production serving and local API proxy |
| Git and GitHub | Version control and source code hosting |

## Project Structure

```text
TaskFlow/
├── backend/
│   ├── database/
│   │   └── database.go
│   ├── handlers/
│   ├── middleware/
│   ├── models/
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── api.js
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.js
├── database/
│   └── init.sql
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Prerequisites

Install the following software before running the project:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)

Docker Desktop should be running before you start the application.

## Run TaskFlow Locally with Docker

### 1. Clone the repository

```bash
git clone https://github.com/Jay030405/TaskFlow.git
cd TaskFlow
```

### 2. Configure environment variables

Create the required local environment files based on your Docker Compose configuration.

Configure the PostgreSQL connection settings and JWT secret using environment variables. Keep passwords, signing secrets, and other credentials private.

Do not commit `.env` files or database backups to GitHub.

### 3. Start the application

From the project root, run:

```bash
docker compose up -d --build
```

This builds and starts the frontend, backend, and PostgreSQL containers.

### 4. Open TaskFlow

| Service | Local URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8080 |
| PostgreSQL | localhost:5432 |

### 5. Verify the containers

```bash
docker compose ps
```

The frontend and backend containers should be running, and PostgreSQL should become healthy.

### 6. View application logs

```bash
docker compose logs -f
```

Press `Ctrl+C` to stop following the logs. This does not stop the containers.

### 7. Stop the application

```bash
docker compose stop
```

To start the existing containers again:

```bash
docker compose start
```

To stop the containers without deleting the database volume:

```bash
docker compose down
```

Your persistent PostgreSQL data volume is retained by these commands. Do not use `docker compose down -v` unless you deliberately intend to delete the associated volumes.

## Backend API Overview

The Go backend exposes REST endpoints for authentication, users, projects, project membership, tasks, and comments.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/register` | Register a user |
| POST | `/api/login` | Authenticate a user |
| GET | `/api/me` | Retrieve the authenticated user |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/{id}` | Retrieve a project |
| PUT | `/api/projects/{id}` | Update a project |
| DELETE | `/api/projects/{id}` | Delete a project |
| GET | `/api/projects/{id}/members` | List project members |
| POST | `/api/projects/{id}/members` | Add a project member |
| PUT | `/api/projects/{id}/members/{userId}` | Update a member's role |
| DELETE | `/api/projects/{id}/members/{userId}` | Remove a project member |
| GET | `/api/projects/{id}/tasks` | List project tasks |
| POST | `/api/projects/{id}/tasks` | Create a task |
| GET | `/api/tasks/{id}` | Retrieve a task |
| PUT | `/api/tasks/{id}` | Update a task |
| DELETE | `/api/tasks/{id}` | Delete a task |
| GET | `/api/tasks/{id}/comments` | List task comments |
| POST | `/api/tasks/{id}/comments` | Add a task comment |
| DELETE | `/api/tasks/{id}/comments/{commentId}` | Delete a task comment |

Protected endpoints require a valid JWT in the `Authorization: Bearer <token>` header. The endpoint list describes the registered routes; request bodies and authorization rules depend on the backend implementation.

## Run the Frontend in Development Mode

To run the Vite development server separately:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

The development server proxies `/api` requests to `http://localhost:8080`, as configured in `vite.config.js`.

To create a production build:

```bash
npm run build
```

To check the frontend code with ESLint:

```bash
npm run lint
```

## Security

- Passwords are hashed using bcrypt rather than stored as plaintext.
- JWTs are signed and validated by the backend.
- Protected routes use authentication middleware.
- Project membership and role-management operations enforce authorization rules in the backend.
- Environment files and database backups are excluded from version control.
- Hosted deployments must use HTTPS and securely configured environment variables.
- Never publish database passwords, JWT signing secrets, access tokens, or private backups.

## Deployment

The application is being prepared for managed hosting with separate frontend, backend, and PostgreSQL services.

The planned architecture is:

- React frontend hosted as a static site.
- Go REST API hosted as a web service.
- PostgreSQL hosted on a managed database platform.

Deployment is still in progress. Public service URLs and provider-specific configuration will be added after deployment and live testing are complete.

## Future Improvements

Potential future enhancements include:

- Email invitations and notifications.
- Task due dates and overdue reminders.
- Advanced task filtering and search.
- Project activity history.
- Dashboard statistics and progress charts.
- Automated testing and continuous integration.

## Author

Developed as a full-stack project to demonstrate frontend development, backend API design, database management, authentication, authorization, containerization, and version control.

## License

No license has been specified yet. All rights are reserved by the author unless a license is added to this repository.
