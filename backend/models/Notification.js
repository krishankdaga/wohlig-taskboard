const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    type: {
      type: String,
      enum: [
        "task_assigned",
        "task_comment",
        "direct_message",
        "project_message",
        "task_status",
        "task_attachment"
      ],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      default: ""
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null
    },
    directUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
