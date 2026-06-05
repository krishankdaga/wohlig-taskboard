import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import API from "../api/axios";
import socket from "../api/socket";
import { useAuth } from "../context/AuthContext";

const Messages = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);

  const [chatType, setChatType] = useState("direct");
  const [selectedId, setSelectedId] = useState("");
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [unreadSummary, setUnreadSummary] = useState({
    directCounts: {},
    projectCounts: {}
  });

  const selectedChatName = useMemo(() => {
    if (!selectedId) return "Select a conversation";

    if (chatType === "direct") {
      return users.find((item) => item._id === selectedId)?.name || "Direct Chat";
    }

    return projects.find((item) => item._id === selectedId)?.name || "Project Chat";
  }, [selectedId, chatType, users, projects]);

  const fetchBaseData = async () => {
    try {
      const projectsRes = await API.get("/projects");
      setProjects(projectsRes.data);

      const usersRes = await API.get("/auth/team-users");

      const otherUsers = usersRes.data.filter(
        (item) => item._id !== user?._id
      );

      setUsers(otherUsers);
    } catch (error) {
      console.log("Could not load message sidebar data", error);
    }
  };

  const fetchUnreadSummary = async () => {
    try {
      const { data } = await API.get("/messages/unread-summary");
      setUnreadSummary(data);
    } catch (error) {
      console.log("Could not load unread message summary");
    }
  };

  const fetchMessages = async () => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    const endpoint =
      chatType === "direct"
        ? `/messages/direct/${selectedId}`
        : `/messages/project/${selectedId}`;

    const { data } = await API.get(endpoint);
    setMessages(data);

    if (chatType === "direct") {
      await API.put(`/messages/direct/${selectedId}/read`);
    } else {
      await API.put(`/messages/project/${selectedId}/read`);
    }

    fetchUnreadSummary();
  };

  useEffect(() => {
    if (!user?._id) return;

    fetchBaseData();
    fetchUnreadSummary();
  }, [user?._id]);

  useEffect(() => {
    const typeFromUrl = searchParams.get("type");
    const idFromUrl = searchParams.get("id");

    if (
      idFromUrl &&
      (typeFromUrl === "direct" || typeFromUrl === "project")
    ) {
      setChatType(typeFromUrl);
      setSelectedId(idFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchMessages();
  }, [selectedId, chatType]);

  useEffect(() => {
    socket.on("userTyping", (typingData) => {
      if (!selectedId) return;
      if (typingData.userId === user._id) return;

      const isSameDirectChat =
        chatType === "direct" &&
        typingData.chatType === "direct" &&
        typingData.receiverId === user._id &&
        typingData.senderId === selectedId;

      const isSameProjectChat =
        chatType === "project" &&
        typingData.chatType === "project" &&
        typingData.projectId === selectedId;

      if (isSameDirectChat || isSameProjectChat) {
        setTypingUsers((prev) => ({
          ...prev,
          [typingData.userId]: typingData.userName
        }));
      }
    });

    socket.on("userStoppedTyping", (typingData) => {
      setTypingUsers((prev) => {
        const updated = { ...prev };
        delete updated[typingData.userId];
        return updated;
      });
    });

    socket.on("messagesRead", (readData) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (readData.chatType === "direct") {
            const isRelevantDirectMessage =
              message.messageType === "direct" &&
              message.sender?._id === user._id &&
              message.receiver?._id === readData.readerId;

            if (isRelevantDirectMessage) {
              const alreadyRead = (message.readBy || []).some((readUser) => {
                const readUserId = readUser?._id || readUser;
                return readUserId === readData.readerId;
              });

              if (alreadyRead) return message;

              return {
                ...message,
                readBy: [
                  ...(message.readBy || []),
                  {
                    _id: readData.readerId,
                    name: "Seen"
                  }
                ]
              };
            }
          }

          if (readData.chatType === "project") {
            const isRelevantProjectMessage =
              message.messageType === "project" &&
              message.project?._id === readData.projectId &&
              message.sender?._id === user._id;

            if (isRelevantProjectMessage) {
              const alreadyRead = (message.readBy || []).some((readUser) => {
                const readUserId = readUser?._id || readUser;
                return readUserId === readData.readerId;
              });

              if (alreadyRead) return message;

              return {
                ...message,
                readBy: [
                  ...(message.readBy || []),
                  {
                    _id: readData.readerId,
                    name: "User"
                  }
                ]
              };
            }
          }

          return message;
        })
      );
    });

    socket.on("messageCreated", (newMessage) => {
      fetchUnreadSummary();
      if (!selectedId) return;

      if (newMessage.messageType === "direct" && chatType === "direct") {
        const isCurrentConversation =
          (newMessage.sender?._id === user._id && newMessage.receiver?._id === selectedId) ||
          (newMessage.sender?._id === selectedId && newMessage.receiver?._id === user._id);

        if (isCurrentConversation) {
          setMessages((prev) => {
            const exists = prev.some((message) => message._id === newMessage._id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        }
      }

      if (newMessage.messageType === "project" && chatType === "project") {
        if (newMessage.project?._id === selectedId) {
          setMessages((prev) => {
            const exists = prev.some((message) => message._id === newMessage._id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        }
      }
    });

    return () => {
      socket.off("userTyping");
      socket.off("userStoppedTyping");
      socket.off("messagesRead");
      socket.off("messageCreated");
    };
  }, [selectedId, chatType, user]);

  const handleTyping = (value) => {
    setText(value);

    if (!selectedId) return;

    const typingData = {
      userId: user._id,
      userName: user.name,
      chatType,
      senderId: user._id,
      receiverId: chatType === "direct" ? selectedId : null,
      projectId: chatType === "project" ? selectedId : null
    };

    socket.emit("typing", typingData);

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    const timeout = setTimeout(() => {
      socket.emit("stopTyping", typingData);
    }, 1200);

    setTypingTimeout(timeout);
  };

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!selectedId || !text.trim()) return;

    const endpoint =
      chatType === "direct"
        ? `/messages/direct/${selectedId}`
        : `/messages/project/${selectedId}`;

    try {
      const { data } = await API.post(endpoint, { text });
      setMessages((prev) => {
        const exists = prev.some((message) => message._id === data._id);
        if (exists) return prev;
        return [...prev, data];
      });
      socket.emit("stopTyping", {
        userId: user._id,
        userName: user.name,
        chatType,
        senderId: user._id,
        receiverId: chatType === "direct" ? selectedId : null,
        projectId: chatType === "project" ? selectedId : null
      });

      setText("");
    } catch (error) {
      alert(error.response?.data?.message || "Could not send message");
    }
  };

  const getReadByUsers = (message) => {
    if (!message.readBy || !Array.isArray(message.readBy)) return [];

    return message.readBy.filter((readUser) => {
      const readUserId = readUser?._id || readUser;
      return readUserId !== message.sender?._id;
    });
  };

  const getDirectSeenText = (message) => {
    const readByUsers = getReadByUsers(message);

    if (readByUsers.length === 0) return "Sent";

    return "Seen";
  };

  const getProjectSeenText = (message) => {
    const readByUsers = getReadByUsers(message);

    if (readByUsers.length === 0) return "Sent";

    if (readByUsers.length === 1) {
      return `Read by ${readByUsers[0]?.name || "1 user"}`;
    }

    return `Read by ${readByUsers.length}`;
  };

  const switchChatType = (type) => {
    setChatType(type);
    setSelectedId("");
    setMessages([]);
  };

  return (
    <div className="flex">
      <Sidebar />

      <main className="flex-1 min-h-screen">
        <Navbar />

        <div className="p-4 md:p-8 pb-28 lg:pb-8 max-w-7xl mx-auto">
          <section className="glass-card rounded-[32px] p-8 mb-8">
            <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
              Team Communication
            </p>
            <h1 className="text-4xl font-black text-slate-900 mt-2 tracking-tight">
              Messages
            </h1>
            <p className="text-slate-500 mt-3">
              Send direct messages or discuss inside project channels.
            </p>
          </section>

          <section className="glass-card rounded-[32px] overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] min-h-[680px]">
              <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-white/70 p-5">
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <button
                    onClick={() => switchChatType("direct")}
                    className={`rounded-2xl px-4 py-3 text-sm font-black ${
                      chatType === "direct"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Direct
                  </button>

                  <button
                    onClick={() => switchChatType("project")}
                    className={`rounded-2xl px-4 py-3 text-sm font-black ${
                      chatType === "project"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Projects
                  </button>
                </div>

                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                  {chatType === "direct" ? "Employees" : "Project Channels"}
                </p>

                <div className="space-y-2 max-h-[280px] lg:max-h-[560px] overflow-auto">
                  {(chatType === "direct" ? users : projects).length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center">
                      <p className="text-sm font-bold text-slate-400">
                        {chatType === "direct"
                          ? "No employees found"
                          : "No project channels found"}
                      </p>
                    </div>
                  )}

                  {(chatType === "direct" ? users : projects).map((item) => {
                    const unreadCount =
                      chatType === "direct"
                        ? unreadSummary.directCounts?.[item._id] || 0
                        : unreadSummary.projectCounts?.[item._id] || 0;

                    return (
                      <button
                        key={item._id}
                        onClick={() => setSelectedId(item._id)}
                        className={`w-full text-left rounded-2xl p-4 border transition ${
                          selectedId === item._id
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : unreadCount > 0
                            ? "bg-amber-50 border-amber-200 text-slate-800"
                            : "bg-white border-slate-100 text-slate-700 hover:border-blue-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black">
                            {item.name?.charAt(0)?.toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm truncate">{item.name}</p>
                            <p className="text-xs opacity-60">
                              {chatType === "direct" ? item.role : "Project channel"}
                            </p>
                          </div>

                          {unreadCount > 0 && (
                            <span className="min-w-6 h-6 px-2 rounded-full bg-red-600 text-white text-xs font-black flex items-center justify-center">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="flex flex-col bg-slate-50/70">
                <div className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6">
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase">
                      {chatType === "direct" ? "Direct Message" : "Project Channel"}
                    </p>
                    <h2 className="text-xl font-black text-slate-900">
                      {selectedChatName}
                    </h2>
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-auto space-y-3">
                  {!selectedId ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-5xl mb-4">💬</p>
                        <p className="font-black text-slate-800">
                          Select a conversation
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Choose a user or project channel from the left.
                        </p>
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-5xl mb-4">✨</p>
                        <p className="font-black text-slate-800">
                          No messages yet
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Start the conversation below.
                        </p>
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isMine = message.sender?._id === user._id;

                      return (
                        <div
                          key={message._id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-3xl px-5 py-3 border ${
                              isMine
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-slate-800 border-slate-200"
                            }`}
                          >
                            <p
                              className={`text-xs font-black mb-1 ${
                                isMine ? "text-blue-100" : "text-slate-400"
                              }`}
                            >
                              {message.sender?.name}
                            </p>

                            <p className="text-sm leading-relaxed">
                              {message.text}
                            </p>

                            <div
                              className={`flex items-center gap-2 text-[11px] mt-2 ${
                                isMine ? "text-blue-100" : "text-slate-400"
                              }`}
                            >
                              <span>
                                {new Date(message.createdAt).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>

                              {isMine && (
                                <>
                                  <span>·</span>
                                  <span>
                                    {chatType === "direct"
                                      ? getDirectSeenText(message)
                                      : getProjectSeenText(message)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {Object.keys(typingUsers).length > 0 && (
                  <div className="bg-white border-t border-slate-100 px-6 py-2">
                    <p className="text-xs font-bold text-blue-600">
                      {Object.values(typingUsers).join(", ")}{" "}
                      {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing...
                    </p>
                  </div>
                )}

                <form
                  onSubmit={sendMessage}
                  className="bg-white border-t border-slate-200 p-5 flex gap-3"
                >
                  <input
                    value={text}
                    onChange={(e) => handleTyping(e.target.value)}
                    placeholder={
                      selectedId
                        ? "Type your message..."
                        : "Select a conversation first"
                    }
                    disabled={!selectedId}
                    className="input-modern disabled:opacity-50"
                  />

                  <button
                    disabled={!selectedId}
                    className="btn-primary whitespace-nowrap disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Messages;
