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
      return res.status(403).json({
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

// ================================================================
// ADD TO: backend/src/controllers/member.controller.js
// ================================================================
// Member self-registration function
// ================================================================

// ═══════════════════════════════════════════════════════════
// @desc    Member self-registration (Public)
// @route   POST /api/members/self-register
// @access  Public
// ═══════════════════════════════════════════════════════════
exports.selfRegister = async (req, res) => {
  try {
    const {
      groupId,
      name,
      email,
      phone,
      password,
      dateOfBirth,
      career,
      maritalStatus,
      occupation,
      stateOfOrigin,
      localGovernment,
      countryOfResidence,
      residentialAddress,
      nextOfKin,
    } = req.body;

    // 1. VALIDATE REQUIRED FIELDS
    if (!groupId || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: groupId, name, email, password",
      });
    }

    // 2. VERIFY GROUP EXISTS
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Invalid Group ID. Please check and try again.",
      });
    }

    // 3. CHECK IF EMAIL ALREADY EXISTS IN THIS GROUP
    const existingMember = await Member.findOne({
      email: email.toLowerCase(),
      group: groupId,
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: "A member with this email already exists in this association.",
      });
    }

    // 4. CREATE MEMBER WITH PENDING STATUS
    const member = await Member.create({
      group: groupId,
      name,
      email: email.toLowerCase(),
      phone,
      password, // Will be hashed by pre-save hook
      dateOfBirth,
      career,
      role: "member", // Default role
      status: "pending", // IMPORTANT: Set to pending
      paymentStatus: "unpaid",
      privateInfo: {
        maritalStatus,
        occupation,
        stateOfOrigin,
        localGovernment,
        countryOfResidence,
        residentialAddress,
        nextOfKin: nextOfKin
          ? typeof nextOfKin === "string"
            ? JSON.parse(nextOfKin)
            : nextOfKin
          : null,
      },
    });

    // 5. NOTIFY ADMINS (Optional - create notifications for admins)
    try {
      // Find all admins in this group
      const admins = await Member.find({
        group: groupId,
        role: { $in: ["admin", "president", "secretary", "treasurer"] },
        status: "active",
      });

      // Create notification for each admin
      const notifications = admins.map((admin) => ({
        group: groupId,
        recipient: admin._id,
        type: "member_approval",
        title: "📝 New Member Registration",
        message: `${name} has registered and is awaiting approval.`,
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } catch (notifErr) {
      console.error("Error creating notifications:", notifErr);
      // Don't fail registration if notification fails
    }

    // 6. SEND SUCCESS RESPONSE (without password)
    const memberResponse = {
      _id: member._id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      group: member.group,
      status: member.status,
      role: member.role,
    };

    res.status(201).json({
      success: true,
      message: `Registration successful! Your account is pending approval by ${group.name} administrators.`,
      data: memberResponse,
    });
  } catch (err) {
    console.error("Self-registration error:", err);

    // Handle duplicate email error
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(400).json({
        success: false,
        message: "This email is already registered.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Registration failed. Please try againsr.",
      error: err.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Get pending members (Admin only)
// @route   GET /api/members/pending
// @access  Private (Admin, President, Secretary, Treasurer)
// ═══════════════════════════════════════════════════════════
exports.getPendingMembers = async (req, res) => {
  try {
    const groupId = getGroupId(req);

    // Check if user has admin rights
    const isAdmin =
      req.userType === "group" ||
      ["admin", "president", "secretary", "treasurer"].includes(
        req.member?.role,
      );

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only administrators can view pending members.",
      });
    }

    // Get all pending members
    const pendingMembers = await Member.find({
      group: groupId,
      status: "pending",
    }).sort({ createdAt: -1 }); // Newest first

    res.json({
      success: true,
      count: pendingMembers.length,
      data: pendingMembers,
    });
  } catch (err) {
    console.error("Error fetching pending members:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending members",
      error: err.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Approve member registration
// @route   PATCH /api/members/:id/approve
// @access  Private (Admin, President, Secretary, Treasurer)
// ═══════════════════════════════════════════════════════════
// exports.approveMember = async (req, res) => {
//   try {
//     const groupId = getGroupId(req);
//     const memberId = req.params.id;

//     // Check if user has admin rights
//     const isAdmin = req.userType === 'group' ||
//                     ['admin', 'president', 'secretary', 'treasurer'].includes(req.member?.role);

//     if (!isAdmin) {
//       return res.status(403).json({
//         success: false,
//         message: 'Access denied. Only administrators can approve members.'
//       });
//     }

//     // Find and update member
//     const member = await Member.findOneAndUpdate(
//       { _id: memberId, group: groupId, status: 'pending' },
//       {
//         status: 'active',
//         approvedBy: req.userType === 'group' ? req.user._id : req.member._id,
//         approvedAt: new Date()
//       },
//       { new: true }
//     );

//     if (!member) {
//       return res.status(404).json({
//         success: false,
//         message: 'Member not found or already processed.'
//       });
//     }

//     // Send notification to approved member
//     try {
//       await Notification.create({
//         group: groupId,
//         recipient: member._id,
//         type: 'member_approved',
//         title: '✅ Registration Approved',
//         message: 'Congratulations! Your membership has been approved. You can now login and access all features.'
//       });
//     } catch (notifErr) {
//       console.error('Error creating approval notification:', notifErr);
//     }

//     res.json({
//       success: true,
//       message: `${member.name} has been approved successfully!`,
//       data: member
//     });

//   } catch (err) {
//     console.error('Error approving member:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to approve member',
//       error: err.message
//     });
//   }
// };

// ═══════════════════════════════════════════════════════════
// @desc    Reject member registration
// @route   PATCH /api/members/:id/reject
// @access  Private (Admin, President, Secretary, Treasurer)
// ═══════════════════════════════════════════════════════════
exports.rejectMember = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const memberId = req.params.id;
    const { reason } = req.body;

    // Check if user has admin rights
    const isAdmin =
      req.userType === "group" ||
      ["admin", "president", "secretary", "treasurer"].includes(
        req.member?.role,
      );

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only administrators can reject members.",
      });
    }

    // Find member
    const member = await Member.findOne({
      _id: memberId,
      group: groupId,
      status: "pending",
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found or already processed.",
      });
    }

    // Send notification before deleting
    try {
      await Notification.create({
        group: groupId,
        recipient: member._id,
        type: "general",
        title: "❌ Registration Rejected",
        message:
          reason ||
          "Your membership registration has been rejected. Please contact the administrator for more information.",
      });
    } catch (notifErr) {
      console.error("Error creating rejection notification:", notifErr);
    }

    // Delete the member (or you could set status to 'rejected' instead)
    await Member.findByIdAndDelete(memberId);

    res.json({
      success: true,
      message: `Registration for ${member.name} has been rejected.`,
    });
  } catch (err) {
    console.error("Error rejecting member:", err);
    res.status(500).json({
      success: false,
      message: "Failed to reject member",
      error: err.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Bulk approve members
// @route   POST /api/members/bulk-approve
// @access  Private (Admin, President, Secretary, Treasurer)
// ═══════════════════════════════════════════════════════════
exports.bulkApprovemembers = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const { memberIds } = req.body;

    // Check if user has admin rights
    const isAdmin =
      req.userType === "group" ||
      ["admin", "president", "secretary", "treasurer"].includes(
        req.member?.role,
      );

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only administrators can approve members.",
      });
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of member IDs.",
      });
    }

    // Update all members
    const result = await Member.updateMany(
      {
        _id: { $in: memberIds },
        group: groupId,
        status: "pending",
      },
      {
        status: "active",
        approvedBy: req.userType === "group" ? req.user._id : req.member._id,
        approvedAt: new Date(),
      },
    );

    // Send notifications to all approved members
    try {
      const approvedMembers = await Member.find({
        _id: { $in: memberIds },
        group: groupId,
      });

      const notifications = approvedMembers.map((member) => ({
        group: groupId,
        recipient: member._id,
        type: "member_approved",
        title: "✅ Registration Approved",
        message:
          "Congratulations! Your membership has been approved. You can now login and access all features.",
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } catch (notifErr) {
      console.error("Error creating bulk notifications:", notifErr);
    }

    res.json({
      success: true,
      message: `Successfully approved ${result.modifiedCount} member(s)!`,
      count: result.modifiedCount,
    });
  } catch (err) {
    console.error("Error bulk approving members:", err);
    res.status(500).json({
      success: false,
      message: "Failed to approve members",
      error: err.message,
    });
  }
};
