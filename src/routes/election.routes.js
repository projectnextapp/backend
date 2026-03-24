const express = require('express');
const router  = express.Router();
const { protect, requirePresident } = require('../middleware/auth.middleware');
const {
  createElection,
  getElections,
  castVote,
  getResults,
  closeElection
} = require('../controllers/election.controller');

router.post('/',                          protect, requirePresident, createElection);
router.get('/',                           protect, getElections);
router.post('/:electionId/vote',          protect, castVote);
router.get('/:electionId/results',        protect, getResults);
router.patch('/:electionId/close',        protect, requirePresident, closeElection);

module.exports = router;
