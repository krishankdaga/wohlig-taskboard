import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

const Admin = () => {
  const { user: loggedInUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("project");

  const [projectType, setProjectType] = useState("main");

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    parentProject: "",
    members: []
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    project: "",
    assignedTo: [],
    priority: "medium",
    dueDate: "",
    labels: []
  });

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee"
  });

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [editProjectMembers, setEditProjectMembers] = useState([]);

  const fetchArchivedTasks = async () => {
    try {
      const { data } = await API.get("/tasks/archived");
      setArchivedTasks(data);
    } catch (error) {
      console.log("Could not load archived tasks");
    }
  };

  const fetchData = async () => {
    const usersRes = await API.get("/auth/users");
    const projectsRes = await API.get("/projects");

    setUsers(usersRes.data);
    setProjects(projectsRes.data);
    fetchArchivedTasks();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const projectOptions = useMemo(() => {
    const map = {};
    const roots = [];

    projects.forEach((project) => {
      map[project._id] = {
        ...project,
        children: []
      };
    });

    projects.forEach((project) => {
      const parentId = project.parentProject?._id || project.parentProject;

      if (parentId && map[parentId]) {
        map[parentId].children.push(map[project._id]);
      } else {
        roots.push(map[project._id]);
      }
    });

    const flattened = [];

    const walk = (project, level = 0) => {
      flattened.push({
        _id: project._id,
        name: `${"— ".repeat(level)}${project.name}`,
        rawName: project.name,
        level
      });

      project.children.forEach((child) => walk(child, level + 1));
    };

    roots.forEach((root) => walk(root));

    return flattened;
  }, [projects]);

  const selectedProject = useMemo(() => {
    return projects.find((project) => project._id === selectedProjectId);
  }, [projects, selectedProjectId]);

  const createProject = async (e) => {
    e.preventDefault();

    try {
      await API.post("/projects", {
        ...projectForm,
        parentProject:
          projectType === "main" ? null : projectForm.parentProject,
        members: projectForm.members
      });

      setProjectForm({
        name: "",
        description: "",
        parentProject: "",
        members: []
      });

      setProjectType("main");
      await fetchData();
      alert("Project created successfully");
    } catch (error) {
      alert(error.response?.data?.message || "Could not create project");
    }
  };

  const createTask = async (e) => {
    e.preventDefault();

    if (taskForm.assignedTo.length === 0) {
      alert("Please assign at least one employee");
      return;
    }

    try {
      await API.post("/tasks", taskForm);

      setTaskForm({
        title: "",
        description: "",
        project: "",
        assignedTo: [],
        priority: "medium",
        dueDate: "",
        labels: []
      });

      alert("Task created successfully");
    } catch (error) {
      alert(error.response?.data?.message || "Could not create task");
    }
  };

  const createUser = async (e) => {
    e.preventDefault();

    try {
      await API.post("/auth/create-user", userForm);

      setUserForm({
        name: "",
        email: "",
        password: "",
        role: "employee"
      });

      await fetchData();
      alert("User created successfully");
    } catch (error) {
      alert(error.response?.data?.message || "Could not create user");
    }
  };

  const updateUserRole = async (userId, role) => {
    try {
      await API.put(`/auth/users/${userId}/role`, { role });
      await fetchData();
      alert("User role updated");
    } catch (error) {
      alert(error.response?.data?.message || "Could not update role");
    }
  };

  const deleteUser = async (userId, userName) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${userName}?`
    );

    if (!confirmDelete) return;

    try {
      await API.delete(`/auth/users/${userId}`);
      await fetchData();
      alert("User deleted successfully");
    } catch (error) {
      alert(error.response?.data?.message || "Could not delete user");
    }
  };

  const downloadReport = async (reportPath, filename) => {
    try {
      const response = await API.get(reportPath, {
        responseType: "blob"
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");

      link.href = blobUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert(error.response?.data?.message || "Could not download report");
    }
  };

  const restoreTask = async (taskId) => {
    try {
      await API.put(`/tasks/${taskId}/restore`);
      await fetchArchivedTasks();
      alert("Task restored successfully");
    } catch (error) {
      alert(error.response?.data?.message || "Could not restore task");
    }
  };

  const permanentlyDeleteTask = async (taskId, taskTitle) => {
    const confirmDelete = window.confirm(
      `Permanently delete "${taskTitle}"?\n\nThis cannot be undone. All comments, checklist items, attachments, and activity logs for this task will be removed.`
    );

    if (!confirmDelete) return;

    try {
      await API.delete(`/tasks/${taskId}`);
      await fetchArchivedTasks();
      alert("Task permanently deleted");
    } catch (error) {
      alert(error.response?.data?.message || "Could not delete task");
    }
  };

  const deleteProject = async (projectId, projectName) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${projectName}"?\n\nSafe delete is enabled. This project will be deleted only if it has no sub-projects and no tasks.`
    );

    if (!confirmDelete) return;

    try {
      await API.delete(`/projects/${projectId}`);
      await fetchData();
      alert("Project deleted successfully");
    } catch (error) {
      alert(error.response?.data?.message || "Could not delete project");
    }
  };

  const toggleMember = (userId) => {
    setProjectForm((prev) => {
      const exists = prev.members.includes(userId);

      return {
        ...prev,
        members: exists
          ? prev.members.filter((id) => id !== userId)
          : [...prev.members, userId]
      };
    });
  };

  const toggleTaskAssignee = (userId) => {
    setTaskForm((prev) => {
      const exists = prev.assignedTo.includes(userId);

      return {
        ...prev,
        assignedTo: exists
          ? prev.assignedTo.filter((id) => id !== userId)
          : [...prev.assignedTo, userId]
      };
    });
  };

  const addTaskLabel = (labelInput) => {
    const label = labelInput.trim();

    if (!label) return;

    setTaskForm((prev) => ({
      ...prev,
      labels: prev.labels.includes(label)
        ? prev.labels
        : [...prev.labels, label]
    }));
  };

  const removeTaskLabel = (label) => {
    setTaskForm((prev) => ({
      ...prev,
      labels: prev.labels.filter((item) => item !== label)
    }));
  };

  const toggleEditProjectMember = (userId) => {
    setEditProjectMembers((prev) => {
      const exists = prev.includes(userId);

      return exists
        ? prev.filter((id) => id !== userId)
        : [...prev, userId];
    });
  };

  const loadProjectMembers = (projectId) => {
    setSelectedProjectId(projectId);

    const project = projects.find((item) => item._id === projectId);

    if (!project) {
      setEditProjectMembers([]);
      return;
    }

    const memberIds = project.members?.map((member) => member._id || member) || [];
    setEditProjectMembers(memberIds);
  };

  const saveProjectMembers = async () => {
    if (!selectedProjectId) {
      alert("Please select a project first");
      return;
    }

    try {
      await API.put(`/projects/${selectedProjectId}`, {
        members: editProjectMembers
      });

      await fetchData();
      alert("Project members updated successfully");
    } catch (error) {
      alert(error.response?.data?.message || "Could not update project members");
    }
  };

  const selectAllEmployees = () => {
    const employeeIds = users.map((user) => user._id);

    setProjectForm((prev) => ({
      ...prev,
      members: employeeIds
    }));
  };

  const clearEmployees = () => {
    setProjectForm((prev) => ({
      ...prev,
      members: []
    }));
  };

  const tabClass = (tab) =>
    `px-4 md:px-5 py-2.5 md:py-3 rounded-2xl text-xs md:text-sm font-bold transition whitespace-nowrap ${
      activeTab === tab
        ? "bg-slate-900 text-white shadow-lg"
        : "bg-white text-slate-500 dark:text-neutral-400 border border-slate-200 hover:bg-slate-50"
    }`;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />

      <main className="flex-1 min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />

        <div className="p-3 sm:p-4 md:p-8 pb-28 lg:pb-8 max-w-7xl mx-auto overflow-hidden">
          <section className="glass-card rounded-3xl md:rounded-[32px] p-4 md:p-8 mb-5 md:mb-8">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
              <div>
                <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                  Admin Control Center
                </p>

                <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">
                  Workspace Setup
                </h1>

                <p className="text-slate-500 dark:text-neutral-400 mt-3 max-w-2xl">
                  Create projects, assign team members, manage users, and keep your workspace clean.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 md:gap-3 w-full xl:w-auto xl:min-w-[360px]">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl md:rounded-3xl p-3 md:p-4">
                  <p className="text-xs font-bold text-blue-600 uppercase">
                    Users
                  </p>
                  <p className="text-xl md:text-3xl font-black text-blue-900 mt-1">
                    {users.length}
                  </p>
                </div>

                <div className="bg-violet-50 border border-violet-100 rounded-2xl md:rounded-3xl p-3 md:p-4">
                  <p className="text-xs font-bold text-violet-600 uppercase">
                    Projects
                  </p>
                  <p className="text-xl md:text-3xl font-black text-violet-900 mt-1">
                    {projects.length}
                  </p>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl md:rounded-3xl p-3 md:p-4">
                  <p className="text-xs font-bold text-emerald-600 uppercase">
                    Admin
                  </p>
                  <p className="text-xl md:text-3xl font-black text-emerald-900 mt-1">
                    OS
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex gap-2 md:gap-3 mb-5 md:mb-6 overflow-x-auto hide-scrollbar pb-3 -mx-1 px-1">
            <button onClick={() => setActiveTab("project")} className={tabClass("project")}>
               Create Project
            </button>

            <button onClick={() => setActiveTab("task")} className={tabClass("task")}>
               Create Task
            </button>

            <button onClick={() => setActiveTab("members")} className={tabClass("members")}>
              Project Members
            </button>

            <button onClick={() => setActiveTab("manage")} className={tabClass("manage")}>
              Manage Projects
            </button>

            <button onClick={() => setActiveTab("archived")} className={tabClass("archived")}>
               Archived Tasks
            </button>

            <button onClick={() => setActiveTab("reports")} className={tabClass("reports")}>
               Reports
            </button>

            <button onClick={() => setActiveTab("users")} className={tabClass("users")}>
               Manage Users
            </button>
          </div>

          {activeTab === "project" && (
            <section className="glass-card rounded-3xl md:rounded-[32px] p-4 md:p-8">
              <div className="flex items-start justify-between gap-5 mb-8">
                <div>
                  <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                    Project Builder
                  </p>
                  <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
                    Create a project
                  </h2>
                  <p className="text-slate-500 dark:text-neutral-400 mt-2">
                    Choose whether this is a main project or a sub-project.
                  </p>
                </div>
              </div>

              <form onSubmit={createProject} className="space-y-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setProjectType("main");
                      setProjectForm({ ...projectForm, parentProject: "" });
                    }}
                    className={`rounded-3xl border p-5 text-left transition ${
                      projectType === "main"
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-slate-200 text-slate-600 dark:text-neutral-400 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-lg font-black">Main Project</p>
                    <p className="text-sm mt-1">Top-level workspace project.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectType("sub")}
                    className={`rounded-3xl border p-5 text-left transition ${
                      projectType === "sub"
                        ? "bg-violet-50 border-violet-300 text-violet-700"
                        : "bg-white border-slate-200 text-slate-600 dark:text-neutral-400 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-lg font-black">Sub Project</p>
                    <p className="text-sm mt-1">Nested under an existing project.</p>
                  </button>
                </div>

                {projectType === "sub" && (
                  <div className="bg-violet-50 border border-violet-100 rounded-3xl p-5">
                    <label className="font-black text-sm mb-2 text-slate-700 dark:text-neutral-300 block">
                      Choose parent project
                    </label>

                    <select
                      value={projectForm.parentProject}
                      onChange={(e) =>
                        setProjectForm({
                          ...projectForm,
                          parentProject: e.target.value
                        })
                      }
                      className="input-modern"
                      required
                    >
                      <option value="">Select where this sub-project belongs</option>

                      {projectOptions.map((project) => (
                        <option key={project._id} value={project._id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <input
                  placeholder="Project name"
                  value={projectForm.name}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, name: e.target.value })
                  }
                  className="input-modern"
                  required
                />

                <textarea
                  placeholder="Brief description"
                  value={projectForm.description}
                  onChange={(e) =>
                    setProjectForm({
                      ...projectForm,
                      description: e.target.value
                    })
                  }
                  className="input-modern min-h-28"
                />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-black text-sm text-slate-700 dark:text-neutral-300">
                      Assign Members
                    </p>

                    <div className="flex gap-4">
                      <button type="button" onClick={selectAllEmployees} className="text-xs font-black text-blue-600">
                        Select all
                      </button>

                      <button type="button" onClick={clearEmployees} className="text-xs font-black text-slate-400 dark:text-neutral-500">
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-auto border border-slate-200 rounded-2xl md:rounded-3xl p-3 md:p-4 bg-slate-50">
                    {users.map((user) => (
                      <label
                        key={user._id}
                        className={`flex items-center justify-between text-sm bg-white p-4 rounded-2xl border cursor-pointer transition ${
                          projectForm.members.includes(user._id)
                            ? "border-blue-300 bg-blue-50"
                            : "border-slate-100 hover:border-blue-200"
                        }`}
                      >
                        <span>
                          <span className="font-black text-slate-800">{user.name}</span>
                          <span className="text-slate-400 dark:text-neutral-500"> · {user.role}</span>
                        </span>

                        <input
                          type="checkbox"
                          checked={projectForm.members.includes(user._id)}
                          onChange={() => toggleMember(user._id)}
                          className="h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="btn-primary min-w-64">
                    Create Project
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === "task" && (
            <section className="glass-card rounded-3xl md:rounded-[32px] p-4 md:p-8">
              <div className="mb-8">
                <p className="text-sm font-black text-violet-600 uppercase tracking-wider">
                  Task Creator
                </p>
                <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
                  Create a task
                </h2>
                <p className="text-slate-500 dark:text-neutral-400 mt-2">
                  Assign one task to multiple employees.
                </p>
              </div>

              <form onSubmit={createTask} className="space-y-6 max-w-5xl">
                <input
                  placeholder="Task title"
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, title: e.target.value })
                  }
                  className="input-modern"
                  required
                />

                <textarea
                  placeholder="Describe what needs to be done"
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, description: e.target.value })
                  }
                  className="input-modern min-h-32"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
                  <select
                    value={taskForm.project}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, project: e.target.value })
                    }
                    className="input-modern"
                    required
                  >
                    <option value="">Select project or sub-project</option>
                    {projectOptions.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={taskForm.priority}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, priority: e.target.value })
                    }
                    className="input-modern"
                  >
                    <option value="low">Low priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="high">High priority</option>
                  </select>

                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, dueDate: e.target.value })
                    }
                    className="input-modern"
                  />
                </div>

                <div>
                  <p className="font-black text-sm text-slate-700 dark:text-neutral-300 mb-3">
                    Labels
                  </p>

                  <input
                    placeholder="Type label and press Enter, e.g. Backend"
                    className="input-modern"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTaskLabel(e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                  />

                  <div className="flex flex-wrap gap-2 mt-3">
                    {taskForm.labels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-2 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-black px-3 py-2 rounded-full"
                      >
                        {label}
                        <button
                          type="button"
                          onClick={() => removeTaskLabel(label)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-black text-sm text-slate-700 dark:text-neutral-300 mb-3">
                    Assign Employees
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-auto border border-slate-200 rounded-2xl md:rounded-3xl p-3 md:p-4 bg-slate-50">
                    {users.map((user) => (
                      <label
                        key={user._id}
                        className={`flex items-center justify-between text-sm bg-white p-4 rounded-2xl border cursor-pointer transition ${
                          taskForm.assignedTo.includes(user._id)
                            ? "border-violet-300 bg-violet-50"
                            : "border-slate-100 hover:border-violet-200"
                        }`}
                      >
                        <span>
                          <span className="font-black text-slate-800">{user.name}</span>
                          <span className="text-slate-400 dark:text-neutral-500"> · {user.role}</span>
                        </span>

                        <input
                          type="checkbox"
                          checked={taskForm.assignedTo.includes(user._id)}
                          onChange={() => toggleTaskAssignee(user._id)}
                          className="h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>

                  <p className="text-sm text-slate-500 dark:text-neutral-400 mt-2">
                    {taskForm.assignedTo.length} employee(s) selected.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button className="btn-primary min-w-56">
                    Create Task
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === "members" && (
            <section className="glass-card rounded-3xl md:rounded-[32px] p-4 md:p-8">
              <div className="mb-8">
                <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                  Project Members
                </p>
                <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
                  Edit project members
                </h2>
                <p className="text-slate-500 dark:text-neutral-400 mt-2">
                  Add or remove employees from existing projects.
                </p>
              </div>

              <div className="max-w-5xl space-y-6">
                <select
                  value={selectedProjectId}
                  onChange={(e) => loadProjectMembers(e.target.value)}
                  className="input-modern"
                >
                  <option value="">Select project to edit members</option>
                  {projectOptions.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                {selectedProject && (
                  <>
                    <div className="rounded-3xl bg-blue-50 border border-blue-100 p-5">
                      <p className="text-sm font-black text-blue-700">
                        Editing: {selectedProject.name}
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        {editProjectMembers.length} member(s) selected.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-auto border border-slate-200 rounded-2xl md:rounded-3xl p-3 md:p-4 bg-slate-50">
                      {users.map((user) => (
                        <label
                          key={user._id}
                          className={`flex items-center justify-between text-sm bg-white p-4 rounded-2xl border cursor-pointer transition ${
                            editProjectMembers.includes(user._id)
                              ? "border-blue-300 bg-blue-50"
                              : "border-slate-100 hover:border-blue-200"
                          }`}
                        >
                          <span>
                            <span className="font-black text-slate-800">{user.name}</span>
                            <span className="text-slate-400 dark:text-neutral-500"> · {user.role}</span>
                          </span>

                          <input
                            type="checkbox"
                            checked={editProjectMembers.includes(user._id)}
                            onChange={() => toggleEditProjectMember(user._id)}
                            className="h-4 w-4"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <button onClick={saveProjectMembers} className="btn-primary min-w-56">
                        Save Members
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {activeTab === "manage" && (
            <section className="glass-card rounded-3xl md:rounded-[32px] p-4 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8">
                <div>
                  <p className="text-sm font-black text-red-500 uppercase tracking-wider">
                    Project Management
                  </p>
                  <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
                    Manage projects
                  </h2>
                  <p className="text-slate-500 dark:text-neutral-400 mt-2">
                    Delete empty projects safely.
                  </p>
                </div>

                <button
                  onClick={fetchData}
                  className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 dark:text-neutral-400 hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>

              <div className="space-y-3">
                {projectOptions.map((project) => (
                  <div
                    key={project._id}
                    className="flex items-center justify-between gap-4 bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-3xl px-5 py-4 hover:shadow-sm transition"
                  >
                    <div>
                      <p className="text-sm font-black text-slate-800">
                        {project.name}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">
                        {project.level === 0
                          ? "Main Project"
                          : `Sub Project · Level ${project.level}`}
                      </p>
                    </div>

                    <button
                      onClick={() => deleteProject(project._id, project.rawName)}
                      className="px-4 py-2 rounded-2xl bg-red-50 text-red-600 border border-red-100 text-xs font-black hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "archived" && (
            <section className="glass-card rounded-3xl md:rounded-[32px] p-4 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8">
                <div>
                  <p className="text-sm font-black text-amber-600 uppercase tracking-wider">
                    Archived Tasks
                  </p>
                  <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
                    Restore archived tasks
                  </h2>
                  <p className="text-slate-500 dark:text-neutral-400 mt-2">
                    Archived tasks are hidden from the board but their data is preserved.
                  </p>
                </div>

                <button
                  onClick={fetchArchivedTasks}
                  className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 dark:text-neutral-400 hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>

              {archivedTasks.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center">
                  <p className="text-slate-400 dark:text-neutral-500 font-bold">
                    No archived tasks yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {archivedTasks.map((task) => (
                    <div
                      key={task._id}
                      className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-3xl p-5 hover:shadow-sm transition"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            {task.taskCode && (
                              <span className="text-xs font-black bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-full">
                                {task.taskCode}
                              </span>
                            )}

                            <h3 className="font-black text-slate-900 dark:text-white">
                              {task.title}
                            </h3>
                          </div>

                          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-2">
                            {task.project?.name || "No project"} ·{" "}
                            {task.assignedTo?.map((employee) => employee.name).join(", ")}
                          </p>

                          <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">
                            Archived{" "}
                            {task.archivedAt
                              ? new Date(task.archivedAt).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })
                              : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => restoreTask(task._id)}
                            className="px-4 py-2 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-sm font-black hover:bg-emerald-100"
                          >
                            Restore
                          </button>

                          <button
                            onClick={() =>
                              permanentlyDeleteTask(task._id, task.title)
                            }
                            className="px-4 py-2 rounded-2xl bg-red-50 text-red-600 border border-red-100 text-sm font-black hover:bg-red-100"
                          >
                            Delete Forever
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "reports" && (
            <section className="glass-card rounded-3xl md:rounded-[32px] p-4 md:p-8">
              <div className="mb-8">
                <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                  Reports
                </p>
                <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
                  Export workspace data
                </h2>
                <p className="text-slate-500 dark:text-neutral-400 mt-2">
                  Download CSV reports for tasks, users, and projects.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl md:rounded-3xl p-4 md:p-6">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl mb-5">
                    
                  </div>

                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Active Tasks
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-neutral-400 mt-2">
                    Export all active non-archived tasks with project, assignees, status, priority, labels, and progress.
                  </p>

                  <button
                    onClick={() =>
                      downloadReport("/reports/tasks", "active-tasks.csv")
                    }
                    className="btn-primary w-full mt-5"
                  >
                    Download CSV
                  </button>
                </div>

                <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl md:rounded-3xl p-4 md:p-6">
                  <div className="h-12 w-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center text-2xl mb-5">
                    
                  </div>

                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Overdue Tasks
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-neutral-400 mt-2">
                    Export tasks that are overdue and not closed, sorted by due date.
                  </p>

                  <button
                    onClick={() =>
                      downloadReport(
                        "/reports/tasks/overdue",
                        "overdue-tasks.csv"
                      )
                    }
                    className="btn-primary w-full mt-5"
                  >
                    Download CSV
                  </button>
                </div>

                <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl md:rounded-3xl p-4 md:p-6">
                  <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-2xl mb-5">
                    
                  </div>

                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Archived Tasks
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-neutral-400 mt-2">
                    Export archived tasks for audit and backup purposes.
                  </p>

                  <button
                    onClick={() =>
                      downloadReport(
                        "/reports/tasks/archived",
                        "archived-tasks.csv"
                      )
                    }
                    className="btn-primary w-full mt-5"
                  >
                    Download CSV
                  </button>
                </div>

                <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl md:rounded-3xl p-4 md:p-6">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-2xl mb-5">
                    
                  </div>

                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Users
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-neutral-400 mt-2">
                    Export all users with name, email, role, and creation date.
                  </p>

                  <button
                    onClick={() =>
                      downloadReport("/reports/users", "users.csv")
                    }
                    className="btn-primary w-full mt-5"
                  >
                    Download CSV
                  </button>
                </div>

                <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl md:rounded-3xl p-4 md:p-6">
                  <div className="h-12 w-12 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center text-2xl mb-5">
                    
                  </div>

                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Projects
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-neutral-400 mt-2">
                    Export projects, parent projects, members, and descriptions.
                  </p>

                  <button
                    onClick={() =>
                      downloadReport("/reports/projects", "projects.csv")
                    }
                    className="btn-primary w-full mt-5"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === "users" && (
            <section className="glass-card rounded-3xl md:rounded-[32px] p-4 md:p-8">
              <div className="mb-8">
                <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                  User Management
                </p>
                <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
                  Manage users
                </h2>
                <p className="text-slate-500 dark:text-neutral-400 mt-2">
                  Create users, assign roles, and remove accounts.
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-8">
                <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl md:rounded-3xl p-4 md:p-6">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-5">
                    Create new user
                  </h3>

                  <form onSubmit={createUser} className="space-y-4">
                    <input
                      placeholder="Full name"
                      value={userForm.name}
                      onChange={(e) =>
                        setUserForm({ ...userForm, name: e.target.value })
                      }
                      className="input-modern"
                      required
                    />

                    <input
                      type="email"
                      placeholder="employee@wohlig.com"
                      value={userForm.email}
                      onChange={(e) =>
                        setUserForm({ ...userForm, email: e.target.value })
                      }
                      className="input-modern"
                      required
                    />

                    <input
                      type="text"
                      placeholder="Temporary password"
                      value={userForm.password}
                      onChange={(e) =>
                        setUserForm({ ...userForm, password: e.target.value })
                      }
                      className="input-modern"
                      required
                    />

                    <select
                      value={userForm.role}
                      onChange={(e) =>
                        setUserForm({ ...userForm, role: e.target.value })
                      }
                      className="input-modern"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>

                    <button className="btn-primary w-full">
                      Create User
                    </button>
                  </form>
                </div>

                <div className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl md:rounded-3xl p-4 md:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                      Existing users
                    </h3>

                    <button
                      onClick={fetchData}
                      className="px-4 py-2 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs font-black text-slate-600 dark:text-neutral-400"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[520px] overflow-auto">
                    {users.map((appUser) => (
                      <div
                        key={appUser._id}
                        className="bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl md:rounded-3xl p-3 md:p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-black text-slate-900 dark:text-white">
                              {appUser.name}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-neutral-400">
                              {appUser.email}
                            </p>
                            {appUser._id === loggedInUser?._id && (
                              <p className="text-xs text-blue-600 font-bold mt-1">
                                Current logged-in admin
                              </p>
                            )}
                          </div>

                          <span className="text-xs font-black capitalize bg-white border border-slate-200 rounded-full px-3 py-1">
                            {appUser.role}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                          <select
                            value={appUser.role}
                            onChange={(e) =>
                              updateUserRole(appUser._id, e.target.value)
                            }
                            disabled={appUser._id === loggedInUser?._id}
                            className="input-modern disabled:opacity-50"
                          >
                            <option value="employee">Employee</option>
                            <option value="admin">Admin</option>
                          </select>

                          <Link
                            to={`/admin/users/${appUser._id}`}
                            className="px-4 py-2 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 text-sm font-black hover:bg-blue-100 text-center flex items-center justify-center"
                          >
                            View Profile
                          </Link>

                          <button
                            onClick={() => deleteUser(appUser._id, appUser.name)}
                            disabled={appUser._id === loggedInUser?._id}
                            className="px-4 py-2 rounded-2xl bg-red-50 text-red-600 border border-red-100 text-sm font-black hover:bg-red-100 disabled:opacity-50"
                          >
                            Delete User
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default Admin;
