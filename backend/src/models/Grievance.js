'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');
const { jsonPlugin } = require('./plugins');
const { GRIEVANCE_STATUSES, GRIEVANCE_CATEGORIES } = require('../config/constants');

const historySchema = new mongoose.Schema({
  status: { type: String, enum: GRIEVANCE_STATUSES },
  response: { type: String, maxlength: 1500 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now },
}, { _id: false });

const grievanceSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, enum: GRIEVANCE_CATEGORIES.map((c) => c.key), required: true, index: true },
  subject: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
  description: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
  resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'ExchangeRequest' },
  priority: { type: String, enum: ['normal', 'high'], default: 'normal', index: true },
  status: { type: String, enum: GRIEVANCE_STATUSES, default: 'Open', index: true },
  adminResponse: { type: String, trim: true, maxlength: 1500, default: '' },
  respondedAt: Date,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
  history: [historySchema],
}, { timestamps: true });

grievanceSchema.index({ subject: 'text', reference: 'text' });
grievanceSchema.plugin(jsonPlugin);

/** Human-friendly unique reference, e.g. GRV-2026-7KQ4M2. */
grievanceSchema.statics.newReference = function newReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return `GRV-${new Date().getFullYear()}-${code}`;
};

module.exports = mongoose.model('Grievance', grievanceSchema);
