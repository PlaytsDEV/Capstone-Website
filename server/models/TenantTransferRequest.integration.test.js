import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import TenantTransferRequest from "./TenantTransferRequest.js";

let mongo;
const id = () => new mongoose.Types.ObjectId();

const requestPayload = (tenantId) => ({
  tenantId,
  reservationId: id(),
  stayId: id(),
  branch: "guadalupe",
  currentRoomSnapshot: {
    roomId: id(), name: "Room 201", roomNumber: "201", type: "double-sharing", branch: "guadalupe",
  },
  currentBedSnapshot: { bedId: "bed-a", position: "lower", bunkBlock: "A", code: "A-L" },
  preferredRoomType: "private",
  reason: "Need a quieter room",
});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await TenantTransferRequest.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe("TenantTransferRequest open-request invariant", () => {
  test("concurrent submissions leave exactly one pending request", async () => {
    const tenantId = id();
    const results = await Promise.allSettled([
      TenantTransferRequest.create(requestPayload(tenantId)),
      TenantTransferRequest.create(requestPayload(tenantId)),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((result) => result.status === "rejected");
    expect(failure.reason.code).toBe(11000);
    expect(await TenantTransferRequest.countDocuments({ tenantId, status: "pending" })).toBe(1);
  });

  test("terminal request permits a new request but scheduled remains open", async () => {
    const tenantId = id();
    const first = await TenantTransferRequest.create(requestPayload(tenantId));
    first.status = "declined";
    await first.save();
    const second = await TenantTransferRequest.create(requestPayload(tenantId));
    second.status = "scheduled";
    second.scheduledRoomTransferId = id();
    await second.save();
    await expect(TenantTransferRequest.create(requestPayload(tenantId))).rejects.toMatchObject({ code: 11000 });
  });

  test("Cancel and Schedule claims are one compare-and-set transition", async () => {
    const tenantId = id();
    const request = await TenantTransferRequest.create(requestPayload(tenantId));
    const [claim, cancel] = await Promise.all([
      TenantTransferRequest.findOneAndUpdate(
        { _id: request._id, status: "pending" },
        { $set: { status: "scheduling", schedulingToken: "claim-a", schedulingStartedAt: new Date() } },
        { new: true },
      ),
      TenantTransferRequest.findOneAndUpdate(
        { _id: request._id, status: "pending" },
        { $set: { status: "cancelled", cancelledAt: new Date() } },
        { new: true },
      ),
    ]);
    expect([claim, cancel].filter(Boolean)).toHaveLength(1);
    expect(["scheduling", "cancelled"]).toContain((await TenantTransferRequest.findById(request._id)).status);
  });

  test("Decline and Schedule claims are one compare-and-set transition", async () => {
    const tenantId = id();
    const request = await TenantTransferRequest.create(requestPayload(tenantId));
    const [claim, decline] = await Promise.all([
      TenantTransferRequest.findOneAndUpdate(
        { _id: request._id, status: "pending" },
        { $set: { status: "scheduling", schedulingToken: "claim-b", schedulingStartedAt: new Date() } },
        { new: true },
      ),
      TenantTransferRequest.findOneAndUpdate(
        { _id: request._id, status: "pending" },
        { $set: { status: "declined", reviewedAt: new Date() } },
        { new: true },
      ),
    ]);
    expect([claim, decline].filter(Boolean)).toHaveLength(1);
    expect(["scheduling", "declined"]).toContain((await TenantTransferRequest.findById(request._id)).status);
  });

  test("two Admin scheduling attempts cannot both claim one request", async () => {
    const tenantId = id();
    const request = await TenantTransferRequest.create(requestPayload(tenantId));
    const claims = await Promise.all([
      TenantTransferRequest.findOneAndUpdate(
        { _id: request._id, status: "pending" },
        { $set: { status: "scheduling", schedulingToken: "claim-1", schedulingStartedAt: new Date() } },
        { new: true },
      ),
      TenantTransferRequest.findOneAndUpdate(
        { _id: request._id, status: "pending" },
        { $set: { status: "scheduling", schedulingToken: "claim-2", schedulingStartedAt: new Date() } },
        { new: true },
      ),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  test.each(["completed", "cancelled"])(
    "a %s historical request allows a future request",
    async (terminalStatus) => {
      const tenantId = id();
      const first = await TenantTransferRequest.create(requestPayload(tenantId));
      first.status = terminalStatus;
      first.scheduledRoomTransferId = id();
      await first.save();
      await expect(TenantTransferRequest.create(requestPayload(tenantId))).resolves.toBeTruthy();
    },
  );
});
