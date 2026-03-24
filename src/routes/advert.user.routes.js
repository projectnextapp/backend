const express = require("express");
const router = express.Router();
const {
  getActiveAdverts,
  dismissAdvert,
  trackImpression,
  trackClick,
} = require("../controllers/advert.user.controller");
const { protect } = require("../middleware/auth.middleware");

// All routes require authentication
router.use(protect);

// Get active adverts
router.get("/", getActiveAdverts);

// Dismiss advert (members only)
router.post("/:id/dismiss", dismissAdvert);

// Track analytics
router.post("/:id/impression", trackImpression);
router.post("/:id/click", trackClick);

module.exports = router;
