// Run with the server already running:  node test-checkins.js
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

// Dates are calculated from today's local date, like the browser would send them
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmt(d);
};
const weekday = (s) => new Date(`${s}T00:00:00Z`).getUTCDay(); // 0 = Sunday
const lastWeekday = (wd) => {
  for (let i = 0; i < 7; i++) if (weekday(daysAgo(i)) === wd) return daysAgo(i);
};

(async () => {
  const today = daysAgo(0);
  const yesterday = daysAgo(1);
  const from = daysAgo(10);
  const gymMon = lastWeekday(1); // most recent Monday (Gym is scheduled)
  const gymTue = lastWeekday(2); // most recent Tuesday (Gym is not)
  const range = `startDate=${from}&endDate=${today}`;

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

  const water = await call("POST", "/habits", A, { name: "Water" });
  const gym = await call("POST", "/habits", A, {
    name: "Gym",
    days: [1, 3, 5],
  });
  const W = water.data._id;
  const G = gym.data._id;

  const put = (id, date, tok = A) =>
    call("PUT", `/habits/${id}/checkins/${date}`, tok);
  const del = (id, date, tok = A) =>
    call("DELETE", `/habits/${id}/checkins/${date}`, tok);
  const list = (qs, tok = A) => call("GET", `/checkins?${qs}`, tok);

  // Checking is safe to repeat
  const c1 = await put(W, today);
  check(
    "check a habit (201)",
    c1.status === 201 && c1.data.checked === true && c1.data.date === today,
    JSON.stringify(c1.data),
  );
  const c2 = await put(W, today);
  check(
    "checking again is safe (200, same id)",
    c2.status === 200 && c2.data._id === c1.data._id,
    JSON.stringify(c2.data),
  );

  // Five requests at once: the unique index leaves exactly one record
  const par = await Promise.all([1, 2, 3, 4, 5].map(() => put(W, yesterday)));
  const created = par.filter((r) => r.status === 201).length;
  const existing = par.filter((r) => r.status === 200).length;
  check(
    "5 simultaneous check-ins create exactly one record",
    created === 1 && existing === 4,
    `created ${created}, existing ${existing}`,
  );

  // Listing
  let l = await list(range);
  check(
    "list shows both check-ins in date order",
    l.status === 200 &&
      l.data.length === 2 &&
      l.data[0].date === yesterday &&
      l.data[1].date === today,
    JSON.stringify(l.data),
  );

  // Weekday rule
  const gOk = await put(G, gymMon);
  check(
    `Gym on a Monday (${gymMon}) is allowed`,
    gOk.status === 201,
    `${gOk.status} ${JSON.stringify(gOk.data)}`,
  );
  const gBad = await put(G, gymTue);
  check(
    `Gym on a Tuesday (${gymTue}) is rejected (400)`,
    gBad.status === 400 && /not scheduled/.test(gBad.data.message),
    `${gBad.status} ${JSON.stringify(gBad.data)}`,
  );
  l = await list(range);
  check(
    "list now has 3 check-ins",
    l.data.length === 3,
    JSON.stringify(l.data),
  );

  // Date rules
  const badDates = [
    ["a future date", "2099-01-01"],
    ["a date over a year old", "2020-01-01"],
    ["a date that doesn't exist", "2026-02-30"],
    ["the wrong format", "26-10-2026"],
  ];
  for (const [label, date] of badDates) {
    const r = await put(W, date);
    check(
      `rejects ${label} (400)`,
      r.status === 400,
      `${r.status} ${JSON.stringify(r.data)}`,
    );
  }
  const badId = await put("not-an-id", today);
  check("malformed habit id returns 404", badId.status === 404, badId.status);

  // Unchecking is safe to repeat
  const u1 = await del(W, yesterday);
  check(
    "uncheck (200)",
    u1.status === 200 && u1.data.checked === false,
    JSON.stringify(u1.data),
  );
  const u2 = await del(W, yesterday);
  check(
    "unchecking again is safe (200)",
    u2.status === 200 && u2.data.checked === false,
    JSON.stringify(u2.data),
  );
  l = await list(`${range}&habitId=${W}`);
  check(
    "only today's Water check-in remains",
    l.data.length === 1 && l.data[0].date === today,
    JSON.stringify(l.data),
  );

  // Archived habits are frozen, but their history stays visible
  await call("PATCH", `/habits/${W}/archive`, A);
  const aPut = await put(W, yesterday);
  check(
    "cannot check an archived habit (400)",
    aPut.status === 400 && /archived/.test(aPut.data.message),
    `${aPut.status} ${JSON.stringify(aPut.data)}`,
  );
  const aDel = await del(W, today);
  check(
    "cannot uncheck an archived habit (400)",
    aDel.status === 400,
    aDel.status,
  );
  l = await list(`${range}&habitId=${W}`);
  check(
    "archived habit's history is still listed",
    l.data.length === 1,
    JSON.stringify(l.data),
  );
  await call("PATCH", `/habits/${W}/restore`, A);
  const back = await put(W, yesterday);
  check(
    "after restoring, checking works again (201)",
    back.status === 201,
    back.status,
  );

  // Schedule changed after a check-in was made
  await call("PUT", `/habits/${G}`, A, { days: [3, 5] }); // Monday removed
  const stale = await del(G, gymMon);
  check(
    "an old check-in on a no-longer-scheduled day can be removed (200)",
    stale.status === 200,
    `${stale.status} ${JSON.stringify(stale.data)}`,
  );
  l = await list(`${range}&habitId=${G}`);
  check("...and it is gone", l.data.length === 0, JSON.stringify(l.data));
  const nowBad = await put(G, gymMon);
  check(
    "...but a new one on that day is rejected (400)",
    nowBad.status === 400,
    nowBad.status,
  );

  // List validation
  const badLists = [
    ["missing endDate", `startDate=${from}`],
    ["missing startDate", `endDate=${today}`],
    ["startDate after endDate", `startDate=${today}&endDate=${from}`],
    ["a range over 366 days", "startDate=2025-01-01&endDate=2026-10-26"],
    ["an invalid habitId", `${range}&habitId=abc`],
    ["an array instead of a date", `startDate[]=${from}&endDate=${today}`],
  ];
  for (const [label, qs] of badLists) {
    const r = await list(qs);
    check(
      `list rejects ${label} (400)`,
      r.status === 400,
      `${r.status} ${JSON.stringify(r.data)}`,
    );
  }

  // Auth and ownership
  const noToken = await call("GET", `/checkins?${range}`);
  check("no token is rejected (401)", noToken.status === 401, noToken.status);
  const noTokenPut = await call("PUT", `/habits/${W}/checkins/${today}`);
  check(
    "no token on check is rejected (401)",
    noTokenPut.status === 401,
    noTokenPut.status,
  );

  const bList = await list(range, B);
  check(
    "B sees none of A's check-ins",
    bList.status === 200 && bList.data.length === 0,
    JSON.stringify(bList.data),
  );
  const bFiltered = await list(`${range}&habitId=${W}`, B);
  check(
    "B filtering by A's habit sees nothing",
    bFiltered.status === 200 && bFiltered.data.length === 0,
    JSON.stringify(bFiltered.data),
  );
  const bPut = await put(W, today, B);
  check("B cannot check A's habit (404)", bPut.status === 404, bPut.status);
  const bDel = await del(W, today, B);
  check("B cannot uncheck A's habit (404)", bDel.status === 404, bDel.status);
  const aAfter = await list(`${range}&habitId=${W}`);
  check(
    "A's check-ins are untouched",
    aAfter.data.length === 2,
    JSON.stringify(aAfter.data),
  );

  console.log(
    failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) failed`,
  );
})();
