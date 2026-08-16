import fs from "fs";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import express from "express";

describe("mobile Upload route safety (source inspection)", () => {
  const routes = fs.readFileSync(new URL("./mobileUploadRoutes.js", import.meta.url), "utf8");

  test("attaches mobileTenantAuth to its route (never a public/unauthenticated upload)", () => {
    expect(routes).toMatch(/router\.post\("\/upload\/firebase-storage",\s*mobileTenantAuth/);
  });

  test("storage path namespace is derived from req.mobileTenant.user_id, never a client-supplied id", () => {
    expect(routes).toContain("req.mobileTenant.user_id");
    expect(routes).not.toMatch(/req\.body\.(tenantId|userId|user_id)/);
  });

  test("enforces a MIME-type allow-list and a byte-size cap before ever touching storage", () => {
    expect(routes).toContain("ALLOWED_FIREBASE_UPLOAD_MIME_TYPES");
    expect(routes).toContain("MAX_FIREBASE_UPLOAD_BYTES");
  });
});

describe("mobile Upload route (HTTP behavior)", () => {
  let server;
  let baseUrl;
  let saveMock;
  let bucketMock;

  afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    jest.resetModules();
  });

  async function startApp({ bucketName = "dormitorymanagement-caps-572cf.firebasestorage.app", appsLength = 1 } = {}) {
    jest.resetModules();
    saveMock = jest.fn().mockResolvedValue(undefined);
    bucketMock = jest.fn(() => ({ file: () => ({ save: saveMock }) }));

    jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
      mobileTenantAuth: (req, res, next) => {
        req.mobileTenant = { user_id: "tenant-a" };
        next();
      },
    }));
    jest.unstable_mockModule("../config/firebase.js", () => ({
      default: { apps: appsLength ? [{}] : [], storage: () => ({ bucket: bucketMock }) },
      resolveFirebaseStorageBucket: () => bucketName,
    }));

    const { default: mobileUploadRoutes } = await import("./mobileUploadRoutes.js");
    const app = express();
    app.use(express.json({ limit: "15mb" }));
    app.use("/api/m", mobileUploadRoutes);
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }

  const tinyPngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  test("valid upload → 201 with a Firebase download URL, saved under the resolved tenant's own path", async () => {
    await startApp();
    const res = await fetch(`${baseUrl}/api/m/upload/firebase-storage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/png", fileName: "photo.png", dataBase64: tinyPngBase64 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.downloadUrl).toMatch(/^https:\/\/firebasestorage\.googleapis\.com\//);
    expect(body.storagePath).toMatch(/^tenant-uploads\/tenant-a\//);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  test("missing file data → 400, never reaches storage", async () => {
    await startApp();
    const res = await fetch(`${baseUrl}/api/m/upload/firebase-storage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/png" }),
    });
    expect(res.status).toBe(400);
    expect(saveMock).not.toHaveBeenCalled();
  });

  test("disallowed MIME type → 400, never reaches storage", async () => {
    await startApp();
    const res = await fetch(`${baseUrl}/api/m/upload/firebase-storage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "application/x-msdownload", dataBase64: tinyPngBase64 }),
    });
    expect(res.status).toBe(400);
    expect(saveMock).not.toHaveBeenCalled();
  });

  test("oversized declared maxBytes is clamped, and an over-limit payload is rejected", async () => {
    await startApp();
    const res = await fetch(`${baseUrl}/api/m/upload/firebase-storage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/png", dataBase64: tinyPngBase64, maxBytes: 1 }),
    });
    expect(res.status).toBe(400);
  });

  describe("maintenance context clamp (canonical-mobile reconciliation: 5MB ceiling)", () => {
    // application/octet-stream isn't in the MIME allow-list, so build a
    // large-but-valid PNG-labeled payload purely to exercise the byte-size
    // gate, independent of MIME filtering.
    function base64OfSize(bytes) {
      return Buffer.alloc(bytes, 1).toString("base64");
    }

    test("context: maintenance + a payload just over 5MB is rejected even though it's well under the generic 10MB ceiling", async () => {
      await startApp();
      const over5mb = base64OfSize(5 * 1024 * 1024 + 1024);
      const res = await fetch(`${baseUrl}/api/m/upload/firebase-storage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: "image/png", dataBase64: over5mb, context: "maintenance" }),
      });
      expect(res.status).toBe(400);
      expect(saveMock).not.toHaveBeenCalled();
    });

    test("context: maintenance + a payload under 5MB is accepted", async () => {
      await startApp();
      const under5mb = base64OfSize(4 * 1024 * 1024);
      const res = await fetch(`${baseUrl}/api/m/upload/firebase-storage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: "image/png", dataBase64: under5mb, context: "maintenance" }),
      });
      expect(res.status).toBe(201);
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    test("context: maintenance + client-requested maxBytes above 5MB cannot loosen the ceiling — still clamped to 5MB", async () => {
      await startApp();
      const over5mb = base64OfSize(6 * 1024 * 1024);
      const res = await fetch(`${baseUrl}/api/m/upload/firebase-storage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mimeType: "image/png",
          dataBase64: over5mb,
          context: "maintenance",
          maxBytes: 9 * 1024 * 1024, // client tries to loosen it — must be ignored
        }),
      });
      expect(res.status).toBe(400);
      expect(saveMock).not.toHaveBeenCalled();
    });

    test("no context (generic upload) retains its legitimate 10MB ceiling — a >5MB, <10MB payload is still accepted", async () => {
      await startApp();
      const between5and10mb = base64OfSize(7 * 1024 * 1024);
      const res = await fetch(`${baseUrl}/api/m/upload/firebase-storage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: "image/png", dataBase64: between5and10mb }),
      });
      expect(res.status).toBe(201);
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
  });

  test("no resolvable Firebase bucket → 503, not a crash", async () => {
    await startApp({ bucketName: null });
    const res = await fetch(`${baseUrl}/api/m/upload/firebase-storage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/png", dataBase64: tinyPngBase64 }),
    });
    expect(res.status).toBe(503);
  });

  test("Firebase app not initialized → 503, not a crash", async () => {
    await startApp({ appsLength: 0 });
    const res = await fetch(`${baseUrl}/api/m/upload/firebase-storage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/png", dataBase64: tinyPngBase64 }),
    });
    expect(res.status).toBe(503);
  });

  test("unauthenticated request never reaches the handler (mobileTenantAuth gate)", async () => {
    jest.resetModules();
    jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
      mobileTenantAuth: (req, res) => res.status(401).json({ detail: "Not authenticated" }),
    }));
    jest.unstable_mockModule("../config/firebase.js", () => ({
      default: { apps: [{}], storage: () => ({ bucket: jest.fn() }) },
      resolveFirebaseStorageBucket: () => "bucket",
    }));
    const { default: mobileUploadRoutes } = await import("./mobileUploadRoutes.js");
    const app = express();
    app.use(express.json());
    app.use("/api/m", mobileUploadRoutes);
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    const res = await fetch(`${baseUrl}/api/m/upload/firebase-storage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});
