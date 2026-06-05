const express = require("express");
const Project = require("../models/Project");
const Task = require("../models/Task");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { name, description, parentProject, members } = req.body;

    const project = await Project.create({
      name,
      description,
      parentProject: parentProject || null,
      members: members || [],
      createdBy: req.user._id
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    let projects;

    if (req.user.role === "admin") {
      projects = await Project.find()
        .populate("members", "name email role")
    .populate("projectLeads.user", "name email role")
    .populate("projectLeads.assignedBy", "name email role")
        .populate("parentProject", "name");
    } else {
      projects = await Project.find({ members: req.user._id })
        .populate("members", "name email role")
    .populate("projectLeads.user", "name email role")
    .populate("projectLeads.assignedBy", "name email role")
        .populate("parentProject", "name");
    }

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const { name, description, parentProject, members } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (parentProject !== undefined) updateData.parentProject = parentProject || null;
    if (members !== undefined) updateData.members = members;

    const project = await Project.findByIdAndUpdate(req.params.id, updateData, {
      new: true
    })
      .populate("members", "name email role")
    .populate("projectLeads.user", "name email role")
    .populate("projectLeads.assignedBy", "name email role")
      .populate("parentProject", "name");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const projectId = req.params.id;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const childProjectsCount = await Project.countDocuments({
      parentProject: projectId
    });

    if (childProjectsCount > 0) {
      return res.status(400).json({
        message:
          "Cannot delete this project because it has sub-projects. Delete or move its sub-projects first."
      });
    }

    const tasksCount = await Task.countDocuments({
      project: projectId
    });

    if (tasksCount > 0) {
      return res.status(400).json({
        message:
          "Cannot delete this project because it has tasks. Delete or move its tasks first."
      });
    }

    await Project.findByIdAndDelete(projectId);

    res.json({
      message: "Project deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.put("/:projectId/leads", protect, adminOnly, async (req, res) => {
  try {
    const { userId, title } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User is required" });
    }

    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const isMember = project.members.some(
      (memberId) => memberId.toString() === userId.toString()
    );

    if (!isMember) {
      project.members.push(userId);
    }

    const existingLead = project.projectLeads.find(
      (lead) => lead.user.toString() === userId.toString()
    );

    if (existingLead) {
      existingLead.title = title?.trim() || "Project Lead";
      existingLead.assignedBy = req.user._id;
      existingLead.assignedAt = new Date();
    } else {
      project.projectLeads.push({
        user: userId,
        title: title?.trim() || "Project Lead",
        assignedBy: req.user._id
      });
    }

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate("members", "name email role")
      .populate("parentProject", "name")
      .populate("projectLeads.user", "name email role")
      .populate("projectLeads.assignedBy", "name email role");

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:projectId/leads/:userId", protect, adminOnly, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    project.projectLeads = project.projectLeads.filter(
      (lead) => lead.user.toString() !== req.params.userId.toString()
    );

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate("members", "name email role")
      .populate("parentProject", "name")
      .populate("projectLeads.user", "name email role")
      .populate("projectLeads.assignedBy", "name email role");

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;
