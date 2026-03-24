const express = require("express");
const router = express.Router();
const {
  createPayment,
  addPayment,
  getAllPayments,
  getMyPayments,
  updatePayment,
  getFinancialSummary,
  sendPaymentReminder,
} = require("../controllers/finance.controller");
const {
  protect,
  requireAdmin,
  requireTreasurer,
} = require("../middleware/auth.middleware");

// All routes require authentication
router.use(protect);

// Member routes
router.get("/my-records", getMyPayments);

// Treasurer/Admin routes
router.post("/", requireTreasurer, createPayment);
router.get("/", getAllPayments);
router.get("/summary", requireTreasurer, getFinancialSummary);

// NEW: Add payment to existing record
router.post("/:id/add-payment", requireTreasurer, addPayment);

router.put("/:id", requireTreasurer, updatePayment);
router.post("/reminder", requireTreasurer, sendPaymentReminder);

module.exports = router;
