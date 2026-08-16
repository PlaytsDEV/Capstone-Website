import { describe, expect, jest, test } from "@jest/globals";
import {
  listUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  buildNotificationKey,
} from "./mobileNotificationBridge.js";

function fakeDb({ notifications = [], announcements = [], reads = [], readState = null, users = [] } = {}) {
  const updates = { notification_reads: [], notification_read_state: [], notificationsUpdateMany: [] };
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
          find: () => ({ project: () => ({ toArray: async () => reads, catch: () => reads }) }),
          updateOne: async (filter, update, opts) => { updates.notification_reads.push({ filter, update, opts }); },
        };
      }
      if (name === "notification_read_state") {
        return {
          findOne: async () => readState,
          updateOne: async (filter, update, opts) => { updates.notification_read_state.push({ filter, update, opts }); },
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe("mobileNotificationBridge", () => {
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
import { buildOwnerFilter } from "./mobileNotificationBridge.js";

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
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe("mobileNotificationBridge — canonical Notification model compatibility (bill-release notification fix)", () => {
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
