const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  getNotifications,
  markAsRead,
  markAllRead
} = require('../controllers/notification.controller');

router.get('/',               protect, getNotifications);
router.patch('/read-all',     protect, markAllRead);
router.patch('/:id/read',     protect, markAsRead);

module.exports = router;
