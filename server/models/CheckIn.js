const mongoose = require("mongoose");

const checkInSchema = new mongoose.Schema(
  {
    habit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Habit",
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // The user's own calendar day as plain text, e.g. "2026-10-25".
    // A string (not a timestamp) means time zones can never shift it to another day.
    date: {
      type: String,
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },
  },
  { timestamps: true },
);

// A habit can be checked only once per day. The database itself enforces this,
// even if two requests arrive at the same moment.
checkInSchema.index({ habit: 1, date: 1 }, { unique: true });

// Makes "this user's check-ins between two dates" fast
checkInSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model("CheckIn", checkInSchema);
