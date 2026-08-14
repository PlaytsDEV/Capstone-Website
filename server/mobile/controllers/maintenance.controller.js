const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/database');
const { notifyMaintenanceStatusChange } = require('../services/pushService');
const { admin, resolveFirebaseStorageBucket } = require('../config/firebase');

// Canonical collection used by the website backend (Mongoose model collection).
const PRIMARY_COLLECTION = 'maintenance_requests';

// Legacy collection used by earlier mobile/backend builds.
const LEGACY_COLLECTION = 'maintenancerequests';

// Read from both so old records still appear while new records land in primary.
const COLLECTIONS = [...new Set([PRIMARY_COLLECTION, LEGACY_COLLECTION])];

const ACTIVE_RESERVATION_STATUSES = ['moveIn', 'active', 'completed', 'confirmed'];
const VALID_URGENCIES = ['low', 'normal', 'high'];
const VALID_STATUSES = ['pending', 'viewed', 'in_progress', 'resolved', 'completed', 'rejected', 'cancelled'];
// Matches the current mobile frontend's fixed request-type list
// (app/(tabs)/services.jsx REQUEST_TYPES) and the currently-live standalone
// mobile backend's VALID_REQUEST_TYPES. Phase 4.5 cutover audit found this
// canonical controller previously accepted any string as a category.
const VALID_REQUEST_TYPES = ['maintenance', 'plumbing', 'electrical', 'aircon', 'cleaning', 'pest', 'furniture', 'other'];
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 1000;
const MAX_TENANT_ATTACHMENTS = 4;
// Canonical-mobile reconciliation audit: this canonical controller never
// re-checked attachment byte size at all — only a count cap (above) — so a
// client could reference an upload larger than the mobile app's intended
// 5MB ceiling (mobileUploadRoutes.js's generic bridge allows up to 10MB for
// non-maintenance uploads). Applies regardless of attachment MIME type.
const MAINTENANCE_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_FILE_PATTERN = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)(?:$|[?#])/i;
const PDF_FILE_PATTERN = /\.pdf(?:$|[?#])/i;
const PUBLIC_REPLY_TYPES = new Set(['admin_reply', 'admin_update', 'tenant_reply', 'tenant_summary', 'summary']);
const INTERNAL_THREAD_TYPES = new Set([
  'status_change',
  'status_changed',
  'status_visible',
  'internal_note',
  'internal_log',
  'workflow_action',
  'viewed',
  'processing',
  'draft_saved',
  'tenant_submitted',
  'tenant_cancelled',
  'tenant_reopened',
  'tenant_confirmed_resolved',
]);

function attachmentText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickAttachmentText(...values) {
  for (const value of values) {
    const text = attachmentText(value);
    if (text) return text;
  }
  return '';
}

function getAttachmentUri(entry) {
  if (typeof entry === 'string') {
    return attachmentText(entry);
  }

  return pickAttachmentText(
    entry?.uri,
    entry?.url,
    entry?.href,
    entry?.src,
    entry?.imageUrl,
    entry?.imageURL,
    entry?.image_url,
    entry?.fileUrl,
    entry?.fileURL,
    entry?.file_url,
    entry?.downloadUrl,
    entry?.downloadURL,
    entry?.download_url,
    entry?.publicUrl,
    entry?.publicURL,
    entry?.public_url,
    entry?.secureUrl,
    entry?.secureURL,
    entry?.secure_url,
    entry?.mediaUrl,
    entry?.mediaURL,
    entry?.media_url,
    entry?.path,
  );
}

function isRemoteUri(uri) {
  try {
    const { protocol } = new URL(uri);
    return protocol === 'https:' || protocol === 'http:';
  } catch (_) {
    return false;
  }
}

function deriveAttachmentName(uri, index = 0) {
  if (!uri) return `Attachment ${index + 1}`;

  try {
    const parsedUrl = new URL(uri, 'https://placeholder.local');
    const candidate = parsedUrl.pathname.split('/').filter(Boolean).pop();
    return attachmentText(candidate ? decodeURIComponent(candidate) : '') || `Attachment ${index + 1}`;
  } catch (_) {
    const candidate = String(uri).split(/[/?#]/).filter(Boolean).pop();
    return attachmentText(candidate) || `Attachment ${index + 1}`;
  }
}

function getAttachmentName(entry, uri, index = 0) {
  if (typeof entry !== 'object' || !entry) {
    return deriveAttachmentName(uri, index);
  }

  return pickAttachmentText(
    entry.name,
    entry.filename,
    entry.fileName,
    entry.originalName,
    entry.originalFilename,
    entry.label,
    entry.title,
    deriveAttachmentName(uri, index),
  );
}

function inferAttachmentType(entry, name, uri) {
  const explicitType = typeof entry === 'object' && entry
    ? pickAttachmentText(entry.type, entry.mimeType, entry.mime, entry.contentType)
    : '';
  if (explicitType) return explicitType;

  const source = `${name || ''} ${uri || ''}`.toLowerCase();
  if (PDF_FILE_PATTERN.test(source)) return 'application/pdf';
  if (IMAGE_FILE_PATTERN.test(source)) return 'image/*';
  return 'application/octet-stream';
}

function normalizeAttachmentEntry(entry, index = 0) {
  const uri = getAttachmentUri(entry);
  if (!uri || !isRemoteUri(uri)) return null;

  const name = getAttachmentName(entry, uri, index);
  const type = inferAttachmentType(entry, name, uri);
  const normalized = {
    name,
    uri,
    url: uri,
    downloadUrl: uri,
    filename: name,
    type,
    mimeType: type,
  };

  if (typeof entry === 'object' && entry) {
    const size = Number(entry.size ?? entry.fileSize);
    if (Number.isFinite(size) && size >= 0) normalized.size = size;
    if (entry.storagePath) normalized.storagePath = entry.storagePath;
    normalized.uploadedAt = entry.uploadedAt || entry.createdAt || entry.created_at || null;
    normalized.createdAt = entry.createdAt || entry.created_at || entry.uploadedAt || null;
  }

  return normalized;
}

function normalizeAttachmentList(attachments) {
  return Array.isArray(attachments)
    ? attachments
      .map((entry, index) => normalizeAttachmentEntry(entry, index))
      .filter(Boolean)
    : [];
}

// Re-checks every attachment against MAINTENANCE_ATTACHMENT_MAX_BYTES using
// ONLY a provider-verified byte count — never the client-reported `size`
// field, which is pure client input and trivially spoofable (a client can
// claim any size for any URI, including one this backend never touched).
//
// `storagePath` is the trust boundary: it identifies an object this
// backend's own mobileUploadRoutes.js Firebase Storage bridge actually
// wrote, so Firebase Storage's own metadata for that exact path is a byte
// count the client cannot influence. An attachment WITHOUT a storagePath —
// whether it's missing entirely, or points at some other externally-hosted
// URL — has no server-controlled way to confirm its real size, so it is
// rejected outright rather than trusting whatever `size` the client
// attached to it. The client-reported `size` field may still be stored on
// the normalized attachment for display purposes (see
// normalizeAttachmentEntry) — it is simply never treated as authoritative
// for this security decision.
//
// A storage lookup failure (object missing/unreadable/provider outage) is
// also treated as a rejection, not a fallback to the client's claim —
// falling back there would let an attacker supply a storagePath that
// always fails to resolve specifically to force the client size to be
// trusted, reopening the same gap this function exists to close.
//
// Returns { ok: true } or { ok: false, detail } — callers must check this
// BEFORE any database write, so a request with one oversized or
// unverifiable attachment never creates/updates a maintenance record at
// all (not even partially).
async function assertAttachmentsWithinSizeLimit(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return { ok: true };

  let bucket = null;
  const getBucket = () => {
    if (bucket) return bucket;
    const bucketName = resolveFirebaseStorageBucket();
    if (!admin.apps.length || !bucketName) return null;
    bucket = admin.storage().bucket(bucketName);
    return bucket;
  };

  for (const attachment of attachments) {
    if (!attachment.storagePath) {
      return { ok: false, detail: 'One or more attachments could not be verified. Please re-upload and try again.' };
    }

    let verifiedBytes = null;
    try {
      const activeBucket = getBucket();
      if (activeBucket) {
        const [metadata] = await activeBucket.file(attachment.storagePath).getMetadata();
        const bytes = Number(metadata?.size);
        if (Number.isFinite(bytes)) verifiedBytes = bytes;
      }
    } catch (_) {
      // Object missing/unreadable/storage unavailable — falls through to
      // the unverifiable-attachment rejection below. Never falls back to
      // the client-reported size.
    }

    if (verifiedBytes === null) {
      return { ok: false, detail: 'One or more attachments could not be verified. Please re-upload and try again.' };
    }
    if (verifiedBytes > MAINTENANCE_ATTACHMENT_MAX_BYTES) {
      return { ok: false, detail: 'Attachments must be 5 MB or smaller.' };
    }
  }

  return { ok: true };
}

function getEntryTimestamp(entry = {}) {
  return entry.created_at || entry.createdAt || entry.timestamp || entry.logged_at || entry.updated_at || entry.updatedAt || null;
}

function getEntryTimeValue(entry = {}) {
  const date = new Date(getEntryTimestamp(entry) || 0);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function getEntryType(entry = {}) {
  return String(entry.type || entry.kind || entry.event || '').trim().toLowerCase();
}

function getEntryMessage(entry = {}) {
  return String(entry.message || entry.summary || entry.tenantSummary || entry.note || entry.content || '').trim();
}

function normalizeSenderRole(role = '', fallback = 'admin') {
  const normalized = String(role || fallback || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (['tenant', 'applicant', 'you'].includes(normalized)) return 'tenant';
  if (['owner', 'property_owner'].includes(normalized)) return 'owner';
  if (['branch_admin', 'branch'].includes(normalized)) return 'branch_admin';
  if (['service_provider', 'provider', 'technician'].includes(normalized)) return 'service_provider';
  if (['system', 'maintenance_system'].includes(normalized)) return 'system';
  return 'admin';
}

function senderLabelFromRole(role = '', fallbackName = '') {
  const normalized = normalizeSenderRole(role);
  if (normalized === 'tenant') return 'You';
  if (normalized === 'owner') return 'Owner';
  if (normalized === 'branch_admin') return 'Branch Admin';
  if (normalized === 'service_provider') return 'Service Provider';
  if (normalized === 'system') return 'Maintenance Team';
  return fallbackName || 'Branch Admin';
}

function isTenantVisibleEntry(entry = {}) {
  const visibility = String(entry.visibility || (entry.visibleToTenant === false ? 'internal' : 'tenant')).toLowerCase();
  if (visibility === 'internal' || entry.visibleToTenant === false || entry.isTenantVisible === false) return false;
  if (entry.internal === true || entry.adminOnly === true || entry.isInternal === true) return false;
  const type = getEntryType(entry);
  if (INTERNAL_THREAD_TYPES.has(type)) return false;
  if (type && !PUBLIC_REPLY_TYPES.has(type)) return false;
  if (normalizeSenderRole(entry.sender_role || entry.senderRole || entry.actor_role || entry.role) === 'system') return false;
  const attachments = normalizeAttachmentList(entry.attachments);
  return Boolean(getEntryMessage(entry) || attachments.length || entry.summary || entry.tenantSummary);
}

function normalizePublicReplyType(entry = {}) {
  const type = getEntryType(entry);
  if (type === 'tenant_summary' || type === 'summary') return 'tenant_summary';
  if (type === 'tenant_reply') return 'tenant_reply';
  if (type === 'admin_reply') return 'admin_reply';
  return normalizeSenderRole(entry.sender_role || entry.senderRole || entry.actor_role || entry.role) === 'tenant'
    ? 'tenant_reply'
    : 'admin_reply';
}

function mapPublicReplyForTenant(entry = {}, index = 0) {
  if (!isTenantVisibleEntry(entry)) return null;
  const timestamp = getEntryTimestamp(entry);
  const senderSide = String(entry.sender_side || entry.senderSide || '').toLowerCase();
  const role = normalizeSenderRole(
    entry.sender_role || entry.senderRole || entry.actor_role || entry.role,
    senderSide === 'tenant' ? 'tenant' : 'admin',
  );
  const type = normalizePublicReplyType(entry);
  const attachments = normalizeAttachmentList(entry.attachments);

  return {
    update_id: entry.update_id || entry.id || `${type}_${timestamp || index}`,
    type,
    kind: type,
    title: type === 'tenant_summary'
      ? 'Maintenance Summary'
      : role === 'tenant'
        ? 'Follow-up from You'
        : 'Admin Reply',
    senderName: entry.senderName || entry.sender_name || entry.actor_name || senderLabelFromRole(role),
    senderRole: role,
    actor_name: entry.actor_name || entry.sender_name || senderLabelFromRole(role),
    actor_role: role,
    message: getEntryMessage(entry),
    attachments,
    summary: entry.summary || entry.tenantSummary || null,
    tenantSummary: entry.summary || entry.tenantSummary || null,
    visibleToTenant: true,
    isTenantVisible: true,
    visibility: 'tenant',
    created_at: timestamp,
    createdAt: timestamp,
  };
}

function dedupeThread(entries = []) {
  const seen = new Set();
  return entries.filter((entry, index) => {
    if (!entry) return false;
    const key = entry.update_id || `${entry.type || 'reply'}:${entry.created_at || index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTenantThread(request = {}) {
  const sources = [
    ...(Array.isArray(request.publicReplies) ? request.publicReplies : []),
    ...(Array.isArray(request.tenantReplies) ? request.tenantReplies : []),
    ...(Array.isArray(request.conversation) ? request.conversation : []),
    ...(Array.isArray(request.updates) ? request.updates : []),
  ];

  return dedupeThread(sources.map(mapPublicReplyForTenant).filter(Boolean))
    .sort((left, right) => getEntryTimeValue(left) - getEntryTimeValue(right));
}

function latestTenantVisibleUpdate(thread = []) {
  return [...thread].sort((left, right) => getEntryTimeValue(right) - getEntryTimeValue(left))[0] || null;
}

function asObjectId(value) {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  return null;
}

function sanitizeBranch(value) {
  if (typeof value !== 'string') return null;
  const branch = value.trim();
  return branch || null;
}

function actorNameFromUser(user) {
  if (!user) return null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return user.name || user.fullName || fullName || user.email || user.user_id || null;
}

function requestTimestampValue(request) {
  const dt = request?.created_at || request?.createdAt || 0;
  const time = new Date(dt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function stripInternalRequestFields(request) {
  if (!request) return request;
  const clean = { ...request };
  clean._id = undefined;
  delete clean.__source_collection;
  return clean;
}

function stripTenantRequestFields(request) {
  const clean = stripInternalRequestFields(request);
  if (!clean) return clean;
  const thread = buildTenantThread(clean);
  const latestUpdate = latestTenantVisibleUpdate(thread);

  delete clean.notes;
  delete clean.resolution_note;
  delete clean.completionNote;
  delete clean.work_log;
  delete clean.workLog;
  delete clean.statusHistory;
  delete clean.internalLogs;

  clean.attachments = normalizeAttachmentList(clean.attachments);
  clean.conversation = thread;
  clean.updates = thread;
  clean.thread = thread;
  clean.publicReplies = thread;
  clean.tenantReplies = thread;
  clean.latestTenantVisibleUpdate = latestUpdate
    ? {
        update_id: latestUpdate.update_id,
        type: latestUpdate.type,
        title: latestUpdate.title,
        senderName: latestUpdate.senderName,
        senderRole: latestUpdate.senderRole,
        preview: latestUpdate.message || (latestUpdate.attachments?.length ? `${latestUpdate.attachments.length} attachment${latestUpdate.attachments.length > 1 ? 's' : ''} sent.` : latestUpdate.title),
        hasAttachments: Array.isArray(latestUpdate.attachments) && latestUpdate.attachments.length > 0,
        attachmentCount: Array.isArray(latestUpdate.attachments) ? latestUpdate.attachments.length : 0,
        created_at: latestUpdate.created_at,
      }
    : null;

  return clean;
}

function normalizeRequestForPrimary(request, user = {}) {
  const now = new Date();
  const normalized = { ...request };

  delete normalized._id;
  delete normalized.__source_collection;

  normalized.request_id = normalized.request_id || `maint_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
  normalized.user_id = normalized.user_id || user.user_id || null;
  if (!normalized.userId && user._id) {
    normalized.userId = asObjectId(user._id) || user._id;
  }

  normalized.request_type = normalized.request_type || 'other';
  normalized.description = normalized.description || '';
  normalized.urgency = VALID_URGENCIES.includes(normalized.urgency) ? normalized.urgency : 'normal';
  normalized.status = normalized.status || 'pending';
  normalized.assigned_to = normalized.assigned_to ?? null;
  normalized.notes = normalized.notes ?? null;
  normalized.reopen_note = normalized.reopen_note ?? null;

  normalized.attachments = normalizeAttachmentList(normalized.attachments);
  normalized.conversation = Array.isArray(normalized.conversation)
    ? normalized.conversation.map((entry) => ({
      ...entry,
      attachments: normalizeAttachmentList(entry?.attachments),
    }))
    : [];
  const publicReplies = buildTenantThread(normalized);
  normalized.publicReplies = publicReplies;
  normalized.tenantReplies = publicReplies;
  normalized.reopen_history = Array.isArray(normalized.reopen_history) ? normalized.reopen_history : [];
  normalized.statusHistory = Array.isArray(normalized.statusHistory) ? normalized.statusHistory : [];

  normalized.created_at = normalized.created_at || normalized.createdAt || now;
  normalized.updated_at = normalized.updated_at || normalized.updatedAt || now;
  normalized.createdAt = normalized.createdAt || normalized.created_at;
  normalized.updatedAt = normalized.updatedAt || normalized.updated_at;

  normalized.cancelled_at = normalized.cancelled_at ?? null;
  normalized.reopened_at = normalized.reopened_at ?? null;
  normalized.resolved_at = normalized.resolved_at ?? null;
  normalized.isArchived = typeof normalized.isArchived === 'boolean' ? normalized.isArchived : false;

  normalized.branch = sanitizeBranch(normalized.branch || user.branch || user.branchId) || null;
  normalized.reservationId = normalized.reservationId ?? null;
  normalized.roomId = normalized.roomId ?? null;

  return normalized;
}

async function resolveTenantContext(db, user) {
  const context = {
    branch: sanitizeBranch(user?.branch || user?.branchId),
    reservationId: null,
    roomId: null,
  };

  const mongoId = asObjectId(user?._id);
  if (!mongoId) return context;

  const reservation = await db.collection('reservations').findOne(
    {
      userId: mongoId,
      status: { $in: ACTIVE_RESERVATION_STATUSES },
      isArchived: { $ne: true },
    },
    {
      sort: { createdAt: -1 },
      projection: { _id: 1, roomId: 1, branch: 1 },
    }
  );

  if (reservation) {
    context.branch = sanitizeBranch(reservation.branch) || context.branch;
    context.reservationId = reservation._id || null;
    context.roomId = asObjectId(reservation.roomId) || reservation.roomId || null;
  }

  if (!context.roomId || !context.branch) {
    const bedHistory = await db.collection('bedhistories').findOne(
      { tenantId: mongoId, status: 'active' },
      { sort: { moveInDate: -1 }, projection: { roomId: 1, branch: 1 } }
    );

    if (bedHistory) {
      context.branch = sanitizeBranch(bedHistory.branch) || context.branch;
      context.roomId = context.roomId || asObjectId(bedHistory.roomId) || bedHistory.roomId || null;
    }
  }

  if (!context.roomId || !context.branch) {
    const occupancy = await db.collection('roomoccupancyhistories').findOne(
      { tenantId: mongoId, stayStatus: 'active' },
      { sort: { moveInDate: -1 }, projection: { roomId: 1, branchId: 1 } }
    );

    if (occupancy) {
      context.branch = sanitizeBranch(occupancy.branchId) || context.branch;
      context.roomId = context.roomId || asObjectId(occupancy.roomId) || occupancy.roomId || null;
    }
  }

  if (!context.branch && context.roomId) {
    const roomObjectId = asObjectId(context.roomId);
    const roomFilter = roomObjectId
      ? { _id: roomObjectId }
      : { room_id: String(context.roomId) };

    const room = await db.collection('rooms').findOne(roomFilter, {
      projection: { branch: 1, branchId: 1 },
    });

    context.branch = sanitizeBranch(room?.branch || room?.branchId) || context.branch;
  }

  return context;
}

function dedupeRequests(requests) {
  const map = new Map();

  for (const request of requests) {
    const key = request.request_id || String(request._id);
    const previous = map.get(key);

    if (!previous) {
      map.set(key, request);
      continue;
    }

    // Prefer canonical collection entries when duplicate request_id exists.
    if (
      previous.__source_collection === LEGACY_COLLECTION
      && request.__source_collection === PRIMARY_COLLECTION
    ) {
      map.set(key, request);
    }
  }

  return Array.from(map.values());
}

async function loadRequestsAcrossCollections(db, filter) {
  const records = [];

  for (const collectionName of COLLECTIONS) {
    try {
      const docs = await db.collection(collectionName).find(filter).toArray();
      records.push(...docs.map((doc) => ({ ...doc, __source_collection: collectionName })));
    } catch (_) {
      // Ignore missing legacy collections; keep serving from available source.
    }
  }

  return dedupeRequests(records)
    .sort((left, right) => requestTimestampValue(right) - requestTimestampValue(left));
}

async function findRequestForUser(db, requestId, userId) {
  for (const collectionName of [PRIMARY_COLLECTION, LEGACY_COLLECTION]) {
    try {
      const request = await db.collection(collectionName).findOne({
        request_id: requestId,
        user_id: userId,
      });

      if (request) {
        return { request, collectionName };
      }
    } catch (_) {
      // Continue lookup in other collection.
    }
  }

  return null;
}

async function findRequestForAdmin(db, requestId) {
  for (const collectionName of [PRIMARY_COLLECTION, LEGACY_COLLECTION]) {
    try {
      const request = await db.collection(collectionName).findOne({ request_id: requestId });
      if (request) {
        return { request, collectionName };
      }
    } catch (_) {
      // Continue lookup in other collection.
    }
  }

  return null;
}

async function promoteRequestToPrimary(db, request, user = {}) {
  const normalized = normalizeRequestForPrimary(request, user);

  await db.collection(PRIMARY_COLLECTION).updateOne(
    { request_id: normalized.request_id },
    { $set: normalized },
    { upsert: true }
  );

  return db.collection(PRIMARY_COLLECTION).findOne({ request_id: normalized.request_id });
}

// Get user's maintenance requests
async function getMyMaintenance(req, res) {
  try {
    const db = getDb();
    const userId = req.user.user_id;
    const mongoId = asObjectId(req.user._id);
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const filter = {
      $or: [
        { user_id: userId },
        ...(mongoId ? [{ userId: mongoId }] : []),
      ],
    };

    if (status) {
      filter.status = status;
    }

    const requests = await loadRequestsAcrossCollections(db, filter);
    res.json(requests.map(stripTenantRequestFields));
  } catch (error) {
    console.error('Get maintenance error:', error);
    res.status(500).json({ detail: 'Failed to fetch maintenance requests' });
  }
}

// Get one tenant-owned maintenance request with public admin replies.
async function getMaintenanceDetail(req, res) {
  try {
    const db = getDb();
    const { requestId } = req.params;
    const located = await findRequestForUser(db, requestId, req.user.user_id);

    if (!located) {
      return res.status(404).json({ detail: 'Request not found' });
    }

    const payload = stripTenantRequestFields(located.request);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[mobile maintenance:detail]', {
        requestId,
        threadCount: Array.isArray(payload.thread) ? payload.thread.length : 0,
        replyAttachmentCount: Array.isArray(payload.thread)
          ? payload.thread.reduce((count, entry) => count + (Array.isArray(entry.attachments) ? entry.attachments.length : 0), 0)
          : 0,
      });
    }
    res.json(payload);
  } catch (error) {
    console.error('Get maintenance detail error:', error);
    res.status(500).json({ detail: 'Failed to fetch maintenance request' });
  }
}

async function sendTenantReply(req, res) {
  try {
    const db = getDb();
    const { requestId } = req.params;
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const attachments = normalizeAttachmentList(req.body?.attachments);

    if (!message && attachments.length === 0) {
      return res.status(400).json({ detail: 'Message or attachment is required' });
    }
    if (Array.isArray(req.body?.attachments) && req.body.attachments.length > MAX_TENANT_ATTACHMENTS) {
      return res.status(400).json({ detail: `A maximum of ${MAX_TENANT_ATTACHMENTS} attachments is allowed.` });
    }
    const sizeCheck = await assertAttachmentsWithinSizeLimit(attachments);
    if (!sizeCheck.ok) {
      return res.status(400).json({ detail: sizeCheck.detail });
    }

    const located = await findRequestForUser(db, requestId, req.user.user_id);
    if (!located) {
      return res.status(404).json({ detail: 'Request not found' });
    }

    // Blocks replies on already-closed-out requests, matching the currently-
    // live standalone mobile backend (and the frontend's own
    // canReplyToRequest gate in app/(tabs)/services.jsx, which already hides
    // the reply box for resolved/completed/cancelled/rejected). Phase 4.5
    // cutover audit found this canonical guard previously only blocked
    // cancelled/closed/rejected, silently allowing replies to pile up on an
    // already-resolved/completed request.
    const closedStatuses = ['cancelled', 'closed', 'rejected', 'resolved', 'completed'];
    if (closedStatuses.includes(String(located.request.status || '').toLowerCase())) {
      return res.status(400).json({ detail: 'This request is closed.' });
    }

    const now = new Date();
    const reply = {
      update_id: `reply_${uuidv4().replace(/-/g, '').substring(0, 12)}`,
      type: 'tenant_reply',
      kind: 'tenant_reply',
      visibility: 'tenant',
      visibleToTenant: true,
      isTenantVisible: true,
      message,
      attachments,
      sender_id: req.user.user_id || null,
      sender_name: actorNameFromUser(req.user),
      sender_role: 'tenant',
      sender_side: 'tenant',
      created_at: now,
      createdAt: now,
    };
    const conversation = Array.isArray(located.request.conversation)
      ? [...located.request.conversation, reply]
      : [reply];
    const publicReplies = Array.isArray(located.request.publicReplies)
      ? [...located.request.publicReplies, reply]
      : [reply];

    await db.collection(located.collectionName).updateOne(
      { request_id: requestId },
      {
        $set: {
          conversation,
          publicReplies,
          tenantReplies: publicReplies,
          updated_at: now,
          updatedAt: now,
        },
      }
    );

    const updatedSource = await db.collection(located.collectionName).findOne({ request_id: requestId });
    const updated = await promoteRequestToPrimary(db, updatedSource, req.user)
      .catch(() => updatedSource);
    res.status(201).json(stripTenantRequestFields(updated));
  } catch (error) {
    console.error('Tenant maintenance reply error:', error);
    res.status(500).json({ detail: 'Failed to send maintenance reply' });
  }
}

// Create maintenance request
async function createMaintenance(req, res) {
  try {
    const db = getDb();
    const requestType = typeof req.body?.request_type === 'string'
      ? req.body.request_type.trim()
      : '';
    const description = typeof req.body?.description === 'string'
      ? req.body.description.trim()
      : '';
    const urgencyRaw = typeof req.body?.urgency === 'string'
      ? req.body.urgency.trim().toLowerCase()
      : 'normal';
    const attachmentsRaw = req.body?.attachments;

    if (!requestType) {
      return res.status(400).json({ detail: 'request_type is required' });
    }
    if (!VALID_REQUEST_TYPES.includes(requestType)) {
      return res.status(400).json({ detail: 'Validation failed.', errors: { request_type: `request_type must be one of: ${VALID_REQUEST_TYPES.join(', ')}` } });
    }
    if (!description) {
      return res.status(400).json({ detail: 'description is required' });
    }
    if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
      return res.status(400).json({ detail: 'Validation failed.', errors: { description: `description must be between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.` } });
    }
    if (Array.isArray(attachmentsRaw) && attachmentsRaw.length > MAX_TENANT_ATTACHMENTS) {
      return res.status(400).json({ detail: `A maximum of ${MAX_TENANT_ATTACHMENTS} attachments is allowed.` });
    }

    const urgency = VALID_URGENCIES.includes(urgencyRaw) ? urgencyRaw : 'normal';
    const attachments = normalizeAttachmentList(attachmentsRaw);
    const sizeCheck = await assertAttachmentsWithinSizeLimit(attachments);
    if (!sizeCheck.ok) {
      return res.status(400).json({ detail: sizeCheck.detail });
    }

    const tenantContext = await resolveTenantContext(db, req.user);
    const now = new Date();

    const newRequest = normalizeRequestForPrimary(
      {
        request_id: `maint_${uuidv4().replace(/-/g, '').substring(0, 12)}`,
        user_id: req.user.user_id,
        ...(req.user._id ? { userId: asObjectId(req.user._id) || req.user._id } : {}),
        request_type: requestType,
        description,
        urgency,
        status: 'pending',
        assigned_to: null,
        notes: null,
        attachments,
        reopen_note: null,
        reopen_history: [],
        statusHistory: [
          {
            event: 'submitted',
            status: 'pending',
            actor_id: req.user.user_id || null,
            actor_name: actorNameFromUser(req.user),
            actor_role: req.user.role || null,
            note: null,
            timestamp: now,
          },
        ],
        branch: tenantContext.branch,
        reservationId: tenantContext.reservationId,
        roomId: tenantContext.roomId,
        isArchived: false,
        created_at: now,
        updated_at: now,
        createdAt: now,
        updatedAt: now,
      },
      req.user,
    );

    await db.collection(PRIMARY_COLLECTION).insertOne(newRequest);
    res.status(201).json(stripTenantRequestFields(newRequest));
  } catch (error) {
    console.error('Create maintenance error:', error);
    res.status(500).json({ detail: 'Failed to create maintenance request' });
  }
}

// Update maintenance request (only when pending)
async function updateMaintenance(req, res) {
  try {
    const { requestId } = req.params;
    const { request_type, description, urgency } = req.body;
    const db = getDb();

    const located = await findRequestForUser(db, requestId, req.user.user_id);
    if (!located) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    if ((located.request.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ detail: 'Only pending requests can be edited' });
    }

    const updates = { updated_at: new Date(), updatedAt: new Date() };

    if (typeof request_type === 'string' && request_type.trim()) {
      updates.request_type = request_type.trim();
    }
    if (description !== undefined) {
      updates.description = typeof description === 'string' ? description.trim() : '';
    }
    if (typeof urgency === 'string' && VALID_URGENCIES.includes(urgency.trim().toLowerCase())) {
      updates.urgency = urgency.trim().toLowerCase();
    }

    await db.collection(located.collectionName).updateOne(
      { request_id: requestId },
      { $set: updates }
    );

    const updatedSource = await db.collection(located.collectionName).findOne({ request_id: requestId });
    const updated = await promoteRequestToPrimary(db, updatedSource, req.user)
      .catch(() => updatedSource);
    res.json(stripTenantRequestFields(updated));
  } catch (error) {
    console.error('Update maintenance error:', error);
    res.status(500).json({ detail: 'Failed to update maintenance request' });
  }
}

// Cancel maintenance request (only when pending)
async function cancelMaintenance(req, res) {
  try {
    const { requestId } = req.params;
    const db = getDb();

    const located = await findRequestForUser(db, requestId, req.user.user_id);
    if (!located) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    if ((located.request.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ detail: 'Only pending requests can be cancelled' });
    }

    const now = new Date();
    const statusHistory = Array.isArray(located.request.statusHistory)
      ? [...located.request.statusHistory]
      : [];
    statusHistory.push({
      event: 'cancelled',
      status: 'cancelled',
      actor_id: req.user.user_id || null,
      actor_name: actorNameFromUser(req.user),
      actor_role: req.user.role || null,
      note: null,
      timestamp: now,
    });

    await db.collection(located.collectionName).updateOne(
      { request_id: requestId },
      {
        $set: {
          status: 'cancelled',
          cancelled_at: now,
          statusHistory,
          updated_at: now,
          updatedAt: now,
        },
      }
    );

    const updatedSource = await db.collection(located.collectionName).findOne({ request_id: requestId });
    const updated = await promoteRequestToPrimary(db, updatedSource, req.user)
      .catch(() => updatedSource);
    res.json(stripTenantRequestFields(updated));
  } catch (error) {
    console.error('Cancel maintenance error:', error);
    res.status(500).json({ detail: 'Failed to cancel maintenance request' });
  }
}

// Reopen a resolved/completed request
async function reopenMaintenance(req, res) {
  try {
    const { requestId } = req.params;
    const { reopen_note } = req.body;
    const db = getDb();

    const located = await findRequestForUser(db, requestId, req.user.user_id);
    if (!located) {
      return res.status(404).json({ detail: 'Request not found' });
    }

    const reopenableStatuses = ['resolved', 'completed'];
    if (!reopenableStatuses.includes((located.request.status || '').toLowerCase())) {
      return res.status(400).json({ detail: 'Only resolved or completed requests can be reopened' });
    }

    const now = new Date();
    const note = typeof reopen_note === 'string' && reopen_note.trim()
      ? reopen_note.trim()
      : null;

    const reopenHistory = Array.isArray(located.request.reopen_history)
      ? [...located.request.reopen_history]
      : [];
    reopenHistory.push({
      reopened_at: now,
      previous_status: located.request.status,
      note,
    });

    const statusHistory = Array.isArray(located.request.statusHistory)
      ? [...located.request.statusHistory]
      : [];
    statusHistory.push({
      event: 'reopened',
      status: 'pending',
      actor_id: req.user.user_id || null,
      actor_name: actorNameFromUser(req.user),
      actor_role: req.user.role || null,
      note,
      timestamp: now,
    });

    await db.collection(located.collectionName).updateOne(
      { request_id: requestId },
      {
        $set: {
          status: 'pending',
          reopen_note: note,
          reopen_history: reopenHistory,
          reopened_at: now,
          statusHistory,
          updated_at: now,
          updatedAt: now,
        },
      }
    );

    const updatedSource = await db.collection(located.collectionName).findOne({ request_id: requestId });
    const updated = await promoteRequestToPrimary(db, updatedSource, req.user)
      .catch(() => updatedSource);
    res.json(stripTenantRequestFields(updated));
  } catch (error) {
    console.error('Reopen maintenance error:', error);
    res.status(500).json({ detail: 'Failed to reopen maintenance request' });
  }
}

// Tenant confirms a resolved request is actually fixed (resolved -> completed).
// Phase 4.5 cutover audit found this handler/route was entirely missing from
// canonical — the app's "Confirm Resolved" button had no backing endpoint
// and would 404. Matches the currently-live standalone mobile backend's
// resolved-only transition rule (never completed->completed, never from any
// other status) and sets tenant_confirmed_resolved so the frontend's own
// button-gating condition (`!detailRequest.tenant_confirmed_resolved`) hides
// both this button and "Still an Issue" afterward.
async function confirmMaintenanceResolved(req, res) {
  try {
    const { requestId } = req.params;
    const db = getDb();

    const located = await findRequestForUser(db, requestId, req.user.user_id);
    if (!located) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    if ((located.request.status || '').toLowerCase() !== 'resolved') {
      return res.status(400).json({ detail: 'Only resolved requests can be confirmed.' });
    }

    const now = new Date();
    const statusHistory = Array.isArray(located.request.statusHistory)
      ? [...located.request.statusHistory]
      : [];
    statusHistory.push({
      event: 'tenant_confirmed_resolved',
      status: 'completed',
      actor_id: req.user.user_id || null,
      actor_name: actorNameFromUser(req.user),
      actor_role: req.user.role || null,
      note: null,
      timestamp: now,
    });

    await db.collection(located.collectionName).updateOne(
      { request_id: requestId },
      {
        $set: {
          status: 'completed',
          tenant_confirmed_resolved: true,
          resolved_at: located.request.resolved_at || now,
          statusHistory,
          updated_at: now,
          updatedAt: now,
        },
      }
    );

    const updatedSource = await db.collection(located.collectionName).findOne({ request_id: requestId });
    const updated = await promoteRequestToPrimary(db, updatedSource, req.user)
      .catch(() => updatedSource);
    res.json(stripTenantRequestFields(updated));
  } catch (error) {
    console.error('Confirm maintenance resolved error:', error);
    res.status(500).json({ detail: 'Failed to confirm maintenance request as resolved' });
  }
}

// Admin: update maintenance request status and notify tenant
async function adminUpdateStatus(req, res) {
  try {
    const { requestId } = req.params;
    const { status, notes, assigned_to } = req.body;
    const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';

    if (!normalizedStatus || !VALID_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({ detail: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const db = getDb();
    const located = await findRequestForAdmin(db, requestId);
    if (!located) {
      return res.status(404).json({ detail: 'Request not found' });
    }

    const now = new Date();
    const statusHistory = Array.isArray(located.request.statusHistory)
      ? [...located.request.statusHistory]
      : [];
    statusHistory.push({
      event: 'status_changed',
      status: normalizedStatus,
      actor_id: req.user?.user_id || null,
      actor_name: actorNameFromUser(req.user),
      actor_role: req.user?.role || null,
      note: typeof notes === 'string' ? notes.trim() : null,
      timestamp: now,
    });

    const updates = {
      status: normalizedStatus,
      statusHistory,
      updated_at: now,
      updatedAt: now,
    };

    if (notes !== undefined) {
      updates.notes = typeof notes === 'string' ? notes.trim() : null;
    }
    if (assigned_to !== undefined) {
      updates.assigned_to = typeof assigned_to === 'string' ? assigned_to.trim() : null;
    }
    if (['resolved', 'completed'].includes(normalizedStatus)) {
      updates.resolved_at = now;
    }
    if (['pending', 'viewed', 'in_progress'].includes(normalizedStatus)) {
      updates.cancelled_at = null;
    }

    await db.collection(located.collectionName).updateOne(
      { request_id: requestId },
      { $set: updates }
    );

    const updatedSource = await db.collection(located.collectionName).findOne({ request_id: requestId });
    const updated = await promoteRequestToPrimary(db, updatedSource, req.user)
      .catch(() => updatedSource);

    // Notify the tenant (non-blocking)
    notifyMaintenanceStatusChange(updated?.user_id || located.request.user_id, updated || located.request, normalizedStatus)
      .catch(() => {});

    res.json(stripInternalRequestFields(updated));
  } catch (error) {
    console.error('Admin update maintenance status error:', error);
    res.status(500).json({ detail: 'Failed to update maintenance request status' });
  }
}

// Admin: get all maintenance requests
async function adminGetAll(req, res) {
  try {
    const db = getDb();
    const { status, user_id, request_type, urgency, branch } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (user_id) filter.user_id = user_id;
    if (request_type) filter.request_type = request_type;
    if (urgency) filter.urgency = urgency;
    if (branch) filter.branch = branch;

    const requests = await loadRequestsAcrossCollections(db, filter);
    res.json(requests.map(stripInternalRequestFields));
  } catch (error) {
    console.error('Admin get maintenance error:', error);
    res.status(500).json({ detail: 'Failed to fetch maintenance requests' });
  }
}

module.exports = {
  getMyMaintenance,
  getMaintenanceDetail,
  createMaintenance,
  sendTenantReply,
  updateMaintenance,
  cancelMaintenance,
  reopenMaintenance,
  confirmMaintenanceResolved,
  adminUpdateStatus,
  adminGetAll,
};
