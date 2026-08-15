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
