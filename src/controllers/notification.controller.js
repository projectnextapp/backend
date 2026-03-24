const Notification = require("../models/Notification.model");
const { emitToGroup, emitToUser } = require("../socket/socket");

const getGroupId = (req) =>
  req.userType === "group" ? req.group._id : req.member.group;

// ─────────────────────────────────────────────────────────────
// @desc    Get notifications for current member
// @route   GET /api/notifications
// @access  Private
// ─────────────────────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const memberId = req.member?._id || null;

    const query = {
      group: groupId,
      $or: [
        { recipient: memberId },
        { recipient: null }, // Broadcasts
      ],
    };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.json({ success: true, unreadCount, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
// ─────────────────────────────────────────────────────────────
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true, readAt: new Date() },
      { new: true },
    );

    res.json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
// ─────────────────────────────────────────────────────────────
exports.markAllRead = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const memberId = req.member?._id || null;

    await Notification.updateMany(
      {
        group: groupId,
        isRead: false,
        $or: [{ recipient: memberId }, { recipient: null }],
      },
      { isRead: true, readAt: new Date() },
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper: Create and emit notification
exports.createAndEmitNotification = async (notificationData) => {
  try {
    const notification = await Notification.create(notificationData);

    // Emit to specific user or broadcast to group
    if (notification.recipient) {
      emitToUser(
        notification.recipient.toString(),
        "notification:new",
        notification,
      );
    } else {
      emitToGroup(
        notification.group.toString(),
        "notification:new",
        notification,
      );
    }

    return notification;
  } catch (err) {
    console.error("Error creating notification:", err);
    return null;
  }
};
