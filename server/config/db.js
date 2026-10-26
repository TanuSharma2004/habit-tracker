const mongoose = require("mongoose");

// Only needed on networks whose DNS can't resolve mongodb+srv:// addresses.
// Set USE_PUBLIC_DNS=true in your LOCAL .env (never on Render).
if (process.env.USE_PUBLIC_DNS === "true") {
  require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1); // stop the app if the database is unreachable
  }
};

module.exports = connectDB;
