'use strict';
const { User } = require('../models');
const { unauthenticated, forbidden } = require('../utils/httpError');

/**
 * Loads the signed-in user from the session on every request. A disabled or
 * deleted account ends the session immediately, so admin action takes effect
 * without waiting for the cookie to expire.
 */
async function loadUser(req, _res, next) {
  req.user = null;
  const uid = req.session && req.session.userId;
  if (!uid) return next();
  const user = await User.findById(uid);
  if (!user || user.status !== 'active' || user.role !== req.session.role) {
    req.sessionEnded = user && user.status !== 'active' ? 'ACCOUNT_DISABLED' : 'SESSION_INVALID';
    await new Promise((resolve) => req.session.regenerate(() => resolve()));
    return next();
  }
  req.user = user;
  next();
}

function requireAuth(req, _res, next) {
  if (req.user) return next();
  if (req.sessionEnded === 'ACCOUNT_DISABLED') return next(unauthenticated('Your account has been disabled. Contact the EduCycle administrators.', 'ACCOUNT_DISABLED'));
  return next(unauthenticated('Your session has ended. Please log in again.', 'SESSION_EXPIRED'));
}

function requireStudent(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== 'student') return next(forbidden('This action is for student accounts.'));
    next();
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== 'admin') return next(forbidden('Administrator access is required.'));
    next();
  });
}

module.exports = { loadUser, requireAuth, requireStudent, requireAdmin };
