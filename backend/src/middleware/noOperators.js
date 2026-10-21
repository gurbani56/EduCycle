'use strict';
const { badRequest } = require('../utils/httpError');

/** Reject any request whose body or query contains keys such as `$gt` or `a.b` (MongoDB operator injection). */
function hasOperatorKeys(value, depth = 0) {
  if (depth > 8 || !value || typeof value !== 'object') return false;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) return true;
    if (hasOperatorKeys(value[key], depth + 1)) return true;
  }
  return false;
}

function noOperators(req, _res, next) {
  if (hasOperatorKeys(req.body) || hasOperatorKeys(req.query) || hasOperatorKeys(req.params)) {
    return next(badRequest('The request contains characters that are not allowed.'));
  }
  next();
}

module.exports = { noOperators, hasOperatorKeys };
