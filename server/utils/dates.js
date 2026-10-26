const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];
const MAX_BACKFILL_DAYS = 365; // how far back a check-in may be dated
const MAX_RANGE_DAYS = 366; // longest range the list route accepts

// "2026-10-25" -> true. "2026-02-30", "26-10-2026", undefined or arrays -> false
const isValidDateString = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

const toDateString = (ms) => new Date(ms).toISOString().slice(0, 10);

// Weekday of a calendar date: 0 = Sunday ... 6 = Saturday (same in every time zone)
const weekdayOf = (dateString) =>
  new Date(`${dateString}T00:00:00.000Z`).getUTCDay();

// Latest date we accept is "now" in UTC+14, the furthest-ahead time zone,
// so nobody gets rejected on their own "today"
const latestAllowed = () => toDateString(Date.now() + 14 * 60 * 60 * 1000);

// Earliest date: a year back, plus one day of slack for time zones
const earliestAllowed = () =>
  toDateString(Date.now() - (MAX_BACKFILL_DAYS + 1) * DAY_MS);

// Number of days from start to end, counting both
const spanInDays = (start, end) =>
  (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) /
    DAY_MS +
  1;

module.exports = {
  DAY_NAMES,
  MAX_BACKFILL_DAYS,
  MAX_RANGE_DAYS,
  isValidDateString,
  weekdayOf,
  latestAllowed,
  earliestAllowed,
  spanInDays,
};
