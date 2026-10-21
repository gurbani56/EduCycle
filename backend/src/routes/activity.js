'use strict';
const router = require('express').Router();
const c = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

router.get('/mine', requireAuth, c.myActivity);

module.exports = router;
