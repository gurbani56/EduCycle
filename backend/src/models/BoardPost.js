'use strict';
const mongoose = require('mongoose');
const { jsonPlugin } = require('./plugins');
const C = require('../config/constants');

// "Community Requests": students post what they are looking for.
const boardPostSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
  category: { type: String, enum: C.CATEGORIES, required: true },
  type: { type: String, enum: C.TYPES, required: true },
  duration: { type: String, trim: true, maxlength: 40, default: '' },
  description: { type: String, trim: true, maxlength: 400, default: '' },
  status: { type: String, enum: C.BOARD_STATUSES, default: 'Open', index: true },
  offers: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
    message: { type: String, maxlength: 300 },
    at: { type: Date, default: Date.now },
  }],
  legacyId: { type: Number, index: { unique: true, sparse: true } },
}, { timestamps: true });

boardPostSchema.plugin(jsonPlugin);

module.exports = mongoose.model('BoardPost', boardPostSchema);
