const Notice = require('../models/Notice.model');

const getGroupId = (req) =>
  req.userType === 'group' ? req.group._id : req.member.group;

// ─────────────────────────────────────────────────────────────
// @desc    Post a notice or meeting minutes
// @route   POST /api/notices
// @access  Private (Secretary / Admin)
// ─────────────────────────────────────────────────────────────
exports.createNotice = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const { title, content, type } = req.body;

    const notice = await Notice.create({
      group:    groupId,
      title, content,
      type:     type || 'notice',
      postedBy: req.member?._id || null
    });

    res.status(201).json({ success: true, data: notice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Get all notices
// @route   GET /api/notices
// @access  Private
// ─────────────────────────────────────────────────────────────
exports.getNotices = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const { type } = req.query;

    const filter = { group: groupId, isActive: true };
    if (type) filter.type = type;

    const notices = await Notice.find(filter)
      .populate('postedBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: notices.length, data: notices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Update a notice (with history tracking)
// @route   PUT /api/notices/:id
// @access  Private (Secretary / Admin)
// ─────────────────────────────────────────────────────────────
exports.updateNotice = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const { title, content, changes } = req.body;

    const notice = await Notice.findOne({ _id: req.params.id, group: groupId });
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    // Push to edit history
    notice.editHistory.push({
      editedBy: req.member?._id || null,
      editedAt: new Date(),
      changes:  changes || 'Content updated'
    });

    if (title)   notice.title   = title;
    if (content) notice.content = content;

    await notice.save();

    res.json({ success: true, data: notice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Delete / archive a notice
// @route   DELETE /api/notices/:id
// @access  Private (Secretary / Admin)
// ─────────────────────────────────────────────────────────────
exports.deleteNotice = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const notice  = await Notice.findOneAndUpdate(
      { _id: req.params.id, group: groupId },
      { isActive: false },
      { new: true }
    );
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    res.json({ success: true, message: 'Notice archived' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
