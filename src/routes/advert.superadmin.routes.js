const express = require("express");
const router = express.Router();
const {
  getAllAdverts,
  createAdvert,
  updateAdvert,
  toggleAdvertStatus,
  deleteAdvert,
  getAdvertStats,
} = require("../controllers/advert.superadmin.controller");
const { protectSuperAdmin } = require("../middleware/superadmin.middleware");
const { uploadAdvertImage } = require("../config/cloudinary");

// All routes require super admin authentication
router.use(protectSuperAdmin);

// Statistics
router.get("/stats", getAdvertStats);

// CRUD operations
router.get("/", getAllAdverts);
router.post("/", uploadAdvertImage.single("image"), createAdvert);
router.put("/:id", uploadAdvertImage.single("image"), updateAdvert);
router.patch("/:id/toggle", toggleAdvertStatus);
router.delete("/:id", deleteAdvert);

module.exports = router;
