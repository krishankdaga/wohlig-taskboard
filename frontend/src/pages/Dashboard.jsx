import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import API from "../api/axios";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

const statusLabels = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  closed: "Closed"
};

const statusStyles = {
  backlog: "bg-slate-50 text-slate-700 border-slate-200",
  todo: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  review: "bg-violet-50 text-violet-700 border-violet-200",
  closed: "bg-emerald-50 text-emerald-700 border-emerald-200"
};

const StatCard = ({ title, value, subtitle, tone = "blue" }) => {
  const tones = {
    blue: "bg-blue-50 border-blue-100 text-blue-900",
    amber: "bg-amber-50 border-amber-100 text-amber-900",
    red: "bg-red-50 border-red-100 text-red-900",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-900",
    violet: "bg-violet-50 border-violet-100 text-violet-900",
    slate: "bg-slate-50 border-slate-200 text-slate-900"
  };

  return (
    <div className={`rounded-3xl border p-5 ${tones[tone]}`}>
      <p className="text-xs font-black uppercase opacity-70">{title}</p>
      <p className="text-3xl font-black mt-2">{value}</p>
      {subtitle && <p className="text-sm mt-1 opacity-70">{subtitle}</p>}
    </div>
  );
};

const ChartCard = ({ title, subtitle, children }) => {
  return (
    <section className="glass-card rounded-[32px] p-6">
      <div className="mb-5">
        <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
          {subtitle}
        </p>
        <h2 className="text-2xl font-black text-slate-900 mt-1">
          {title}
        </h2>
      </div>

      <div className="h-72">
        {children}
      </div>
    </section>
  );
};

const Dashboard = () => {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  const fetchDashboardData = async () => {
    const tasksRes = await API.get("/tasks?scope=all");
    const myTasksRes = await API.get("/tasks?scope=my");
    const projectsRes = await API.get("/projects");

    setTasks(tasksRes.data);
    setMyTasks(myTasksRes.data);
    setProjects(projectsRes.data);

    if (user?.role === "admin") {
      const usersRes = await API.get("/auth/users");
      setUsers(usersRes.data);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const dashboardStats = useMemo(() => {
    const visibleTasks = tasks || [];
    const assignedTasks = myTasks || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const overdue = visibleTasks.filter((task) => {
      if (!task.dueDate || task.status === "closed") return false;
      const due = new Date(task.dueDate);
      due.setHours(0, 0, 0, 0);
      return due < today;
    });

    const dueToday = visibleTasks.filter((task) => {
      if (!task.dueDate || task.status === "closed") return false;
      const due = new Date(task.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    });

    const dueTomorrow = visibleTasks.filter((task) => {
      if (!task.dueDate || task.status === "closed") return false;
      const due = new Date(task.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === tomorrow.getTime();
    });

    const noDueDate = visibleTasks.filter((task) => !task.dueDate);

    const byStatus = {
      backlog: visibleTasks.filter((task) => task.status === "backlog").length,
      todo: visibleTasks.filter((task) => task.status === "todo").length,
      in_progress: visibleTasks.filter((task) => task.status === "in_progress").length,
      review: visibleTasks.filter((task) => task.status === "review").length,
      closed: visibleTasks.filter((task) => task.status === "closed").length
    };

    const byPriority = {
      low: visibleTasks.filter((task) => task.priority === "low").length,
      medium: visibleTasks.filter((task) => task.priority === "medium").length,
      high: visibleTasks.filter((task) => task.priority === "high").length
    };

    return {
      visibleTasks,
      assignedTasks,
      overdue,
      dueToday,
      dueTomorrow,
      noDueDate,
      byStatus,
      byPriority
    };
  }, [tasks, myTasks]);

  const statusChartData = [
    { name: "Backlog", value: dashboardStats.byStatus.backlog },
    { name: "To Do", value: dashboardStats.byStatus.todo },
    { name: "In Progress", value: dashboardStats.byStatus.in_progress },
    { name: "Review", value: dashboardStats.byStatus.review },
    { name: "Closed", value: dashboardStats.byStatus.closed }
  ];

  const priorityChartData = [
    { name: "Low", value: dashboardStats.byPriority.low },
    { name: "Medium", value: dashboardStats.byPriority.medium },
    { name: "High", value: dashboardStats.byPriority.high }
  ];

  const dueChartData = [
    { name: "Overdue", value: dashboardStats.overdue.length },
    { name: "Due Today", value: dashboardStats.dueToday.length },
    { name: "Tomorrow", value: dashboardStats.dueTomorrow.length },
    { name: "No Date", value: dashboardStats.noDueDate.length }
  ];

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt) -
          new Date(a.updatedAt || a.createdAt)
      )
      .slice(0, 6);
  }, [tasks]);

  return (
    <div className="flex">
      <Sidebar />

      <main className="flex-1 min-h-screen">
        <Navbar />

        <div className="p-4 md:p-8 pb-28 lg:pb-8 max-w-7xl mx-auto">
          <section className="glass-card rounded-[32px] p-8 mb-8">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
              <div>
                <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                  Dashboard
                </p>

                <h1 className="text-4xl font-black text-slate-900 mt-2 tracking-tight">
                  Welcome, {user?.name}
                </h1>

                <p className="text-slate-500 mt-3 max-w-2xl">
                  Here is your current workspace overview, task workload, and project progress.
                </p>
              </div>

              <button
                onClick={fetchDashboardData}
                className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50"
              >
                Refresh Dashboard
              </button>
            </div>
          </section>

          {user?.role === "admin" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
              <StatCard title="Users" value={users.length} subtitle="Total accounts" tone="blue" />
              <StatCard title="Projects" value={projects.length} subtitle="Main + sub-projects" tone="violet" />
              <StatCard title="Tasks" value={tasks.length} subtitle="All visible tasks" tone="slate" />
              <StatCard title="Due Today" value={dashboardStats.dueToday.length} subtitle="Needs attention" tone="amber" />
              <StatCard title="Overdue" value={dashboardStats.overdue.length} subtitle="Delayed tasks" tone="red" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
              <StatCard title="Visible Tasks" value={tasks.length} subtitle="From assigned projects" tone="blue" />
              <StatCard title="My Tasks" value={myTasks.length} subtitle="Assigned to you" tone="violet" />
              <StatCard title="Due Today" value={dashboardStats.dueToday.length} subtitle="Needs action" tone="amber" />
              <StatCard title="Overdue" value={dashboardStats.overdue.length} subtitle="Delayed" tone="red" />
              <StatCard title="Closed" value={dashboardStats.byStatus.closed} subtitle="Completed" tone="emerald" />
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
            <ChartCard title="Tasks by Status" subtitle="Progress">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData}>
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Priority Split" subtitle="Urgency">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    label
                  >
                    {priorityChartData.map((entry, index) => (
                      <Cell key={entry.name} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Due Date Health" subtitle="Deadlines">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dueChartData}>
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <section className="glass-card rounded-[32px] p-6 xl:col-span-1">
              <div className="mb-5">
                <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                  Task Status
                </p>
                <h2 className="text-2xl font-black text-slate-900 mt-1">
                  Progress Summary
                </h2>
              </div>

              <div className="space-y-3">
                {Object.entries(dashboardStats.byStatus).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between rounded-2xl bg-white border border-slate-100 p-4"
                  >
                    <span
                      className={`text-xs font-black px-3 py-1 rounded-full border ${statusStyles[status]}`}
                    >
                      {statusLabels[status]}
                    </span>

                    <p className="text-xl font-black text-slate-900">
                      {count}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-card rounded-[32px] p-6 xl:col-span-2">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-black text-violet-600 uppercase tracking-wider">
                    Recent Work
                  </p>
                  <h2 className="text-2xl font-black text-slate-900 mt-1">
                    Recently Updated Tasks
                  </h2>
                </div>
              </div>

              {recentTasks.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center">
                  <p className="text-slate-400 font-bold">
                    No tasks yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTasks.map((task) => (
                    <div
                      key={task._id}
                      className="bg-white border border-slate-100 rounded-3xl p-5 hover:shadow-sm transition"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            {task.taskCode && (
                              <span className="text-xs font-black bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-full">
                                {task.taskCode}
                              </span>
                            )}

                            <h3 className="font-black text-slate-900">
                              {task.title}
                            </h3>
                          </div>

                          <p className="text-sm text-slate-500 mt-2">
                            {task.project?.name} ·{" "}
                            {Array.isArray(task.assignedTo)
                              ? task.assignedTo.map((employee) => employee.name).join(", ")
                              : task.assignedTo?.name}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-black px-3 py-1 rounded-full border ${statusStyles[task.status]}`}
                          >
                            {statusLabels[task.status]}
                          </span>

                          <span className="text-xs font-black px-3 py-1 rounded-full border bg-white text-slate-500 border-slate-200">
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
