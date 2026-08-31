import { describe, expect, jest, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_DATABASE_ENV,
  EXPECTED_HOST_ENV,
  EXPECTED_PORT_ENV,
  READ_ONLY_AUTHORIZATION_ENV,
  READ_ONLY_CONNECT_OPTIONS,
  installDryRunWriteGuards,
  openRoomTransferReadOnlyAudit,
  parseRoomTransferAuditMode,
  printRoomTransferAuditMode,
  validateReadOnlyAuditConfiguration,
} from "./roomTransferReadOnlyAuditSafety.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const expectedDatabase = "lilycrest-production-approved";
const baseEnv = Object.freeze({
  MONGODB_URI: `mongodb://127.0.0.1:27099/${expectedDatabase}`,
  [READ_ONLY_AUTHORIZATION_ENV]: "true",
  [EXPECTED_DATABASE_ENV]: expectedDatabase,
  [EXPECTED_HOST_ENV]: "127.0.0.1",
  [EXPECTED_PORT_ENV]: "27099",
});

function readOnlyStatus({ actions = ["find", "listCollections", "listIndexes"], roles } = {}) {
  return {
    authInfo: {
      authenticatedUsers: [{ user: "audit-reader", db: "admin" }],
      authenticatedUserRoles: roles || [{ role: "read", db: expectedDatabase }],
      authenticatedUserPrivileges: [{
        resource: { db: expectedDatabase, collection: "" },
        actions,
      }],
    },
  };
}

function createFakeMongoose({ actualDatabase = expectedDatabase, status = readOnlyStatus() } = {}) {
  const command = jest.fn().mockResolvedValue(status);
  const connection = {
    name: null,
    readyState: 0,
    db: { admin: jest.fn(() => ({ command })) },
    startSession: jest.fn(),
    transaction: jest.fn(),
  };
  const mongoose = {
    connection,
    startSession: jest.fn(),
    connect: jest.fn().mockImplementation(async () => {
      connection.name = actualDatabase;
      connection.readyState = 1;
    }),
    disconnect: jest.fn().mockImplementation(async () => {
      connection.readyState = 0;
    }),
  };
  return { mongoose, command };
}

function createWriteCapableModel() {
  class FakeModel {}
  for (const method of [
    "bulkWrite", "create", "createCollection", "createIndex", "createIndexes",
    "deleteMany", "deleteOne", "insertMany", "insertOne", "replaceOne", "syncIndexes",
    "updateMany", "updateOne",
  ]) {
    FakeModel[method] = jest.fn();
  }
  for (const method of ["deleteOne", "replaceOne", "save", "updateOne"]) {
    FakeModel.prototype[method] = jest.fn();
  }
  FakeModel.collection = {};
  for (const method of [
    "bulkWrite", "createIndex", "createIndexes", "deleteMany", "deleteOne",
    "insertMany", "insertOne", "replaceOne", "updateMany", "updateOne",
  ]) {
    FakeModel.collection[method] = jest.fn();
  }
  return FakeModel;
}

describe("Room Transfer read-only audit safety", () => {
  test("dry-run connection disables automatic writes and retryable writes", async () => {
    const { mongoose } = createFakeMongoose();
    const sessionOriginal = mongoose.startSession;
    const handle = await openRoomTransferReadOnlyAudit({ mongoose, models: {}, env: { ...baseEnv } });

    expect(mongoose.connect).toHaveBeenCalledWith(baseEnv.MONGODB_URI, expect.objectContaining(READ_ONLY_CONNECT_OPTIONS));
    expect(READ_ONLY_CONNECT_OPTIONS).toMatchObject({ autoIndex: false, autoCreate: false, retryWrites: false });
    expect(() => mongoose.startSession()).toThrow("blocked mongoose.startSession");

    await handle.close();
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
    expect(mongoose.startSession).toBe(sessionOriginal);
  });

  test("all modeled write and transaction entry points are unreachable in dry run", () => {
    const Model = createWriteCapableModel();
    const { mongoose } = createFakeMongoose();
    const restore = installDryRunWriteGuards({ mongoose, models: { Model } });

    for (const method of [
      "bulkWrite", "create", "createCollection", "createIndex", "createIndexes",
      "deleteMany", "deleteOne", "insertMany", "insertOne", "replaceOne", "syncIndexes",
      "updateMany", "updateOne",
    ]) {
      expect(() => Model[method]()).toThrow("Read-only Room Transfer audit blocked");
    }
    const document = new Model();
    for (const method of ["deleteOne", "replaceOne", "save", "updateOne"]) {
      expect(() => document[method]()).toThrow("Read-only Room Transfer audit blocked");
    }
    expect(() => mongoose.startSession()).toThrow("Read-only Room Transfer audit blocked");
    expect(() => mongoose.connection.startSession()).toThrow("Read-only Room Transfer audit blocked");
    expect(() => mongoose.connection.transaction()).toThrow("Read-only Room Transfer audit blocked");
    for (const method of [
      "bulkWrite", "createIndex", "createIndexes", "deleteMany", "deleteOne",
      "insertMany", "insertOne", "replaceOne", "updateMany", "updateOne",
    ]) {
      expect(() => Model.collection[method]()).toThrow("Read-only Room Transfer audit blocked");
    }

    restore();
  });

  test("startup banners clearly distinguish dry-run and apply modes", () => {
    const output = { write: jest.fn() };
    printRoomTransferAuditMode({ apply: false }, output);
    printRoomTransferAuditMode({ apply: true }, output);
    expect(output.write).toHaveBeenNthCalledWith(1, "MODE: READ ONLY / DRY RUN\n");
    expect(output.write).toHaveBeenNthCalledWith(2, "MODE: APPLY\n");
  });

  test("missing read-only authorization aborts before connecting", async () => {
    const { mongoose } = createFakeMongoose();
    const env = { ...baseEnv };
    delete env[READ_ONLY_AUTHORIZATION_ENV];

    await expect(openRoomTransferReadOnlyAudit({ mongoose, env })).rejects.toThrow(`${READ_ONLY_AUTHORIZATION_ENV}=true`);
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  test("missing or mismatched expected database aborts before connecting", async () => {
    const { mongoose } = createFakeMongoose();
    const missing = { ...baseEnv };
    delete missing[EXPECTED_DATABASE_ENV];
    await expect(openRoomTransferReadOnlyAudit({ mongoose, env: missing })).rejects.toThrow(`${EXPECTED_DATABASE_ENV} is required`);

    const mismatch = { ...baseEnv, [EXPECTED_DATABASE_ENV]: "another-production-db" };
    await expect(openRoomTransferReadOnlyAudit({ mongoose, env: mismatch })).rejects.toThrow("Configured database does not match");
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  test("missing or mismatched approved tunnel endpoint aborts before connecting", async () => {
    const { mongoose } = createFakeMongoose();
    const missing = { ...baseEnv };
    delete missing[EXPECTED_HOST_ENV];
    await expect(openRoomTransferReadOnlyAudit({ mongoose, env: missing })).rejects.toThrow(`${EXPECTED_HOST_ENV} and ${EXPECTED_PORT_ENV}`);

    const mismatch = { ...baseEnv, [EXPECTED_PORT_ENV]: "27100" };
    await expect(openRoomTransferReadOnlyAudit({ mongoose, env: mismatch })).rejects.toThrow("Configured endpoint does not match");
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  test("the disposable Reservation audit copy is rejected as production", () => {
    expect(() => validateReadOnlyAuditConfiguration({
      ...baseEnv,
      MONGODB_URI: "mongodb://127.0.0.1:27028/lilycrest-reservation-audit-2026-08",
      [EXPECTED_DATABASE_ENV]: "lilycrest-reservation-audit-2026-08",
    })).toThrow("disposable Reservation audit-copy");
  });

  test("actual connected database mismatch aborts before metadata or audit queries", async () => {
    const { mongoose, command } = createFakeMongoose({ actualDatabase: "wrong-database" });
    await expect(openRoomTransferReadOnlyAudit({ mongoose, env: { ...baseEnv } })).rejects.toThrow("Connected database does not match");
    expect(command).not.toHaveBeenCalled();
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
  });

  test("write-capable privilege aborts before returning an audit handle", async () => {
    const { mongoose } = createFakeMongoose({ status: readOnlyStatus({ actions: ["find", "update"] }) });
    await expect(openRoomTransferReadOnlyAudit({ mongoose, env: { ...baseEnv } })).rejects.toThrow("Write-capable or unapproved");
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
  });

  test("unexpected driver failures are sanitized and never echo credentials", async () => {
    const { mongoose } = createFakeMongoose();
    mongoose.connect.mockRejectedValueOnce(new Error("mongodb://audit-reader:do-not-print@127.0.0.1 failure"));
    const error = await openRoomTransferReadOnlyAudit({ mongoose, env: { ...baseEnv } }).catch((failure) => failure);
    expect(error.message).toBe("Database connection or privilege verification failed.");
    expect(error.message).not.toContain("do-not-print");
  });

  test("missing privilege metadata and non-read roles fail closed", async () => {
    const unavailable = createFakeMongoose({ status: { authInfo: {
      authenticatedUsers: [{ user: "audit-reader", db: "admin" }],
      authenticatedUserRoles: [{ role: "read", db: expectedDatabase }],
    } } });
    await expect(openRoomTransferReadOnlyAudit({ mongoose: unavailable.mongoose, env: { ...baseEnv } }))
      .rejects.toThrow("privilege metadata is unavailable");

    const writeRole = createFakeMongoose({ status: readOnlyStatus({ roles: [{ role: "readWrite", db: expectedDatabase }] }) });
    await expect(openRoomTransferReadOnlyAudit({ mongoose: writeRole.mongoose, env: { ...baseEnv } }))
      .rejects.toThrow("role must be exactly read");
  });

  test("apply mode is explicitly separate and cannot enter the read-only runner", async () => {
    expect(parseRoomTransferAuditMode(["--apply"])).toEqual({ apply: true });
    const { mongoose } = createFakeMongoose();
    await expect(openRoomTransferReadOnlyAudit({ mongoose, env: { ...baseEnv }, apply: true }))
      .rejects.toThrow("APPLY mode cannot use");
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  test("all three scripts use the shared guard and have no direct connection startup", () => {
    for (const file of [
      "backfill_security_deposit_held.mjs",
      "repair_adriane_room_transfer.mjs",
      "audit_room_transfer_generated_predecessors.mjs",
    ]) {
      const source = fs.readFileSync(path.join(scriptsDir, file), "utf8");
      expect(source).toContain("openRoomTransferReadOnlyAudit");
      expect(source).not.toMatch(/mongoose\.connect\s*\(/);
      expect(source).not.toMatch(/mongoose\.disconnect\s*\(/);
    }
  });
});
