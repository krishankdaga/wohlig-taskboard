import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import API from "../api/axios";
import { useAuth } from "../context/AuthContext";

const statusLabels = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  closed: "Closed"
};

const MyWork = () => {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeFilter, setActiveFilter] = useState("pending");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [tasksRes, projectsRes] = await Promise.all([
        API.get("/tasks"),
        API.get("/projects")
      ]);

      setTasks(tasksRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      alert(error.response?.data?.message || "Could not load my work");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const myTasks = useMemo(() => {
    return tasks.filter((task) => {
      const assignees = task.assignedTo || [];

      return assignees.some((employee) => {
        const employeeId = employee?._id || employee;
        return employeeId === user?._id;
      });
    });
  }, [tasks, user?._id]);

  const leadProjects = useMemo(() => {
    return projects.filter((project) => {
      return (project.projectLeads || []).some((lead) => {
        const leadUserId = lead.user?._id || lead.user;
        return leadUserId === user?._id;
      });
    });
  }, [projects, user?._id]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const filteredTasks = useMemo(() => {
    return myTasks.filter((task) => {
      const due = task.dueDate ? new Date(task.dueDate) : null;

      if (activeFilter === "pending") return task.status !== "closed";

      if (activeFilter === "overdue") {
        return due && due < today && task.status !== "closed";
      }

      if (activeFilter === "today") {
        return due && due >= today && due < tomorrow && task.status !== "closed";
      }

      if (activeFilter === "week") {
        return due && due >= today && due <= weekEnd && task.status !== "closed";
      }

      if (activeFilter === "high") {
        return task.priority === "high" && task.status !== "closed";
      }

      if (activeFilter === "review") return task.status === "review";

      return true;
    });
  }, [myTasks, activeFilter]);

  const stats = {
    total: myTasks.length,
    pending: myTasks.filter((task) => task.status !== "closed").length,
    overdue: myTasks.filter((task) => {
      const due = task.dueDate ? new Date(task.dueDate) : null;
      return due && due < today && task.status !== "closed";
    }).length,
    high: myTasks.filter(
      (task) => task.priority === "high" && task.status !== "closed"
    ).length,
    review: myTasks.filter((task) => task.status === "review").length,
    leadProjects: leadProjects.length
  };

  const filters = [
    { id: "pending", label: "Pending", count: stats.pending },
    { id: "overdue", label: "Overdue", count: stats.overdue },
    { id: "today", label: "Due Today", count: myTasks.filter((task) => {
      const due = task.dueDate ? new Date(task.dueDate) : null;
      return due && due >= today && due < tomorrow && task.status !== "closed";
    }).length },
    { id: "week", label: "This Week", count: myTasks.filter((task) => {
      const due = task.dueDate ? new Date(task.dueDate) : null;
      return due && due >= today && due <= weekEnd && task.status !== "closed";
    }).length },
    { id: "high", label: "High Priority", count: stats.high },
    { id: "review", label: "In Review", count: stats.review }
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-black">
      <Sidebar />

      <main className="flex-1 min-w-0 min-h-screen bg-slate-50 dark:bg-black">
        <Navbar />

        <div className="p-4 md:p-8 pb-28 lg:pb-8 max-w-7xl mx-auto">
          <section className="glass-card rounded-3xl md:rounded-[32px] p-6 md:p-8 mb-6">
            <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
              Personal Dashboard
            </p>

            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mt-2">
              My Work
            </h1>

            <p className="text-slate-500 dark:text-neutral-400 mt-3 max-w-2xl">
              A focused view of your pending tasks, deadlines, priorities, and project lead responsibilities.
            </p>
          </section>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            {[
              ["Total", stats.total],
              ["Pending", stats.pending],
              ["Overdue", stats.overdue],
              ["High Priority", stats.high],
              ["Review", stats.review],
              ["Lead Projects", stats.leadProjects]
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-3xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5"
              >
                <p className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase">
                  {label}
                </p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <section className="glass-card rounded-3xl p-5 md:p-6 mb-6">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-4 py-3 rounded-2xl text-sm font-black whitespace-nowrap ${
                    activeFilter === filter.id
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-neutral-950 text-slate-600 dark:text-neutral-300 border border-slate-200 dark:border-neutral-800"
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
            <section className="glass-card rounded-3xl p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                    Tasks
                  </p>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                    {filters.find((filter) => filter.id === activeFilter)?.label}
                  </h2>
                </div>

                <button
                  onClick={fetchData}
                  className="px-4 py-2 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-sm font-black text-slate-600 dark:text-neutral-300"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <p className="text-slate-500 dark:text-neutral-400 font-bold">
                  Loading tasks...
                </p>
              ) : filteredTasks.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 dark:border-neutral-800 p-10 text-center">
                  <p className="font-black text-slate-500 dark:text-neutral-400">
                    No tasks found for this filter.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map((task) => (
                    <div
                      key={task._id}
                      className="rounded-3xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                          <p className="text-xs font-black text-blue-600">
                            {task.taskCode}
                          </p>

                          <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                            {task.title}
                          </h3>

                          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-2">
                            {task.project?.name} · {statusLabels[task.status]} · {task.priority}
                          </p>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase">
                            Due Date
                          </p>
                          <p className="font-black text-slate-900 dark:text-white mt-1">
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric"
                                })
                              : "No due date"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="glass-card rounded-3xl p-5 md:p-6">
              <p className="text-sm font-black text-violet-600 uppercase tracking-wider">
                Project Lead Roles
              </p>

              <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                Managed Projects
              </h2>

              <div className="space-y-3 mt-5">
                {leadProjects.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 dark:border-neutral-800 p-6 text-center">
                    <p className="text-sm font-bold text-slate-400">
                      You are not assigned as project lead yet.
                    </p>
                  </div>
                ) : (
                  leadProjects.map((project) => {
                    const lead = project.projectLeads?.find((item) => {
                      const leadUserId = item.user?._id || item.user;
                      return leadUserId === user?._id;
                    });

                    return (
                      <div
                        key={project._id}
                        className="rounded-3xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5"
                      >
                        <p className="font-black text-slate-900 dark:text-white">
                          {project.name}
                        </p>

                        <p className="text-sm font-bold text-blue-600 mt-1">
                          {lead?.title || "Project Lead"}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MyWork;
