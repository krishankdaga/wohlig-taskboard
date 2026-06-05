import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import API from "../api/axios";
import socket from "../api/socket";
import { useAuth } from "../context/AuthContext";

const Messages = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const messagesEndRef = useRef(null);

  const [chatType, setChatType] = useState("direct");
  const [selectedId, setSelectedId] = useState("");
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [unreadSummary, setUnreadSummary] = useState({
    directCounts: {},
    projectCounts: {}
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end"
    });
  };

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
    if (!selectedId) return;

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
    setTypingUsers({});
  }, [selectedId, chatType]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

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

      const isCurrentDirectChat =
        chatType === "direct" &&
        newMessage.messageType === "direct" &&
        selectedId &&
        (
          newMessage.sender?._id === selectedId ||
          newMessage.receiver?._id === selectedId
        );

      const isCurrentProjectChat =
        chatType === "project" &&
        newMessage.messageType === "project" &&
        selectedId &&
        newMessage.project?._id === selectedId;

      if (isCurrentDirectChat || isCurrentProjectChat) {
        setMessages((prev) => {
          const exists = prev.some((message) => message._id === newMessage._id);
          if (exists) return prev;
          return [...prev, newMessage];
        });
      }
    });

    return () => {
      socket.off("userTyping");
      socket.off("userStoppedTyping");
      socket.off("messagesRead");
      socket.off("messageCreated");
    };
  }, [selectedId, chatType, user?._id]);

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

    if (!text.trim() || !selectedId) return;

    try {
      const endpoint =
        chatType === "direct"
          ? `/messages/direct/${selectedId}`
          : `/messages/project/${selectedId}`;

      const { data } = await API.post(endpoint, {
        text
      });

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
    setTypingUsers({});
  };

  const listItems = chatType === "direct" ? users : projects;
  const selectedItem = listItems.find((item) => item._id === selectedId);

  return (
    <div className="flex min-h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 min-w-0 h-screen overflow-hidden flex flex-col">
        <Navbar />

        <div className="flex-1 min-h-0 p-3 sm:p-4 md:p-6 lg:p-8 pb-28 lg:pb-8 max-w-7xl w-full mx-auto overflow-hidden">
          <section className="h-full glass-card rounded-3xl md:rounded-[32px] overflow-hidden flex flex-col">
            <div className="shrink-0 p-5 md:p-7 border-b border-slate-200 bg-white/80">
              <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                Communication
              </p>

              <h1 className="text-2xl md:text-4xl font-black text-slate-900 mt-2">
                Messages
              </h1>

              <p className="text-slate-500 mt-2 max-w-2xl text-sm md:text-base">
                Communicate with employees directly or discuss work inside project channels.
              </p>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[340px_1fr]">
              <aside className="shrink-0 bg-white/70 border-b lg:border-b-0 lg:border-r border-slate-200 p-4 md:p-5 max-h-[280px] lg:max-h-none overflow-hidden flex flex-col">
                <div className="grid grid-cols-2 gap-2 mb-5 shrink-0">
                  <button
                    onClick={() => switchChatType("direct")}
                    className={`rounded-2xl py-3 text-sm font-black transition ${
                      chatType === "direct"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Direct
                  </button>

                  <button
                    onClick={() => switchChatType("project")}
                    className={`rounded-2xl py-3 text-sm font-black transition ${
                      chatType === "project"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Projects
                  </button>
                </div>

                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 shrink-0">
                  {chatType === "direct" ? "Employees" : "Project Channels"}
                </p>

                <div className="space-y-2 overflow-auto hide-scrollbar flex-1 pr-1">
                  {listItems.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center">
                      <p className="text-sm font-bold text-slate-400">
                        {chatType === "direct"
                          ? "No employees found"
                          : "No project channels found"}
                      </p>
                    </div>
                  )}

                  {listItems.map((item) => {
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
                          <div className="h-9 w-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                            {item.name?.charAt(0)?.toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm truncate">
                              {item.name}
                            </p>
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

              <div className="min-h-0 flex flex-col bg-slate-50/60">
                <div className="shrink-0 bg-white border-b border-slate-200 p-4 md:p-5">
                  <p className="text-xs font-black text-blue-600 uppercase tracking-wider">
                    {chatType === "direct" ? "Direct Message" : "Project Channel"}
                  </p>

                  <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
                    {selectedItem?.name || "Select a conversation"}
                  </h2>
                </div>

                {!selectedId ? (
                  <div className="flex-1 min-h-0 flex items-center justify-center p-8">
                    <div className="max-w-md text-center">
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">
                        No conversation selected
                      </p>
                      <h3 className="text-2xl font-black text-slate-900 mt-2">
                        Choose a chat to begin
                      </h3>
                      <p className="text-slate-500 mt-2">
                        Select an employee or project channel from the left panel.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-h-0 p-4 md:p-5 overflow-y-auto space-y-4">
                      {messages.map((message) => {
                        const isMine = message.sender?._id === user._id;

                        return (
                          <div
                            key={message._id}
                            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[92%] md:max-w-[72%] rounded-3xl px-5 py-4 border shadow-sm ${
                                isMine
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-slate-800 border-slate-200"
                              }`}
                            >
                              <p
                                className={`text-xs font-black mb-2 ${
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
                      })}

                      {Object.keys(typingUsers).length > 0 && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-slate-200 rounded-3xl px-5 py-3">
                            <p className="text-xs font-bold text-blue-600">
                              {Object.values(typingUsers).join(", ")}{" "}
                              {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing...
                            </p>
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>

                    <form
                      onSubmit={sendMessage}
                      className="shrink-0 bg-white border-t border-slate-200 p-3 md:p-4 flex gap-2 md:gap-3"
                    >
                      <input
                        value={text}
                        onChange={(e) => handleTyping(e.target.value)}
                        placeholder="Write a message..."
                        className="input-modern"
                      />

                      <button className="btn-primary whitespace-nowrap">
                        Send
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Messages;
