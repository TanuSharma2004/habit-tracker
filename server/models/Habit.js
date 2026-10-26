const mongoose = require("mongoose");

const habitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name can be at most 50 characters"],
    },
    emoji: {
      type: String,
      default: "✅",
      trim: true,
      minlength: [1, "Emoji can't be empty"],
      maxlength: [16, "Emoji is too long"],
    },
    color: {
      type: String,
      default: "#6366f1",
      trim: true,
      lowercase: true, // "#EF4444" is stored as "#ef4444"
      match: [/^#[0-9a-f]{6}$/, "Color must be a hex code like #6366f1"],
    },
    // Weekdays the habit applies to, numbered like JavaScript's getDay():
    // 0 = Sunday, 1 = Monday ... 6 = Saturday. Default: every day.
    days: {
      type: [Number],
      default: () => [0, 1, 2, 3, 4, 5, 6],
      validate: {
        validator: (arr) =>
          arr.length > 0 &&
          arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        message:
          "Days must be a non-empty list of numbers from 0 (Sunday) to 6 (Saturday)",
      },
    },
    // null = active habit, a date = archived on that date
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Runs before validation: remove duplicates and sort, so [5, 1, 3, 3] becomes [1, 3, 5]
habitSchema.pre("validate", function () {
  if (this.isModified("days") && Array.isArray(this.days)) {
    this.days = [...new Set(this.days)].sort((a, b) => a - b);
  }
});

// Makes "this user's active habits" fast
habitSchema.index({ user: 1, archivedAt: 1, createdAt: 1 });

module.exports = mongoose.model("Habit", habitSchema);
