import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const Profile = () => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar />

      <main className="flex-1 min-w-0 h-screen overflow-hidden flex flex-col">
        <Navbar />

        <div className="flex-1 overflow-auto p-4 md:p-8 pb-28 lg:pb-8 max-w-6xl w-full mx-auto">
          <section className="glass-card rounded-3xl md:rounded-[32px] p-6 md:p-8 mb-6">
            <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
              User Profile
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
                  <p className="text-slate-500 dark:text-slate-400 mt-1">
                    {user?.email}
                  </p>
                  <span className="inline-flex mt-3 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-black capitalize">
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="glass-card rounded-3xl p-6 lg:col-span-2">
              <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                Account Details
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5">
                  <p className="text-xs font-black text-slate-400 uppercase">
                    Full Name
                  </p>
                  <p className="font-black text-slate-900 dark:text-white mt-1">
                    {user?.name}
                  </p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5">
                  <p className="text-xs font-black text-slate-400 uppercase">
                    Email Address
                  </p>
                  <p className="font-black text-slate-900 dark:text-white mt-1">
                    {user?.email}
                  </p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5">
                  <p className="text-xs font-black text-slate-400 uppercase">
                    Workspace Role
                  </p>
                  <p className="font-black text-slate-900 dark:text-white mt-1 capitalize">
                    {user?.role}
                  </p>
                </div>
              </div>
            </section>

            <section className="glass-card rounded-3xl p-6">
              <p className="text-sm font-black text-violet-600 uppercase tracking-wider">
                Settings
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-black text-slate-900 dark:text-white">
                        Dark Mode
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Switch the website appearance.
                      </p>
                    </div>

                    <button
                      onClick={toggleDarkMode}
                      className={`w-14 h-8 rounded-full p-1 transition ${
                        isDarkMode ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`block h-6 w-6 rounded-full bg-white transition ${
                          isDarkMode ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5">
                  <p className="font-black text-slate-900 dark:text-white">
                    Workspace Access
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Your project and task access is managed by the admin.
                  </p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5">
                  <p className="font-black text-slate-900 dark:text-white">
                    Security
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Password changes can be handled by the workspace admin.
                  </p>
                </div>

                <button
                  onClick={logout}
                  className="w-full rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-900 px-5 py-3 font-black hover:bg-red-100 dark:hover:bg-red-950/50 transition"
                >
                  Logout
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
