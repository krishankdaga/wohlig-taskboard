import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import API from "../api/axios";

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/audit");
      setLogs(data);
    } catch (error) {
      alert(error.response?.data?.message || "Could not load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();

    return (
      log.taskCode?.toLowerCase().includes(q) ||
      log.taskTitle?.toLowerCase().includes(q) ||
      log.project?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.details?.toLowerCase().includes(q) ||
      log.user?.name?.toLowerCase().includes(q)
    );
  });

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
                  Admin Audit
                </p>

                <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mt-2">
                  Activity Log
                </h1>

                <p className="text-slate-500 dark:text-neutral-400 mt-3 max-w-2xl">
                  Review important task activity across the workspace for accountability and tracking.
                </p>
              </div>

              <button
                onClick={fetchLogs}
                className="px-5 py-3 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-sm font-black text-slate-600 dark:text-neutral-300"
              >
                Refresh
              </button>
            </div>
          </section>

          <section className="glass-card rounded-3xl p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                  Logs
                </p>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  {filteredLogs.length} entries
                </h2>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search logs by task, project, user, action..."
                className="input-modern md:max-w-md"
              />
            </div>

            {loading ? (
              <p className="font-black text-slate-500 dark:text-neutral-400">
                Loading logs...
              </p>
            ) : filteredLogs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 dark:border-neutral-800 p-10 text-center">
                <p className="font-black text-slate-500 dark:text-neutral-400">
                  No audit logs found.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <div
                    key={log._id}
                    className="rounded-3xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div>
                        <p className="text-xs font-black text-blue-600 uppercase tracking-wider">
                          {log.action}
                        </p>

                        <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                          {log.taskCode} · {log.taskTitle}
                        </h3>

                        <p className="text-sm text-slate-500 dark:text-neutral-400 mt-2">
                          Project: {log.project}
                        </p>

                        {log.details && (
                          <p className="text-sm text-slate-700 dark:text-neutral-300 mt-2">
                            {log.details}
                          </p>
                        )}
                      </div>

                      <div className="text-left md:text-right">
                        <p className="font-black text-slate-900 dark:text-white">
                          {log.user?.name || "System"}
                        </p>

                        <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                          {new Date(log.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default AuditLog;
