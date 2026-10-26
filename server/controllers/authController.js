const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Create a token that stores the user's id
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// The shape of the response for both register and login
const authResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  token: generateToken(user._id),
});

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = req.body.email?.toLowerCase().trim();

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({ name, email, password });
    res.status(201).json(authResponse(user));
  } catch (error) {
    // Two requests with the same email at the same moment: the unique index catches it
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email already registered" });
    }
    // Mongoose validation errors (bad email format, short password, etc.)
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((e) => e.message)
        .join(", ");
      return res.status(400).json({ message });
    }
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.body.email?.toLowerCase().trim();

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // password is hidden by default, so we ask for it explicitly
    const user = await User.findOne({ email }).select("+password");

    // Same message for "no such user" and "wrong password" on purpose,
    // so attackers can't find out which emails are registered
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json(authResponse(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/auth/me  (protected): returns the logged-in user
exports.getMe = (req, res) => {
  const { _id, name, email } = req.user;
  res.json({ _id, name, email });
};
