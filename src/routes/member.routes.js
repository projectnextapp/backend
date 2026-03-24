const express = require('express');
const router  = express.Router();
const { protect, requirePresident, requireTreasurer } = require('../middleware/auth.middleware');
const { uploadMemberPhoto } = require('../config/cloudinary');
const {
  addMember,
  getMembers,
  getMember,
  approveMember,
  toggleMemberStatus,
  deleteMember,
  updateMember,
  sendBirthdayWish
} = require('../controllers/member.controller');

router.post('/',                  protect, requirePresident, uploadMemberPhoto.single('profilePhoto'), addMember);
router.get('/',                   protect, getMembers);
router.get('/:id',                protect, getMember);
router.put('/:id',                protect, uploadMemberPhoto.single('profilePhoto'), updateMember);
router.patch('/:id/approve',      protect, requirePresident, approveMember);
router.patch('/:id/toggle-status',protect, requirePresident, toggleMemberStatus);
router.delete('/:id',             protect, requirePresident, deleteMember);
router.post('/:id/birthday-wish', protect, requireTreasurer, sendBirthdayWish);

module.exports = router;
