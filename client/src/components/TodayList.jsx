import { card } from "../constants";

function StreakBadge({ n }) {
  return n > 0 ? (
    <span
      title={`${n} in a row`}
      className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/30"
    >
      🔥 {n}
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-500">
      0
    </span>
  );
}

export default function TodayList({ habits, today, busy, onToggle }) {
  const due = habits.filter((h) => h.scheduledToday);
  const rest = habits.filter((h) => !h.scheduledToday);
  const done = due.filter((h) => h.checkedToday).length;
  const pct = due.length ? Math.round((done / due.length) * 100) : 0;

  const row = (h) => (
    <li
      key={h._id}
      className={`flex items-center gap-3 py-3 ${h.scheduledToday ? "" : "opacity-50"}`}
    >
      {h.scheduledToday ? (
        <input
          type="checkbox"
          checked={h.checkedToday}
          disabled={busy.has(`${h._id}|${today}`)}
          onChange={() => onToggle(h, today, h.checkedToday)}
          aria-label={`Mark ${h.name} as done today`}
          style={{ accentColor: h.color }}
          className="h-6 w-6 shrink-0 cursor-pointer disabled:opacity-50"
        />
      ) : (
        <span className="w-6 shrink-0 text-center text-slate-600">–</span>
      )}
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
        style={{
          backgroundColor: h.color + "26",
          boxShadow: `0 0 0 1px ${h.color}55`,
        }}
      >
        {h.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${h.checkedToday ? "text-slate-500 line-through" : "text-slate-100"}`}
        >
          {h.name}
        </p>
        <p className="text-xs text-slate-500">
          {h.scheduledToday ? `Best streak ${h.longestStreak}` : "Rest day"}
        </p>
      </div>
      <StreakBadge n={h.currentStreak} />
    </li>
  );

  return (
    <div className={card}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold text-white">Today’s habits</h2>
        <span className="text-sm text-slate-400">
          {due.length === 0
            ? "Nothing scheduled"
            : `${done} of ${due.length} done`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_12px_rgba(52,211,153,0.6)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {due.length > 0 && done === due.length && (
        <p className="mt-3 text-sm font-medium text-emerald-300">
          All done for today 🎉
        </p>
      )}
      <ul className="mt-2 divide-y divide-white/10">
        {[...due, ...rest].map(row)}
      </ul>
    </div>
  );
}
