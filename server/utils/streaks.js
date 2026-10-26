const { toDateString, addDays, weekdayOf } = require("./dates");

const HOURS_14 = 14 * 60 * 60 * 1000;

// We don't know which time zone the user was in when they created the habit, so the
// start is the creation day as seen in UTC+14 (the furthest-ahead zone). That never
// counts a day the habit might not have existed yet. If the habit has an earlier
// check-in (backfilled history), tracking starts there instead.
const trackingStart = (createdAt, firstCheckIn) => {
  const created = toDateString(new Date(createdAt).getTime() + HOURS_14);
  return firstCheckIn && firstCheckIn < created ? firstCheckIn : created;
};

const toRate = ({ scheduled, completed }) => ({
  scheduled,
  completed,
  rate: scheduled > 0 ? Math.round((completed / scheduled) * 100) : null, // null = nothing to measure yet
});

// days:    weekdays the habit applies to (0 = Sunday ... 6 = Saturday)
// start:   first day that counts, "YYYY-MM-DD"
// today:   the user's current date, "YYYY-MM-DD"
// checked: Set of "YYYY-MM-DD" strings the habit was checked on
function computeStats({ days, start, today, checked }) {
  const scheduledWeekdays = new Set(days);
  const from7 = addDays(today, -6); // the 7 days ending today
  const from30 = addDays(today, -29); // the 30 days ending today
  const w7 = { scheduled: 0, completed: 0 };
  const w30 = { scheduled: 0, completed: 0 };
  let run = 0;
  let longest = 0;

  // One pass from the first day to today. ISO date strings compare correctly as text.
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (!scheduledWeekdays.has(weekdayOf(d))) continue; // days off never break or extend a streak

    const done = checked.has(d);
    if (done) {
      run++;
      if (run > longest) longest = run;
    } else if (d !== today) {
      run = 0; // a missed scheduled day ends the streak...
    }
    // ...except today: it is still in progress, so an unchecked today leaves the streak alone

    if (d === today && !done) continue; // an unchecked today isn't counted in the rates either
    if (d >= from30) {
      w30.scheduled++;
      if (done) w30.completed++;
    }
    if (d >= from7) {
      w7.scheduled++;
      if (done) w7.completed++;
    }
  }

  return {
    currentStreak: run, // the run that is still alive as of today
    longestStreak: longest,
    last7: toRate(w7),
    last30: toRate(w30),
  };
}

module.exports = { trackingStart, computeStats };
