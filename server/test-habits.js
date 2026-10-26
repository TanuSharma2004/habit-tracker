// Run with the server already running:  node test-habits.js
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

(async () => {
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

  // Create
  const water = await call("POST", "/habits", A, { name: "Drink water" });
  check(
    "create with defaults (201)",
    water.status === 201 &&
      water.data.emoji === "✅" &&
      same(water.data.days, [0, 1, 2, 3, 4, 5, 6]) &&
      water.data.archivedAt === null,
    JSON.stringify(water.data),
  );
  const gym = await call("POST", "/habits", A, {
    name: "Gym",
    emoji: "🏋️",
    color: "#EF4444",
    days: [5, 1, 3, 3],
  });
  check(
    "color lowercased, days de-duplicated and sorted",
    gym.status === 201 &&
      gym.data.color === "#ef4444" &&
      same(gym.data.days, [1, 3, 5]),
    JSON.stringify(gym.data),
  );
  const wid = water.data._id;
  const gid = gym.data._id;

  // List
  let list = await call("GET", "/habits", A);
  check(
    "list returns both, oldest first",
    list.status === 200 && list.data.length === 2 && list.data[0]._id === wid,
    JSON.stringify(list.data),
  );

  // Update
  const upd = await call("PUT", `/habits/${wid}`, A, {
    name: "Drink 3L water",
    color: "#0ea5e9",
  });
  check(
    "update changes only the sent fields",
    upd.status === 200 &&
      upd.data.name === "Drink 3L water" &&
      upd.data.color === "#0ea5e9" &&
      upd.data.emoji === "✅",
    JSON.stringify(upd.data),
  );
  const noArchiveViaPut = await call("PUT", `/habits/${wid}`, A, {
    archivedAt: "2020-01-01",
  });
  check(
    "archivedAt cannot be set through update (400)",
    noArchiveViaPut.status === 400,
    noArchiveViaPut.status,
  );

  // Archive and restore
  const arch = await call("PATCH", `/habits/${gid}/archive`, A);
  check(
    "archive sets archivedAt",
    arch.status === 200 && !!arch.data.archivedAt,
    JSON.stringify(arch.data),
  );
  const arch2 = await call("PATCH", `/habits/${gid}/archive`, A);
  check(
    "archiving again keeps the same date",
    arch2.status === 200 && arch2.data.archivedAt === arch.data.archivedAt,
    JSON.stringify(arch2.data),
  );

  list = await call("GET", "/habits", A);
  check(
    "archived habit is hidden by default",
    list.data.length === 1 && list.data[0]._id === wid,
    JSON.stringify(list.data),
  );
  list = await call("GET", "/habits?includeArchived=true", A);
  check(
    "includeArchived=true shows it",
    list.data.length === 2,
    JSON.stringify(list.data),
  );
  const badFlag = await call("GET", "/habits?includeArchived=maybe", A);
  check(
    "bad includeArchived value is rejected (400)",
    badFlag.status === 400,
    badFlag.status,
  );

  const rest = await call("PATCH", `/habits/${gid}/restore`, A);
  check(
    "restore clears archivedAt",
    rest.status === 200 && rest.data.archivedAt === null,
    JSON.stringify(rest.data),
  );

  // Validation
  const invalid = [
    ["missing name", {}],
    ["name over 50 characters", { name: "x".repeat(51) }],
    ["bad color", { name: "X", color: "red" }],
    ["empty days", { name: "X", days: [] }],
    ["day out of range", { name: "X", days: [7] }],
    ["non-integer day", { name: "X", days: [1.5] }],
    ["days that are not numbers", { name: "X", days: ["monday"] }],
  ];
  for (const [label, body] of invalid) {
    const r = await call("POST", "/habits", A, body);
    check(
      `rejects ${label} (400)`,
      r.status === 400,
      `${r.status} ${JSON.stringify(r.data)}`,
    );
  }

  // Auth and ownership
  const noToken = await call("GET", "/habits");
  check("no token is rejected (401)", noToken.status === 401, noToken.status);

  const bList = await call("GET", "/habits?includeArchived=true", B);
  check(
    "B sees none of A's habits",
    bList.status === 200 && bList.data.length === 0,
    JSON.stringify(bList.data),
  );
  const attempts = [
    ["update", "PUT", `/habits/${wid}`, { name: "hacked" }],
    ["archive", "PATCH", `/habits/${wid}/archive`],
    ["restore", "PATCH", `/habits/${gid}/restore`],
  ];
  for (const [label, method, path, body] of attempts) {
    const r = await call(method, path, B, body);
    check(`B cannot ${label} A's habit (404)`, r.status === 404, r.status);
  }
  const still = await call("GET", "/habits", A);
  const mine = still.data.find((h) => h._id === wid);
  check(
    "A's habits are untouched",
    still.data.length === 2 &&
      mine.name === "Drink 3L water" &&
      !mine.archivedAt,
    JSON.stringify(still.data),
  );
  const badId = await call("PUT", "/habits/not-an-id", A, { name: "x" });
  check("malformed id returns 404", badId.status === 404, badId.status);

  // Limit of 50 active habits (A has 2 active now)
  for (let i = 3; i <= 50; i++) {
    const r = await call("POST", "/habits", A, { name: `Habit ${i}` });
    if (r.status !== 201) break;
  }
  const over = await call("POST", "/habits", A, { name: "One too many" });
  check(
    "51st active habit is rejected (400)",
    over.status === 400,
    `${over.status} ${JSON.stringify(over.data)}`,
  );

  await call("PATCH", `/habits/${gid}/archive`, A); // frees one slot
  const fill = await call("POST", "/habits", A, { name: "Replacement" });
  const restoreOver = await call("PATCH", `/habits/${gid}/restore`, A);
  check(
    "cannot restore while at the limit (400)",
    fill.status === 201 && restoreOver.status === 400,
    `${fill.status} ${restoreOver.status}`,
  );

  console.log(
    failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) failed`,
  );
})();
