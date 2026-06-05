const express = require("express");
const Message = require("../models/Message");
const Project = require("../models/Project");
const { protect } = require("../middleware/authMiddleware");
const createNotification = require("../utils/createNotification");

const router = express.Router();

const populateMessage = (query) => {
  return query
    .populate("sender", "name email role")
    .populate("receiver", "name email role")
    .populate("project", "name")
    .populate("readBy", "name email role");
};

const canAccessProject = async (projectId, user) => {
  if (user.role === "admin") return true;

  const project = await Project.findById(projectId);

  if (!project) return false;

  return project.members.some(
    (memberId) => memberId.toString() === user._id.toString()
  );
};

router.get("/unread-summary", protect, async (req, res) => {
  try {
    const unreadMessages = await Message.find({
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id },
      $or: [
        { messageType: "direct", receiver: req.user._id },
        { messageType: "project" }
      ]
    }).populate("project", "name");

    const accessibleProjects =
      req.user.role === "admin"
        ? await Project.find().select("_id")
        : await Project.find({ members: req.user._id }).select("_id");

    const accessibleProjectIds = accessibleProjects.map((project) =>
      project._id.toString()
    );

    const directCounts = {};
    const projectCounts = {};

    unreadMessages.forEach((message) => {
      if (message.messageType === "direct") {
        const otherUserId = message.sender.toString();
        directCounts[otherUserId] = (directCounts[otherUserId] || 0) + 1;
      }

      if (
        message.messageType === "project" &&
        message.project &&
        accessibleProjectIds.includes(message.project._id.toString())
      ) {
        const projectId = message.project._id.toString();
        projectCounts[projectId] = (projectCounts[projectId] || 0) + 1;
      }
    });

    res.json({
      directCounts,
      projectCounts
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/direct/:userId/read", protect, async (req, res) => {
  try {
    await Message.updateMany(
      {
        messageType: "direct",
        sender: req.params.userId,
        receiver: req.user._id,
        readBy: { $ne: req.user._id }
      },
      {
        $addToSet: { readBy: req.user._id }
      }
    );

    req.app.get("io").emit("messagesRead", {
      chatType: "direct",
      readerId: req.user._id,
      otherUserId: req.params.userId
    });

    res.json({ message: "Direct messages marked as read" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/project/:projectId/read", protect, async (req, res) => {
  try {
    const hasAccess = await canAccessProject(req.params.projectId, req.user);

    if (!hasAccess) {
      return res.status(403).json({ message: "No access to this project chat" });
    }

    await Message.updateMany(
      {
        messageType: "project",
        project: req.params.projectId,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id }
      },
      {
        $addToSet: { readBy: req.user._id }
      }
    );

    req.app.get("io").emit("messagesRead", {
      chatType: "project",
      readerId: req.user._id,
      projectId: req.params.projectId
    });

    res.json({ message: "Project messages marked as read" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/direct/:userId", protect, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    const messages = await populateMessage(
      Message.find({
        messageType: "direct",
        $or: [
          { sender: req.user._id, receiver: otherUserId },
          { sender: otherUserId, receiver: req.user._id }
        ]
      }).sort({ createdAt: 1 })
    );

    await Message.updateMany(
      {
        messageType: "direct",
        sender: otherUserId,
        receiver: req.user._id,
        readBy: { $ne: req.user._id }
      },
      {
        $addToSet: { readBy: req.user._id }
      }
    );

    req.app.get("io").emit("messagesRead", {
      chatType: "direct",
      readerId: req.user._id,
      otherUserId
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/direct/:userId", protect, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver: req.params.userId,
      messageType: "direct",
      text: text.trim(),
      readBy: [req.user._id]
    });

    const populatedMessage = await populateMessage(Message.findById(message._id));

    req.app.get("io").emit("messageCreated", populatedMessage);

    await createNotification({
      req,
      recipient: req.params.userId,
      sender: req.user._id,
      type: "direct_message",
      title: "New direct message",
      message: `${req.user.name}: ${text.trim()}`,
      directUser: req.user._id
    });

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/project/:projectId", protect, async (req, res) => {
  try {
    const hasAccess = await canAccessProject(req.params.projectId, req.user);

    if (!hasAccess) {
      return res.status(403).json({ message: "No access to this project chat" });
    }

    const messages = await populateMessage(
      Message.find({
        messageType: "project",
        project: req.params.projectId
      }).sort({ createdAt: 1 })
    );

    await Message.updateMany(
      {
        messageType: "project",
        project: req.params.projectId,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id }
      },
      {
        $addToSet: { readBy: req.user._id }
      }
    );

    req.app.get("io").emit("messagesRead", {
      chatType: "project",
      readerId: req.user._id,
      projectId: req.params.projectId
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/project/:projectId", protect, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const hasAccess = await canAccessProject(req.params.projectId, req.user);

    if (!hasAccess) {
      return res.status(403).json({ message: "No access to this project chat" });
    }

    const message = await Message.create({
      sender: req.user._id,
      project: req.params.projectId,
      messageType: "project",
      text: text.trim(),
      readBy: [req.user._id]
    });

    const populatedMessage = await populateMessage(Message.findById(message._id));

    req.app.get("io").emit("messageCreated", populatedMessage);

    const project = await Project.findById(req.params.projectId);

    if (project) {
      for (const memberId of project.members) {
        await createNotification({
          req,
          recipient: memberId,
          sender: req.user._id,
          type: "project_message",
          title: "New project message",
          message: `${req.user.name} posted in ${project.name}`,
          project: project._id
        });
      }
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
