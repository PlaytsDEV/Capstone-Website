/**
 * Fail-closed connection and runtime guards for Room Transfer production audits.
 *
 * This is a focused adaptation of the Reservation Phase 0 read-only safety
 * contract. The Phase 0 implementation lives on a separate audit branch, so it
 * cannot be imported by these follow-up scripts without bringing unrelated
 * audit tooling into this branch.
 */

export const READ_ONLY_AUTHORIZATION_ENV = "RESERVATION_AUDIT_READ_ONLY_AUTHORIZED";
export const EXPECTED_DATABASE_ENV = "RESERVATION_AUDIT_EXPECTED_DATABASE";
export const EXPECTED_HOST_ENV = "RESERVATION_AUDIT_EXPECTED_HOST";
export const EXPECTED_PORT_ENV = "RESERVATION_AUDIT_EXPECTED_PORT";

export class RoomTransferAuditSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "RoomTransferAuditSafetyError";
  }
}

const safetyError = (message) => new RoomTransferAuditSafetyError(message);

const DISALLOWED_PRODUCTION_DATABASES = new Set([
  "lilycrest-reservation-audit-2026-08",
]);

const ALLOWED_READ_ACTIONS = new Set([
  "changeStream",
  "collStats",
  "dbHash",
  "dbStats",
  "find",
  "killCursors",
  "listCollections",
  "listIndexes",
  "listSearchIndexes",
  "planCacheRead",
]);

const GUARDED_MODEL_METHODS = Object.freeze([
  "bulkWrite",
  "create",
  "createCollection",
  "createIndex",
  "createIndexes",
  "deleteMany",
  "deleteOne",
  "ensureIndexes",
  "findByIdAndDelete",
  "findByIdAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "insertMany",
  "insertOne",
  "replaceOne",
  "syncIndexes",
  "updateMany",
  "updateOne",
]);

const GUARDED_DOCUMENT_METHODS = Object.freeze([
  "deleteOne",
  "replaceOne",
  "save",
  "updateOne",
]);

const GUARDED_COLLECTION_METHODS = Object.freeze([
  "bulkWrite",
  "createIndex",
  "createIndexes",
  "deleteMany",
  "deleteOne",
  "drop",
  "dropIndex",
  "dropIndexes",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "insertMany",
  "insertOne",
  "replaceOne",
  "updateMany",
  "updateOne",
]);

export const READ_ONLY_CONNECT_OPTIONS = Object.freeze({
  autoCreate: false,
  autoIndex: false,
  retryWrites: false,
  readPreference: "secondaryPreferred",
  readConcern: Object.freeze({ level: "majority" }),
  serverSelectionTimeoutMS: 8_000,
  socketTimeoutMS: 15_000,
  appName: "lilycrest-room-transfer-read-only-audit",
});

const truthy = (value) => String(value || "").trim().toLowerCase() === "true";

const parseConnectionIdentity = (uri) => {
  try {
    const normalized = String(uri || "")
      .replace(/^mongodb\+srv:/i, "https:")
      .replace(/^mongodb:/i, "http:");
    const parsed = new URL(normalized);
    return {
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || null,
      host: parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase(),
      port: parsed.port || null,
    };
  } catch {
    return null;
  }
};

export function parseRoomTransferAuditMode(argv = [], { allowApply = true } = {}) {
  const args = argv.map((value) => String(value));
  const forbidden = args.find((arg) => ["--write", "--fix", "--repair", "--delete"].includes(arg));
  if (forbidden) throw safetyError(`Unsupported mutation flag: ${forbidden}.`);
  const unknown = args.find((arg) => arg !== "--apply");
  if (unknown) throw safetyError(`Unsupported audit argument: ${unknown}.`);

  const apply = args.includes("--apply");
  if (apply && !allowApply) throw safetyError("This audit is permanently read-only.");
  return Object.freeze({ apply });
}

export function printRoomTransferAuditMode({ apply }, output = process.stdout) {
  output.write(`MODE: ${apply ? "APPLY" : "READ ONLY / DRY RUN"}\n`);
}

export function validateReadOnlyAuditConfiguration(env = process.env) {
  if (!truthy(env[READ_ONLY_AUTHORIZATION_ENV])) {
    throw safetyError(`${READ_ONLY_AUTHORIZATION_ENV}=true is required.`);
  }

  const uri = String(env.MONGODB_URI || "").trim();
  if (!uri) throw safetyError("MONGODB_URI is required.");

  const expectedDatabase = String(env[EXPECTED_DATABASE_ENV] || "").trim();
  if (!expectedDatabase) {
    throw safetyError(`${EXPECTED_DATABASE_ENV} is required from the approved OPS profile.`);
  }
  if (DISALLOWED_PRODUCTION_DATABASES.has(expectedDatabase.toLowerCase())) {
    throw safetyError("The disposable Reservation audit-copy database cannot be used as production.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(expectedDatabase)) {
    throw safetyError("Approved expected database has an invalid name.");
  }

  const expectedHost = String(env[EXPECTED_HOST_ENV] || "").trim().toLowerCase();
  const expectedPort = String(env[EXPECTED_PORT_ENV] || "").trim();
  if (!expectedHost || !expectedPort) {
    throw safetyError(`${EXPECTED_HOST_ENV} and ${EXPECTED_PORT_ENV} are required from the approved OPS profile.`);
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(expectedHost)) {
    throw safetyError("Approved audit endpoint must be loopback-only.");
  }
  if (!/^\d{1,5}$/.test(expectedPort) || Number(expectedPort) < 1 || Number(expectedPort) > 65_535) {
    throw safetyError("Approved expected audit port is invalid.");
  }

  const configured = parseConnectionIdentity(uri);
  if (!configured?.database || !configured.host || !configured.port) {
    throw safetyError("MONGODB_URI must include an explicit host, port, and database name.");
  }
  if (configured.database !== expectedDatabase) {
    throw safetyError("Configured database does not match the approved expected database.");
  }
  if (configured.host !== expectedHost || configured.port !== expectedPort) {
    throw safetyError("Configured endpoint does not match the approved loopback host and port.");
  }

  return Object.freeze({ uri, expectedDatabase, expectedHost, expectedPort });
}

export function assessReadOnlyPrivileges(connectionStatus, expectedDatabase) {
  const authInfo = connectionStatus?.authInfo;
  const users = authInfo?.authenticatedUsers;
  const roles = authInfo?.authenticatedUserRoles;
  const privileges = authInfo?.authenticatedUserPrivileges;

  if (!Array.isArray(users) || users.length !== 1) {
    throw safetyError("Authenticated database user identity could not be verified.");
  }
  if (!Array.isArray(roles) || roles.length !== 1) {
    throw safetyError("Exactly one authenticated database role is required.");
  }
  if (roles[0]?.role !== "read" || roles[0]?.db !== expectedDatabase) {
    throw safetyError("Authenticated role must be exactly read on the approved database.");
  }
  if (!Array.isArray(privileges) || privileges.length === 0) {
    throw safetyError("Authenticated privilege metadata is unavailable.");
  }

  let expectedDatabaseFind = false;
  for (const privilege of privileges) {
    const actions = Array.isArray(privilege?.actions) ? privilege.actions : [];
    if (actions.length === 0) continue;

    if (privilege?.resource?.db !== expectedDatabase) {
      throw safetyError("Authenticated privileges extend beyond the approved database.");
    }

    for (const action of actions) {
      if (!ALLOWED_READ_ACTIONS.has(String(action))) {
        throw safetyError(`Write-capable or unapproved database privilege detected: ${String(action)}.`);
      }
      if (action === "find") expectedDatabaseFind = true;
    }
  }

  if (!expectedDatabaseFind) {
    throw safetyError("Read privilege for the approved database could not be verified.");
  }

  return Object.freeze({ readOnly: true, role: "read", database: expectedDatabase });
}

const installMethodGuard = (target, method, restorations, label) => {
  if (!target || typeof target[method] !== "function") return;
  const original = target[method];
  target[method] = function blockedRoomTransferAuditWrite() {
    throw safetyError(`Read-only Room Transfer audit blocked ${label}.${method}().`);
  };
  restorations.push(() => {
    target[method] = original;
  });
};

export function installDryRunWriteGuards({ mongoose, models = {} }) {
  const restorations = [];

  for (const [name, model] of Object.entries(models)) {
    for (const method of GUARDED_MODEL_METHODS) {
      installMethodGuard(model, method, restorations, name);
    }
    for (const method of GUARDED_DOCUMENT_METHODS) {
      installMethodGuard(model?.prototype, method, restorations, `${name}.prototype`);
    }
    for (const method of GUARDED_COLLECTION_METHODS) {
      installMethodGuard(model?.collection, method, restorations, `${name}.collection`);
    }
  }

  installMethodGuard(mongoose, "startSession", restorations, "mongoose");
  installMethodGuard(mongoose?.connection, "startSession", restorations, "mongoose.connection");
  installMethodGuard(mongoose?.connection, "transaction", restorations, "mongoose.connection");

  return () => {
    for (const restore of restorations.reverse()) restore();
  };
}

export async function openRoomTransferReadOnlyAudit({
  mongoose,
  models,
  env = process.env,
  apply = false,
}) {
  if (apply) {
    throw safetyError("APPLY mode cannot use the production read-only audit runner.");
  }
  if (!mongoose || typeof mongoose.connect !== "function") {
    throw safetyError("A Mongoose instance is required.");
  }

  const { uri, expectedDatabase } = validateReadOnlyAuditConfiguration(env);
  const restoreWriteGuards = installDryRunWriteGuards({ mongoose, models });
  let connected = false;
  let closed = false;

  const close = async () => {
    if (closed) return;
    closed = true;
    let disconnectFailed = false;
    try {
      if (connected || mongoose.connection?.readyState) await mongoose.disconnect();
    } catch {
      disconnectFailed = true;
    } finally {
      restoreWriteGuards();
    }
    if (disconnectFailed) {
      throw safetyError("Read-only audit connection could not be closed cleanly.");
    }
  };

  try {
    await mongoose.connect(uri, {
      ...READ_ONLY_CONNECT_OPTIONS,
      readConcern: { ...READ_ONLY_CONNECT_OPTIONS.readConcern },
    });
    connected = true;

    if (mongoose.connection?.name !== expectedDatabase) {
      throw safetyError("Connected database does not match the approved expected database.");
    }

    const admin = mongoose.connection?.db?.admin?.();
    if (!admin || typeof admin.command !== "function") {
      throw safetyError("Authenticated privilege metadata cannot be queried.");
    }
    const connectionStatus = await admin.command({ connectionStatus: 1, showPrivileges: true });
    const privilegeAssessment = assessReadOnlyPrivileges(connectionStatus, expectedDatabase);

    process.stdout.write(`DATABASE: ${expectedDatabase}\nPRIVILEGES: READ ONLY VERIFIED\n`);
    return Object.freeze({ expectedDatabase, privilegeAssessment, close });
  } catch (error) {
    await close().catch(() => {});
    if (error instanceof RoomTransferAuditSafetyError) throw error;
    throw safetyError("Database connection or privilege verification failed.");
  }
}
