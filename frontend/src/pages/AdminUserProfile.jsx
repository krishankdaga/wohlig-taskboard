import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import API from "../api/axios";

const AdminUserProfile = () => {
  const { id } = useParams();

  const [profile, setProfile] = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [leadTitle, setLeadTitle] = useState("Project Lead");
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    const { data } = await API.get(`/auth/users/${id}/profile`);
    setProfile(data);
  };

  const fetchProjects = async () => {
    const { data } = await API.get("/projects");
    setAllProjects(data);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchProfile(), fetchProjects()]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const assignLead = async (e) => {
    e.preventDefault();

    if (!selectedProject) {
      alert("Please select a project");
      return;
    }

    try {
      await API.put(`/projects/${selectedProject}/leads`, {
        userId: id,
        title: leadTitle
      });

      setSelectedProject("");
      setLeadTitle("Project Lead");

      await Promise.all([fetchProfile(), fetchProjects()]);
      alert("Project lead assigned successfully");
    } catch (error) {
      alert(error.response?.data?.message || "Could not assign project lead");
    }
  };

  const removeLead = async (projectId) => {
    const confirmRemove = window.confirm("Remove this project lead assignment?");
    if (!confirmRemove) return;

    try {
      await API.delete(`/projects/${projectId}/leads/${id}`);
      await Promise.all([fetchProfile(), fetchProjects()]);
      alert("Project lead removed");
    } catch (error) {
      alert(error.response?.data?.message || "Could not remove project lead");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50 dark:bg-black">
        <Sidebar />
        <main className="flex-1">
          <Navbar />
          <div className="p-8">
            <p className="font-black text-slate-500 dark:text-neutral-400">
              Loading employee profile...
            </p>
          </div>
        </main>
      </div>
    );
  }

  const user = profile?.user;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-black">
      <Sidebar />

      <main className="flex-1 min-w-0 min-h-screen bg-slate-50 dark:bg-black">
        <Navbar />

        <div className="p-4 md:p-8 pb-28 lg:pb-8 max-w-7xl mx-auto">
          <section className="glass-card rounded-3xl md:rounded-[32px] p-6 md:p-8 mb-6">
            <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
              Employee Profile
            </p>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mt-4">
              <div className="flex items-center gap-5">
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white text-3xl font-black">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </div>

                <div>
                  <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
                    {user?.name}
                  </h1>
                  <p className="text-slate-500 dark:text-neutral-400 mt-1">
                    {user?.email}
                  </p>
                  <span className="inline-flex mt-3 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900 text-xs font-black capitalize">
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="glass-card rounded-3xl p-6 lg:col-span-2">
              <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                Task Summary
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5">
                  <p className="text-xs font-black text-slate-400 uppercase">Total</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                    {profile?.taskStats?.total || 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5">
                  <p className="text-xs font-black text-slate-400 uppercase">Pending</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                    {profile?.taskStats?.pending || 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5">
                  <p className="text-xs font-black text-slate-400 uppercase">Closed</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                    {profile?.taskStats?.closed || 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5">
                  <p className="text-xs font-black text-slate-400 uppercase">High Priority</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                    {profile?.taskStats?.highPriority || 0}
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <p className="text-sm font-black text-slate-900 dark:text-white mb-3">
                  Assigned Tasks
                </p>

                <div className="space-y-3">
                  {profile?.tasks?.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800 p-6 text-center text-slate-400">
                      No active tasks assigned.
                    </div>
                  ) : (
                    profile.tasks.map((task) => (
                      <div
                        key={task._id}
                        className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-4"
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            <p className="text-xs font-black text-blue-600">
                              {task.taskCode}
                            </p>
                            <p className="font-black text-slate-900 dark:text-white">
                              {task.title}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
                              {task.project?.name} · {task.status?.replace("_", " ")} · {task.priority}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="glass-card rounded-3xl p-6">
              <p className="text-sm font-black text-violet-600 uppercase tracking-wider">
                Project Lead Access
              </p>

              <form onSubmit={assignLead} className="space-y-3 mt-5">
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="input-modern"
                >
                  <option value="">Select project</option>
                  {allProjects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                <input
                  value={leadTitle}
                  onChange={(e) => setLeadTitle(e.target.value)}
                  placeholder="Lead title, e.g. GenAI Lead"
                  className="input-modern"
                />

                <button className="btn-primary w-full">
                  Assign Project Lead
                </button>
              </form>

              <div className="mt-8">
                <p className="text-sm font-black text-slate-900 dark:text-white mb-3">
                  Current Lead Roles
                </p>

                <div className="space-y-3">
                  {profile?.leadProjects?.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800 p-5 text-center text-slate-400 text-sm">
                      No project lead roles assigned.
                    </div>
                  ) : (
                    profile.leadProjects.map((project) => {
                      const lead = project.projectLeads?.find(
                        (item) => item.user?._id === id
                      );

                      return (
                        <div
                          key={project._id}
                          className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-4"
                        >
                          <p className="font-black text-slate-900 dark:text-white">
                            {project.name}
                          </p>

                          <p className="text-sm text-blue-600 font-bold mt-1">
                            {lead?.title || "Project Lead"}
                          </p>

                          <button
                            onClick={() => removeLead(project._id)}
                            className="mt-3 text-xs font-black text-red-600"
                          >
                            Remove Lead Role
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminUserProfile;
