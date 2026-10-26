import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api";
import useToday from "../useToday";
import { addDays, fromDateString } from "../utils";
import { card, primaryButton } from "../constants";
import StatCards from "../components/StatCards";
import TodayList from "../components/TodayList";
import WeekGrid from "../components/WeekGrid";
import HabitForm from "../components/HabitForm";

export default function Dashboard() {
  const today = useToday(); // the user's local date, "YYYY-MM-DD"
  const [stats, setStats] = useState(null); // { today, habits: [...] }
  const [checkIns, setCheckIns] = useState([]); // check-ins of the last 7 days
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(new Set()); // "habitId|date" keys being saved
  const [showForm, setShowForm] = useState(false);
  const latest = useRef(0);

  // Loads stats (streaks, today's state) and the 7-day check-ins together
  const load = useCallback(async () => {
    const id = ++latest.current;
    try {
      const [s, c] = await Promise.all([
        api.getStats(today),
        api.getCheckIns(addDays(today, -6), today),
      ]);
      if (id !== latest.current) return; // a newer load has started, ignore this answer
      setStats(s);
      setCheckIns(c);
      setError("");
    } catch (err) {
      if (id === latest.current) setError(err.message);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  // Check or uncheck one habit on one day, then reload everything
  const toggle = async (habit, date, checked) => {
    const key = `${habit._id}|${date}`;
    setBusy((b) => new Set(b).add(key));
    try {
      await (checked ? api.uncheckHabit : api.checkHabit)(habit._id, date);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(key);
        return next;
      });
    }
  };

  const heading = fromDateString(today).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Today</h2>
          <p className="text-sm text-slate-400">{heading}</p>
        </div>
        <button onClick={() => setShowForm(true)} className={primaryButton}>
          + New habit
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

      {!stats && !error && (
        <p className="py-10 text-center text-sm text-slate-500">
          Loading... (a sleeping free server can take up to a minute to wake up)
        </p>
      )}

      {stats && stats.habits.length === 0 && (
        <div className={`${card} !p-10 text-center`}>
          <p className="text-4xl">🌱</p>
          <p className="mt-3 font-medium text-white">No habits yet</p>
          <p className="mb-5 text-sm text-slate-400">
            Create your first habit to start a streak.
          </p>
          <button onClick={() => setShowForm(true)} className={primaryButton}>
            Create a habit
          </button>
        </div>
      )}

      {stats && stats.habits.length > 0 && (
        <div className="space-y-6">
          <StatCards habits={stats.habits} />
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <TodayList
                habits={stats.habits}
                today={today}
                busy={busy}
                onToggle={toggle}
              />
            </div>
            <div className="lg:col-span-3">
              <WeekGrid
                habits={stats.habits}
                checkIns={checkIns}
                today={today}
                busy={busy}
                onToggle={toggle}
              />
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <HabitForm
          habit={null}
          onSaved={load}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
