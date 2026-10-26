// Run with the server already running:  node seed-habit-demo.js
const BASE = process.env.API_URL || "http://localhost:5000/api";

const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmt(d);
};
const weekday = (s) => new Date(`${s}T00:00:00Z`).getUTCDay(); // 0 = Sunday

// Repeatable "random" numbers, so every run produces the same pattern
let seed = 42;
const rand = () =>
  (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

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

(async () => {
  const email = `demo${Date.now()}@test.com`;
  const reg = await call("POST", "/auth/register", null, {
    name: "Demo User",
    email,
    password: "secret123",
  });
  if (!reg.data.token) {
    console.error("Register failed:", reg.data);
    process.exit(1);
  }
  const token = reg.data.token;

  const habits = [
    {
      name: "Water",
      emoji: "💧",
      color: "#0ea5e9",
      days: [0, 1, 2, 3, 4, 5, 6],
      chance: 0.85,
    },
    {
      name: "Gym",
      emoji: "🏋️",
      color: "#ef4444",
      days: [1, 3, 5],
      chance: 0.7,
    },
    {
      name: "Read",
      emoji: "📚",
      color: "#a855f7",
      days: [1, 2, 3, 4, 5],
      chance: 0.6,
    },
  ];

  for (const h of habits) {
    const created = await call("POST", "/habits", token, {
      name: h.name,
      emoji: h.emoji,
      color: h.color,
      days: h.days,
    });
    let count = 0;
    for (let n = 45; n >= 1; n--) {
      const date = daysAgo(n); // yesterday back to 45 days ago; today is left for you to tick
      if (!h.days.includes(weekday(date)) || rand() > h.chance) continue;
      const r = await call(
        "PUT",
        `/habits/${created.data._id}/checkins/${date}`,
        token,
      );
      if (r.status === 201) count++;
      else console.log("Skipped", h.name, date, r.data.message);
    }
    console.log(`${h.name}: ${count} check-ins`);
  }

  console.log("\nLog in with:");
  console.log("Email:   ", email);
  console.log("Password: secret123");
})();
