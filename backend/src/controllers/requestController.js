'use strict';
const { ExchangeRequest, Resource, Location } = require('../models');
const { clean, assertObjectId } = require('../utils/validate');
const { notFound, forbidden, conflict, validation, badRequest } = require('../utils/httpError');
const { logActivity, notify } = require('../utils/activity');
const present = require('../utils/present');
const C = require('../config/constants');

const POPULATE = [
  { path: 'resource', select: 'title type category deletedAt status' },
  { path: 'requester', select: 'name' },
  { path: 'owner', select: 'name' },
  { path: 'location', select: 'name area description status active' },
  { path: 'history.by', select: 'name' },
];

/*
 * Exchange workflow (unchanged from the prototype, with Cancelled added):
 *
 *   Pending ──accept──▶ Accepted ──handover──▶ Handed Over ──complete──▶ Completed
 *      │                   │
 *      ├─decline─▶ Declined └─cancel─▶ Cancelled
 *      └─cancel──▶ Cancelled
 *
 * Donate / Exchange: the requester confirms receipt to complete.
 * Lend: the owner confirms the item was returned to complete, and the listing becomes Available again.
 */

async function usableLocationOrThrow(locationId, field = 'location') {
  const loc = await Location.findById(locationId);
  if (!loc || loc.status !== 'Approved' || !loc.active) {
    throw validation({ [field]: 'Choose a pickup location from the approved list.' });
  }
  return loc;
}

/** POST /api/requests */
exports.create = async (req, res) => {
  const data = clean(req.body, {
    resourceId: { type: 'objectId', label: 'Resource', required: true },
    message: { label: 'Message', max: 300, multiline: true, allowEmpty: true },
    offerDetails: { label: 'What you offer in exchange', max: 300, multiline: true, allowEmpty: true },
  });
  const r = await Resource.findById(data.resourceId).populate('location').populate('owner', 'name status');
  if (!r || r.deletedAt || r.moderation.state !== 'active' || r.owner.status !== 'active') throw notFound('Resource');
  if (String(r.owner._id) === String(req.user._id)) throw badRequest('You cannot request your own listing.');
  if (r.status !== 'Available') throw conflict('This resource is not available right now.');
  if (!r.location || !r.location.isUsable()) throw conflict('This listing’s pickup point has not been approved yet, so it cannot be requested.');
  if (r.type === 'Exchange' && !data.offerDetails) throw validation({ offerDetails: 'Describe what you can offer in exchange.' });

  const dup = await ExchangeRequest.exists({ resource: r._id, requester: req.user._id, status: { $in: C.OPEN_REQUEST_STATUSES } });
  if (dup) throw conflict('You already have an open request for this resource. Check Your Activity.');

  const q = await ExchangeRequest.create({
    resource: r._id, requester: req.user._id, owner: r.owner._id,
    resourceTitle: r.title, resourceType: r.type, category: r.category, quantity: r.quantity,
    message: data.message || '', offerDetails: data.offerDetails || '',
    location: r.location._id,
    history: [{ status: 'Pending', by: req.user._id }],
  });
  await logActivity({ action: 'request.created', actor: req.user, targetType: 'request', targetId: q._id, visibleTo: [r.owner._id], summary: `${req.user.name} requested "${r.title}"` });
  await notify(r.owner._id, { type: 'request', title: `New request for ${r.title}`, body: `${req.user.name} would like this resource. Accept or decline it in Your Activity.`, link: 'activity.html?tab=needs' });
  await q.populate(POPULATE);
  res.status(201).json({ request: present.request(q, req.user) });
};

/** GET /api/requests/mine?box=needs|waiting|history|all */
exports.mine = async (req, res) => {
  const me = req.user._id;
  const all = await ExchangeRequest.find({ $or: [{ owner: me }, { requester: me }] }).sort({ updatedAt: -1 }).limit(300).populate(POPULATE);
  const items = all.map((q) => present.request(q, req.user)).map((q) => ({ ...q, bucket: bucketFor(q) }));
  const counts = { needs: 0, waiting: 0, history: 0 };
  items.forEach((i) => { counts[i.bucket] += 1; });
  const box = ['needs', 'waiting', 'history'].includes(req.query.box) ? req.query.box : null;
  res.json({ items: box ? items.filter((i) => i.bucket === box) : items, counts });
};

/** Which tab of Your Activity a request belongs in for the viewer. */
function bucketFor(q) {
  if (['Completed', 'Declined', 'Cancelled'].includes(q.status)) return 'history';
  const lend = q.resourceType === 'Lend';
  if (q.role === 'owner') {
    if (q.status === 'Pending' || q.status === 'Accepted') return 'needs';
    if (q.status === 'Handed Over') return lend ? 'needs' : 'waiting';
  } else {
    if (q.status === 'Handed Over') return lend ? 'waiting' : 'needs';
    return 'waiting';
  }
  return 'waiting';
}

async function loadParticipant(req) {
  const qid = assertObjectId(req.params.id, 'request');
  const q = await ExchangeRequest.findById(qid);
  if (!q) throw notFound('Request');
  const uid = String(req.user._id);
  const isOwner = String(q.owner) === uid;
  const isRequester = String(q.requester) === uid;
  if (!isOwner && !isRequester && req.user.role !== 'admin') throw notFound('Request');
  return { q, isOwner, isRequester };
}

exports.get = async (req, res) => {
  const { q } = await loadParticipant(req);
  await q.populate(POPULATE);
  res.json({ request: present.request(q, req.user) });
};

function assertStatus(q, allowed, action) {
  if (!allowed.includes(q.status)) throw conflict(`This request is ${q.status.toLowerCase()} and cannot be ${action}.`);
}

async function finish(req, res, q, { action, summary, notifyUser, note }) {
  await q.save();
  const counterpart = String(q.owner) === String(req.user._id) ? q.requester : q.owner;
  await logActivity({ action, actor: req.user, targetType: 'request', targetId: q._id, visibleTo: [counterpart], summary });
  if (notifyUser) await notify(counterpart, note);
  await q.populate(POPULATE);
  res.json({ request: present.request(q, req.user) });
}

/** PATCH /api/requests/:id/accept  { locationId?, ownerNote? } */
exports.accept = async (req, res) => {
  const { q, isOwner } = await loadParticipant(req);
  if (!isOwner) throw forbidden('Only the owner can accept a request.');
  assertStatus(q, ['Pending'], 'accepted');
  const data = clean(req.body, {
    locationId: { type: 'objectId', label: 'Pickup location' },
    ownerNote: { label: 'Note', max: 300, multiline: true, allowEmpty: true },
  });
  const r = await Resource.findById(q.resource);
  if (!r || r.deletedAt || r.moderation.state !== 'active') throw conflict('This listing is no longer active.');
  if (r.status !== 'Available') throw conflict('This listing is already reserved or unavailable. Decline this request or make the listing available first.');
  const loc = await usableLocationOrThrow(data.locationId || q.location || r.location, 'locationId');

  q.status = 'Accepted';
  q.location = loc._id;
  q.ownerNote = data.ownerNote || '';
  q.history.push({ status: 'Accepted', by: req.user._id, note: `Meet at ${loc.name}` });
  r.status = 'Reserved';
  await r.save();
  await finish(req, res, q, {
    action: 'request.accepted', summary: `${req.user.name} accepted a request for "${q.resourceTitle}"`, notifyUser: true,
    note: { type: 'request', title: `Request accepted: ${q.resourceTitle}`, body: `Pick-up point: ${loc.name}.${q.ownerNote ? ' Note from owner: ' + q.ownerNote : ''}`, link: 'activity.html?tab=waiting' },
  });
};

/** PATCH /api/requests/:id/decline  { note? } */
exports.decline = async (req, res) => {
  const { q, isOwner } = await loadParticipant(req);
  if (!isOwner) throw forbidden('Only the owner can decline a request.');
  assertStatus(q, ['Pending'], 'declined');
  const data = clean(req.body, { note: { label: 'Reason', max: 300, multiline: true, allowEmpty: true } });
  q.status = 'Declined';
  q.history.push({ status: 'Declined', by: req.user._id, note: data.note || '' });
  await finish(req, res, q, {
    action: 'request.declined', summary: `${req.user.name} declined a request for "${q.resourceTitle}"`, notifyUser: true,
    note: { type: 'request', title: `Request declined: ${q.resourceTitle}`, body: data.note ? `Owner’s note: ${data.note}` : 'The owner could not accept this request.', link: 'activity.html?tab=history' },
  });
};

/** PATCH /api/requests/:id/cancel — requester withdraws (Pending or Accepted). */
exports.cancel = async (req, res) => {
  const { q, isRequester } = await loadParticipant(req);
  if (!isRequester) throw forbidden('Only the student who made the request can cancel it.');
  assertStatus(q, ['Pending', 'Accepted'], 'cancelled');
  const wasAccepted = q.status === 'Accepted';
  q.status = 'Cancelled';
  q.history.push({ status: 'Cancelled', by: req.user._id });
  if (wasAccepted) await Resource.updateOne({ _id: q.resource, status: 'Reserved', deletedAt: null }, { $set: { status: 'Available' } });
  await finish(req, res, q, {
    action: 'request.cancelled', summary: `${req.user.name} cancelled their request for "${q.resourceTitle}"`, notifyUser: true,
    note: { type: 'request', title: `Request cancelled: ${q.resourceTitle}`, body: wasAccepted ? 'The listing is available again.' : 'The student withdrew their request.', link: 'activity.html?tab=history' },
  });
};

/** PATCH /api/requests/:id/location — owner changes the meeting point of an accepted exchange. */
exports.changeLocation = async (req, res) => {
  const { q, isOwner } = await loadParticipant(req);
  if (!isOwner) throw forbidden('Only the owner can change the pickup point.');
  assertStatus(q, ['Accepted'], 'moved');
  const data = clean(req.body, { locationId: { type: 'objectId', label: 'Pickup location', required: true } });
  const loc = await usableLocationOrThrow(data.locationId, 'locationId');
  q.location = loc._id;
  q.history.push({ status: 'Accepted', by: req.user._id, note: `Pick-up point changed to ${loc.name}` });
  await finish(req, res, q, {
    action: 'request.location_changed', summary: `${req.user.name} changed the pickup point for "${q.resourceTitle}" to ${loc.name}`, notifyUser: true,
    note: { type: 'request', title: `New pickup point: ${q.resourceTitle}`, body: `The owner changed the meeting point to ${loc.name}.`, link: 'activity.html?tab=waiting' },
  });
};

/** PATCH /api/requests/:id/handover — owner confirms the item was handed over. */
exports.handover = async (req, res) => {
  const { q, isOwner } = await loadParticipant(req);
  if (!isOwner) throw forbidden('Only the owner can mark the item as handed over.');
  assertStatus(q, ['Accepted'], 'marked as handed over');
  const loc = await Location.findById(q.location);
  if (!loc || !loc.isUsable()) throw conflict('The pickup point for this exchange is no longer approved. Choose a new approved location first.');
  q.status = 'Handed Over';
  q.history.push({ status: 'Handed Over', by: req.user._id });
  const lend = q.resourceType === 'Lend';
  await finish(req, res, q, {
    action: 'request.handed_over', summary: `${req.user.name} handed over "${q.resourceTitle}"`, notifyUser: true,
    note: { type: 'request', title: `Handed over: ${q.resourceTitle}`, body: lend ? 'Return it to the owner when you are done. The owner will confirm the return.' : 'Please confirm you received it to complete the exchange.', link: lend ? 'activity.html?tab=waiting' : 'activity.html?tab=needs' },
  });
};

/** PATCH /api/requests/:id/complete — requester confirms receipt (Donate/Exchange) or owner confirms return (Lend). */
exports.complete = async (req, res) => {
  const { q, isOwner, isRequester } = await loadParticipant(req);
  assertStatus(q, ['Handed Over'], 'completed');
  const lend = q.resourceType === 'Lend';
  if (lend && !isOwner) throw forbidden('For loans, the owner confirms when the item has been returned.');
  if (!lend && !isRequester) throw forbidden('The student who received the item confirms the exchange.');
  q.status = 'Completed';
  q.completedAt = new Date();
  q.history.push({ status: 'Completed', by: req.user._id, note: lend ? 'Item returned to owner' : 'Receipt confirmed' });
  const r = await Resource.findById(q.resource);
  if (r && !r.deletedAt) {
    r.status = lend && r.moderation.state === 'active' ? 'Available' : 'Unavailable';
    await r.save();
  }
  await finish(req, res, q, {
    action: 'request.completed', summary: `Exchange completed for "${q.resourceTitle}"`, notifyUser: true,
    note: { type: 'request', title: `Completed: ${q.resourceTitle}`, body: lend ? 'The owner confirmed the item was returned.' : 'The student confirmed they received the item. Thank you for sharing.', link: 'activity.html?tab=history' },
  });
};

exports.POPULATE = POPULATE;
exports.bucketFor = bucketFor;
