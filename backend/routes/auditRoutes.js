const express = require("express");
const Task = require("../models/Task");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("project", "name")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("activityLogs.user", "name email role")
      .sort({ updatedAt: -1 });

    const logs = [];

    tasks.forEach((task) => {
      (task.activityLogs || []).forEach((log) => {
        logs.push({
          _id: `${task._id}-${log._id}`,
          taskId: task._id,
          taskCode: task.taskCode,
          taskTitle: task.title,
          project: task.project?.name || "No project",
          action: log.action || "Activity",
          details: log.details || "",
          user: log.user
            ? {
                name: log.user.name,
                email: log.user.email,
                role: log.user.role
              }
            : null,
          createdAt: log.createdAt || task.updatedAt
        });
      });
    });

    logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(logs.slice(0, 300));
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

module.exports = router;
