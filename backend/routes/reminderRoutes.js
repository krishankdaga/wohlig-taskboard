const express = require("express");
const Task = require("../models/Task");
const Notification = require("../models/Notification");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

const isTaskOverdue = (task) => {
  if (!task.dueDate || task.status === "closed") return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(task.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
};

router.post("/overdue", protect, adminOnly, async (req, res) => {
  try {
    const tasks = await Task.find({
      isArchived: { $ne: true },
      status: { $ne: "closed" },
      dueDate: { $exists: true, $ne: null }
    })
      .populate("assignedTo", "name email role")
      .populate("project", "name")
      .sort({ dueDate: 1 });

    const overdueTasks = tasks.filter(isTaskOverdue);

    if (overdueTasks.length === 0) {
      return res.json({
        message: "No overdue tasks found.",
        overdueTasks: 0,
        notificationsSent: 0
      });
    }

    const io = req.app.get("io");
    let notificationsSent = 0;
    const notifiedUsers = new Set();

    for (const task of overdueTasks) {
      const assignees = task.assignedTo || [];

      for (const assignee of assignees) {
        const notification = await Notification.create({
          recipient: assignee._id,
          title: "Overdue Task Reminder",
          message: `${task.taskCode} - ${task.title} is overdue. Project: ${
            task.project?.name || "No project"
          }`,
          type: "task_status",
          task: task._id,
          project: task.project?._id || task.project
        });

        io.to(assignee._id.toString()).emit("notificationCreated", notification);

        notificationsSent += 1;
        notifiedUsers.add(assignee._id.toString());
      }

      task.activityLogs = task.activityLogs || [];
      task.activityLogs.push({
        user: req.user._id,
        action: "Overdue Reminder Sent",
        details: `Reminder sent for overdue task ${task.taskCode}`
      });

      await task.save();
    }

    res.json({
      message: "Overdue reminders sent successfully.",
      overdueTasks: overdueTasks.length,
      notificationsSent,
      usersNotified: notifiedUsers.size,
      tasks: overdueTasks.map((task) => ({
        _id: task._id,
        taskCode: task.taskCode,
        title: task.title,
        project: task.project?.name || "No project",
        dueDate: task.dueDate,
        assignees: task.assignedTo.map((user) => user.name)
      }))
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

module.exports = router;
