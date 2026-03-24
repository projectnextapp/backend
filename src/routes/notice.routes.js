const express = require('express');
const router  = express.Router();
const { protect, requireSecretary } = require('../middleware/auth.middleware');
const {
  createNotice,
  getNotices,
  updateNotice,
  deleteNotice
} = require('../controllers/notice.controller');

router.post('/',        protect, requireSecretary, createNotice);
router.get('/',         protect, getNotices);
router.put('/:id',      protect, requireSecretary, updateNotice);
router.delete('/:id',   protect, requireSecretary, deleteNotice);

module.exports = router;
