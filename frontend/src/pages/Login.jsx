import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute h-96 w-96 rounded-full bg-blue-300/30 blur-3xl -top-20 -left-20" />
      <div className="absolute h-96 w-96 rounded-full bg-violet-300/30 blur-3xl -bottom-20 -right-20" />

      <div className="grid grid-cols-1 lg:grid-cols-2 w-full max-w-6xl glass-card rounded-[32px] overflow-hidden relative z-10">
        <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-10 text-white">
          <div>
            <div className="bg-white rounded-3xl p-4 inline-flex">
              <img
                src="/wohlig-logo.png"
                alt="Wohlig Logo"
                className="h-14 w-auto object-contain"
              />
            </div>

            <h1 className="text-4xl font-black mt-8 leading-tight">
              TaskBoard
            </h1>

            <p className="text-blue-100 mt-5 leading-relaxed">
              A secure workspace for teams to manage projects, tasks, statuses, and employee workflows.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-2xl p-4">
              <p className="text-2xl font-black">5</p>
              <p className="text-xs text-blue-100">Statuses</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4">
              <p className="text-2xl font-black">2</p>
              <p className="text-xs text-blue-100">Roles</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4">
              <p className="text-2xl font-black">∞</p>
              <p className="text-xs text-blue-100">Projects</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 md:p-12">
          <div className="mb-8">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-wider">
              Secure Login
            </p>
            <h2 className="text-3xl font-black text-slate-900 mt-2">
              Sign in
            </h2>
            <p className="text-slate-500 mt-2">
              Enter the credentials provided by your admin.
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              name="email"
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              className="input-modern"
              required
            />

            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="input-modern"
              required
            />

            <button className="btn-primary w-full">
              Login
            </button>
          </form>

          <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-sm font-bold text-slate-700">
              Need an account?
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Contact your workspace admin. New users are created from the Admin Panel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
