const express = require("express");
const router = express.Router();
const { protect, requireAdmin } = require("../middleware/auth.middleware");
const {
  exportMembersExcel,
  exportExpendituresExcel,
  exportTransactionsExcel,
  exportMembersCSV,
  exportExpendituresCSV,
  exportTransactionsCSV,
} = require("../controllers/export.controller");

router.use(protect);
router.use(requireAdmin);

// Excel exports
router.get("/members/excel", exportMembersExcel);
router.get("/expenditures/excel", exportExpendituresExcel);
router.get("/transactions/excel", exportTransactionsExcel);

// CSV exports
router.get("/members/csv", exportMembersCSV);
router.get("/expenditures/csv", exportExpendituresCSV);
router.get("/transactions/csv", exportTransactionsCSV);

module.exports = router;
