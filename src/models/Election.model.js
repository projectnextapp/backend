const mongoose = require('mongoose');

const CandidateSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  },
  name:    { type: String, required: true },
  photo:   { type: String, default: null },     // Cloudinary URL
  voteCount: { type: Number, default: 0 }
});

const ElectionSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  title:    { type: String, required: [true, 'Election title is required'] },
  position: { type: String, required: [true, 'Position is required'] },
  type: {
    type: String,
    enum: ['election', 'general_vote'],
    default: 'election'
  },
  candidates:  [CandidateSchema],
  votedBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }], // Track who voted
  deadline:    { type: Date, required: true },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'closed'],
    default: 'upcoming'
  },
  showResultsLive: {
    type: Boolean,
    default: false    // Admin can decide whether to show live results
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  }
}, { timestamps: true });

module.exports = mongoose.model('Election', ElectionSchema);
