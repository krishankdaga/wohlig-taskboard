import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useSearchParams } from "react-router-dom";
import API from "../api/axios";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import TaskCard from "../components/TaskCard";
import { useAuth } from "../context/AuthContext";
import socket from "../api/socket";

const statuses = [
  { id: "backlog", title: "Backlog", icon: "🧊" },
  { id: "todo", title: "To Do", icon: "" },
  { id: "in_progress", title: "In Progress", icon: "IP" },
  { id: "review", title: "Review", icon: "RV" },
  { id: "closed", title: "Closed", icon: "" }
];

const formatFullDate = (date) => {
  if (!date) return "No due date";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
};

const toDateInputValue = (date) => {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
};

const Board = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlProjectId = searchParams.get("project") || "all";
  const urlTaskId = searchParams.get("task");

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  const [scope, setScope] = useState("all");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState(urlProjectId);
  const [showFilters, setShowFilters] = useState(false);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTaskTab, setActiveTaskTab] = useState("overview");
  const [commentText, setCommentText] = useState("");
  const [checklistText, setChecklistText] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    project: "",
    assignedTo: [],
    priority: "medium",
    dueDate: "",
    labels: []
  });

  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    project: "",
    assignedTo: [],
    status: "backlog",
    priority: "medium",
    dueDate: "",
    labels: []
  });

  const fetchTasks = async () => {
    const { data } = await API.get(`/tasks?scope=${scope}`);
    setTasks(data);
  };

  const fetchBoardData = async () => {
    await fetchTasks();

    const projectsRes = await API.get("/projects");
    setProjects(projectsRes.data);

    if (user?.role === "admin") {
      const usersRes = await API.get("/auth/users");
      setUsers(usersRes.data);
    }
  };

  useEffect(() => {
    fetchBoardData();
  }, []);

  useEffect(() => {
    const refreshBoard = async () => {
      try {
        await fetchBoardData();
      } catch (error) {
        console.log("Could not refresh board after live update");
      }
    };

    socket.on("connect", () => {
      console.log("Board socket connected:", socket.id);
    });

    socket.on("taskCreated", async (newTask) => {
      setTasks((prev) => {
        const exists = prev.some((task) => task._id === newTask._id);
        if (exists) return prev;
        return [newTask, ...prev];
      });

      await refreshBoard();
    });

    socket.on("taskUpdated", async (updatedTask) => {
      setTasks((prev) =>
        prev.map((task) =>
          task._id === updatedTask._id ? updatedTask : task
        )
      );

      setSelectedTask((prev) =>
        prev && prev._id === updatedTask._id ? updatedTask : prev
      );

      await refreshBoard();
    });

    socket.on("taskDeleted", async ({ taskId }) => {
      setTasks((prev) => prev.filter((task) => task._id !== taskId));

      setSelectedTask((prev) =>
        prev && prev._id === taskId ? null : prev
      );

      await refreshBoard();
    });

    socket.on("taskArchived", async ({ taskId }) => {
      setTasks((prev) => prev.filter((task) => task._id !== taskId));

      setSelectedTask((prev) =>
        prev && prev._id === taskId ? null : prev
      );

      await refreshBoard();
    });

    socket.on("taskRestored", async (restoredTask) => {
      setTasks((prev) => {
        const exists = prev.some((task) => task._id === restoredTask._id);
        if (exists) {
          return prev.map((task) =>
            task._id === restoredTask._id ? restoredTask : task
          );
        }

        return [restoredTask, ...prev];
      });

      await refreshBoard();
    });

    return () => {
      socket.off("connect");
      socket.off("taskCreated");
      socket.off("taskUpdated");
      socket.off("taskDeleted");
      socket.off("taskArchived");
      socket.off("taskRestored");
    };
  }, [scope, projectFilter]);

  useEffect(() => {
    fetchTasks();
  }, [scope]);

  useEffect(() => {
    setProjectFilter(urlProjectId);
  }, [urlProjectId]);

  useEffect(() => {
    if (!urlTaskId || tasks.length === 0) return;

    const taskToOpen = tasks.find((task) => task._id === urlTaskId);

    if (taskToOpen) {
      openTaskDetail(taskToOpen);
    }
  }, [urlTaskId, tasks]);

  const selectedProjectName = useMemo(() => {
    if (projectFilter === "all") return "All Projects";
    return (
      projects.find((project) => project._id === projectFilter)?.name ||
      "Selected Project"
    );
  }, [projectFilter, projects]);

  const selectedProjectAndChildren = useMemo(() => {
    if (projectFilter === "all") return [];

    const ids = new Set([projectFilter]);
    let changed = true;

    while (changed) {
      changed = false;

      projects.forEach((project) => {
        const parentId = project.parentProject?._id || project.parentProject;

        if (parentId && ids.has(parentId) && !ids.has(project._id)) {
          ids.add(project._id);
          changed = true;
        }
      });
    }

    return Array.from(ids);
  }, [projectFilter, projects]);

  const availableLabels = useMemo(() => {
    const labelSet = new Set();

    tasks.forEach((task) => {
      (task.labels || []).forEach((label) => labelSet.add(label));
    });

    return Array.from(labelSet).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.taskCode?.toLowerCase().includes(search.toLowerCase()) ||
        task.title?.toLowerCase().includes(search.toLowerCase()) ||
        task.description?.toLowerCase().includes(search.toLowerCase()) ||
        (Array.isArray(task.assignedTo)
          ? task.assignedTo.some((employee) =>
              employee.name?.toLowerCase().includes(search.toLowerCase())
            )
          : task.assignedTo?.name?.toLowerCase().includes(search.toLowerCase())) ||
        task.project?.name?.toLowerCase().includes(search.toLowerCase()) ||
        (task.labels || []).some((label) =>
          label.toLowerCase().includes(search.toLowerCase())
        );

      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;

      const matchesProject =
        projectFilter === "all" ||
        selectedProjectAndChildren.includes(task.project?._id);

      let matchesDue = true;

      if (dueFilter !== "all") {
        const todayForFilter = new Date();
        todayForFilter.setHours(0, 0, 0, 0);

        const tomorrowForFilter = new Date(todayForFilter);
        tomorrowForFilter.setDate(tomorrowForFilter.getDate() + 1);

        if (dueFilter === "none") {
          matchesDue = !task.dueDate;
        } else if (!task.dueDate || task.status === "closed") {
          matchesDue = false;
        } else {
          const due = new Date(task.dueDate);
          due.setHours(0, 0, 0, 0);

          if (dueFilter === "overdue") {
            matchesDue = due < todayForFilter;
          }

          if (dueFilter === "today") {
            matchesDue = due.getTime() === todayForFilter.getTime();
          }

          if (dueFilter === "tomorrow") {
            matchesDue = due.getTime() === tomorrowForFilter.getTime();
          }
        }
      }

      const matchesLabel =
        labelFilter === "all" || (task.labels || []).includes(labelFilter);

      return (
        matchesSearch &&
        matchesPriority &&
        matchesProject &&
        matchesDue &&
        matchesLabel
      );
    });
  }, [
    tasks,
    search,
    priorityFilter,
    dueFilter,
    labelFilter,
    projectFilter,
    selectedProjectAndChildren
  ]);

  const getTasksByStatus = (status) => {
    return filteredTasks.filter((task) => task.status === status);
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const oldTasks = [...tasks];

    setTasks((prev) =>
      prev.map((task) =>
        task._id === draggableId
          ? { ...task, status: destination.droppableId }
          : task
      )
    );

    try {
      await API.put(`/tasks/${draggableId}/status`, {
        status: destination.droppableId
      });
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "You can move only tasks assigned to you."
      );
      setTasks(oldTasks);
    }
  };

  const createTask = async (e) => {
    e.preventDefault();

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

      setShowTaskModal(false);
      fetchTasks();
    } catch (error) {
      alert(error.response?.data?.message || "Could not create task");
    }
  };

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setIsEditing(false);
    setActiveTaskTab("overview");

    setEditForm({
      title: task.title || "",
      description: task.description || "",
      project: task.project?._id || "",
      assignedTo: Array.isArray(task.assignedTo)
        ? task.assignedTo.map((employee) => employee._id)
        : task.assignedTo?._id
        ? [task.assignedTo._id]
        : [],
      status: task.status || "backlog",
      priority: task.priority || "medium",
      dueDate: toDateInputValue(task.dueDate),
      labels: task.labels || []
    });
  };

  const updateTask = async (e) => {
    e.preventDefault();

    try {
      const { data } = await API.put(`/tasks/${selectedTask._id}`, editForm);

      setTasks((prev) =>
        prev.map((task) => (task._id === data._id ? data : task))
      );

      setSelectedTask(data);
      setIsEditing(false);
    } catch (error) {
      alert(error.response?.data?.message || "Could not update task");
    }
  };

  const archiveTask = async () => {
    const confirmArchive = window.confirm(
      "Archive this task? It will be hidden from the board but can be restored from Admin Panel."
    );

    if (!confirmArchive) return;

    try {
      await API.put(`/tasks/${selectedTask._id}/archive`);

      setTasks((prev) => prev.filter((task) => task._id !== selectedTask._id));
      setSelectedTask(null);
      setIsEditing(false);
    } catch (error) {
      alert(error.response?.data?.message || "Could not archive task");
    }
  };

  const addChecklistItem = async (e) => {
    e.preventDefault();

    if (!checklistText.trim() || !selectedTask) return;

    try {
      const { data } = await API.post(`/tasks/${selectedTask._id}/checklist`, {
        text: checklistText
      });

      setTasks((prev) =>
        prev.map((task) => (task._id === data._id ? data : task))
      );

      setSelectedTask(data);
      setChecklistText("");
    } catch (error) {
      alert(error.response?.data?.message || "Could not add checklist item");
    }
  };

  const toggleChecklistItem = async (itemId, isDone) => {
    try {
      const { data } = await API.put(
        `/tasks/${selectedTask._id}/checklist/${itemId}`,
        {
          isDone
        }
      );

      setTasks((prev) =>
        prev.map((task) => (task._id === data._id ? data : task))
      );

      setSelectedTask(data);
    } catch (error) {
      alert(error.response?.data?.message || "Could not update checklist item");
    }
  };

  const deleteChecklistItem = async (itemId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this checklist item?"
    );

    if (!confirmDelete) return;

    try {
      const { data } = await API.delete(
        `/tasks/${selectedTask._id}/checklist/${itemId}`
      );

      setTasks((prev) =>
        prev.map((task) => (task._id === data._id ? data : task))
      );

      setSelectedTask(data);
    } catch (error) {
      alert(error.response?.data?.message || "Could not delete checklist item");
    }
  };

  const isAssignedToSelectedTask = () => {
    if (!selectedTask || !user) return false;

    const assignees = Array.isArray(selectedTask.assignedTo)
      ? selectedTask.assignedTo
      : [selectedTask.assignedTo];

    return assignees.some((employee) => {
      const employeeId = employee?._id || employee;
      return employeeId === user._id;
    });
  };

  const canCollaborateOnSelectedTask = () => {
    return user?.role === "admin" || isAssignedToSelectedTask();
  };

  const getChecklistProgress = (task) => {
    const checklist = task?.checklist || [];

    if (checklist.length === 0) {
      return {
        done: 0,
        total: 0,
        percentage: 0
      };
    }

    const done = checklist.filter((item) => item.isDone).length;

    return {
      done,
      total: checklist.length,
      percentage: Math.round((done / checklist.length) * 100)
    };
  };

  const addComment = async (e) => {
    e.preventDefault();

    if (!commentText.trim()) return;

    try {
      const { data } = await API.post(`/tasks/${selectedTask._id}/comments`, {
        text: commentText
      });

      setTasks((prev) =>
        prev.map((task) => (task._id === data._id ? data : task))
      );

      setSelectedTask(data);
      setCommentText("");
    } catch (error) {
      alert(error.response?.data?.message || "Could not add comment");
    }
  };

  const addLabelToTaskForm = (labelInput) => {
    const label = labelInput.trim();

    if (!label) return;

    setTaskForm((prev) => ({
      ...prev,
      labels: prev.labels.includes(label)
        ? prev.labels
        : [...prev.labels, label]
    }));
  };

  const removeLabelFromTaskForm = (label) => {
    setTaskForm((prev) => ({
      ...prev,
      labels: prev.labels.filter((item) => item !== label)
    }));
  };

  const addLabelToEditForm = (labelInput) => {
    const label = labelInput.trim();

    if (!label) return;

    setEditForm((prev) => ({
      ...prev,
      labels: prev.labels.includes(label)
        ? prev.labels
        : [...prev.labels, label]
    }));
  };

  const removeLabelFromEditForm = (label) => {
    setEditForm((prev) => ({
      ...prev,
      labels: prev.labels.filter((item) => item !== label)
    }));
  };

  const uploadAttachment = async (e) => {
    e.preventDefault();

    if (!attachmentFile || !selectedTask) return;

    const formData = new FormData();
    formData.append("file", attachmentFile);

    try {
      setIsUploadingAttachment(true);

      const { data } = await API.post(
        `/tasks/${selectedTask._id}/attachments`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      setTasks((prev) =>
        prev.map((task) => (task._id === data._id ? data : task))
      );

      setSelectedTask(data);
      setAttachmentFile(null);
    } catch (error) {
      alert(error.response?.data?.message || "Could not upload attachment");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const deleteAttachment = async (attachmentId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to remove this attachment?"
    );

    if (!confirmDelete) return;

    try {
      const { data } = await API.delete(
        `/tasks/${selectedTask._id}/attachments/${attachmentId}`
      );

      setTasks((prev) =>
        prev.map((task) => (task._id === data._id ? data : task))
      );

      setSelectedTask(data);
    } catch (error) {
      alert(error.response?.data?.message || "Could not remove attachment");
    }
  };

  const isImageAttachment = (attachment) => {
    return attachment.fileType?.startsWith("image/");
  };

  const getFileIcon = (attachment) => {
    const type = attachment.fileType || "";

    if (type.includes("pdf")) return "";
    if (type.includes("word") || type.includes("document")) return "";
    if (type.includes("spreadsheet") || type.includes("excel")) return "";
    if (type.includes("presentation") || type.includes("powerpoint")) return "";
    if (type.includes("zip")) return "";

    return "";
  };

  const formatFileSize = (size) => {
    if (!size) return "Unknown size";

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleProjectDropdownChange = (value) => {
    setProjectFilter(value);

    if (value === "all") {
      searchParams.delete("project");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ project: value });
    }
  };

  const resetFilters = () => {
    setSearch("");
    setPriorityFilter("all");
    setDueFilter("all");
    setLabelFilter("all");
    setProjectFilter("all");
    setScope("all");
    setSearchParams({});
  };

  const totalTasks = filteredTasks.length;
  const closedTasks = filteredTasks.filter(
    (task) => task.status === "closed"
  ).length;
  const inProgressTasks = filteredTasks.filter(
    (task) => task.status === "in_progress"
  ).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueTasks = filteredTasks.filter((task) => {
    if (!task.dueDate || task.status === "closed") return false;
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }).length;

  const dueTodayTasks = filteredTasks.filter((task) => {
    if (!task.dueDate || task.status === "closed") return false;
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() === today.getTime();
  }).length;

  const activeFilterCount = [
    scope !== "all",
    priorityFilter !== "all",
    dueFilter !== "all",
    labelFilter !== "all",
    projectFilter !== "all"
  ].filter(Boolean).length;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />

      <main className="flex-1 min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />

        <div className="p-3 sm:p-4 md:p-8 pb-28 lg:pb-8 overflow-hidden">
          <section className="glass-card rounded-3xl md:rounded-[32px] p-4 md:p-7 mb-5 md:mb-6">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
              <div>
                <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                  Kanban Workspace
                </p>

                <h1 className="text-2xl md:text-4xl font-black text-slate-900 mt-1 tracking-tight">
                  Task Board
                </h1>

                <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-slate-100 border border-slate-200 px-4 py-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">
                    Current View
                  </span>
                  <span className="text-sm font-black text-slate-800">
                    {selectedProjectName}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <button
                  onClick={fetchBoardData}
                  className="px-4 md:px-5 py-2.5 md:py-3 rounded-2xl bg-white border border-slate-200 text-xs md:text-sm font-black text-slate-600 hover:bg-slate-50"
                >
                  Refresh
                </button>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-4 md:px-5 py-2.5 md:py-3 rounded-2xl bg-white border border-slate-200 text-xs md:text-sm font-black text-slate-600 hover:bg-slate-50"
                >
                  Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
                </button>

                {user?.role === "admin" && (
                  <button
                    onClick={() => setShowTaskModal(true)}
                    className="btn-primary"
                  >
                    + New Task
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4 mt-5 md:mt-7">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search task, project, employee..."
                className="input-modern col-span-2 md:col-span-2"
              />

              <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3">
                <p className="text-xs text-blue-600 font-black uppercase">
                  Visible
                </p>
                <p className="text-lg md:text-xl font-black text-blue-900">
                  {totalTasks}
                </p>
              </div>

              <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
                <p className="text-xs text-amber-600 font-black uppercase">
                  Due Today
                </p>
                <p className="text-lg md:text-xl font-black text-amber-900">
                  {dueTodayTasks}
                </p>
              </div>

              <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3">
                <p className="text-xs text-red-600 font-black uppercase">
                  Overdue
                </p>
                <p className="text-lg md:text-xl font-black text-red-900">
                  {overdueTasks}
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <p className="text-xs text-emerald-600 font-black uppercase">
                  Closed
                </p>
                <p className="text-lg md:text-xl font-black text-emerald-900">
                  {closedTasks}
                </p>
              </div>
            </div>

            {showFilters && (
              <div className="mt-5 rounded-3xl bg-slate-50 border border-slate-200 p-4 md:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-black text-slate-800">Advanced Filters</p>
                    <p className="text-sm text-slate-500">
                      Narrow down the board without cluttering the screen.
                    </p>
                  </div>

                  <button
                    onClick={resetFilters}
                    className="text-sm font-black text-blue-600"
                  >
                    Reset
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="input-modern"
                  >
                    <option value="all">All visible tasks</option>
                    <option value="my">My tasks</option>
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="input-modern"
                  >
                    <option value="all">All priorities</option>
                    <option value="low">Low priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="high">High priority</option>
                  </select>

                  <select
                    value={dueFilter}
                    onChange={(e) => setDueFilter(e.target.value)}
                    className="input-modern"
                  >
                    <option value="all">All due dates</option>
                    <option value="overdue">Overdue</option>
                    <option value="today">Due today</option>
                    <option value="tomorrow">Due tomorrow</option>
                    <option value="none">No due date</option>
                  </select>

                  <select
                    value={labelFilter}
                    onChange={(e) => setLabelFilter(e.target.value)}
                    className="input-modern"
                  >
                    <option value="all">All labels</option>
                    {availableLabels.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={projectFilter}
                    onChange={(e) => handleProjectDropdownChange(e.target.value)}
                    className="input-modern"
                  >
                    <option value="all">All projects</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </section>

          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex xl:grid xl:grid-cols-5 gap-4 md:gap-5 overflow-x-auto hide-scrollbar xl:overflow-visible pb-4 snap-x snap-mandatory">
              {statuses.map((status) => {
                const columnTasks = getTasksByStatus(status.id);

                return (
                  <Droppable droppableId={status.id} key={status.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`rounded-[28px] p-4 min-h-[560px] md:min-h-[620px] w-[82vw] sm:w-[360px] xl:w-auto flex-shrink-0 snap-start border transition ${
                          snapshot.isDraggingOver
                            ? "bg-blue-50 border-blue-300"
                            : "bg-white/70 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="h-9 w-9 rounded-2xl bg-slate-100 flex items-center justify-center">
                              {status.icon}
                            </span>
                            <h2 className="text-sm font-black text-slate-800 uppercase">
                              {status.title}
                            </h2>
                          </div>

                          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                            {columnTasks.length}
                          </span>
                        </div>

                        {columnTasks.length === 0 && (
                          <div className="border border-dashed border-slate-300 rounded-2xl p-5 text-center text-sm text-slate-400">
                            No tasks here
                          </div>
                        )}

                        {columnTasks.map((task, index) => (
                          <Draggable
                            draggableId={task._id}
                            index={index}
                            key={task._id}
                          >
                            {(dragProvided) => (
                              <TaskCard
                                task={task}
                                dragProvided={dragProvided}
                                onClick={openTaskDetail}
                              />
                            )}
                          </Draggable>
                        ))}

                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        </div>
      </main>

      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                  Quick Create
                </p>
                <h2 className="text-2xl font-black text-slate-900">
                  New Task
                </h2>
              </div>

              <button
                onClick={() => setShowTaskModal(false)}
                className="h-10 w-10 rounded-2xl bg-slate-100 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <form onSubmit={createTask} className="space-y-4">
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
                placeholder="Task description"
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, description: e.target.value })
                }
                className="input-modern min-h-28"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={taskForm.project}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, project: e.target.value })
                  }
                  className="input-modern"
                  required
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                <select
                  value=""
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (!selectedId) return;

                    setTaskForm((prev) => ({
                      ...prev,
                      assignedTo: prev.assignedTo.includes(selectedId)
                        ? prev.assignedTo
                        : [...prev.assignedTo, selectedId]
                    }));
                  }}
                  className="input-modern"
                >
                  <option value="">Add employee</option>
                  {users.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.name}
                    </option>
                  ))}
                </select>

                <div className="md:col-span-2 flex flex-wrap gap-2">
                  {taskForm.assignedTo.map((userId) => {
                    const selectedUser = users.find((u) => u._id === userId);

                    return (
                      <span
                        key={userId}
                        className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold px-3 py-2 rounded-full"
                      >
                        {selectedUser?.name || "Selected User"}
                        <button
                          type="button"
                          onClick={() =>
                            setTaskForm((prev) => ({
                              ...prev,
                              assignedTo: prev.assignedTo.filter(
                                (id) => id !== userId
                              )
                            }))
                          }
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>

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
                <p className="font-black text-sm text-slate-700 mb-2">
                  Labels
                </p>

                <input
                  placeholder="Type label and press Enter, e.g. Frontend"
                  className="input-modern"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLabelToTaskForm(e.currentTarget.value);
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
                        onClick={() => removeLabelFromTaskForm(label)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>

                <button className="btn-primary">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[92vh] max-w-6xl md:rounded-[32px] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-slate-200 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                  Task Details
                </p>

                {selectedTask.taskCode && (
                  <p className="inline-flex mt-2 text-xs font-black bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full">
                    {selectedTask.taskCode}
                  </p>
                )}

                <h2 className="text-xl md:text-3xl font-black text-slate-900 mt-3 line-clamp-2">
                  {selectedTask.title}
                </h2>

                <p className="text-sm text-slate-500 mt-2">
                  {selectedTask.project?.name} ·{" "}
                  {Array.isArray(selectedTask.assignedTo)
                    ? selectedTask.assignedTo.map((employee) => employee.name).join(", ")
                    : selectedTask.assignedTo?.name}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedTask(null);
                  setIsEditing(false);
                  setActiveTaskTab("overview");
                }}
                className="h-11 w-11 rounded-2xl bg-slate-100 hover:bg-slate-200 font-black"
              >
                ×
              </button>
            </div>

            {!isEditing && (
              <div className="px-6 pt-4 border-b border-slate-200 bg-white">
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-4">
                  {[
                    { id: "overview", label: "Overview", icon: "" },
                    { id: "checklist", label: "Checklist", icon: "" },
                    { id: "attachments", label: "Attachments", icon: "" },
                    { id: "comments", label: "Comments", icon: "" },
                    { id: "activity", label: "Activity", icon: "" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTaskTab(tab.id)}
                      className={`px-4 py-2 rounded-2xl text-sm font-black whitespace-nowrap transition ${
                        activeTaskTab === tab.id
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 md:p-6 overflow-auto">
              {!isEditing ? (
                <>
                  {activeTaskTab === "overview" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                          <p className="text-xs text-slate-400 font-bold uppercase">
                            Project
                          </p>
                          <p className="font-bold text-slate-900 mt-1">
                            {selectedTask.project?.name}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                          <p className="text-xs text-slate-400 font-bold uppercase">
                            Assigned To
                          </p>
                          <p className="font-bold text-slate-900 mt-1">
                            {Array.isArray(selectedTask.assignedTo)
                              ? selectedTask.assignedTo.map((employee) => employee.name).join(", ")
                              : selectedTask.assignedTo?.name}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                          <p className="text-xs text-slate-400 font-bold uppercase">
                            Status
                          </p>
                          <p className="font-bold text-slate-900 mt-1 capitalize">
                            {selectedTask.status?.replace("_", " ")}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                          <p className="text-xs text-slate-400 font-bold uppercase">
                            Due Date
                          </p>
                          <p className="font-bold text-slate-900 mt-1">
                            {formatFullDate(selectedTask.dueDate)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                        <p className="text-xs text-slate-400 font-bold uppercase">
                          Description
                        </p>
                        <p className="text-slate-700 mt-2 leading-relaxed">
                          {selectedTask.description || "No description provided."}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white border border-slate-200 p-4">
                        <p className="text-xs text-slate-400 font-bold uppercase">
                          Labels
                        </p>

                        {(!selectedTask.labels || selectedTask.labels.length === 0) ? (
                          <p className="text-sm text-slate-400 mt-2">
                            No labels added.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {selectedTask.labels.map((label) => (
                              <span
                                key={label}
                                className="bg-violet-50 border border-violet-100 text-violet-700 text-xs font-black px-3 py-2 rounded-full"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <button
                          onClick={() => setActiveTaskTab("checklist")}
                          className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-left"
                        >
                          <p className="text-xs font-black text-blue-600 uppercase">
                            Checklist
                          </p>
                          <p className="text-2xl font-black text-blue-900 mt-1">
                            {getChecklistProgress(selectedTask).done}/
                            {getChecklistProgress(selectedTask).total}
                          </p>
                        </button>

                        <button
                          onClick={() => setActiveTaskTab("attachments")}
                          className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-left"
                        >
                          <p className="text-xs font-black text-amber-600 uppercase">
                            Attachments
                          </p>
                          <p className="text-2xl font-black text-amber-900 mt-1">
                            {selectedTask.attachments?.length || 0}
                          </p>
                        </button>

                        <button
                          onClick={() => setActiveTaskTab("comments")}
                          className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-left"
                        >
                          <p className="text-xs font-black text-emerald-600 uppercase">
                            Comments
                          </p>
                          <p className="text-2xl font-black text-emerald-900 mt-1">
                            {selectedTask.comments?.length || 0}
                          </p>
                        </button>

                        <button
                          onClick={() => setActiveTaskTab("activity")}
                          className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-left"
                        >
                          <p className="text-xs font-black text-slate-500 uppercase">
                            Activity
                          </p>
                          <p className="text-2xl font-black text-slate-900 mt-1">
                            {selectedTask.activityLogs?.length || 0}
                          </p>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTaskTab === "checklist" && (
                    <div className="rounded-2xl bg-white border border-slate-200 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase">
                            Checklist
                          </p>
                          <p className="text-sm text-slate-500">
                            Break the task into smaller steps.
                          </p>
                        </div>

                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                          {getChecklistProgress(selectedTask).done}/
                          {getChecklistProgress(selectedTask).total}
                        </span>
                      </div>

                      {(selectedTask.checklist || []).length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-black text-slate-500">
                              {getChecklistProgress(selectedTask).percentage}% complete
                            </p>
                          </div>

                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{
                                width: `${getChecklistProgress(selectedTask).percentage}%`
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {(!selectedTask.checklist || selectedTask.checklist.length === 0) ? (
                        <div className="border border-dashed border-slate-300 rounded-2xl p-5 text-center text-sm text-slate-400 mb-4">
                          No checklist items yet.
                        </div>
                      ) : (
                        <div className="space-y-2 mb-4">
                          {selectedTask.checklist.map((item) => (
                            <div
                              key={item._id}
                              className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3"
                            >
                              <label className="flex items-center gap-3 flex-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.isDone}
                                  onChange={(e) =>
                                    toggleChecklistItem(item._id, e.target.checked)
                                  }
                                  disabled={!canCollaborateOnSelectedTask()}
                                  className="h-4 w-4 disabled:opacity-50"
                                />

                                <span
                                  className={`text-sm font-semibold ${
                                    item.isDone
                                      ? "text-slate-400 line-through"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {item.text}
                                </span>
                              </label>

                              {canCollaborateOnSelectedTask() && (
                                <button
                                  type="button"
                                  onClick={() => deleteChecklistItem(item._id)}
                                  className="text-xs font-black text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {canCollaborateOnSelectedTask() ? (
                        <form onSubmit={addChecklistItem} className="flex gap-3">
                          <input
                            value={checklistText}
                            onChange={(e) => setChecklistText(e.target.value)}
                            placeholder="Add checklist item..."
                            className="input-modern"
                          />

                          <button className="btn-primary whitespace-nowrap">
                            Add
                          </button>
                        </form>
                      ) : (
                        <p className="text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                          You can view this checklist, but only assigned employees can update it.
                        </p>
                      )}
                    </div>
                  )}

                  {activeTaskTab === "attachments" && (
                    <div className="rounded-2xl bg-white border border-slate-200 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase">
                            Attachments
                          </p>
                          <p className="text-sm text-slate-500">
                            Upload screenshots, PDFs, docs, or reference files.
                          </p>
                        </div>

                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                          {selectedTask.attachments?.length || 0}
                        </span>
                      </div>

                      {canCollaborateOnSelectedTask() ? (
                        <form onSubmit={uploadAttachment} className="flex flex-col md:flex-row gap-3 mb-4">
                          <input
                            type="file"
                            onChange={(e) => setAttachmentFile(e.target.files[0])}
                            className="input-modern"
                          />

                          <button
                            disabled={!attachmentFile || isUploadingAttachment}
                            className="btn-primary whitespace-nowrap disabled:opacity-50"
                          >
                            {isUploadingAttachment ? "Uploading..." : "Upload"}
                          </button>
                        </form>
                      ) : (
                        <p className="text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
                          You can view attachments, but only assigned employees can upload files.
                        </p>
                      )}

                      {(!selectedTask.attachments || selectedTask.attachments.length === 0) ? (
                        <div className="border border-dashed border-slate-300 rounded-2xl p-5 text-center text-sm text-slate-400">
                          No attachments yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {selectedTask.attachments.map((attachment) => {
                            const fileUrl = `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5001"}${attachment.filePath}`;
                            const isImage = isImageAttachment(attachment);

                            return (
                              <div
                                key={attachment._id}
                                className="bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden hover:shadow-sm transition"
                              >
                                {isImage ? (
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block bg-white"
                                  >
                                    <img
                                      src={fileUrl}
                                      alt={attachment.originalName}
                                      className="w-full h-44 object-cover"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="h-44 bg-white flex flex-col items-center justify-center border-b border-slate-200"
                                  >
                                    <span className="text-5xl">
                                      {getFileIcon(attachment)}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400 mt-3">
                                      Click to open file
                                    </span>
                                  </a>
                                )}

                                <div className="p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-black text-slate-800 text-sm truncate">
                                        {attachment.originalName}
                                      </p>

                                      <p className="text-xs text-slate-400 mt-1">
                                        {formatFileSize(attachment.fileSize)} · Uploaded by{" "}
                                        {attachment.uploadedBy?.name || "User"}
                                      </p>

                                      <p className="text-xs text-slate-400 mt-1">
                                        {new Date(attachment.uploadedAt).toLocaleString("en-IN", {
                                          day: "2-digit",
                                          month: "short",
                                          hour: "2-digit",
                                          minute: "2-digit"
                                        })}
                                      </p>
                                    </div>

                                    <span className="text-xl">
                                      {isImage ? "" : getFileIcon(attachment)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 mt-4">
                                    <a
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 text-xs font-black"
                                    >
                                      Open
                                    </a>

                                    {canCollaborateOnSelectedTask() && (
                                      <button
                                        type="button"
                                        onClick={() => deleteAttachment(attachment._id)}
                                        className="px-3 py-2 rounded-xl bg-red-50 text-red-600 border border-red-100 text-xs font-black"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTaskTab === "comments" && (
                    <div className="rounded-2xl bg-white border border-slate-200 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase">
                            Comments
                          </p>
                          <p className="text-sm text-slate-500">
                            Discuss updates related to this task.
                          </p>
                        </div>

                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                          {selectedTask.comments?.length || 0}
                        </span>
                      </div>

                      <div className="space-y-3 max-h-[50vh] overflow-auto mb-4">
                        {(!selectedTask.comments || selectedTask.comments.length === 0) ? (
                          <div className="border border-dashed border-slate-300 rounded-2xl p-5 text-center text-sm text-slate-400">
                            No comments yet.
                          </div>
                        ) : (
                          selectedTask.comments.map((comment) => (
                            <div
                              key={comment._id}
                              className="bg-slate-50 border border-slate-100 rounded-2xl p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-black text-slate-800">
                                  {comment.user?.name || "User"}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {new Date(comment.createdAt).toLocaleString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </p>
                              </div>
                              <p className="text-sm text-slate-700 mt-2">
                                {comment.text}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <form onSubmit={addComment} className="flex gap-3">
                        <input
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Write a comment..."
                          className="input-modern"
                        />

                        <button className="btn-primary whitespace-nowrap">
                          Send
                        </button>
                      </form>
                    </div>
                  )}

                  {activeTaskTab === "activity" && (
                    <div className="rounded-2xl bg-white border border-slate-200 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase">
                            Activity
                          </p>
                          <p className="text-sm text-slate-500">
                            Track every important change.
                          </p>
                        </div>

                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                          {selectedTask.activityLogs?.length || 0}
                        </span>
                      </div>

                      <div className="space-y-3 max-h-[60vh] overflow-auto">
                        {(!selectedTask.activityLogs || selectedTask.activityLogs.length === 0) ? (
                          <div className="border border-dashed border-slate-300 rounded-2xl p-5 text-center text-sm text-slate-400">
                            No activity yet.
                          </div>
                        ) : (
                          [...selectedTask.activityLogs].reverse().map((log) => (
                            <div
                              key={log._id}
                              className="relative pl-5 border-l-2 border-blue-100"
                            >
                              <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-blue-600" />
                              <p className="text-sm font-black text-slate-800">
                                {log.action}
                              </p>
                              <p className="text-sm text-slate-600 mt-1">
                                {log.details}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-xs text-slate-400">
                                  {log.user?.name || "System"}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {new Date(log.createdAt).toLocaleString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 mt-6">
                    {user?.role === "admin" && (
                      <>
                        <button
                          onClick={archiveTask}
                          className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 font-semibold"
                        >
                          Archive
                        </button>

                        <button
                          onClick={() => setIsEditing(true)}
                          className="btn-primary"
                        >
                          Edit Task
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={updateTask} className="space-y-4">
                  <input
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm({ ...editForm, title: e.target.value })
                    }
                    className="input-modern"
                    required
                  />

                  <textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    className="input-modern min-h-28"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select
                      value={editForm.project}
                      onChange={(e) =>
                        setEditForm({ ...editForm, project: e.target.value })
                      }
                      className="input-modern"
                      required
                    >
                      <option value="">Select project</option>
                      {projects.map((project) => (
                        <option key={project._id} value={project._id}>
                          {project.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value=""
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        if (!selectedId) return;

                        setEditForm((prev) => ({
                          ...prev,
                          assignedTo: prev.assignedTo.includes(selectedId)
                            ? prev.assignedTo
                            : [...prev.assignedTo, selectedId]
                        }));
                      }}
                      className="input-modern"
                    >
                      <option value="">Add employee</option>
                      {users.map((employee) => (
                        <option key={employee._id} value={employee._id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>

                    <div className="md:col-span-2 flex flex-wrap gap-2">
                      {editForm.assignedTo.map((userId) => {
                        const selectedUser = users.find((u) => u._id === userId);

                        return (
                          <span
                            key={userId}
                            className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold px-3 py-2 rounded-full"
                          >
                            {selectedUser?.name || "Selected User"}
                            <button
                              type="button"
                              onClick={() =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  assignedTo: prev.assignedTo.filter(
                                    (id) => id !== userId
                                  )
                                }))
                              }
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>

                    <select
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm({ ...editForm, status: e.target.value })
                      }
                      className="input-modern"
                    >
                      {statuses.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.title}
                        </option>
                      ))}
                    </select>

                    <select
                      value={editForm.priority}
                      onChange={(e) =>
                        setEditForm({ ...editForm, priority: e.target.value })
                      }
                      className="input-modern"
                    >
                      <option value="low">Low priority</option>
                      <option value="medium">Medium priority</option>
                      <option value="high">High priority</option>
                    </select>

                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) =>
                        setEditForm({ ...editForm, dueDate: e.target.value })
                      }
                      className="input-modern"
                    />
                  </div>

                  <div>
                    <p className="font-black text-sm text-slate-700 mb-2">
                      Labels
                    </p>

                    <input
                      placeholder="Type label and press Enter"
                      className="input-modern"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addLabelToEditForm(e.currentTarget.value);
                          e.currentTarget.value = "";
                        }
                      }}
                    />

                    <div className="flex flex-wrap gap-2 mt-3">
                      {editForm.labels.map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center gap-2 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-black px-3 py-2 rounded-full"
                        >
                          {label}
                          <button
                            type="button"
                            onClick={() => removeLabelFromEditForm(label)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                    >
                      Cancel
                    </button>

                    <button className="btn-primary">
                      Save Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Board;
