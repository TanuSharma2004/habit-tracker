const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");

const CATEGORIES = Transaction.schema.path("category").enumValues; // reuse the model's list
const TYPES = ["income", "expense"];

// Only these fields can be set by the client
const FIELDS = ["type", "amount", "category", "date", "note"];
const pick = (body) =>
  Object.fromEntries(
    FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]),
  );

const handleError = (res, error) => {
  if (error.name === "ValidationError") {
    const message = Object.values(error.errors)
      .map((e) => e.message)
      .join(", ");
    return res.status(400).json({ message });
  }
  console.error(error);
  res.status(500).json({ message: "Server error" });
};

// "2026-10-25" -> Date at UTC midnight, or null if it isn't a real date
const parseDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
};

const round2 = (n) => Math.round(n * 100) / 100; // avoids 0.1 + 0.2 style float noise

// POST /api/transactions
exports.createTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.create({
      ...pick(req.body),
      user: req.user._id,
    });
    res.status(201).json(transaction);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/transactions?type=&category=&startDate=&endDate=&page=&limit=
exports.getTransactions = async (req, res) => {
  try {
    const { type, category, startDate, endDate } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

    // Always scoped to the logged-in user
    const filter = { user: req.user._id };

    // Validate every query value before it goes anywhere near the database
    if (type) {
      if (!TYPES.includes(type)) {
        return res
          .status(400)
          .json({ message: "Type must be income or expense" });
      }
      filter.type = type;
    }

    if (category) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }
      filter.category = category;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        const d = parseDate(startDate);
        if (!d)
          return res
            .status(400)
            .json({ message: "startDate must be in YYYY-MM-DD format" });
        filter.date.$gte = d; // from the start of that day
      }
      if (endDate) {
        const d = parseDate(endDate);
        if (!d)
          return res
            .status(400)
            .json({ message: "endDate must be in YYYY-MM-DD format" });
        filter.date.$lt = new Date(d.getTime() + 24 * 60 * 60 * 1000); // up to the end of that day
      }
    }

    // Run the page query and the count at the same time
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ date: -1, createdAt: -1, _id: -1 }) // _id keeps the order stable between pages
        .skip((page - 1) * limit)
        .limit(limit),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      transactions,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/transactions/summary?month=2026-10
exports.getSummary = async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7); // default: current month
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res
        .status(400)
        .json({ message: "month must be in YYYY-MM format" });
    }

    const [year, mon] = month.split("-").map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 1)); // first day of the NEXT month

    // The aggregation pipeline: each stage feeds the next one
    const rows = await Transaction.aggregate([
      // 1. Keep only this user's transactions inside the month
      { $match: { user: req.user._id, date: { $gte: start, $lt: end } } },
      // 2. Group them by type + category and add up the amounts
      {
        $group: {
          _id: { type: "$type", category: "$category" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      // 3. Biggest totals first
      { $sort: { total: -1 } },
    ]);

    // Reshape the grouped rows into the response
    const summary = {
      month,
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      expensesByCategory: [],
      incomeByCategory: [],
    };

    rows.forEach(({ _id, total, count }) => {
      const entry = { category: _id.category, total: round2(total), count };
      if (_id.type === "income") {
        summary.totalIncome += total;
        summary.incomeByCategory.push(entry);
      } else {
        summary.totalExpenses += total;
        summary.expensesByCategory.push(entry);
      }
    });

    summary.totalIncome = round2(summary.totalIncome);
    summary.totalExpenses = round2(summary.totalExpenses);
    summary.balance = round2(summary.totalIncome - summary.totalExpenses);

    res.json(summary);
  } catch (error) {
    handleError(res, error);
  }
};

// PUT /api/transactions/:id
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const transaction = await Transaction.findOne({
      _id: id,
      user: req.user._id,
    });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    transaction.set(pick(req.body));
    await transaction.save();
    res.json(transaction);
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE /api/transactions/:id
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const transaction = await Transaction.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json({ message: "Transaction deleted", _id: id });
  } catch (error) {
    handleError(res, error);
  }
};
