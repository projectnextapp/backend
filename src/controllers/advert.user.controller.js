const Advert = require("../models/Advert.model");

// ═══════════════════════════════════════════════════════════
// @desc    Get Active Adverts for User
// @route   GET /api/adverts
// @access  Private (Any authenticated user)
// ═══════════════════════════════════════════════════════════
exports.getActiveAdverts = async (req, res) => {
  try {
    console.log("\n🔍 ========== GET ACTIVE ADVERTS DEBUG ==========");
    console.log("📥 Query params:", req.query);
    console.log("👤 User info:", {
      userType: req.userType,
      hasMember: !!req.member,
      hasGroup: !!req.group,
      memberId: req.member?._id,
      groupId: req.group?._id || req.member?.group,
    });

    const { position } = req.query;

    // Get user and group ID
    const userId = req.userType === "member" ? req.member._id : null;
    const groupId =
      req.userType === "member" ? req.member.group : req.group._id;

    console.log("🎯 Computed values:", { userId, groupId, position });

    const now = new Date();
    console.log("📅 Current date:", now);

    let adverts;

    if (!userId) {
      console.log("🔸 Fetching for GROUP ADMIN (no userId)");
      // For group admins, just get all active adverts
      adverts = await Advert.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        ...(position && { position }),
        $or: [
          { targetAudience: "all" },
          {
            targetAudience: "specific_groups",
            targetGroups: groupId,
          },
        ],
      }).sort({ createdAt: -1 });

      console.log(`✅ Found ${adverts.length} adverts for group admin`);
    } else {
      console.log("🔸 Fetching for MEMBER (has userId)");
      // For members, filter out dismissed adverts
      adverts = await Advert.getActiveAdvertsForUser(userId, groupId, position);
      console.log(`✅ Found ${adverts.length} adverts for member`);
    }

    // Log each advert
    adverts.forEach((advert, index) => {
      console.log(`  ${index + 1}. "${advert.title}"`, {
        id: advert._id,
        hasImage: !!advert.image,
        imageUrl: advert.image,
        position: advert.position,
        isActive: advert.isActive,
        targetAudience: advert.targetAudience,
      });
    });

    console.log("📤 Sending response with", adverts.length, "adverts");
    console.log("🔍 ========== END DEBUG ==========\n");

    res.json({
      success: true,
      data: adverts,
    });
  } catch (err) {
    console.error("❌ Get active adverts error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Dismiss Advert
// @route   POST /api/adverts/:id/dismiss
// @access  Private (Members only)
// ═══════════════════════════════════════════════════════════
exports.dismissAdvert = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.userType !== "member") {
      return res.status(403).json({
        success: false,
        message: "Only members can dismiss adverts",
      });
    }

    const advert = await Advert.findById(id);
    if (!advert) {
      return res.status(404).json({
        success: false,
        message: "Advert not found",
      });
    }

    const userId = req.member._id;

    // Check if already dismissed
    if (!advert.dismissedBy.includes(userId)) {
      advert.dismissedBy.push(userId);
      await advert.save();
    }

    res.json({
      success: true,
      message: "Advert dismissed successfully",
    });
  } catch (err) {
    console.error("Dismiss advert error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Track Advert Impression
// @route   POST /api/adverts/:id/impression
// @access  Private
// ═══════════════════════════════════════════════════════════
exports.trackImpression = async (req, res) => {
  try {
    const { id } = req.params;

    const advert = await Advert.findById(id);
    if (!advert) {
      return res.status(404).json({
        success: false,
        message: "Advert not found",
      });
    }

    await advert.incrementImpressions();

    res.json({
      success: true,
      message: "Impression tracked",
    });
  } catch (err) {
    console.error("Track impression error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Track Advert Click
// @route   POST /api/adverts/:id/click
// @access  Private
// ═══════════════════════════════════════════════════════════
exports.trackClick = async (req, res) => {
  try {
    const { id } = req.params;

    const advert = await Advert.findById(id);
    if (!advert) {
      return res.status(404).json({
        success: false,
        message: "Advert not found",
      });
    }

    await advert.incrementClicks();

    res.json({
      success: true,
      message: "Click tracked",
    });
  } catch (err) {
    console.error("Track click error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
