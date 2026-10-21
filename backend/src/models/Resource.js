'use strict';
const mongoose = require('mongoose');
const { jsonPlugin } = require('./plugins');
const C = require('../config/constants');

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 600 },
  category: { type: String, enum: C.CATEGORIES, required: true, index: true },
  type: { type: String, enum: C.TYPES, required: true, index: true },
  condition: { type: String, enum: C.CONDITIONS, required: true },
  department: { type: String, enum: C.DEPARTMENTS, default: 'All Departments' },
  semester: { type: Number, min: 1, max: 8 },
  quantity: { type: Number, min: 1, max: 20, default: 1 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
  status: { type: String, enum: C.RESOURCE_STATUSES, default: 'Available', index: true },

  // Admin moderation is kept separate from the owner's availability status.
  moderation: {
    state: { type: String, enum: C.MODERATION_STATES, default: 'active', index: true },
    reason: { type: String, maxlength: 300, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: Date,
  },
  reportCount: { type: Number, default: 0, min: 0 },
  deletedAt: Date, // soft delete by owner keeps request history intact
  legacyId: { type: Number, index: { unique: true, sparse: true } },
}, { timestamps: true });

resourceSchema.index({ title: 'text', description: 'text' });
resourceSchema.index({ status: 1, 'moderation.state': 1, createdAt: -1 });
resourceSchema.plugin(jsonPlugin);

/** Listings that students should be able to see in Browse. */
resourceSchema.statics.publicFilter = () => ({ 'moderation.state': 'active', deletedAt: null });

module.exports = mongoose.model('Resource', resourceSchema);
