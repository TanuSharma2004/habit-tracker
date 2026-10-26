const mongoose = require("mongoose");

const INCOME_CATEGORIES = ["Salary", "Other"];
const EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Health",
  "Entertainment",
  "Other",
];
// Every valid category ("Other" is in both lists, so remove the duplicate)
const CATEGORIES = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])];

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: {
        values: ["income", "expense"],
        message: "Type must be income or expense",
      },
      required: [true, "Type is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    category: {
      type: String,
      enum: { values: CATEGORIES, message: "Invalid category" },
      required: [true, "Category is required"],
    },
    date: {
      type: Date,
      default: Date.now,
      validate: {
        // UTC+14 is the furthest-ahead time zone, so allow up to 14 hours past "now"
        // (otherwise users in far-east time zones could be rejected on their own "today")
        validator: (value) =>
          value.getTime() <= Date.now() + 14 * 60 * 60 * 1000,
        message: "Date cannot be in the future",
      },
    },
    note: {
      type: String,
      trim: true,
      maxlength: [100, "Note can be at most 100 characters"],
    },
  },
  { timestamps: true },
);

transactionSchema.index({ user: 1, date: -1 });

// Runs before every validation (create AND update): the category must fit the type
transactionSchema.pre("validate", function () {
  const allowed = { income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES }[
    this.type
  ];
  if (
    allowed &&
    CATEGORIES.includes(this.category) &&
    !allowed.includes(this.category)
  ) {
    this.invalidate(
      "category",
      `"${this.category}" is not a valid category for ${this.type}`,
    );
  }
});

module.exports = mongoose.model("Transaction", transactionSchema);
