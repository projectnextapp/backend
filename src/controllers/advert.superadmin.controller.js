const Advert = require("../models/Advert.model");

// ═══════════════════════════════════════════════════════════
// @desc    Create Advert
// @route   POST /api/superadmin/adverts
// @access  Private (Super Admin)
// ═══════════════════════════════════════════════════════════
exports.createAdvert = async (req, res) => {
  try {
    console.log("\n🔍 ========== CREATE ADVERT DEBUG ==========");
    console.log("📥 Request body:", req.body);
    console.log("📸 Request file:", req.file);

    const {
      title,
      description,
      link,
      position,
      startDate,
      endDate,
      targetAudience,
      targetGroups,
    } = req.body;

    if (!title || !description || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Title, description, start date, and end date are required",
      });
    }

    // Validate dates
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    // Image URL from CloudinaryStorage
    let imageUrl = null;
    if (req.file) {
      console.log("📸 Image file received!");
      console.log("  - fieldname:", req.file.fieldname);
      console.log("  - originalname:", req.file.originalname);
      console.log("  - mimetype:", req.file.mimetype);
      console.log("  - size:", req.file.size);
      console.log("  - path:", req.file.path);
      console.log("  - filename:", req.file.filename);

      imageUrl = req.file.path;
      console.log("✅ Using imageUrl:", imageUrl);
    } else {
      console.log("ℹ️ No image file in request");
    }

    console.log("💾 Creating advert with data:", {
      title,
      image: imageUrl,
      position,
    });

    const advert = await Advert.create({
      title,
      description,
      image: imageUrl,
      link,
      position: position || "dashboard",
      startDate,
      endDate,
      targetAudience: targetAudience || "all",
      targetGroups:
        targetAudience === "specific_groups"
          ? JSON.parse(targetGroups || "[]")
          : [],
      createdBy: req.superAdmin._id,
    });

    console.log("✅ Advert saved to database!");
    console.log("  - ID:", advert._id);
    console.log("  - Title:", advert.title);
    console.log("  - Image:", advert.image);
    console.log("  - Position:", advert.position);
    console.log("🔍 ========== END DEBUG ==========\n");

    res.status(201).json({
      success: true,
      message: "Advert created successfully",
      data: advert,
    });
  } catch (err) {
    console.error("❌ Create advert error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Copy all other functions from advert.superadmin.controller-UPDATED.js
// (I'll paste them below for completeness)

exports.getAllAdverts = async (req, res) => {
  try {
    const { status, position, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;
    if (position) query.position = position;

    const adverts = await Advert.find(query)
      .populate("targetGroups", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Advert.countDocuments(query);

    res.json({
      success: true,
      data: adverts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get adverts error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAdvert = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      link,
      position,
      startDate,
      endDate,
      targetAudience,
      targetGroups,
    } = req.body;

    const advert = await Advert.findById(id);
    if (!advert) {
      return res.status(404).json({
        success: false,
        message: "Advert not found",
      });
    }

    const newStartDate = startDate || advert.startDate;
    const newEndDate = endDate || advert.endDate;

    if (new Date(newStartDate) > new Date(newEndDate)) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    if (req.file) {
      console.log("📸 New image uploaded:", req.file.path);
      advert.image = req.file.path;
    }

    if (title) advert.title = title;
    if (description) advert.description = description;
    if (link !== undefined) advert.link = link;
    if (position) advert.position = position;
    if (startDate) advert.startDate = startDate;
    if (endDate) advert.endDate = endDate;
    if (targetAudience) {
      advert.targetAudience = targetAudience;
      advert.targetGroups =
        targetAudience === "specific_groups"
          ? JSON.parse(targetGroups || "[]")
          : [];
    }

    await advert.save();

    res.json({
      success: true,
      message: "Advert updated successfully",
      data: advert,
    });
  } catch (err) {
    console.error("Update advert error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggleAdvertStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const advert = await Advert.findById(id);
    if (!advert) {
      return res.status(404).json({
        success: false,
        message: "Advert not found",
      });
    }

    advert.isActive = !advert.isActive;
    await advert.save();

    res.json({
      success: true,
      message: `Advert ${advert.isActive ? "activated" : "deactivated"} successfully`,
      data: { isActive: advert.isActive },
    });
  } catch (err) {
    console.error("Toggle advert error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteAdvert = async (req, res) => {
  try {
    const { id } = req.params;

    const advert = await Advert.findById(id);
    if (!advert) {
      return res.status(404).json({
        success: false,
        message: "Advert not found",
      });
    }

    await advert.deleteOne();

    res.json({
      success: true,
      message: "Advert deleted successfully",
    });
  } catch (err) {
    console.error("Delete advert error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAdvertStats = async (req, res) => {
  try {
    const now = new Date();

    const totalAdverts = await Advert.countDocuments();
    const activeAdverts = await Advert.countDocuments({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
    const scheduledAdverts = await Advert.countDocuments({
      isActive: true,
      startDate: { $gt: now },
    });
    const expiredAdverts = await Advert.countDocuments({
      endDate: { $lt: now },
    });

    const stats = await Advert.aggregate([
      {
        $group: {
          _id: null,
          totalImpressions: { $sum: "$impressions" },
          totalClicks: { $sum: "$clicks" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        totalAdverts,
        activeAdverts,
        scheduledAdverts,
        expiredAdverts,
        totalImpressions: stats[0]?.totalImpressions || 0,
        totalClicks: stats[0]?.totalClicks || 0,
      },
    });
  } catch (err) {
    console.error("Get advert stats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
