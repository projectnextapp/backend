const jwt = require("jsonwebtoken");
const SuperAdmin = require("../models/SuperAdmin.model");

// ═══════════════════════════════════════════════════════════
// Protect Super Admin Routes
// ═══════════════════════════════════════════════════════════
exports.protectSuperAdmin = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route. Please login.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if it's a super admin token
    if (decoded.type !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required.",
      });
    }

    // Get super admin from database
    const superAdmin = await SuperAdmin.findById(decoded.id);

    if (!superAdmin) {
      return res.status(401).json({
        success: false,
        message: "Super admin account not found",
      });
    }

    if (!superAdmin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Super admin account has been deactivated",
      });
    }

    // Attach super admin to request
    req.superAdmin = superAdmin;
    next();
  } catch (err) {
    console.error("Super admin auth error:", err);

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
};
