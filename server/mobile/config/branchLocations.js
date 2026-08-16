'use strict';

// Canonical mobile-facing branch location metadata (display name, address,
// Google Maps link, active flag). Keyed by the same normalized branch code
// resolveRequesterBranchCode() in announcement.controller.js already
// produces ('gil-puyat' | 'guadalupe').
//
// This is the same real production data (addresses, Google Maps links)
// already served today by the standalone LilyCrest-Mobile backend's
// backend/config/branchLocationRecords.js — reproduced here, not invented,
// so the mobile Profile/Home branch card renders identically after cutover
// to this canonical backend. If a branch's address/Maps link ever changes,
// update both copies until the standalone backend is retired.
const MOBILE_BRANCH_LOCATIONS = Object.freeze({
  'gil-puyat': Object.freeze({
    branchName: 'LilyCrest Residences – Gil Puyat',
    branchAddress: '#7 Gil Puyat Ave. corner Marconi St., Makati City',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=%237%20Gil%20Puyat%20Ave.%20corner%20Marconi%20St.%2C%20Makati%20City',
    isActive: true,
  }),
  guadalupe: Object.freeze({
    branchName: 'LilyCrest Residences – Guadalupe',
    branchAddress: '1212, 9431 Magallanes, Makati, 1212 Metro Manila',
    googleMapsUrl: 'https://maps.app.goo.gl/zEQJECzxDY4qdhYp6',
    isActive: true,
  }),
});

module.exports = { MOBILE_BRANCH_LOCATIONS };
