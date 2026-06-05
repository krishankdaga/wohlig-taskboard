import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

const GlobalSearch = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState({
    tasks: [],
    projects: [],
    users: [],
    messages: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults({
        tasks: [],
        projects: [],
        users: [],
        messages: []
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults({
          tasks: [],
          projects: [],
          users: [],
          messages: []
        });
        return;
      }

      try {
        setLoading(true);
        const { data } = await API.get(`/search?q=${encodeURIComponent(query)}`);
        setResults(data);
      } catch (error) {
        console.log("Search failed");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const goToProject = (projectId) => {
    navigate(`/board?project=${projectId}`);
    onClose();
  };

  const goToBoard = () => {
    navigate("/board");
    onClose();
  };

  const goToMessages = () => {
    navigate("/messages");
    onClose();
  };

  const totalResults =
    results.tasks.length +
    results.projects.length +
    results.users.length +
    results.messages.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[999] flex items-start justify-center p-4 pt-20">
      <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center gap-4">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, users, messages..."
            className="input-modern text-lg"
          />

          <button
            onClick={onClose}
            className="h-12 w-12 rounded-2xl bg-slate-100 hover:bg-slate-200 font-black"
          >
            ✕
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-auto">
          {!query.trim() ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">🔎</p>
              <p className="font-black text-slate-800">
                Start typing to search your workspace
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Search tasks, projects, users, and messages.
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-16">
              <p className="font-black text-slate-800">Searching...</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">😶</p>
              <p className="font-black text-slate-800">No results found</p>
              <p className="text-sm text-slate-500 mt-1">
                Try another keyword.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {results.tasks.length > 0 && (
                <section>
                  <p className="text-xs font-black text-blue-600 uppercase tracking-wider mb-3">
                    Tasks
                  </p>

                  <div className="space-y-2">
                    {results.tasks.map((task) => (
                      <button
                        key={task._id}
                        onClick={goToBoard}
                        className="w-full text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-2xl p-4 transition"
                      >
                        <div className="flex items-center gap-2">
                          {task.taskCode && (
                            <span className="text-xs font-black bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-full">
                              {task.taskCode}
                            </span>
                          )}

                          <p className="font-black text-slate-900">{task.title}</p>
                        </div>

                        <p className="text-sm text-slate-500 mt-2">
                          {task.project?.name} · {task.status?.replace("_", " ")} · {task.priority}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {results.projects.length > 0 && (
                <section>
                  <p className="text-xs font-black text-violet-600 uppercase tracking-wider mb-3">
                    Projects
                  </p>

                  <div className="space-y-2">
                    {results.projects.map((project) => (
                      <button
                        key={project._id}
                        onClick={() => goToProject(project._id)}
                        className="w-full text-left bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-200 rounded-2xl p-4 transition"
                      >
                        <p className="font-black text-slate-900">
                          {project.name}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          {project.members?.length || 0} members
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {results.users.length > 0 && (
                <section>
                  <p className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-3">
                    Users
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {results.users.map((user) => (
                      <button
                        key={user._id}
                        onClick={goToMessages}
                        className="text-left bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-2xl p-4 transition"
                      >
                        <p className="font-black text-slate-900">{user.name}</p>
                        <p className="text-sm text-slate-500 mt-1">
                          {user.email} · {user.role}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {results.messages.length > 0 && (
                <section>
                  <p className="text-xs font-black text-amber-600 uppercase tracking-wider mb-3">
                    Messages
                  </p>

                  <div className="space-y-2">
                    {results.messages.map((message) => (
                      <button
                        key={message._id}
                        onClick={goToMessages}
                        className="w-full text-left bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-2xl p-4 transition"
                      >
                        <p className="font-black text-slate-900">
                          {message.sender?.name}
                        </p>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                          {message.text}
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                          {message.messageType === "project"
                            ? message.project?.name
                            : "Direct message"}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
