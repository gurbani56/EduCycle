'use strict';
const router = require('express').Router();
const c = require('../controllers/locationController');
const { requireStudent } = require('../middleware/auth');

router.get('/', c.approved);
router.get('/mine', requireStudent, c.mine);
router.post('/', requireStudent, c.suggest);

module.exports = router;
