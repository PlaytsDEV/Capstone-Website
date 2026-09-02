import { describe, expect, jest, test } from "@jest/globals";
import {
  listUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearNotifications,
  buildNotificationKey,
  filterNotificationsForTenantLifecycle,
} from "./mobileNotificationBridge.js";

function fakeDb({
  notifications = [], announcements = [], reads = [], readState = null, users = [],
  dismissals = [], clearState = null, stays = [],
} = {}) {
  const updates = {
    notification_reads: [], notification_read_state: [], notificationsUpdateMany: [],
    notification_dismissals: [], notification_clear_state: [],
  };
  return {
    updates,
    collection(name) {
      if (name === "notifications") {
        return {
          find: () => ({
            sort: () => ({ limit: () => ({ toArray: async () => notifications, catch: () => notifications }) }),
            limit: () => ({ toArray: async () => notifications }),
          }),
          updateMany: async (filter, update) => { updates.notificationsUpdateMany.push({ filter, update }); },
        };
      }
      if (name === "announcements") {
        return {
          find: () => ({
            sort: () => ({ limit: () => ({ toArray: async () => announcements, catch: () => announcements }) }),
            limit: () => ({ toArray: async () => announcements }),
          }),
        };
      }
      if (name === "users") {
        return {
          find: () => ({
            toArray: async () => users,
          }),
        };
      }
      if (name === "notification_reads") {
        return {
          find: (query) => ({ project: () => ({
            toArray: async () => reads.filter((row) => !row.user_id || row.user_id === query.user_id),
            catch: () => reads.filter((row) => !row.user_id || row.user_id === query.user_id),
          }) }),
          updateOne: async (filter, update, opts) => { updates.notification_reads.push({ filter, update, opts }); },
        };
      }
      if (name === "notification_read_state") {
        return {
          findOne: async () => readState,
          updateOne: async (filter, update, opts) => { updates.notification_read_state.push({ filter, update, opts }); },
        };
      }
      if (name === "notification_dismissals") {
        return {
          find: (query) => ({ project: () => ({
            toArray: async () => dismissals.filter((row) => !row.user_id || row.user_id === query.user_id),
            catch: () => dismissals.filter((row) => !row.user_id || row.user_id === query.user_id),
          }) }),
          updateOne: async (filter, update, opts) => { updates.notification_dismissals.push({ filter, update, opts }); },
        };
      }
      if (name === "notification_clear_state") {
        return {
          findOne: async () => clearState,
          updateOne: async (filter, update, opts) => { updates.notification_clear_state.push({ filter, update, opts }); },
        };
      }
      if (name === "stays") {
        return { findOne: async (query) => stays.find((stay) => String(stay.tenantId) === String(query.tenantId)) || null };
      }
      if (["bedhistories", "reservations", "rooms", "contracts"].includes(name)) {
        return { findOne: async () => null };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe("mobileNotificationBridge", () => {
  test("applicant-to-tenant transition hides applicant-only notifications without deleting history", async () => {
    const notifications = [
      { notification_id: "applicant-stamped", roleAtCreation: "applicant", type: "application_submitted", title: "Application received" },
      { notification_id: "tenant-stamped", roleAtCreation: "tenant", type: "bill_generated", title: "Reservation balance bill" },
      { notification_id: "legacy-applicant", type: "visit_approved", entityType: "reservation", entityId: "res-1", title: "Visit approved" },
      { notification_id: "legacy-billing", type: "bill_generated", reservation_id: "res-1", billing_id: "bill-1", title: "Bill ready" },
    ];

    expect(filterNotificationsForTenantLifecycle("applicant", notifications)).toHaveLength(4);
    expect(filterNotificationsForTenantLifecycle("tenant", notifications).map((item) => item.notification_id))
      .toEqual(["tenant-stamped", "legacy-billing"]);

    const db = fakeDb({ notifications });
    const result = await listUserNotifications(db, "tenant-a", null, "tenant");
    expect(result.map((item) => item.notification_id).sort())
      .toEqual(["legacy-billing", "tenant-stamped"]);
  });

  test("tenant-stamped notifications remain visible even when their text mentions a reservation", () => {
    const notification = {
      notification_id: "tenant-transfer-bill",
      roleAtCreation: "tenant",
      type: "bill_generated",
      title: "Room transfer reservation settlement",
    };
    expect(filterNotificationsForTenantLifecycle("tenant", [notification])).toEqual([notification]);
  });

  test("listUserNotifications merges stored notifications and visible announcements, newest first", async () => {
    const db = fakeDb({
      notifications: [{ notification_id: "n1", title: "Bill ready", created_at: new Date("2026-01-01") }],
      announcements: [{ _id: "a1", title: "Maintenance notice", created_at: new Date("2026-02-01"), is_active: true }],
    });
    const result = await listUserNotifications(db, "tenant-a");
    expect(result.length).toBe(2);
    expect(result[0].title).toBe("Maintenance notice");
    expect(result[1].title).toBe("Bill ready");
  });

  test("resolves admin author name from user ID and never exposes raw hex ObjectId in notifications feed", async () => {
    const adminObjectId = "69bb9249dcab8f0bf467a0f4";
    const db = fakeDb({
      announcements: [
        {
          _id: "a1",
          title: "System maintenance",
          content: "Elevator servicing on Saturday",
          publishedBy: adminObjectId,
          created_at: new Date("2026-08-14"),
          is_active: true,
        },
      ],
      users: [
        {
          _id: adminObjectId,
          firstName: "Maria",
          lastName: "Santos",
          role: "admin",
        },
      ],
    });
    const result = await listUserNotifications(db, "tenant-a");
    expect(result.length).toBe(1);
    expect(result[0].author_name).toBe("Maria Santos (Admin)");
    expect(result[0].author_name).not.toContain(adminObjectId);
  });

  test("falls back to LilyCrest Admin if author ID cannot be resolved, never exposing raw hex in bridge", async () => {
    const unknownAdminId = "69bb9249dcab8f0bf467a0f4";
    const db = fakeDb({
      announcements: [
        {
          _id: "a1",
          title: "General note",
          content: "Quiet hours starting 10pm",
          publishedBy: unknownAdminId,
          created_at: new Date("2026-08-14"),
          is_active: true,
        },
      ],
      users: [],
    });
    const result = await listUserNotifications(db, "tenant-a");
    expect(result.length).toBe(1);
    expect(result[0].author_name).toBe("LilyCrest Admin");
    expect(result[0].author_name).not.toBe(unknownAdminId);
  });

  test("CASE B Home: a Guadalupe announcement, linked stored row, and unread contribution are absent for Gil Puyat", async () => {
    const tenantMongoId = new ObjectId("64e000000000000000000001");
    const announcementMongoId = new ObjectId("65e000000000000000000001");
    const db = fakeDb({
      notifications: [{
        _id: new ObjectId("66e000000000000000000001"),
        userId: tenantMongoId,
        type: "announcement",
        entityType: "announcement",
        entityId: String(announcementMongoId),
        title: "Guadalupe notice",
        message: "Branch only",
        isRead: false,
        createdAt: new Date("2026-08-16"),
      }],
      announcements: [{
        _id: announcementMongoId,
        announcement_id: "ann_guadalupe",
        targetBranch: "guadalupe",
        title: "Guadalupe notice",
        publicationStatus: "published",
        startsAt: new Date("2026-08-01"),
        isArchived: false,
      }],
      stays: [{ tenantId: tenantMongoId, branch: "gil-puyat", status: "active" }],
    });

    const feed = await listUserNotifications(db, "tenant-gil-puyat", tenantMongoId);
    expect(feed).toEqual([]);
    expect(feed.filter((item) => !item.read)).toHaveLength(0);
  });

  test("a notification is marked read when its key is in notification_reads", async () => {
    const key = buildNotificationKey({ notification_id: "n1", type: "notification", title: "x", created_at: new Date("2026-01-01") });
    const db = fakeDb({
      notifications: [{ notification_id: "n1", title: "x", created_at: new Date("2026-01-01") }],
      reads: [{ notification_key: key }],
    });
    const result = await listUserNotifications(db, "tenant-a");
    expect(result[0].read).toBe(true);
  });

  test("mark-all-read applies to items created before all_read_at even without an explicit read receipt", async () => {
    const db = fakeDb({
      notifications: [{ notification_id: "n1", title: "old", created_at: new Date("2026-01-01") }],
      readState: { all_read_at: new Date("2026-01-15") },
    });
    const result = await listUserNotifications(db, "tenant-a");
    expect(result[0].read).toBe(true);
  });

  test("markNotificationRead only ever looks inside the caller's own notifications/visible announcements — never a client-supplied user scope", async () => {
    const db = fakeDb({ notifications: [{ notification_id: "n1", title: "x", created_at: new Date() }] });
    const result = await markNotificationRead(db, "tenant-a", "n1");
    expect(result.status).toBe(200);
    expect(db.updates.notification_reads[0].filter.user_id).toBe("tenant-a");
  });

  test("markNotificationRead on an unknown id returns 404, not a crash", async () => {
    const db = fakeDb({ notifications: [] });
    const result = await markNotificationRead(db, "tenant-a", "does-not-exist");
    expect(result.status).toBe(404);
  });

  test("markNotificationRead with empty id returns 400", async () => {
    const db = fakeDb({});
    const result = await markNotificationRead(db, "tenant-a", "");
    expect(result.status).toBe(400);
  });

  test("markAllNotificationsRead scopes both writes to the given userId", async () => {
    const db = fakeDb({});
    await markAllNotificationsRead(db, "tenant-a");
    expect(db.updates.notification_read_state[0].filter.user_id).toBe("tenant-a");
    expect(db.updates.notificationsUpdateMany[0].filter.user_id).toBe("tenant-a");
  });
});

describe("mobileNotificationBridge — dismiss/clear (P1 notification cleanup)", () => {
  test("Notification-1: dismissing a personal notification writes a per-tenant junction row, not a delete/mutation of the source doc", async () => {
    const db = fakeDb({ notifications: [{ notification_id: "n1", title: "x", created_at: new Date() }] });
    const result = await dismissNotification(db, "tenant-a", "n1");
    expect(result.status).toBe(200);
    expect(db.updates.notification_dismissals[0].filter.user_id).toBe("tenant-a");
    expect(db.updates.notificationsUpdateMany.length).toBe(0);
  });

  test("dismissing an unknown/unowned id returns 404, never a silent success — a client cannot probe or dismiss another tenant's item", async () => {
    const db = fakeDb({ notifications: [] });
    const result = await dismissNotification(db, "tenant-a", "does-not-exist");
    expect(result.status).toBe(404);
  });

  test("Notification-1/8: a dismissed notification is excluded from listUserNotifications and stays excluded (persisted, not client-only state)", async () => {
    const key = buildNotificationKey({ notification_id: "n1", type: "notification", title: "x", created_at: new Date("2026-01-01") });
    const db = fakeDb({
      notifications: [{ notification_id: "n1", title: "x", created_at: new Date("2026-01-01") }],
      dismissals: [{ notification_key: key }],
    });
    const result = await listUserNotifications(db, "tenant-a");
    expect(result.length).toBe(0);
  });

  test("Notification-3: dismissing an announcement never touches the shared announcements collection — only this tenant's feed is affected", async () => {
    const announcementDoc = { _id: "ann1", announcement_id: "ann1", title: "Branch notice", created_at: new Date("2026-01-01") };
    const key = buildNotificationKey({ announcement_id: "ann1" });
    const db = fakeDb({ announcements: [announcementDoc] });
    const result = await dismissNotification(db, "tenant-a", key);
    expect(result.status).toBe(200);
    // The fixture array itself is untouched — proving no write ever targets
    // the `announcements` collection for a dismissal.
    expect(announcementDoc).toEqual({ _id: "ann1", announcement_id: "ann1", title: "Branch notice", created_at: new Date("2026-01-01") });
  });

  test("Notification-4/5: clearNotifications sets a cutoff scoped to the caller, hiding items created at/before it but not items created after", async () => {
    const db = fakeDb({});
    const result = await clearNotifications(db, "tenant-a");
    expect(result.status).toBe("cleared");
    expect(db.updates.notification_clear_state[0].filter.user_id).toBe("tenant-a");

    const clearedBefore = result.cleared_before;
    const beforeClear = new Date(clearedBefore.getTime() - 60_000);
    const afterClear = new Date(clearedBefore.getTime() + 60_000);
    const db2 = fakeDb({
      notifications: [
        { notification_id: "old", title: "old", created_at: beforeClear },
        { notification_id: "new", title: "new", created_at: afterClear },
      ],
      clearState: { cleared_before: clearedBefore },
    });
    const list = await listUserNotifications(db2, "tenant-a");
    expect(list.map((n) => n.notification_id)).toEqual(["new"]);
  });

  test("clearNotifications never disables push delivery or mutates any notification document — it is purely a read-time feed filter", async () => {
    const db = fakeDb({});
    await clearNotifications(db, "tenant-a");
    expect(db.updates.notificationsUpdateMany.length).toBe(0);
  });

  test("dismissal survives a fresh service/session context, remains tenant-specific, and leaves the source event intact", async () => {
    const sourceEvent = {
      notification_id: "event-a", type: "maintenance_update", request_id: "request-1",
      title: "Request updated", created_at: new Date("2026-08-01T00:00:00Z"),
    };
    const mutationDb = fakeDb({ notifications: [sourceEvent] });
    const dismissed = await dismissNotification(mutationDb, "tenant-a", "event-a");
    expect(dismissed.status).toBe(200);
    const write = mutationDb.updates.notification_dismissals[0];
    const persistedRow = { ...write.filter, ...write.update.$set, ...write.update.$setOnInsert };

    const freshSessionDb = fakeDb({ notifications: [sourceEvent], dismissals: [persistedRow] });
    expect(await listUserNotifications(freshSessionDb, "tenant-a")).toEqual([]);
    expect(await listUserNotifications(freshSessionDb, "tenant-b")).toHaveLength(1);
    expect(sourceEvent.notification_id).toBe("event-a");
  });

  test("a later event for the same source is not suppressed by the old event's dismissal", async () => {
    const eventA = {
      notification_id: "event-a", type: "maintenance_update", request_id: "request-1",
      title: "First update", created_at: new Date("2026-08-01T00:00:00Z"),
    };
    const eventB = {
      notification_id: "event-b", type: "maintenance_update", request_id: "request-1",
      title: "Later update", created_at: new Date("2026-08-02T00:00:00Z"),
    };
    const dismissalKey = buildNotificationKey(eventA);
    expect(dismissalKey).not.toBe(buildNotificationKey(eventB));
    const freshDb = fakeDb({
      notifications: [eventA, eventB],
      dismissals: [{ user_id: "tenant-a", notification_key: dismissalKey, dismissed_at: new Date("2026-08-01T12:00:00Z") }],
    });
    expect((await listUserNotifications(freshDb, "tenant-a")).map((item) => item.notification_id)).toEqual(["event-b"]);
  });

  test("legacy source-level dismissal hides only events that existed when it was recorded", async () => {
    const db = fakeDb({
      notifications: [
        { notification_id: "old", type: "maintenance_update", request_id: "request-1", created_at: new Date("2026-08-01T00:00:00Z") },
        { notification_id: "new", type: "maintenance_update", request_id: "request-1", created_at: new Date("2026-08-03T00:00:00Z") },
      ],
      dismissals: [{ user_id: "tenant-a", notification_key: "maintenance_update:request-1", dismissed_at: new Date("2026-08-02T00:00:00Z") }],
    });
    expect((await listUserNotifications(db, "tenant-a")).map((item) => item.notification_id)).toEqual(["new"]);
  });

  test("bulk clear survives a fresh service/session context while a later event remains visible", async () => {
    const mutationDb = fakeDb({});
    const cleared = await clearNotifications(mutationDb, "tenant-a");
    const oldEvent = { notification_id: "old", title: "old", created_at: new Date(cleared.cleared_before.getTime() - 1) };
    const newEvent = { notification_id: "new", title: "new", created_at: new Date(cleared.cleared_before.getTime() + 1) };
    const freshSessionDb = fakeDb({
      notifications: [oldEvent, newEvent],
      clearState: { user_id: "tenant-a", cleared_before: cleared.cleared_before },
    });
    expect((await listUserNotifications(freshSessionDb, "tenant-a")).map((item) => item.notification_id)).toEqual(["new"]);
    expect([oldEvent, newEvent]).toHaveLength(2);
  });
});

// Regression coverage for the bill-release notification audit: the mobile
// bridge's `notifications` query previously only matched documents shaped
// { user_id: <string> } (the legacy standalone-backend shape). This
// backend's OWN Notification model (models/Notification.js, written by
// services/notifications/notificationService.js — the actual writer behind
// every bill-release/payment/etc. notification) persists documents shaped
// { userId: <Mongo ObjectId> } instead. The old query matched zero of them,
// so no bill-release notification (or any canonical notification) ever
// reached the mobile app's unread badge — regardless of how correctly it
// was created or pushed. Unlike the tests above, this fake db actually
// evaluates the Mongo-shaped filter (including $or) against the fixture
// documents, so it can prove the match/no-match behavior directly rather
// than merely asserting on the filter object's shape.
import { ObjectId } from "mongodb";
import { buildOwnerFilter, sanitizeStoredNotification } from "./mobileNotificationBridge.js";

function matchesMongoFilter(doc, filter) {
  if (!filter || typeof filter !== "object") return true;
  return Object.entries(filter).every(([key, condition]) => {
    if (key === "$or") return condition.some((sub) => matchesMongoFilter(doc, sub));
    if (key === "$and") return condition.every((sub) => matchesMongoFilter(doc, sub));
    const actual = doc[key];
    if (condition && typeof condition === "object" && condition._bsontype === undefined && !(condition instanceof ObjectId)) {
      if ("$ne" in condition) return actual !== condition.$ne;
      if ("$exists" in condition) return condition.$exists ? actual !== undefined : actual === undefined;
      return true;
    }
    if (condition instanceof ObjectId) {
      return actual instanceof ObjectId ? actual.equals(condition) : String(actual) === condition.toHexString();
    }
    return actual === condition;
  });
}

function filteringFakeDb({ notifications = [] } = {}) {
  const updates = { notificationsUpdateMany: [] };
  return {
    updates,
    collection(name) {
      if (name === "notifications") {
        return {
          find: (filter) => {
            const matched = notifications.filter((doc) => matchesMongoFilter(doc, filter));
            return {
              sort: () => ({ limit: () => ({ toArray: async () => matched, catch: () => matched }) }),
              limit: () => ({ toArray: async () => matched }),
            };
          },
          updateMany: async (filter, update) => {
            updates.notificationsUpdateMany.push({ filter, update });
            const matched = notifications.filter((doc) => matchesMongoFilter(doc, filter));
            matched.forEach((doc) => Object.assign(doc, update.$set));
          },
        };
      }
      if (name === "announcements") {
        return { find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [], catch: () => [] }) }) }) };
      }
      if (name === "notification_reads") {
        return { find: () => ({ project: () => ({ toArray: async () => [], catch: () => [] }) }) };
      }
      if (name === "notification_read_state") {
        return { findOne: async () => null, updateOne: async () => {} };
      }
      if (name === "notification_dismissals") {
        return { find: () => ({ project: () => ({ toArray: async () => [], catch: () => [] }) }) };
      }
      if (name === "notification_clear_state") {
        return { findOne: async () => null, updateOne: async () => {} };
      }
      if (["stays", "bedhistories", "reservations", "rooms", "contracts"].includes(name)) {
        return { findOne: async () => null };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe("mobileNotificationBridge — canonical Notification model compatibility (bill-release notification fix)", () => {
  test("uses canonical Notification.dedupeKey as stable event identity", () => {
    const normalized = sanitizeStoredNotification({
      _id: new ObjectId("66e000000000000000000099"),
      dedupeKey: "bill_released:bill-1:v2",
      title: "Bill released",
    });
    expect(normalized.dedup_key).toBe("bill_released:bill-1:v2");
    expect(buildNotificationKey(normalized)).toBe("bill_released:bill-1:v2");
  });

  const tenantMongoId = new ObjectId();
  const tenantUserId = "tenant-a";

  test("buildOwnerFilter matches the legacy user_id-string shape when only the string identity is given", () => {
    expect(buildOwnerFilter(tenantUserId, null)).toEqual({ user_id: tenantUserId });
  });

  test("buildOwnerFilter matches the canonical userId-ObjectId shape when only the Mongo id is given", () => {
    expect(buildOwnerFilter(null, tenantMongoId)).toEqual({ userId: tenantMongoId });
  });

  test("buildOwnerFilter matches either shape via $or when both identities are given", () => {
    expect(buildOwnerFilter(tenantUserId, tenantMongoId)).toEqual({
      $or: [{ user_id: tenantUserId }, { userId: tenantMongoId }],
    });
  });

  test("a canonical-shaped Notification document (userId: ObjectId, message, isRead) — exactly what notificationService.js writes for a bill release — is now found and correctly mapped", async () => {
    const billId = new ObjectId();
    const db = filteringFakeDb({
      notifications: [{
        _id: new ObjectId(),
        userId: tenantMongoId,
        type: "bill_generated",
        title: "New Bill Available",
        message: "Your rent bill is now available",
        actionUrl: `/bill-details?billId=${billId.toHexString()}`,
        entityType: "bill",
        entityId: billId.toHexString(),
        isRead: false,
        readAt: null,
        createdAt: new Date("2026-08-16T10:00:00.000Z"),
        updatedAt: new Date("2026-08-16T10:00:00.000Z"),
      }],
    });

    const result = await listUserNotifications(db, tenantUserId, tenantMongoId);

    expect(result.length).toBe(1);
    expect(result[0].title).toBe("New Bill Available");
    expect(result[0].body).toBe("Your rent bill is now available");
    expect(result[0].read).toBe(false);
    expect(result[0].category).toBe("billing");
    expect(result[0].billing_id).toBe(billId.toHexString());
  });

  test("a canonical contract-document notification is visible with an Expo-safe contract route", () => {
    const contractId = new ObjectId().toHexString();
    const result = sanitizeStoredNotification({
      _id: new ObjectId(),
      userId: tenantMongoId,
      type: "contract_document_ready",
      title: "Final Contract Ready",
      message: "Your final contract is available.",
      actionUrl: "/tenant/documents",
      entityType: "contract",
      entityId: contractId,
      isRead: false,
      createdAt: new Date("2026-08-17T06:00:00.000Z"),
    });

    expect(result).toMatchObject({
      type: "contract_document_ready",
      category: "account",
      contract_id: contractId,
      url: "/contract-viewer",
      data: {
        type: "contract_document_ready",
        contract_id: contractId,
        screen: "contract",
        url: "/contract-viewer",
      },
    });
  });

  test("chat_reply projects conversation_id and message_id from the canonical dedupe key", () => {
    const conversationId = new ObjectId().toHexString();
    const messageId = new ObjectId().toHexString();
    const result = sanitizeStoredNotification({
      _id: new ObjectId(),
      userId: tenantMongoId,
      type: "chat_reply",
      title: "New support reply",
      message: "An administrator replied.",
      entityType: "chat",
      entityId: conversationId,
      dedupeKey: `chat_reply:${conversationId}:${messageId}`,
      createdAt: new Date("2026-08-18T06:00:00.000Z"),
    });

    expect(result).toMatchObject({
      type: "chat_reply",
      conversation_id: conversationId,
      message_id: messageId,
      data: {
        type: "chat_reply",
        conversation_id: conversationId,
        message_id: messageId,
      },
    });
  });

  test("a legacy-shaped notification document (user_id: string, body, read) is still found — the fix is additive, not a breaking rename", async () => {
    const db = filteringFakeDb({
      notifications: [{
        notification_id: "legacy-1",
        user_id: tenantUserId,
        title: "Legacy notice",
        body: "Still works",
        read: false,
        created_at: new Date("2026-08-16T09:00:00.000Z"),
      }],
    });

    const result = await listUserNotifications(db, tenantUserId, tenantMongoId);

    expect(result.length).toBe(1);
    expect(result[0].title).toBe("Legacy notice");
  });

  test("a notification belonging to a DIFFERENT tenant (different userId/user_id) is never returned — tenant isolation preserved by the dual-shape fix", async () => {
    const otherTenantMongoId = new ObjectId();
    const db = filteringFakeDb({
      notifications: [{
        _id: new ObjectId(),
        userId: otherTenantMongoId,
        type: "bill_generated",
        title: "Someone else's bill",
        message: "Not yours",
        isRead: false,
        createdAt: new Date(),
      }],
    });

    const result = await listUserNotifications(db, tenantUserId, tenantMongoId);

    expect(result.length).toBe(0);
  });

  test("markAllNotificationsRead sets both read and isRead so the flag applies regardless of document shape", async () => {
    const db = filteringFakeDb({
      notifications: [{ _id: new ObjectId(), userId: tenantMongoId, isRead: false, createdAt: new Date() }],
    });

    await markAllNotificationsRead(db, tenantUserId, tenantMongoId);

    const call = db.updates.notificationsUpdateMany[0];
    expect(call.update.$set.read).toBe(true);
    expect(call.update.$set.isRead).toBe(true);
  });
});
