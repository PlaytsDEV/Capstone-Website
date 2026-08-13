/**
 * ============================================================================
 * MOBILE DOCUMENT ROUTES (thin compatibility bridge over canonical document storage)
 * ============================================================================
 *
 * Server-side bridge so the mobile app's /api/m/documents/* and
 * /api/m/users/documents/* calls are answered from real, canonical content
 * and the shared `users.uploaded_documents` store — instead of the vendored
 * server/mobile/controllers/documents.controller.js (fabricated on-the-fly
 * PDF content) and server/mobile/controllers/user.controller.js's
 * inline-base64-only document store (server/mobile/routes/user.routes.js).
 *
 * Mounted at /api/m BEFORE the vendored mobile router (server.js) — same
 * pattern as routes/mobileBillingRoutes.js, routes/mobileContractRoutes.js — so every path defined here fully supersedes
 * the vendored controllers for mobile document traffic. Paths not defined
 * here (e.g. GET /users/documents/:docId, the metadata-only variant the
 * mobile frontend never calls — see documentManager.js comment) fall through
 * to the vendored router unchanged.
 *
 * NOTE: GET /documents/contract is already served by routes/mobileContractRoutes.js
 * (mounted before this router in server.js), so it is never reached here —
 * this router does not define that path, and must not.
 *
 * Every route derives tenant identity exclusively from the resolved mobile
 * session (req.mobileTenant, set by mobileTenantAuth) — never from a
 * client-supplied id — and every document lookup is scoped to that tenant.
 */

import express from "express";
import { mobileTenantAuth } from "../middleware/mobileTenantAuth.js";
import { buildPolicyDocumentPdf } from "../services/mobileDocumentBridge.js";
import {
  listUserDocuments,
  uploadUserDocument,
  getUserDocumentContent,
  deleteUserDocument,
} from "../services/mobileUserDocumentService.js";

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// IMPORTANT: mobileTenantAuth is attached per-route below, NEVER via
// router.use() at the router level — see routes/mobileBillingRoutes.js for
// the full explanation (a router-level router.use() would 401 unrelated
// /api/m/* paths like /api/m/auth/login before they reach their own router).

router.get("/documents/:docId", mobileTenantAuth, (req, res) => {
  const pdfBuffer = buildPolicyDocumentPdf(req.params.docId);
  if (!pdfBuffer) {
    return res.status(404).json({ detail: "Document not found" });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.docId}.pdf"`);
  res.send(pdfBuffer);
});

router.get("/users/documents", mobileTenantAuth, asyncRoute(async (req, res) => {
  const docs = await listUserDocuments(req.mobileTenant);
  res.json(docs);
}));

router.post("/users/documents", mobileTenantAuth, asyncRoute(async (req, res) => {
  const result = await uploadUserDocument(req.mobileTenant, req.body || {});
  if (result.error) return res.status(400).json({ detail: result.error });
  res.status(201).json(result.value);
}));

router.get("/users/documents/:docId/content", mobileTenantAuth, asyncRoute(async (req, res) => {
  const result = await getUserDocumentContent(req.mobileTenant, req.params.docId);
  if (result.status !== 200) {
    return res.status(result.status).json({ detail: result.detail });
  }
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Content-Length", result.buffer.length);
  res.setHeader("Cache-Control", "private, no-store");
  if (result.disposition) res.setHeader("Content-Disposition", result.disposition);
  res.send(result.buffer);
}));

router.delete("/users/documents/:docId", mobileTenantAuth, asyncRoute(async (req, res) => {
  const result = await deleteUserDocument(req.mobileTenant, req.params.docId);
  if (result.status !== 200) {
    return res.status(result.status).json({ detail: result.detail });
  }
  res.json(result.value);
}));

export default router;
