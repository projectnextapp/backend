const SuperAdmin = require("../models/SuperAdmin.model");
const jwt = require("jsonwebtoken");

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id, type: "superadmin" }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// ═══════════════════════════════════════════════════════════
// @desc    Super Admin Login
// @route   POST /api/superadmin/auth/login
// @access  Public
// ═══════════════════════════════════════════════════════════
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find super admin with password
    const superAdmin = await SuperAdmin.findOne({ email }).select("+password");

    if (!superAdmin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if account is locked
    if (superAdmin.isLocked()) {
      return res.status(423).json({
        success: false,
        message: "Account is temporarily locked. Try again later.",
      });
    }

    // Check if account is active
    if (!superAdmin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account has been deactivated",
      });
    }

    // Verify password
    const isPasswordValid = await superAdmin.comparePassword(password);

    if (!isPasswordValid) {
      await superAdmin.incLoginAttempts();
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Reset login attempts on successful login
    await superAdmin.resetLoginAttempts();

    // Generate token
    const token = generateToken(superAdmin._id);

    // Send response
    res.json({
      success: true,
      token,
      superAdmin: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: "superadmin",
      },
    });
  } catch (err) {
    console.error("Super admin login error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Get Super Admin Profile
// @route   GET /api/superadmin/auth/me
// @access  Private (Super Admin)
// ═══════════════════════════════════════════════════════════
exports.getMe = async (req, res) => {
  try {
    const superAdmin = await SuperAdmin.findById(req.superAdmin._id);

    res.json({
      success: true,
      superAdmin: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        phone: superAdmin.phone,
        role: "superadmin",
        lastLogin: superAdmin.lastLogin,
        createdAt: superAdmin.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Change Super Admin Password
// @route   PUT /api/superadmin/auth/change-password
// @access  Private (Super Admin)
// ═══════════════════════════════════════════════════════════
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      });
    }

    const superAdmin = await SuperAdmin.findById(req.superAdmin._id).select(
      "+password",
    );

    const isValid = await superAdmin.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    superAdmin.password = newPassword;
    await superAdmin.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
