import { useEffect, useMemo, useState } from "react";
import * as api from "../api";
import { DAY_SHORT, WEEKDAY_ORDER, card, ghostButton } from "../constants";
import { fromDateString, weekdayOf } from "../utils";

const ALL_COLOR = "#10b981";
// Alpha suffixes appended to a 6-digit hex color, faintest -> strongest (the last one is fully solid)
const LEVELS = ["35", "65", "95", "c5", "ff"];
const levelOf = (ratio) =>
  ratio === 1 ? 4 : Math.min(3, Math.floor(ratio * 4));
const pad = (n) => String(n).padStart(2, "0");

const daysInMonthOf = (month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

// "2026-10" shifted by n months -> "2026-11"
const shiftMonth = (month, n) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export default function MonthHeatmap({ today, version }) {
  const currentMonth = today.slice(0, 7);
  const earliestMonth = shiftMonth(currentMonth, -12);

  const [month, setMonth] = useState(currentMonth);
  const [selected, setSelected] = useState("all"); // "all" or a habit id
  const [habits, setHabits] = useState(null); // active habits with start dates (from /stats)
  const [checkIns, setCheckIns] = useState(null); // check-ins of the shown month; null while loading
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  // Reloads when the month changes, when the page reloads its habits (version), or on retry
  useEffect(() => {
    let ignore = false; // drops answers that arrive after the inputs changed
    Promise.all([
      api.getStats(today),
      api.getCheckIns(`${month}-01`, `${month}-${pad(daysInMonthOf(month))}`),
    ])
      .then(([s, c]) => {
        if (ignore) return;
        setHabits(s.habits);
        setCheckIns(c);
        setError("");
      })
      .catch((err) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, [month, today, version, retry]);

  const goTo = (n) => {
    setCheckIns(null); // show the placeholder until the new month arrives
    setMonth(shiftMonth(month, n));
  };

  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = daysInMonthOf(month);
  const offset = (new Date(year, mon - 1, 1).getDay() + 6) % 7; // blank cells before the 1st (Monday first)
  const monthLabel = new Date(year, mon - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const habit = habits?.find((h) => h._id === selected) || null; // null = all habits
  const color = habit ? habit.color : ALL_COLOR;

  const { cells, summary } = useMemo(() => {
    if (!habits || !checkIns) return { cells: [], summary: null };

    const list = habit ? [habit] : habits;
    const done = new Set(checkIns.map((c) => `${c.habit}|${c.date}`));
    let scheduled = 0;
    let completed = 0;

    const cells = Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${month}-${pad(i + 1)}`;
      const weekday = weekdayOf(date);
      const nice = fromDateString(date).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });

      // Habits that count on this day: scheduled that weekday, and already being tracked
      // (or checked, which means tracking started on or before this day)
      const due = list.filter(
        (h) =>
          h.days.includes(weekday) &&
          (date >= h.startDate || done.has(`${h._id}|${date}`)),
      );
      const total = due.length;
      const doneCount = due.filter((h) => done.has(`${h._id}|${date}`)).length;

      let state = "level";
      if (date > today) state = "future";
      else if (total === 0) state = "rest";
      else if (doneCount === 0) state = "missed";

      // Totals follow the same rule as the server: today is still open, so it only counts what's done
      if (state === "level" || state === "missed") {
        const counted = date === today ? doneCount : total;
        scheduled += counted;
        completed += doneCount;
      }

      let title = `${nice}: nothing scheduled`;
      if (state === "future") title = nice;
      else if (habit && state !== "rest")
        title = `${nice}: ${doneCount ? "done" : date === today ? "not done yet" : "missed"}`;
      else if (!habit && state !== "rest")
        title = `${nice}: ${doneCount} of ${total} habit${total === 1 ? "" : "s"} done`;

      return {
        date,
        day: i + 1,
        state,
        ratio: total ? doneCount / total : 0,
        title,
      };
    });

    return {
      cells,
      summary: {
        scheduled,
        completed,
        pct: scheduled ? Math.round((completed / scheduled) * 100) : null,
      },
    };
  }, [habits, checkIns, habit, month, daysInMonth, today]);

  const cellStyle = (c) => {
    if (c.state !== "level")
      return {
        cls: {
          future: "bg-white/[0.02] text-slate-700",
          rest: "text-slate-600",
          missed: "bg-white/[0.07] text-slate-400",
        }[c.state],
      };
    return {
      cls: "text-white",
      style: {
        backgroundColor: color + LEVELS[levelOf(c.ratio)],
        ...(c.ratio === 1 && { boxShadow: `0 0 12px ${color}66` }),
      },
    };
  };

  return (
    <div className={card}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-white">Month overview</h3>
        {habits && (
          <select
            value={habit ? habit._id : "all"}
            onChange={(e) => setSelected(e.target.value)}
            className="max-w-[12rem] rounded-lg border border-white/10 bg-slate-800/70 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400"
          >
            <option value="all">All habits</option>
            {habits.map((h) => (
              <option key={h._id} value={h._id}>
                {h.emoji} {h.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-3 flex items-center justify-center gap-3">
        <button
          onClick={() => goTo(-1)}
          disabled={month <= earliestMonth}
          aria-label="Previous month"
          className={ghostButton}
        >
          ←
        </button>
        <span className="w-40 text-center text-sm font-medium text-slate-200">
          {monthLabel}
        </span>
        <button
          onClick={() => goTo(1)}
          disabled={month >= currentMonth}
          aria-label="Next month"
          className={ghostButton}
        >
          →
        </button>
      </div>

      {error && (
        <p className="py-8 text-center text-sm text-rose-300">
          {error}{" "}
          <button
            onClick={() => setRetry((r) => r + 1)}
            className="font-medium underline"
          >
            Try again
          </button>
        </p>
      )}

      {!error && !summary && (
        <div className="mx-auto h-64 max-w-md animate-pulse rounded-xl bg-white/5" />
      )}

      {!error && summary && (
        <>
          <div className="mx-auto max-w-md">
            <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-xs text-slate-500">
              {WEEKDAY_ORDER.map((d) => (
                <span key={d}>{DAY_SHORT[d]}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: offset }, (_, i) => (
                <span key={`blank${i}`} />
              ))}
              {cells.map((c) => {
                const { cls, style } = cellStyle(c);
                return (
                  <div
                    key={c.date}
                    title={c.title}
                    aria-label={c.title}
                    style={style}
                    className={`flex aspect-square items-center justify-center rounded-lg text-xs font-medium transition ${cls} ${
                      c.date === today ? "ring-2 ring-emerald-300/80" : ""
                    }`}
                  >
                    {c.day}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
            {habit ? (
              <>
                <span className="h-3.5 w-3.5 rounded bg-white/[0.07]" />
                <span className="mr-2">Missed</span>
                <span
                  className="h-3.5 w-3.5 rounded"
                  style={{ backgroundColor: color }}
                />
                <span>Done</span>
              </>
            ) : (
              <>
                <span>Less</span>
                <span className="h-3.5 w-3.5 rounded bg-white/[0.07]" />
                {LEVELS.map((a) => (
                  <span
                    key={a}
                    className="h-3.5 w-3.5 rounded"
                    style={{ backgroundColor: color + a }}
                  />
                ))}
                <span>More</span>
              </>
            )}
          </div>

          <p className="mt-3 text-center text-sm text-slate-400">
            {summary.scheduled === 0 ? (
              "Nothing to measure yet this month"
            ) : (
              <>
                <span className="font-semibold text-white">
                  {summary.completed}
                </span>{" "}
                of {summary.scheduled}{" "}
                {habit ? "scheduled days" : "scheduled check-ins"} done ·{" "}
                <span className="font-semibold text-emerald-300">
                  {summary.pct}%
                </span>
              </>
            )}
          </p>
          <p className="mt-1 text-center text-xs text-slate-600">
            Dim numbers mean nothing was scheduled. Today only counts what
            you’ve done so far.
          </p>
        </>
      )}
    </div>
  );
}
