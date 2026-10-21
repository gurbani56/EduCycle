'use strict';
const C = require('../config/constants');

/** GET /api/meta — controlled vocabularies for dropdowns, so the frontend never hard-codes them. */
exports.meta = (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    categories: C.CATEGORIES,
    types: C.TYPES,
    conditions: C.CONDITIONS,
    departments: C.DEPARTMENTS,
    semesters: C.SEMESTERS,
    requestStatuses: C.REQUEST_STATUSES,
    grievanceStatuses: C.GRIEVANCE_STATUSES,
    grievanceCategories: C.GRIEVANCE_CATEGORIES.map(({ key, label, highPriority }) => ({ key, label, highPriority: !!highPriority })),
  });
};
