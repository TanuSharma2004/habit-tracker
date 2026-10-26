const express = require("express");
const { protect } = require("../middleware/auth");
const {
  createHabit,
  getHabits,
  updateHabit,
  archiveHabit,
  restoreHabit,
} = require("../controllers/habitController");
const {
  checkHabit,
  uncheckHabit,
} = require("../controllers/checkinController");

const router = express.Router();

router.use(protect); // every route below requires a valid token

router.route("/").get(getHabits).post(createHabit);
router.route("/:id").put(updateHabit);
router.patch("/:id/archive", archiveHabit);
router.patch("/:id/restore", restoreHabit);

// Check / uncheck a habit for one day
router.route("/:id/checkins/:date").put(checkHabit).delete(uncheckHabit);

module.exports = router;
