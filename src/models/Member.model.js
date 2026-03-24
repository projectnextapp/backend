const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MemberSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    // ─── Public Fields ────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },
    profilePhoto: {
      type: String,
      default: null, // Cloudinary URL
    },
    phone: {
      type: String,
      default: null,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    career: {
      type: String,
      default: null,
    },
    skills: {
      type: [String],
      default: [],
    },
    role: {
      type: String,
      enum: [
        "member",
        "president",
        "secretary",
        "treasurer",
        "executive",
        "admin",
      ],
      default: "member",
    },
    status: {
      type: String,
      enum: ["pending", "active", "inactive"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "unpaid"],
      default: "unpaid",
    },

    joinDate: {
      type: Date,
      default: Date.now,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ─── Admin-Only Private Fields ───────────────────────────────
    privateInfo: {
      stateOfOrigin: { type: String, default: null },
      localGovernment: { type: String, default: null },
      countryOfResidence: { type: String, default: null },
      residentialAddress: { type: String, default: null },
    },
  },
  { timestamps: true },
);

// Compound index: email must be unique within a group
MemberSchema.index({ group: 1, email: 1 }, { unique: true });

// Hash password before saving
MemberSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
MemberSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Member", MemberSchema);
