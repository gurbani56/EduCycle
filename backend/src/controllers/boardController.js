'use strict';
const { BoardPost, Resource } = require('../models');
const { clean, assertObjectId } = require('../utils/validate');
const { pageParams, paginate } = require('../utils/paginate');
const { notFound, forbidden, conflict, badRequest } = require('../utils/httpError');
const { logActivity, notify } = require('../utils/activity');
const C = require('../config/constants');

function view(p, viewer) {
  const vid = viewer ? String(viewer._id) : null;
  const authorId = p.author ? String(p.author._id || p.author) : null;
  return {
    id: String(p._id), title: p.title, category: p.category, type: p.type, duration: p.duration,
    description: p.description, status: p.status, createdAt: p.createdAt,
    author: p.author && p.author.name ? { id: authorId, name: p.author.name } : { id: authorId, name: 'Former member' },
    isMine: !!vid && vid === authorId,
    offerCount: (p.offers || []).length,
    alreadyOffered: !!vid && (p.offers || []).some((o) => String(o.from) === vid),
  };
}

/** GET /api/board */
exports.list = async (req, res) => {
  const filter = { status: req.query.status === 'Closed' ? 'Closed' : 'Open' };
  if (C.TYPES.includes(req.query.type)) filter.type = req.query.type;
  if (C.CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (req.query.mine === 'true' && req.user) { filter.author = req.user._id; delete filter.status; }
  const result = await paginate(BoardPost, filter, pageParams(req.query, { defaultLimit: 15 }), {
    populate: { path: 'author', select: 'name' }, map: (p) => view(p, req.user),
  });
  const base = { status: 'Open' };
  if (C.CATEGORIES.includes(req.query.category)) base.category = req.query.category;
  const tc = await BoardPost.aggregate([{ $match: base }, { $group: { _id: '$type', n: { $sum: 1 } } }]);
  result.typeCounts = Object.fromEntries(tc.map((t) => [t._id, t.n]));
  res.json(result);
};

/** POST /api/board */
exports.create = async (req, res) => {
  const data = clean(req.body, {
    title: { label: 'What you need', required: true, min: 3, max: 80 },
    category: { label: 'Category', required: true, enum: C.CATEGORIES },
    type: { label: 'Arrangement', required: true, enum: C.TYPES },
    duration: { label: 'Needed for', max: 40, allowEmpty: true },
    description: { label: 'Details', max: 400, multiline: true, allowEmpty: true },
  });
  const open = await BoardPost.countDocuments({ author: req.user._id, status: 'Open' });
  if (open >= 10) throw conflict('You have 10 open requests already. Close some before posting more.');
  const p = await BoardPost.create({ ...data, author: req.user._id });
  await p.populate({ path: 'author', select: 'name' });
  await logActivity({ action: 'board.posted', actor: req.user, targetType: 'board', targetId: p._id, summary: `${req.user.name} posted a community request: ${p.title}` });
  res.status(201).json({ post: view(p, req.user) });
};

async function loadPost(req) {
  const p = await BoardPost.findById(assertObjectId(req.params.id, 'post'));
  if (!p) throw notFound('Post');
  return p;
}

/** PATCH /api/board/:id/close */
exports.close = async (req, res) => {
  const p = await loadPost(req);
  if (String(p.author) !== String(req.user._id)) throw forbidden('You can only close your own posts.');
  p.status = 'Closed';
  await p.save();
  await logActivity({ action: 'board.closed', actor: req.user, targetType: 'board', targetId: p._id, summary: `${req.user.name} closed the community request: ${p.title}` });
  await p.populate({ path: 'author', select: 'name' });
  res.json({ post: view(p, req.user) });
};

/** POST /api/board/:id/offers  { resourceId, message } — offer one of your listings to the poster. */
exports.offer = async (req, res) => {
  const p = await loadPost(req);
  if (p.status !== 'Open') throw conflict('This request is closed.');
  if (String(p.author) === String(req.user._id)) throw badRequest('You cannot offer to your own request.');
  const data = clean(req.body, {
    resourceId: { type: 'objectId', label: 'Listing', required: true, requiredMessage: 'Choose one of your listings.' },
    message: { label: 'Message', max: 300, multiline: true, allowEmpty: true },
  });
  const r = await Resource.findById(data.resourceId);
  if (!r || r.deletedAt || String(r.owner) !== String(req.user._id)) throw notFound('Listing');
  if (r.status !== 'Available' || r.moderation.state !== 'active') throw conflict('Only available listings can be offered.');
  if (p.offers.some((o) => String(o.from) === String(req.user._id) && String(o.resource) === String(r._id))) throw conflict('You have already offered this listing.');
  p.offers.push({ from: req.user._id, resource: r._id, message: data.message || '' });
  await p.save();
  await notify(p.author, {
    type: 'board', title: `${req.user.name} offered "${r.title}"`,
    body: `In reply to your request for ${p.title}.${data.message ? ' Message: ' + data.message : ''} Open the listing to send a request.`,
    link: `resource-details.html?id=${r._id}`,
  });
  await logActivity({ action: 'board.offered', actor: req.user, targetType: 'board', targetId: p._id, visibleTo: [p.author], summary: `${req.user.name} offered "${r.title}" for the community request ${p.title}` });
  res.status(201).json({ ok: true });
};
