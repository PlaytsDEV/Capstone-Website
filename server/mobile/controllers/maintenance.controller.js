const { v4: uuidv4 } = require('uuid');
const { Types: { ObjectId } } = require('mongoose');
const { getDb } = require('../config/database');
const { notifyMaintenanceStatusChange } = require('../services/pushService');
const { admin, resolveFirebaseStorageBucket } = require('../config/firebase');

// Canonical collection used by the website backend (Mongoose model collection).
const PRIMARY_COLLECTION = 'maintenance_requests';

// Legacy collection used by earlier mobile/backend builds.
const LEGACY_COLLECTION = 'maintenancerequests';

// Read from both so old records still appear while new records land in primary.
const COLLECTIONS = [...new Set([PRIMARY_COLLECTION, LEGACY_COLLECTION])];

// Optional client-supplied retry key (Phase 4A reconciliation): lets the app
// safely retry a maintenance submission (e.g. after a dropped response) with
// a guarantee that only one ticket is ever created for that (tenant, key)
// pair. Absent on older app builds, which keep working exactly as before —
// nothing below this file requires the field.
const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Lazily create the uniqueness constraint the first time it's needed, the
// same way auth.controller.js does for its otp_store TTL index — avoids a
// separate migration step while still guaranteeing the index exists before
// any insert that depends on it for concurrency safety. Partial so historic
// rows (and any future submission without a key) never collide with each
// other on the absent field.
let clientRequestIdIndexPromise = null;
function ensureClientRequestIdIndex(db) {
  // Tolerant of "an equivalent index already exists" (MongoDB error codes 85
  // IndexOptionsConflict / 86 IndexKeySpecsConflict): the Mongoose model
  // (models/MaintenanceRequest.js) declares this same { user_id,
  // client_request_id } partial-unique index and may have already built it
  // under its own auto-generated name via autoIndex before this lazy call
  // ever runs. Either name enforces the same constraint, so a conflict here
  // just means the guarantee this function exists for is already in place —
  // it must not fail the request that triggered it.
  clientRequestIdIndexPromise ||= db.collection(PRIMARY_COLLECTION).createIndex(
    { user_id: 1, client_request_id: 1 },
    {
      name: 'user_client_request_id_unique',
      unique: true,
      partialFilterExpression: { client_request_id: { $type: 'string' } },
    },
  ).catch((error) => {
    if (error?.code === 85 || error?.code === 86) return null;
    throw error;
  });
  return clientRequestIdIndexPromise;
}

const ACTIVE_RESERVATION_STATUSES = ['moveIn', 'active', 'completed', 'confirmed'];
const VALID_URGENCIES = ['low', 'normal', 'high', 'urgent', 'emergency'];
const VALID_STATUSES = [
  'pending',
  'pending_review',
  'provider_assigned',
  'scheduled',
  'viewed',
  'reviewed',
  'in_progress',
  'waiting_tenant',
  'resolved',
  'completed',
  'reopened',
  'rejected',
  'cancelled',
  'closed',
];

// Matches the canonical maintenance request types while supporting legacy mobile categories
const VALID_REQUEST_TYPES = [
  'maintenance',
  'plumbing',
  'electrical',
  'aircon',
  'elevator',
  'furniture',
  'internet',
  'cleaning',
  'pest',
  'other',
];

const LEGACY_TYPE_MAP = Object.freeze({
  hardware: 'maintenance',
  appliance: 'maintenance',
  air_conditioning: 'aircon',
  'air-conditioning': 'aircon',
  furniture_fixture: 'furniture',
  'furniture/fixture': 'furniture',
  internet_network: 'internet',
  'internet/network': 'internet',
  network: 'internet',
  pest_control: 'pest',
  'pest control': 'pest',
});

const LEGACY_URGENCY_MAP = Object.freeze({
  medium: 'normal',
});

const TYPE_LABELS = Object.freeze({
  maintenance: 'Maintenance',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  aircon: 'Air Conditioning',
  elevator: 'Elevator',
  furniture: 'Furniture / Fixture',
  internet: 'Internet / Network',
  cleaning: 'Cleaning',
  pest: 'Pest Control',
  other: 'Other',
});

function normalizeMaintenanceType(value) {
  if (value == null) return '';
  const normalized = String(value).trim().toLowerCase();
  return LEGACY_TYPE_MAP[normalized] || normalized;
}

function normalizeMaintenanceUrgency(value) {
  if (value == null) return 'normal';
  const normalized = String(value).trim().toLowerCase();
  return LEGACY_URGENCY_MAP[normalized] || (VALID_URGENCIES.includes(normalized) ? normalized : 'normal');
}

function formatRequestTypeLabel(type) {
  const normalized = normalizeMaintenanceType(type);
  return TYPE_LABELS[normalized] || (type ? String(type).charAt(0).toUpperCase() + String(type).slice(1) : 'Maintenance');
}

function buildLegacyDescription(title, description) {
  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  const trimmedDescription = typeof description === 'string' ? description.trim() : '';

  if (!trimmedTitle) return trimmedDescription;
  if (!trimmedDescription) return trimmedTitle;
  if (trimmedDescription.toLowerCase().startsWith(trimmedTitle.toLowerCase())) {
    return trimmedDescription;
  }
  return `${trimmedTitle}\n\n${trimmedDescription}`;
}

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
  'status_update',
  'internal_note',
  'internal_log',
  'admin_log',
  'workflow_action',
  'viewed',
  'processing',
  'draft_saved',
  'tenant_submitted',
  'tenant_cancelled',
  'tenant_reopened',
  'tenant_confirmed_resolved',
  'audit',
  'history',
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
  if (!entry) return null;
  if (typeof entry === 'object') {
    if (entry.isRemoved === true || entry.visibility === 'admin_only') {
      return null;
    }
  }

  const uri = getAttachmentUri(entry);
  if (!uri || !isRemoteUri(uri)) return null;

  const name = getAttachmentName(entry, uri, index);
  const type = inferAttachmentType(entry, name, uri);
  const normalized = {
    id: (typeof entry === 'object' && entry ? entry.id || entry.attachmentId || entry.storagePath : null) || uri || `att_${index}`,
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

  // 1. Strip internal notes, work logs, logs, and deduplication hashes
  delete clean.notes;
  delete clean.resolution_note;
  delete clean.resolutionNote;
  delete clean.completionNote;
  delete clean.work_log;
  delete clean.workLog;
  delete clean.statusHistory;
  delete clean.internalLogs;
  delete clean.deduplicationHash;

  // 2. Strip vendor/provider private contacts, internal IDs, and internal assignees
  delete clean.assignedProviderContact;
  delete clean.assignedProviderNotes;
  delete clean.assignedProviderSource;
  delete clean.assignedProviderId;
  delete clean.assigned_to;
  delete clean.assignedTo;
  delete clean.assignedBy;
  delete clean.assignedByName;
  delete clean.assignedByRole;

  // 3. Provider details sanitization
  const tenantVisibleLabel =
    clean.providerDetails?.tenantVisibleLabel ||
    (clean.providerDetails?.providerType === 'IN_HOUSE'
      ? 'LilyCrest Facilities Team'
      : clean.providerDetails?.providerType === 'EXTERNAL'
        ? (clean.assignedProviderCategory
            ? `Authorized ${clean.assignedProviderCategory} Specialist`
            : 'Authorized External Specialist')
        : (clean.assigned_to || clean.assignedProviderName
            ? 'LilyCrest Facilities Team'
            : null));

  clean.providerDetails = {
    providerType: clean.providerDetails?.providerType || null,
    tenantVisibleLabel,
  };
  clean.provider_details = clean.providerDetails;
  clean.tenantVisibleProviderLabel = tenantVisibleLabel;

  // 4. Completion report sanitization: hide if draft or not finalized
  if (clean.completionReport) {
    if (clean.completionReport.isDraft || (!clean.completionReport.summary && !clean.completionReport.reportId)) {
      clean.completionReport = null;
      clean.completion_report = null;
    } else {
      const sanitizedReport = {
        reportId: clean.completionReport.reportId || null,
        isDraft: false,
        summary: clean.completionReport.summary || null,
        workDone: clean.completionReport.workDone || null,
        partsReplaced: clean.completionReport.partsReplaced || null,
        preventiveAdvice: clean.completionReport.preventiveAdvice || null,
        finalizedByName: clean.completionReport.finalizedByName || 'LilyCrest Management',
        finalizedAt: clean.completionReport.finalizedAt || null,
        reportUrl: clean.completionReport.reportUrl || null,
      };
      clean.completionReport = sanitizedReport;
      clean.completion_report = sanitizedReport;
    }
  } else {
    clean.completionReport = null;
    clean.completion_report = null;
  }

  // 5. Cost breakdown: hide private internal costs unless tenant is chargeable
  const isChargeable = Boolean(clean.costBreakdown?.isTenantChargeable);
  if (!isChargeable) {
    clean.estimatedCost = 0;
    clean.actualCost = 0;
    clean.costBreakdown = {
      laborCost: 0,
      materialsCost: 0,
      totalCost: 0,
      isTenantChargeable: false,
      chargeReason: null,
      billId: null,
    };
  } else {
    clean.estimatedCost = Number(clean.estimatedCost || clean.costBreakdown?.totalCost || 0);
    clean.actualCost = Number(clean.actualCost || clean.costBreakdown?.totalCost || 0);
    clean.costBreakdown = {
      laborCost: Number(clean.costBreakdown?.laborCost || 0),
      materialsCost: Number(clean.costBreakdown?.materialsCost || 0),
      totalCost: Number(clean.costBreakdown?.totalCost || clean.actualCost || 0),
      isTenantChargeable: true,
      chargeReason: clean.costBreakdown?.chargeReason || null,
      billId: clean.costBreakdown?.billId ? String(clean.costBreakdown.billId) : null,
    };
  }

  // 6. Filter attachments for tenant visibility (strip admin_only & removed)
  clean.attachments = normalizeAttachmentList(clean.attachments);
  clean.photos = clean.attachments;
  clean.images = clean.attachments;

  // 7. Conversation thread
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

  // 8. Aliases and canonical fields
  clean.id = clean.request_id || String(clean._id || '');
  clean.category = clean.request_type || 'other';
  clean.title = clean.title || `${formatRequestTypeLabel(clean.request_type)} Request`;
  clean.ticketNumber = clean.ticketNumber || `MNT-${new Date(clean.created_at || Date.now()).getFullYear()}-${String(clean.request_id || clean.id || '0000').slice(-4).toUpperCase()}`;
  clean.ticket_number = clean.ticketNumber;
  clean.reopenCount = typeof clean.reopenCount === 'number' ? clean.reopenCount : (Array.isArray(clean.reopen_history) ? clean.reopen_history.length : 0);
  clean.reopen_count = clean.reopenCount;
  clean.tenant_confirmed_resolved = Boolean(clean.tenant_confirmed_resolved || clean.resolutionConfirmation?.confirmedAt);

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
    occupancyContext: {
      unitNumber: null,
      bedNumber: null,
      floor: null,
    },
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
      projection: { _id: 1, roomId: 1, branch: 1, bedNumber: 1, bed: 1, roomNumber: 1 },
    }
  );

  if (reservation) {
    context.branch = sanitizeBranch(reservation.branch) || context.branch;
    context.reservationId = reservation._id || null;
    context.roomId = asObjectId(reservation.roomId) || reservation.roomId || null;
    if (reservation.bedNumber || reservation.bed) {
      context.occupancyContext.bedNumber = reservation.bedNumber || reservation.bed || null;
    }
    if (reservation.roomNumber) {
      context.occupancyContext.unitNumber = reservation.roomNumber;
    }
  }

  if (!context.roomId || !context.branch) {
    const bedHistory = await db.collection('bedhistories').findOne(
      { tenantId: mongoId, status: 'active' },
      { sort: { moveInDate: -1 }, projection: { roomId: 1, branch: 1, bedNumber: 1 } }
    );

    if (bedHistory) {
      context.branch = sanitizeBranch(bedHistory.branch) || context.branch;
      context.roomId = context.roomId || asObjectId(bedHistory.roomId) || bedHistory.roomId || null;
      if (bedHistory.bedNumber && !context.occupancyContext.bedNumber) {
        context.occupancyContext.bedNumber = bedHistory.bedNumber;
      }
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

  if (context.roomId) {
    const roomObjectId = asObjectId(context.roomId);
    const roomFilter = roomObjectId
      ? { _id: roomObjectId }
      : { room_id: String(context.roomId) };

    const room = await db.collection('rooms').findOne(roomFilter, {
      projection: { branch: 1, branchId: 1, roomNumber: 1, name: 1, floor: 1 },
    });

    if (room) {
      context.branch = sanitizeBranch(room.branch || room.branchId) || context.branch;
      if (!context.occupancyContext.unitNumber) {
        context.occupancyContext.unitNumber = room.roomNumber || room.name || null;
      }
      if (typeof room.floor === 'number' && context.occupancyContext.floor === null) {
        context.occupancyContext.floor = room.floor;
      }
    }
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
      let request = await db.collection(collectionName).findOne({
        request_id: requestId,
        user_id: userId,
      });

      if (!request && ObjectId.isValid(requestId)) {
        request = await db.collection(collectionName).findOne({
          _id: asObjectId(requestId),
          user_id: userId,
        });
      }

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
      let request = await db.collection(collectionName).findOne({ request_id: requestId });
      if (!request && ObjectId.isValid(requestId)) {
        request = await db.collection(collectionName).findOne({ _id: asObjectId(requestId) });
      }
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
      isArchived: { $ne: true },
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
    const located = await findRequestForUser(db, requestId, req.user.user_id, req.user._id);

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
    const rawMessage = req.body?.message ?? req.body?.reply ?? req.body?.text ?? req.body?.body;
    const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    const attachmentsRaw = req.body?.attachments ?? req.body?.photos ?? req.body?.images;
    const attachments = normalizeAttachmentList(attachmentsRaw);

    if (!message && attachments.length === 0) {
      return res.status(400).json({ detail: 'Message or attachment is required' });
    }
    if (message && message.length > 1000) {
      return res.status(400).json({ detail: 'Reply message cannot exceed 1000 characters.' });
    }
    if (Array.isArray(attachmentsRaw) && attachmentsRaw.length > MAX_TENANT_ATTACHMENTS) {
      return res.status(400).json({ detail: `A maximum of ${MAX_TENANT_ATTACHMENTS} attachments is allowed.` });
    }
    const sizeCheck = await assertAttachmentsWithinSizeLimit(attachments);
    if (!sizeCheck.ok) {
      return res.status(400).json({ detail: sizeCheck.detail });
    }

    const located = await findRequestForUser(db, requestId, req.user.user_id, req.user._id);
    if (!located) {
      return res.status(404).json({ detail: 'Request not found' });
    }

    // Blocks replies on already-closed-out requests
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

    const updateDoc = {
      conversation,
      publicReplies,
      tenantReplies: publicReplies,
      updated_at: now,
      updatedAt: now,
    };

    if (located.request.status === 'waiting_tenant') {
      updateDoc.status = 'in_progress';
      const statusHistory = Array.isArray(located.request.statusHistory)
        ? [...located.request.statusHistory]
        : [];
      statusHistory.push({
        event: 'status_changed',
        status: 'in_progress',
        actor_id: req.user.user_id || null,
        actor_name: actorNameFromUser(req.user),
        actor_role: 'tenant',
        note: 'Tenant replied; status resumed to in_progress.',
        timestamp: now,
      });
      updateDoc.statusHistory = statusHistory;
    }

    await db.collection(located.collectionName).updateOne(
      { request_id: located.request.request_id || requestId },
      { $set: updateDoc }
    );

    const updatedSource = await db.collection(located.collectionName).findOne({
      request_id: located.request.request_id || requestId,
    });
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

    // Support both canonical and legacy field names: request_type / category / type
    const rawType = req.body?.request_type ?? req.body?.category ?? req.body?.type;
    const requestType = normalizeMaintenanceType(rawType);

    // Support both description and title + description
    const rawTitle = req.body?.title;
    const rawDescription = req.body?.description;
    const description = buildLegacyDescription(rawTitle, rawDescription);

    // Urgency support (including legacy 'medium' -> 'normal')
    const urgencyRaw = req.body?.urgency;
    const urgency = normalizeMaintenanceUrgency(urgencyRaw);

    // Attachments support: attachments, photos, images
    const attachmentsRaw = req.body?.attachments ?? req.body?.photos ?? req.body?.images;

    if (!rawType && rawType !== '') {
      return res.status(400).json({ detail: 'request_type is required' });
    }
    if (!requestType) {
      return res.status(400).json({ detail: 'request_type is required' });
    }
    if (!VALID_REQUEST_TYPES.includes(requestType)) {
      return res.status(400).json({
        detail: 'Validation failed.',
        errors: { request_type: `request_type must be one of: ${VALID_REQUEST_TYPES.join(', ')}` },
      });
    }
    if (!description) {
      return res.status(400).json({ detail: 'description is required' });
    }
    if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
      return res.status(400).json({
        detail: 'Validation failed.',
        errors: { description: `description must be between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.` },
      });
    }
    if (Array.isArray(attachmentsRaw) && attachmentsRaw.length > MAX_TENANT_ATTACHMENTS) {
      return res.status(400).json({ detail: `A maximum of ${MAX_TENANT_ATTACHMENTS} attachments is allowed.` });
    }

    const clientRequestIdRaw = typeof req.body?.client_request_id === 'string'
      ? req.body.client_request_id.trim()
      : '';
    if (clientRequestIdRaw && !CLIENT_REQUEST_ID_PATTERN.test(clientRequestIdRaw)) {
      return res.status(400).json({
        detail: 'Validation failed.',
        errors: { client_request_id: 'client_request_id must be 1-128 characters of letters, numbers, "_" or "-".' },
      });
    }
    const clientRequestId = clientRequestIdRaw || null;

    const attachments = normalizeAttachmentList(attachmentsRaw);
    const sizeCheck = await assertAttachmentsWithinSizeLimit(attachments);
    if (!sizeCheck.ok) {
      return res.status(400).json({ detail: sizeCheck.detail });
    }

    if (clientRequestId) {
      await ensureClientRequestIdIndex(db);
      const existing = await db.collection(PRIMARY_COLLECTION).findOne({
        user_id: req.user.user_id,
        client_request_id: clientRequestId,
      });
      if (existing) {
        return res.status(200).json(stripTenantRequestFields(existing));
      }
    }

    const tenantContext = await resolveTenantContext(db, req.user);
    const now = new Date();
    const year = now.getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `MNT-${year}-${randomSuffix}`;
    const requestId = `maint_${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    const newRequest = normalizeRequestForPrimary(
      {
        request_id: requestId,
        ticketNumber,
        user_id: req.user.user_id,
        ...(req.user._id ? { userId: asObjectId(req.user._id) || req.user._id } : {}),
        client_request_id: clientRequestId,
        request_type: requestType,
        description,
        urgency,
        status: 'pending',
        isReopened: false,
        assigned_to: null,
        notes: null,
        attachments,
        reopen_note: null,
        reopen_history: [],
        reopenCount: 0,
        resolutionConfirmation: null,
        occupancyContext: tenantContext.occupancyContext || {},
        providerDetails: {
          providerType: null,
          tenantVisibleLabel: null,
        },
        schedule: {},
        completionReport: null,
        costBreakdown: {
          laborCost: 0,
          materialsCost: 0,
          totalCost: 0,
          isTenantChargeable: false,
          chargeReason: null,
          billId: null,
        },
        statusHistory: [
          {
            event: 'submitted',
            status: 'pending',
            actor_id: req.user.user_id || null,
            actor_name: actorNameFromUser(req.user),
            actor_role: req.user.role || 'tenant',
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

    try {
      await db.collection(PRIMARY_COLLECTION).insertOne(newRequest);
    } catch (error) {
      if (clientRequestId && error?.code === 11000) {
        const winner = await db.collection(PRIMARY_COLLECTION).findOne({
          user_id: req.user.user_id,
          client_request_id: clientRequestId,
        });
        if (winner) {
          return res.status(200).json(stripTenantRequestFields(winner));
        }
      }
      throw error;
    }
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
    const db = getDb();

    const located = await findRequestForUser(db, requestId, req.user.user_id, req.user._id);
    if (!located) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    const request = located.request;
    const EDITABLE_STATUSES = ['pending', 'pending_review', 'viewed', 'reviewed'];
    if (!EDITABLE_STATUSES.includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: 'Requests can only be edited before a provider has been assigned.',
        error: 'INVALID_STATUS_FOR_EDIT',
      });
    }

    const updates = { updated_at: new Date(), updatedAt: new Date() };

    const rawType = req.body?.request_type ?? req.body?.category ?? req.body?.type;
    if (rawType !== undefined) {
      const normalizedType = normalizeMaintenanceType(rawType);
      if (!normalizedType || !VALID_REQUEST_TYPES.includes(normalizedType)) {
        return res.status(400).json({
          detail: 'Validation failed.',
          errors: { request_type: `request_type must be one of: ${VALID_REQUEST_TYPES.join(', ')}` },
        });
      }
      updates.request_type = normalizedType;
    }

    const rawTitle = req.body?.title;
    const rawDescription = req.body?.description;
    if (rawDescription !== undefined || rawTitle !== undefined) {
      const description = buildLegacyDescription(
        rawTitle ?? (rawDescription !== undefined ? '' : located.request.title),
        rawDescription ?? located.request.description,
      );
      if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
        return res.status(400).json({
          detail: 'Validation failed.',
          errors: { description: `description must be between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.` },
        });
      }
      updates.description = description;
    }

    const rawUrgency = req.body?.urgency;
    if (rawUrgency !== undefined) {
      const normalizedUrgency = normalizeMaintenanceUrgency(rawUrgency);
      if (!VALID_URGENCIES.includes(normalizedUrgency)) {
        return res.status(400).json({ detail: 'Invalid maintenance urgency' });
      }
      updates.urgency = normalizedUrgency;
    }

    const attachmentsRaw = req.body?.attachments ?? req.body?.photos ?? req.body?.images;
    if (attachmentsRaw !== undefined) {
      if (Array.isArray(attachmentsRaw) && attachmentsRaw.length > MAX_TENANT_ATTACHMENTS) {
        return res.status(400).json({ detail: `A maximum of ${MAX_TENANT_ATTACHMENTS} attachments is allowed.` });
      }
      const attachments = normalizeAttachmentList(attachmentsRaw);
      const sizeCheck = await assertAttachmentsWithinSizeLimit(attachments);
      if (!sizeCheck.ok) {
        return res.status(400).json({ detail: sizeCheck.detail });
      }
      updates.attachments = attachments;
    }

    await db.collection(located.collectionName).updateOne(
      { request_id: located.request.request_id || requestId },
      { $set: updates }
    );

    const updatedSource = await db.collection(located.collectionName).findOne({
      request_id: located.request.request_id || requestId,
    });
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

    const located = await findRequestForUser(db, requestId, req.user.user_id, req.user._id);
    if (!located) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    const request = located.request;
    const CANCELLABLE_STATUSES = ['pending', 'pending_review', 'viewed', 'reviewed'];
    if (!CANCELLABLE_STATUSES.includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: 'Requests can only be cancelled before a provider has been assigned.',
        error: 'INVALID_STATUS_FOR_CANCEL',
      });
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
      actor_role: req.user.role || 'tenant',
      note: null,
      timestamp: now,
    });

    await db.collection(located.collectionName).updateOne(
      { request_id: located.request.request_id || requestId },
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

    const updatedSource = await db.collection(located.collectionName).findOne({
      request_id: located.request.request_id || requestId,
    });
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
    const { reopen_note, note: bodyNote } = req.body || {};
    const db = getDb();

    const located = await findRequestForUser(db, requestId, req.user.user_id, req.user._id);
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
      : (typeof bodyNote === 'string' && bodyNote.trim() ? bodyNote.trim() : null);

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
      actor_role: req.user.role || 'tenant',
      note,
      timestamp: now,
    });

    const currentReopenCount = typeof located.request.reopenCount === 'number'
      ? located.request.reopenCount
      : (reopenHistory.length - 1);
    const reopenCount = currentReopenCount + 1;

    await db.collection(located.collectionName).updateOne(
      { request_id: located.request.request_id || requestId },
      {
        $set: {
          status: 'pending',
          isReopened: true,
          reopen_note: note,
          reopen_history: reopenHistory,
          reopenCount,
          reopened_at: now,
          resolved_at: null,
          work_started_at: null,
          resolution_note: null,
          tenant_confirmed_resolved: false,
          resolutionConfirmation: null,
          statusHistory,
          updated_at: now,
          updatedAt: now,
        },
      }
    );

    const updatedSource = await db.collection(located.collectionName).findOne({
      request_id: located.request.request_id || requestId,
    });
    const updated = await promoteRequestToPrimary(db, updatedSource, req.user)
      .catch(() => updatedSource);
    res.json(stripTenantRequestFields(updated));
  } catch (error) {
    console.error('Reopen maintenance error:', error);
    res.status(500).json({ detail: 'Failed to reopen maintenance request' });
  }
}

// Tenant confirms a resolved request is actually fixed (resolved -> completed).
// Matches the canonical resolution lifecycle and confirms issue resolution.
async function confirmMaintenanceResolved(req, res) {
  try {
    const { requestId } = req.params;
    const db = getDb();

    const located = await findRequestForUser(db, requestId, req.user.user_id, req.user._id);
    if (!located) {
      return res.status(404).json({ detail: 'Request not found' });
    }

    const action = String(req.body?.action || '').trim().toLowerCase();
    const isExplicitReopen = req.body?.confirmed === false || action === 'reopen' || action === 'still_an_issue' || action === 'no';

    if (isExplicitReopen) {
      return reopenMaintenance(req, res);
    }

    if ((located.request.status || '').toLowerCase() !== 'resolved') {
      return res.status(400).json({ detail: 'Only resolved requests can be confirmed.' });
    }

    const now = new Date();
    const feedback = typeof req.body?.feedback === 'string'
      ? req.body.feedback.trim()
      : (typeof req.body?.notes === 'string' ? req.body.notes.trim() : (typeof req.body?.note === 'string' ? req.body.note.trim() : null));
    const rawRating = Number(req.body?.rating);
    const rating = Number.isFinite(rawRating) && rawRating >= 1 && rawRating <= 5 ? Math.round(rawRating * 10) / 10 : null;

    const ratingNote = rating ? ` (${rating} / 5 stars)` : '';
    const statusHistory = Array.isArray(located.request.statusHistory)
      ? [...located.request.statusHistory]
      : [];
    statusHistory.push({
      event: 'tenant_confirmed_resolved',
      status: 'resolved',
      actor_id: req.user.user_id || null,
      actor_name: actorNameFromUser(req.user),
      actor_role: req.user.role || 'tenant',
      note: feedback
        ? `Tenant verified issue resolution${ratingNote}. Feedback: "${feedback}"`
        : `Tenant verified issue resolution${ratingNote}.`,
      timestamp: now,
    });

    const resolutionConfirmation = {
      confirmedAt: now,
      tenantFeedback: feedback || null,
      rating,
      action: 'confirm',
    };

    await db.collection(located.collectionName).updateOne(
      { request_id: located.request.request_id || requestId },
      {
        $set: {
          status: 'resolved',
          tenant_confirmed_resolved: true,
          resolutionConfirmation,
          resolved_at: located.request.resolved_at || now,
          statusHistory,
          updated_at: now,
          updatedAt: now,
        },
      }
    );

    const updatedSource = await db.collection(located.collectionName).findOne({
      request_id: located.request.request_id || requestId,
    });
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
    if (['pending', 'viewed', 'reviewed', 'in_progress', 'waiting_tenant'].includes(normalizedStatus)) {
      updates.cancelled_at = null;
    }

    await db.collection(located.collectionName).updateOne(
      { request_id: located.request.request_id || requestId },
      { $set: updates }
    );

    const updatedSource = await db.collection(located.collectionName).findOne({
      request_id: located.request.request_id || requestId,
    });
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
  confirmResolution: confirmMaintenanceResolved,
  adminUpdateStatus,
  adminGetAll,
};

