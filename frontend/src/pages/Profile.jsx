import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import API from "../api/axios";

const Profile = () => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();

    setPasswordMessage("");
    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirm password do not match");
      return;
    }

    try {
      setIsChangingPassword(true);

      const { data } = await API.put("/auth/change-password", passwordForm);

      setPasswordMessage(data.message || "Password changed successfully");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (error) {
      setPasswordError(
        error.response?.data?.message || "Could not change password"
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-black">
      <Sidebar />

      <main className="flex-1 min-w-0 min-h-screen bg-slate-50 dark:bg-black">
        <Navbar />

        <div className="p-4 md:p-8 pb-28 lg:pb-8 max-w-6xl w-full mx-auto">
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
                Account Details
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5">
                  <p className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase">
                    Full Name
                  </p>
                  <p className="font-black text-slate-900 dark:text-white mt-1">
                    {user?.name}
                  </p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5">
                  <p className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase">
                    Email Address
                  </p>
                  <p className="font-black text-slate-900 dark:text-white mt-1">
                    {user?.email}
                  </p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5">
                  <p className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase">
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
                <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-black text-slate-900 dark:text-white">
                        Dark Mode
                      </p>
                      <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
                        Switch the website appearance.
                      </p>
                    </div>

                    <button
                      type="button"
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

                <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5">
                  <p className="font-black text-slate-900 dark:text-white">
                    Workspace Access
                  </p>
                  <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
                    Your project and task access is managed by the admin.
                  </p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5">
                  <p className="font-black text-slate-900 dark:text-white">
                    Change Password
                  </p>
                  <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
                    Update your password securely.
                  </p>

                  <form onSubmit={changePassword} className="space-y-3 mt-4">
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          currentPassword: e.target.value
                        })
                      }
                      placeholder="Current password"
                      className="input-modern"
                    />

                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          newPassword: e.target.value
                        })
                      }
                      placeholder="New password"
                      className="input-modern"
                    />

                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: e.target.value
                        })
                      }
                      placeholder="Confirm new password"
                      className="input-modern"
                    />

                    {passwordMessage && (
                      <p className="text-sm font-bold text-emerald-600">
                        {passwordMessage}
                      </p>
                    )}

                    {passwordError && (
                      <p className="text-sm font-bold text-red-600">
                        {passwordError}
                      </p>
                    )}

                    <button
                      disabled={isChangingPassword}
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {isChangingPassword ? "Updating..." : "Update Password"}
                    </button>
                  </form>
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
