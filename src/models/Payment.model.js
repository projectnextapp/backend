const mongoose = require("mongoose");

// Payment history subdocument schema
const PaymentHistorySchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidDate: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      default: "",
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
  },
  { _id: true },
);

// Main payment record schema
const PaymentSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    type: {
      type: String,
      enum: ["dues", "levy", "fine", "donation", "other"],
      default: "dues",
    },
    description: {
      type: String,
      required: true,
    },
    amountDue: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Payment history tracking
    paymentHistory: [PaymentHistorySchema],

    status: {
      type: String,
      enum: ["paid", "partial", "unpaid"],
      default: "unpaid",
    },
    dueDate: {
      type: Date,
    },
    paidDate: {
      type: Date,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Auto-set status based on amounts
PaymentSchema.pre("save", function (next) {
  // Calculate status
  if (this.amountPaid >= this.amountDue) {
    this.status = "paid";

    // Set paidDate to the date of the last payment if not already set
    if (!this.paidDate && this.paymentHistory.length > 0) {
      this.paidDate =
        this.paymentHistory[this.paymentHistory.length - 1].paidDate;
    }
  } else if (this.amountPaid > 0) {
    this.status = "partial";
    this.paidDate = null; // Clear paidDate if not fully paid
  } else {
    this.status = "unpaid";
    this.paidDate = null;
  }

  next();
});

// Instance method to add a payment
PaymentSchema.methods.addPayment = function (amount, description, recordedBy) {
  // Calculate new total
  const newAmountPaid = this.amountPaid + amount;

  // Calculate balance after this payment
  const balanceAfter = Math.max(0, this.amountDue - newAmountPaid);

  // Add to payment history
  this.paymentHistory.push({
    amount,
    paidDate: new Date(),
    description:
      description ||
      (balanceAfter === 0 ? "Balance cleared" : "Partial payment"),
    recordedBy,
    balanceAfter,
  });

  // Update total amount paid
  this.amountPaid = newAmountPaid;

  return this.save();
};

// Virtual to get outstanding balance
PaymentSchema.virtual("outstandingBalance").get(function () {
  return Math.max(0, this.amountDue - this.amountPaid);
});

// Ensure virtuals are included in JSON
PaymentSchema.set("toJSON", { virtuals: true });
PaymentSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Payment", PaymentSchema);
