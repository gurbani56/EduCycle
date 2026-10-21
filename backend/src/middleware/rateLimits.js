'use strict';
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const message = (text) => ({ error: { code: 'RATE_LIMITED', message: text } });
const skip = () => process.env.DISABLE_RATE_LIMIT === 'true';

// Counts only failed attempts, keyed by IP + email, so one student cannot lock out others.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip || '')}|${String((req.body && req.body.email) || '').toLowerCase().slice(0, 120)}`,
  message: message('Too many failed login attempts. Please wait 15 minutes and try again.'),
  skip,
});

// Broader cap per network, so one client cannot try many different emails.
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many failed login attempts from this network. Please wait 15 minutes and try again.'),
  skip,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many accounts created from this network. Please try again later.'),
  skip,
});

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('You are doing that too often. Please slow down and try again shortly.'),
  skip,
});

module.exports = { loginLimiter, loginIpLimiter, registerLimiter, writeLimiter };
