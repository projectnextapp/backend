const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null, // null = broadcast to all group members
    },
    type: {
      type: String,
      enum: [
        "payment_reminder",
        "election_announced",
        "election_result",
        "birthday_wish",
        "meeting_notice",
        "member_approved",
        "member_deactivated",
        "role_changed",
        "general",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Notification", NotificationSchema);
