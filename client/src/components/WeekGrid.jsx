import { DAY_SHORT, card } from "../constants";
import { addDays, weekdayOf } from "../utils";

const columns = {
  gridTemplateColumns: "minmax(7rem, 1fr) repeat(7, 2.25rem) 3rem",
};

export default function WeekGrid({ habits, checkIns, today, busy, onToggle }) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)); // oldest -> today
  const done = new Set(checkIns.map((c) => `${c.habit}|${c.date}`));

  return (
    <div className={card}>
      <h2 className="mb-4 font-semibold text-white">Last 7 days</h2>

      <div className="overflow-x-auto">
        <div className="min-w-[28rem] space-y-2">
          {/* Header: weekday names and day numbers */}
          <div
            style={columns}
            className="grid items-end gap-1 text-center text-xs"
          >
            <span />
            {dates.map((d) => (
              <div
                key={d}
                className={
                  d === today ? "font-bold text-emerald-300" : "text-slate-500"
                }
              >
                {DAY_SHORT[weekdayOf(d)]}
                <br />
                {Number(d.slice(8))}
              </div>
            ))}
            <span className="text-slate-500">7d</span>
          </div>

          {habits.map((h) => (
            <div
              key={h._id}
              style={columns}
              className="grid items-center gap-1"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-slate-200">
                <span>{h.emoji}</span>
                <span className="truncate">{h.name}</span>
              </span>

              {dates.map((d) => {
                if (!h.days.includes(weekdayOf(d))) {
                  return (
                    <span key={d} className="text-center text-slate-700">
                      ·
                    </span>
                  ); // not scheduled
                }
                const key = `${h._id}|${d}`;
                const checked = done.has(key);
                const beforeStart = d < h.startDate && d !== today; // habit wasn't being tracked yet
                return (
                  <button
                    key={d}
                    disabled={busy.has(key)}
                    onClick={() => onToggle(h, d, checked)}
                    title={d}
                    aria-label={`${h.name} on ${d}: ${checked ? "done" : "not done"}`}
                    style={
                      checked
                        ? {
                            backgroundColor: h.color,
                            borderColor: h.color,
                            boxShadow: `0 0 12px ${h.color}66`,
                          }
                        : undefined
                    }
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg border-2 text-sm font-bold text-white transition disabled:opacity-50 ${
                      checked ? "" : "border-white/15 hover:border-white/40"
                    } ${beforeStart && !checked ? "opacity-40" : ""}`}
                  >
                    {checked ? "✓" : ""}
                  </button>
                );
              })}

              <span className="text-center text-xs text-slate-400">
                {h.last7.rate === null ? "—" : `${h.last7.rate}%`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Click a square to mark or unmark that day. A dot means the habit isn’t
        scheduled that day.
      </p>
    </div>
  );
}
