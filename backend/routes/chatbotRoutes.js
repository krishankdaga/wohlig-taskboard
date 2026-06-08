const express = require("express");
const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const formatDate = (date) => {
  if (!date) return "No due date";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const cleanStatus = (status) => {
  return status?.replace("_", " ") || "";
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

const isProjectLeadForProject = async (projectId, user) => {
  if (user.role === "admin") return true;

  const project = await Project.findById(projectId);

  if (!project) return false;

  return (project.projectLeads || []).some(
    (lead) => lead.user.toString() === user._id.toString()
  );
};

const buildWorkspaceContext = async (user) => {
  const accessibleProjectIds = await getAccessibleProjectIds(user);

  const projects = await Project.find({
    _id: { $in: accessibleProjectIds }
  })
    .populate("members", "name email role")
    .populate("parentProject", "name")
    .sort({ createdAt: -1 });

  const tasks = await Task.find({
    isArchived: { $ne: true },
    project: { $in: accessibleProjectIds }
  })
    .populate("project", "name")
    .populate("assignedTo", "name email role")
    .sort({ dueDate: 1, createdAt: -1 })
    .limit(80);

  const visibleUsers =
    user.role === "admin"
      ? await User.find().select("name email role").sort({ name: 1 })
      : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const taskSummaries = tasks.map((task) => {
    const assignees =
      task.assignedTo?.map((employee) => employee.name).join(", ") ||
      "Unassigned";

    const labels = task.labels?.length ? task.labels.join(", ") : "No labels";

    const checklist = task.checklist || [];
    const checklistDone = checklist.filter((item) => item.isDone).length;

    const isOverdue =
      task.dueDate &&
      task.status !== "closed" &&
      new Date(task.dueDate) < today;

    return {
      code: task.taskCode || "No code",
      title: task.title,
      project: task.project?.name || "No project",
      status: cleanStatus(task.status),
      priority: task.priority,
      assignees,
      dueDate: formatDate(task.dueDate),
      overdue: Boolean(isOverdue),
      labels,
      checklistProgress: `${checklistDone}/${checklist.length}`,
      comments: task.comments?.length || 0,
      attachments: task.attachments?.length || 0
    };
  });

  const projectSummaries = projects.map((project) => {
    return {
      id: project._id.toString(),
      name: project.name,
      parentProject: project.parentProject?.name || "Main project",
      description: project.description || "No description",
      members:
        project.members?.map((member) => ({
          id: member._id.toString(),
          name: member.name,
          email: member.email,
          role: member.role
        })) || []
    };
  });

  const statusCounts = {
    backlog: tasks.filter((task) => task.status === "backlog").length,
    todo: tasks.filter((task) => task.status === "todo").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    review: tasks.filter((task) => task.status === "review").length,
    closed: tasks.filter((task) => task.status === "closed").length,
    pending: tasks.filter((task) => task.status !== "closed").length,
    overdue: tasks.filter((task) => {
      return (
        task.dueDate &&
        task.status !== "closed" &&
        new Date(task.dueDate) < today
      );
    }).length,
    highPriorityPending: tasks.filter((task) => {
      return task.priority === "high" && task.status !== "closed";
    }).length
  };

  return {
    currentUser: {
      name: user.name,
      email: user.email,
      role: user.role
    },
    statusCounts,
    projects: projectSummaries,
    tasks: taskSummaries,
    users:
      user.role === "admin"
        ? visibleUsers.map((u) => ({
            id: u._id.toString(),
            name: u.name,
            email: u.email,
            role: u.role
          }))
        : "User list is hidden for employees except project/task context."
  };
};

const detectTaskCreationRequest = (question) => {
  const q = question.toLowerCase();

  return (
    q.includes("create task") ||
    q.includes("create a task") ||
    q.includes("add task") ||
    q.includes("add a task") ||
    q.includes("make task") ||
    q.includes("make a task") ||
    q.includes("assign task") ||
    q.includes("assign a task") ||
    q.startsWith("create ") ||
    q.startsWith("add ") ||
    q.startsWith("assign ")
  );
};

const detectTaskActionRequest = (question) => {
  const q = question.toLowerCase();

  if (detectTaskCreationRequest(question)) return false;

  return (
    q.includes("move ") ||
    q.includes("change ") ||
    q.includes("update ") ||
    q.includes("assign ") ||
    q.includes("reassign ") ||
    q.includes("comment ") ||
    q.includes("add comment") ||
    q.includes("add a comment") ||
    q.includes("set ")
  );
};

const normalizeStatus = (value) => {
  const q = (value || "").toLowerCase().trim();

  if (q.includes("backlog")) return "backlog";
  if (q.includes("to do") || q.includes("todo")) return "todo";
  if (q.includes("progress")) return "in_progress";
  if (q.includes("review")) return "review";
  if (q.includes("closed") || q.includes("complete") || q.includes("done")) {
    return "closed";
  }

  return "";
};

const normalizePriority = (value) => {
  const q = (value || "").toLowerCase().trim();

  if (q.includes("high")) return "high";
  if (q.includes("medium")) return "medium";
  if (q.includes("low")) return "low";

  return "";
};

const extractTaskCode = (question) => {
  const match = question.match(/WOH-\d+/i);
  return match ? match[0].toUpperCase() : "";
};

const extractActionDraft = async (question, context) => {
  const taskCode = extractTaskCode(question);
  const q = question.toLowerCase();

  if (!taskCode) {
    return {
      error: "Please include the task code, for example WOH-008."
    };
  }

  const task = await Task.findOne({ taskCode })
    .populate({
      path: "project",
      select: "name projectLeads members",
      populate: { path: "projectLeads.user", select: "name email role" }
    })
    .populate("assignedTo", "name email role");

  if (!task) {
    return {
      error: `I could not find a task with code ${taskCode}.`
    };
  }

  const hasAccess =
    context.tasks.some((item) => item.code === taskCode) ||
    context.currentUser.role === "admin";

  if (!hasAccess) {
    return {
      error: `You do not have access to ${taskCode}.`
    };
  }

  let actionType = "";
  let payload = {};

  if (
    q.includes("move") ||
    q.includes("status") ||
    q.includes("to review") ||
    q.includes("to in progress") ||
    q.includes("to todo") ||
    q.includes("to do") ||
    q.includes("to closed") ||
    q.includes("complete")
  ) {
    const status = normalizeStatus(question);

    if (status) {
      actionType = "update_status";
      payload.status = status;
    }
  }

  if (q.includes("priority")) {
    const priority = normalizePriority(question);

    if (priority) {
      actionType = "update_priority";
      payload.priority = priority;
    }
  }

  if (q.includes("assign") || q.includes("reassign")) {
    const users = await User.find().select("name email role");

    const matchedUsers = users.filter((user) => {
      const name = user.name.toLowerCase();
      const email = user.email.toLowerCase();
      return q.includes(name) || q.includes(email);
    });

    if (matchedUsers.length > 0) {
      actionType = "assign_task";
      payload.assigneeIds = matchedUsers.map((user) => user._id.toString());
      payload.assigneeNames = matchedUsers.map((user) => user.name);
    }
  }

  if (q.includes("comment") || q.includes("add note")) {
    let commentText = "";

    const colonSplit = question.split(":");

    if (colonSplit.length > 1) {
      commentText = colonSplit.slice(1).join(":").trim();
    } else {
      commentText = question
        .replace(/add a comment/i, "")
        .replace(/add comment/i, "")
        .replace(/comment/i, "")
        .replace(taskCode, "")
        .trim();
    }

    if (commentText) {
      actionType = "add_comment";
      payload.comment = commentText;
    }
  }

  if (!actionType) {
    return {
      error:
        "I understood this as a task action, but I could not identify whether to move status, change priority, assign user, or add comment."
    };
  }

  return {
    actionType,
    taskId: task._id.toString(),
    taskCode: task.taskCode,
    taskTitle: task.title,
    projectId: task.project?._id?.toString() || task.project?.toString(),
    projectName: task.project?.name || "No project",
    currentStatus: task.status,
    currentPriority: task.priority,
    payload
  };
};

const canManageTaskAction = async (task, user) => {
  if (user.role === "admin") return true;

  const projectId = task.project?._id || task.project;

  const project = await Project.findById(projectId);

  if (!project) return false;

  const isProjectLead = (project.projectLeads || []).some((lead) => {
    return lead.user.toString() === user._id.toString();
  });

  return isProjectLead;
};



const extractTaskDraftWithGroq = async (question, context) => {
  if (!process.env.GROQ_API_KEY) return null;

  const prompt = `
You extract task creation details from a user's request.

Return ONLY valid JSON. No markdown. No explanation.

Available projects:
${JSON.stringify(context.projects, null, 2)}

Available users:
${JSON.stringify(context.users, null, 2)}

User request:
${question}

Rules:
1. Match project by exact or closest available project name.
2. Match assignees by available user name or email.
3. If due date is relative, convert it approximately using today's date: ${new Date().toISOString().slice(0, 10)}.
4. Priority must be one of: low, medium, high.
5. Status must be one of: backlog, todo, in_progress, review, closed.
6. If something is missing, use a sensible default.
7. Return this JSON shape:
{
  "title": "",
  "description": "",
  "projectName": "",
  "projectId": "",
  "assigneeNames": [],
  "assigneeIds": [],
  "priority": "medium",
  "status": "backlog",
  "dueDate": "",
  "labels": []
}
`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "You are a strict JSON extraction assistant. Return only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 600
    })
  });

  if (!response.ok) {
    console.log("Groq extract error:", await response.text());
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) return null;

  try {
    const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.log("Could not parse task draft:", content);
    return null;
  }
};

const answerWithGroq = async (question, context) => {
  if (!process.env.GROQ_API_KEY) {
    return null;
  }

  const systemPrompt = `
You are the internal AI assistant for Wohlig TaskBoard.

Rules:
1. Answer only using the workspace data provided.
2. If the answer is not available in the data, say you could not find it.
3. Do not invent tasks, employees, projects, dates, reports, or counts.
4. Never substitute one project for another.
5. Be concise but useful.
6. For task answers, include task code, title, status, assignee, priority, and due date when relevant.
7. If the user asks what to do first, prioritize overdue tasks, high priority tasks, and nearest due dates.
8. If the current user is an employee, do not imply access beyond the provided context.
9. Format using Markdown headings and bullet points.
10. If the user asks to create, add, make, or assign a task, do not claim the task was created. Task creation is handled by a separate confirmation flow.
`;

  const userPrompt = `
Question:
${question}

Workspace data:
${JSON.stringify(context, null, 2)}
`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.2,
      max_tokens: 900
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log("Groq error:", errorText);
    return null;
  }

  const data = await response.json();

  return data.choices?.[0]?.message?.content || null;
};

const fallbackAnswer = (question, context) => {
  const q = question.toLowerCase();

  if (q.includes("summary") || q.includes("overview")) {
    return (
      `Workspace summary:\n\n` +
      `Backlog: ${context.statusCounts.backlog}\n` +
      `To Do: ${context.statusCounts.todo}\n` +
      `In Progress: ${context.statusCounts.inProgress}\n` +
      `Review: ${context.statusCounts.review}\n` +
      `Closed: ${context.statusCounts.closed}\n` +
      `Pending: ${context.statusCounts.pending}\n` +
      `Overdue: ${context.statusCounts.overdue}\n` +
      `High Priority Pending: ${context.statusCounts.highPriorityPending}`
    );
  }

  if (q.includes("overdue")) {
    const overdueTasks = context.tasks.filter((task) => task.overdue);

    if (overdueTasks.length === 0) {
      return "No overdue tasks found.";
    }

    return `Overdue tasks:\n\n${overdueTasks
      .map(
        (task, index) =>
          `${index + 1}. ${task.code} - ${task.title}\nProject: ${task.project}\nAssignees: ${task.assignees}\nPriority: ${task.priority}\nDue: ${task.dueDate}`
      )
      .join("\n\n")}`;
  }

  if (q.includes("project")) {
    return `Accessible projects:\n\n${context.projects
      .map(
        (project, index) =>
          `${index + 1}. ${project.name}\nParent: ${project.parentProject}\nMembers: ${
            project.members?.map((m) => m.name).join(", ") || "No members"
          }`
      )
      .join("\n\n")}`;
  }

  if (q.includes("task")) {
    if (context.tasks.length === 0) {
      return "No tasks found.";
    }

    return `Matching visible tasks:\n\n${context.tasks
      .slice(0, 12)
      .map(
        (task, index) =>
          `${index + 1}. ${task.code} - ${task.title}\nProject: ${task.project}\nStatus: ${task.status}\nAssignees: ${task.assignees}\nPriority: ${task.priority}\nDue: ${task.dueDate}`
      )
      .join("\n\n")}`;
  }

  return (
    "I can answer questions about your workspace data.\n\n" +
    "Try asking:\n" +
    "- Which tasks are overdue?\n" +
    "- What should I work on first?\n" +
    "- Summarize a project\n" +
    "- Who is assigned to a project?\n" +
    "- Which employee has the most pending tasks?\n" +
    "- Create a high priority task for Employee One under project2 due tomorrow: Complete testing"
  );
};

const generateTaskCode = async () => {
  const lastTask = await Task.findOne({
    taskCode: { $regex: /^WOH-/ }
  }).sort({ createdAt: -1 });

  if (!lastTask?.taskCode) {
    return "WOH-001";
  }

  const lastNumber = Number(lastTask.taskCode.split("-")[1]) || 0;
  const nextNumber = lastNumber + 1;

  return `WOH-${String(nextNumber).padStart(3, "0")}`;
};

router.post("/ask", protect, async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        answer: "Please ask a question."
      });
    }

    const context = await buildWorkspaceContext(req.user);

    if (detectTaskCreationRequest(question)) {
      if (req.user.role !== "admin") {
        return res.json({
          answer:
            "I can prepare task creation only for admins right now. Please ask an admin to create this task.",
          mode: "task_create_denied"
        });
      }

      const draft = await extractTaskDraftWithGroq(question, context);

      if (!draft || !draft.title || !draft.projectId || !draft.assigneeIds?.length) {
        return res.json({
          answer:
            "I understood that you want to create a task, but I could not confidently identify the title, project, and assignee. Please include project name and employee name.",
          mode: "task_draft_failed"
        });
      }

      return res.json({
        answer:
          `I prepared this task draft:\n\n` +
          `Title: ${draft.title}\n` +
          `Project: ${draft.projectName}\n` +
          `Assignees: ${(draft.assigneeNames || []).join(", ")}\n` +
          `Priority: ${draft.priority}\n` +
          `Status: ${draft.status}\n` +
          `Due Date: ${draft.dueDate || "No due date"}\n\n` +
          `Confirm to create this task.`,
        mode: "task_draft",
        taskDraft: draft
      });
    }

    if (detectTaskActionRequest(question)) {
      const actionDraft = await extractActionDraft(question, context);

      if (actionDraft.error) {
        return res.json({
          answer: actionDraft.error,
          mode: "task_action_failed"
        });
      }

      let actionText = "";

      if (actionDraft.actionType === "update_status") {
        actionText = `Move ${actionDraft.taskCode} - ${actionDraft.taskTitle} from ${actionDraft.currentStatus} to ${actionDraft.payload.status}`;
      }

      if (actionDraft.actionType === "update_priority") {
        actionText = `Change ${actionDraft.taskCode} - ${actionDraft.taskTitle} priority from ${actionDraft.currentPriority} to ${actionDraft.payload.priority}`;
      }

      if (actionDraft.actionType === "assign_task") {
        actionText = `Assign ${actionDraft.taskCode} - ${actionDraft.taskTitle} to ${actionDraft.payload.assigneeNames.join(", ")}`;
      }

      if (actionDraft.actionType === "add_comment") {
        actionText = `Add comment to ${actionDraft.taskCode} - ${actionDraft.taskTitle}: ${actionDraft.payload.comment}`;
      }

      return res.json({
        answer:
          `I prepared this action:\n\n` +
          `${actionText}\n\n` +
          `Project: ${actionDraft.projectName}\n\n` +
          `Confirm to apply this action.`,
        mode: "task_action_draft",
        actionDraft
      });
    }

    const aiAnswer = await answerWithGroq(question, context);

    if (aiAnswer) {
      return res.json({
        answer: aiAnswer,
        mode: "ai"
      });
    }

    return res.json({
      answer: fallbackAnswer(question, context),
      mode: "fallback"
    });
  } catch (error) {
    console.error("Chatbot error:", error);

    res.status(500).json({
      answer: "Something went wrong while answering your question.",
      error: error.message
    });
  }
});

router.post("/create-task", protect, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admin can create tasks from assistant"
      });
    }

    const {
      title,
      description,
      projectId,
      assigneeIds,
      priority,
      status,
      dueDate,
      labels
    } = req.body;

    if (!title || !projectId || !assigneeIds?.length) {
      return res.status(400).json({
        message: "Title, project, and assignees are required"
      });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    const canCreate = await isProjectLeadForProject(projectId, req.user);

    if (!canCreate) {
      return res.status(403).json({
        message: "You do not have permission to create task in this project"
      });
    }

    const taskCode = await generateTaskCode();

    const task = await Task.create({
      taskCode,
      title,
      description: description || "",
      project: projectId,
      assignedTo: assigneeIds,
      createdBy: req.user._id,
      status: status || "backlog",
      priority: priority || "medium",
      dueDate: dueDate || null,
      labels: labels || [],
      activityLogs: [
        {
          user: req.user._id,
          action: "Task Created by Assistant",
          details: `${taskCode} was created from the AI assistant`
        }
      ]
    });

    const populatedTask = await Task.findById(task._id)
      .populate({
        path: "project",
        select: "name parentProject projectLeads",
        populate: { path: "projectLeads.user", select: "name email role" }
      })
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role");

    const io = req.app.get("io");

    io.emit("taskCreated", populatedTask);

    for (const assigneeId of assigneeIds) {
      const notification = await Notification.create({
        recipient: assigneeId,
        title: "New Task Assigned",
        message: `${taskCode} - ${title}`,
        type: "task_assigned",
        task: task._id,
        project: projectId
      });

      io.to(assigneeId.toString()).emit("notificationCreated", notification);
    }

    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});


router.post("/execute-action", protect, async (req, res) => {
  try {
    const { actionDraft } = req.body;

    if (!actionDraft || !actionDraft.taskId || !actionDraft.actionType) {
      return res.status(400).json({
        message: "Invalid action draft"
      });
    }

    const task = await Task.findById(actionDraft.taskId)
      .populate("assignedTo", "name email role")
      .populate("project", "name projectLeads");

    if (!task) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    const allowed = await canManageTaskAction(task, req.user);

    const isAssignedUser = (task.assignedTo || []).some((assignee) => {
      return assignee._id.toString() === req.user._id.toString();
    });

    if (!allowed && actionDraft.actionType !== "add_comment" && !isAssignedUser) {
      return res.status(403).json({
        message: "Only admin or project lead can perform this action"
      });
    }

    if (actionDraft.actionType === "update_status") {
      const oldStatus = task.status;
      task.status = actionDraft.payload.status;

      task.activityLogs.push({
        user: req.user._id,
        action: "Status Updated by Assistant",
        details: `${task.taskCode} moved from ${oldStatus} to ${task.status}`
      });
    }

    if (actionDraft.actionType === "update_priority") {
      if (!allowed) {
        return res.status(403).json({
          message: "Only admin or project lead can change priority"
        });
      }

      const oldPriority = task.priority;
      task.priority = actionDraft.payload.priority;

      task.activityLogs.push({
        user: req.user._id,
        action: "Priority Updated by Assistant",
        details: `${task.taskCode} priority changed from ${oldPriority} to ${task.priority}`
      });
    }

    if (actionDraft.actionType === "assign_task") {
      if (!allowed) {
        return res.status(403).json({
          message: "Only admin or project lead can assign tasks"
        });
      }

      task.assignedTo = actionDraft.payload.assigneeIds;

      task.activityLogs.push({
        user: req.user._id,
        action: "Assignee Updated by Assistant",
        details: `${task.taskCode} assigned to ${actionDraft.payload.assigneeNames.join(", ")}`
      });
    }

    if (actionDraft.actionType === "add_comment") {
      task.comments.push({
        user: req.user._id,
        text: actionDraft.payload.comment
      });

      task.activityLogs.push({
        user: req.user._id,
        action: "Comment Added by Assistant",
        details: actionDraft.payload.comment
      });
    }

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate({
        path: "project",
        select: "name parentProject projectLeads",
        populate: { path: "projectLeads.user", select: "name email role" }
      })
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("comments.user", "name email role")
      .populate("activityLogs.user", "name email role");

    const io = req.app.get("io");

    io.emit("taskUpdated", populatedTask);

    const Notification = require("../models/Notification");

    const recipients = new Set();

    (populatedTask.assignedTo || []).forEach((assignee) => {
      recipients.add(assignee._id.toString());
    });

    recipients.delete(req.user._id.toString());

    for (const recipientId of recipients) {
      const notification = await Notification.create({
        recipient: recipientId,
        title: "Task Updated by Assistant",
        message: `${populatedTask.taskCode} - ${populatedTask.title}`,
        type: "task_status",
        task: populatedTask._id,
        project: populatedTask.project?._id || populatedTask.project
      });

      io.to(recipientId).emit("notificationCreated", notification);
    }

    res.json({
      message: "Action applied successfully",
      task: populatedTask
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});


module.exports = router;
