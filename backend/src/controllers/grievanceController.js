'use strict';
const { Grievance, Resource, ExchangeRequest, User } = require('../models');
const { clean, assertObjectId, escapeRegex } = require('../utils/validate');
const { pageParams, paginate } = require('../utils/paginate');
const { notFound, validation } = require('../utils/httpError');
const { logActivity, notify } = require('../utils/activity');
const C = require('../config/constants');

const CATEGORY = Object.fromEntries(C.GRIEVANCE_CATEGORIES.map((c) => [c.key, c]));
const REPORT_CATEGORIES = ['not_as_described', 'listing_report'];

const POPULATE = [
  { path: 'resource', select: 'title type status deletedAt moderation owner', populate: { path: 'owner', select: 'name' } },
  { path: 'request', select: 'resourceTitle status requester owner createdAt', populate: [{ path: 'requester', select: 'name' }, { path: 'owner', select: 'name' }] },
  { path: 'history.by', select: 'name' },
];

function view(g, { admin = false } = {}) {
  const out = {
    id: String(g._id), reference: g.reference, category: g.category,
    categoryLabel: CATEGORY[g.category] ? CATEGORY[g.category].label : g.category,
    subject: g.subject, description: g.description, priority: g.priority, status: g.status,
    adminResponse: g.adminResponse || '', respondedAt: g.respondedAt || null, resolvedAt: g.resolvedAt || null,
    createdAt: g.createdAt, updatedAt: g.updatedAt,
    resource: g.resource && g.resource.title ? { id: String(g.resource._id), title: g.resource.title } : null,
    request: g.request && g.request.resourceTitle ? { id: String(g.request._id), resourceTitle: g.request.resourceTitle, status: g.request.status } : null,
    history: (g.history || []).map((h) => ({
      status: h.status || null, response: h.response || '', at: h.at,
      by: admin && h.by && h.by.name ? h.by.name : (h.by && String(h.by._id || h.by) === String(g.submittedBy._id || g.submittedBy) ? 'You' : 'EduCycle admin'),
    })),
  };
  if (admin) {
    out.submittedBy = g.submittedBy && g.submittedBy.name
      ? { id: String(g.submittedBy._id), name: g.submittedBy.name, email: g.submittedBy.email, status: g.submittedBy.status }
      : null;
    out.assignedTo = g.assignedTo && g.assignedTo.name ? { id: String(g.assignedTo._id), name: g.assignedTo.name } : null;
    if (g.resource && g.resource.title) {
      out.resource = {
        id: String(g.resource._id), title: g.resource.title, type: g.resource.type, status: g.resource.status,
        moderation: g.resource.moderation ? g.resource.moderation.state : 'active', deleted: !!g.resource.deletedAt,
        owner: g.resource.owner && g.resource.owner.name ? g.resource.owner.name : null,
      };
    }
    if (g.request && g.request.resourceTitle) {
      out.request = {
        id: String(g.request._id), resourceTitle: g.request.resourceTitle, status: g.request.status, createdAt: g.request.createdAt,
        requester: g.request.requester ? g.request.requester.name : null, owner: g.request.owner ? g.request.owner.name : null,
      };
    }
  }
  return out;
}

/** POST /api/grievances */
exports.create = async (req, res) => {
  const data = clean(req.body, {
    category: { label: 'Category', required: true, enum: Object.keys(CATEGORY), enumMessage: 'Choose a category.' },
    subject: { label: 'Subject', required: true, min: 5, max: 120 },
    description: { label: 'Description', required: true, min: 20, max: 2000, multiline: true },
    resourceId: { type: 'objectId', label: 'Related resource' },
    requestId: { type: 'objectId', label: 'Related exchange' },
  });
  const doc = {
    submittedBy: req.user._id, category: data.category, subject: data.subject, description: data.description,
    priority: CATEGORY[data.category].highPriority ? 'high' : 'normal',
  };

  if (data.requestId) {
    const q = await ExchangeRequest.findById(data.requestId);
    const mine = q && [String(q.owner), String(q.requester)].includes(String(req.user._id));
    if (!mine) throw validation({ requestId: 'Choose one of your own exchanges.' });
    doc.request = q._id;
    if (!data.resourceId) doc.resource = q.resource;
  }
  if (data.resourceId) {
    const r = await Resource.findById(data.resourceId);
    if (!r) throw validation({ resourceId: 'That resource could not be found.' });
    doc.resource = r._id;
  }

  // Retry on the (very unlikely) chance of a duplicate reference.
  let g;
  for (let attempt = 0; attempt < 5 && !g; attempt += 1) {
    try {
      g = await Grievance.create({ ...doc, reference: Grievance.newReference(), history: [{ status: 'Open', by: req.user._id }] });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  if (doc.resource && REPORT_CATEGORIES.includes(data.category)) {
    await Resource.updateOne({ _id: doc.resource }, { $inc: { reportCount: 1 } });
  }
  await logActivity({
    action: 'grievance.submitted', actor: req.user, targetType: 'grievance', targetId: g._id,
    summary: `${req.user.name} filed grievance ${g.reference} (${CATEGORY[g.category].label})`,
    details: { priority: g.priority },
  });
  res.status(201).json({ grievance: view(g) });
};

/** GET /api/grievances/mine */
exports.mine = async (req, res) => {
  const items = await Grievance.find({ submittedBy: req.user._id }).sort({ createdAt: -1 }).populate(POPULATE);
  res.json({ items: items.map((g) => view(g)) });
};

/** GET /api/grievances/:id — only the student who submitted it. */
exports.get = async (req, res) => {
  const g = await Grievance.findById(assertObjectId(req.params.id, 'grievance')).populate(POPULATE);
  if (!g || String(g.submittedBy) !== String(req.user._id)) throw notFound('Grievance');
  res.json({ grievance: view(g) });
};

/* ---------------------------- Admin ---------------------------- */

const ADMIN_POPULATE = POPULATE.concat([
  { path: 'submittedBy', select: 'name email status' },
  { path: 'assignedTo', select: 'name' },
]);

exports.adminList = async (req, res) => {
  const filter = {};
  if (C.GRIEVANCE_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (CATEGORY[req.query.category]) filter.category = req.query.category;
  if (['high', 'normal'].includes(req.query.priority)) filter.priority = req.query.priority;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 80)), 'i');
    filter.$or = [{ reference: rx }, { subject: rx }];
  }
  const result = await paginate(Grievance, filter, pageParams(req.query, { defaultLimit: 20 }), {
    sort: { priority: 1, createdAt: -1 }, populate: ADMIN_POPULATE, map: (g) => view(g, { admin: true }),
  });
  const counts = await Grievance.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  result.statusCounts = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  res.json(result);
};

exports.adminGet = async (req, res) => {
  const g = await Grievance.findById(assertObjectId(req.params.id, 'grievance')).populate(ADMIN_POPULATE);
  if (!g) throw notFound('Grievance');
  res.json({ grievance: view(g, { admin: true }) });
};

/** PATCH /api/admin/grievances/:id  { status?, response?, assignedTo? } */
exports.adminUpdate = async (req, res) => {
  const g = await Grievance.findById(assertObjectId(req.params.id, 'grievance'));
  if (!g) throw notFound('Grievance');
  const data = clean(req.body, {
    status: { label: 'Status', enum: C.GRIEVANCE_STATUSES },
    response: { label: 'Response', max: 1500, multiline: true },
    assignedTo: { type: 'objectId', label: 'Administrator', allowEmpty: true },
  }, { partial: true });
  if (req.body && req.body.assignedTo === '') data.assignedTo = null;

  if (['Resolved', 'Rejected'].includes(data.status) && !(data.response || g.adminResponse)) {
    throw validation({ response: 'Add a response for the student before closing the grievance.' });
  }
  if (data.assignedTo) {
    const admin = await User.findOne({ _id: data.assignedTo, role: 'admin', status: 'active' });
    if (!admin) throw validation({ assignedTo: 'Choose an active administrator.' });
  }

  const statusChanged = data.status && data.status !== g.status;
  const responseChanged = data.response !== undefined && data.response !== g.adminResponse;
  const assignChanged = data.assignedTo !== undefined && String(data.assignedTo || '') !== String(g.assignedTo || '');
  if (!statusChanged && !responseChanged && !assignChanged) throw validation({ status: 'Nothing has changed.' });

  if (statusChanged) {
    g.status = data.status;
    g.resolvedAt = ['Resolved', 'Rejected'].includes(data.status) ? new Date() : undefined;
  }
  if (responseChanged) { g.adminResponse = data.response; g.respondedAt = new Date(); }
  if (assignChanged) g.assignedTo = data.assignedTo || undefined;
  g.history.push({
    status: statusChanged ? g.status : undefined,
    response: responseChanged ? g.adminResponse : undefined,
    assignedTo: assignChanged ? g.assignedTo : undefined,
    by: req.user._id,
  });
  await g.save();

  const parts = [];
  if (statusChanged) parts.push(`status → ${g.status}`);
  if (responseChanged) parts.push('response added');
  if (assignChanged) parts.push(g.assignedTo ? 'assigned' : 'unassigned');
  await logActivity({ action: 'grievance.updated', actor: req.user, targetType: 'grievance', targetId: g._id, visibleTo: [g.submittedBy], summary: `${req.user.name} updated grievance ${g.reference}: ${parts.join(', ')}` });

  if (statusChanged || responseChanged) {
    await notify(g.submittedBy, {
      type: 'grievance',
      title: statusChanged ? `Grievance ${g.reference} is now ${g.status}` : `New response on grievance ${g.reference}`,
      body: responseChanged ? g.adminResponse.slice(0, 300) : '',
      link: `grievances.html?ref=${encodeURIComponent(g.reference)}`,
    });
  }
  await g.populate(ADMIN_POPULATE);
  res.json({ grievance: view(g, { admin: true }) });
};
