import { useEffect, useState } from "react";
import API from "../api/axios";
import socket from "../api/socket";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const typeLabel = {
  task_assigned: "TA",
  task_comment: "CM",
  direct_message: "DM",
  project_message: "PM",
  task_status: "ST",
  task_attachment: "AT"
};

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    const { data } = await API.get("/notifications");
    setNotifications(data);
    setUnreadCount(data.filter((item) => !item.isRead).length);
  };

  useEffect(() => {
    if (!user?._id) return;

    socket.emit("joinUserRoom", user._id);
    fetchNotifications();

    socket.on("notificationCreated", (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.off("notificationCreated");
    };
  }, [user?._id]);

  const markRead = async (notification) => {
    if (!notification.isRead) {
      await API.put(`/notifications/${notification._id}/read`);

      setNotifications((prev) =>
        prev.map((item) =>
          item._id === notification._id ? { ...item, isRead: true } : item
        )
      );

      setUnreadCount((prev) => Math.max(prev - 1, 0));
    }

    if (
      notification.type === "task_assigned" ||
      notification.type === "task_comment" ||
      notification.type === "task_status" ||
      notification.type === "task_attachment"
    ) {
      const taskId = notification.task?._id || notification.task;
      const projectId = notification.project?._id || notification.project;

      if (taskId && projectId) {
        navigate(`/board?project=${projectId}&task=${taskId}`);
      } else if (taskId) {
        navigate(`/board?task=${taskId}`);
      } else {
        navigate("/board");
      }

      setOpen(false);
      return;
    }

    if (notification.type === "direct_message") {
      const directUserId =
        notification.directUser?._id || notification.directUser;

      if (directUserId) {
        navigate(`/messages?type=direct&id=${directUserId}`);
      } else {
        navigate("/messages");
      }

      setOpen(false);
      return;
    }

    if (notification.type === "project_message") {
      const projectId = notification.project?._id || notification.project;

      if (projectId) {
        navigate(`/messages?type=project&id=${projectId}`);
      } else {
        navigate("/messages");
      }

      setOpen(false);
    }
  };

  const markAllRead = async () => {
    await API.put("/notifications/mark-all-read");

    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        isRead: true
      }))
    );

    setUnreadCount(0);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative h-11 w-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-black text-slate-700"
      >
        NT

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-black flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[420px] bg-white rounded-3xl border border-slate-200 shadow-2xl z-[1000] overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                Notifications
              </p>
              <h3 className="text-xl font-black text-slate-900">
                Updates
              </h3>
            </div>

            <button
              onClick={markAllRead}
              className="text-xs font-black text-blue-600"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[520px] overflow-auto p-3">
            {notifications.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-black text-slate-700">
                  No notifications yet
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <button
                    key={notification._id}
                    onClick={() => markRead(notification)}
                    className={`w-full text-left rounded-2xl p-4 border transition ${
                      notification.isRead
                        ? "bg-white border-slate-100"
                        : "bg-blue-50 border-blue-200"
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-600">
                        {typeLabel[notification.type] || "NT"}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-black text-slate-900 text-sm">
                            {notification.title}
                          </p>

                          {!notification.isRead && (
                            <span className="h-2 w-2 rounded-full bg-blue-600 mt-1" />
                          )}
                        </div>

                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>

                        <p className="text-xs text-slate-400 mt-2">
                          {new Date(notification.createdAt).toLocaleString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            }
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
