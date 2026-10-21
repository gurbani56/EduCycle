'use strict';
const mongoose = require('mongoose');
const { jsonPlugin } = require('./plugins');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true }, // request | location | grievance | board | account
  title: { type: String, required: true, maxlength: 140 },
  body: { type: String, maxlength: 400, default: '' },
  link: { type: String, maxlength: 200, default: '' },
  read: { type: Boolean, default: false, index: true },
  readAt: Date,
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.plugin(jsonPlugin);

module.exports = mongoose.model('Notification', notificationSchema);
