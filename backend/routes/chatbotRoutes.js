const express = require("express");
const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
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

const detectRequestedProject = async (question, user) => {
  const q = (question || "").toLowerCase();
  const accessibleProjectIds = await getAccessibleProjectIds(user);

  const projects = await Project.find({
    _id: { $in: accessibleProjectIds }
  }).select("name");

  const exactMatch = projects
    .sort((a, b) => b.name.length - a.name.length)
    .find((project) => q.includes(project.name.toLowerCase()));

  if (exactMatch) {
    return {
      found: true,
      project: exactMatch,
      requestedName: exactMatch.name,
      availableProjects: projects.map((project) => project.name)
    };
  }

  const projectIntentWords = [
    "project",
    "under",
    "in ",
    "for ",
    "summarize",
    "summary",
    "status report",
    "report",
    "training"
  ];

  const seemsProjectSpecific = projectIntentWords.some((word) =>
    q.includes(word)
  );

  // Try to extract phrase after common project-intent words
  const patterns = [
    /(?:project|under|in|for|summarize|summary of|status report for|report for)\s+([a-z0-9\s\-_]+)/i
  ];

  let requestedName = "";

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match?.[1]) {
      requestedName = match[1]
        .replace(/[?.!,]/g, "")
        .trim();
      break;
    }
  }

  // If user clearly mentioned a project-ish phrase but it is not in accessible projects
  if (seemsProjectSpecific && requestedName && requestedName.length > 2) {
    return {
      found: false,
      project: null,
      requestedName,
      availableProjects: projects.map((project) => project.name)
    };
  }

  return {
    found: null,
    project: null,
    requestedName: "",
    availableProjects: projects.map((project) => project.name)
  };
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
      name: project.name,
      parentProject: project.parentProject?.name || "Main project",
      description: project.description || "No description",
      members:
        project.members?.map((member) => `${member.name} (${member.role})`).join(", ") ||
        "No members"
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
            name: u.name,
            email: u.email,
            role: u.role
          }))
        : "User list is hidden for employees except project/task context."
  };
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
4. Never substitute one project for another. If the user asks about a project that is not present in the provided project list, say it was not found.
5. If workspaceData.requestedProject is present, answer only for that exact project.
6. Be concise but useful.
7. For task answers, include task code, title, status, assignee, priority, and due date when relevant.
8. If the user asks what to do first, prioritize overdue tasks, high priority tasks, and nearest due dates.
9. If the current user is an employee, do not imply access beyond the provided context.
10. Format using Markdown headings and bullet points.
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
          `${index + 1}. ${project.name}\nParent: ${project.parentProject}\nMembers: ${project.members}`
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
    "- Summarize Project Genesis.\n" +
    "- Who is assigned to GenAI Training?\n" +
    "- Which employee has the most pending tasks?\n" +
    "- What is my latest deadline?"
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

    const projectDetection = await detectRequestedProject(question, req.user);

    if (projectDetection.found === false) {
      return res.json({
        answer:
          `I could not find a project called "${projectDetection.requestedName}".\n\n` +
          `Accessible projects are:\n` +
          projectDetection.availableProjects.map((name) => `- ${name}`).join("\n"),
        mode: "project_not_found"
      });
    }

    const context = await buildWorkspaceContext(req.user);

    context.requestedProject = projectDetection.found
      ? projectDetection.project.name
      : null;

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

module.exports = router;
