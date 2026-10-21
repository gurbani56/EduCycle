'use strict';
const router = require('express').Router();
const c = require('../controllers/grievanceController');
const { requireStudent } = require('../middleware/auth');

router.use(requireStudent);
router.post('/', c.create);
router.get('/mine', c.mine);
router.get('/:id', c.get);

module.exports = router;
