const express = require("express");
const router = express.Router();
const {
  login,
  getMe,
  changePassword,
} = require("../controllers/superadmin.auth.controller");
const { protectSuperAdmin } = require("../middleware/superadmin.middleware");

// Public routes
router.post("/login", login);

// Protected routes
router.get("/me", protectSuperAdmin, getMe);
router.put("/change-password", protectSuperAdmin, changePassword);

module.exports = router;
