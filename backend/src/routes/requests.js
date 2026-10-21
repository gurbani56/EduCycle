'use strict';
const router = require('express').Router();
const c = require('../controllers/requestController');
const { requireStudent } = require('../middleware/auth');

router.use(requireStudent);
router.post('/', c.create);
router.get('/mine', c.mine);
router.get('/:id', c.get);
router.patch('/:id/accept', c.accept);
router.patch('/:id/decline', c.decline);
router.patch('/:id/cancel', c.cancel);
router.patch('/:id/location', c.changeLocation);
router.patch('/:id/handover', c.handover);
router.patch('/:id/complete', c.complete);

module.exports = router;
