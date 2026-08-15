const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { notifyNewAnnouncement } = require('../services/pushService');

function normalizedBranchReference(reference) {
  const normalized = String(reference || '').trim().toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[\s_]+/g, '-');
  if (/(^|-)guadalupe($|-)/.test(normalized)) return 'guadalupe';
  if (/(^|-)gil-?puyat($|-)/.test(normalized)) return 'gil-puyat';
  return normalized.replace(/^branch-/, '');
}

// Resolve the requesting tenant's authoritative branch code for filtering, or
// null if it can't be confirmed. Mirrors the same three room-assignment
// sources controllers/dashboard.controller.js already trusts for this
// tenant's current room/branch (roomoccupancyhistories -> bedhistories ->
// reservations), never a client-supplied value.
//
// Phase 4.5 cutover audit found getAllAnnouncements previously had NO branch
// filter at all — every branch-targeted announcement (pricing, incident
// notices, move-out schedules, security alerts) was returned to every
// authenticated tenant regardless of branch, a cross-branch data leak. This
// closes that gap; branch-restricted announcements are hidden (fail closed)
// when the requester's branch can't be confirmed, exactly like the
// standalone mobile backend's equivalent guard.
async function resolveRequesterBranchCode(db, mongoId) {
  if (!mongoId) return null;
  try {
    const occupancy = await db.collection('roomoccupancyhistories').findOne({ tenantId: mongoId, stayStatus: 'active' });
    // roomoccupancyhistories is legacy and has no Mongoose schema in this repo;
    // dashboard.controller.js and maintenance.controller.js both read this
    // collection's branch under `branchId`, not `branch`. Check both so this
    // resolver doesn't silently fail to resolve legacy occupancy records.
    if (occupancy?.branch || occupancy?.branchId) return normalizedBranchReference(occupancy.branch || occupancy.branchId);

    const bedHistory = await db.collection('bedhistories').findOne({
      tenantId: mongoId,
      $or: [{ status: 'active' }, { isActive: true }],
    });
    if (bedHistory?.branch) return normalizedBranchReference(bedHistory.branch);

    const reservation = await db.collection('reservations').findOne({
      $or: [{ userId: mongoId }, { tenantId: mongoId }],
      status: { $regex: /^(approved|confirmed|active|completed|checked_in|movein)$/i },
    }, { sort: { createdAt: -1 } });
    if (reservation?.branch) return normalizedBranchReference(reservation.branch);

    // Contract.branch (server/models/Contract.js) is a required, indexed
    // field set on every contract — the same authoritative value
    // /api/m/contracts/current already shows the tenant. Checked last so it
    // never overrides a more specific active-stay match above, but it covers
    // tenants whose branch is only recorded on their Contract and not yet
    // mirrored into the legacy occupancy/bed/reservation collections above,
    // which otherwise left Home/Profile showing "not available yet" while
    // the Contract screen correctly showed a real branch.
    const contract = await db.collection('contracts').findOne(
      { tenantId: mongoId, isCurrent: true },
      { sort: { createdAt: -1 } },
    );
    if (contract?.branch) return normalizedBranchReference(contract.branch);

    return null;
  } catch (_) {
    return null;
  }
}

// An announcement with no branch field (or blank) is global/legacy and stays
// visible to everyone. A private (user_id-targeted) announcement is already
// scoped to exactly one tenant by the query-level ownership filter, which is
// strictly more precise than a branch match, so branch filtering is skipped
// for private announcements (matches the standalone backend's rationale).
function isAnnouncementVisibleForBranch(doc, requesterBranchCode) {
  const isPrivate = doc.is_private === true || doc.isPrivate === true;
  if (isPrivate) return true;

  const branchRef = doc.branch || doc.branchId || doc.branch_id;
  if (!branchRef || !String(branchRef).trim()) return true;
  if (!requesterBranchCode) return false;
  return normalizedBranchReference(branchRef) === requesterBranchCode;
}

function isHexObjectId(val) {
  return typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());
}

function resolveAuthorName(doc, authorNameMap = new Map()) {
  const candidates = [
    doc.author_name,
    doc.authorName,
    doc.publishedByName,
    doc.publishedBy,
    doc.postedBy,
    doc.source_label,
    doc.createdBy,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'object' && candidate !== null) {
      if (candidate._bsontype === 'ObjectID' || candidate.constructor?.name === 'ObjectId') {
        const idStr = candidate.toString();
        if (authorNameMap.has(idStr)) return authorNameMap.get(idStr);
      } else {
        const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
          || candidate.name || candidate.fullName || candidate.username || candidate.email;
        if (name && !isHexObjectId(name)) return name;
      }
    } else if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      if (isHexObjectId(trimmed)) {
        if (authorNameMap.has(trimmed)) return authorNameMap.get(trimmed);
      } else {
        return trimmed;
      }
    }
  }

  return 'LilyCrest Admin';
}

// Normalize a raw announcement document to the shape the mobile app expects.
// Admin-panel documents may use camelCase or different field names.
function normalizeAnnouncement(doc, authorNameMap = new Map()) {
  const id = doc.announcement_id || doc._id?.toString();
  const createdAt = doc.created_at || doc.createdAt || doc.publishedAt || null;

  // Priority: map admin values to app values
  const rawPriority = doc.priority || doc.importance || doc.type || 'normal';
  let priority = 'normal';
  if (/high|urgent|important/i.test(rawPriority)) priority = 'high';
  else if (/low|info/i.test(rawPriority)) priority = 'low';
  else priority = 'normal';

  // If web admin set isPinned, treat as high priority
  if (doc.isPinned && priority !== 'high') priority = 'high';

  return {
    announcement_id: id,
    title: doc.title || doc.subject || 'Announcement',
    content: doc.content || doc.message || doc.body || doc.description || '',
    author_name: resolveAuthorName(doc, authorNameMap),
    priority,
    category: doc.category || doc.type || 'General',
    is_urgent: doc.is_urgent || doc.isUrgent || priority === 'high',
    is_pinned: doc.isPinned || doc.is_pinned || false,
    created_at: createdAt,
  };
}

// Get all announcements
async function getAllAnnouncements(req, res) {
  try {
    const db = getDb();
    const userId = req.user?.user_id || null;

    // Handle both snake_case (app-created) and camelCase (admin-panel-created) documents.
    // Web admin docs may lack is_active/isActive entirely — treat missing as active.
    const activeFilter = {
      $or: [
        { is_active: true },
        { isActive: true },
        { is_active: { $exists: false }, isActive: { $exists: false } },
      ],
    };
    // Exclude archived announcements (web admin uses isArchived)
    const notArchivedFilter = { isArchived: { $ne: true } };
    const visibilityFilter = {
      $or: [
        { is_private: { $ne: true }, isPrivate: { $ne: true } },
        ...(userId ? [{ is_private: true, user_id: userId }, { isPrivate: true, userId }] : []),
      ],
    };

    const announcements = await db.collection('announcements')
      .find({ $and: [activeFilter, notArchivedFilter, visibilityFilter] })
      .sort({ created_at: -1, createdAt: -1 })
      .toArray();

    // Resolve author names for any author/publishedBy/createdBy ObjectId references
    const authorIds = new Set();
    announcements.forEach((doc) => {
      [doc.author_name, doc.authorName, doc.publishedBy, doc.postedBy, doc.createdBy, doc.source_label].forEach((val) => {
        if (!val) return;
        if (typeof val === 'object' && (val._bsontype === 'ObjectID' || val.constructor?.name === 'ObjectId')) {
          authorIds.add(val.toString());
        } else if (typeof val === 'string' && isHexObjectId(val)) {
          authorIds.add(val.trim());
        }
      });
    });

    const authorNameMap = new Map();
    if (authorIds.size > 0 && typeof db.collection === 'function') {
      try {
        const { ObjectId } = require('mongodb');
        const mongoIds = Array.from(authorIds).map((id) => {
          try { return new ObjectId(id); } catch (_) { return null; }
        }).filter(Boolean);

        const users = await db.collection('users').find({
          $or: [
            { _id: { $in: mongoIds } },
            { user_id: { $in: Array.from(authorIds) } },
          ],
        }).toArray();

        users.forEach((u) => {
          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim()
            || u.name || u.fullName || u.username;
          let displayName = fullName;
          if (u.role === 'admin' || u.role === 'superadmin' || u.role === 'branch_admin') {
            displayName = fullName ? `${fullName} (Admin)` : 'LilyCrest Admin';
          }
          if (!displayName) displayName = 'LilyCrest Admin';

          if (u._id) authorNameMap.set(u._id.toString(), displayName);
          if (u.user_id) authorNameMap.set(String(u.user_id), displayName);
        });
      } catch (_) {
        // Fallback gracefully
      }
    }

    const requesterBranchCode = await resolveRequesterBranchCode(db, req.user?._id || null);
    const visible = announcements.filter((doc) => isAnnouncementVisibleForBranch(doc, requesterBranchCode));

    res.json(visible.map((doc) => normalizeAnnouncement(doc, authorNameMap)));
  } catch (error) {
    console.error('getAllAnnouncements error:', error);
    res.status(500).json({ detail: 'Failed to fetch announcements' });
  }
}

// Admin: create a new announcement and push-notify all tenants
async function createAnnouncement(req, res) {
  try {
    const { title, content, priority, category, is_urgent, is_private, user_id: targetUserId } = req.body;
    if (!title || !content) {
      return res.status(400).json({ detail: 'title and content are required' });
    }

    const db = getDb();
    const announcement = {
      announcement_id: `ann_${uuidv4().replace(/-/g, '').substring(0, 12)}`,
      title,
      content,
      author_name: req.user?.name || req.user?.fullName || 'LilyCrest Admin',
      priority: priority || 'normal',
      category: category || 'General',
      is_urgent: is_urgent || priority === 'high' || false,
      is_active: true,
      is_private: is_private || false,
      user_id: targetUserId || null,
      branch: req.mobileBranchScope || req.body.branch || null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection('announcements').insertOne(announcement);

    // Push notification to all tenants (non-blocking, skip for private targeted announcements)
    if (!announcement.is_private) {
      notifyNewAnnouncement(db, announcement).catch(() => {});
    }

    res.status(201).json(normalizeAnnouncement(announcement));
  } catch (error) {
    console.error('createAnnouncement error:', error);
    res.status(500).json({ detail: 'Failed to create announcement' });
  }
}

module.exports = {
  getAllAnnouncements,
  createAnnouncement,
  resolveRequesterBranchCode,
  normalizedBranchReference,
};
