/**
 * ============================================================================
 * MOBILE NOTIFICATION BRIDGE
 * ============================================================================
 *
 * Canonical implementation backing the mobile app's GET /api/m/notifications,
 * PATCH /api/m/notifications/read-all, and PATCH /api/m/notifications/:id/read.
 *
 * Phase 4 cutover audit found this domain had NO canonical route at all —
 * neither a bridge nor the vendored mobile router (server/mobile/routes)
 * defines /notifications, so it would 404 against this backend today even
 * though it's an ACTIVE, frequently-used mobile feature (home feed +
 * AuthContext unread-count polling). This is a direct behavioral port of the
 * currently-live standalone mobile backend's controllers/notification.controller.js
 * + services/notificationService.js (sanitizeStoredNotification/normalizePriority),
 * reading the SAME shared `notifications`/`announcements`/`notification_reads`/
 * `notification_read_state` collections (confirmed shared MongoDB cluster) —
 * not new business logic, so there is no data-shape risk versus what the
 * standalone backend already writes/reads.
 *
 * Deliberately uses the raw MongoDB driver (mongoose.connection.db), matching
 * every other mobile bridge in this codebase, since `notifications` is not a
 * canonical Mongoose-modeled collection here.
 */

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePriority(value) {
  const raw = normalizeString(value).toLowerCase();
  if (raw === "high" || raw === "urgent" || raw === "critical") return "high";
  if (raw === "low" || raw === "info") return "low";
  return "normal";
}

function sanitizePayload(data = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const payload = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) payload[key] = value;
  });
  return payload;
}

function sanitizeStoredNotification(doc = {}) {
  return {
    notification_id: doc.notification_id || doc._id?.toString?.() || "",
    title: normalizeString(doc.title) || "Notification",
    body: normalizeString(doc.body || doc.content || ""),
    content: normalizeString(doc.content || doc.body || ""),
    category: normalizeString(doc.category) || "General",
    priority: normalizePriority(doc.priority),
    is_urgent: doc.is_urgent === true || normalizePriority(doc.priority) === "high",
    author_name: normalizeString(doc.author_name || doc.source_label || "LilyCrest System") || "LilyCrest System",
    source_label: normalizeString(doc.source_label || doc.author_name || "LilyCrest System") || "LilyCrest System",
    created_at: doc.created_at || doc.createdAt || doc.updated_at || doc.updatedAt || new Date(),
    updated_at: doc.updated_at || doc.updatedAt || doc.created_at || doc.createdAt || new Date(),
    type: normalizeString(doc.type || "notification") || "notification",
    source: normalizeString(doc.source || "system") || "system",
    data: sanitizePayload(doc.data),
    url: normalizeString(doc.url || doc.data?.url || ""),
    read: doc.read === true,
    announcement_id: normalizeString(doc.announcement_id || doc.data?.announcement_id || ""),
    billing_id: normalizeString(doc.billing_id || doc.data?.billing_id || doc.data?.bill_id || ""),
    request_id: normalizeString(doc.request_id || doc.data?.request_id || ""),
    session_id: normalizeString(doc.session_id || doc.data?.session_id || ""),
    reservation_id: normalizeString(doc.reservation_id || doc.data?.reservation_id || ""),
    dedup_key: normalizeString(doc.event_key || ""),
  };
}

function getAnnouncementDateValue(doc = {}) {
  return doc.publishedAt || doc.sentAt || doc.created_at || doc.createdAt || doc.updated_at || doc.updatedAt || null;
}

function normalizeAnnouncementPriority(doc = {}) {
  const rawPriority = doc.priority || doc.importance || doc.type || "normal";
  if (/high|urgent|important/i.test(String(rawPriority))) return "high";
  if (/low|info/i.test(String(rawPriority))) return "low";
  return "normal";
}

function normalizeAnnouncementNotification(doc = {}) {
  const announcementId = normalizeString(doc.announcement_id || doc._id?.toString?.());
  const createdAt = getAnnouncementDateValue(doc) || new Date();
  const priority = normalizeAnnouncementPriority(doc);
  const category = normalizeString(doc.category || doc.type || "Announcement") || "Announcement";
  const body = normalizeString(doc.content || doc.message || doc.body || doc.description || "");
  const authorName = normalizeString(doc.author_name || doc.authorName || doc.publishedBy || doc.postedBy || "LilyCrest Admin") || "LilyCrest Admin";

  return {
    notification_id: announcementId || `announcement:${createdAt instanceof Date ? createdAt.getTime() : String(createdAt)}`,
    title: normalizeString(doc.title || doc.subject || "Announcement") || "Announcement",
    body,
    content: body,
    category,
    priority,
    is_urgent: doc.is_urgent === true || doc.isUrgent === true || priority === "high",
    author_name: authorName,
    source_label: authorName,
    created_at: createdAt,
    updated_at: doc.updated_at || doc.updatedAt || createdAt,
    type: "announcement",
    source: "announcement",
    data: {
      type: "announcement",
      announcement_id: announcementId,
      screen: "announcements",
      url: "/(tabs)/announcements",
    },
    url: "/(tabs)/announcements",
    read: doc.read === true,
    announcement_id: announcementId,
    billing_id: "",
    request_id: "",
    session_id: "",
    reservation_id: "",
    dedup_key: announcementId ? `announcement:${announcementId}` : "",
  };
}

function buildNotificationKey(notification = {}) {
  const preferred = normalizeString(notification.dedup_key);
  if (preferred) return preferred;

  if (notification.announcement_id) return `announcement:${notification.announcement_id}`;
  if (notification.billing_id && notification.type) return `${notification.type}:${notification.billing_id}`;
  if (notification.request_id && notification.type) return `${notification.type}:${notification.request_id}`;
  if (notification.session_id && notification.type) return `${notification.type}:${notification.session_id}`;
  if (notification.reservation_id && notification.type) return `${notification.type}:${notification.reservation_id}`;

  return [
    normalizeString(notification.type || "notification"),
    normalizeString(notification.title),
    normalizeString(notification.body || notification.content),
    notification.created_at ? new Date(notification.created_at).toISOString() : "no-date",
  ].join(":");
}

function sortNotifications(list = []) {
  return [...list].sort((left, right) => {
    const leftTime = left?.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right?.created_at ? new Date(right.created_at).getTime() : 0;
    return rightTime - leftTime;
  });
}

const ACTIVE_FILTER = {
  $or: [
    { is_active: true },
    { isActive: true },
    { is_active: { $exists: false }, isActive: { $exists: false } },
  ],
};
const NOT_ARCHIVED_FILTER = { isArchived: { $ne: true } };

function visibilityFilter(userId) {
  return {
    $or: [
      { is_private: { $ne: true }, isPrivate: { $ne: true } },
      { is_private: true, user_id: userId },
      { isPrivate: true, userId },
    ],
  };
}

/**
 * List the authenticated tenant's merged notifications (stored notifications
 * + visible announcements), with read-state applied. Identity is derived
 * exclusively from `userId` (the caller passes req.mobileTenant.user_id,
 * server-resolved from the session) — never from client input.
 */
async function listUserNotifications(db, userId) {
  const storedNotifications = await db.collection("notifications")
    .find({ user_id: userId })
    .sort({ created_at: -1, updated_at: -1 })
    .limit(120)
    .toArray()
    .catch(() => []);

  const announcements = await db.collection("announcements")
    .find({ $and: [ACTIVE_FILTER, NOT_ARCHIVED_FILTER, visibilityFilter(userId)] })
    .sort({ created_at: -1, createdAt: -1 })
    .limit(80)
    .toArray()
    .catch(() => []);

  const [readReceipts, readState] = await Promise.all([
    db.collection("notification_reads").find({ user_id: userId }).project({ notification_key: 1 }).toArray().catch(() => []),
    db.collection("notification_read_state").findOne({ user_id: userId }).catch(() => null),
  ]);
  const readKeys = new Set(readReceipts.map((entry) => normalizeString(entry.notification_key)).filter(Boolean));
  const allReadAt = readState?.all_read_at ? new Date(readState.all_read_at).getTime() : 0;

  const mergedByKey = new Map();
  sortNotifications([
    ...storedNotifications.map((doc) => sanitizeStoredNotification(doc)),
    ...announcements.map((doc) => normalizeAnnouncementNotification(doc)),
  ]).forEach((notification) => {
    const key = buildNotificationKey(notification);
    const normalizedNotification = {
      ...notification,
      priority: normalizePriority(notification.priority),
      content: normalizeString(notification.content || notification.body),
      body: normalizeString(notification.body || notification.content),
    };
    const notificationTime = normalizedNotification.created_at ? new Date(normalizedNotification.created_at).getTime() : 0;
    normalizedNotification.read = normalizedNotification.read === true
      || readKeys.has(key)
      || (allReadAt > 0 && notificationTime <= allReadAt);

    const existing = mergedByKey.get(key);
    if (!existing) {
      mergedByKey.set(key, normalizedNotification);
      return;
    }
    if (normalizedNotification.source === "announcement" && existing.source !== "announcement") {
      mergedByKey.set(key, normalizedNotification);
    }
  });

  return sortNotifications(Array.from(mergedByKey.values())).slice(0, 100);
}

/**
 * Mark one notification (own only — resolved by scanning the caller's own
 * stored notifications/visible announcements, never a raw client-supplied
 * collection lookup) read.
 */
async function markNotificationRead(db, userId, notificationKeyRaw) {
  const notificationKey = normalizeString(notificationKeyRaw);
  if (!notificationKey) return { status: 400, detail: "notificationId is required." };

  const stored = await db.collection("notifications").find({ user_id: userId }).limit(200).toArray();
  let ownedNotification = stored
    .map((doc) => sanitizeStoredNotification(doc))
    .find((item) => buildNotificationKey(item) === notificationKey || item.notification_id === notificationKey);

  if (!ownedNotification) {
    const announcements = await db.collection("announcements").find({
      $and: [ACTIVE_FILTER, NOT_ARCHIVED_FILTER, visibilityFilter(userId)],
    }).limit(200).toArray();
    ownedNotification = announcements
      .map((doc) => normalizeAnnouncementNotification(doc))
      .find((item) => buildNotificationKey(item) === notificationKey || item.notification_id === notificationKey);
  }

  if (!ownedNotification) return { status: 404, detail: "Notification not found." };

  const ownedKey = buildNotificationKey(ownedNotification);
  await db.collection("notification_reads").updateOne(
    { user_id: userId, notification_key: ownedKey },
    { $set: { read_at: new Date() }, $setOnInsert: { created_at: new Date() } },
    { upsert: true },
  );
  return { status: 200, value: { status: "read", notification_id: ownedKey } };
}

async function markAllNotificationsRead(db, userId) {
  const now = new Date();
  await db.collection("notification_read_state").updateOne(
    { user_id: userId },
    { $set: { all_read_at: now, updated_at: now }, $setOnInsert: { created_at: now } },
    { upsert: true },
  );
  await db.collection("notifications").updateMany({ user_id: userId }, { $set: { read: true, read_at: now } });
  return { status: "all_read", read_at: now };
}

export {
  sanitizeStoredNotification,
  normalizeAnnouncementNotification,
  buildNotificationKey,
  listUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
