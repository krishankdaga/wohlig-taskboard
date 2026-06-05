const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    parentProject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    projectLeads: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        title: {
          type: String,
          default: "Project Lead",
          trim: true
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        assignedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
