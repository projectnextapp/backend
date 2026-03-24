const Member = require("../models/Member.model");
const Notification = require("../models/Notification.model");

// ─────────────────────────────────────────────────────────────
// Helper to get the active group ID from the request
// ─────────────────────────────────────────────────────────────
const getGroupId = (req) =>
  req.userType === "group" ? req.group._id : req.member.group;

// ─────────────────────────────────────────────────────────────
// @desc    Add a new member (admin/president) or self-register
// @route   POST /api/members
// @access  Private (Admin / President) or Public (self-register)
// ─────────────────────────────────────────────────────────────
exports.addMember = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const { name, email, password, phone, dateOfBirth, career, skills, role } =
      req.body;

    const exists = await Member.findOne({ email, group: groupId });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Email already registered in this group",
      });
    }

    const profilePhoto = req.file ? req.file.path : null;

    // Admin-added members are active immediately; self-registered are pending
    const status =
      req.userType === "group" ||
      ["admin", "president"].includes(req.member?.role)
        ? "active"
        : "pending";

    const member = await Member.create({
      group: groupId,
      name,
      email,
      password,
      phone,
      dateOfBirth,
      career,
      skills: skills ? JSON.parse(skills) : [],
      role: role || "member",
      profilePhoto,
      status,
      privateInfo: {
        stateOfOrigin: req.body.stateOfOrigin || null,
        localGovernment: req.body.localGovernment || null,
        countryOfResidence: req.body.countryOfResidence || null,
        residentialAddress: req.body.residentialAddress || null,
      },
    });

    res.status(201).json({
      success: true,
      message: "Member added successfully",
      data: member,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Get all members of a group
// @route   GET /api/members
// @access  Private
// ─────────────────────────────────────────────────────────────
exports.getMembers = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const { status, role, search } = req.query;

    const filter = { group: groupId };
    if (status) filter.status = status;
    if (role) filter.role = role;
    if (search) filter.name = { $regex: search, $options: "i" };

    // Non-admins don't see private info
    const isAdmin = req.userType === "group" || req.member?.role === "admin";
    const projection = isAdmin ? {} : { privateInfo: 0 };

    const members = await Member.find(filter, projection).sort({
      joinDate: -1,
    });

    res.json({ success: true, count: members.length, data: members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Get single member
// @route   GET /api/members/:id
// @access  Private
// ─────────────────────────────────────────────────────────────
exports.getMember = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const isAdmin = req.userType === "group" || req.member?.role === "admin";
    const projection = isAdmin ? {} : { privateInfo: 0 };

    const member = await Member.findOne(
      { _id: req.params.id, group: groupId },
      projection,
    );
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    res.json({ success: true, data: member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Approve pending member
// @route   PATCH /api/members/:id/approve
// @access  Private (Admin / President)
// ─────────────────────────────────────────────────────────────
exports.approveMember = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const member = await Member.findOneAndUpdate(
      { _id: req.params.id, group: groupId, status: "pending" },
      { status: "active" },
      { new: true },
    );
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Pending member not found" });
    }

    // Create notification for the member
    await Notification.create({
      group: groupId,
      recipient: member._id,
      type: "member_approved",
      title: "Membership Approved",
      message: `Welcome! Your membership in the association has been approved.`,
    });

    res.json({ success: true, message: "Member approved", data: member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Toggle member active/inactive
// @route   PATCH /api/members/:id/toggle-status
// @access  Private (Admin / President)
// ─────────────────────────────────────────────────────────────
exports.toggleMemberStatus = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const member = await Member.findOne({ _id: req.params.id, group: groupId });
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    member.status = member.status === "active" ? "inactive" : "active";
    await member.save();

    res.json({
      success: true,
      message: `Member ${member.status}`,
      data: member,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Delete member
// @route   DELETE /api/members/:id
// @access  Private (Admin / President)
// ─────────────────────────────────────────────────────────────
exports.deleteMember = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const member = await Member.findOneAndDelete({
      _id: req.params.id,
      group: groupId,
    });
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    res.json({ success: true, message: "Member removed from association" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Update member info / role (ENHANCED)
// @route   PUT /api/members/:id
// @access  Private (Admin or self)
// @note    Group Admin can edit ALL fields including role & private info
// ═══════════════════════════════════════════════════════════
// Replace the ENTIRE updateMember function in:
// backend/src/controllers/member.controller.js

exports.updateMember = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const isAdmin = req.userType === "group" || req.member?.role === "admin";

    // Non-admins can only edit themselves
    if (!isAdmin && req.member._id.toString() !== req.params.id) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Cannot edit another member profile",
        });
    }

    const member = await Member.findOne({ _id: req.params.id, group: groupId });
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    // Contact Information
    if (req.body.name !== undefined) member.name = req.body.name;
    if (req.body.email !== undefined) member.email = req.body.email;
    if (req.body.phone !== undefined) member.phone = req.body.phone;
    if (req.body.dateOfBirth !== undefined)
      member.dateOfBirth = req.body.dateOfBirth;
    if (req.body.career !== undefined) member.career = req.body.career;

    if (req.body.skills !== undefined) {
      member.skills =
        typeof req.body.skills === "string"
          ? JSON.parse(req.body.skills)
          : req.body.skills;
    }

    // Profile photo
    if (req.file) member.profilePhoto = req.file.path;

    // Initialize privateInfo if it doesn't exist
    if (!member.privateInfo) {
      member.privateInfo = {};
    }

    // Private Information - Update on member object directly
    if (req.body.maritalStatus !== undefined) {
      member.privateInfo.maritalStatus = req.body.maritalStatus;
    }
    if (req.body.occupation !== undefined) {
      member.privateInfo.occupation = req.body.occupation;
    }
    if (req.body.stateOfOrigin !== undefined) {
      member.privateInfo.stateOfOrigin = req.body.stateOfOrigin;
    }
    if (req.body.localGovernment !== undefined) {
      member.privateInfo.localGovernment = req.body.localGovernment;
    }
    if (req.body.countryOfResidence !== undefined) {
      member.privateInfo.countryOfResidence = req.body.countryOfResidence;
    }
    if (req.body.residentialAddress !== undefined) {
      member.privateInfo.residentialAddress = req.body.residentialAddress;
    }

    // Next of Kin
    if (req.body.nextOfKin !== undefined) {
      if (typeof req.body.nextOfKin === "string") {
        member.privateInfo.nextOfKin = JSON.parse(req.body.nextOfKin);
      } else {
        member.privateInfo.nextOfKin = req.body.nextOfKin;
      }
    }

    // Mark privateInfo as modified (IMPORTANT for Mongoose to save it)
    member.markModified("privateInfo");

    // ADMIN-ONLY FIELDS: Role & Status
    if (isAdmin) {
      if (req.body.role !== undefined) {
        const validRoles = [
          "admin",
          "president",
          "secretary",
          "treasurer",
          "member",
        ];
        if (!validRoles.includes(req.body.role)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid role. Must be one of: admin, president, secretary, treasurer, member",
          });
        }
        member.role = req.body.role;
      }

      if (req.body.status !== undefined) {
        const validStatuses = ["active", "inactive", "suspended", "pending"];
        if (!validStatuses.includes(req.body.status)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid status. Must be one of: active, inactive, suspended, pending",
          });
        }
        member.status = req.body.status;
      }
    }

    // Save all changes
    await member.save();

    res.json({
      success: true,
      message: "Member updated successfully",
      data: member,
    });
  } catch (err) {
    // Handle duplicate email error
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(400).json({
        success: false,
        message: "Email already in use by another member",
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};
// ─────────────────────────────────────────────────────────────
// @desc    Send birthday wishes to member
// @route   POST /api/members/:id/birthday-wish
// @access  Private (Treasurer)
// ─────────────────────────────────────────────────────────────
exports.sendBirthdayWish = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const member = await Member.findOne({ _id: req.params.id, group: groupId });
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    await Notification.create({
      group: groupId,
      recipient: member._id,
      type: "birthday_wish",
      title: "🎂 Happy Birthday!",
      message:
        req.body.message ||
        `Wishing you a wonderful birthday, ${member.name}! From the association.`,
    });

    res.json({ success: true, message: "Birthday wish sent!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
