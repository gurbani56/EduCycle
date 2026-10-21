'use strict';
const router = require('express').Router();
const c = require('../controllers/resourceController');
const { requireStudent } = require('../middleware/auth');

router.get('/', c.list);
router.get('/featured', c.featured);
router.get('/mine', requireStudent, c.mine);
router.get('/:id', c.get);
router.post('/', requireStudent, c.create);
router.patch('/:id', requireStudent, c.update);
router.delete('/:id', requireStudent, c.remove);

module.exports = router;
