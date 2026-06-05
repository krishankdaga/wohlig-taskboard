import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import API from "../api/axios";

const Calendar = () => {
  const [tasks, setTasks] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fetchTasks = async () => {
    const { data } = await API.get("/tasks");
    setTasks(data);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];

  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  const isSameDate = (a, b) => {
    return (
      a &&
      b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  };

  const tasksByDate = useMemo(() => {
    const map = {};

    tasks.forEach((task) => {
      if (!task.dueDate) return;

      const due = new Date(task.dueDate);
      const key = due.toISOString().slice(0, 10);

      if (!map[key]) map[key] = [];

      map[key].push(task);
    });

    return map;
  }, [tasks]);

  const selectedKey = selectedDate.toISOString().slice(0, 10);
  const selectedTasks = tasksByDate[selectedKey] || [];

  const monthName = currentDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });

  const goPrevious = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goNext = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-black">
      <Sidebar />

      <main className="flex-1 min-w-0 min-h-screen bg-slate-50 dark:bg-black">
        <Navbar />

        <div className="p-4 md:p-8 pb-28 lg:pb-8 max-w-7xl mx-auto">
          <section className="glass-card rounded-3xl md:rounded-[32px] p-6 md:p-8 mb-6">
            <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
              Timeline
            </p>

            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mt-2">
              Calendar
            </h1>

            <p className="text-slate-500 dark:text-neutral-400 mt-3 max-w-2xl">
              View upcoming deadlines and task due dates across your accessible projects.
            </p>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
            <section className="glass-card rounded-3xl p-5 md:p-6">
              <div className="flex items-center justify-between gap-4 mb-6">
                <button
                  onClick={goPrevious}
                  className="px-4 py-2 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 font-black text-slate-600 dark:text-neutral-300"
                >
                  Previous
                </button>

                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  {monthName}
                </h2>

                <button
                  onClick={goNext}
                  className="px-4 py-2 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 font-black text-slate-600 dark:text-neutral-300"
                >
                  Next
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-black text-slate-400 dark:text-neutral-500 uppercase py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} />;
                  }

                  const key = date.toISOString().slice(0, 10);
                  const dayTasks = tasksByDate[key] || [];
                  const isSelected = isSameDate(date, selectedDate);
                  const isToday = isSameDate(date, new Date());

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDate(date)}
                      className={`min-h-24 rounded-3xl border p-3 text-left transition ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white dark:bg-neutral-950 border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white hover:border-blue-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black">
                          {date.getDate()}
                        </span>

                        {isToday && (
                          <span
                            className={`text-[10px] font-black px-2 py-1 rounded-full ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            Today
                          </span>
                        )}
                      </div>

                      {dayTasks.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <div
                            className={`text-[11px] font-black ${
                              isSelected ? "text-white" : "text-blue-600"
                            }`}
                          >
                            {dayTasks.length} task{dayTasks.length === 1 ? "" : "s"}
                          </div>

                          <div className="flex gap-1">
                            {dayTasks.slice(0, 3).map((task) => (
                              <span
                                key={task._id}
                                className={`h-1.5 w-5 rounded-full ${
                                  task.priority === "high"
                                    ? "bg-red-500"
                                    : task.priority === "medium"
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="glass-card rounded-3xl p-5 md:p-6">
              <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                Selected Date
              </p>

              <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {selectedDate.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric"
                })}
              </h2>

              <div className="space-y-3 mt-5">
                {selectedTasks.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 dark:border-neutral-800 p-6 text-center">
                    <p className="text-sm font-bold text-slate-400">
                      No tasks due on this date.
                    </p>
                  </div>
                ) : (
                  selectedTasks.map((task) => (
                    <div
                      key={task._id}
                      className="rounded-3xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-5"
                    >
                      <p className="text-xs font-black text-blue-600">
                        {task.taskCode}
                      </p>

                      <h3 className="font-black text-slate-900 dark:text-white mt-1">
                        {task.title}
                      </h3>

                      <p className="text-sm text-slate-500 dark:text-neutral-400 mt-2">
                        {task.project?.name} · {task.status?.replace("_", " ")} · {task.priority}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Calendar;
