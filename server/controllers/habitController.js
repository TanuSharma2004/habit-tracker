const mongoose = require("mongoose");
const Habit = require("../models/Habit");

const MAX_ACTIVE_HABITS = 50;

// Only these fields can be set by the client. `user` and `archivedAt` are not
// included on purpose: ownership comes from the token, and archiving has its own routes.
const FIELDS = ["name", "emoji", "color", "days"];
const pick = (body = {}) =>
  Object.fromEntries(
    FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]),
  );

const handleError = (res, error) => {
  if (error.name === "ValidationError") {
    const message = Object.values(error.errors)
      .map((e) =>
        e.name === "CastError" ? `${e.path} has an invalid value` : e.message,
      )
      .join(", ");
    return res.status(400).json({ message });
  }
  console.error(error);
  res.status(500).json({ message: "Server error" });
};

// Looks up a habit by id AND owner. Returns null if it doesn't exist or isn't theirs.
const findOwnHabit = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return Habit.findOne({ _id: req.params.id, user: req.user._id });
};

const countActive = (userId) =>
  Habit.countDocuments({ user: userId, archivedAt: null });

const limitMessage = `You can have at most ${MAX_ACTIVE_HABITS} active habits. Archive one first.`;

// POST /api/habits
exports.createHabit = async (req, res) => {
  try {
    if ((await countActive(req.user._id)) >= MAX_ACTIVE_HABITS) {
      return res.status(400).json({ message: limitMessage });
    }
    const habit = await Habit.create({ ...pick(req.body), user: req.user._id });
    res.status(201).json(habit);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/habits            -> active habits only
// GET /api/habits?includeArchived=true -> active and archived
exports.getHabits = async (req, res) => {
  try {
    const { includeArchived = "false" } = req.query;
    if (!["true", "false"].includes(includeArchived)) {
      return res
        .status(400)
        .json({ message: "includeArchived must be true or false" });
    }

    const filter = { user: req.user._id };
    if (includeArchived !== "true") filter.archivedAt = null;

    // Oldest first; _id keeps the order stable when two habits share a timestamp
    const habits = await Habit.find(filter).sort({ createdAt: 1, _id: 1 });
    res.json(habits);
  } catch (error) {
    handleError(res, error);
  }
};

// PUT /api/habits/:id  (send only the fields to change)
exports.updateHabit = async (req, res) => {
  try {
    const habit = await findOwnHabit(req);
    if (!habit) return res.status(404).json({ message: "Habit not found" });

    const updates = pick(req.body);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    habit.set(updates);
    await habit.save(); // runs validation again
    res.json(habit);
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /api/habits/:id/archive
exports.archiveHabit = async (req, res) => {
  try {
    const habit = await findOwnHabit(req);
    if (!habit) return res.status(404).json({ message: "Habit not found" });

    // Already archived? Do nothing, so repeating the request is harmless
    if (!habit.archivedAt) {
      habit.archivedAt = new Date();
      await habit.save();
    }
    res.json(habit);
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /api/habits/:id/restore
exports.restoreHabit = async (req, res) => {
  try {
    const habit = await findOwnHabit(req);
    if (!habit) return res.status(404).json({ message: "Habit not found" });

    if (habit.archivedAt) {
      if ((await countActive(req.user._id)) >= MAX_ACTIVE_HABITS) {
        return res.status(400).json({ message: limitMessage });
      }
      habit.archivedAt = null;
      await habit.save();
    }
    res.json(habit);
  } catch (error) {
    handleError(res, error);
  }
};
