const Group = require("../models/Group.model");
const Member = require("../models/Member.model");
const Notification = require("../models/Notification.model");
const { emitToGroup, emitToUser } = require("../socket/socket");

// ═══════════════════════════════════════════════════════════
// @desc    Get All Groups/Associations
// @route   GET /api/superadmin/groups
// @access  Private (Super Admin)
// ═══════════════════════════════════════════════════════════
exports.getAllGroups = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.isActive = status === "active";
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const groups = await Group.find(query)
      .select("name email phone address logo isActive createdAt")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Group.countDocuments(query);

    // Get member count for each group
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        const memberCount = await Member.countDocuments({ group: group._id });
        const adminCount = await Member.countDocuments({
          group: group._id,
          role: { $in: ["admin", "president", "treasurer", "secretary"] },
        });

        return {
          ...group,
          memberCount,
          adminCount,
        };
      }),
    );

    res.json({
      success: true,
      data: groupsWithCounts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get all groups error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Get Group Details with Admin & Executives
// @route   GET /api/superadmin/groups/:id
// @access  Private (Super Admin)
// ═══════════════════════════════════════════════════════════
exports.getGroupDetails = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Get all executives and admins
    const executives = await Member.find({
      group: req.params.id,
      role: { $in: ["admin", "president", "treasurer", "secretary"] },
    })
      .select("name email phone role status isActive lastLogin createdAt")
      .lean();

    // Get total member count
    const totalMembers = await Member.countDocuments({ group: req.params.id });
    const activeMembers = await Member.countDocuments({
      group: req.params.id,
      status: "active",
    });

    res.json({
      success: true,
      data: {
        group: {
          id: group._id,
          name: group.name,
          email: group.email,
          phone: group.phone,
          address: group.address,
          logo: group.logo,
          isActive: group.isActive,
          createdAt: group.createdAt,
        },
        executives,
        stats: {
          totalMembers,
          activeMembers,
          executiveCount: executives.length,
        },
      },
    });
  } catch (err) {
    console.error("Get group details error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Activate/Deactivate Group Admin
// @route   PATCH /api/superadmin/groups/:groupId/admin/toggle
// @access  Private (Super Admin)
// ═══════════════════════════════════════════════════════════
exports.toggleGroupAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { activate } = req.body; // true or false

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Update group admin status
    group.isActive = activate;
    await group.save();

    // Create notification for the group admin
    await Notification.create({
      group: groupId,
      recipient: null, // Broadcast to all in group
      type: "general",
      title: activate ? "Account Reactivated" : "Account Deactivated",
      message: activate
        ? "Your group admin account has been reactivated by the platform administrator."
        : "Your group admin account has been deactivated by the platform administrator. Please contact support for more information.",
    });

    // Emit real-time notification
    emitToGroup(groupId, "notification:new", {
      title: activate ? "Account Reactivated" : "Account Deactivated",
      message: activate
        ? "Group admin access restored"
        : "Group admin access suspended",
    });

    res.json({
      success: true,
      message: `Group admin ${activate ? "activated" : "deactivated"} successfully`,
      data: { isActive: activate },
    });
  } catch (err) {
    console.error("Toggle group admin error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Activate/Deactivate Executive Member
// @route   PATCH /api/superadmin/groups/:groupId/executives/:memberId/toggle
// @access  Private (Super Admin)
// ═══════════════════════════════════════════════════════════
exports.toggleExecutive = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { activate } = req.body;

    const member = await Member.findOne({
      _id: memberId,
      group: groupId,
      role: { $in: ["president", "treasurer", "secretary"] },
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Executive member not found",
      });
    }

    // Update executive status
    member.isActive = activate;
    await member.save();

    // Create notification for the executive
    await Notification.create({
      group: groupId,
      recipient: memberId,
      type: "general",
      title: activate ? "Account Reactivated" : "Account Deactivated",
      message: activate
        ? `Your executive account (${member.role}) has been reactivated.`
        : `Your executive account (${member.role}) has been deactivated. Please contact support.`,
    });

    // Emit real-time notification
    if (activate) {
      emitToUser(memberId, "notification:new", {
        title: "Account Reactivated",
        message: "Your access has been restored",
      });
    }

    res.json({
      success: true,
      message: `Executive ${activate ? "activated" : "deactivated"} successfully`,
      data: {
        memberId,
        role: member.role,
        isActive: activate,
      },
    });
  } catch (err) {
    console.error("Toggle executive error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Send Notification to Group
// @route   POST /api/superadmin/groups/:groupId/notify
// @access  Private (Super Admin)
// ═══════════════════════════════════════════════════════════
exports.sendNotification = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { title, message, targetAudience } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    let recipients = [];

    // Determine recipients based on target audience
    if (targetAudience === "admin") {
      // Send to group admin only (broadcast to group)
      await Notification.create({
        group: groupId,
        recipient: null, // Group admin will see this
        type: "general",
        title,
        message: `[Platform Admin] ${message}`,
      });
    } else if (targetAudience === "executives") {
      // Send to all executives
      const executives = await Member.find({
        group: groupId,
        role: { $in: ["president", "treasurer", "secretary"] },
      });

      for (const exec of executives) {
        await Notification.create({
          group: groupId,
          recipient: exec._id,
          type: "general",
          title,
          message: `[Platform Admin] ${message}`,
        });

        emitToUser(exec._id.toString(), "notification:new", {
          title,
          message,
        });
      }

      recipients = executives.map((e) => ({
        id: e._id,
        role: e.role,
        name: e.name,
      }));
    } else {
      // Send to both admin and executives
      await Notification.create({
        group: groupId,
        recipient: null, // Admin
        type: "general",
        title,
        message: `[Platform Admin] ${message}`,
      });

      const executives = await Member.find({
        group: groupId,
        role: { $in: ["president", "treasurer", "secretary"] },
      });

      for (const exec of executives) {
        await Notification.create({
          group: groupId,
          recipient: exec._id,
          type: "general",
          title,
          message: `[Platform Admin] ${message}`,
        });

        emitToUser(exec._id.toString(), "notification:new", {
          title,
          message,
        });
      }

      recipients = [
        { role: "admin" },
        ...executives.map((e) => ({ id: e._id, role: e.role, name: e.name })),
      ];
    }

    // Emit to group
    emitToGroup(groupId, "notification:new", {
      title,
      message,
      from: "Platform Admin",
    });

    res.json({
      success: true,
      message: "Notification sent successfully",
      data: {
        sentTo: targetAudience || "all",
        recipientCount:
          recipients.length + (targetAudience !== "executives" ? 1 : 0),
      },
    });
  } catch (err) {
    console.error("Send notification error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Get Platform Statistics
// @route   GET /api/superadmin/stats
// @access  Private (Super Admin)
// ═══════════════════════════════════════════════════════════
exports.getPlatformStats = async (req, res) => {
  try {
    const totalGroups = await Group.countDocuments();
    const activeGroups = await Group.countDocuments({ isActive: true });
    const totalMembers = await Member.countDocuments();
    const activeMembers = await Member.countDocuments({ status: "active" });
    const totalExecutives = await Member.countDocuments({
      role: { $in: ["president", "treasurer", "secretary"] },
    });

    // Recent groups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentGroups = await Group.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    res.json({
      success: true,
      data: {
        groups: {
          total: totalGroups,
          active: activeGroups,
          inactive: totalGroups - activeGroups,
          recent: recentGroups,
        },
        members: {
          total: totalMembers,
          active: activeMembers,
          executives: totalExecutives,
        },
      },
    });
  } catch (err) {
    console.error("Get platform stats error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
