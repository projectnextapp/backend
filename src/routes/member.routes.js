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
  sendBirthdayWish,


  // NEW FUNCTIONS - Add these imports
  selfRegister,
  getPendingMembers,
  // approveMember,
  rejectMember,
  bulkApprovemembers
} = require('../controllers/member.controller');

// Public self-registration (NO AUTHENTICATION REQUIRED)
router.post('/self-register', selfRegister);

router.post('/',                  protect, requirePresident, uploadMemberPhoto.single('profilePhoto'), addMember);
router.get('/',                   protect, getMembers);
router.get('/:id',                protect, getMember);
router.put('/:id',                protect, uploadMemberPhoto.single('profilePhoto'), updateMember);
// router.patch('/:id/approve',      protect, requirePresident, approveMember);
router.patch('/:id/toggle-status',protect, requirePresident, toggleMemberStatus);
router.delete('/:id',             protect, requirePresident, deleteMember);
router.post('/:id/birthday-wish', protect, requireTreasurer, sendBirthdayWish);

// ==================== NEW ROUTES - Add these ====================
 

 
// Get pending members (Admin only)
router.get('/pending/list', protect, getPendingMembers);
 
// Approve member (Admin only)
router.patch('/:id/approve', protect, approveMember);
 
// Reject member (Admin only)
router.patch('/:id/reject', protect, rejectMember);
 
// Bulk approve (Admin only)
router.post('/bulk-approve', protect, bulkApprovemembers);
 


module.exports = router;
