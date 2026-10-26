// Run with the server already running:  node test-stats.js
const BASE = process.env.API_URL || "http://localhost:5000/api";
const stamp = Date.now(); // makes emails unique on every run

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

let failures = 0;
function check(label, passed, detail) {
  if (!passed) failures++;
  console.log(
    `${passed ? "PASS" : "FAIL"}  ${label}${passed ? "" : "  -> " + detail}`,
  );
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Dates come from today's local date, like the browser would send them
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmt(d);
};

(async () => {
  const today = daysAgo(0);

  const a = await call("POST", "/auth/register", null, {
    name: "User A",
    email: `a${stamp}@test.com`,
    password: "secret123",
  });
  const b = await call("POST", "/auth/register", null, {
    name: "User B",
    email: `b${stamp}@test.com`,
    password: "secret123",
  });
  if (!a.data.token || !b.data.token) {
    console.error("Could not register the test users:", a.data, b.data);
    process.exit(1);
  }
  const A = a.data.token;
  const B = b.data.token;

  const habit = async (name) =>
    (await call("POST", "/habits", A, { name })).data._id;
  const checkRange = async (id, fromAgo, toAgo) => {
    for (let n = fromAgo; n >= toAgo; n--)
      await call("PUT", `/habits/${id}/checkins/${daysAgo(n)}`, A);
  };

  // Six habits (all every-day), created in this order
  const streak = await habit("Streak"); // checked the last 5 days, including today
  await checkRange(streak, 4, 0);
  const grace = await habit("Grace"); // checked the 5 days before today; today still open
  await checkRange(grace, 5, 1);
  const broken = await habit("Broken"); // a run of 5, two misses, then 3 days again
  await checkRange(broken, 9, 5);
  await checkRange(broken, 2, 0);
  const missed = await habit("Missed"); // checked up to 2 days ago, missed yesterday
  await checkRange(missed, 6, 2);
  await habit("Empty"); // no check-ins at all
  const gone = await habit("Archived");
  await call("PATCH", `/habits/${gone}/archive`, A);

  const stats = (qs, token = A) => call("GET", `/stats?${qs}`, token);
  const sum = (h) => [
    h.currentStreak,
    h.longestStreak,
    h.last7.rate,
    h.last30.rate,
  ];

  let s = await stats(`today=${today}`);
  const h = (name) => s.data.habits.find((x) => x.name === name);
  check(
    "returns active habits in creation order, archived excluded",
    s.status === 200 &&
      s.data.today === today &&
      same(
        s.data.habits.map((x) => x.name),
        ["Streak", "Grace", "Broken", "Missed", "Empty"],
      ),
    JSON.stringify(s.data),
  );

  check(
    "Streak: 5 in a row",
    same(sum(h("Streak")), [5, 5, 100, 100]) &&
      h("Streak").checkedToday === true,
    JSON.stringify(h("Streak")),
  );
  check(
    "Streak: startDate is its first check-in",
    h("Streak").startDate === daysAgo(4),
    h("Streak").startDate,
  );
  check(
    "Grace: open today doesn't break the streak",
    same(sum(h("Grace")), [5, 5, 100, 100]) &&
      h("Grace").checkedToday === false &&
      h("Grace").scheduledToday === true,
    JSON.stringify(h("Grace")),
  );
  check(
    "Broken: current 3, longest 5",
    same(sum(h("Broken")), [3, 5, 71, 80]),
    JSON.stringify(sum(h("Broken"))),
  );
  check(
    "Missed: streak ended yesterday, longest 5",
    same(sum(h("Missed")), [0, 5, 83, 83]),
    JSON.stringify(sum(h("Missed"))),
  );
  check(
    "Empty: zeros and no rate yet",
    same(sum(h("Empty")), [0, 0, null, null]),
    JSON.stringify(sum(h("Empty"))),
  );

  // Changes show up straight away
  await call("PUT", `/habits/${missed}/checkins/${today}`, A);
  await call("DELETE", `/habits/${streak}/checkins/${today}`, A);
  s = await stats(`today=${today}`);
  check(
    "Missed: checking today starts a new streak",
    same(sum(h("Missed")), [1, 5, 86, 86]),
    JSON.stringify(sum(h("Missed"))),
  );
  check(
    "Streak: unchecking today leaves 4 (today open)",
    same(sum(h("Streak")), [4, 4, 100, 100]) &&
      h("Streak").checkedToday === false,
    JSON.stringify(h("Streak")),
  );

  // Invalid input
  const bad = [
    ["missing today", ""],
    ["wrong format", "today=26-10-2026"],
    ["a date that doesn't exist", "today=2026-02-30"],
    ["a date far in the past", "today=2020-01-01"],
    ["a date far in the future", "today=2099-01-01"],
    ["an array instead of a date", `today[]=${today}`],
  ];
  for (const [label, qs] of bad) {
    const r = await stats(qs);
    check(
      `rejects ${label} (400)`,
      r.status === 400,
      `${r.status} ${JSON.stringify(r.data)}`,
    );
  }

  // Auth and ownership
  const noToken = await call("GET", `/stats?today=${today}`);
  check("no token is rejected (401)", noToken.status === 401, noToken.status);
  const bStats = await stats(`today=${today}`, B);
  check(
    "B sees none of A's habits",
    bStats.status === 200 && same(bStats.data.habits, []),
    JSON.stringify(bStats.data),
  );

  console.log(
    failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) failed`,
  );
})();
