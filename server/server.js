require("dotenv").config(); // must run before anything reads process.env

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

// Stop early with a clear message if a required variable is missing
["MONGO_URI", "JWT_SECRET"].forEach((name) => {
  if (!process.env[name]) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
});

const app = express();

// On Render the app sits behind a proxy; trusting it makes req.ip the real
// visitor's IP, which the rate limiter needs
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

connectDB();

// Allowed frontend origins, comma-separated in CLIENT_URL
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = Postman, curl, server-to-server calls: allow
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      callback(null, false); // browsers will block the response
    },
  }),
);
app.use(express.json({ limit: "10kb" }));

// 30 login/register attempts per IP per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});

app.get("/", (req, res) =>
  res.json({ message: "Expense Tracker API is running" }),
);
app.get("/health", (req, res) => res.json({ status: "ok" })); // used by Render's health check

app.use("/api/auth", authLimiter, require("./routes/authRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));

// Unknown routes
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Bad JSON bodies and anything unexpected
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
