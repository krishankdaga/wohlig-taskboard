const express = require("express");
const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const normalize = (text) => {
  return (text || "").toLowerCase().trim();
};

const formatTask = (task) => {
  const assignees = task.assignedTo?.map((user) => user.name).join(", ") || "Unassigned";
  const dueDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-IN")
    : "No due date";

  return `${task.taskCode || "No Code"} - ${task.title} | Status: ${task.status} | Priority: ${task.priority} | Assignees: ${assignees} | Due: ${dueDate}`;
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

const findProjectFromQuestion = async (question, user) => {
  const accessibleProjectIds = await getAccessibleProjectIds(user);

  const projects = await Project.find({
    _id: { $in: accessibleProjectIds }
  }).populate("members", "name email role");

  const q = normalize(question);

  return projects.find((project) =>
    q.includes(project.name.toLowerCase())
  );
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

    const baseTaskFilter = {
      isArchived: { $ne: true },
      project: { $in: accessibleProjectIds }
    };

    if (req.user.role !== "admin") {
      // Employees only get answers from accessible projects.
      // For personal questions, we further filter by assignment.
    }

    const project = await findProjectFromQuestion(question, req.user);

    // 1. Employees under a project
    if (
      project &&
      (
        q.includes("employees under") ||
        q.includes("members under") ||
        q.includes("employees in") ||
        q.includes("members in") ||
        q.includes("who are the employees") ||
        q.includes("who are the members")
      )
    ) {
      const members = project.members || [];

      if (members.length === 0) {
        return res.json({
          answer: `No employees are currently assigned to ${project.name}.`
        });
      }

      return res.json({
        answer: `Employees under ${project.name}:\n\n${members
          .map((member, index) => `${index + 1}. ${member.name} (${member.email}) - ${member.role}`)
          .join("\n")}`
      });
    }

    // 2. Tasks under a project
    if (
      project &&
      (
        q.includes("tasks under") ||
        q.includes("tasks in") ||
        q.includes("tasks for") ||
        q.includes("what are the tasks")
      )
    ) {
      const tasks = await Task.find({
        ...baseTaskFilter,
        project: project._id
      })
        .populate("assignedTo", "name email role")
        .populate("project", "name")
        .sort({ createdAt: -1 });

      if (tasks.length === 0) {
        return res.json({
          answer: `No active tasks found under ${project.name}.`
        });
      }

      return res.json({
        answer: `Tasks under ${project.name}:\n\n${tasks
          .map((task, index) => `${index + 1}. ${formatTask(task)}`)
          .join("\n")}`
      });
    }

    // 3. Left / pending tasks
    if (
      q.includes("left") ||
      q.includes("pending") ||
      q.includes("remaining") ||
      q.includes("not closed") ||
      q.includes("not completed")
    ) {
      const filter = {
        ...baseTaskFilter,
        status: { $ne: "closed" }
      };

      if (project) {
        filter.project = project._id;
      }

      if (q.includes("my") || q.includes("assigned to me")) {
        filter.assignedTo = req.user._id;
      }

      const tasks = await Task.find(filter)
        .populate("assignedTo", "name email role")
        .populate("project", "name")
        .sort({ dueDate: 1 });

      if (tasks.length === 0) {
        return res.json({
          answer: "No pending tasks found."
        });
      }

      return res.json({
        answer: `Pending tasks:\n\n${tasks
          .map((task, index) => `${index + 1}. ${formatTask(task)}`)
          .join("\n")}`
      });
    }

    // 4. Latest due date / last date for my tasks
    if (
      q.includes("last date") ||
      q.includes("latest task") ||
      q.includes("latest due") ||
      q.includes("due date") ||
      q.includes("deadline")
    ) {
      const filter = {
        ...baseTaskFilter,
        dueDate: { $ne: null },
        status: { $ne: "closed" }
      };

      if (project) {
        filter.project = project._id;
      }

      if (
        q.includes("my") ||
        q.includes("given") ||
        q.includes("assigned to me") ||
        req.user.role !== "admin"
      ) {
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
        answer: `The latest due date I found is for:\n\n${formatTask(task)}`
      });
    }

    // 5. Overdue tasks
    if (q.includes("overdue") || q.includes("delayed")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const filter = {
        ...baseTaskFilter,
        status: { $ne: "closed" },
        dueDate: { $lt: today }
      };

      if (project) {
        filter.project = project._id;
      }

      if (q.includes("my") || q.includes("assigned to me")) {
        filter.assignedTo = req.user._id;
      }

      const tasks = await Task.find(filter)
        .populate("assignedTo", "name email role")
        .populate("project", "name")
        .sort({ dueDate: 1 });

      if (tasks.length === 0) {
        return res.json({
          answer: "No overdue tasks found."
        });
      }

      return res.json({
        answer: `Overdue tasks:\n\n${tasks
          .map((task, index) => `${index + 1}. ${formatTask(task)}`)
          .join("\n")}`
      });
    }

    // 6. High priority tasks
    if (q.includes("high priority") || q.includes("urgent")) {
      const filter = {
        ...baseTaskFilter,
        priority: "high",
        status: { $ne: "closed" }
      };

      if (project) {
        filter.project = project._id;
      }

      if (q.includes("my") || q.includes("assigned to me")) {
        filter.assignedTo = req.user._id;
      }

      const tasks = await Task.find(filter)
        .populate("assignedTo", "name email role")
        .populate("project", "name")
        .sort({ dueDate: 1 });

      if (tasks.length === 0) {
        return res.json({
          answer: "No pending high priority tasks found."
        });
      }

      return res.json({
        answer: `High priority pending tasks:\n\n${tasks
          .map((task, index) => `${index + 1}. ${formatTask(task)}`)
          .join("\n")}`
      });
    }

    // 7. Summary
    if (
      q.includes("summary") ||
      q.includes("overview") ||
      q.includes("dashboard") ||
      q.includes("status")
    ) {
      const tasks = await Task.find(baseTaskFilter);

      const counts = {
        backlog: tasks.filter((task) => task.status === "backlog").length,
        todo: tasks.filter((task) => task.status === "todo").length,
        inProgress: tasks.filter((task) => task.status === "in_progress").length,
        review: tasks.filter((task) => task.status === "review").length,
        closed: tasks.filter((task) => task.status === "closed").length
      };

      return res.json({
        answer:
          `Workspace task summary:\n\n` +
          `Backlog: ${counts.backlog}\n` +
          `To Do: ${counts.todo}\n` +
          `In Progress: ${counts.inProgress}\n` +
          `Review: ${counts.review}\n` +
          `Closed: ${counts.closed}`
      });
    }

    return res.json({
      answer:
        "I can answer questions about projects, employees, pending tasks, overdue tasks, due dates, high priority tasks, and task summaries.\n\nTry asking:\n- Who are the employees under Project Genesis?\n- What are the tasks under GenAI Training?\n- Which tasks are left?\n- What is the last date for the latest task I have been given?\n- Show my overdue tasks."
    });
  } catch (error) {
    res.status(500).json({
      answer: "Something went wrong while answering your question.",
      error: error.message
    });
  }
});

module.exports = router;
