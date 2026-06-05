import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import API from "../api/axios";

const starterQuestions = [
  "Who are the employees under Project Genesis?",
  "What are the tasks under GenAI Training?",
  "Which tasks are left?",
  "What is the last date for the latest task I have been given?",
  "Show my overdue tasks",
  "Show my high priority tasks",
  "Give me a task summary"
];

const Chatbot = () => {
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hi, I am your workspace assistant. Ask me about projects, employees, assigned tasks, due dates, pending work, and overdue tasks."
    }
  ]);

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end"
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const askQuestion = async (customQuestion) => {
    const finalQuestion = customQuestion || question;

    if (!finalQuestion.trim()) return;

    const userMessage = {
      role: "user",
      text: finalQuestion
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");

    try {
      setLoading(true);

      const { data } = await API.post("/chatbot/ask", {
        question: finalQuestion
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.answer
        }
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text:
            error.response?.data?.answer ||
            "Sorry, I could not answer that right now."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 min-w-0 h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950">
        <Navbar />

        <div className="flex-1 min-h-0 p-3 sm:p-4 md:p-6 lg:p-8 pb-28 lg:pb-8 max-w-7xl w-full mx-auto overflow-hidden">
          <section className="h-full glass-card rounded-3xl md:rounded-[32px] overflow-hidden flex flex-col">
            <div className="shrink-0 p-5 md:p-7 border-b border-slate-200 bg-white/80">
              <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
                Workspace Assistant
              </p>

              <h1 className="text-2xl md:text-4xl font-black text-slate-900 mt-2">
                TaskBoard Chatbot
              </h1>

              <p className="text-slate-500 mt-2 max-w-2xl text-sm md:text-base">
                Ask questions about projects, employees, assigned tasks, due dates,
                pending work, overdue tasks, and workspace progress.
              </p>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[320px_1fr]">
              <aside className="shrink-0 bg-white/70 border-b lg:border-b-0 lg:border-r border-slate-200 p-4 md:p-5 max-h-[210px] lg:max-h-none overflow-auto hide-scrollbar">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                  Try asking
                </p>

                <div className="flex lg:block gap-2 lg:space-y-2 overflow-x-auto lg:overflow-x-visible hide-scrollbar">
                  {starterQuestions.map((item) => (
                    <button
                      key={item}
                      onClick={() => askQuestion(item)}
                      className="min-w-[230px] lg:min-w-0 lg:w-full text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-2xl p-3 text-sm font-semibold text-slate-700 transition"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </aside>

              <div className="min-h-0 flex flex-col bg-slate-50/60">
                <div className="flex-1 min-h-0 p-4 md:p-5 overflow-y-auto space-y-4">
                  {messages.map((message, index) => {
                    const isUser = message.role === "user";

                    return (
                      <div
                        key={index}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[92%] md:max-w-[82%] rounded-3xl px-5 py-4 border whitespace-pre-line shadow-sm ${
                            isUser
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-800 border-slate-200"
                          }`}
                        >
                          <div
                            className={`text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-ul:my-2 prose-li:my-1 ${
                              isUser
                                ? "prose-invert"
                                : "prose-slate"
                            }`}
                          >
                            <ReactMarkdown>
                              {message.text}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 rounded-3xl px-5 py-4 shadow-sm">
                        <p className="text-sm font-bold text-slate-500">
                          Thinking...
                        </p>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    askQuestion();
                  }}
                  className="shrink-0 bg-white border-t border-slate-200 p-3 md:p-4 flex gap-2 md:gap-3"
                >
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about tasks, projects, employees, deadlines..."
                    className="input-modern"
                  />

                  <button
                    disabled={loading}
                    className="btn-primary whitespace-nowrap disabled:opacity-50"
                  >
                    Ask
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

export default Chatbot;
