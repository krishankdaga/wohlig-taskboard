const Notification = require("../models/Notification");

const createNotification = async ({
  req,
  recipient,
  sender = null,
  type,
  title,
  message = "",
  task = null,
  project = null,
  directUser = null
}) => {
  if (!recipient) return null;

  if (sender && recipient.toString() === sender.toString()) {
    return null;
  }

  const notification = await Notification.create({
    recipient,
    sender,
    type,
    title,
    message,
    task,
    project,
    directUser
  });

  const populatedNotification = await Notification.findById(notification._id)
    .populate("sender", "name email role")
    .populate("task", "title status")
    .populate("project", "name")
    .populate("directUser", "name email role");

  if (req?.app?.get("io")) {
    req.app
      .get("io")
      .to(recipient.toString())
      .emit("notificationCreated", populatedNotification);
  }

  return populatedNotification;
};

module.exports = createNotification;
