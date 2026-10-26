const express = require("express");
const { protect } = require("../middleware/auth");
const { getCheckIns } = require("../controllers/checkinController");

const router = express.Router();

router.use(protect); // every route below requires a valid token

router.get("/", getCheckIns);

module.exports = router;
