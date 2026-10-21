'use strict';
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { jsonPlugin } = require('./plugins');
const { DEPARTMENTS } = require('../config/constants');

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'admin'], default: 'student', index: true },
  status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
  department: { type: String, enum: DEPARTMENTS.concat(['']), default: '' },
  semester: { type: Number, min: 1, max: 8 },
  lastLoginAt: Date,
  statusReason: { type: String, maxlength: 300 },
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.index({ name: 'text', email: 'text' });
userSchema.plugin(jsonPlugin, { hidden: ['passwordHash'] });

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, BCRYPT_ROUNDS);
};
userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash || '');
};

/** Minimal public shape used when a user appears next to someone else's data. */
userSchema.methods.publicProfile = function publicProfile() {
  return { id: String(this._id), name: this.name, department: this.department || '' };
};

module.exports = mongoose.model('User', userSchema);
module.exports.BCRYPT_ROUNDS = BCRYPT_ROUNDS;
