'use strict';
const mongoose = require('mongoose');
const { User, Resource, ExchangeRequest, Location, Grievance, ActivityLog } = require('../models');
const { clean, assertObjectId, escapeRegex } = require('../utils/validate');
const { pageParams, paginate } = require('../utils/paginate');
const { notFound, forbidden, conflict, validation } = require('../utils/httpError');
const { logActivity, notify } = require('../utils/activity');
const present = require('../utils/present');
const C = require('../config/constants');
const { POPULATE: RES_POPULATE } = require('./resourceController');
const { POPULATE: REQ_POPULATE } = require('./requestController');

/* ---------------------------- Overview ---------------------------- */

const WEEK_MS = 7 * 24 * 3600 * 1000;
/** Count documents per week (0 = oldest of the window) using a date field. */
function weeklyCounts(model, field, since, extra = {}) {
  return model.aggregate([
    { $match: { ...extra, [field]: { $gte: since } } },
    { $group: { _id: { $floor: { $divide: [{ $subtract: [`$${field}`, since] }, WEEK_MS] } }, n: { $sum: 1 } } },
  ]);
}

exports.stats = async (_req, res) => {
  const weeks = 8;
  const since = new Date(Date.now() - weeks * 7 * 24 * 3600 * 1000);
  const [
    users, students, disabledUsers, activeResources, pendingRequests, completedExchanges,
    pendingLocations, openGrievances, highPriorityOpen, reportedListings, requestsByStatus, resourcesByCategory, wListings, wRequests, wCompleted,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ status: 'disabled' }),
    Resource.countDocuments({ ...Resource.publicFilter(), status: { $in: ['Available', 'Reserved'] } }),
    ExchangeRequest.countDocuments({ status: 'Pending' }),
    ExchangeRequest.countDocuments({ status: 'Completed' }),
    Location.countDocuments({ status: 'Pending' }),
    Grievance.countDocuments({ status: { $in: ['Open', 'In Review'] } }),
    Grievance.countDocuments({ status: { $in: ['Open', 'In Review'] }, priority: 'high' }),
    Resource.countDocuments({ reportCount: { $gt: 0 }, deletedAt: null, 'moderation.state': 'active' }),
    ExchangeRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Resource.aggregate([{ $match: Resource.publicFilter() }, { $group: { _id: '$category', n: { $sum: 1 } } }]),
    weeklyCounts(Resource, 'createdAt', since),
    weeklyCounts(ExchangeRequest, 'createdAt', since),
    weeklyCounts(ExchangeRequest, 'completedAt', since, { status: 'Completed' }),
  ]);

  const weekly8 = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(since.getTime() + i * 7 * 24 * 3600 * 1000), listings: 0, requests: 0, completed: 0,
  }));
  const fill = (rows, key) => rows.forEach((w) => { if (weekly8[w._id]) weekly8[w._id][key] = w.n; });
  fill(wListings, 'listings');
  fill(wRequests, 'requests');
  fill(wCompleted, 'completed');

  res.json({
    totals: { users, students, disabledUsers, activeResources, pendingRequests, completedExchanges, pendingLocations, openGrievances, highPriorityOpen, reportedListings },
    requestsByStatus: Object.fromEntries(requestsByStatus.map((r) => [r._id, r.n])),
    resourcesByCategory: Object.fromEntries(resourcesByCategory.map((r) => [r._id, r.n])),
    weekly: weekly8,
  });
};

/* ---------------------------- Activity ---------------------------- */

exports.activity = async (req, res) => {
  const filter = {};
  const groups = { auth: /^(user\.(registered|login)|admin\.login)/, resource: /^resource\./, request: /^request\./, location: /^location\./, grievance: /^grievance\./, admin: /^admin\./, board: /^board\./, user: /^user\./ };
  if (groups[req.query.group]) filter.action = groups[req.query.group];
  if (req.query.excludeLogins === 'true' && !filter.action) filter.action = { $nin: ['user.login', 'admin.login'] };
  const result = await paginate(ActivityLog, filter, pageParams(req.query, { defaultLimit: 25 }), {
    populate: { path: 'actor', select: 'name role' },
    map: (a) => ({ id: String(a._id), action: a.action, summary: a.summary, targetType: a.targetType, targetId: a.targetId ? String(a.targetId) : null, actor: a.actor ? { name: a.actor.name, role: a.actor.role } : null, actorRole: a.actorRole, details: a.details || null, createdAt: a.createdAt }),
  });
  res.json(result);
};

/* ---------------------------- Users ---------------------------- */

function userRow(u) {
  return { id: String(u._id), name: u.name, email: u.email, role: u.role, status: u.status, statusReason: u.statusReason || '', department: u.department || '', semester: u.semester || null, lastLoginAt: u.lastLoginAt || null, createdAt: u.createdAt, isDemo: !!u.isDemo };
}

exports.users = async (req, res) => {
  const filter = {};
  if (['student', 'admin'].includes(req.query.role)) filter.role = req.query.role;
  if (['active', 'disabled'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 80)), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const result = await paginate(User, filter, pageParams(req.query, { defaultLimit: 20 }), { map: userRow });
  res.json(result);
};

exports.user = async (req, res) => {
  const u = await User.findById(assertObjectId(req.params.id, 'user'));
  if (!u) throw notFound('User');
  const [listings, requestsMade, requestsReceived, completed, grievances, recent] = await Promise.all([
    Resource.countDocuments({ owner: u._id, deletedAt: null }),
    ExchangeRequest.countDocuments({ requester: u._id }),
    ExchangeRequest.countDocuments({ owner: u._id }),
    ExchangeRequest.countDocuments({ $or: [{ owner: u._id }, { requester: u._id }], status: 'Completed' }),
    Grievance.countDocuments({ submittedBy: u._id }),
    ActivityLog.find({ actor: u._id }).sort({ createdAt: -1 }).limit(10).select('summary action createdAt'),
  ]);
  res.json({
    user: userRow(u),
    counts: { listings, requestsMade, requestsReceived, completed, grievances },
    recentActivity: recent.map((a) => ({ summary: a.summary, action: a.action, createdAt: a.createdAt })),
  });
};

/** PATCH /api/admin/users/:id/status  { status: 'active'|'disabled', reason } */
exports.setUserStatus = async (req, res) => {
  const u = await User.findById(assertObjectId(req.params.id, 'user'));
  if (!u) throw notFound('User');
  if (String(u._id) === String(req.user._id)) throw forbidden('You cannot change the status of your own account.');
  if (u.role === 'admin') throw forbidden('Administrator accounts are managed with the create-admin script, not from the dashboard.');
  const data = clean(req.body, {
    status: { label: 'Status', required: true, enum: ['active', 'disabled'] },
    reason: { label: 'Reason', max: 300, multiline: true, allowEmpty: true },
  });
  if (data.status === 'disabled' && !data.reason) throw validation({ reason: 'Give a reason for disabling this account.' });
  if (data.status === u.status) throw conflict(`This account is already ${u.status}.`);
  u.status = data.status;
  u.statusReason = data.reason || '';
  await u.save();
  await logActivity({ action: data.status === 'disabled' ? 'admin.user_disabled' : 'admin.user_enabled', actor: req.user, targetType: 'user', targetId: u._id, summary: `${req.user.name} ${data.status === 'disabled' ? 'disabled' : 're-activated'} the account of ${u.name}`, details: data.reason ? { reason: data.reason } : undefined });
  if (data.status === 'active') await notify(u._id, { type: 'account', title: 'Your account has been re-activated', body: 'You can use EduCycle again.', link: 'account.html' });
  res.json({ user: userRow(u) });
};

exports.admins = async (_req, res) => {
  const admins = await User.find({ role: 'admin', status: 'active' }).sort({ name: 1 }).select('name');
  res.json({ items: admins.map((a) => ({ id: String(a._id), name: a.name })) });
};

/* ---------------------------- Resources ---------------------------- */

exports.resources = async (req, res) => {
  const filter = {};
  if (req.query.deleted !== 'true') filter.deletedAt = null;
  if (C.CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (C.TYPES.includes(req.query.type)) filter.type = req.query.type;
  if (C.RESOURCE_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (C.MODERATION_STATES.includes(req.query.moderation)) filter['moderation.state'] = req.query.moderation;
  if (req.query.reported === 'true') filter.reportCount = { $gt: 0 };
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 80)), 'i');
    const owners = await User.find({ $or: [{ name: rx }, { email: rx }] }).distinct('_id');
    filter.$or = [{ title: rx }, { owner: { $in: owners } }];
  }
  const populate = [{ path: 'owner', select: 'name email status' }, RES_POPULATE[1]];
  const sort = req.query.sort === 'reports' ? { reportCount: -1, createdAt: -1 } : { createdAt: -1 };
  const result = await paginate(Resource, filter, pageParams(req.query, { defaultLimit: 20 }), { sort, populate, map: (r) => present.resource(r, req.user) });
  res.json(result);
};

exports.resource = async (req, res) => {
  const r = await Resource.findById(assertObjectId(req.params.id, 'resource')).populate([{ path: 'owner', select: 'name email status' }, RES_POPULATE[1]]);
  if (!r) throw notFound('Resource');
  const [requests, grievances] = await Promise.all([
    ExchangeRequest.find({ resource: r._id }).sort({ createdAt: -1 }).populate(REQ_POPULATE),
    Grievance.find({ resource: r._id }).sort({ createdAt: -1 }).select('reference subject status category priority createdAt'),
  ]);
  const out = present.resource(r, req.user);
  out.moderation = { state: r.moderation.state, reason: r.moderation.reason, at: r.moderation.at || null };
  res.json({
    resource: out,
    requests: requests.map((q) => present.request(q, req.user)),
    grievances: grievances.map((g) => ({ id: String(g._id), reference: g.reference, subject: g.subject, status: g.status, priority: g.priority, createdAt: g.createdAt })),
  });
};

/** PATCH /api/admin/resources/:id/moderation  { state: 'disabled'|'active', reason } */
exports.moderateResource = async (req, res) => {
  const r = await Resource.findById(assertObjectId(req.params.id, 'resource'));
  if (!r || r.deletedAt) throw notFound('Resource');
  const data = clean(req.body, {
    state: { label: 'State', required: true, enum: C.MODERATION_STATES },
    reason: { label: 'Reason', max: 300, multiline: true, allowEmpty: true },
  });
  if (data.state === 'disabled' && !data.reason) throw validation({ reason: 'Give a reason. The owner will see it.' });
  if (r.moderation.state === data.state) throw conflict(`This listing is already ${data.state === 'active' ? 'active' : 'disabled'}.`);

  r.moderation = { state: data.state, reason: data.reason || '', by: req.user._id, at: new Date() };
  if (data.state === 'active') r.reportCount = 0; // reviewed and restored
  await r.save();

  let cancelled = 0;
  if (data.state === 'disabled') {
    const open = await ExchangeRequest.find({ resource: r._id, status: { $in: ['Pending', 'Accepted'] } });
    for (const q of open) {
      q.status = 'Cancelled';
      q.history.push({ status: 'Cancelled', by: req.user._id, note: 'Listing disabled by an administrator' });
      await q.save();
      cancelled += 1;
      await notify(q.requester, { type: 'request', title: `Request cancelled: ${q.resourceTitle}`, body: 'This listing was disabled by an administrator.', link: 'activity.html?tab=history' });
    }
    if (r.status === 'Reserved') { r.status = 'Available'; await r.save(); }
  }
  await notify(r.owner, {
    type: 'resource',
    title: data.state === 'disabled' ? `Listing disabled: ${r.title}` : `Listing restored: ${r.title}`,
    body: data.state === 'disabled' ? `An administrator disabled this listing. Reason: ${data.reason}` : 'Your listing is visible in Browse again.',
    link: 'my-listings.html',
  });
  await logActivity({ action: data.state === 'disabled' ? 'admin.resource_disabled' : 'admin.resource_restored', actor: req.user, targetType: 'resource', targetId: r._id, visibleTo: [r.owner], summary: `${req.user.name} ${data.state === 'disabled' ? 'disabled' : 'restored'} the listing "${r.title}"`, details: { reason: data.reason || undefined, cancelledRequests: cancelled } });
  await r.populate([{ path: 'owner', select: 'name email status' }, RES_POPULATE[1]]);
  res.json({ resource: present.resource(r, req.user), cancelledRequests: cancelled });
};

/* ---------------------------- Requests ---------------------------- */

exports.requests = async (req, res) => {
  const filter = {};
  if (C.REQUEST_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (C.TYPES.includes(req.query.type)) filter.resourceType = req.query.type;
  if (req.query.resource && mongoose.isValidObjectId(req.query.resource)) filter.resource = req.query.resource;
  if (req.query.q) filter.resourceTitle = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 80)), 'i');
  const range = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) range.$gte = new Date(`${req.query.from}T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) range.$lte = new Date(`${req.query.to}T23:59:59.999`);
  if (Object.keys(range).length) filter.createdAt = range;
  const result = await paginate(ExchangeRequest, filter, pageParams(req.query, { defaultLimit: 20 }), {
    sort: { createdAt: -1 },
    populate: [REQ_POPULATE[0], { path: 'requester', select: 'name email' }, { path: 'owner', select: 'name email' }, REQ_POPULATE[3], REQ_POPULATE[4]],
    map: (q) => present.request(q, req.user),
  });
  const counts = await ExchangeRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  result.statusCounts = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  res.json(result);
};

