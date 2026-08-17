const { Types: { ObjectId } } = require('mongoose');

const TENANT_BRANCHES = new Set(['gil-puyat', 'guadalupe']);
const PRESENT_STAY_STATUSES = ['active', 'ending_soon', 'expired_occupancy_continuing'];
const PRESENT_RESERVATION_STATUSES = ['moveIn'];
const PRE_MOVE_IN_RESERVATION_STATUSES = ['reserved', 'move_in_overdue'];

function normalizeBranch(value) {
  const normalized = String(value || '').trim().toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\s_]+/g, '-')
    .replace(/^branch-/, '');

  if (/(^|-)guadalupe($|-)/.test(normalized)) return 'guadalupe';
  if (/(^|-)gil-?puyat($|-)/.test(normalized)) return 'gil-puyat';
  return normalized;
}

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  if (typeof value === 'object' && value._id) return toObjectId(value._id);
  if (ObjectId.isValid(String(value))) return new ObjectId(String(value));
  return value;
}

function sameIdentity(left, right) {
  if (left === undefined || left === null || right === undefined || right === null) return false;
  return String(left) === String(right);
}

async function resolveRoomBranch(db, roomId) {
  if (!roomId) return null;
  const room = await db.collection('rooms').findOne(
    { _id: toObjectId(roomId) },
    { projection: { branch: 1 } },
  );
  const branch = normalizeBranch(room?.branch);
  return TENANT_BRANCHES.has(branch) ? branch : null;
}

async function branchFromAssignment(db, assignment) {
  if (!assignment) return null;
  const direct = normalizeBranch(assignment.branch || assignment.branchId || assignment.branch_id);
  if (TENANT_BRANCHES.has(direct)) return direct;
  return resolveRoomBranch(db, assignment.roomId || assignment.room_id || assignment.room);
}

/**
 * Resolve the server-owned branch that scopes an authenticated tenant today.
 * Stay is authoritative for current occupancy. Derived/legacy occupancy
 * mirrors are fallback-only; stale User/Reservation branch fields are never
 * trusted as audience authority.
 */
async function resolveTenantBranch(db, tenantMongoId) {
  const tenantId = toObjectId(tenantMongoId);
  if (!tenantId) return { branch: null, source: 'unresolved' };

  const stay = await db.collection('stays').findOne(
    { tenantId, status: { $in: PRESENT_STAY_STATUSES } },
    { sort: { leaseStartDate: -1, createdAt: -1 } },
  );
  const stayBranch = await branchFromAssignment(db, stay);
  if (stayBranch) return { branch: stayBranch, source: 'stay' };

  const bedHistory = await db.collection('bedhistories').findOne(
    { tenantId, status: 'active' },
    { sort: { effectiveStartDate: -1, moveInDate: -1, createdAt: -1 } },
  );
  const bedBranch = await branchFromAssignment(db, bedHistory);
  if (bedBranch) return { branch: bedBranch, source: 'bed-history' };

  const currentReservation = await db.collection('reservations').findOne(
    {
      userId: tenantId,
      isArchived: { $ne: true },
      status: { $in: PRESENT_RESERVATION_STATUSES },
    },
    { sort: { confirmedMoveInDate: -1, moveInDate: -1, updatedAt: -1, createdAt: -1 } },
  );
  const reservationBranch = await resolveRoomBranch(db, currentReservation?.roomId);
  if (reservationBranch) return { branch: reservationBranch, source: 'move-in-reservation-room' };

  const assignedReservation = await db.collection('reservations').findOne(
    {
      userId: tenantId,
      isArchived: { $ne: true },
      status: { $in: PRE_MOVE_IN_RESERVATION_STATUSES },
    },
    { sort: { reservedAt: -1, targetMoveInDate: -1, updatedAt: -1, createdAt: -1 } },
  );
  const assignedBranch = await resolveRoomBranch(db, assignedReservation?.roomId);
  if (assignedBranch) return { branch: assignedBranch, source: 'reserved-room' };

  const contract = await db.collection('contracts').findOne(
    {
      tenantId,
      isCurrent: { $ne: false },
      isCanonical: { $ne: false },
      archivedAt: null,
    },
    { sort: { createdAt: -1 } },
  );
  const contractBranch = normalizeBranch(contract?.branch);
  if (TENANT_BRANCHES.has(contractBranch)) {
    return { branch: contractBranch, source: 'current-contract' };
  }

  return { branch: null, source: 'unresolved' };
}

async function buildTenantContext(db, { tenant = null, userId = null, userMongoId = null } = {}) {
  const mongoId = tenant?._id || userMongoId || null;
  const businessId = tenant?.user_id || userId || null;
  const branchResolution = await resolveTenantBranch(db, mongoId);
  return {
    authenticated: Boolean(mongoId || businessId),
    mongoId,
    userId: businessId,
    branch: branchResolution.branch,
    branchSource: branchResolution.source,
  };
}

function resolveAnnouncementAudience(announcement = {}) {
  const isPrivate = announcement.is_private === true || announcement.isPrivate === true;
  if (isPrivate) {
    const recipient = announcement.user_id ?? announcement.userId ?? null;
    return recipient ? { kind: 'specific-recipient', recipient } : { kind: 'invalid' };
  }

  const canonicalAudienceValue = announcement.targetBranch ?? announcement._doc?.targetBranch;
  const hasCanonicalAudience = canonicalAudienceValue !== undefined
    || Object.prototype.hasOwnProperty.call(announcement, 'targetBranch');
  const rawAudience = hasCanonicalAudience
    ? canonicalAudienceValue
    : (announcement.branch ?? announcement.branchId ?? announcement.branch_id ?? null);
  const normalized = normalizeBranch(rawAudience);

  if (hasCanonicalAudience) {
    if (normalized === 'both') return { kind: 'global' };
    if (TENANT_BRANCHES.has(normalized)) return { kind: 'branch', branch: normalized };
    return { kind: 'invalid' };
  }

  if (!normalized || ['both', 'all', 'global', '*'].includes(normalized)) {
    return { kind: 'global' };
  }
  if (TENANT_BRANCHES.has(normalized)) return { kind: 'branch', branch: normalized };
  return { kind: 'invalid' };
}

function isAnnouncementLive(announcement = {}, now = new Date()) {
  if (announcement.isArchived === true || announcement.is_active === false || announcement.isActive === false) {
    return false;
  }
  if (announcement.visibility === 'staff-only') return false;

  if (announcement.publicationStatus) {
    if (!['scheduled', 'published'].includes(announcement.publicationStatus)) return false;
    if (announcement.startsAt && new Date(announcement.startsAt) > now) return false;
    if (announcement.endsAt && new Date(announcement.endsAt) <= now) return false;
  }
  return true;
}

function canTenantMatchAnnouncementAudience({ announcement = {}, tenantContext = {} } = {}) {
  if (!tenantContext.authenticated) return false;
  const audience = resolveAnnouncementAudience(announcement);
  if (audience.kind === 'global') return true;
  if (audience.kind === 'specific-recipient') {
    return sameIdentity(audience.recipient, tenantContext.userId)
      || sameIdentity(audience.recipient, tenantContext.mongoId);
  }
  if (audience.kind === 'branch') {
    return Boolean(tenantContext.branch) && audience.branch === tenantContext.branch;
  }
  return false;
}

function canTenantViewAnnouncement({ announcement = {}, tenantContext = {}, now = new Date() } = {}) {
  return isAnnouncementLive(announcement, now)
    && canTenantMatchAnnouncementAudience({ announcement, tenantContext });
}

async function filterAnnouncementRecipients(db, announcement, tenants = [], { requireLive = false } = {}) {
  const evaluated = await Promise.all((tenants || []).map(async (tenant) => ({
    tenant,
    allowed: (requireLive ? canTenantViewAnnouncement : canTenantMatchAnnouncementAudience)({
      announcement,
      tenantContext: await buildTenantContext(db, { tenant }),
    }),
  })));
  return evaluated.filter(({ allowed }) => allowed).map(({ tenant }) => tenant);
}

module.exports = {
  TENANT_BRANCHES,
  PRESENT_STAY_STATUSES,
  PRESENT_RESERVATION_STATUSES,
  PRE_MOVE_IN_RESERVATION_STATUSES,
  normalizeBranch,
  resolveTenantBranch,
  buildTenantContext,
  resolveAnnouncementAudience,
  isAnnouncementLive,
  canTenantMatchAnnouncementAudience,
  canTenantViewAnnouncement,
  filterAnnouncementRecipients,
};
