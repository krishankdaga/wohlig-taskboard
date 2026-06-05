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

  const mobileNavClass = (path) =>
    `flex flex-col items-center justify-center rounded-2xl py-2 text-[11px] font-black ${
      location.pathname === path
        ? "bg-slate-900 text-white"
        : "text-slate-500"
    }`;

  const NavDot = ({ label }) => (
    <span className="h-7 w-7 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600">
      {label}
    </span>
  );

  return (
    <>
      <aside className="hidden lg:flex w-72 h-screen bg-white/80 backdrop-blur-xl border-r border-slate-200 p-5 flex-col sticky top-0 shrink-0 overflow-hidden">
        <div className="flex items-center gap-3 mb-8 shrink-0">
          <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100">
            <img
              src="/wohlig-logo.png"
              alt="Wohlig Logo"
              className="h-10 w-auto object-contain"
            />
          </div>
        </div>

        <nav className="space-y-2 overflow-auto hide-scrollbar pr-1 flex-1">
          <Link to="/dashboard" className={navClass("/dashboard")}>
            <NavDot label="DB" />
            <span>Dashboard</span>
          </Link>

          <Link to="/board" className={navClass("/board")}>
            <NavDot label="KB" />
            <span>Kanban Board</span>
          </Link>

          <Link to="/messages" className={navClass("/messages")}>
            <NavDot label="MS" />
            <span>Messages</span>
          </Link>

          <Link to="/chatbot" className={navClass("/chatbot")}>
            <NavDot label="AI" />
            <span>Assistant</span>
          </Link>

          {user?.role === "admin" && (
            <Link to="/admin" className={navClass("/admin")}>
              <NavDot label="AD" />
              <span>Admin Panel</span>
            </Link>
          )}
        </nav>

        <div className="shrink-0 mt-5 rounded-3xl bg-slate-50 border border-slate-200 p-4">
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
        <div className="grid grid-cols-5 gap-1">
          <Link to="/dashboard" className={mobileNavClass("/dashboard")}>
            <span>DB</span>
            <span>Home</span>
          </Link>

          <Link to="/board" className={mobileNavClass("/board")}>
            <span>KB</span>
            <span>Board</span>
          </Link>

          <Link to="/messages" className={mobileNavClass("/messages")}>
            <span>MS</span>
            <span>Chat</span>
          </Link>

          <Link to="/chatbot" className={mobileNavClass("/chatbot")}>
            <span>AI</span>
            <span>AI</span>
          </Link>

          {user?.role === "admin" ? (
            <Link to="/admin" className={mobileNavClass("/admin")}>
              <span>AD</span>
              <span>Admin</span>
            </Link>
          ) : (
            <Link to="/board" className={mobileNavClass("/tasks")}>
              <span>TK</span>
              <span>Tasks</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
