import { useState } from "react";
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
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hi, I am your workspace assistant. Ask me about projects, employees, tasks, deadlines, overdue work, or your assigned tasks."
    }
  ]);

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="flex">
      <Sidebar />

      <main className="flex-1 min-h-screen">
        <Navbar />

        <div className="p-4 md:p-8 pb-28 lg:pb-8 max-w-6xl mx-auto">
          <section className="glass-card rounded-3xl md:rounded-[32px] p-5 md:p-8 mb-6">
            <p className="text-sm font-black text-blue-600 uppercase tracking-wider">
              Workspace Assistant
            </p>

            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-2">
              TaskBoard Chatbot
            </h1>

            <p className="text-slate-500 mt-3 max-w-2xl">
              Ask questions about projects, employees, assigned tasks, due dates,
              pending work, and overdue tasks.
            </p>
          </section>

          <section className="glass-card rounded-[32px] overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-[650px]">
              <aside className="bg-white/70 border-b lg:border-b-0 lg:border-r border-slate-200 p-5">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                  Try asking
                </p>

                <div className="space-y-2">
                  {starterQuestions.map((item) => (
                    <button
                      key={item}
                      onClick={() => askQuestion(item)}
                      className="w-full text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-2xl p-3 text-sm font-semibold text-slate-700 transition"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </aside>

              <div className="flex flex-col bg-slate-50/60">
                <div className="flex-1 p-5 overflow-auto space-y-4">
                  {messages.map((message, index) => {
                    const isUser = message.role === "user";

                    return (
                      <div
                        key={index}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-3xl px-5 py-4 border whitespace-pre-line ${
                            isUser
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-800 border-slate-200"
                          }`}
                        >
                          <p className="text-sm leading-relaxed">
                            {message.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 rounded-3xl px-5 py-4">
                        <p className="text-sm font-bold text-slate-500">
                          Thinking...
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    askQuestion();
                  }}
                  className="bg-white border-t border-slate-200 p-4 flex gap-3"
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
