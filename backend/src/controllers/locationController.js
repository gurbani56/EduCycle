'use strict';
const { Location, Resource, ExchangeRequest } = require('../models');
const { clean, assertObjectId, escapeRegex } = require('../utils/validate');
const { pageParams, paginate } = require('../utils/paginate');
const { notFound, conflict, validation } = require('../utils/httpError');
const { logActivity, notify } = require('../utils/activity');

const fieldRules = {
  name: { label: 'Location name', required: true, min: 3, max: 80 },
  area: { label: 'Campus area or address', required: true, min: 3, max: 120 },
  description: { label: 'Description', max: 400, multiline: true, allowEmpty: true },
};

function studentView(l) {
  return {
    id: String(l._id), name: l.name, area: l.area, description: l.description, status: l.status,
    active: l.active, usable: l.status === 'Approved' && l.active,
    rejectionReason: l.status === 'Rejected' ? l.rejectionReason : '', reviewedAt: l.reviewedAt || null,
    createdAt: l.createdAt,
  };
}

/** GET /api/locations — approved, active locations for pickup dropdowns (public). */
exports.approved = async (_req, res) => {
  const items = await Location.find({ status: 'Approved', active: true }).sort({ name: 1 });
  res.json({ items: items.map(studentView) });
};

/** GET /api/locations/mine — the student's own suggestions and their review result. */
exports.mine = async (req, res) => {
  const items = await Location.find({ proposedBy: req.user._id }).sort({ createdAt: -1 });
  res.json({ items: items.map(studentView) });
};

/** POST /api/locations — student suggests a new pickup/drop-off point (starts as Pending). */
exports.suggest = async (req, res) => {
  const data = clean(req.body, fieldRules);
  const nameKey = Location.keyFor(data.name);
  const existing = await Location.findOne({ nameKey });
  if (existing) {
    const msg = existing.status === 'Approved' && existing.active
      ? 'This location is already approved. You can choose it from the list.'
      : existing.status === 'Pending' ? 'This location has already been suggested and is waiting for review.'
      : 'A location with this name was reviewed before and is not available. Please suggest a different spot or give it a more specific name.';
    throw conflict(msg);
  }
  const pendingMine = await Location.countDocuments({ proposedBy: req.user._id, status: 'Pending' });
  if (pendingMine >= 5) throw conflict('You already have 5 suggestions waiting for review. Please wait for an administrator to review them.');

  const l = await Location.create({
    ...data, nameKey, status: 'Pending', source: 'student', proposedBy: req.user._id,
    history: [{ action: 'submitted', by: req.user._id }],
  });
  await logActivity({ action: 'location.suggested', actor: req.user, targetType: 'location', targetId: l._id, summary: `${req.user.name} suggested a new pickup point: ${l.name}` });
  res.status(201).json({ location: studentView(l) });
};

/* ---------------------------- Admin ---------------------------- */

const ADMIN_POPULATE = [
  { path: 'proposedBy', select: 'name email' },
  { path: 'reviewedBy', select: 'name' },
  { path: 'history.by', select: 'name' },
];

function adminView(l, usage) {
  return {
    ...studentView(l),
    rejectionReason: l.rejectionReason || '',
    source: l.source,
    proposedBy: l.proposedBy ? { id: String(l.proposedBy._id), name: l.proposedBy.name, email: l.proposedBy.email } : null,
    reviewedBy: l.reviewedBy ? { id: String(l.reviewedBy._id), name: l.reviewedBy.name } : null,
    history: (l.history || []).map((h) => ({ action: h.action, note: h.note || '', at: h.at, by: h.by && h.by.name ? h.by.name : (h.action === 'imported' ? 'Migration script' : '') })),
    usage,
    updatedAt: l.updatedAt,
  };
}

async function usageFor(id) {
  const [listings, activeExchanges] = await Promise.all([
    Resource.countDocuments({ location: id, deletedAt: null }),
    ExchangeRequest.countDocuments({ location: id, status: { $in: ['Accepted', 'Handed Over'] } }),
  ]);
  return { listings, activeExchanges };
}

exports.adminList = async (req, res) => {
  const filter = {};
  if (['Pending', 'Approved', 'Rejected'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i');
    filter.$or = [{ name: rx }, { area: rx }];
  }
  const result = await paginate(Location, filter, pageParams(req.query, { defaultLimit: 20 }), {
    sort: { status: -1, createdAt: -1 }, populate: ADMIN_POPULATE,
  });
  result.items = await Promise.all(result.items.map(async (l) => adminView(l, await usageFor(l._id))));
  const counts = await Location.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  result.statusCounts = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  res.json(result);
};

async function loadAdmin(req) {
  const l = await Location.findById(assertObjectId(req.params.id, 'location'));
  if (!l) throw notFound('Location');
  return l;
}

async function respond(res, l) {
  await l.populate(ADMIN_POPULATE);
  res.json({ location: adminView(l, await usageFor(l._id)) });
}

exports.adminGet = async (req, res) => respond(res, await loadAdmin(req));

/** POST /api/admin/locations — an admin adds a location directly (approved immediately). */
exports.adminCreate = async (req, res) => {
  const data = clean(req.body, fieldRules);
  const nameKey = Location.keyFor(data.name);
  if (await Location.exists({ nameKey })) throw conflict('A location with this name already exists.');
  const l = await Location.create({
    ...data, nameKey, status: 'Approved', source: 'admin', proposedBy: req.user._id,
    reviewedBy: req.user._id, reviewedAt: new Date(),
    history: [{ action: 'submitted', by: req.user._id, note: 'Added by administrator' }, { action: 'approved', by: req.user._id }],
  });
  await logActivity({ action: 'location.created', actor: req.user, targetType: 'location', targetId: l._id, summary: `${req.user.name} added the pickup point ${l.name}` });
  res.status(201);
  await respond(res, l);
};

exports.approve = async (req, res) => {
  const l = await loadAdmin(req);
  if (l.status === 'Approved') throw conflict('This location is already approved.');
  l.status = 'Approved';
  l.active = true;
  l.rejectionReason = '';
  l.reviewedBy = req.user._id;
  l.reviewedAt = new Date();
  l.history.push({ action: 'approved', by: req.user._id });
  await l.save();
  await logActivity({ action: 'location.approved', actor: req.user, targetType: 'location', targetId: l._id, visibleTo: [l.proposedBy], summary: `${req.user.name} approved the pickup point ${l.name}` });
  if (l.proposedBy && String(l.proposedBy) !== String(req.user._id)) {
    await notify(l.proposedBy, { type: 'location', title: `Location approved: ${l.name}`, body: 'Students can now choose it as a pickup or drop-off point.', link: 'locations.html' });
  }
  await respond(res, l);
};

exports.reject = async (req, res) => {
  const l = await loadAdmin(req);
  const data = clean(req.body, { reason: { label: 'Reason', required: true, min: 5, max: 300, multiline: true, requiredMessage: 'Give the student a reason for the rejection.' } });
  if (l.status === 'Rejected') throw conflict('This location is already rejected.');
  const usage = await usageFor(l._id);
  l.status = 'Rejected';
  l.rejectionReason = data.reason;
  l.reviewedBy = req.user._id;
  l.reviewedAt = new Date();
  l.history.push({ action: 'rejected', by: req.user._id, note: data.reason });
  await l.save();
  await logActivity({ action: 'location.rejected', actor: req.user, targetType: 'location', targetId: l._id, visibleTo: [l.proposedBy], summary: `${req.user.name} rejected the pickup point ${l.name}`, details: { reason: data.reason, affectedListings: usage.listings } });
  if (l.proposedBy && String(l.proposedBy) !== String(req.user._id)) {
    await notify(l.proposedBy, { type: 'location', title: `Location not approved: ${l.name}`, body: `Reason: ${data.reason}`, link: 'locations.html' });
  }
  await respond(res, l);
};

/** PATCH /api/admin/locations/:id — edit details or enable/disable an approved location. */
exports.adminUpdate = async (req, res) => {
  const l = await loadAdmin(req);
  const data = clean(req.body, { ...fieldRules, active: { type: 'bool', label: 'Active' } }, { partial: true });
  if (data.name) {
    const nameKey = Location.keyFor(data.name);
    if (nameKey !== l.nameKey && await Location.exists({ nameKey })) throw conflict('A location with this name already exists.');
    l.nameKey = nameKey;
  }
  if (data.active !== undefined && l.status !== 'Approved') throw validation({ active: 'Only approved locations can be enabled or disabled.' });
  const toggled = data.active !== undefined && data.active !== l.active;
  const edited = ['name', 'area', 'description'].some((k) => data[k] !== undefined && data[k] !== l[k]);
  Object.assign(l, data);
  if (edited) l.history.push({ action: 'edited', by: req.user._id });
  if (toggled) l.history.push({ action: l.active ? 'enabled' : 'disabled', by: req.user._id });
  await l.save();
  if (toggled || edited) {
    await logActivity({
      action: toggled ? (l.active ? 'location.enabled' : 'location.disabled') : 'location.edited',
      actor: req.user, targetType: 'location', targetId: l._id,
      summary: `${req.user.name} ${toggled ? (l.active ? 're-enabled' : 'disabled') : 'edited'} the pickup point ${l.name}`,
    });
  }
  if (toggled && !l.active) {
    // Tell owners of accepted exchanges at this point that they need to choose another one.
    const affected = await ExchangeRequest.find({ location: l._id, status: 'Accepted' }).select('owner requester resourceTitle');
    for (const q of affected) {
      for (const uid of [q.owner, q.requester]) {
        await notify(uid, { type: 'location', title: `Pickup point unavailable: ${l.name}`, body: `The meeting point for "${q.resourceTitle}" has been disabled. The owner needs to choose another approved location.`, link: 'activity.html' });
      }
    }
  }
  await respond(res, l);
};

exports.studentView = studentView;
