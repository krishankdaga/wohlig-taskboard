import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "./NotificationBell";

const Navbar = () => {
  const { user } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleShortcut = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }

      if (e.key === "Escape") {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  return (
    <>
      <header className="h-20 bg-white/80 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/wohlig-logo.png"
            alt="Wohlig Logo"
            className="h-8 md:h-9 w-auto object-contain"
          />

          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Workspace
            </p>
            <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
              TaskBoard
            </h1>
          </div>
        </div>

        <button
          onClick={() => setIsSearchOpen(true)}
          className="hidden md:flex items-center gap-3 w-[360px] xl:w-[460px] bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-left transition-all duration-200"
        >
          <span className="text-lg">🔎</span>

          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">
            Search tasks, projects, users, messages...
          </span>

          <span className="ml-auto text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded-lg text-slate-400 font-bold">
            ⌘K
          </span>
        </button>

        <div className="flex items-center gap-3 md:gap-4">
          <NotificationBell />

          <Link to="/profile" className="hidden md:block text-right hover:opacity-80 transition">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {user?.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
              {user?.role}
            </p>
          </Link>

          <Link
            to="/profile"
            className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold hover:scale-105 transition-transform duration-200"
          >
            {user?.name?.charAt(0)?.toUpperCase()}
          </Link>
        </div>
      </header>

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
};

export default Navbar;
