const mongoose = require('mongoose');

const EditHistorySchema = new mongoose.Schema({
  editedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  editedAt:  { type: Date, default: Date.now },
  changes:   { type: String }    // Brief description of what changed
});

const NoticeSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  type: {
    type: String,
    enum: ['notice', 'meeting_minutes', 'announcement'],
    default: 'notice'
  },
  title:   { type: String, required: [true, 'Title is required'] },
  content: { type: String, required: [true, 'Content is required'] },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true
  },
  editHistory: [EditHistorySchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Notice', NoticeSchema);
