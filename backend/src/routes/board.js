'use strict';
const router = require('express').Router();
const c = require('../controllers/boardController');
const { requireStudent } = require('../middleware/auth');

router.get('/', c.list);
router.post('/', requireStudent, c.create);
router.patch('/:id/close', requireStudent, c.close);
router.post('/:id/offers', requireStudent, c.offer);

module.exports = router;
