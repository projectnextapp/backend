const jwt = require("jsonwebtoken");
const Member = require("../models/Member.model");
const Group = require("../models/Group.model");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === "group") {
      req.group = await Group.findById(decoded.id);
      req.userType = "group";

      if (!req.group || !req.group.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account has been deactivated",
        });
      }
    } else {
      req.member = await Member.findById(decoded.id);
      req.userType = "member";

      if (!req.member) {
        return res.status(401).json({
          success: false,
          message: "Member not found",
        });
      }

      if (!req.member.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account has been deactivated",
        });
      }

      if (req.member.status === "inactive") {
        return res.status(403).json({
          success: false,
          message: "Account is inactive",
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token is invalid or expired",
    });
  }
};

// ─── Role Guards ──────────────────────────────────────────────

const requireAdmin = (req, res, next) => {
  if (req.userType === "group") return next();
  if (req.member && req.member.role === "admin") return next();
  return res
    .status(403)
    .json({ success: false, message: "Admin access required" });
};

const requirePresident = (req, res, next) => {
  if (req.userType === "group") return next();
  if (req.member && ["admin", "president"].includes(req.member.role))
    return next();
  return res
    .status(403)
    .json({ success: false, message: "President or Admin access required" });
};

const requireSecretary = (req, res, next) => {
  if (req.userType === "group") return next();
  if (
    req.member &&
    ["admin", "secretary", "president"].includes(req.member.role)
  )
    return next();
  return res
    .status(403)
    .json({ success: false, message: "Secretary access required" });
};

const requireTreasurer = (req, res, next) => {
  if (req.userType === "group") return next();
  if (req.member && ["admin", "treasurer"].includes(req.member.role))
    return next();
  return res
    .status(403)
    .json({ success: false, message: "Treasurer access required" });
};

const requireExecutive = (req, res, next) => {
  if (req.userType === "group") return next();
  const executiveRoles = [
    "admin",
    "president",
    "secretary",
    "treasurer",
    "executive",
  ];
  if (req.member && executiveRoles.includes(req.member.role)) return next();
  return res
    .status(403)
    .json({ success: false, message: "Executive access required" });
};

module.exports = {
  protect,
  requireAdmin,
  requirePresident,
  requireSecretary,
  requireTreasurer,
  requireExecutive,
};
