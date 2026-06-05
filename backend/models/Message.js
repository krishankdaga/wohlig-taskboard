const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null
    },
    messageType: {
      type: String,
      enum: ["direct", "project"],
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
