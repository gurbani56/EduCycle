'use strict';
const router = require('express').Router();
const admin = require('../controllers/adminController');
const loc = require('../controllers/locationController');
const grv = require('../controllers/grievanceController');
const { requireAdmin } = require('../middleware/auth');

// Every route below requires an authenticated administrator (checked on the server).
router.use(requireAdmin);

router.get('/stats', admin.stats);
router.get('/activity', admin.activity);

router.get('/users', admin.users);
router.get('/users/:id', admin.user);
router.patch('/users/:id/status', admin.setUserStatus);
router.get('/admins', admin.admins);

router.get('/resources', admin.resources);
router.get('/resources/:id', admin.resource);
router.patch('/resources/:id/moderation', admin.moderateResource);

router.get('/requests', admin.requests);

router.get('/locations', loc.adminList);
router.post('/locations', loc.adminCreate);
router.get('/locations/:id', loc.adminGet);
router.patch('/locations/:id', loc.adminUpdate);
router.patch('/locations/:id/approve', loc.approve);
router.patch('/locations/:id/reject', loc.reject);

router.get('/grievances', grv.adminList);
router.get('/grievances/:id', grv.adminGet);
router.patch('/grievances/:id', grv.adminUpdate);

module.exports = router;
