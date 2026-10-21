'use strict';

class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code || defaultCode(status);
    if (details) this.details = details;
  }
}

function defaultCode(status) {
  return ({
    400: 'BAD_REQUEST', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
    409: 'CONFLICT', 413: 'TOO_LARGE', 422: 'VALIDATION_ERROR', 429: 'RATE_LIMITED',
  })[status] || 'ERROR';
}

const badRequest = (m, d) => new HttpError(400, m, 'BAD_REQUEST', d);
const unauthenticated = (m = 'Please log in to continue.', code = 'UNAUTHENTICATED') => new HttpError(401, m, code);
const forbidden = (m = 'You do not have permission to do that.') => new HttpError(403, m);
const notFound = (what = 'Record') => new HttpError(404, `${what} not found.`);
const conflict = (m) => new HttpError(409, m);
const validation = (fields) => new HttpError(422, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', fields);

module.exports = { HttpError, badRequest, unauthenticated, forbidden, notFound, conflict, validation };
