const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const GroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Association name is required'],
    trim: true
  },
  logo: {
    type: String,       // Cloudinary URL
    default: null
  },
  location: {
    type: String,
    required: [true, 'Location is required']
  },
  contactEmail: {
    type: String,
    required: [true, 'Contact email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false      // Never return password in queries
  },
  memberSizeRange: {
    type: String,
    required: true,
    enum: ['1-10', '11-500', '501-1000', '1001-5000']
  },
  // Admin / representative info
  adminInfo: {
    name:  { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Hash password before saving
GroupSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed
GroupSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Group', GroupSchema);
