import { card } from "../constants";

export default function StatCards({ habits }) {
  const due = habits.filter((h) => h.scheduledToday);
  const done = due.filter((h) => h.checkedToday).length;
  const best = habits.reduce((m, h) => Math.max(m, h.currentStreak), 0);
  const rates = habits.map((h) => h.last7.rate).filter((r) => r !== null);
  const avg = rates.length
    ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length)
    : null;

  const items = [
    {
      label: "Done today",
      value: due.length ? `${done}/${due.length}` : "—",
      icon: "✅",
      glow: "from-emerald-500/20",
    },
    {
      label: "Best current streak",
      value: best,
      icon: "🔥",
      glow: "from-amber-500/20",
    },
    {
      label: "7-day average",
      value: avg === null ? "—" : `${avg}%`,
      icon: "📈",
      glow: "from-indigo-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {items.map((i) => (
        <div
          key={i.label}
          className={`${card} bg-gradient-to-br ${i.glow} to-transparent !p-4 sm:!p-5`}
        >
          <p className="text-xl sm:text-2xl">{i.icon}</p>
          <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">
            {i.value}
          </p>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">{i.label}</p>
        </div>
      ))}
    </div>
  );
}
