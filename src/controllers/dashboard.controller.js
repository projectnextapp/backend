const Member = require("../models/Member.model");
const Election = require("../models/Election.model");
const Payment = require("../models/Payment.model");
const Notice = require("../models/Notice.model");
const Notification = require("../models/Notification.model");
const Expenditure = require("../models/Expenditure");

const getGroupId = (req) =>
  req.userType === "group" ? req.group._id : req.member.group;

// ─────────────────────────────────────────────────────────────
// @desc    Get dashboard overview
// @route   GET /api/dashboard
// @access  Private
// ─────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const role = req.member?.role || "admin";

    // ── Counts ──────────────────────────────────────────────
    const [totalMembers, activeMembers, pendingMembers] = await Promise.all([
      Member.countDocuments({ group: groupId }),
      Member.countDocuments({ group: groupId, status: "active" }),
      Member.countDocuments({ group: groupId, status: "pending" }),
    ]);

    // ── Active elections ─────────────────────────────────────
    const now = new Date();
    const ongoingElections = await Election.find({
      group: groupId,
      status: "active",
      deadline: { $gt: now },
    }).select("title position deadline");

    const upcomingElections = await Election.find({
      group: groupId,
      status: "upcoming",
    }).select("title position deadline");

    // ── Financial summary (only for admin/treasurer) ─────────
    let financialSummary = null;
    if (["admin", "treasurer"].includes(role) || req.userType === "group") {
      const payments = await Payment.find({ group: groupId });
      const expenditures = await Expenditure.find({
        group: groupId,
        isApproved: true,
      });

      const totalDue = payments.reduce((s, p) => s + p.amountDue, 0);
      const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0);
      const totalExpenses = expenditures.reduce((s, e) => s + e.amount, 0);
      const currentBalance = totalPaid - totalExpenses;

      financialSummary = {
        totalDue,
        totalPaid,
        outstanding: totalDue - totalPaid,
        totalExpenses,
        currentBalance,
      };
    }

    // ── Recent notices ───────────────────────────────────────
    const recentNotices = await Notice.find({ group: groupId, isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title type createdAt");

    // ── Unread notifications ─────────────────────────────────
    const memberId = req.member?._id || null;
    const unreadNotifications = await Notification.countDocuments({
      group: groupId,
      isRead: false,
      $or: [{ recipient: memberId }, { recipient: null }],
    });

    res.json({
      success: true,
      data: {
        members: {
          total: totalMembers,
          active: activeMembers,
          pending: pendingMembers,
        },
        elections: {
          ongoing: ongoingElections,
          upcoming: upcomingElections,
        },
        financialSummary,
        recentNotices,
        unreadNotifications,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
