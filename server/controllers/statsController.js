const Habit = require("../models/Habit");
const CheckIn = require("../models/CheckIn");
const {
  isValidDateString,
  latestAllowed,
  earliestToday,
  weekdayOf,
} = require("../utils/dates");
const { trackingStart, computeStats } = require("../utils/streaks");

// GET /api/stats?today=YYYY-MM-DD
exports.getStats = async (req, res) => {
  try {
    const { today } = req.query;

    if (!isValidDateString(today)) {
      return res
        .status(400)
        .json({ message: "today is required, in YYYY-MM-DD format" });
    }
    // The server can't know the user's time zone, so it only checks that the date is
    // one that could be "today" somewhere on Earth right now
    if (today > latestAllowed() || today < earliestToday()) {
      return res
        .status(400)
        .json({ message: "today must be your current local date" });
    }

    // Active habits of the logged-in user, oldest first
    const habits = await Habit.find({ user: req.user._id, archivedAt: null })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    if (habits.length === 0) return res.json({ today, habits: [] });

    // ONE query for the check-ins of all those habits (not one query per habit)
    const checkIns = await CheckIn.find({
      user: req.user._id,
      habit: { $in: habits.map((h) => h._id) },
      date: { $lte: today },
    })
      .select("habit date")
      .lean();

    // habit id -> Set of checked dates
    const byHabit = new Map();
    for (const c of checkIns) {
      const key = String(c.habit);
      if (!byHabit.has(key)) byHabit.set(key, new Set());
      byHabit.get(key).add(c.date);
    }

    const result = habits.map((h) => {
      const checked = byHabit.get(String(h._id)) || new Set();
      const firstCheckIn = [...checked].sort()[0]; // earliest date, or undefined
      const start = trackingStart(h.createdAt, firstCheckIn);

      return {
        _id: h._id,
        name: h.name,
        emoji: h.emoji,
        color: h.color,
        days: h.days,
        startDate: start,
        scheduledToday: h.days.includes(weekdayOf(today)),
        checkedToday: checked.has(today),
        ...computeStats({ days: h.days, start, today, checked }),
      };
    });

    res.json({ today, habits: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
