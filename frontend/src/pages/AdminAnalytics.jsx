import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import API from "../api/axios";

const StatCard = ({ label, value, note }) => {
  return (
    <div className="rounded-3xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5">
      <p className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
        {value}
      </p>
      {note && (
        <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
          {note}
        </p>
      )}
    </div>
  );
};

const AdminAnalytics = () => {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("employees");
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/analytics/workload");
      setData(data);
    } catch (error) {
      alert(error.response?.data?.message || "Could not load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const sortedEmployees = useMemo(() => {
    if (!data?.employees) return [];
    return [...data.employees].sort((a, b) => b.pendingTasks - a.pendingTasks);
  }, [data]);

  const sortedProjects = useMemo(() => {
    if (!data?.projects) return [];
    return [...data.projects].sort((a, b) => b.pendingTasks - a.pendingTasks);
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50 dark:bg-black">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-screen bg-slate-50 dark:bg-black">
          <Navbar />
          <div className="p-8">
            <p className="font-black text-slate-500 dark:text-neutral-400">
              Loading analytics...
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-black">
      <Sidebar />

      <main className="flex-1 min-w-0 min-h-screen bg-slate-50 dark:bg-black">
        <Navbar />

        <div className="p-4 md:p-8 pb-28 lg:pb-8 max-w-7xl mx-auto">
          <section className="glass-card rounded-3xl md:rounded-[32px] p-6 md:p-8 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                  Admin Analytics
                </p>

                <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mt-2">
                  Workload Overview
                </h1>

                <p className="text-slate-500 dark:text-neutral-400 mt-3 max-w-2xl">
                  Track employee workload, overdue work, high-priority pressure, and project bottlenecks.
                </p>
              </div>

              <button
                onClick={fetchAnalytics}
                className="px-5 py-3 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-sm font-black text-slate-600 dark:text-neutral-300"
              >
                Refresh
              </button>
            </div>
          </section>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 mb-6">
            <StatCard label="Users" value={data?.summary?.totalUsers || 0} />
            <StatCard label="Projects" value={data?.summary?.totalProjects || 0} />
            <StatCard label="Tasks" value={data?.summary?.totalTasks || 0} />
            <StatCard label="Pending" value={data?.summary?.pendingTasks || 0} />
            <StatCard label="Closed" value={data?.summary?.closedTasks || 0} />
            <StatCard label="Overdue" value={data?.summary?.overdueTasks || 0} />
            <StatCard label="High Priority" value={data?.summary?.highPriorityTasks || 0} />
            <StatCard label="Review" value={data?.summary?.reviewTasks || 0} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="glass-card rounded-3xl p-6">
              <p className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase">
                Most Loaded Employee
              </p>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-2">
                {data?.highlights?.mostLoadedEmployee?.name || "No data"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
                {data?.highlights?.mostLoadedEmployee?.pendingTasks || 0} pending tasks
              </p>
            </div>

            <div className="glass-card rounded-3xl p-6">
              <p className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase">
                Most Overdue Employee
              </p>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-2">
                {data?.highlights?.mostOverdueEmployee?.name || "No data"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
                {data?.highlights?.mostOverdueEmployee?.overdueTasks || 0} overdue tasks
              </p>
            </div>

            <div className="glass-card rounded-3xl p-6">
              <p className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase">
                Most Delayed Project
              </p>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-2">
                {data?.highlights?.mostDelayedProject?.name || "No data"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
                {data?.highlights?.mostDelayedProject?.overdueTasks || 0} overdue tasks
              </p>
            </div>
          </div>

          <section className="glass-card rounded-3xl p-5 md:p-6">
            <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setActiveTab("employees")}
                className={`px-5 py-3 rounded-2xl text-sm font-black ${
                  activeTab === "employees"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300"
                }`}
              >
                Employee Workload
              </button>

              <button
                onClick={() => setActiveTab("projects")}
                className={`px-5 py-3 rounded-2xl text-sm font-black ${
                  activeTab === "projects"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300"
                }`}
              >
                Project Workload
              </button>
            </div>

            {activeTab === "employees" ? (
              <div className="overflow-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-neutral-800">
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Employee</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Role</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Total</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Pending</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Closed</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Overdue</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">High</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Review</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Lead Projects</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedEmployees.map((employee) => (
                      <tr
                        key={employee._id}
                        className="border-b border-slate-100 dark:border-neutral-900"
                      >
                        <td className="py-4 px-3">
                          <p className="font-black text-slate-900 dark:text-white">
                            {employee.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-neutral-400">
                            {employee.email}
                          </p>
                        </td>
                        <td className="py-4 px-3 capitalize text-slate-600 dark:text-neutral-300">
                          {employee.role}
                        </td>
                        <td className="py-4 px-3 font-black text-slate-900 dark:text-white">
                          {employee.totalTasks}
                        </td>
                        <td className="py-4 px-3 font-black text-blue-600">
                          {employee.pendingTasks}
                        </td>
                        <td className="py-4 px-3 font-black text-emerald-600">
                          {employee.closedTasks}
                        </td>
                        <td className="py-4 px-3 font-black text-red-600">
                          {employee.overdueTasks}
                        </td>
                        <td className="py-4 px-3 font-black text-amber-600">
                          {employee.highPriorityTasks}
                        </td>
                        <td className="py-4 px-3 font-black text-violet-600">
                          {employee.reviewTasks}
                        </td>
                        <td className="py-4 px-3 text-sm text-slate-600 dark:text-neutral-300">
                          {employee.leadProjects?.length
                            ? employee.leadProjects.map((p) => p.name).join(", ")
                            : "None"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full min-w-[800px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-neutral-800">
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Project</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Total</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Pending</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Closed</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Overdue</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">High</th>
                      <th className="py-3 px-3 text-xs font-black text-slate-400 uppercase">Leads</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedProjects.map((project) => (
                      <tr
                        key={project._id}
                        className="border-b border-slate-100 dark:border-neutral-900"
                      >
                        <td className="py-4 px-3 font-black text-slate-900 dark:text-white">
                          {project.name}
                        </td>
                        <td className="py-4 px-3 font-black text-slate-900 dark:text-white">
                          {project.totalTasks}
                        </td>
                        <td className="py-4 px-3 font-black text-blue-600">
                          {project.pendingTasks}
                        </td>
                        <td className="py-4 px-3 font-black text-emerald-600">
                          {project.closedTasks}
                        </td>
                        <td className="py-4 px-3 font-black text-red-600">
                          {project.overdueTasks}
                        </td>
                        <td className="py-4 px-3 font-black text-amber-600">
                          {project.highPriorityTasks}
                        </td>
                        <td className="py-4 px-3 text-sm text-slate-600 dark:text-neutral-300">
                          {project.leads?.length
                            ? project.leads.map((lead) => `${lead.name} (${lead.title})`).join(", ")
                            : "None"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default AdminAnalytics;
