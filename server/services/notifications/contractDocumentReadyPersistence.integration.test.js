import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const axiosPost = jest.fn(async () => ({ data: { data: [{ status: "ok" }] } }));

await jest.unstable_mockModule("axios", () => ({
  default: { post: axiosPost },
}));

await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

await jest.unstable_mockModule("../../utils/socket.js", () => ({
  emitToUser: jest.fn(),
}));

const { notify } = await import("./notificationService.js");
const Notification = (await import("../../models/Notification.js")).default;

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "contract_document_ready" });
  await Notification.syncIndexes();
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
}, 60_000);

beforeEach(async () => {
  axiosPost.mockReset();
  axiosPost.mockResolvedValue({ data: { data: [{ status: "ok" }] } });
  await Notification.deleteMany({});
  await mongoose.connection.db.collection("users").deleteMany({});
});

async function seedTenant(label) {
  const userId = new mongoose.Types.ObjectId();
  await mongoose.connection.db.collection("users").insertOne({
    _id: userId,
    firebaseUid: `firebase-${label}`,
    email: `${label}@example.test`,
    username: label,
    user_id: label,
    push_token: `ExponentPushToken[${label}]`,
  });
  return userId;
}

describe("contract-document-ready durable delivery", () => {
  test("ordinary notifications without a dedupe key remain independently insertable", async () => {
    const userId = await seedTenant("ordinary");
    await Notification.create([
      { userId, type: "general", title: "One", message: "First" },
      { userId, type: "general", title: "Two", message: "Second" },
    ]);

    expect(await Notification.countDocuments({ userId })).toBe(2);
  });

  test("the real schema accepts the contract entity and suppresses a same-version retry", async () => {
    const userId = await seedTenant("tenant-a");
    const contractId = new mongoose.Types.ObjectId();

    await notify.contractDocumentReady(userId, "prepared", contractId, 1);
    await notify.contractDocumentReady(userId, "prepared", contractId, 1);

    const stored = await Notification.find({ userId, type: "contract_document_ready" });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      entityType: "contract",
      entityId: String(contractId),
      dedupeKey: `contract_document_ready:${contractId}:prepared:1`,
    });
    expect(axiosPost).toHaveBeenCalledTimes(1);
  });

  test("tenant A and tenant B remain independent for the same contract/version reference", async () => {
    const tenantA = await seedTenant("tenant-a");
    const tenantB = await seedTenant("tenant-b");
    const contractId = new mongoose.Types.ObjectId();

    await notify.contractDocumentReady(tenantA, "final", contractId, 2);
    await notify.contractDocumentReady(tenantB, "final", contractId, 2);

    expect(await Notification.countDocuments({ type: "contract_document_ready" })).toBe(2);
    expect(axiosPost).toHaveBeenCalledTimes(2);
  });

  test("concurrent same-tenant inserts produce one durable row and one push", async () => {
    const userId = await seedTenant("tenant-race");
    const contractId = new mongoose.Types.ObjectId();

    await Promise.all([
      notify.contractDocumentReady(userId, "prepared", contractId, 3),
      notify.contractDocumentReady(userId, "prepared", contractId, 3),
    ]);

    expect(await Notification.countDocuments({ userId, type: "contract_document_ready" })).toBe(1);
    expect(axiosPost).toHaveBeenCalledTimes(1);
  });

  test("a push-provider failure leaves the in-app row as the durable fallback", async () => {
    const userId = await seedTenant("tenant-fallback");
    const contractId = new mongoose.Types.ObjectId();
    axiosPost.mockRejectedValueOnce(new Error("push provider unavailable"));

    await notify.contractDocumentReady(userId, "final", contractId, 4);

    expect(await Notification.countDocuments({ userId, type: "contract_document_ready" })).toBe(1);
  });
});
