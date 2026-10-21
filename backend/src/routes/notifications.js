'use strict';
const router = require('express').Router();
const c = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', c.list);
router.get('/count', c.count);
router.patch('/read-all', c.markAllRead);
router.patch('/:id/read', c.markRead);

module.exports = router;
