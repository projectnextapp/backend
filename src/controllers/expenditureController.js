const Expenditure = require("../models/Expenditure");
const Payment = require("../models/Payment.model");
const { emitToGroup } = require("../socket/socket");

// @desc    Get all expenditures for a group
// @route   GET /api/expenditures
// @access  Private
exports.getExpenditures = async (req, res) => {
  try {
    const groupId = req.userType === "group" ? req.group._id : req.member.group;
    const expenditures = await Expenditure.find({ group: groupId })
      .populate("recordedBy", "name email")
      .populate("approvedBy", "name email")
      .sort("-date");

    res.json({ success: true, data: expenditures });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get expenditure summary and balance
// @route   GET /api/expenditures/summary
// @access  Private
exports.getSummary = async (req, res) => {
  try {
    const groupId = req.userType === "group" ? req.group._id : req.member.group;

    // Get total income (all payments - amount paid)
    const payments = await Payment.find({ group: groupId });
    const totalIncome = payments.reduce(
      (sum, p) => sum + (p.amountPaid || 0),
      0,
    );
    const totalDue = payments.reduce((sum, p) => sum + (p.amountDue || 0), 0);

    // Get total expenditures
    const expenditures = await Expenditure.find({ group: groupId });
    const totalExpenses = expenditures.reduce((sum, e) => sum + e.amount, 0);
    const approvedExpenses = expenditures
      .filter((e) => e.isApproved)
      .reduce((sum, e) => sum + e.amount, 0);
    const pendingExpenses = expenditures
      .filter((e) => !e.isApproved)
      .reduce((sum, e) => sum + e.amount, 0);

    // Calculate balance
    const currentBalance = totalIncome - approvedExpenses;

    res.json({
      success: true,
      data: {
        totalIncome,
        totalDue,
        totalExpenses,
        approvedExpenses,
        pendingExpenses,
        currentBalance,
        expenditureCount: expenditures.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create new expenditure
// @route   POST /api/expenditures
// @access  Private (Treasurer/Admin)
exports.createExpenditure = async (req, res) => {
  try {
    const groupId = req.userType === "group" ? req.group._id : req.member.group;
    const { amount, description, category, date, receipt, notes } = req.body;

    const expenditure = await Expenditure.create({
      group: groupId,
      amount,
      description,
      category,
      date: date || Date.now(),
      receipt,
      notes,
      recordedBy: req.member?._id || req.group._id,
    });

    const populated = await Expenditure.findById(expenditure._id).populate(
      "recordedBy",
      "name email",
    );

    // Emit real-time update
    emitToGroup(groupId, "expenditure:update", {
      action: "created",
      expenditure: populated,
    });

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Update expenditure
// @route   PUT /api/expenditures/:id
// @access  Private (Treasurer/Admin)
exports.updateExpenditure = async (req, res) => {
  try {
    const { amount, description, category, date, receipt, notes } = req.body;

    const expenditure = await Expenditure.findByIdAndUpdate(
      req.params.id,
      { amount, description, category, date, receipt, notes },
      { new: true, runValidators: true },
    ).populate("recordedBy approvedBy", "name email");

    if (!expenditure) {
      return res
        .status(404)
        .json({ success: false, message: "Expenditure not found" });
    }

    res.json({ success: true, data: expenditure });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Approve expenditure
// @route   PATCH /api/expenditures/:id/approve
// @access  Private (Admin/President)
exports.approveExpenditure = async (req, res) => {
  try {
    const expenditure = await Expenditure.findByIdAndUpdate(
      req.params.id,
      {
        isApproved: true,
        approvedBy: req.member?._id || req.group._id,
        approvedAt: Date.now(),
      },
      { new: true },
    ).populate("recordedBy approvedBy", "name email");

    if (!expenditure) {
      return res
        .status(404)
        .json({ success: false, message: "Expenditure not found" });
    }

    res.json({ success: true, data: expenditure });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Delete expenditure
// @route   DELETE /api/expenditures/:id
// @access  Private (Admin)
exports.deleteExpenditure = async (req, res) => {
  try {
    const expenditure = await Expenditure.findByIdAndDelete(req.params.id);

    if (!expenditure) {
      return res
        .status(404)
        .json({ success: false, message: "Expenditure not found" });
    }

    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
