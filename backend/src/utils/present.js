'use strict';
/*
 * Shapes database documents into API responses. Keeping this in one place makes
 * it easy to see exactly which fields leave the server (no emails of other
 * students, no password hashes, no internal moderation notes for students).
 */
const id = (v) => (v ? String(v._id || v) : null);

function person(u) {
  if (!u) return null;
  if (!u.name) return { id: id(u), name: 'Former member' };
  return { id: id(u), name: u.name };
}

function location(l) {
  if (!l || !l.name) return l ? { id: id(l), name: 'Unknown location', status: 'Pending', active: false, usable: false } : null;
  return {
    id: id(l), name: l.name, area: l.area || '', description: l.description || '',
    status: l.status, active: l.active, usable: l.status === 'Approved' && l.active,
  };
}

function resource(r, viewer) {
  const loc = location(r.location);
  const ownerId = id(r.owner);
  const viewerId = viewer ? String(viewer._id) : null;
  const moderated = r.moderation && r.moderation.state !== 'active';
  const out = {
    id: id(r), title: r.title, description: r.description, category: r.category, type: r.type,
    condition: r.condition, department: r.department, semester: r.semester || null, quantity: r.quantity,
    status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt,
    owner: person(r.owner), location: loc,
    isOwner: !!viewerId && viewerId === ownerId,
    requestable: r.status === 'Available' && !moderated && !r.deletedAt && !!(loc && loc.usable),
  };
  if (!out.requestable) {
    out.unavailableReason = moderated ? 'This listing has been disabled by an administrator.'
      : r.deletedAt ? 'This listing has been removed by its owner.'
      : r.status !== 'Available' ? (r.status === 'Reserved' ? 'Reserved for another student.' : 'Not available at the moment.')
      : 'The pickup point for this listing is waiting for admin approval.';
  }
  if ((viewer && viewer.role === 'admin') || out.isOwner) {
    out.moderation = { state: r.moderation ? r.moderation.state : 'active', reason: r.moderation ? r.moderation.reason : '' };
  }
  if (viewer && viewer.role === 'admin') {
    out.reportCount = r.reportCount || 0;
    out.deleted = !!r.deletedAt;
    if (r.owner && r.owner.email) out.owner.email = r.owner.email;
    if (r.owner && r.owner.status) out.owner.status = r.owner.status;
  }
  return out;
}

function request(q, viewer) {
  const viewerId = viewer ? String(viewer._id) : null;
  const isAdmin = viewer && viewer.role === 'admin';
  const out = {
    id: id(q), status: q.status, message: q.message, offerDetails: q.offerDetails, ownerNote: q.ownerNote,
    quantity: q.quantity, createdAt: q.createdAt, updatedAt: q.updatedAt, completedAt: q.completedAt || null,
    resource: q.resource && q.resource.title
      ? { id: id(q.resource), title: q.resource.title, type: q.resource.type, category: q.resource.category, deleted: !!q.resource.deletedAt }
      : { id: id(q.resource), title: q.resourceTitle, type: q.resourceType, category: q.category, deleted: true },
    resourceTitle: q.resourceTitle, resourceType: q.resourceType,
    requester: person(q.requester), owner: person(q.owner), location: location(q.location),
    role: viewerId === id(q.owner) ? 'owner' : viewerId === id(q.requester) ? 'requester' : (isAdmin ? 'admin' : null),
    history: (q.history || []).map((h) => ({ status: h.status, note: h.note || '', at: h.at, by: h.by && h.by.name ? h.by.name : undefined })),
  };
  if (isAdmin) {
    if (q.requester && q.requester.email) out.requester.email = q.requester.email;
    if (q.owner && q.owner.email) out.owner.email = q.owner.email;
  }
  return out;
}

module.exports = { id, person, location, resource, request };
