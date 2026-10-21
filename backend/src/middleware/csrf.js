'use strict';
const crypto = require('crypto');
const { HttpError } = require('../utils/httpError');

/*
 * Synchroniser-token CSRF protection for the cookie session.
 * The token lives in the server-side session and is handed to the page by
 * GET /api/auth/csrf. Every state-changing API call must echo it in the
 * X-CSRF-Token header. Combined with SameSite=Lax cookies this blocks
 * cross-site form posts and fetches.
 */
function ensureToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  return req.session.csrfToken;
}

function csrfProtection(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.get('X-CSRF-Token') || '';
  const expected = req.session && req.session.csrfToken;
  if (!expected || sent.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected))) {
    return next(new HttpError(403, 'Your page is out of date. Refresh the page and try again.', 'CSRF_INVALID'));
  }
  next();
}

module.exports = { csrfProtection, ensureToken };
