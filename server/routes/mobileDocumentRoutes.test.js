import fs from "fs";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

describe("mobile Document route safety (source inspection)", () => {
  const routes = fs.readFileSync(new URL("./mobileDocumentRoutes.js", import.meta.url), "utf8");

  test("never attaches mobileTenantAuth via router-level router.use() — only per-route", () => {
    expect(routes).not.toMatch(/^router\.use\(mobileTenantAuth\)/m);
    const routeDeclarations = [...routes.matchAll(/router\.(get|post|put|patch|delete)\("([^"]+)",\s*mobileTenantAuth/g)];
    expect(routeDeclarations.length).toBeGreaterThanOrEqual(5);
  });

  test("never defines GET /documents/contract — that path stays owned by mobileContractRoutes.js", () => {
    expect(routes).not.toMatch(/router\.get\("\/documents\/contract"/);
  });

  test("does not read tenantId/userId/branchId out of the request body/query as an authorization input", () => {
    expect(routes).not.toMatch(/req\.(body|query)\.(tenantId|userId|branchId|user_id|branch_id)/);
  });

  test("every user-document handler is keyed off req.mobileTenant, never a client-supplied id", () => {
    const routeStarts = [...routes.matchAll(/router\.(get|post|delete)\("\/users\/documents/g)];
    expect(routeStarts.length).toBeGreaterThanOrEqual(4);
    for (const match of routeStarts) {
      const rest = routes.slice(match.index);
      const nextRouteIndex = rest.indexOf("router.", "router.".length);
      const handlerBody = nextRouteIndex === -1 ? rest : rest.slice(0, nextRouteIndex);
      expect(handlerBody).toMatch(/req\.mobileTenant/);
    }
  });

  test("exposes exactly the document routes the mobile app needs", () => {
    const methodPathPairs = [...routes.matchAll(/router\.(get|post|put|patch|delete)\("([^"]+)"/g)]
      .map(([, method, p]) => `${method.toUpperCase()} ${p}`);
    expect(methodPathPairs).toEqual([
      "GET /documents/:docId",
      "GET /users/documents",
      "POST /users/documents",
      "GET /users/documents/:docId/content",
      "DELETE /users/documents/:docId",
    ]);
  });
});

describe("mobile Document routes (HTTP behavior, services mocked)", () => {
  let app;
  let mockListUserDocuments;
  let mockUploadUserDocument;
  let mockGetUserDocumentContent;
  let mockDeleteUserDocument;
  let mockBuildPolicyDocumentPdf;
  let server;
  let baseUrl;

  beforeEach(async () => {
    jest.resetModules();
    mockListUserDocuments = jest.fn();
    mockUploadUserDocument = jest.fn();
    mockGetUserDocumentContent = jest.fn();
    mockDeleteUserDocument = jest.fn();
    mockBuildPolicyDocumentPdf = jest.fn();

    jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
      mobileTenantAuth: (req, res, next) => {
        req.mobileTenant = { user_id: "tenant-a", _id: "mongo-a" };
        next();
      },
    }));
    jest.unstable_mockModule("../services/mobileDocumentBridge.js", () => ({
      buildPolicyDocumentPdf: mockBuildPolicyDocumentPdf,
      POLICY_DOCUMENT_IDS: ["house_rules"],
    }));
    jest.unstable_mockModule("../services/mobileUserDocumentService.js", () => ({
      listUserDocuments: mockListUserDocuments,
      uploadUserDocument: mockUploadUserDocument,
      getUserDocumentContent: mockGetUserDocumentContent,
      deleteUserDocument: mockDeleteUserDocument,
    }));

    const express = (await import("express")).default;
    const { default: mobileDocumentRoutes } = await import("./mobileDocumentRoutes.js");
    app = express();
    app.use(express.json());
    app.use("/api/m", mobileDocumentRoutes);

    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    jest.resetModules();
  });

  test("GET /documents/:docId returns the PDF when the bridge resolves content", async () => {
    mockBuildPolicyDocumentPdf.mockReturnValue(Buffer.from("%PDF-fake"));
    const res = await fetch(`${baseUrl}/api/m/documents/house_rules`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(mockBuildPolicyDocumentPdf).toHaveBeenCalledWith("house_rules");
  });

  test("GET /documents/:docId 404s for an unknown id instead of fabricating content", async () => {
    mockBuildPolicyDocumentPdf.mockReturnValue(null);
    const res = await fetch(`${baseUrl}/api/m/documents/not_a_real_policy`);
    expect(res.status).toBe(404);
  });

  test("GET /users/documents returns the service's list, scoped by the resolved tenant", async () => {
    mockListUserDocuments.mockResolvedValue([{ doc_id: "doc_1" }]);
    const res = await fetch(`${baseUrl}/api/m/users/documents`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ doc_id: "doc_1" }]);
    expect(mockListUserDocuments).toHaveBeenCalledWith({ user_id: "tenant-a", _id: "mongo-a" });
  });

  test("POST /users/documents returns 400 with the service's error on validation failure", async () => {
    mockUploadUserDocument.mockResolvedValue({ error: "File must be an image or PDF." });
    const res = await fetch(`${baseUrl}/api/m/users/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "other" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ detail: "File must be an image or PDF." });
  });

  test("POST /users/documents returns 201 with the created record on success", async () => {
    mockUploadUserDocument.mockResolvedValue({ value: { doc_id: "doc_123", status: "pending_review" } });
    const res = await fetch(`${baseUrl}/api/m/users/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "government_id", downloadUrl: "https://firebasestorage.googleapis.com/x" }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ doc_id: "doc_123", status: "pending_review" });
  });

  test("GET /users/documents/:docId/content streams binary content with the resolved content-type", async () => {
    mockGetUserDocumentContent.mockResolvedValue({ status: 200, buffer: Buffer.from("%PDF-x"), contentType: "application/pdf", disposition: "inline" });
    const res = await fetch(`${baseUrl}/api/m/users/documents/doc_1/content`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe("inline");
    expect(await res.text()).toBe("%PDF-x");
  });

  test("GET /users/documents/:docId/content returns 404 without leaking anything when the service can't resolve the doc", async () => {
    mockGetUserDocumentContent.mockResolvedValue({ status: 404, detail: "Document not found." });
    const res = await fetch(`${baseUrl}/api/m/users/documents/someone-elses-doc/content`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ detail: "Document not found." });
  });

  test("DELETE /users/documents/:docId returns the service's result", async () => {
    mockDeleteUserDocument.mockResolvedValue({ status: 200, value: { status: "deleted", doc_id: "doc_1" } });
    const res = await fetch(`${baseUrl}/api/m/users/documents/doc_1`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "deleted", doc_id: "doc_1" });
  });
});
