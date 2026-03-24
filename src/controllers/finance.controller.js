const Payment = require("../models/Payment.model");
const Member = require("../models/Member.model");
const Notification = require("../models/Notification.model");

const getGroupId = (req) =>
  req.userType === "group" ? req.group._id : req.member.group;

// ═══════════════════════════════════════════════════════════
// @desc    Create a payment record
// @route   POST /api/finances
// @access  Private (Treasurer / Admin)
// ═══════════════════════════════════════════════════════════
exports.createPayment = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const {
      memberId,
      type,
      description,
      amountDue,
      amountPaid,
      dueDate,
      notes,
    } = req.body;

    const member = await Member.findOne({ _id: memberId, group: groupId });
    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found" });
    }

    const payment = await Payment.create({
      member: memberId,
      group: groupId,
      type,
      description,
      amountDue,
      amountPaid,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      recordedBy: req.member?._id || null,
      notes,
    });

    // If initial payment was made, add to payment history
    if (amountPaid && amountPaid > 0) {
      const balanceAfter = Math.max(0, amountDue - amountPaid);
      payment.paymentHistory.push({
        amount: amountPaid,
        paidDate: new Date(),
        description: balanceAfter === 0 ? "Full payment" : "Initial payment",
        recordedBy: req.member?._id || null,
        balanceAfter,
      });
      await payment.save();
    }

    // Update member paymentStatus
    const payments = await Payment.find({ member: memberId, group: groupId });
    const hasUnpaid = payments.some((p) => p.status === "unpaid");
    const hasPartial = payments.some((p) => p.status === "partial");
    member.paymentStatus =
      hasUnpaid || hasPartial ? (hasPartial ? "partial" : "unpaid") : "paid";
    await member.save();

    res.status(201).json({ success: true, data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Add Payment to Existing Record
// @route   POST /api/finances/:id/add-payment
// @access  Private (Treasurer/Admin)
// ═══════════════════════════════════════════════════════════
exports.addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment amount is required",
      });
    }

    const payment = await Payment.findById(id).populate("member", "name email");
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    // Check if already fully paid
    if (payment.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "This payment is already fully paid",
      });
    }

    // Check if payment exceeds outstanding balance
    const outstandingBalance = payment.amountDue - payment.amountPaid;
    if (amount > outstandingBalance) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (₦${amount.toLocaleString()}) exceeds outstanding balance (₦${outstandingBalance.toLocaleString()})`,
      });
    }

    const recordedById = req.member?._id || null;
    const newBalance = outstandingBalance - amount;

    // Add payment using instance method
    await payment.addPayment(
      amount,
      description || (newBalance === 0 ? "Balance cleared" : "Partial payment"),
      recordedById,
    );

    // Reload with populated fields
    const updatedPayment = await Payment.findById(id)
      .populate("member", "name email")
      .populate("paymentHistory.recordedBy", "name");

    res.json({
      success: true,
      message:
        updatedPayment.status === "paid"
          ? "Payment completed successfully. Balance cleared!"
          : `Payment added successfully. Outstanding balance: ₦${newBalance.toLocaleString()}`,
      data: updatedPayment,
    });
  } catch (err) {
    console.error("Add payment error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Get all payment records for group
// @route   GET /api/finances
// @access  Private (Treasurer / Admin)
// ═══════════════════════════════════════════════════════════
exports.getAllPayments = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const { status, memberId } = req.query;

    const filter = { group: groupId };
    if (status) filter.status = status;
    if (memberId) filter.member = memberId;

    const payments = await Payment.find(filter)
      .populate("member", "name email profilePhoto")
      .populate("recordedBy", "name role")
      .populate("paymentHistory.recordedBy", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Get payment records for logged-in member
// @route   GET /api/finances/my-records
// @access  Private (Member)
// ═══════════════════════════════════════════════════════════
exports.getMyPayments = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const memberId = req.member._id;

    const payments = await Payment.find({ member: memberId, group: groupId })
      .populate("paymentHistory.recordedBy", "name")
      .sort({ createdAt: -1 });

    const total = payments.reduce((sum, p) => sum + p.amountDue, 0);
    const paid = payments.reduce((sum, p) => sum + p.amountPaid, 0);

    res.json({
      success: true,
      summary: { total, paid, outstanding: total - paid },
      data: payments,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Update payment record
// @route   PUT /api/finances/:id
// @access  Private (Treasurer / Admin)
// @note    Supports two modes:
//          1. Incremental payment: { addPayment: 5000 } - adds to history
//          2. Full update: { amountPaid: 15000 } - direct update (legacy)
// ═══════════════════════════════════════════════════════════
exports.updatePayment = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const { amountPaid, addPayment, notes, description } = req.body;

    const payment = await Payment.findOne({
      _id: req.params.id,
      group: groupId,
    });
    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment record not found" });
    }

    // MODE 1: Incremental payment (with history tracking)
    if (addPayment !== undefined && addPayment > 0) {
      const outstandingBalance = payment.amountDue - payment.amountPaid;

      if (addPayment > outstandingBalance) {
        return res.status(400).json({
          success: false,
          message: `Payment amount (₦${addPayment.toLocaleString()}) exceeds outstanding balance (₦${outstandingBalance.toLocaleString()})`,
        });
      }

      const recordedById = req.member?._id || null;
      const newBalance = outstandingBalance - addPayment;

      // Add to payment history
      await payment.addPayment(
        addPayment,
        description ||
          (newBalance === 0 ? "Balance cleared" : "Additional payment"),
        recordedById,
      );

      const updatedPayment = await Payment.findById(req.params.id)
        .populate("member", "name email")
        .populate("paymentHistory.recordedBy", "name");

      return res.json({
        success: true,
        message:
          payment.status === "paid"
            ? "Payment completed successfully!"
            : `Payment updated. Outstanding balance: ₦${newBalance.toLocaleString()}`,
        data: updatedPayment,
      });
    }

    // MODE 2: Direct update (legacy mode - no history)
    if (amountPaid !== undefined) {
      payment.amountPaid = amountPaid;
      if (amountPaid >= payment.amountDue) payment.paidDate = new Date();
    }
    if (notes !== undefined) payment.notes = notes;

    await payment.save(); // pre-save hook updates status

    const updatedPayment = await Payment.findById(req.params.id)
      .populate("member", "name email")
      .populate("paymentHistory.recordedBy", "name");

    res.json({
      success: true,
      message: "Payment record updated",
      data: updatedPayment,
    });
  } catch (err) {
    console.error("Update payment error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Send payment reminder to member(s)
// @route   POST /api/finances/reminder
// @access  Private (Treasurer / Admin)
// ═══════════════════════════════════════════════════════════
exports.sendPaymentReminder = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const { memberId, message } = req.body;

    const notifData = {
      group: groupId,
      recipient: memberId || null, // null = all members
      type: "payment_reminder",
      title: "💰 Payment Reminder",
      message:
        message || "You have outstanding dues. Please make your payment soon.",
    };

    await Notification.create(notifData);

    res.json({ success: true, message: "Payment reminder sent" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// @desc    Get financial summary for group
// @route   GET /api/finances/summary
// @access  Private (Treasurer / Admin)
// ═══════════════════════════════════════════════════════════
exports.getFinancialSummary = async (req, res) => {
  try {
    const groupId = getGroupId(req);

    const payments = await Payment.find({ group: groupId });

    const totalDue = payments.reduce((s, p) => s + p.amountDue, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0);
    const outstanding = totalDue - totalPaid;

    const byStatus = {
      paid: payments.filter((p) => p.status === "paid").length,
      partial: payments.filter((p) => p.status === "partial").length,
      unpaid: payments.filter((p) => p.status === "unpaid").length,
    };

    res.json({
      success: true,
      data: {
        totalDue,
        totalPaid,
        outstanding,
        recordCount: payments.length,
        byStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
