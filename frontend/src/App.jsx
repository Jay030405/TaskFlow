import { apiUrl } from "./api";
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [isLogin, setIsLogin] = useState(true);

  const [isLoggedIn, setIsLoggedIn] = useState(
    Boolean(localStorage.getItem("taskflow_token"))
  );

  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);

  const [selectedProject, setSelectedProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);

  const [showMemberForm, setShowMemberForm] = useState(false);

  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskComments, setTaskComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);

  const [taskFilter, setTaskFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskSort, setTaskSort] = useState("default");

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    due_date: "",
    assigned_to: "",
  });

  const [memberForm, setMemberForm] = useState({
    user_id: "",
    role: "member",
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoggedIn) {
      loadUser();
      loadProjects();
    }
  // Intentionally reload only when authentication state changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  async function loadUser() {
    const token = localStorage.getItem("taskflow_token");

    if (!token) {
      setIsLoggedIn(false);
      return;
    }

    try {
      const response = await fetch(apiUrl("/api/me"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        localStorage.removeItem("taskflow_token");
        setIsLoggedIn(false);
        return;
      }

      setUser(data);
    } catch {
      setError("Unable to load user information.");
    }
  }

  async function loadProjects() {
    const token = localStorage.getItem("taskflow_token");

    if (!token) {
      setProjectsLoading(false);
      return;
    }

    setProjectsLoading(true);

    try {
      const response = await fetch(apiUrl("/api/projects"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to load projects.");
        return;
      }

      const loadedProjects = data.projects || data || [];

      setProjects(loadedProjects);

      await loadAllTasks(loadedProjects);
      await loadAllTeamMembers(loadedProjects);
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    } finally {
      setProjectsLoading(false);
    }
  }

  const loadAllTasks = async (projectList) => {
    const token = localStorage.getItem("taskflow_token");

    if (!token || projectList.length === 0) {
      setAllTasks([]);
      return;
    }

    try {
      const taskResponses = await Promise.all(
        projectList.map((project) =>
          fetch(apiUrl(`/api/projects/${project.id}/tasks`), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }).then((response) => response.json())
        )
      );

      const tasks = taskResponses.flatMap(
        (data) => data.tasks || data || []
      );

      setAllTasks(tasks);
    } catch {
      setError("Unable to load dashboard tasks.");
    }
  };

  const loadAllTeamMembers = async (projectList) => {
    const token = localStorage.getItem("taskflow_token");

    if (!token || projectList.length === 0) {
      setTeamMembers([]);
      return;
    }

    setTeamLoading(true);

    try {
      const teamResponses = await Promise.all(
        projectList.map(async (project) => {
          try {
            const response = await fetch(
              apiUrl(`/api/projects/${project.id}/members`),
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (!response.ok) {
              return [];
            }

            const data = await response.json();

            const members =
              data.members ||
              data.project_members ||
              data.memberships ||
              (Array.isArray(data) ? data : []);

            return members.map((member) => ({
              ...member,
              // The API returns the user's ID as `id`; normalize it so
              // dashboard deduplication and rendering can use `user_id`.
              user_id: member.user_id ?? member.id,
              project_id: project.id,
              project_name: project.name,
            }));
          } catch {
            return [];
          }
        })
      );

      const loadedTeamMembers = teamResponses.flat();

      const ownerEntries = projectList
        .filter(
          (project) =>
            Number(project.owner_id) === Number(user?.id)
        )
        .map((project) => ({
          id: `owner-${project.id}-${user?.id}`,
          user_id: user?.id,
          name: user?.name || "You",
          email: user?.email || "",
          role: "owner",
          project_id: project.id,
          project_name: project.name,
        }));

      const combinedMembers = [
        ...ownerEntries,
        ...loadedTeamMembers,
      ];

      const uniqueMembers = combinedMembers.filter(
        (member, index, array) =>
          array.findIndex(
            (item) =>
              Number(item.user_id) === Number(member.user_id) &&
              Number(item.project_id) === Number(member.project_id)
          ) === index
      );

      setTeamMembers(uniqueMembers);
    } catch {
      setError("Unable to load team members.");
    } finally {
      setTeamLoading(false);
    }
  };

  const loadProjectDetails = async (projectId) => {
    const token = localStorage.getItem("taskflow_token");

    if (!token) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const projectResponse = await fetch(
        apiUrl(`/api/projects/${projectId}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const projectData = await projectResponse.json();

      if (!projectResponse.ok) {
        setError(
          projectData.message || "Unable to load project."
        );
        return;
      }

      setSelectedProject(projectData.project || projectData);
      setProjectMembers([]);

      setTaskFilter("all");
      setPriorityFilter("all");
      setTaskSort("default");
      setTaskSearch("");

      await loadProjectTasks(projectId);
      await loadProjectMembers(projectId);
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    }
  };

  const loadProjectTasks = async (projectId) => {
    const token = localStorage.getItem("taskflow_token");

    if (!token) {
      setTasksLoading(false);
      return;
    }

    setTasksLoading(true);

    try {
      const response = await fetch(
        apiUrl(`/api/projects/${projectId}/tasks`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to load project tasks."
        );
        return;
      }

      setProjectTasks(data.tasks || data || []);
    } catch {
      setError("Unable to load project tasks.");
    } finally {
      setTasksLoading(false);
    }
  };

  const loadProjectMembers = async (projectId) => {
    const token = localStorage.getItem("taskflow_token");

    if (!token) {
      setMembersLoading(false);
      return;
    }

    setMembersLoading(true);

    try {
      const response = await fetch(
        apiUrl(`/api/projects/${projectId}/members`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to load project members."
        );
        return;
      }

      const loadedMembers =
        data.members ||
        data.project_members ||
        data.memberships ||
        (Array.isArray(data) ? data : []);

      setProjectMembers(loadedMembers);
    } catch {
      setError("Unable to load project members.");
    } finally {
      setMembersLoading(false);
    }
  };

  const loadTaskComments = async (taskId) => {
    const token = localStorage.getItem("taskflow_token");

    if (!token) {
      return;
    }

    setCommentsLoading(true);

    try {
      const response = await fetch(
        apiUrl(`/api/tasks/${taskId}/comments`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to load comments."
        );
        return;
      }

      setTaskComments(data.comments || []);
    } catch {
      setError("Unable to load task comments.");
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleToggleComments = async (taskId) => {
    setMessage("");
    setError("");

    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
  setSelectedTaskId(null);
      setTaskComments([]);
      setCommentText("");
      return;
    }

    setExpandedTaskId(taskId);
    setCommentText("");

    await loadTaskComments(taskId);
  };

  const handleAddComment = async (e, taskId) => {
    e.preventDefault();

    const token = localStorage.getItem("taskflow_token");

    if (!token) {
      setError("Please login again.");
      return;
    }

    if (!commentText.trim()) {
      setError("Please enter a comment.");
      return;
    }

    setMessage("");
    setError("");
    setCommentSubmitting(true);

    try {
      const response = await fetch(
        apiUrl(`/api/tasks/${taskId}/comments`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: commentText.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to add comment."
        );
        return;
      }

      setCommentText("");
      setMessage("Comment added successfully!");

      await loadTaskComments(taskId);
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (taskId, commentId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this comment?"
    );

    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem("taskflow_token");

    if (!token) {
      setError("Please login again.");
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        apiUrl(`/api/tasks/${taskId}/comments/${commentId}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to delete comment."
        );
        return;
      }

      setMessage("Comment deleted successfully!");

      await loadTaskComments(taskId);
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    }
  };

  const handleProjectChange = (e) => {
    setProjectForm({
      ...projectForm,
      [e.target.name]: e.target.value,
    });
  };

  const startEditProject = (project) => {
    setEditingProjectId(project.id);

    setProjectForm({
      name: project.name || "",
      description: project.description || "",
    });

    setShowProjectForm(true);
    setMessage("");
    setError("");
  };

  const cancelProjectForm = () => {
    setShowProjectForm(false);
    setEditingProjectId(null);

    setProjectForm({
      name: "",
      description: "",
    });
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    const token = localStorage.getItem("taskflow_token");

    if (!token) {
      setError("Please login again.");
      return;
    }

    try {
      const url = editingProjectId
        ? `/api/projects/${editingProjectId}`
        : "/api/projects";

      const response = await fetch(apiUrl(url), {
        method: editingProjectId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(projectForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            (editingProjectId
              ? "Unable to update project."
              : "Unable to create project.")
        );
        return;
      }

      setMessage(
        editingProjectId
          ? "Project updated successfully!"
          : "Project created successfully!"
      );

      cancelProjectForm();

      await loadProjects();
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    }
  };

  const handleDeleteProject = async (projectId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this project? All tasks and comments belonging to this project will also be deleted."
    );

    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem("taskflow_token");

    if (!token) {
      setError("Please login again.");
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        apiUrl(`/api/projects/${projectId}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to delete project."
        );
        return;
      }

      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setProjectTasks([]);
        setProjectMembers([]);
        setExpandedTaskId(null);
  setSelectedTaskId(null);
        setTaskComments([]);
        setTaskFilter("all");
        setPriorityFilter("all");
      }

      setMessage("Project deleted successfully!");

      await loadProjects();
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    }
  };

  const handleTaskChange = (e) => {
    setTaskForm({
      ...taskForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    const token = localStorage.getItem("taskflow_token");

    if (!token || !selectedProject) {
      setError("Please select a project first.");
      return;
    }

    try {
      const url = editingTaskId
        ? `/api/tasks/${editingTaskId}`
        : `/api/projects/${selectedProject.id}/tasks`;

      const response = await fetch(apiUrl(url), {
        method: editingTaskId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...taskForm,
          assigned_to: taskForm.assigned_to
            ? Number(taskForm.assigned_to)
            : 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            (editingTaskId
              ? "Unable to update task."
              : "Unable to create task.")
        );
        return;
      }

      setMessage(
        editingTaskId
          ? "Task updated successfully!"
          : "Task created successfully!"
      );

      cancelTaskForm();

      await loadProjectTasks(selectedProject.id);
      await loadProjects();
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    }
  };

  const startEditTask = (task) => {
    setEditingTaskId(task.id);

    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "todo",
      priority: task.priority || "medium",
      due_date: task.due_date
        ? task.due_date.substring(0, 10)
        : "",
      assigned_to: task.assigned_to
        ? String(task.assigned_to)
        : "",
    });

    setShowTaskForm(true);
    setMessage("");
    setError("");
  };

  const cancelTaskForm = () => {
    setShowTaskForm(false);
    setEditingTaskId(null);

    setTaskForm({
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      due_date: "",
      assigned_to: "",
    });
  };

  const handleDeleteTask = async (taskId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this task?"
    );

    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem("taskflow_token");

    if (!token || !selectedProject) {
      setError("Please login again.");
      return;
    }

    try {
      const response = await fetch(
        apiUrl(`/api/tasks/${taskId}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to delete task."
        );
        return;
      }

      if (expandedTaskId === taskId) {
        setExpandedTaskId(null);
  setSelectedTaskId(null);
        setTaskComments([]);
        setCommentText("");
      }

      setMessage("Task deleted successfully!");

      await loadProjectTasks(selectedProject.id);
      await loadProjects();
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    }
  };

  const handleMemberChange = (e) => {
    setMemberForm({
      ...memberForm,
      [e.target.name]: e.target.value,
    });
  };

  const cancelMemberForm = () => {
    setShowMemberForm(false);

    setMemberForm({
      user_id: "",
      role: "member",
    });
  };

  const handleAddMember = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    const token = localStorage.getItem("taskflow_token");

    if (!token || !selectedProject) {
      setError("Please select a project first.");
      return;
    }

    if (!memberForm.user_id) {
      setError("Please enter a user ID.");
      return;
    }

    try {
      const response = await fetch(
        apiUrl(`/api/projects/${selectedProject.id}/members`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: Number(memberForm.user_id),
            role: memberForm.role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to add project member."
        );
        return;
      }

      setMessage("Project member added successfully!");

      cancelMemberForm();

      await loadProjectMembers(selectedProject.id);
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    }
  };

  const handleRemoveMember = async (memberId) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this member from the project?"
    );

    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem("taskflow_token");

    if (!token || !selectedProject) {
      setError("Please login again.");
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        apiUrl(`/api/projects/${selectedProject.id}/members/${memberId}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to remove project member."
        );
        return;
      }

      setMessage("Project member removed successfully!");

      await loadProjectMembers(selectedProject.id);
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    }
  };


  const handleUpdateMemberRole = async (memberUserId, role) => {
    const token = localStorage.getItem("taskflow_token");

    if (!token || !selectedProject) {
      setError("Please login again.");
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        apiUrl(`/api/projects/${selectedProject.id}/members/${memberUserId}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role }),
        }
      );

      const responseText = await response.text();
      let data = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { message: responseText };
      }

      if (!response.ok) {
        setError(data.message || "Unable to update member role.");
        return;
      }

      setMessage("Member role updated successfully!");
      await loadProjectMembers(selectedProject.id);
      await loadProjects();
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    }
  };

  const handleProjectsNavigation = () => {
    setSelectedProject(null);
    setShowProjectForm(false);
    setEditingProjectId(null);
    setMessage("");
    setError("");

    setTimeout(() => {
      const projectsSection = document.querySelector(".projects-dashboard-section");

      if (projectsSection) {
        projectsSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 0);
  };

  const handleMyTasksNavigation = () => {
    setSelectedProject(null);
    setMessage("");
    setError("");

    setTimeout(() => {
      const myTasksSection = document.querySelector(".my-tasks-dashboard-section");

      if (myTasksSection) {
        myTasksSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 0);
  };

  const handleTeamNavigation = () => {
    setSelectedProject(null);
    setMessage("");
    setError("");

    setTimeout(() => {
      const teamSection = document.querySelector(".team-dashboard-section");

      if (teamSection) {
        teamSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 0);
  };

  const closeProjectDetails = () => {
    setSelectedProject(null);
    setProjectTasks([]);
    setProjectMembers([]);
    setShowTaskForm(false);
    setEditingTaskId(null);
    setShowMemberForm(false);
    setExpandedTaskId(null);
  setSelectedTaskId(null);
    setTaskComments([]);
    setCommentText("");
    setTaskFilter("all");
    setPriorityFilter("all");
    setMessage("");
    setError("");
  };

  const handleLoginChange = (e) => {
    setLoginForm({
      ...loginForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegisterChange = (e) => {
    setRegisterForm({
      ...registerForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    try {
      const response = await fetch(apiUrl("/api/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Invalid email or password.");
        return;
      }

      localStorage.setItem("taskflow_token", data.token);

      setLoginForm({
        email: "",
        password: "",
      });

      setIsLoggedIn(true);
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    try {
      const response = await fetch(apiUrl("/api/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registerForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Registration failed.");
        return;
      }

      setMessage(
        "Account created successfully! You can now login."
      );

      setRegisterForm({
        name: "",
        email: "",
        password: "",
      });

      setIsLogin(true);
    } catch {
      setError("Unable to connect to the TaskFlow backend.");
    }
  };

  const switchAuthMode = () => {
    setIsLogin(!isLogin);
    setMessage("");
    setError("");
  };

  const handleLogout = () => {
    localStorage.removeItem("taskflow_token");

    setUser(null);
    setProjects([]);
    setAllTasks([]);
    setTeamMembers([]);
    setSelectedProject(null);
    setProjectTasks([]);
    setProjectMembers([]);
    setExpandedTaskId(null);
  setSelectedTaskId(null);
    setTaskComments([]);
    setCommentText("");
    setTaskFilter("all");
    setPriorityFilter("all");
    setTaskSort("default");
    setIsLoggedIn(false);
    setMessage("");
    setError("");
  };

  const completedTasks = allTasks.filter(
    (task) => task.status === "completed"
  ).length;

  const inProgressTasks = allTasks.filter(
    (task) => task.status === "in_progress"
  ).length;

  const todoTasks = allTasks.filter(
    (task) => task.status === "todo"
  ).length;

  const highPriorityTasks = allTasks.filter(
    (task) => task.priority === "high"
  ).length;

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const isTaskOverdue = (task) =>
    Boolean(
      task.due_date &&
        task.status !== "completed" &&
        task.due_date < todayString
    );

  const dueSoonDate = new Date(today);
  dueSoonDate.setDate(dueSoonDate.getDate() + 3);

  const dueSoonDateString = `${dueSoonDate.getFullYear()}-${String(
    dueSoonDate.getMonth() + 1
  ).padStart(2, "0")}-${String(dueSoonDate.getDate()).padStart(2, "0")}`;

  const isTaskDueSoon = (task) =>
    Boolean(
      task.due_date &&
        task.status !== "completed" &&
        task.due_date >= todayString &&
        task.due_date <= dueSoonDateString
    );

  const overdueTasks = allTasks.filter(isTaskOverdue).length;
  const dueSoonTasks = allTasks.filter(isTaskDueSoon).length;

  const projectCompletedTasks = projectTasks.filter(
    (task) => task.status === "completed"
  ).length;

  const projectTotalTasks = projectTasks.length;

  const projectProgress =
    projectTotalTasks === 0
      ? 0
      : Math.round(
          (projectCompletedTasks / projectTotalTasks) * 100
        );

  const filteredProjectTasks = projectTasks
    .filter((task) => {
      const matchesStatus =
        taskFilter === "all" || task.status === taskFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        task.priority === priorityFilter;

      const searchText = taskSearch.trim().toLowerCase();

      const matchesSearch =
        searchText === "" ||
        task.title?.toLowerCase().includes(searchText) ||
        task.description?.toLowerCase().includes(searchText);

      return matchesStatus && matchesPriority && matchesSearch;
    })
    .sort((a, b) => {
      if (taskSort === "priority") {
        const priorityOrder = {
          high: 1,
          medium: 2,
          low: 3,
        };

        return (priorityOrder[a.priority] || 99) -
          (priorityOrder[b.priority] || 99);
      }

      if (taskSort === "due_date") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;

        return new Date(a.due_date) - new Date(b.due_date);
      }

      if (taskSort === "title") {
        return (a.title || "").localeCompare(b.title || "");
      }

      return 0;
    });

  if (isLoggedIn) {
    return (
      <div className="dashboard">
        <aside className="sidebar">

          <div className="sidebar-brand">
            <div className="sidebar-logo">T</div>
            <span>TaskFlow</span>
          </div>

          <nav className="sidebar-nav">

            <button className="nav-item active">
              <span>📊</span>
              Dashboard
            </button>

            <button
              className="nav-item"
              onClick={handleProjectsNavigation}
            >
              <span>📁</span>
              Projects
            </button>

            <button
              className="nav-item"
              onClick={handleMyTasksNavigation}
            >
              <span>✓</span>
              My Tasks
            </button>

            <button
              className="nav-item"
              onClick={handleTeamNavigation}
            >
              <span>👥</span>
              Team
            </button>

          </nav>

          <div className="sidebar-bottom">

            <button
              className="logout-button"
              onClick={handleLogout}
            >
              <span>↪</span>
              Logout
            </button>

          </div>

        </aside>

        <main className="dashboard-main">

          <header className="dashboard-header">

            <div>
              <p className="dashboard-label">
                Workspace
              </p>

              <h1>Dashboard</h1>
            </div>

            <div className="user-profile">

              <div className="user-avatar">
                {user?.name
                  ? user.name.charAt(0).toUpperCase()
                  : "U"}
              </div>

              <div>

                <strong>
                  {user?.name || "User"}
                </strong>

                <span>
                  {user?.email || "Loading..."}
                </span>

              </div>

            </div>

          </header>

          {selectedProject ? (

            <section className="project-details-page">

              <button
                className="back-button"
                onClick={closeProjectDetails}
              >
                ← Back to Dashboard
              </button>

              <div className="project-details-header">

                <div>

                  <p className="dashboard-label">
                    Project
                  </p>

                  <h2>
                    {selectedProject.name}
                  </h2>

                  <p>
                    {selectedProject.description ||
                      "No description available."}
                  </p>

                </div>

                <div
                  style={{
                    marginTop: "20px",
                    padding: "16px 18px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                      gap: "12px",
                    }}
                  >
                    <strong>Project Progress</strong>
                    <span>
                      {projectCompletedTasks} of {projectTotalTasks} tasks completed ({projectProgress}%)
                    </span>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: "10px",
                      background: "#e5e7eb",
                      borderRadius: "999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${projectProgress}%`,
                        height: "100%",
                        background: "#2563eb",
                        borderRadius: "999px",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                <div className="project-header-actions">

                  <button
                    className="edit-project-button"
                    onClick={() =>
                      startEditProject(selectedProject)
                    }
                  >
                    Edit Project
                  </button>

                  <button
                    className="delete-project-button"
                    onClick={() =>
                      handleDeleteProject(
                        selectedProject.id
                      )
                    }
                  >
                    Delete Project
                  </button>

                  <button
                    className="add-button"
                    onClick={() => {
                      if (showTaskForm) {
                        cancelTaskForm();
                      } else {
                        setShowTaskForm(true);
                        setMessage("");
                        setError("");
                      }
                    }}
                  >
                    {showTaskForm
                      ? "Cancel"
                      : "+ New Task"}
                  </button>

                </div>

              </div>

              {message && (
                <div className="success-message">
                  {message}
                </div>
              )}

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {showProjectForm && (
                <form
                  className="project-form"
                  onSubmit={handleSaveProject}
                >

                  <h3>
                    Edit Project
                  </h3>

                  <div className="form-group">

                    <label htmlFor="project-name">
                      Project Name
                    </label>

                    <input
                      id="project-name"
                      type="text"
                      name="name"
                      value={projectForm.name}
                      onChange={handleProjectChange}
                      required
                    />

                  </div>

                  <div className="form-group">

                    <label htmlFor="project-description">
                      Description
                    </label>

                    <textarea
                      id="project-description"
                      name="description"
                      value={projectForm.description}
                      onChange={handleProjectChange}
                      rows="4"
                    />

                  </div>

                  <div className="project-form-actions">

                    <button
                      type="button"
                      className="cancel-button"
                      onClick={cancelProjectForm}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="create-button"
                    >
                      Update Project
                    </button>

                  </div>

                </form>
              )}

              {showTaskForm && (

                <form
                  className="project-form"
                  onSubmit={handleSaveTask}
                >

                  <h3>
                    {editingTaskId
                      ? "Edit Task"
                      : "Create Task"}
                  </h3>

                  <div className="form-group">

                    <label htmlFor="task-title">
                      Task Title
                    </label>

                    <input
                      id="task-title"
                      type="text"
                      name="title"
                      placeholder="Enter task title"
                      value={taskForm.title}
                      onChange={handleTaskChange}
                      required
                    />

                  </div>

                  <div className="form-group">

                    <label htmlFor="task-description">
                      Description
                    </label>

                    <textarea
                      id="task-description"
                      name="description"
                      placeholder="Enter task description"
                      value={taskForm.description}
                      onChange={handleTaskChange}
                      rows="4"
                    />

                  </div>

                  <div className="form-row">

                    <div className="form-group">

                      <label htmlFor="task-status">
                        Status
                      </label>

                      <select
                        id="task-status"
                        name="status"
                        value={taskForm.status}
                        onChange={handleTaskChange}
                      >

                        <option value="todo">
                          To Do
                        </option>

                        <option value="in_progress">
                          In Progress
                        </option>

                        <option value="completed">
                          Completed
                        </option>

                      </select>

                    </div>

                    <div className="form-group">

                      <label htmlFor="task-priority">
                        Priority
                      </label>

                      <select
                        id="task-priority"
                        name="priority"
                        value={taskForm.priority}
                        onChange={handleTaskChange}
                      >

                        <option value="low">
                          Low
                        </option>

                        <option value="medium">
                          Medium
                        </option>

                        <option value="high">
                          High
                        </option>

                      </select>

                    </div>

                  </div>

                  <div className="form-group">

                    <label htmlFor="task-due-date">
                      Due Date
                    </label>

                    <input
                      id="task-due-date"
                      type="date"
                      name="due_date"
                      value={taskForm.due_date}
                      onChange={handleTaskChange}
                    />

                  </div>

                  <div className="form-group">

                    <label htmlFor="task-assigned-to">
                      Assigned To
                    </label>

                    <select
                      id="task-assigned-to"
                      name="assigned_to"
                      value={taskForm.assigned_to}
                      onChange={handleTaskChange}
                    >

                      <option value="">
                        Unassigned
                      </option>

                      {Number(selectedProject.owner_id) ===
                        Number(user?.id) && (
                        <option value={user.id}>
                          {user.name} (Project Owner)
                        </option>
                      )}

                      {projectMembers
                        .filter(
                          (member) =>
                            Number(
                              member.user_id
                            ) !== Number(user?.id)
                        )
                        .map((member) => (

                          <option
                            key={
                              member.user_id ||
                              member.id
                            }
                            value={
                              member.user_id ||
                              member.id
                            }
                          >
                            {member.name ||
                              member.user_name ||
                              `User ${member.user_id}`}
                            {member.role
                              ? ` (${member.role})`
                              : ""}
                          </option>

                        ))}

                    </select>

                  </div>

                  <div className="project-form-actions">

                    <button
                      type="button"
                      className="cancel-button"
                      onClick={cancelTaskForm}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="create-button"
                    >
                      {editingTaskId
                        ? "Update Task"
                        : "Create Task"}
                    </button>

                  </div>

                </form>

              )}

              <div className="content-card">

                <div className="card-header">

                  <div>

                    <h3>
                      Project Tasks
                    </h3>

                    <p>
                      Tasks belonging to this project
                    </p>

                  </div>

                </div>

                <div className="task-filter-group">

                  <strong className="task-filter-label">
                    Search Tasks
                  </strong>

                  <input
                    type="text"
                    className="task-search-input"
                    placeholder="Search by title or description..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                  />

                </div>

                <div className="task-filter-group">

                  <strong className="task-filter-label">
                    Status
                  </strong>

                  <div className="task-filter-buttons">

                    <button
                      className={
                        taskFilter === "all"
                          ? "task-filter-button active"
                          : "task-filter-button"
                      }
                      onClick={() =>
                        setTaskFilter("all")
                      }
                    >
                      All
                    </button>

                    <button
                      className={
                        taskFilter === "todo"
                          ? "task-filter-button active"
                          : "task-filter-button"
                      }
                      onClick={() =>
                        setTaskFilter("todo")
                      }
                    >
                      To Do
                    </button>

                    <button
                      className={
                        taskFilter === "in_progress"
                          ? "task-filter-button active"
                          : "task-filter-button"
                      }
                      onClick={() =>
                        setTaskFilter("in_progress")
                      }
                    >
                      In Progress
                    </button>

                    <button
                      className={
                        taskFilter === "completed"
                          ? "task-filter-button active"
                          : "task-filter-button"
                      }
                      onClick={() =>
                        setTaskFilter("completed")
                      }
                    >
                      Completed
                    </button>

                  </div>

                </div>

                <div className="task-filter-group">

                  <strong className="task-filter-label">
                    Sort By
                  </strong>

                  <select
                    className="task-search-input"
                    value={taskSort}
                    onChange={(e) => setTaskSort(e.target.value)}
                  >
                    <option value="default">Default Order</option>
                    <option value="priority">Priority: High to Low</option>
                    <option value="due_date">Due Date: Earliest First</option>
                    <option value="title">Title: A to Z</option>
                  </select>

                </div>

                <div className="task-filter-group">

                  <strong className="task-filter-label">
                    Priority
                  </strong>

                  <div className="task-filter-buttons">

                    <button
                      className={
                        priorityFilter === "all"
                          ? "task-filter-button active"
                          : "task-filter-button"
                      }
                      onClick={() =>
                        setPriorityFilter("all")
                      }
                    >
                      All
                    </button>

                    <button
                      className={
                        priorityFilter === "low"
                          ? "task-filter-button active"
                          : "task-filter-button"
                      }
                      onClick={() =>
                        setPriorityFilter("low")
                      }
                    >
                      Low
                    </button>

                    <button
                      className={
                        priorityFilter === "medium"
                          ? "task-filter-button active"
                          : "task-filter-button"
                      }
                      onClick={() =>
                        setPriorityFilter("medium")
                      }
                    >
                      Medium
                    </button>

                    <button
                      className={
                        priorityFilter === "high"
                          ? "task-filter-button active"
                          : "task-filter-button"
                      }
                      onClick={() =>
                        setPriorityFilter("high")
                      }
                    >
                      High
                    </button>

                  </div>

                </div>

                {tasksLoading ? (

                  <div className="empty-projects">

                    <div className="project-icon">
                      ⏳
                    </div>

                    <strong>
                      Loading tasks...
                    </strong>

                    <span>
                      Please wait while the project tasks are being loaded.
                    </span>

                  </div>

                ) : filteredProjectTasks.length === 0 ? (

                  <div className="empty-projects">

                    <div className="project-icon">
                      ✓
                    </div>

                    <strong>
                      {projectTasks.length === 0
                        ? "No tasks yet"
                        : "No tasks match this filter"}
                    </strong>

                    <span>
                      {projectTasks.length === 0
                        ? "Create your first task for this project."
                        : "Try selecting a different task filter."}
                    </span>

                  </div>

                ) : (

                  filteredProjectTasks.map((task) => (

                    <div
                      className="task-container"
                      key={task.id}
                    >

                      <div className="task-row">

                        <div className="task-info">

                          <div className="task-check">
                            ✓
                          </div>

                          <div>

                            <strong>
                              {task.title}
                            </strong>

                            <span>
                              {task.description ||
                                "No description"}
                            </span>

                            <small>
                              Assigned to:{" "}
                              {task.assigned_name ||
                                "Unassigned"}
                            </small>

                          </div>

                        </div>

                        <div className="task-actions">

                          <span
                            className={`status-badge ${
                              task.status === "completed"
                                ? "completed"
                                : task.status ===
                                  "in_progress"
                                ? "in-progress"
                                : "todo"
                            }`}
                          >
                            {task.status === "in_progress"
                              ? "In Progress"
                              : task.status === "completed"
                              ? "Completed"
                              : "To Do"}
                          </span>

                          {isTaskOverdue(task) && (
                            <span className="status-badge todo">
                              Overdue
                            </span>
                          )}

                          {isTaskDueSoon(task) && (
                            <span className="status-badge todo">
                              Due Soon
                            </span>
                          )}

                          <button
                            className="task-details-button"
                            onClick={() =>
                              setSelectedTaskId(
                                selectedTaskId === task.id ? null : task.id
                              )
                            }
                          >
                            {selectedTaskId === task.id
                              ? "Hide Details"
                              : "View Details"}
                          </button>

                          <button
                            className="edit-task-button"
                            onClick={() =>
                              startEditTask(task)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="delete-task-button"
                            onClick={() =>
                              handleDeleteTask(task.id)
                            }
                          >
                            Delete
                          </button>

                          <button
                            className="comment-button"
                            onClick={() =>
                              handleToggleComments(task.id)
                            }
                          >
                            {expandedTaskId === task.id
                              ? "Hide Comments"
                              : "Comments"}
                          </button>

                        </div>

                      </div>

                      {selectedTaskId === task.id && (

                        <div className="task-details-section">

                          <h4>Task Details</h4>

                          <div className="task-details-grid">

                            <div>
                              <strong>Title</strong>
                              <span>{task.title}</span>
                            </div>

                            <div>
                              <strong>Status</strong>
                              <span>
                                {task.status === "in_progress"
                                  ? "In Progress"
                                  : task.status === "completed"
                                  ? "Completed"
                                  : "To Do"}
                              </span>
                            </div>

                            <div>
                              <strong>Priority</strong>
                              <span>
                                {(task.priority || "medium")
                                  .charAt(0)
                                  .toUpperCase() +
                                  (task.priority || "medium").slice(1)}
                              </span>
                            </div>

                            <div>
                              <strong>Due Date</strong>
                              <span>{task.due_date || "No due date"}</span>
                            </div>

                            <div>
                              <strong>Assigned To</strong>
                              <span>{task.assigned_name || "Unassigned"}</span>
                            </div>

                            <div>
                              <strong>Overdue</strong>
                              <span>{isTaskOverdue(task) ? "Yes" : "No"}</span>
                            </div>

                          </div>

                          <div className="task-details-description">
                            <strong>Description</strong>
                            <p>{task.description || "No description"}</p>
                          </div>

                        </div>
                      )}

                      {expandedTaskId === task.id && (

                        <div className="comments-section">

                          <h4>
                            Task Comments
                          </h4>

                          {commentsLoading ? (

                            <p className="no-comments">
                              Loading comments...
                            </p>

                          ) : taskComments.length === 0 ? (

                            <p className="no-comments">
                              No comments yet. Be the first to add one.
                            </p>

                          ) : (

                            taskComments.map((comment) => (

                              <div
                                className="comment-item"
                                key={comment.id}
                              >

                                <div className="comment-avatar">
                                  {(comment.user_name ||
                                    "U")
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>

                                <div className="comment-content">

                                  <div className="comment-header">

                                    <strong>
                                      {comment.user_name ||
                                        "User"}
                                    </strong>

                                    <span>
                                      {comment.user_email ||
                                        ""}
                                    </span>

                                  </div>

                                  <p>
                                    {comment.content}
                                  </p>

                                  <div className="comment-footer">

                                    <small>
                                      {comment.created_at
                                        ? new Date(
                                            comment.created_at
                                          ).toLocaleString()
                                        : ""}
                                    </small>

                                    {Number(
                                      comment.user_id
                                    ) ===
                                      Number(user?.id) && (

                                      <button
                                        className="delete-comment-button"
                                        onClick={() =>
                                          handleDeleteComment(
                                            task.id,
                                            comment.id
                                          )
                                        }
                                      >
                                        Delete
                                      </button>

                                    )}

                                  </div>

                                </div>

                              </div>

                            ))

                          )}

                          <form
                            className="comment-form"
                            onSubmit={(e) =>
                              handleAddComment(
                                e,
                                task.id
                              )
                            }
                          >

                            <textarea
                              placeholder="Write a comment..."
                              value={commentText}
                              onChange={(e) =>
                                setCommentText(
                                  e.target.value
                                )
                              }
                              rows="3"
                              maxLength="500"
                              disabled={commentSubmitting}
                            />

                            <div className="comment-form-footer">
                              <small>
                                {commentText.length}/500 characters
                              </small>

                              <button
                                type="submit"
                                className="create-button"
                                disabled={commentSubmitting || !commentText.trim()}
                              >
                                {commentSubmitting ? "Adding..." : "Add Comment"}
                              </button>
                            </div>

                          </form>

                        </div>

                      )}

                    </div>

                  ))

                )}

              </div>

              <div className="content-card">

                <div className="card-header">

                  <div>

                    <h3>
                      Team Members
                    </h3>

                    <p>
                      People working on this project
                    </p>

                  </div>

                  <button
                    className="add-button"
                    onClick={() => {
                      if (showMemberForm) {
                        cancelMemberForm();
                      } else {
                        setShowMemberForm(true);
                        setMessage("");
                        setError("");
                      }
                    }}
                  >
                    {showMemberForm
                      ? "Cancel"
                      : "+ Add Member"}
                  </button>

                </div>

                {showMemberForm && (

                  <form
                    className="project-form"
                    onSubmit={handleAddMember}
                  >

                    <h3>
                      Add Project Member
                    </h3>

                    <div className="form-group">

                      <label htmlFor="member-user-id">
                        User ID
                      </label>

                      <input
                        id="member-user-id"
                        type="number"
                        name="user_id"
                        placeholder="Enter user ID"
                        value={memberForm.user_id}
                        onChange={handleMemberChange}
                        min="1"
                        required
                      />

                      <span>
                        Enter the ID of an existing TaskFlow user.
                      </span>

                    </div>

                    <div className="form-group">

                      <label htmlFor="member-role">
                        Role
                      </label>

                      <select
                        id="member-role"
                        name="role"
                        value={memberForm.role}
                        onChange={handleMemberChange}
                      >

                        <option value="member">
                          Member
                        </option>

                        <option value="admin">
                          Admin
                        </option>

                        <option value="manager">
                          Manager
                        </option>

                      </select>

                    </div>

                    <div className="project-form-actions">

                      <button
                        type="button"
                        className="cancel-button"
                        onClick={cancelMemberForm}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="create-button"
                      >
                        Add Member
                      </button>

                    </div>

                  </form>

                )}

                {membersLoading ? (

                  <div className="empty-projects">

                    <div className="project-icon">
                      ⏳
                    </div>

                    <strong>
                      Loading team members...
                    </strong>

                    <span>
                      Please wait while the project team is being loaded.
                    </span>

                  </div>

                ) : projectMembers.length === 0 ? (

                  <div className="empty-projects">

                    <div className="project-icon">
                      👥
                    </div>

                    <strong>
                      No members yet
                    </strong>

                    <span>
                      Add members to collaborate on this project.
                    </span>

                  </div>

                ) : (

                  projectMembers.map((member) => (

                    <div
                      className="member-row"
                      key={member.id || member.user_id}
                    >

                      <div className="member-info">

                        <div className="user-avatar">
                          {(member.name ||
                            member.user_name ||
                            "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>

                          <strong>
                            {member.name ||
                              member.user_name ||
                              `User ${member.user_id}`}
                          </strong>

                          <span>
                            {member.email ||
                              member.user_email ||
                              "Project member"}
                          </span>

                        </div>

                      </div>

                      <div className="member-actions">

                        {Number(selectedProject.owner_id) === Number(user?.id) ? (
                          <select
                            aria-label={`Role for ${member.name || member.user_name || "team member"}`}
                            className="member-role-select"
                            value={(member.role || "member").toLowerCase()}
                            onChange={(e) =>
                              handleUpdateMemberRole(
                                member.user_id ?? member.id,
                                e.target.value
                              )
                            }
                          >
                            <option value="member">Member</option>
                            <option value="manager">Manager</option>
                          </select>
                        ) : (
                          <span className="member-role">
                            {member.role || "member"}
                          </span>
                        )}

                        {Number(selectedProject.owner_id) === Number(user?.id) && (
                          <button
                            className="delete-task-button"
                            onClick={() =>
                              handleRemoveMember(
                                member.user_id ?? member.id
                              )
                            }
                          >
                            Remove
                          </button>
                        )}

                      </div>

                    </div>

                  ))

                )}

              </div>

            </section>

          ) : (

            <>

              <section className="welcome-section">

                <h2>
                  Welcome
                  {user?.name
                    ? `, ${user.name}`
                    : ""}{" "}
                  👋
                </h2>

                <p>
                  Manage your projects, organize tasks,
                  and collaborate with your team.
                </p>

              </section>

              {message && (
                <div className="success-message">
                  {message}
                </div>
              )}

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <section className="stats-grid">

                <div className="stat-card">

                  <div className="stat-icon blue">
                    📁
                  </div>

                  <div>
                    <span>
                      Total Projects
                    </span>

                    <strong>
                      {projects.length}
                    </strong>
                  </div>

                </div>

                <div className="stat-card">

                  <div className="stat-icon green">
                    ✓
                  </div>

                  <div>
                    <span>
                      Completed Tasks
                    </span>

                    <strong>
                      {completedTasks}
                    </strong>
                  </div>

                </div>

                <div className="stat-card">

                  <div className="stat-icon orange">
                    ⏳
                  </div>

                  <div>
                    <span>
                      In Progress
                    </span>

                    <strong>
                      {inProgressTasks}
                    </strong>
                  </div>

                </div>

                <div className="stat-card">

                  <div className="stat-icon purple">
                    📋
                  </div>

                  <div>
                    <span>
                      Total Tasks
                    </span>

                    <strong>
                      {allTasks.length}
                    </strong>
                  </div>

                </div>

                <div className="stat-card">

                  <div className="stat-icon red">
                    !
                  </div>

                  <div>
                    <span>
                      High Priority
                    </span>

                    <strong>
                      {highPriorityTasks}
                    </strong>
                  </div>

                </div>

                <div className="stat-card">

                  <div className="stat-icon red">
                    !
                  </div>

                  <div>
                    <span>
                      Overdue Tasks
                    </span>

                    <strong>
                      {overdueTasks}
                    </strong>
                  </div>

                </div>

                <div className="stat-card">

                  <div className="stat-icon yellow">
                    !
                  </div>

                  <div>
                    <span>
                      Due Soon
                    </span>

                    <strong>
                      {dueSoonTasks}
                    </strong>
                  </div>

                </div>

              </section>

              <section className="dashboard-content">

                <div className="content-card">

                  <div className="card-header">

                    <div>

                      <h3>
                        Recent Tasks
                      </h3>

                      <p>
                        Your latest project tasks
                      </p>

                    </div>

                    <span>
                      {todoTasks} To Do
                    </span>

                  </div>

                  {allTasks.length === 0 ? (

                    <div className="empty-projects">

                      <div className="project-icon">
                        ✓
                      </div>

                      <strong>
                        No tasks yet
                      </strong>

                      <span>
                        Create a task inside a project.
                      </span>

                    </div>

                  ) : (

                    allTasks.slice(0, 5).map((task) => (

                      <div
                        className="task-row"
                        key={task.id}
                      >

                        <div className="task-info">

                          <div className="task-check">
                            ✓
                          </div>

                          <div>

                            <strong>
                              {task.title}
                            </strong>

                            <span>
                              {task.description ||
                                "No description"}
                            </span>

                            <small>
                              Assigned to:{" "}
                              {task.assigned_name ||
                                "Unassigned"}
                            </small>

                          </div>

                        </div>

                        <span
                          className={`status-badge ${
                            task.status ===
                            "completed"
                              ? "completed"
                              : task.status ===
                                "in_progress"
                              ? "in-progress"
                              : "todo"
                          }`}
                        >
                          {task.status ===
                          "in_progress"
                            ? "In Progress"
                            : task.status ===
                              "completed"
                            ? "Completed"
                            : "To Do"}
                        </span>

                      </div>

                    ))

                  )}

                </div>

                <div className="content-card projects-dashboard-section">

                  <div className="card-header">

                    <div>

                      <h3>
                        Projects
                      </h3>

                      <p>
                        Your current projects
                      </p>

                    </div>

                    <button
                      className="add-button"
                      onClick={() => {
                        if (showProjectForm) {
                          cancelProjectForm();
                        } else {
                          setEditingProjectId(null);

                          setProjectForm({
                            name: "",
                            description: "",
                          });

                          setShowProjectForm(true);
                          setMessage("");
                          setError("");
                        }
                      }}
                    >
                      {showProjectForm
                        ? "Cancel"
                        : "+ New"}
                    </button>

                  </div>

                  {showProjectForm && (

                    <form
                      className="project-form"
                      onSubmit={handleSaveProject}
                    >

                      <h3>
                        {editingProjectId
                          ? "Edit Project"
                          : "Create Project"}
                      </h3>

                      <div className="form-group">

                        <label htmlFor="project-name">
                          Project Name
                        </label>

                        <input
                          id="project-name"
                          type="text"
                          name="name"
                          placeholder="Enter project name"
                          value={projectForm.name}
                          onChange={handleProjectChange}
                          required
                        />

                      </div>

                      <div className="form-group">

                        <label htmlFor="project-description">
                          Description
                        </label>

                        <textarea
                          id="project-description"
                          name="description"
                          placeholder="Enter project description"
                          value={projectForm.description}
                          onChange={handleProjectChange}
                          rows="4"
                        />

                      </div>

                      <div className="project-form-actions">

                        <button
                          type="button"
                          className="cancel-button"
                          onClick={cancelProjectForm}
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          className="create-button"
                        >
                          {editingProjectId
                            ? "Update Project"
                            : "Create Project"}
                        </button>

                      </div>

                    </form>

                  )}

                  {projectsLoading ? (

                    <div className="empty-projects">

                      <div className="project-icon">
                        ⏳
                      </div>

                      <strong>
                        Loading projects...
                      </strong>

                      <span>
                        Please wait while your projects are being loaded.
                      </span>

                    </div>

                  ) : projects.length === 0 &&
                  !showProjectForm ? (

                    <div className="empty-projects">

                      <div className="project-icon">
                        📁
                      </div>

                      <strong>
                        No projects yet
                      </strong>

                      <span>
                        Create your first project to
                        get started.
                      </span>

                    </div>

                  ) : (

                    projects.map((project) => (

                      <div
                        className="project-card"
                        key={project.id}
                      >

                        <button
                          className="project-card-main"
                          onClick={() =>
                            loadProjectDetails(
                              project.id
                            )
                          }
                        >

                          <div className="project-icon">
                            📁
                          </div>

                          <div className="project-details">

                            <strong>
                              {project.name}
                            </strong>

                            <span>
                              {project.description ||
                                "No description available."}
                            </span>

                          </div>

                        </button>

                        <div className="project-card-actions">

                          <button
                            className="edit-project-button"
                            onClick={() =>
                              startEditProject(project)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="delete-project-button"
                            onClick={() =>
                              handleDeleteProject(
                                project.id
                              )
                            }
                          >
                            Delete
                          </button>

                        </div>

                      </div>

                    ))

                  )}

                </div>

              </section>

              <section className="content-card my-tasks-dashboard-section">

                <div className="card-header">
                  <div>
                    <h3>My Tasks</h3>
                    <p>Tasks assigned to you across your projects</p>
                  </div>
                  <span>{allTasks.filter((task) => Number(task.assigned_to) === Number(user?.id)).length} Assigned</span>
                </div>

                {(() => {
                  const myTasks = allTasks.filter(
                    (task) => Number(task.assigned_to) === Number(user?.id)
                  );

                  if (myTasks.length === 0) {
                    return (
                      <div className="empty-projects">
                        <div className="project-icon">✓</div>
                        <strong>No tasks assigned to you</strong>
                        <span>Tasks assigned to your account will appear here.</span>
                      </div>
                    );
                  }

                  return myTasks.map((task) => (
                    <div className="task-row" key={`my-task-${task.id}`}>
                      <div className="task-info">
                        <div className="task-check">✓</div>
                        <div>
                          <strong>{task.title}</strong>
                          <span>{task.description || "No description"}</span>
                          <small>Due: {task.due_date || "No due date"}</small>
                        </div>
                      </div>

                      <div className="task-actions">
                        <span
                          className={`status-badge ${
                            task.status === "completed"
                              ? "completed"
                              : task.status === "in_progress"
                              ? "in-progress"
                              : "todo"
                          }`}
                        >
                          {task.status === "in_progress"
                            ? "In Progress"
                            : task.status === "completed"
                            ? "Completed"
                            : "To Do"}
                        </span>

                        {isTaskOverdue(task) && (
                          <span className="status-badge todo">Overdue</span>
                        )}

                        {isTaskDueSoon(task) && (
                          <span className="status-badge todo">Due Soon</span>
                        )}
                      </div>
                    </div>
                  ));
                })()}

              </section>

              <section className="content-card team-dashboard-section">

                <div className="card-header">
                  <div>
                    <h3>Team</h3>
                    <p>People working across your projects</p>
                  </div>
                  <span>{teamMembers.length} Members</span>
                </div>

                {teamLoading ? (
                  <div className="empty-projects">
                    <div className="project-icon">⏳</div>
                    <strong>Loading team...</strong>
                    <span>Please wait while your project teams are loaded.</span>
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="empty-projects">
                    <div className="project-icon">👥</div>
                    <strong>No team members yet</strong>
                    <span>Add members to your projects to see them here.</span>
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <div
                      className="member-row"
                      key={`${member.project_id}-${member.user_id}`}
                    >
                      <div className="member-info">
                        <div className="user-avatar">
                          {(member.name || member.user_name || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div>
                          <strong>
                            {member.name ||
                              member.user_name ||
                              `User ${member.user_id}`}
                          </strong>
                          <span>
                            {member.email ||
                              member.user_email ||
                              "TaskFlow user"}
                          </span>
                        </div>
                      </div>

                      <div className="member-actions">
                        <span className="member-role">
                          {member.role || "member"}
                        </span>
                        <span className="member-role">
                          {member.project_name || "Project"}
                        </span>
                      </div>
                    </div>
                  ))
                )}

              </section>

            </>

          )}

        </main>
      </div>
    );
  }

  return (
    <div className="app">

      <div className="auth-container">

        <div className="brand-section">

          <div className="logo">
            T
          </div>

          <h1>
            TaskFlow
          </h1>

          <p>
            Manage projects, tasks, and team
            collaboration in one simple workspace.
          </p>

        </div>

        <div className="auth-card">

          <div className="auth-header">

            <h2>
              {isLogin
                ? "Welcome Back"
                : "Create Account"}
            </h2>

            <p>
              {isLogin
                ? "Login to continue to your TaskFlow workspace."
                : "Create your TaskFlow account to get started."}
            </p>

          </div>

          {message && (
            <div className="success-message">
              {message}
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {isLogin ? (

            <form onSubmit={handleLoginSubmit}>

              <div className="form-group">

                <label htmlFor="login-email">
                  Email
                </label>

                <input
                  id="login-email"
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={loginForm.email}
                  onChange={handleLoginChange}
                  required
                />

              </div>

              <div className="form-group">

                <label htmlFor="login-password">
                  Password
                </label>

                <input
                  id="login-password"
                  type="password"
                  name="password"
                  placeholder="Enter your password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  required
                />

              </div>

              <button
                type="submit"
                className="auth-button"
              >
                Login
              </button>

            </form>

          ) : (

            <form onSubmit={handleRegisterSubmit}>

              <div className="form-group">

                <label htmlFor="register-name">
                  Name
                </label>

                <input
                  id="register-name"
                  type="text"
                  name="name"
                  placeholder="Enter your name"
                  value={registerForm.name}
                  onChange={handleRegisterChange}
                  required
                />

              </div>

              <div className="form-group">

                <label htmlFor="register-email">
                  Email
                </label>

                <input
                  id="register-email"
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={registerForm.email}
                  onChange={handleRegisterChange}
                  required
                />

              </div>

              <div className="form-group">

                <label htmlFor="register-password">
                  Password
                </label>

                <input
                  id="register-password"
                  type="password"
                  name="password"
                  placeholder="Create a password"
                  value={registerForm.password}
                  onChange={handleRegisterChange}
                  required
                />

              </div>

              <button
                type="submit"
                className="auth-button"
              >
                Create Account
              </button>

            </form>

          )}

          <div className="switch-auth">

            <span>
              {isLogin
                ? "Don't have an account?"
                : "Already have an account?"}
            </span>

            <button
              type="button"
              onClick={switchAuthMode}
              className="switch-button"
            >
              {isLogin
                ? "Register"
                : "Login"}
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}

export default App;
