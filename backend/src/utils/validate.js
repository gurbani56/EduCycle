'use strict';
/*
 * Small declarative validator for request bodies and query strings.
 * Each rule describes one field; unknown fields are dropped, so clients cannot
 * smuggle extra properties (such as `role` or `owner`) into a model.
 */
const mongoose = require('mongoose');
const { validation, badRequest } = require('./httpError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(input, rules, { partial = false } = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  const errors = {};

  for (const [field, rule] of Object.entries(rules)) {
    const label = rule.label || field;
    let v = src[field];
    const missing = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

    if (missing) {
      if (partial) continue;
      if (rule.required) { errors[field] = rule.requiredMessage || `${label} is required.`; continue; }
      if (rule.default !== undefined) out[field] = rule.default;
      else if (rule.allowEmpty) out[field] = rule.type === 'objectId' ? null : '';
      continue;
    }

    switch (rule.type || 'string') {
      case 'string': {
        if (typeof v !== 'string' && typeof v !== 'number') { errors[field] = `${label} must be text.`; continue; }
        v = String(v).trim().replace(/\s+\n/g, '\n');
        if (!rule.multiline) v = v.replace(/\s+/g, ' ');
        if (rule.min && v.length < rule.min) { errors[field] = `${label} must be at least ${rule.min} characters.`; continue; }
        if (rule.max && v.length > rule.max) { errors[field] = `${label} must be ${rule.max} characters or fewer.`; continue; }
        if (rule.enum && !rule.enum.includes(v)) { errors[field] = rule.enumMessage || `Choose a valid ${label.toLowerCase()}.`; continue; }
        if (rule.pattern && !rule.pattern.test(v)) { errors[field] = rule.patternMessage || `${label} is not in the expected format.`; continue; }
        break;
      }
      case 'email': {
        v = String(v).trim().toLowerCase();
        if (v.length > 120 || !EMAIL_RE.test(v)) { errors[field] = 'Enter a valid email address.'; continue; }
        break;
      }
      case 'int': {
        const n = Number(v);
        if (!Number.isInteger(n)) { errors[field] = `${label} must be a whole number.`; continue; }
        if (rule.minVal !== undefined && n < rule.minVal) { errors[field] = `${label} must be at least ${rule.minVal}.`; continue; }
        if (rule.maxVal !== undefined && n > rule.maxVal) { errors[field] = `${label} must be ${rule.maxVal} or less.`; continue; }
        v = n;
        break;
      }
      case 'bool': {
        if (v === true || v === 'true' || v === '1' || v === 1) v = true;
        else if (v === false || v === 'false' || v === '0' || v === 0) v = false;
        else { errors[field] = `${label} must be true or false.`; continue; }
        break;
      }
      case 'objectId': {
        if (typeof v !== 'string' || !mongoose.isValidObjectId(v)) { errors[field] = `Choose a valid ${label.toLowerCase()}.`; continue; }
        break;
      }
      default:
        throw new Error(`Unknown rule type ${rule.type}`);
    }
    out[field] = v;
  }

  if (Object.keys(errors).length) throw validation(errors);
  return out;
}

function assertObjectId(id, what = 'record') {
  if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) throw badRequest(`Invalid ${what} ID.`);
  return id;
}

function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 128) return 'Password must be 128 characters or fewer.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must include at least one letter and one number.';
  return null;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { clean, assertObjectId, passwordProblem, escapeRegex, EMAIL_RE };
