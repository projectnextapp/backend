const Group = require("../models/Group.model");
const Member = require("../models/Member.model");
const generateToken = require("../utils/generateToken");

// ─────────────────────────────────────────────────────────────
// @desc    Create new association / group
// @route   POST /api/auth/create-group
// @access  Public
// ─────────────────────────────────────────────────────────────
exports.createGroup = async (req, res) => {
  try {
    const {
      name,
      location,
      contactEmail,
      password,
      memberSizeRange,
      adminInfo,
    } = req.body;

    const existing = await Group.findOne({ contactEmail });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }

    const logoUrl = req.file ? req.file.path : null;

    const group = await Group.create({
      name,
      location,
      contactEmail,
      password,
      memberSizeRange,
      adminInfo,
      logo: logoUrl,
    });

    const token = generateToken(group._id, "group");

    res.status(201).json({
      success: true,
      message: "Association created successfully",
      token,
      group: {
        id: group._id,
        name: group.name,
        logo: group.logo,
        contactEmail: group.contactEmail,
        memberSizeRange: group.memberSizeRange,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Group admin login
// @route   POST /api/auth/group-login
// @access  Public
// ─────────────────────────────────────────────────────────────
exports.groupLogin = async (req, res) => {
  try {
    const { contactEmail, password } = req.body;

    if (!contactEmail || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and password" });
    }

    const group = await Group.findOne({ contactEmail }).select("+password");
    if (!group) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await group.matchPassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(group._id, "group");

    res.json({
      success: true,
      token,
      group: {
        id: group._id,
        name: group.name,
        logo: group.logo,
        contactEmail: group.contactEmail,
        memberSizeRange: group.memberSizeRange,
        userType: "group",
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Member login
// @route   POST /api/auth/member-login
// @access  Public
// ─────────────────────────────────────────────────────────────
exports.memberLogin = async (req, res) => {
  try {
    const { email, password, groupId } = req.body;

    if (!email || !password || !groupId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email, password, and group ID are required",
        });
    }

    const member = await Member.findOne({ email, group: groupId }).select(
      "+password",
    );
    if (!member) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (member.status === "pending") {
      return res
        .status(403)
        .json({
          success: false,
          message: "Your membership is pending approval: contact your admin",
        });
    }
    if (member.status === "inactive") {
      return res
        .status(403)
        .json({ success: false, message: "Your account has been deactivated" });
    }

    const isMatch = await member.matchPassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(member._id, "member");

    res.json({
      success: true,
      token,
      member: {
        id: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
        status: member.status,
        profilePhoto: member.profilePhoto,
        userType: "member",
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Get current logged-in user profile
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    if (req.userType === "group") {
      return res.json({ success: true, userType: "group", data: req.group });
    }
    res.json({ success: true, userType: "member", data: req.member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Change password (member)
// @route   PUT /api/auth/change-password
// @access  Private
// ─────────────────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    let user;
    if (req.userType === "group") {
      user = await Group.findById(req.group._id).select("+password");
    } else {
      user = await Member.findById(req.member._id).select("+password");
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
