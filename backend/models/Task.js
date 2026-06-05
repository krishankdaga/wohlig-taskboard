const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    taskCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    status: {
      type: String,
      enum: ["backlog", "todo", "in_progress", "review", "closed"],
      default: "backlog"
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium"
    },
    dueDate: {
      type: Date
    },
    labels: [
      {
        type: String,
        trim: true
      }
    ],
    isArchived: {
      type: Boolean,
      default: false
    },
    archivedAt: {
      type: Date,
      default: null
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    checklist: [
      {
        text: {
          type: String,
          required: true,
          trim: true
        },
        isDone: {
          type: Boolean,
          default: false
        },
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    attachments: [
      {
        originalName: {
          type: String,
          required: true
        },
        fileName: {
          type: String,
          required: true
        },
        filePath: {
          type: String,
          required: true
        },
        fileType: {
          type: String,
          default: ""
        },
        fileSize: {
          type: Number,
          default: 0
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        text: {
          type: String,
          required: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    activityLogs: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        action: {
          type: String,
          required: true
        },
        details: {
          type: String,
          default: ""
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
