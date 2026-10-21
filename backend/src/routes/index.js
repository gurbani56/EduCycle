'use strict';
const router = require('express').Router();
const { meta } = require('../controllers/metaController');
const { publicStats } = require('../controllers/resourceController');

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.get('/meta', meta);
router.get('/stats', publicStats);

router.use('/auth', require('./auth'));
router.use('/resources', require('./resources'));
router.use('/requests', require('./requests'));
router.use('/locations', require('./locations'));
router.use('/grievances', require('./grievances'));
router.use('/board', require('./board'));
router.use('/notifications', require('./notifications'));
router.use('/activity', require('./activity'));
router.use('/admin', require('./admin'));

module.exports = router;
