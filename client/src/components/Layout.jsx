import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../AuthContext";

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-white/10 text-emerald-300"
      : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
  }`;

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-6">
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <span>🔥</span>
              <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
                Habit Tracker
              </span>
            </h1>
            <nav className="flex gap-1">
              <NavLink to="/" end className={linkClass}>
                Today
              </NavLink>
              <NavLink to="/habits" className={linkClass}>
                Habits
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:inline">
              Hi, {user.name}
            </span>
            <button
              onClick={logout}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
