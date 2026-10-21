'use strict';
const mongoose = require('mongoose');
const { jsonPlugin } = require('./plugins');

const activitySchema = new mongoose.Schema({
  action: { type: String, required: true, index: true }, // e.g. resource.created, request.accepted
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorRole: { type: String, enum: ['student', 'admin', 'system'], default: 'system' },
  targetType: { type: String, enum: ['user', 'resource', 'request', 'location', 'grievance', 'board', 'system'], default: 'system' },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  // Users who may see this entry in their own activity history (actor + counterpart).
  visibleTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  summary: { type: String, required: true, maxlength: 300 },
  details: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: { createdAt: true, updatedAt: false } });

activitySchema.index({ createdAt: -1 });
activitySchema.index({ visibleTo: 1, createdAt: -1 });
activitySchema.plugin(jsonPlugin);

module.exports = mongoose.model('ActivityLog', activitySchema);
