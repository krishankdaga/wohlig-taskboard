const express = require("express");
const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const Message = require("../models/Message");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();

    if (!q) {
      return res.json({
        tasks: [],
        projects: [],
        users: [],
        messages: []
      });
    }

    const regex = new RegExp(q, "i");

    let accessibleProjectIds = [];

    if (req.user.role === "admin") {
      const allProjects = await Project.find().select("_id");
      accessibleProjectIds = allProjects.map((project) => project._id);
    } else {
      const userProjects = await Project.find({
        members: req.user._id
      }).select("_id");

      accessibleProjectIds = userProjects.map((project) => project._id);
    }

    const tasks = await Task.find({
      project: { $in: accessibleProjectIds },
      isArchived: { $ne: true },
      $or: [
        { taskCode: regex },
        { title: regex },
        { description: regex },
        { priority: regex },
        { status: regex },
        { labels: regex }
      ]
    })
      .populate("project", "name")
      .populate("assignedTo", "name email role")
      .limit(8);

    const projects = await Project.find({
      _id: { $in: accessibleProjectIds },
      $or: [{ name: regex }, { description: regex }]
    })
      .populate("members", "name email role")
      .limit(8);

    const users = await User.find({
      $or: [{ name: regex }, { email: regex }, { role: regex }]
    })
      .select("name email role")
      .limit(8);

    let messages;

    if (req.user.role === "admin") {
      messages = await Message.find({
        text: regex
      })
        .populate("sender", "name email role")
        .populate("receiver", "name email role")
        .populate("project", "name")
        .sort({ createdAt: -1 })
        .limit(8);
    } else {
      messages = await Message.find({
        text: regex,
        $or: [
          { sender: req.user._id },
          { receiver: req.user._id },
          {
            messageType: "project",
            project: { $in: accessibleProjectIds }
          }
        ]
      })
        .populate("sender", "name email role")
        .populate("receiver", "name email role")
        .populate("project", "name")
        .sort({ createdAt: -1 })
        .limit(8);
    }

    res.json({
      tasks,
      projects,
      users,
      messages
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
