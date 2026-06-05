const express = require("express");
const Task = require("../models/Task");
const User = require("../models/User");
const Project = require("../models/Project");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

const escapeCsv = (value) => {
  if (value === null || value === undefined) return "";

  const stringValue = String(value).replace(/"/g, '""');

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue}"`;
  }

  return stringValue;
};

const sendCsv = (res, filename, rows) => {
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );

  res.send(csv);
};

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleString("en-IN");
};

const taskRows = (tasks) => {
  const rows = [
    [
      "Task Code",
      "Title",
      "Project",
      "Assignees",
      "Status",
      "Priority",
      "Due Date",
      "Labels",
      "Checklist Progress",
      "Attachments",
      "Comments",
      "Archived",
      "Created At",
      "Updated At"
    ]
  ];

  tasks.forEach((task) => {
    const checklist = task.checklist || [];
    const checklistDone = checklist.filter((item) => item.isDone).length;

    rows.push([
      task.taskCode || "",
      task.title || "",
      task.project?.name || "",
      Array.isArray(task.assignedTo)
        ? task.assignedTo.map((user) => user.name).join("; ")
        : "",
      task.status || "",
      task.priority || "",
      formatDate(task.dueDate),
      (task.labels || []).join("; "),
      `${checklistDone}/${checklist.length}`,
      task.attachments?.length || 0,
      task.comments?.length || 0,
      task.isArchived ? "Yes" : "No",
      formatDate(task.createdAt),
      formatDate(task.updatedAt)
    ]);
  });

  return rows;
};

router.get("/tasks", protect, adminOnly, async (req, res) => {
  try {
    const tasks = await Task.find({ isArchived: { $ne: true } })
      .populate("project", "name")
      .populate("assignedTo", "name email role")
      .sort({ createdAt: -1 });

    sendCsv(res, "active-tasks.csv", taskRows(tasks));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/tasks/overdue", protect, adminOnly, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tasks = await Task.find({
      isArchived: { $ne: true },
      status: { $ne: "closed" },
      dueDate: { $lt: today }
    })
      .populate("project", "name")
      .populate("assignedTo", "name email role")
      .sort({ dueDate: 1 });

    sendCsv(res, "overdue-tasks.csv", taskRows(tasks));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/tasks/archived", protect, adminOnly, async (req, res) => {
  try {
    const tasks = await Task.find({ isArchived: true })
      .populate("project", "name")
      .populate("assignedTo", "name email role")
      .sort({ archivedAt: -1 });

    sendCsv(res, "archived-tasks.csv", taskRows(tasks));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/users", protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    const rows = [
      ["Name", "Email", "Role", "Created At", "Updated At"]
    ];

    users.forEach((user) => {
      rows.push([
        user.name || "",
        user.email || "",
        user.role || "",
        formatDate(user.createdAt),
        formatDate(user.updatedAt)
      ]);
    });

    sendCsv(res, "users.csv", rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/projects", protect, adminOnly, async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("parentProject", "name")
      .populate("members", "name email role")
      .sort({ createdAt: -1 });

    const rows = [
      [
        "Project Name",
        "Description",
        "Parent Project",
        "Members",
        "Created At",
        "Updated At"
      ]
    ];

    projects.forEach((project) => {
      rows.push([
        project.name || "",
        project.description || "",
        project.parentProject?.name || "Main Project",
        project.members?.map((member) => member.name).join("; ") || "",
        formatDate(project.createdAt),
        formatDate(project.updatedAt)
      ]);
    });

    sendCsv(res, "projects.csv", rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
