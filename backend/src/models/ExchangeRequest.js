'use strict';
const mongoose = require('mongoose');
const { jsonPlugin } = require('./plugins');
const { REQUEST_STATUSES } = require('../config/constants');

const historySchema = new mongoose.Schema({
  status: { type: String, enum: REQUEST_STATUSES, required: true },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String, maxlength: 300 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const requestSchema = new mongoose.Schema({
  resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Snapshot of the listing at request time so history stays readable if the listing is deleted.
  resourceTitle: { type: String, required: true },
  resourceType: { type: String, required: true },
  category: { type: String },
  quantity: { type: Number, min: 1, default: 1 },
  message: { type: String, trim: true, maxlength: 300, default: '' },
  offerDetails: { type: String, trim: true, maxlength: 300, default: '' }, // what is offered in an exchange
  status: { type: String, enum: REQUEST_STATUSES, default: 'Pending', index: true },
  // Agreed meeting point. Must be an approved location while the exchange is active.
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  ownerNote: { type: String, trim: true, maxlength: 300, default: '' }, // e.g. preferred time
  history: [historySchema],
  completedAt: Date,
  legacyId: { type: Number, index: { unique: true, sparse: true } },
}, { timestamps: true });

requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.plugin(jsonPlugin);

module.exports = mongoose.model('ExchangeRequest', requestSchema);
