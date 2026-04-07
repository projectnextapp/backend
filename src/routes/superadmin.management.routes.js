const express = require("express");
const router = express.Router();
const {
  getAllGroups,
  getGroupDetails,
  toggleGroupAdmin,
  toggleExecutive,
  sendNotification,
  getPlatformStats,
  deleteGroup, // 👈 ADD THIS
} = require("../controllers/superadmin.management.controller");
const { protectSuperAdmin } = require("../middleware/superadmin.middleware");

// All routes require super admin authentication
router.use(protectSuperAdmin);

// Platform statistics
router.get("/stats", getPlatformStats);

// Group management
router.get("/groups", getAllGroups);
router.get("/groups/:id", getGroupDetails);

// Delete group
router.delete("/groups/:groupId", deleteGroup);

// Activate/Deactivate
router.patch("/groups/:groupId/admin/toggle", toggleGroupAdmin);
router.patch("/groups/:groupId/executives/:memberId/toggle", toggleExecutive);

// Notifications
router.post("/groups/:groupId/notify", sendNotification);

module.exports = router;
