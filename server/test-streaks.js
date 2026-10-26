// Run anytime, no server needed:  node test-streaks.js
const { addDays } = require("./utils/dates");
const { computeStats, trackingStart } = require("./utils/streaks");

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(actual)}`)
  );
}

// October 2026 calendar: Mon 5, Wed 7, Fri 9, Mon 12 ... Mon 19, Wed 21, Fri 23, Sun 25, Mon 26
const oct = (n) => `2026-10-${String(n).padStart(2, "0")}`;
const range = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const stats = ({ days = EVERY_DAY, start, today, checked }) =>
  computeStats({ days, start, today, checked: new Set(checked) });
// [current streak, longest streak, 7-day rate, 30-day rate]
const pick = (s) => [s.currentStreak, s.longestStreak, s.last7.rate, s.last30.rate];

// --- Daily habits ---
check(
  "7 days in a row, today checked",
  pick(stats({ start: oct(20), today: oct(26), checked: range(oct(20), oct(26)) })),
  [7, 7, 100, 100]
);

const grace = stats({ start: oct(20), today: oct(26), checked: range(oct(20), oct(25)) });
check("today unchecked does NOT break the streak", pick(grace), [6, 6, 100, 100]);
check("...and today is left out of the rate", grace.last7, { scheduled: 6, completed: 6, rate: 100 });

check(
  "missing yesterday ends the streak",
  pick(stats({ start: oct(20), today: oct(26), checked: range(oct(20), oct(24)) })),
  [0, 5, 83, 83]
);

check(
  "longest streak can be in the past",
  pick(stats({ start: oct(10), today: oct(26), checked: [...range(oct(10), oct(16)), ...range(oct(22), oct(26))] })),
  [5, 7, 71, 71]
);

check(
  "30-day window over a long history (one miss on the 10th)",
  pick(
    stats({
      start: "2026-09-01",
      today: oct(26),
      checked: range("2026-09-01", oct(26)).filter((d) => d !== oct(10)),
    })
  ),
  [16, 39, 100, 97]
);

// --- Weekday schedules (Mon, Wed, Fri) ---
const MWF = [1, 3, 5];
check(
  "days off don't break a streak; unchecked scheduled today is spared",
  pick(stats({ days: MWF, start: oct(5), today: oct(26), checked: [5, 7, 9, 12, 14, 16, 19, 21, 23].map(oct) })),
  [9, 9, 100, 100]
);
check(
  "a missed Friday ends the streak",
  pick(stats({ days: MWF, start: oct(5), today: oct(26), checked: [5, 7, 9, 12, 14, 19, 21, 23].map(oct) })),
  [3, 5, 100, 89]
);
check(
  "today not scheduled (Sunday): streak carries over",
  pick(stats({ days: MWF, start: oct(19), today: oct(25), checked: [19, 21, 23].map(oct) })),
  [3, 3, 100, 100]
);
check(
  "a check-in on an unscheduled day is ignored",
  pick(stats({ days: [1], start: oct(5), today: oct(8), checked: [oct(5), oct(6)] })),
  [1, 1, 100, 100]
);

// --- New habits ---
check("start after today: nothing to measure", pick(stats({ start: oct(27), today: oct(26), checked: [] })), [0, 0, null, null]);
check("created today, not checked yet", pick(stats({ start: oct(26), today: oct(26), checked: [] })), [0, 0, null, null]);
check("created today, checked", pick(stats({ start: oct(26), today: oct(26), checked: [oct(26)] })), [1, 1, 100, 100]);

// --- Where tracking starts ---
check("created early on the 26th (UTC)", trackingStart("2026-10-26T02:00:00Z", undefined), "2026-10-26");
check("created midday on the 26th (UTC): next day, in UTC+14", trackingStart("2026-10-26T12:00:00Z", undefined), "2026-10-27");
check("an earlier check-in moves the start back", trackingStart("2026-10-26T12:00:00Z", "2026-10-20"), "2026-10-20");
check("a later check-in is ignored", trackingStart("2026-10-26T02:00:00Z", "2026-10-28"), "2026-10-26");

console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);