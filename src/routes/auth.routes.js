const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { uploadLogo } = require('../config/cloudinary');
const {
  createGroup,
  groupLogin,
  memberLogin,
  getMe,
  changePassword
} = require('../controllers/auth.controller');

router.post('/create-group',     uploadLogo.single('logo'), createGroup);
router.post('/group-login',      groupLogin);
router.post('/member-login',     memberLogin);
router.get('/me',                protect, getMe);
router.put('/change-password',   protect, changePassword);

module.exports = router;
