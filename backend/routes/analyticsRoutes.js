const express = require("express");
const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

const isOverdue = (task) => {
  if (!task.dueDate || task.status === "closed") return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(task.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
};

router.get("/workload", protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select("name email role").sort({ name: 1 });

    const tasks = await Task.find({
      isArchived: { $ne: true }
    })
      .populate("assignedTo", "name email role")
      .populate("project", "name")
      .sort({ createdAt: -1 });

    const projects = await Project.find()
      .populate("projectLeads.user", "name email role")
      .sort({ name: 1 });

    const employeeAnalytics = users.map((user) => {
      const assignedTasks = tasks.filter((task) =>
        (task.assignedTo || []).some((assignee) => {
          const assigneeId = assignee?._id || assignee;
          return assigneeId.toString() === user._id.toString();
        })
      );

      const leadProjects = projects.filter((project) =>
        (project.projectLeads || []).some((lead) => {
          const leadUserId = lead.user?._id || lead.user;
          return leadUserId.toString() === user._id.toString();
        })
      );

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        totalTasks: assignedTasks.length,
        pendingTasks: assignedTasks.filter((task) => task.status !== "closed").length,
        closedTasks: assignedTasks.filter((task) => task.status === "closed").length,
        overdueTasks: assignedTasks.filter(isOverdue).length,
        highPriorityTasks: assignedTasks.filter(
          (task) => task.priority === "high" && task.status !== "closed"
        ).length,
        reviewTasks: assignedTasks.filter((task) => task.status === "review").length,
        leadProjects: leadProjects.map((project) => {
          const lead = project.projectLeads.find((item) => {
            const leadUserId = item.user?._id || item.user;
            return leadUserId.toString() === user._id.toString();
          });

          return {
            _id: project._id,
            name: project.name,
            title: lead?.title || "Project Lead"
          };
        })
      };
    });

    const projectAnalytics = projects.map((project) => {
      const projectTasks = tasks.filter((task) => {
        const projectId = task.project?._id || task.project;
        return projectId?.toString() === project._id.toString();
      });

      return {
        _id: project._id,
        name: project.name,
        totalTasks: projectTasks.length,
        pendingTasks: projectTasks.filter((task) => task.status !== "closed").length,
        closedTasks: projectTasks.filter((task) => task.status === "closed").length,
        overdueTasks: projectTasks.filter(isOverdue).length,
        highPriorityTasks: projectTasks.filter(
          (task) => task.priority === "high" && task.status !== "closed"
        ).length,
        reviewTasks: projectTasks.filter((task) => task.status === "review").length,
        leads: (project.projectLeads || []).map((lead) => ({
          name: lead.user?.name,
          email: lead.user?.email,
          title: lead.title
        }))
      };
    });

    const summary = {
      totalUsers: users.length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((task) => task.status !== "closed").length,
      closedTasks: tasks.filter((task) => task.status === "closed").length,
      overdueTasks: tasks.filter(isOverdue).length,
      highPriorityTasks: tasks.filter(
        (task) => task.priority === "high" && task.status !== "closed"
      ).length,
      reviewTasks: tasks.filter((task) => task.status === "review").length,
      totalProjects: projects.length
    };

    const mostLoadedEmployee =
      [...employeeAnalytics].sort((a, b) => b.pendingTasks - a.pendingTasks)[0] || null;

    const mostOverdueEmployee =
      [...employeeAnalytics].sort((a, b) => b.overdueTasks - a.overdueTasks)[0] || null;

    const mostDelayedProject =
      [...projectAnalytics].sort((a, b) => b.overdueTasks - a.overdueTasks)[0] || null;

    res.json({
      summary,
      highlights: {
        mostLoadedEmployee,
        mostOverdueEmployee,
        mostDelayedProject
      },
      employees: employeeAnalytics,
      projects: projectAnalytics
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

module.exports = router;
