'use strict';
const { Notification, ActivityLog } = require('../models');
const { assertObjectId } = require('../utils/validate');
const { pageParams, paginate } = require('../utils/paginate');
const { notFound } = require('../utils/httpError');

/** GET /api/notifications?unread=true&page= */
exports.list = async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.read = false;
  const result = await paginate(Notification, filter, pageParams(req.query, { defaultLimit: 20 }));
  result.unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json(result);
};

/** GET /api/notifications/count */
exports.count = async (req, res) => {
  res.json({ unreadCount: await Notification.countDocuments({ user: req.user._id, read: false }) });
};

/** PATCH /api/notifications/:id/read  { read?: boolean } */
exports.markRead = async (req, res) => {
  const n = await Notification.findOne({ _id: assertObjectId(req.params.id, 'notification'), user: req.user._id });
  if (!n) throw notFound('Notification');
  const read = !(req.body && req.body.read === false);
  n.read = read;
  n.readAt = read ? new Date() : undefined;
  await n.save();
  res.json({ notification: n });
};

/** PATCH /api/notifications/read-all */
exports.markAllRead = async (req, res) => {
  const r = await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true, readAt: new Date() } });
  res.json({ updated: r.modifiedCount });
};

/** GET /api/activity/mine — the signed-in user's own activity history. */
exports.myActivity = async (req, res) => {
  const result = await paginate(ActivityLog, { visibleTo: req.user._id }, pageParams(req.query, { defaultLimit: 20 }), {
    select: 'action summary targetType targetId createdAt',
  });
  res.json(result);
};
