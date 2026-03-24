const mongoose = require("mongoose");

const advertSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      maxlength: 500,
    },
    image: {
      type: String, // Cloudinary URL
      default: null,
    },
    link: {
      type: String,
      default: null,
    },
    position: {
      type: String,
      enum: ["header", "footer", "dashboard"],
      default: "dashboard",
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    targetAudience: {
      type: String,
      enum: ["all", "specific_groups"],
      default: "all",
    },
    targetGroups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
      },
    ],
    impressions: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    dismissedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Member",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
advertSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
advertSchema.index({ position: 1 });
advertSchema.index({ targetAudience: 1 });

// Method to check if advert is currently active
advertSchema.methods.isCurrentlyActive = function () {
  const now = new Date();
  return this.isActive && this.startDate <= now && this.endDate >= now;
};

// Method to check if user has dismissed this advert
advertSchema.methods.isDismissedBy = function (userId) {
  return this.dismissedBy.some((id) => id.toString() === userId.toString());
};

// Static method to get active adverts for a user
advertSchema.statics.getActiveAdvertsForUser = async function (
  userId,
  groupId,
  position = null,
) {
  const now = new Date();

  const query = {
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    dismissedBy: { $ne: userId },
  };

  if (position) {
    query.position = position;
  }

  // Target audience filtering
  query.$or = [
    { targetAudience: "all" },
    {
      targetAudience: "specific_groups",
      targetGroups: groupId,
    },
  ];

  return this.find(query)
    .select(
      "title description image link position startDate endDate targetAudience impressions clicks",
    )
    .sort({ createdAt: -1 })
    .lean();
};

// Update impressions
advertSchema.methods.incrementImpressions = function () {
  this.impressions += 1;
  return this.save();
};

// Update clicks
advertSchema.methods.incrementClicks = function () {
  this.clicks += 1;
  return this.save();
};

module.exports = mongoose.model("Advert", advertSchema);
