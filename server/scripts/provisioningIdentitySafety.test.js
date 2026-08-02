import { describe, expect, jest, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProvisioningIdentity, uidFingerprint } from "./provisioningIdentitySafety.js";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

describe("admin provisioning identity safety", () => {
  test("same Firebase and MongoDB UID is permitted and deterministic", async () => {
    const auth = { getUserByEmail: jest.fn().mockResolvedValue({ uid: "canonical-uid" }) };
    const mongo = { firebaseUid: "canonical-uid" };
    const findMongoUser = jest.fn().mockResolvedValue(mongo);
    await expect(resolveProvisioningIdentity({ email: " Admin@Example.Test ", auth, findMongoUser }))
      .resolves.toEqual({ normalizedEmail: "admin@example.test", firebaseUser: { uid: "canonical-uid" }, mongoUser: mongo });
    expect(auth.getUserByEmail).toHaveBeenCalledWith("admin@example.test");
  });

  test("different UIDs fail before any mutation callback can run", async () => {
    const updateUser = jest.fn();
    const save = jest.fn();
    const auth = { getUserByEmail: jest.fn().mockResolvedValue({ uid: "firebase-uid" }), updateUser };
    const findMongoUser = jest.fn().mockResolvedValue({ firebaseUid: "mongo-uid", save });
    await expect(resolveProvisioningIdentity({ email: "admin@example.test", auth, findMongoUser }))
      .rejects.toThrow("IDENTITY_CONFLICT");
    expect(updateUser).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  test("Firebase identity without MongoDB profile is safe to continue", async () => {
    await expect(resolveProvisioningIdentity({
      email: "admin@example.test",
      auth: { getUserByEmail: jest.fn().mockResolvedValue({ uid: "firebase-uid" }) },
      findMongoUser: jest.fn().mockResolvedValue(null),
    })).resolves.toMatchObject({ firebaseUser: { uid: "firebase-uid" }, mongoUser: null });
  });

  test("MongoDB profile without Firebase identity fails closed", async () => {
    await expect(resolveProvisioningIdentity({
      email: "admin@example.test",
      auth: { getUserByEmail: jest.fn().mockRejectedValue({ code: "auth/user-not-found" }) },
      findMongoUser: jest.fn().mockResolvedValue({ firebaseUid: "orphaned-uid" }),
    })).rejects.toThrow("IDENTITY_CONFLICT");
  });

  test("unexpected Firebase lookup failure is propagated without replacement", async () => {
    const failure = new Error("provider unavailable");
    await expect(resolveProvisioningIdentity({
      email: "admin@example.test",
      auth: { getUserByEmail: jest.fn().mockRejectedValue(failure) },
      findMongoUser: jest.fn(),
    })).rejects.toBe(failure);
  });

  test("UID fingerprint is one-way diagnostic metadata", () => {
    const uid = "complete-sensitive-firebase-uid";
    const fingerprint = uidFingerprint(uid);
    expect(fingerprint).toMatch(/^[a-f0-9]{12}$/);
    expect(fingerprint).not.toContain(uid);
  });

  test("provisioning scripts do not log passwords or interpolate complete UIDs", () => {
    for (const file of ["create-superadmin.js", "create-owner.js", "create-branchadmin-guada.js"]) {
      const source = fs.readFileSync(path.join(scriptsDir, file), "utf8");
      expect(source).not.toMatch(/Password:\s*\$\{PASSWORD\}/);
      expect(source).not.toMatch(/\(uid:\s*\$\{firebaseUid\}\)/i);
      expect(source).not.toMatch(/existingMongo\.firebaseUid\s*=/);
      expect(source).toContain("resolveProvisioningIdentity");
    }
  });
});
