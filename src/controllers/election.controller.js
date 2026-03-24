const Election     = require('../models/Election.model');
const Notification = require('../models/Notification.model');

const getGroupId = (req) =>
  req.userType === 'group' ? req.group._id : req.member.group;

// ─────────────────────────────────────────────────────────────
// @desc    Create election or general vote
// @route   POST /api/elections
// @access  Private (Admin / President)
// ─────────────────────────────────────────────────────────────
exports.createElection = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const { title, position, type, deadline, showResultsLive, candidates } = req.body;

    const parsedCandidates = candidates
      ? (typeof candidates === 'string' ? JSON.parse(candidates) : candidates)
      : [];

    const election = await Election.create({
      group: groupId,
      title, position, type,
      deadline: new Date(deadline),
      showResultsLive: showResultsLive === 'true' || showResultsLive === true,
      candidates: parsedCandidates,
      createdBy: req.member?._id || null,
      status: new Date(deadline) > new Date() ? 'active' : 'upcoming'
    });

    // Notify all members
    await Notification.create({
      group: groupId,
      recipient: null,       // broadcast
      type: 'election_announced',
      title: `📢 New ${type === 'election' ? 'Election' : 'Vote'}: ${title}`,
      message: `A new ${type === 'election' ? 'election' : 'vote'} has been created. Position: ${position}. Deadline: ${new Date(deadline).toLocaleDateString()}`
    });

    res.status(201).json({ success: true, data: election });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Get all elections
// @route   GET /api/elections
// @access  Private
// ─────────────────────────────────────────────────────────────
exports.getElections = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const elections = await Election.find({ group: groupId })
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: elections.length, data: elections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Cast a vote
// @route   POST /api/elections/:electionId/vote
// @access  Private (Member)
// ─────────────────────────────────────────────────────────────
exports.castVote = async (req, res) => {
  try {
    const groupId  = getGroupId(req);
    const memberId = req.member?._id;

    if (!memberId) {
      return res.status(403).json({ success: false, message: 'Only members can vote' });
    }

    const election = await Election.findOne({ _id: req.params.electionId, group: groupId });
    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    if (election.status !== 'active') {
      return res.status(400).json({ success: false, message: 'This election is not currently active' });
    }
    if (new Date() > new Date(election.deadline)) {
      election.status = 'closed';
      await election.save();
      return res.status(400).json({ success: false, message: 'Voting deadline has passed' });
    }

    // One vote per member
    if (election.votedBy.includes(memberId)) {
      return res.status(400).json({ success: false, message: 'You have already voted in this election' });
    }

    const { candidateId } = req.body;
    const candidate = election.candidates.id(candidateId);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    candidate.voteCount += 1;
    election.votedBy.push(memberId);
    await election.save();

    res.json({ success: true, message: 'Vote cast successfully ✅' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Get election results
// @route   GET /api/elections/:electionId/results
// @access  Private
// ─────────────────────────────────────────────────────────────
exports.getResults = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const election = await Election.findOne({ _id: req.params.electionId, group: groupId });
    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    const isAdmin = req.userType === 'group' || ['admin', 'president'].includes(req.member?.role);
    const isClosed = election.status === 'closed' || new Date() > new Date(election.deadline);

    // Show results to members only if: election closed OR live results enabled
    if (!isAdmin && !isClosed && !election.showResultsLive) {
      return res.status(403).json({
        success: false,
        message: 'Results will be available after the election closes'
      });
    }

    const results = election.candidates
      .map(c => ({ name: c.name, photo: c.photo, voteCount: c.voteCount }))
      .sort((a, b) => b.voteCount - a.voteCount);

    res.json({
      success: true,
      data: {
        title: election.title,
        position: election.position,
        status: isClosed ? 'closed' : election.status,
        totalVotes: election.votedBy.length,
        results
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Close an election manually
// @route   PATCH /api/elections/:electionId/close
// @access  Private (Admin / President)
// ─────────────────────────────────────────────────────────────
exports.closeElection = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const election = await Election.findOneAndUpdate(
      { _id: req.params.electionId, group: groupId },
      { status: 'closed' },
      { new: true }
    );
    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    // Notify all members of result
    await Notification.create({
      group: groupId,
      recipient: null,
      type: 'election_result',
      title: `🏆 Election Results: ${election.title}`,
      message: `Voting for "${election.title}" has closed. Results are now available.`
    });

    res.json({ success: true, message: 'Election closed', data: election });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
