import { useEffect, useState } from "react";
import * as api from "../api";
import {
  COLORS,
  EMOJIS,
  DAY_SHORT,
  WEEKDAY_ORDER,
  inputClass,
  primaryButton,
  errorBox,
} from "../constants";

const blank = {
  name: "",
  emoji: "✅",
  color: COLORS[0],
  days: [0, 1, 2, 3, 4, 5, 6],
};

// habit = an existing habit to edit, or null to create a new one
export default function HabitForm({ habit, onSaved, onClose }) {
  const [form, setForm] = useState(
    habit
      ? {
          name: habit.name,
          emoji: habit.emoji,
          color: habit.color,
          days: habit.days,
        }
      : blank,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Escape closes the form
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setDays = (days) => setForm((f) => ({ ...f, days }));
  const toggleDay = (d) =>
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d],
    }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.days.length === 0) return setError("Pick at least one day");

    setError("");
    setSaving(true);
    const body = {
      name: form.name.trim(),
      emoji: form.emoji.trim() || "✅",
      color: form.color,
      days: form.days,
    };
    try {
      if (habit) await api.updateHabit(habit._id, body);
      else await api.createHabit(body);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const chip = (active) =>
    `rounded-lg border px-3 py-1.5 text-sm font-medium ${
      active
        ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
        : "border-white/10 text-slate-400 hover:bg-white/5"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="max-h-full w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-slate-900 p-6 shadow-2xl ring-1 ring-white/10"
      >
        <h2 className="text-lg font-semibold text-white">
          {habit ? "Edit habit" : "New habit"}
        </h2>

        {error && <p className={errorBox}>{error}</p>}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Name
          </label>
          <input
            autoFocus
            required
            maxLength={50}
            placeholder="e.g. Drink water"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Emoji
          </label>
          <input
            maxLength={16}
            value={form.emoji}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            className={`${inputClass} mb-2 !w-20 text-center text-lg`}
          />
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map((em) => (
              <button
                type="button"
                key={em}
                onClick={() => setForm({ ...form, emoji: em })}
                className={`h-9 w-9 rounded-lg text-lg hover:bg-white/10 ${
                  form.emoji === em ? "bg-white/10 ring-2 ring-emerald-400" : ""
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setForm({ ...form, color: c })}
                aria-label={`Color ${c}`}
                style={{ backgroundColor: c }}
                className={`h-8 w-8 rounded-full ${
                  form.color === c
                    ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900"
                    : ""
                }`}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300">Days</label>
            <div className="flex gap-2 text-xs text-emerald-300">
              <button
                type="button"
                onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}
                className="hover:underline"
              >
                Every day
              </button>
              <button
                type="button"
                onClick={() => setDays([1, 2, 3, 4, 5])}
                className="hover:underline"
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={() => setDays([0, 6])}
                className="hover:underline"
              >
                Weekends
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_ORDER.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => toggleDay(d)}
                className={chip(form.days.includes(d))}
              >
                {DAY_SHORT[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-white/5"
          >
            Cancel
          </button>
          <button disabled={saving} className={primaryButton}>
            {saving ? "Saving..." : habit ? "Save changes" : "Create habit"}
          </button>
        </div>
      </form>
    </div>
  );
}
