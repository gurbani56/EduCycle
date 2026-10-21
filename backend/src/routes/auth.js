'use strict';
const router = require('express').Router();
const c = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, loginIpLimiter, registerLimiter } = require('../middleware/rateLimits');

router.get('/csrf', c.csrf);
router.get('/me', c.me);
router.post('/register', registerLimiter, c.register);
router.post('/login', loginIpLimiter, loginLimiter, c.login);
router.post('/admin/login', loginIpLimiter, loginLimiter, c.adminLogin);
router.post('/logout', c.logout);
router.patch('/me', requireAuth, c.updateProfile);
router.post('/password', requireAuth, loginLimiter, c.changePassword);

module.exports = router;
