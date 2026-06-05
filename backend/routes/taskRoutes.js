const express = require("express");
const multer = require("multer");
const path = require("path");
const Task = require("../models/Task");
const Project = require("../models/Project");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const createNotification = require("../utils/createNotification");

const router = express.Router();

const statusLabels = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  closed: "Closed"
};

const generateTaskCode = async () => {
  const latestTask = await Task.findOne({
    taskCode: { $exists: true, $ne: null }
  }).sort({ createdAt: -1 });

  let nextNumber = 1;

  if (latestTask?.taskCode) {
    const numberPart = latestTask.taskCode.split("-")[1];
    const parsedNumber = parseInt(numberPart, 10);

    if (!Number.isNaN(parsedNumber)) {
      nextNumber = parsedNumber + 1;
    }
  }

  return `WOH-${String(nextNumber).padStart(3, "0")}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;

    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const populateTask = (query) => {
  return query
    .populate("assignedTo", "name email")
    .populate({ path: "project", select: "name parentProject projectLeads", populate: { path: "projectLeads.user", select: "name email role" } })
    .populate("comments.user", "name email role")
    .populate("activityLogs.user", "name email role")
    .populate("attachments.uploadedBy", "name email role")
    .populate("checklist.createdBy", "name email role");
};

const canUserAccessTask = async (task, user) => {
  if (user.role === "admin") return true;

  const project = await Project.findById(task.project);

  if (!project) return false;

  const isProjectMember = project.members.some(
    (id) => id.toString() === user._id.toString()
  );

  return isProjectMember;
};

const isUserAssignedToTask = (task, user) => {
  return task.assignedTo.some(
    (id) => id.toString() === user._id.toString()
  );
};

const isUserProjectLead = async (projectId, user) => {
  if (user.role === "admin") return true;

  const project = await Project.findById(projectId);

  if (!project) return false;

  return (project.projectLeads || []).some(
    (lead) => lead.user.toString() === user._id.toString()
  );
};

const adminOrProjectLead = async (req, res, next) => {
  try {
    if (req.user.role === "admin") return next();

    const task = await Task.findById(req.params.id || req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const isLead = await isUserProjectLead(task.project, req.user);

    if (!isLead) {
      return res.status(403).json({
        message: "Only admin or project lead can perform this action"
      });
    }

    req.permissionTask = task;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { title, description, project, assignedTo, status, priority, dueDate, labels } =
      req.body;

    if (!assignedTo || assignedTo.length === 0) {
      return res.status(400).json({
        message: "Please assign at least one employee"
      });
    }

    const assignees = Array.isArray(assignedTo) ? assignedTo : [assignedTo];

    const taskCode = await generateTaskCode();

    const task = await Task.create({
      taskCode,
      title,
      description,
      project,
      assignedTo: assignees,
      createdBy: req.user._id,
      status,
      priority,
      dueDate,
      labels: Array.isArray(labels) ? labels : [],
      activityLogs: [
        {
          user: req.user._id,
          action: "Task Created",
          details: `Task ${taskCode} - "${title}" was created`
        }
      ]
    });

    const populatedTask = await populateTask(Task.findById(task._id));

    req.app.get("io").emit("taskCreated", populatedTask);

    for (const assigneeId of assignees) {
      await createNotification({
        req,
        recipient: assigneeId,
        sender: req.user._id,
        type: "task_assigned",
        title: "New task assigned",
        message: `You were assigned to ${taskCode} - "${title}"`,
        task: task._id,
        project
      });
    }

    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    const { scope } = req.query;

    let tasks;

    if (req.user.role === "admin") {
      if (scope === "my") {
        tasks = await Task.find({
          assignedTo: req.user._id,
          isArchived: { $ne: true }
        });
      } else {
        tasks = await Task.find({
          isArchived: { $ne: true }
        });
      }
    } else {
      const assignedProjects = await Project.find({
        members: req.user._id
      }).select("_id");

      const projectIds = assignedProjects.map((p) => p._id);

      if (scope === "my") {
        tasks = await Task.find({
          assignedTo: req.user._id,
          project: { $in: projectIds },
          isArchived: { $ne: true },
          isArchived: { $ne: true }
        });
      } else {
        tasks = await Task.find({
          project: { $in: projectIds }
        });
      }
    }

    const populatedTasks = await Task.populate(tasks, [
      { path: "assignedTo", select: "name email" },
      { path: "project", select: "name" },
      { path: "comments.user", select: "name email role" },
      { path: "activityLogs.user", select: "name email role" },
      { path: "attachments.uploadedBy", select: "name email role" },
      { path: "checklist.createdBy", select: "name email role" }
    ]);

    res.json(populatedTasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/archived", protect, adminOnly, async (req, res) => {
  try {
    const archivedTasks = await populateTask(
      Task.find({ isArchived: true }).sort({ archivedAt: -1 })
    );

    res.json(archivedTasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id/archive", protect, adminOnly, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.isArchived = true;
    task.archivedAt = new Date();
    task.archivedBy = req.user._id;

    task.activityLogs.push({
      user: req.user._id,
      action: "Task Archived",
      details: `${task.taskCode || "Task"} was archived`
    });

    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    req.app.get("io").emit("taskArchived", { taskId: task._id });
    req.app.get("io").emit("taskUpdated", updatedTask);

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id/restore", protect, adminOnly, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.isArchived = false;
    task.archivedAt = null;
    task.archivedBy = null;

    task.activityLogs.push({
      user: req.user._id,
      action: "Task Restored",
      details: `${task.taskCode || "Task"} was restored to board`
    });

    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    req.app.get("io").emit("taskRestored", updatedTask);
    req.app.get("io").emit("taskUpdated", updatedTask);

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id", protect, adminOrProjectLead, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const allowedUpdates = [
      "title",
      "description",
      "project",
      "assignedTo",
      "status",
      "priority",
      "dueDate",
      "labels"
    ];

    const changes = [];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "status" && task.status !== req.body.status) {
          changes.push(
            `Status changed from ${statusLabels[task.status]} to ${statusLabels[req.body.status]}`
          );
        }

        if (field === "priority" && task.priority !== req.body.priority) {
          changes.push(
            `Priority changed from ${task.priority} to ${req.body.priority}`
          );
        }

        if (field === "title" && task.title !== req.body.title) {
          changes.push("Title updated");
        }

        if (field === "description" && task.description !== req.body.description) {
          changes.push("Description updated");
        }

        if (field === "dueDate") {
          const oldDate = task.dueDate
            ? new Date(task.dueDate).toDateString()
            : "";
          const newDate = req.body.dueDate
            ? new Date(req.body.dueDate).toDateString()
            : "";

          if (oldDate !== newDate) {
            changes.push("Due date updated");
          }
        }

        if (field === "assignedTo") {
          changes.push("Assignees updated");
        }

        if (field === "project") {
          changes.push("Project changed");
        }

        if (field === "labels") {
          changes.push("Labels updated");
        }

        task[field] = req.body[field];
      }
    });

    if (task.assignedTo && !Array.isArray(task.assignedTo)) {
      task.assignedTo = [task.assignedTo];
    }

    if (changes.length > 0) {
      task.activityLogs.push({
        user: req.user._id,
        action: "Task Updated",
        details: changes.join(", ")
      });
    }

    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    req.app.get("io").emit("taskUpdated", updatedTask);

    if (changes.length > 0) {
      for (const assigneeId of task.assignedTo) {
        await createNotification({
          req,
          recipient: assigneeId,
          sender: req.user._id,
          type: "task_status",
          title: "Task updated",
          message: `"${task.title}" was updated: ${changes.join(", ")}`,
          task: task._id,
          project: task.project
        });
      }
    }

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id/status", protect, async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "backlog",
      "todo",
      "in_progress",
      "review",
      "closed"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const isAssigned = task.assignedTo.some(
      (id) => id.toString() === req.user._id.toString()
    );

    if (req.user.role !== "admin" && !isAssigned) {
      return res.status(403).json({
        message: "You can update only your assigned tasks"
      });
    }

    const oldStatus = task.status;

    task.status = status;

    if (oldStatus !== status) {
      task.activityLogs.push({
        user: req.user._id,
        action: "Status Changed",
        details: `Moved from ${statusLabels[oldStatus]} to ${statusLabels[status]}`
      });
    }

    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    req.app.get("io").emit("taskUpdated", updatedTask);

    for (const assigneeId of task.assignedTo) {
      await createNotification({
        req,
        recipient: assigneeId,
        sender: req.user._id,
        type: "task_status",
        title: "Task status updated",
        message: `"${task.title}" moved to ${statusLabels[status]}`,
        task: task._id,
        project: task.project
      });
    }

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/comments", protect, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const hasAccess = await canUserAccessTask(task, req.user);

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this task"
      });
    }

    task.comments.push({
      user: req.user._id,
      text: text.trim()
    });

    task.activityLogs.push({
      user: req.user._id,
      action: "Comment Added",
      details: "Added a comment"
    });

    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    req.app.get("io").emit("taskUpdated", updatedTask);

    for (const assigneeId of task.assignedTo) {
      await createNotification({
        req,
        recipient: assigneeId,
        sender: req.user._id,
        type: "task_comment",
        title: "New comment on task",
        message: `${req.user.name} commented on "${task.title}"`,
        task: task._id,
        project: task.project
      });
    }

    res.status(201).json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/attachments", protect, upload.single("file"), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const hasAccess = await canUserAccessTask(task, req.user);
    const isAssigned = isUserAssignedToTask(task, req.user);

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this task"
      });
    }

    if (req.user.role !== "admin" && !isAssigned) {
      return res.status(403).json({
        message: "You can upload attachments only on tasks assigned to you"
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    task.attachments.push({
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: `/uploads/${req.file.filename}`,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id
    });

    task.activityLogs.push({
      user: req.user._id,
      action: "Attachment Added",
      details: `Uploaded ${req.file.originalname}`
    });

    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    req.app.get("io").emit("taskUpdated", updatedTask);

    for (const assigneeId of task.assignedTo) {
      await createNotification({
        req,
        recipient: assigneeId,
        sender: req.user._id,
        type: "task_attachment",
        title: "New attachment uploaded",
        message: `${req.user.name} uploaded ${req.file.originalname}`,
        task: task._id,
        project: task.project
      });
    }

    res.status(201).json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:taskId/attachments/:attachmentId", protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const hasAccess = await canUserAccessTask(task, req.user);
    const isAssigned = isUserAssignedToTask(task, req.user);

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this task"
      });
    }

    if (req.user.role !== "admin" && !isAssigned) {
      return res.status(403).json({
        message: "You can remove attachments only on tasks assigned to you"
      });
    }

    const attachment = task.attachments.id(req.params.attachmentId);

    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const attachmentName = attachment.originalName;

    task.attachments.pull(req.params.attachmentId);

    task.activityLogs.push({
      user: req.user._id,
      action: "Attachment Removed",
      details: `Removed ${attachmentName}`
    });

    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    req.app.get("io").emit("taskUpdated", updatedTask);

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/checklist", protect, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Checklist item cannot be empty" });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const hasAccess = await canUserAccessTask(task, req.user);
    const isAssigned = isUserAssignedToTask(task, req.user);

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this task"
      });
    }

    if (req.user.role !== "admin" && !isAssigned) {
      return res.status(403).json({
        message: "You can add checklist items only on tasks assigned to you"
      });
    }

    task.checklist.push({
      text: text.trim(),
      createdBy: req.user._id
    });

    task.activityLogs.push({
      user: req.user._id,
      action: "Checklist Item Added",
      details: `Added "${text.trim()}"`
    });

    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    req.app.get("io").emit("taskUpdated", updatedTask);

    res.status(201).json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:taskId/checklist/:itemId", protect, async (req, res) => {
  try {
    const { isDone } = req.body;

    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const hasAccess = await canUserAccessTask(task, req.user);
    const isAssigned = isUserAssignedToTask(task, req.user);

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this task"
      });
    }

    if (req.user.role !== "admin" && !isAssigned) {
      return res.status(403).json({
        message: "You can update checklist only on tasks assigned to you"
      });
    }

    const item = task.checklist.id(req.params.itemId);

    if (!item) {
      return res.status(404).json({ message: "Checklist item not found" });
    }

    item.isDone = Boolean(isDone);

    task.activityLogs.push({
      user: req.user._id,
      action: item.isDone ? "Checklist Item Completed" : "Checklist Item Reopened",
      details: item.text
    });

    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    req.app.get("io").emit("taskUpdated", updatedTask);

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:taskId/checklist/:itemId", protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const hasAccess = await canUserAccessTask(task, req.user);
    const isAssigned = isUserAssignedToTask(task, req.user);

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this task"
      });
    }

    if (req.user.role !== "admin" && !isAssigned) {
      return res.status(403).json({
        message: "You can delete checklist items only on tasks assigned to you"
      });
    }

    const item = task.checklist.id(req.params.itemId);

    if (!item) {
      return res.status(404).json({ message: "Checklist item not found" });
    }

    const itemText = item.text;

    task.checklist.pull(req.params.itemId);

    task.activityLogs.push({
      user: req.user._id,
      action: "Checklist Item Removed",
      details: itemText
    });

    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));

    req.app.get("io").emit("taskUpdated", updatedTask);

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    req.app.get("io").emit("taskDeleted", { taskId: req.params.id });

    res.json({ message: "Task deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
