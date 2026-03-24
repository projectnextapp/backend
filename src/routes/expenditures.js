const express = require("express");
const router = express.Router();
const {
  protect,
  requireAdmin,
  requirePresident,
  requireTreasurer,
} = require("../middleware/auth.middleware");
const {
  getExpenditures,
  getSummary,
  createExpenditure,
  updateExpenditure,
  approveExpenditure,
  deleteExpenditure,
} = require("../controllers/expenditureController");

router.use(protect);

router
  .route("/")
  .get(getExpenditures)
  .post(requireTreasurer, createExpenditure);

router.get("/summary", getSummary);

router
  .route("/:id")
  .put(requireTreasurer, updateExpenditure)
  .delete(requireAdmin, deleteExpenditure);

router.patch("/:id/approve", requirePresident, approveExpenditure);

module.exports = router;
