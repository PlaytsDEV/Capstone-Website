import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Smoke test for "will a bill release actually produce a mobile push
 * notification". Runs the REAL notificationService.js + mobilePushService.js
 * against an in-memory Mongo (real Notification writes, real users
 * collection push-token lookup) — only the outermost network boundary
 * (axios call to Expo's push endpoint) is faked, so this proves the whole
 * release -> DB notification -> push-payload chain without hitting any
 * real device, real Expo/FCM service, or production data.
 */

const axiosPost = jest.fn(async () => ({
  data: { data: [{ status: "ok" }] },
}));

await jest.unstable_mockModule("axios", () => ({
  default: { post: axiosPost },
}));

await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

await jest.unstable_mockModule("../../utils/socket.js", () => ({
  emitToUser: jest.fn(),
}));

const notify = (await import("./notificationService.js")).default;
const Notification = (await import("../../models/Notification.js")).default;

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "bill_release_notification_smoke" });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  axiosPost.mockClear();
  await mongoose.connection.db.collection("users").deleteMany({});
  await Notification.deleteMany({});
});

async function seedTenantWithPushToken(pushToken = "ExponentPushToken[smoke-test-device]") {
  const userId = new mongoose.Types.ObjectId();
  const suffix = userId.toString();
  await mongoose.connection.db.collection("users").insertOne({
    _id: userId,
    firebaseUid: `smoke-${suffix}`,
    email: `smoke-${suffix}@example.test`,
    username: `smoke-${suffix}`,
    user_id: `smoke-${suffix}`,
    push_token: pushToken,
  });
  return userId;
}

describe("bill release -> mobile push smoke test", () => {
  test("rent bill release (billGenerated) writes a Notification and dispatches a push with the correct billing_id/screen/url", async () => {
    const userId = await seedTenantWithPushToken();
    const billId = new mongoose.Types.ObjectId().toString();

    await notify.billGenerated(userId, "August 2026", 5500, "Aug 31, 2026", {
      billId,
      billType: "rent",
      actionUrl: `/bill-details?billId=${billId}`,
    });

    const stored = await Notification.findOne({ userId, type: "bill_generated" });
    expect(stored).not.toBeNull();
    expect(stored.entityType).toBe("bill");
    expect(String(stored.entityId)).toBe(billId);

    expect(axiosPost).toHaveBeenCalledTimes(1);
    const [, messages] = axiosPost.mock.calls[0];
    expect(messages[0].data.billing_id).toBe(billId);
    expect(messages[0].data.screen).toBe("billing");
    expect(messages[0].data.url).toBe(`/bill-details?billId=${billId}`);
    expect(messages[0].to).toBe("ExponentPushToken[smoke-test-device]");
  });

  test("electricity bill release (utilityChargeAvailable) writes a Notification and dispatches a push — regression guard for the previous 'utility bills produced no push' defect", async () => {
    const userId = await seedTenantWithPushToken();
    const billId = new mongoose.Types.ObjectId().toString();

    await notify.utilityChargeAvailable(userId, "electricity", "August 2026", 850, 6350, "Aug 31, 2026", {
      billId,
    });

    const stored = await Notification.findOne({ userId, type: "bill_generated" });
    expect(stored).not.toBeNull();
    expect(String(stored.entityId)).toBe(billId);

    expect(axiosPost).toHaveBeenCalledTimes(1);
    const [, messages] = axiosPost.mock.calls[0];
    expect(messages[0].data.billing_id).toBe(billId);
    expect(messages[0].data.screen).toBe("billing");
    expect(messages[0].data.url).toBe(`/bill-details?billId=${billId}`);
  });

  test("water bill release (utilityChargeAvailable) also dispatches a push", async () => {
    const userId = await seedTenantWithPushToken();
    const billId = new mongoose.Types.ObjectId().toString();

    await notify.utilityChargeAvailable(userId, "water", "August 2026", 300, 5800, "Aug 31, 2026", {
      billId,
    });

    expect(axiosPost).toHaveBeenCalledTimes(1);
    const [, messages] = axiosPost.mock.calls[0];
    expect(messages[0].data.billing_id).toBe(billId);
  });

  test("a tenant with no push token still gets the Notification DB record but no push is attempted", async () => {
    const userId = new mongoose.Types.ObjectId();
    const suffix = userId.toString();
    await mongoose.connection.db.collection("users").insertOne({
      _id: userId,
      firebaseUid: `smoke-${suffix}`,
      email: `smoke-${suffix}@example.test`,
      username: `smoke-${suffix}`,
      user_id: `smoke-${suffix}`,
    });
    const billId = new mongoose.Types.ObjectId().toString();

    await notify.billGenerated(userId, "August 2026", 5500, "Aug 31, 2026", { billId });

    const stored = await Notification.findOne({ userId, type: "bill_generated" });
    expect(stored).not.toBeNull();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  test("a bill release for one tenant never sends a push to a different tenant's token", async () => {
    const tenantA = await seedTenantWithPushToken();
    const tenantB = await seedTenantWithPushToken("ExponentPushToken[tenant-b-device]");
    const billId = new mongoose.Types.ObjectId().toString();

    await notify.billGenerated(tenantA, "August 2026", 5500, "Aug 31, 2026", { billId });

    expect(axiosPost).toHaveBeenCalledTimes(1);
    const [, messages] = axiosPost.mock.calls[0];
    expect(messages[0].to).toBe("ExponentPushToken[smoke-test-device]");
    expect(messages.some((m) => m.to === "ExponentPushToken[tenant-b-device]")).toBe(false);
  });
});
