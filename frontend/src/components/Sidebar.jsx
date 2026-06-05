import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  const navClass = (path) =>
    `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition ${
      location.pathname === path
        ? "bg-slate-900 text-white shadow-lg"
        : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <>
      <aside className="hidden lg:flex w-72 min-h-screen bg-white/80 backdrop-blur-xl border-r border-slate-200 p-5 flex-col sticky top-0">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100">
            <img
              src="/wohlig-logo.png"
              alt="Wohlig Logo"
              className="h-10 w-auto object-contain"
            />
          </div>
        </div>

        <nav className="space-y-2">
          <Link to="/dashboard" className={navClass("/dashboard")}>
            <span>📊</span>
            <span>Dashboard</span>
          </Link>

          <Link to="/board" className={navClass("/board")}>
            <span>📋</span>
            <span>Kanban Board</span>
          </Link>

          <Link to="/messages" className={navClass("/messages")}>
            <span>💬</span>
            <span>Messages</span>
          </Link>

          {user?.role === "admin" && (
            <Link to="/admin" className={navClass("/admin")}>
              <span>⚙️</span>
              <span>Admin Panel</span>
            </Link>
          )}
        </nav>

        <div className="mt-auto rounded-3xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs font-black text-slate-400 uppercase">
            Logged in as
          </p>
          <p className="text-sm font-black text-slate-900 mt-1">
            {user?.name}
          </p>
          <p className="text-xs text-slate-500 capitalize">
            {user?.role}
          </p>
        </div>
      </aside>

      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-3xl p-2">
        <div className="grid grid-cols-4 gap-2">
          <Link
            to="/dashboard"
            className={`flex flex-col items-center justify-center rounded-2xl py-2 text-xs font-black ${
              location.pathname === "/dashboard"
                ? "bg-slate-900 text-white"
                : "text-slate-500"
            }`}
          >
            <span className="text-lg">📊</span>
            <span>Home</span>
          </Link>

          <Link
            to="/board"
            className={`flex flex-col items-center justify-center rounded-2xl py-2 text-xs font-black ${
              location.pathname === "/board"
                ? "bg-slate-900 text-white"
                : "text-slate-500"
            }`}
          >
            <span className="text-lg">📋</span>
            <span>Board</span>
          </Link>

          <Link
            to="/messages"
            className={`flex flex-col items-center justify-center rounded-2xl py-2 text-xs font-black ${
              location.pathname === "/messages"
                ? "bg-slate-900 text-white"
                : "text-slate-500"
            }`}
          >
            <span className="text-lg">💬</span>
            <span>Chat</span>
          </Link>

          {user?.role === "admin" ? (
            <Link
              to="/admin"
              className={`flex flex-col items-center justify-center rounded-2xl py-2 text-xs font-black ${
                location.pathname === "/admin"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500"
              }`}
            >
              <span className="text-lg">⚙️</span>
              <span>Admin</span>
            </Link>
          ) : (
            <Link
              to="/board"
              className="flex flex-col items-center justify-center rounded-2xl py-2 text-xs font-black text-slate-500"
            >
              <span className="text-lg">✅</span>
              <span>Tasks</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
