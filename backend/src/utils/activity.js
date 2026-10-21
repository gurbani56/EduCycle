'use strict';
const { ActivityLog, Notification } = require('../models');

/**
 * Record a trusted, server-side activity entry. Never pass passwords, tokens or
 * other secrets in `details`. Failures are logged but never break the request.
 */
async function logActivity({ action, actor, targetType = 'system', targetId, summary, details, visibleTo = [] }) {
  try {
    const actorId = actor ? actor._id || actor : undefined;
    const viewers = new Set(visibleTo.filter(Boolean).map(String));
    if (actorId) viewers.add(String(actorId));
    await ActivityLog.create({
      action,
      actor: actorId,
      actorRole: actor && actor.role ? actor.role : (actorId ? 'student' : 'system'),
      targetType,
      targetId,
      summary,
      details,
      visibleTo: [...viewers],
    });
  } catch (err) {
    console.error('[activity] failed to write log entry:', err.message);
  }
}

async function notify(userId, { type, title, body = '', link = '' }) {
  if (!userId) return;
  try {
    await Notification.create({ user: userId, type, title, body, link });
  } catch (err) {
    console.error('[notify] failed to create notification:', err.message);
  }
}

module.exports = { logActivity, notify };
