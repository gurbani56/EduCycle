'use strict';
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { clean, passwordProblem } = require('../utils/validate');
const { HttpError, validation, conflict } = require('../utils/httpError');
const { ensureToken } = require('../middleware/csrf');
const { logActivity } = require('../utils/activity');
const C = require('../config/constants');

// Compared against when the email does not exist, so response time does not reveal registered emails.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-0', 10);

function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = String(user._id);
      req.session.role = user.role;
      ensureToken(req);
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}

function selfView(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department || '',
    semester: user.semester || null,
    createdAt: user.createdAt,
  };
}

exports.csrf = (req, res) => {
  res.json({ csrfToken: ensureToken(req) });
};

exports.me = (req, res) => {
  res.json({ user: selfView(req.user), csrfToken: ensureToken(req) });
};

const registerRules = {
  name: { label: 'Full name', required: true, min: 2, max: 80, pattern: /^[\p{L}][\p{L} .'-]*$/u, patternMessage: 'Use letters, spaces, apostrophes or hyphens only.' },
  email: { type: 'email', label: 'Email', required: true },
  password: { label: 'Password', required: true, max: 128 },
  department: { label: 'Department', required: true, enum: C.DEPARTMENTS },
  semester: { type: 'int', label: 'Semester', required: true, minVal: 1, maxVal: 8 },
};

exports.register = async (req, res) => {
  // Raw password is validated separately so whitespace is preserved.
  const raw = req.body || {};
  const data = clean({ ...raw, password: 'placeholder' }, registerRules);
  const pwProblem = passwordProblem(raw.password);
  if (pwProblem) throw validation({ password: pwProblem });

  if (await User.exists({ email: data.email })) {
    throw conflict('An account with this email already exists. Try logging in instead.');
  }
  const user = new User({ name: data.name, email: data.email, department: data.department, semester: data.semester, role: 'student' });
  await user.setPassword(raw.password);
  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000) throw conflict('An account with this email already exists. Try logging in instead.');
    throw err;
  }
  await startSession(req, user);
  await logActivity({ action: 'user.registered', actor: user, targetType: 'user', targetId: user._id, summary: `${user.name} created a student account` });
  res.status(201).json({ user: selfView(user), csrfToken: req.session.csrfToken });
};

async function authenticate(req, expectedRole) {
  const { email, password } = req.body || {};
  const fields = {};
  if (!email || typeof email !== 'string') fields.email = 'Enter your email address.';
  if (!password || typeof password !== 'string') fields.password = 'Enter your password.';
  if (Object.keys(fields).length) throw validation(fields);

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'The email or password is incorrect.', 'INVALID_CREDENTIALS');

  if (user.role !== expectedRole) {
    throw expectedRole === 'admin'
      ? new HttpError(403, 'This account does not have administrator access.', 'NOT_ADMIN')
      : new HttpError(403, 'Administrator accounts sign in on the admin login page.', 'USE_ADMIN_LOGIN');
  }
  if (user.status !== 'active') {
    throw new HttpError(403, 'This account has been disabled. Contact the EduCycle administrators if you think this is a mistake.', 'ACCOUNT_DISABLED');
  }
  user.lastLoginAt = new Date();
  await user.save();
  await startSession(req, user);
  await logActivity({
    action: expectedRole === 'admin' ? 'admin.login' : 'user.login',
    actor: user, targetType: 'user', targetId: user._id,
    summary: `${user.name} signed in${expectedRole === 'admin' ? ' to the admin dashboard' : ''}`,
  });
  return user;
}

exports.login = async (req, res) => {
  const user = await authenticate(req, 'student');
  res.json({ user: selfView(user), csrfToken: req.session.csrfToken });
};

exports.adminLogin = async (req, res) => {
  const user = await authenticate(req, 'admin');
  res.json({ user: selfView(user), csrfToken: req.session.csrfToken });
};

exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('educycle.sid');
    res.json({ ok: true });
  });
};

exports.updateProfile = async (req, res) => {
  const data = clean(req.body, {
    name: registerRules.name,
    department: { ...registerRules.department, required: false },
    semester: { ...registerRules.semester, required: false },
  }, { partial: true });
  Object.assign(req.user, data);
  await req.user.save();
  res.json({ user: selfView(req.user) });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!currentPassword || !(await user.checkPassword(String(currentPassword)))) {
    throw validation({ currentPassword: 'Your current password is incorrect.' });
  }
  const problem = passwordProblem(newPassword);
  if (problem) throw validation({ newPassword: problem });
  await user.setPassword(newPassword);
  await user.save();
  await startSession(req, user); // rotate the session after a credential change
  await logActivity({ action: 'user.password_changed', actor: user, targetType: 'user', targetId: user._id, summary: `${user.name} changed their password` });
  res.json({ ok: true, csrfToken: req.session.csrfToken });
};

exports.selfView = selfView;
