'use strict';
const mongoose = require('mongoose');
const { jsonPlugin } = require('./plugins');
const { LOCATION_STATUSES } = require('../config/constants');

const historySchema = new mongoose.Schema({
  action: { type: String, required: true }, // submitted | approved | rejected | edited | disabled | enabled | imported
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String, maxlength: 300 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
  nameKey: { type: String, required: true, unique: true }, // lower-cased name, prevents duplicates
  area: { type: String, trim: true, maxlength: 120, default: '' }, // campus area / building / address
  description: { type: String, trim: true, maxlength: 400, default: '' },
  status: { type: String, enum: LOCATION_STATUSES, default: 'Pending', index: true },
  active: { type: Boolean, default: true }, // admins can disable an approved location
  source: { type: String, enum: ['student', 'admin', 'migration'], default: 'student' },
  proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  rejectionReason: { type: String, trim: true, maxlength: 300, default: '' },
  history: [historySchema],
}, { timestamps: true });

locationSchema.plugin(jsonPlugin);

locationSchema.statics.keyFor = (name) => String(name).trim().toLowerCase().replace(/\s+/g, ' ');

/** True when the location can be used for a live pickup / drop-off. */
locationSchema.methods.isUsable = function isUsable() {
  return this.status === 'Approved' && this.active;
};

module.exports = mongoose.model('Location', locationSchema);
