'use strict';
const { Resource, Location, ExchangeRequest, User } = require('../models');
const { clean, assertObjectId, escapeRegex } = require('../utils/validate');
const { pageParams, paginate } = require('../utils/paginate');
const { notFound, forbidden, conflict, validation } = require('../utils/httpError');
const { logActivity, notify } = require('../utils/activity');
const present = require('../utils/present');
const C = require('../config/constants');

const POPULATE = [
  { path: 'owner', select: 'name status' },
  { path: 'location', select: 'name area description status active' },
];

const resourceRules = {
  title: { label: 'Title', required: true, min: 3, max: 80 },
  description: { label: 'Description', required: true, min: 10, max: 600, multiline: true },
  category: { label: 'Category', required: true, enum: C.CATEGORIES },
  type: { label: 'Listing type', required: true, enum: C.TYPES, enumMessage: 'Choose Donate, Lend or Exchange.' },
  condition: { label: 'Condition', required: true, enum: C.CONDITIONS },
  department: { label: 'Department', enum: C.DEPARTMENTS, default: 'All Departments' },
  semester: { type: 'int', label: 'Semester', minVal: 1, maxVal: 8 },
  quantity: { type: 'int', label: 'Quantity', minVal: 1, maxVal: 20, default: 1 },
  location: { type: 'objectId', label: 'Pickup location', required: true, requiredMessage: 'Choose an approved pickup location.' },
};

async function disabledOwnerIds() {
  const ids = await User.find({ status: 'disabled' }).distinct('_id');
  return ids;
}

async function requireUsableLocation(locationId) {
  const loc = await Location.findById(locationId);
  if (!loc || !loc.isUsable()) {
    throw validation({ location: 'Choose a location from the approved list. Suggested locations can be used once an administrator approves them.' });
  }
  return loc;
}

/** GET /api/resources — public browse with search, filters, sorting and pagination. */
exports.list = async (req, res) => {
  const q = req.query;
  const filter = Resource.publicFilter();
  const blocked = await disabledOwnerIds();
  if (blocked.length) filter.owner = { $nin: blocked };

  if (q.category && C.CATEGORIES.includes(q.category)) filter.category = q.category;
  if (q.type && C.TYPES.includes(q.type)) filter.type = q.type;
  if (q.condition && C.CONDITIONS.includes(q.condition)) filter.condition = q.condition;
  if (q.department && C.DEPARTMENTS.includes(q.department)) filter.department = q.department;
  if (q.semester && /^[1-8]$/.test(q.semester)) filter.semester = Number(q.semester);
  if (q.availability !== 'all') filter.status = 'Available';
  if (q.location && /^[a-f\d]{24}$/i.test(q.location)) filter.location = q.location;
  if (q.q && String(q.q).trim()) {
    const rx = new RegExp(escapeRegex(String(q.q).trim().slice(0, 80)), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { category: rx }];
  }
  const sorts = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, title: { title: 1 } };
  const sort = sorts[q.sort] || sorts.newest;

  const result = await paginate(Resource, filter, pageParams(q, { defaultLimit: 12, maxLimit: 48 }), {
    sort, populate: POPULATE, map: (r) => present.resource(r, req.user),
  });

  // Facet counts for the type tabs (same filters minus type).
  const facetFilter = { ...filter };
  delete facetFilter.type;
  const typeCounts = await Resource.aggregate([{ $match: castForAggregate(facetFilter) }, { $group: { _id: '$type', n: { $sum: 1 } } }]);
  result.typeCounts = Object.fromEntries(typeCounts.map((t) => [t._id, t.n]));
  res.json(result);
};

// Aggregation pipelines do not cast strings to ObjectIds automatically.
function castForAggregate(filter) {
  const mongoose = require('mongoose');
  const f = { ...filter };
  if (typeof f.location === 'string') f.location = new mongoose.Types.ObjectId(f.location);
  return f;
}

/** GET /api/resources/featured — a few available, requestable listings for the homepage. */
exports.featured = async (req, res) => {
  const blocked = await disabledOwnerIds();
  const filter = { ...Resource.publicFilter(), status: 'Available' };
  if (blocked.length) filter.owner = { $nin: blocked };
  const docs = await Resource.find(filter).sort({ createdAt: -1 }).limit(24).populate(POPULATE);
  const items = docs.map((r) => present.resource(r, req.user));
  // Prefer listings that can actually be requested right now.
  items.sort((a, b) => Number(b.requestable) - Number(a.requestable));
  res.json({ items: items.slice(0, Math.min(parseInt(req.query.limit, 10) || 6, 12)) });
};

/** GET /api/resources/mine */
exports.mine = async (req, res) => {
  const filter = { owner: req.user._id, deletedAt: null };
  if (req.query.status && C.RESOURCE_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const docs = await Resource.find(filter).sort({ createdAt: -1 }).populate(POPULATE);
  const counts = await Resource.aggregate([{ $match: { owner: req.user._id, deletedAt: null } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const openCounts = await ExchangeRequest.aggregate([
    { $match: { owner: req.user._id, status: { $in: C.OPEN_REQUEST_STATUSES } } },
    { $group: { _id: '$resource', n: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } } } },
  ]);
  const byRes = Object.fromEntries(openCounts.map((o) => [String(o._id), o]));
  res.json({
    items: docs.map((r) => ({ ...present.resource(r, req.user), openRequests: byRes[String(r._id)] ? byRes[String(r._id)].n : 0, pendingRequests: byRes[String(r._id)] ? byRes[String(r._id)].pending : 0 })),
    statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
  });
};

async function loadVisible(req) {
  const rid = assertObjectId(req.params.id, 'resource');
  const r = await Resource.findById(rid).populate(POPULATE);
  if (!r) throw notFound('Resource');
  const isOwner = req.user && String(r.owner._id || r.owner) === String(req.user._id);
  const isAdmin = req.user && req.user.role === 'admin';
  const hidden = r.deletedAt || r.moderation.state !== 'active' || (r.owner && r.owner.status === 'disabled');
  if (hidden && !isOwner && !isAdmin) throw notFound('Resource');
  return r;
}

/** GET /api/resources/:id */
exports.get = async (req, res) => {
  const r = await loadVisible(req);
  const out = present.resource(r, req.user);
  if (req.user && !out.isOwner) {
    const mine = await ExchangeRequest.findOne({ resource: r._id, requester: req.user._id, status: { $in: C.OPEN_REQUEST_STATUSES } });
    out.myOpenRequest = mine ? { id: String(mine._id), status: mine.status } : null;
  }
  if (out.isOwner) {
    out.pendingRequests = await ExchangeRequest.countDocuments({ resource: r._id, status: 'Pending' });
  }
  res.json({ resource: out });
};

/** POST /api/resources (JSON body) */
exports.create = async (req, res) => {
  const data = clean(req.body, resourceRules);
  await requireUsableLocation(data.location);
  const r = await Resource.create({ ...data, owner: req.user._id });
  await r.populate(POPULATE);
  await logActivity({ action: 'resource.created', actor: req.user, targetType: 'resource', targetId: r._id, summary: `${req.user.name} listed "${r.title}" (${r.type})` });
  res.status(201).json({ resource: present.resource(r, req.user) });
};

async function loadOwned(req) {
  const rid = assertObjectId(req.params.id, 'resource');
  const r = await Resource.findById(rid);
  if (!r || r.deletedAt) throw notFound('Resource');
  if (String(r.owner) !== String(req.user._id)) throw forbidden('You can only change your own listings.');
  return r;
}

/** PATCH /api/resources/:id (JSON body) — owner edits details or availability. */
exports.update = async (req, res) => {
  const r = await loadOwned(req);
  const data = clean(req.body, {
    ...resourceRules,
    status: { label: 'Availability', enum: ['Available', 'Unavailable'], enumMessage: 'Choose Available or Unavailable.' },
  }, { partial: true });

  if (data.location && String(data.location) !== String(r.location)) await requireUsableLocation(data.location);

  if (data.status && data.status !== r.status) {
    const active = await ExchangeRequest.exists({ resource: r._id, status: { $in: ['Accepted', 'Handed Over'] } });
    if (active) throw conflict('This listing has an accepted exchange in progress. Finish or cancel that exchange before changing availability.');
  }

  const prevStatus = r.status;
  Object.assign(r, data);
  await r.save();

  await logActivity({
    action: prevStatus !== r.status ? 'resource.status_changed' : 'resource.updated',
    actor: req.user, targetType: 'resource', targetId: r._id,
    summary: prevStatus !== r.status ? `${req.user.name} marked "${r.title}" as ${r.status}` : `${req.user.name} updated "${r.title}"`,
  });
  await r.populate(POPULATE);
  res.json({ resource: present.resource(r, req.user) });
};

/** DELETE /api/resources/:id — soft delete so exchange history remains readable. */
exports.remove = async (req, res) => {
  const r = await loadOwned(req);
  const active = await ExchangeRequest.exists({ resource: r._id, status: { $in: ['Accepted', 'Handed Over'] } });
  if (active) throw conflict('This listing has an accepted exchange in progress. Finish or cancel it before deleting the listing.');

  const pending = await ExchangeRequest.find({ resource: r._id, status: 'Pending' });
  for (const p of pending) {
    p.status = 'Cancelled';
    p.history.push({ status: 'Cancelled', by: req.user._id, note: 'Listing deleted by owner' });
    await p.save();
    await notify(p.requester, { type: 'request', title: `Request cancelled: ${r.title}`, body: 'The owner removed this listing, so your request was cancelled.', link: 'activity.html?tab=history' });
  }
  r.deletedAt = new Date();
  r.status = 'Unavailable';
  await r.save();
  await logActivity({ action: 'resource.deleted', actor: req.user, targetType: 'resource', targetId: r._id, summary: `${req.user.name} deleted the listing "${r.title}"` });
  res.json({ ok: true });
};

/** GET /api/stats — public figures for the homepage, all computed from the database. */
exports.publicStats = async (_req, res) => {
  const [available, completed, sharers, locations] = await Promise.all([
    Resource.countDocuments({ ...Resource.publicFilter(), status: 'Available' }),
    ExchangeRequest.countDocuments({ status: 'Completed' }),
    Resource.distinct('owner', Resource.publicFilter()),
    Location.countDocuments({ status: 'Approved', active: true }),
  ]);
  const categories = await Resource.aggregate([
    { $match: { ...Resource.publicFilter(), status: 'Available' } },
    { $group: { _id: '$category', n: { $sum: 1 } } },
  ]);
  res.json({
    availableResources: available,
    completedExchanges: completed,
    studentsSharing: sharers.length,
    approvedLocations: locations,
    categoryCounts: Object.fromEntries(categories.map((c) => [c._id, c.n])),
  });
};

exports.POPULATE = POPULATE;
