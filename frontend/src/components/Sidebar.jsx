import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  const navClass = (path) =>
    `block px-5 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
      location.pathname === path
        ? "bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-950"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    }`;

  const mobileNavClass = (path) =>
    `flex flex-col items-center justify-center rounded-2xl py-2 text-[11px] font-black transition-all duration-200 ${
      location.pathname === path
        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
        : "text-slate-500 dark:text-slate-300"
    }`;

  return (
    <>
      <aside className="hidden lg:flex w-72 h-screen bg-white/90 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-5 flex-col sticky top-0 shrink-0 overflow-hidden">
        <div className="flex items-center gap-3 mb-8 shrink-0">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm border border-slate-100 dark:border-slate-800">
            <img
              src="/wohlig-logo.png"
              alt="Wohlig Logo"
              className="h-10 w-auto object-contain"
            />
          </div>
        </div>

        <nav className="space-y-2 overflow-auto hide-scrollbar pr-1 flex-1">
          <Link to="/dashboard" className={navClass("/dashboard")}>
            Dashboard
          </Link>

          <Link to="/board" className={navClass("/board")}>
            Kanban Board
          </Link>

          <Link to="/messages" className={navClass("/messages")}>
            Messages
          </Link>

          <Link to="/chatbot" className={navClass("/chatbot")}>
            Assistant
          </Link>

          <Link to="/profile" className={navClass("/profile")}>
            Profile
          </Link>

          {user?.role === "admin" && (
            <Link to="/admin" className={navClass("/admin")}>
              Admin Panel
            </Link>
          )}
        </nav>

        <div className="shrink-0 mt-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs font-black text-slate-400 uppercase">
            Logged in as
          </p>
          <p className="text-sm font-black text-slate-900 dark:text-white mt-1">
            {user?.name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
            {user?.role}
          </p>
        </div>
      </aside>

      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl p-2">
        <div className="grid grid-cols-5 gap-1">
          <Link to="/dashboard" className={mobileNavClass("/dashboard")}>
            <span>Home</span>
          </Link>

          <Link to="/board" className={mobileNavClass("/board")}>
            <span>Board</span>
          </Link>

          <Link to="/messages" className={mobileNavClass("/messages")}>
            <span>Chat</span>
          </Link>

          <Link to="/chatbot" className={mobileNavClass("/chatbot")}>
            <span>AI</span>
          </Link>

          {user?.role === "admin" ? (
            <Link to="/admin" className={mobileNavClass("/admin")}>
              <span>Admin</span>
            </Link>
          ) : (
            <Link to="/profile" className={mobileNavClass("/profile")}>
              <span>Profile</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
