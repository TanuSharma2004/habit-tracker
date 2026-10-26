import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { inputClass, primaryButton, errorBox } from "../constants";

export default function AuthPage({ mode }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) await login({ email: form.email, password: form.password });
      else await register(form);
      // On success the user is set and the route guard redirects to the dashboard
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-slate-900/70 p-8 shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur"
      >
        <div className="text-center">
          <p className="text-4xl">🔥</p>
          <h1 className="mt-2 bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-2xl font-bold text-transparent">
            Habit Tracker
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isLogin
              ? "Welcome back. Keep your streaks alive."
              : "Build habits that stick."}
          </p>
        </div>

        {error && <p className={errorBox}>{error}</p>}

        {!isLogin && (
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={set("name")}
            className={inputClass}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={set("email")}
          className={inputClass}
          required
        />
        <input
          type="password"
          placeholder="Password (min 6 characters)"
          minLength={isLogin ? undefined : 6}
          value={form.password}
          onChange={set("password")}
          className={inputClass}
          required
        />

        <button disabled={loading} className={`${primaryButton} w-full`}>
          {loading ? "Please wait..." : isLogin ? "Log in" : "Register"}
        </button>

        <p className="text-center text-sm text-slate-400">
          {isLogin ? "No account yet? " : "Already registered? "}
          <Link
            to={isLogin ? "/register" : "/login"}
            className="font-medium text-emerald-300 hover:underline"
          >
            {isLogin ? "Register" : "Log in"}
          </Link>
        </p>
      </form>
    </div>
  );
}
