import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import useToday from "../useToday";
import { describeDays } from "../utils";
import { card, ghostButton, primaryButton } from "../constants";
import HabitForm from "../components/HabitForm";
import MonthHeatmap from "../components/MonthHeatmap";

export default function Habits() {
  const today = useToday();
  const [habits, setHabits] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined = form closed, null = new habit, object = edit
  const [busyId, setBusyId] = useState(null);
  const [version, setVersion] = useState(0); // bumps after every reload so the heatmap refreshes too

  const load = useCallback(async () => {
    try {
      setHabits(await api.getHabits(true)); // active and archived
      setVersion((v) => v + 1);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (habit, action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(habit._id);
    try {
      await action(habit._id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const active = (habits || []).filter((h) => !h.archivedAt);
  const archived = (habits || []).filter((h) => h.archivedAt);

  const row = (h) => (
    <li key={h._id} className="flex items-center gap-3 py-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
        style={{
          backgroundColor: h.color + "26",
          boxShadow: `0 0 0 1px ${h.color}55`,
        }}
      >
        {h.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">{h.name}</p>
        <p className="text-xs text-slate-500">{describeDays(h.days)}</p>
      </div>
      {h.archivedAt ? (
        <button
          disabled={busyId === h._id}
          onClick={() => act(h, api.restoreHabit)}
          className={ghostButton}
        >
          Restore
        </button>
      ) : (
        <>
          <button onClick={() => setEditing(h)} className={ghostButton}>
            Edit
          </button>
          <button
            disabled={busyId === h._id}
            onClick={() =>
              act(
                h,
                api.archiveHabit,
                `Archive "${h.name}"? It leaves your daily list, but its history is kept and you can restore it.`,
              )
            }
            className="rounded-lg border border-white/10 px-3 py-1 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
          >
            Archive
          </button>
        </>
      )}
    </li>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Habits</h2>
        <button onClick={() => setEditing(null)} className={primaryButton}>
          + New habit
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
          {error}
        </div>
      )}
      {!habits && !error && (
        <p className="py-10 text-center text-sm text-slate-500">Loading...</p>
      )}

      {habits && (
        <div className="space-y-6">
          {active.length > 0 && (
            <MonthHeatmap today={today} version={version} />
          )}

          <div className={card}>
            <h3 className="font-semibold text-white">
              Active{" "}
              <span className="text-sm font-normal text-slate-500">
                ({active.length})
              </span>
            </h3>
            {active.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                No active habits
              </p>
            )}
            <ul className="divide-y divide-white/10">{active.map(row)}</ul>
          </div>

          {archived.length > 0 && (
            <div className={`${card} opacity-80`}>
              <h3 className="font-semibold text-white">
                Archived{" "}
                <span className="text-sm font-normal text-slate-500">
                  ({archived.length})
                </span>
              </h3>
              <ul className="divide-y divide-white/10">{archived.map(row)}</ul>
            </div>
          )}
        </div>
      )}

      {editing !== undefined && (
        <HabitForm
          habit={editing}
          onSaved={load}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
