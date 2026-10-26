import { DAY_SHORT, WEEKDAY_ORDER } from "./constants";

const pad = (n) => String(n).padStart(2, "0");

export const toDateString = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "2026-10-26" -> a Date at local midnight
export const fromDateString = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// The user's current local date, e.g. "2026-10-26"
export const today = () => toDateString(new Date());

export const addDays = (s, n) => {
  const d = fromDateString(s);
  d.setDate(d.getDate() + n);
  return toDateString(d);
};

// 0 = Sunday ... 6 = Saturday, the same numbering the API uses
export const weekdayOf = (s) => fromDateString(s).getDay();

// [1,2,3,4,5] -> "Weekdays", [1,3,5] -> "Mon, Wed, Fri"
export function describeDays(days) {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d)))
    return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return WEEKDAY_ORDER.filter((d) => set.has(d))
    .map((d) => DAY_SHORT[d])
    .join(", ");
}
