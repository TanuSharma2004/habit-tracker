const mongoose = require("mongoose");
const Habit = require("../models/Habit");
const CheckIn = require("../models/CheckIn");
const {
  DAY_NAMES,
  MAX_BACKFILL_DAYS,
  MAX_RANGE_DAYS,
  isValidDateString,
  weekdayOf,
  latestAllowed,
  earliestAllowed,
  spanInDays,
} = require("../utils/dates");

// Throw this to stop and answer with a specific status and message
const fail = (status, message) => Object.assign(new Error(message), { status });

const handleError = (res, error) => {
  if (error.status)
    return res.status(error.status).json({ message: error.message });
  if (error.name === "ValidationError") {
    const message = Object.values(error.errors)
      .map((e) => e.message)
      .join(", ");
    return res.status(400).json({ message });
  }
  console.error(error);
  res.status(500).json({ message: "Server error" });
};

// Finds the habit (it must belong to the logged-in user) and validates the date.
// Throws with the right status and message if anything is wrong.
const loadHabitForDate = async (req, { enforceSchedule }) => {
  const { id, date } = req.params;

  if (!mongoose.isValidObjectId(id)) throw fail(404, "Habit not found");
  const habit = await Habit.findOne({ _id: id, user: req.user._id }); // ownership check
  if (!habit) throw fail(404, "Habit not found");

  if (!isValidDateString(date))
    throw fail(400, "Date must be a real date in YYYY-MM-DD format");
  if (habit.archivedAt)
    throw fail(400, "Habit is archived. Restore it to change its check-ins");

  if (enforceSchedule) {
    if (date > latestAllowed())
      throw fail(400, "Cannot check in for a future date");
    if (date < earliestAllowed()) {
      throw fail(
        400,
        `Cannot check in more than ${MAX_BACKFILL_DAYS} days in the past`,
      );
    }
    const weekday = weekdayOf(date);
    if (!habit.days.includes(weekday)) {
      throw fail(
        400,
        `${habit.name} is not scheduled on ${DAY_NAMES[weekday]}`,
      );
    }
  }
  return habit;
};

// PUT /api/habits/:id/checkins/:date  -> mark the habit done for that day
exports.checkHabit = async (req, res) => {
  try {
    const habit = await loadHabitForDate(req, { enforceSchedule: true });
    const { date } = req.params;

    try {
      const checkIn = await CheckIn.create({
        habit: habit._id,
        user: req.user._id,
        date,
      });
      return res
        .status(201)
        .json({ _id: checkIn._id, habit: habit._id, date, checked: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      // Already checked (maybe a request that arrived a moment earlier): not an error
      const existing = await CheckIn.findOne({ habit: habit._id, date });
      if (!existing) throw fail(409, "Please try again");
      return res
        .status(200)
        .json({ _id: existing._id, habit: habit._id, date, checked: true });
    }
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE /api/habits/:id/checkins/:date  -> undo the check-in for that day
exports.uncheckHabit = async (req, res) => {
  try {
    // The weekday and date-range rules aren't enforced here, so a check-in that no
    // longer fits the schedule (the habit's days changed later) can still be removed
    const habit = await loadHabitForDate(req, { enforceSchedule: false });
    const { date } = req.params;

    await CheckIn.deleteOne({ habit: habit._id, date });
    res.json({ habit: habit._id, date, checked: false }); // same answer whether or not one existed
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/checkins?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD[&habitId=...]
exports.getCheckIns = async (req, res) => {
  try {
    const { startDate, endDate, habitId } = req.query;

    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      throw fail(
        400,
        "startDate and endDate are required, in YYYY-MM-DD format",
      );
    }
    if (startDate > endDate)
      throw fail(400, "startDate must not be after endDate");
    if (spanInDays(startDate, endDate) > MAX_RANGE_DAYS) {
      throw fail(400, `Range can be at most ${MAX_RANGE_DAYS} days`);
    }

    // Always scoped to the logged-in user. Date strings compare correctly as text.
    const filter = {
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate },
    };

    if (habitId !== undefined) {
      if (typeof habitId !== "string" || !mongoose.isValidObjectId(habitId)) {
        throw fail(400, "habitId is invalid");
      }
      filter.habit = habitId;
    }

    const checkIns = await CheckIn.find(filter)
      .select("habit date")
      .sort({ date: 1, _id: 1 });
    res.json(checkIns);
  } catch (error) {
    handleError(res, error);
  }
};
