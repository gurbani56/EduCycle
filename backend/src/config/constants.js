'use strict';
/*
 * Controlled vocabularies used by both the API (validation) and the frontend (served by GET /api/meta).
 * Edit these lists to change the dropdown options across the site without touching frontend code.
 */
module.exports = {
  CATEGORIES: ['Books', 'Notes', 'Electronics', 'Calculators', 'Lab Equipment', 'Stationery', 'Other'],
  TYPES: ['Donate', 'Lend', 'Exchange'],
  CONDITIONS: ['New', 'Like New', 'Good', 'Fair'],
  DEPARTMENTS: [
    'All Departments',
    'Computer Engineering',
    'Information Technology',
    'Electronics & Telecom',
    'Electronics & Computer Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Other',
  ],
  SEMESTERS: [1, 2, 3, 4, 5, 6, 7, 8],
  RESOURCE_STATUSES: ['Available', 'Reserved', 'Unavailable'],
  MODERATION_STATES: ['active', 'disabled'],

  // Exchange workflow. "Declined" replaces the prototype's "Rejected" label.
  REQUEST_STATUSES: ['Pending', 'Accepted', 'Declined', 'Cancelled', 'Handed Over', 'Completed'],
  OPEN_REQUEST_STATUSES: ['Pending', 'Accepted', 'Handed Over'],

  LOCATION_STATUSES: ['Pending', 'Approved', 'Rejected'],

  GRIEVANCE_STATUSES: ['Open', 'In Review', 'Resolved', 'Rejected'],
  GRIEVANCE_CATEGORIES: [
    { key: 'not_as_described', label: 'Resource not as described' },
    { key: 'listing_report', label: 'Inappropriate or misleading listing' },
    { key: 'no_show', label: 'Student did not arrive for pickup' },
    { key: 'misconduct', label: 'Misconduct or inappropriate behaviour' },
    { key: 'location_issue', label: 'Pickup/drop-off location issue' },
    { key: 'safety', label: 'Safety concern', highPriority: true },
    { key: 'technical', label: 'Website or technical issue' },
    { key: 'other', label: 'Other' },
  ],

  BOARD_STATUSES: ['Open', 'Closed'],
};
