'use strict';
const mongoose = require('mongoose');
const { HttpError } = require('../utils/httpError');

function apiNotFound(req, _res, next) {
  next(new HttpError(404, `No API endpoint for ${req.method} ${req.originalUrl.split('?')[0]}.`, 'NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = 500;
  let body = { code: 'SERVER_ERROR', message: 'Something went wrong on our side. Please try again.' };

  if (err instanceof HttpError) {
    status = err.status;
    body = { code: err.code, message: err.message };
    if (err.details) body.fields = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    const fields = {};
    for (const [k, v] of Object.entries(err.errors)) fields[k] = v.message;
    body = { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fields };
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    body = { code: 'BAD_REQUEST', message: `Invalid value for ${err.path}.` };
  } else if (err && err.code === 11000) {
    status = 409;
    body = { code: 'CONFLICT', message: 'A record with these details already exists.' };
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    body = { code: 'BAD_REQUEST', message: 'The request body is not valid JSON.' };
  } else if (err && err.type === 'entity.too.large') {
    status = 413;
    body = { code: 'TOO_LARGE', message: 'The request is too large.' };
  } else if (err && err.name === 'MongoServerSelectionError') {
    status = 503;
    body = { code: 'DB_UNAVAILABLE', message: 'The database is not reachable right now. Please try again shortly.' };
  }

  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  res.status(status).json({ error: body });
}

module.exports = { apiNotFound, errorHandler };
