const express = require("express");
const { protect } = require("../middleware/auth");
const {
  createTransaction,
  getTransactions,
  getSummary,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transactionController");

const router = express.Router();

router.use(protect); // every route below requires a valid token

// "/summary" must come before "/:id", otherwise "summary" would be read as an id
router.route("/summary").get(getSummary);
router.route("/").get(getTransactions).post(createTransaction);
router.route("/:id").put(updateTransaction).delete(deleteTransaction);

module.exports = router;