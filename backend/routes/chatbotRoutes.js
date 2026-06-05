const express = require("express");
const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const normalize = (text) => {
  return (text || "").toLowerCase().trim();
};

const cleanStatus = (status) => {
  return status?.replace("_", " ") || "";
};

const formatDate = (date) => {
  if (!date) return "No due date";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const formatTask = (task) => {
  const assignees =
    task.assignedTo?.map((user) => user.name).join(", ") || "Unassigned";

  return `${task.taskCode || "No Code"} - ${task.title}
Project: ${task.project?.name || "No project"}
Status: ${cleanStatus(task.status)}
Priority: ${task.priority}
Assignees: ${assignees}
Due: ${formatDate(task.dueDate)}`;
};

const getAccessibleProjectIds = async (user) => {
  if (user.role === "admin") {
    const projects = await Project.find().select("_id");
    return projects.map((project) => project._id);
  }

  const projects = await Project.find({
    members: user._id
  }).select("_id");

  return projects.map((project) => project._id);
};

const getAccessibleProjects = async (user) => {
  const projectIds = await getAccessibleProjectIds(user);

  return Project.find({
    _id: { $in: projectIds }
  }).populate("members", "name email role");
};

const findProjectFromQuestion = async (question, user) => {
  const q = normalize(question);
  const projects = await getAccessibleProjects(user);

  let matchedProject = projects.find((project) =>
    q.includes(project.name.toLowerCase())
  );

  if (matchedProject) return matchedProject;

  const words = q.split(/\s+/).filter((word) => word.length > 2);

  matchedProject = projects.find((project) => {
    const projectWords = project.name.toLowerCase().split(/\s+/);
    return projectWords.some((word) => words.includes(word));
  });

  return matchedProject || null;
};

const findEmployeeFromQuestion = async (question) => {
  const q = normalize(question);

  const users = await User.find().select("name email role");

  return users.find((user) => {
    return (
      q.includes(user.name.toLowerCase()) ||
      q.includes(user.email.toLowerCase())
    );
  });
};

const buildTaskFilter = async (question, user) => {
  const q = normalize(question);
  const accessibleProjectIds = await getAccessibleProjectIds(user);
  const project = await findProjectFromQuestion(question, user);
  const employee = await findEmployeeFromQuestion(question);

  const filter = {
    isArchived: { $ne: true },
    project: { $in: accessibleProjectIds }
  };

  if (project) {
    filter.project = project._id;
  }

  if (
    q.includes("my ") ||
    q.includes("assigned to me") ||
    q.includes("given to me") ||
    q.includes("i have") ||
    q.includes("for me")
  ) {
    filter.assignedTo = user._id;
  }

  if (employee) {
    filter.assignedTo = employee._id;
  }

  if (q.includes("high priority") || q.includes("urgent")) {
    filter.priority = "high";
  }

  if (q.includes("medium priority")) {
    filter.priority = "medium";
  }

  if (q.includes("low priority")) {
    filter.priority = "low";
  }

  if (q.includes("backlog")) {
    filter.status = "backlog";
  }

  if (q.includes("to do") || q.includes("todo")) {
    filter.status = "todo";
  }

  if (q.includes("in progress")) {
    filter.status = "in_progress";
  }

  if (q.includes("review")) {
    filter.status = "review";
  }

  if (q.includes("closed") || q.includes("completed") || q.includes("done")) {
    filter.status = "closed";
  }

  if (
    q.includes("left") ||
    q.includes("pending") ||
    q.includes("remaining") ||
    q.includes("not completed") ||
    q.includes("not closed") ||
    q.includes("open")
  ) {
    filter.status = { $ne: "closed" };
  }

  return { filter, project, employee };
};

const answerWithTaskList = async ({ title, filter, sort = { createdAt: -1 } }) => {
  const tasks = await Task.find(filter)
    .populate("assignedTo", "name email role")
    .populate("project", "name")
    .sort(sort)
    .limit(20);

  if (tasks.length === 0) {
    return "No matching tasks found.";
  }

  return `${title}:\n\n${tasks
    .map((task, index) => `${index + 1}. ${formatTask(task)}`)
    .join("\n\n")}`;
};

router.post("/ask", protect, async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        answer: "Please ask a question."
      });
    }

    const q = normalize(question);
    const accessibleProjectIds = await getAccessibleProjectIds(req.user);
    const project = await findProjectFromQuestion(question, req.user);

    const baseTaskFilter = {
      isArchived: { $ne: true },
      project: { $in: accessibleProjectIds }
    };

    // Project members / employees
    if (
      q.includes("employee") ||
      q.includes("member") ||
      q.includes("team")
    ) {
      if (project) {
        const members = project.members || [];

        if (members.length === 0) {
          return res.json({
            answer: `No employees are assigned to ${project.name}.`
          });
        }

        return res.json({
          answer: `Employees under ${project.name}:\n\n${members
            .map(
              (member, index) =>
                `${index + 1}. ${member.name} (${member.email}) - ${member.role}`
            )
            .join("\n")}`
        });
      }

      const projects = await getAccessibleProjects(req.user);

      return res.json({
        answer: `I found these accessible projects and members:\n\n${projects
          .map((p) => {
            const members =
              p.members?.map((m) => `${m.name} (${m.role})`).join(", ") ||
              "No members";
            return `- ${p.name}: ${members}`;
          })
          .join("\n")}`
      });
    }

    // Overdue tasks
    if (q.includes("overdue") || q.includes("delayed") || q.includes("late")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { filter } = await buildTaskFilter(question, req.user);

      filter.status = { $ne: "closed" };
      filter.dueDate = { $lt: today };

      const answer = await answerWithTaskList({
        title: "Overdue tasks",
        filter,
        sort: { dueDate: 1 }
      });

      return res.json({ answer });
    }

    // Due today
    if (q.includes("due today") || q.includes("today deadline")) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { filter } = await buildTaskFilter(question, req.user);

      filter.status = { $ne: "closed" };
      filter.dueDate = { $gte: start, $lt: end };

      const answer = await answerWithTaskList({
        title: "Tasks due today",
        filter,
        sort: { dueDate: 1 }
      });

      return res.json({ answer });
    }

    // Latest / last due date
    if (
      q.includes("last date") ||
      q.includes("latest due") ||
      q.includes("last due") ||
      q.includes("deadline") ||
      q.includes("due date")
    ) {
      const { filter } = await buildTaskFilter(question, req.user);

      filter.status = { $ne: "closed" };
      filter.dueDate = { $ne: null };

      if (req.user.role !== "admin") {
        filter.assignedTo = req.user._id;
      }

      const task = await Task.findOne(filter)
        .populate("assignedTo", "name email role")
        .populate("project", "name")
        .sort({ dueDate: -1 });

      if (!task) {
        return res.json({
          answer: "I could not find any pending task with a due date."
        });
      }

      return res.json({
        answer: `The latest due date I found is:\n\n${formatTask(task)}`
      });
    }

    // Count questions
    if (
      q.startsWith("how many") ||
      q.includes("count") ||
      q.includes("number of")
    ) {
      const { filter } = await buildTaskFilter(question, req.user);

      const count = await Task.countDocuments(filter);

      return res.json({
        answer: `I found ${count} matching task${count === 1 ? "" : "s"}.`
      });
    }

    // Summary / overview
    if (
      q.includes("summary") ||
      q.includes("overview") ||
      q.includes("status report") ||
      q.includes("dashboard")
    ) {
      const tasks = await Task.find(baseTaskFilter);

      const counts = {
        backlog: tasks.filter((task) => task.status === "backlog").length,
        todo: tasks.filter((task) => task.status === "todo").length,
        inProgress: tasks.filter((task) => task.status === "in_progress").length,
        review: tasks.filter((task) => task.status === "review").length,
        closed: tasks.filter((task) => task.status === "closed").length,
        pending: tasks.filter((task) => task.status !== "closed").length
      };

      return res.json({
        answer:
          `Workspace task summary:\n\n` +
          `Backlog: ${counts.backlog}\n` +
          `To Do: ${counts.todo}\n` +
          `In Progress: ${counts.inProgress}\n` +
          `Review: ${counts.review}\n` +
          `Closed: ${counts.closed}\n` +
          `Pending: ${counts.pending}`
      });
    }

    // Generic task listing
    if (
      q.includes("task") ||
      q.includes("work") ||
      q.includes("assigned") ||
      q.includes("left") ||
      q.includes("pending") ||
      q.includes("remaining") ||
      q.includes("high priority") ||
      q.includes("urgent")
    ) {
      const { filter } = await buildTaskFilter(question, req.user);

      const answer = await answerWithTaskList({
        title: "Matching tasks",
        filter,
        sort: { dueDate: 1, createdAt: -1 }
      });

      return res.json({ answer });
    }

    // Project listing
    if (q.includes("project") || q.includes("projects")) {
      const projects = await getAccessibleProjects(req.user);

      if (projects.length === 0) {
        return res.json({
          answer: "No accessible projects found."
        });
      }

      return res.json({
        answer: `Accessible projects:\n\n${projects
          .map((p, index) => {
            const memberCount = p.members?.length || 0;
            return `${index + 1}. ${p.name} - ${memberCount} member${memberCount === 1 ? "" : "s"}`;
          })
          .join("\n")}`
      });
    }

    return res.json({
      answer:
        "I can answer workspace questions from the database.\n\nTry asking things like:\n- Show my pending tasks\n- Which high priority tasks are left?\n- Who is in Project Genesis?\n- What tasks are under GenAI Training?\n- How many tasks are in review?\n- Which tasks are overdue?\n- What is my latest due date?"
    });
  } catch (error) {
    res.status(500).json({
      answer: "Something went wrong while answering your question.",
      error: error.message
    });
  }
});

module.exports = router;
