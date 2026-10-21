#!/usr/bin/env node
'use strict';
/*
 * Import the original prototype data (data/legacy-data.json, previously
 * frontend data.json + data.js) into MongoDB.
 *
 *   npm run migrate
 *
 * - Safe to run repeatedly: records are matched on their legacy id / email /
 *   location name, so nothing is duplicated and nothing you edited since is overwritten.
 * - The six students in the prototype become DEMO accounts (isDemo: true).
 *   If DEMO_USER_PASSWORD is set they can log in with it; otherwise they get an
 *   unguessable random password and exist only to own the sample listings.
 * - Pick-up points from the prototype are imported with status **Pending**:
 *   nobody has verified them, so an administrator must review (and complete the
 *   campus area) before they can be used for a live exchange.
 * - `impactFactors` (estimated rupees / CO2 per category) is NOT imported: the
 *   numbers were not backed by real data, and the site no longer shows estimates.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const models = require('../src/models');
const { User, Location, Resource, ExchangeRequest, BoardPost } = models;
const { logActivity } = require('../src/utils/activity');
const { passwordProblem } = require('../src/utils/validate');

const LEGACY_FILE = path.resolve(__dirname, '../data/legacy-data.json');
const STATUS_MAP = { Rejected: 'Declined' };
const DEMO_EMAIL_DOMAIN = 'college.edu'; // the domain used by the prototype's sample user

function emailFor(id, name, legacy) {
  if (legacy.currentUser && legacy.currentUser.id === id && legacy.currentUser.email) return legacy.currentUser.email.toLowerCase();
  return `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@${DEMO_EMAIL_DOMAIN}`;
}

const day = (s) => new Date(`${s}T10:00:00`);

async function saveWithDates(doc, date) {
  doc.createdAt = date;
  doc.updatedAt = date;
  await doc.save({ timestamps: false });
  return doc;
}

async function main() {
  const legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
  await connectDB(env.mongoUri);
  await Promise.all(Object.values(models).map((m) => m.syncIndexes()));

  const counts = { users: [0, 0], locations: [0, 0], resources: [0, 0], requests: [0, 0], board: [0, 0] }; // [created, skipped]

  /* ---- Users ---- */
  const people = new Map();
  const add = (id, name) => { if (id && name && !people.has(id)) people.set(id, name); };
  if (legacy.currentUser) add(legacy.currentUser.id, legacy.currentUser.name);
  legacy.resources.forEach((r) => add(r.ownerId, r.ownerName));
  legacy.requests.forEach((q) => { add(q.requesterId, q.requesterName); add(q.ownerId, q.ownerName); });
  legacy.board.forEach((b) => add(b.userId, b.userName));

  const demoPassword = process.env.DEMO_USER_PASSWORD || '';
  if (demoPassword && passwordProblem(demoPassword)) throw new Error(`DEMO_USER_PASSWORD: ${passwordProblem(demoPassword)}`);
  const userIds = new Map();
  for (const [lid, name] of people) {
    const email = emailFor(lid, name, legacy);
    let u = await User.findOne({ email });
    if (u) { counts.users[1] += 1; userIds.set(lid, u._id); continue; }
    const cu = legacy.currentUser && legacy.currentUser.id === lid ? legacy.currentUser : {};
    u = new User({ name, email, role: 'student', isDemo: true, department: cu.department || '', semester: cu.semester || undefined });
    await u.setPassword(demoPassword || crypto.randomBytes(24).toString('base64url') + 'a1');
    await u.save();
    counts.users[0] += 1;
    userIds.set(lid, u._id);
  }

  /* ---- Locations (Pending; need admin review) ---- */
  const locIds = new Map();
  const locNames = [...new Set(legacy.resources.map((r) => r.location).filter(Boolean))];
  for (const name of locNames) {
    const nameKey = Location.keyFor(name);
    let l = await Location.findOne({ nameKey });
    if (l) { counts.locations[1] += 1; locIds.set(name, l._id); continue; }
    l = await Location.create({
      name, nameKey, area: '', status: 'Pending', source: 'migration',
      description: 'Imported from the original EduCycle prototype. The exact spot and campus area have not been verified; confirm them before approving.',
      history: [{ action: 'imported', note: 'Imported from prototype data by the migration script' }],
    });
    counts.locations[0] += 1;
    locIds.set(name, l._id);
  }

  /* ---- Resources ---- */
  const resIds = new Map();
  for (const r of legacy.resources) {
    let doc = await Resource.findOne({ legacyId: r.id });
    if (doc) { counts.resources[1] += 1; resIds.set(r.id, doc._id); continue; }
    doc = new Resource({
      legacyId: r.id, title: r.name, description: r.description, category: r.category, type: r.type,
      condition: r.condition, department: r.department, semester: r.semester, quantity: r.quantity,
      owner: userIds.get(r.ownerId), location: locIds.get(r.location), status: r.status,
    });
    await saveWithDates(doc, day(r.createdAt));
    counts.resources[0] += 1;
    resIds.set(r.id, doc._id);
  }

  /* ---- Requests / exchanges ---- */
  const resourceByLegacy = new Map(legacy.resources.map((r) => [r.id, r]));
  for (const q of legacy.requests) {
    if (await ExchangeRequest.exists({ legacyId: q.id })) { counts.requests[1] += 1; continue; }
    const status = STATUS_MAP[q.status] || q.status;
    const path_ = { Pending: ['Pending'], Accepted: ['Pending', 'Accepted'], Declined: ['Pending', 'Declined'], 'Handed Over': ['Pending', 'Accepted', 'Handed Over'], Completed: ['Pending', 'Accepted', 'Handed Over', 'Completed'] }[status] || ['Pending'];
    const legacyRes = resourceByLegacy.get(q.resourceId);
    const date = day(q.date);
    const doc = new ExchangeRequest({
      legacyId: q.id, resource: resIds.get(q.resourceId), requester: userIds.get(q.requesterId), owner: userIds.get(q.ownerId),
      resourceTitle: q.resourceName, resourceType: q.type, category: q.category, quantity: q.quantity,
      message: q.message || '', status, location: legacyRes ? locIds.get(legacyRes.location) : undefined,
      history: path_.map((s) => ({ status: s, at: date, note: 'Imported from prototype data' })),
      completedAt: status === 'Completed' ? date : undefined,
    });
    await saveWithDates(doc, date);
    counts.requests[0] += 1;
  }

  /* ---- Community request board ---- */
  for (const b of legacy.board) {
    if (await BoardPost.exists({ legacyId: b.id })) { counts.board[1] += 1; continue; }
    const doc = new BoardPost({
      legacyId: b.id, author: userIds.get(b.userId), title: b.title, category: b.category, type: b.type,
      duration: b.duration, description: b.description, status: b.status === 'Open' ? 'Open' : 'Closed',
    });
    await saveWithDates(doc, day(b.date));
    counts.board[0] += 1;
  }

  const created = Object.values(counts).reduce((s, [c]) => s + c, 0);
  if (created) {
    await logActivity({ action: 'system.migration', summary: `Prototype data imported: ${Object.entries(counts).map(([k, [c]]) => `${c} ${k}`).join(', ')}`, details: counts });
  }

  console.log('\nLegacy data migration complete (created / already present):');
  for (const [k, [c, s]] of Object.entries(counts)) console.log(`  ${k.padEnd(10)} ${String(c).padStart(3)} / ${s}`);
  if (counts.users[0]) {
    console.log(demoPassword
      ? `\nDemo student accounts can sign in with DEMO_USER_PASSWORD (e.g. ${emailFor(1, people.get(1) || 'riya sharma', legacy)}).`
      : '\nDEMO_USER_PASSWORD was not set, so the imported demo students cannot sign in. Register a new student account to try the site.');
  }
  if (counts.locations[0]) console.log('\nImported pick-up points are PENDING. Review them in the admin dashboard → Locations before listings can be requested.\n');
}

main()
  .catch((err) => { console.error(`\n[migrate] ${err.message}\n`); process.exitCode = 1; })
  .finally(() => disconnectDB().catch(() => {}));
