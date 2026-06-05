const priorityStyles = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200"
};

const formatDate = (date) => {
  if (!date) return "No due date";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short"
  });
};

const getAssignees = (assignedTo) => {
  if (!assignedTo) return [];
  return Array.isArray(assignedTo) ? assignedTo : [assignedTo];
};

const getDueStatus = (dueDate, status) => {
  if (status === "closed") {
    return {
      label: "Completed",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200"
    };
  }

  if (!dueDate) {
    return {
      label: "No due date",
      className: "bg-slate-50 text-slate-500 border-slate-200"
    };
  }

  const today = new Date();
  const due = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: "Overdue",
      className: "bg-red-50 text-red-700 border-red-200"
    };
  }

  if (diffDays === 0) {
    return {
      label: "Due today",
      className: "bg-amber-50 text-amber-700 border-amber-200"
    };
  }

  if (diffDays === 1) {
    return {
      label: "Due tomorrow",
      className: "bg-blue-50 text-blue-700 border-blue-200"
    };
  }

  return {
    label: `${diffDays} days left`,
    className: "bg-slate-50 text-slate-600 border-slate-200"
  };
};

const TaskCard = ({ task, dragProvided, onClick }) => {
  const assignees = getAssignees(task.assignedTo);
  const dueStatus = getDueStatus(task.dueDate, task.status);
  const labels = task.labels || [];
  const checklist = task.checklist || [];
  const checklistDone = checklist.filter((item) => item.isDone).length;
  const checklistTotal = checklist.length;
  const checklistPercentage =
    checklistTotal === 0 ? 0 : Math.round((checklistDone / checklistTotal) * 100);

  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      {...dragProvided.dragHandleProps}
      onClick={() => onClick(task)}
      className={`group bg-white rounded-2xl border p-4 shadow-sm mb-3 hover:shadow-xl hover:-translate-y-0.5 transition cursor-pointer ${
        dueStatus.label === "Overdue"
          ? "border-red-200"
          : dueStatus.label === "Due today"
          ? "border-amber-200"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {task.taskCode && (
            <p className="text-[10px] font-black text-blue-600 mb-1">
              {task.taskCode}
            </p>
          )}

          <h3 className="font-bold text-slate-900 text-sm leading-snug">
            {task.title}
          </h3>
        </div>

        <span
          className={`text-[10px] px-2 py-1 rounded-full border font-bold uppercase ${
            priorityStyles[task.priority] || priorityStyles.medium
          }`}
        >
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="text-[10px] px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100 font-black"
            >
              {label}
            </span>
          ))}

          {labels.length > 3 && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200 font-black">
              +{labels.length - 3}
            </span>
          )}
        </div>
      )}

      {checklistTotal > 0 && (
        <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-black text-slate-500">
              Checklist
            </p>
            <p className="text-[11px] font-black text-slate-500">
              {checklistDone}/{checklistTotal}
            </p>
          </div>

          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full"
              style={{ width: `${checklistPercentage}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className={`text-[11px] px-2.5 py-1 rounded-full border font-bold ${dueStatus.className}`}
        >
          {dueStatus.label}
        </span>

        {task.dueDate && (
          <span className="text-[11px] px-2.5 py-1 rounded-full border font-bold bg-white text-slate-500 border-slate-200">
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Project</span>
          <span className="font-semibold text-slate-700 truncate max-w-28">
            {task.project?.name}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {assignees.slice(0, 3).map((employee) => (
              <div
                key={employee._id}
                className="h-7 w-7 rounded-full bg-blue-600 border-2 border-white text-white text-xs flex items-center justify-center font-bold"
                title={employee.name}
              >
                {employee.name?.charAt(0)?.toUpperCase()}
              </div>
            ))}
          </div>

          <span className="ml-2 text-xs font-semibold text-slate-600">
            {assignees.length === 1
              ? assignees[0]?.name
              : `${assignees.length} assignees`}
          </span>
        </div>

        <span className="text-xs text-slate-400">Open →</span>
      </div>
    </div>
  );
};

export default TaskCard;
