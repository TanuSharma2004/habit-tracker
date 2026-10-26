const express = require("express");
const { protect } = require("../middleware/auth");
const { getStats } = require("../controllers/statsController");

const router = express.Router();

router.use(protect); // every route below requires a valid token

router.get("/", getStats);

module.exports = router;
