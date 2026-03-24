const mongoose = require('mongoose');

const ExpenditureSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['operational', 'event', 'maintenance', 'welfare', 'donation', 'other'],
    default: 'operational'
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  receipt: {
    type: String // Cloudinary URL for receipt image
  },
  notes: String,
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  },
  approvedAt: Date
}, { timestamps: true });

// Indexes
ExpenditureSchema.index({ group: 1, date: -1 });
ExpenditureSchema.index({ group: 1, category: 1 });

module.exports = mongoose.model('Expenditure', ExpenditureSchema);
