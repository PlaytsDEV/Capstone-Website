/**
 * ============================================================================
 * MOBILE USER DOCUMENT SERVICE
 * ============================================================================
 *
 * Canonical implementation backing the mobile app's tenant document
 * upload/list/view/delete flow (GET/POST/DELETE /api/m/users/documents...).
 *
 * IMPORTANT — this intentionally reads/writes the SAME `users.uploaded_documents`
 * embedded-array field, in the SAME shape, that the currently-live standalone
 * mobile backend (LilyCrest-Clean/backend/controllers/user.controller.js)
 * already reads/writes. Both backends share one MongoDB database (confirmed),
 * so this is not a data migration — it is a second, canonical reader/writer of
 * the exact same records, kept field-for-field compatible so:
 *   1. Documents uploaded through the standalone backend (including legacy
 *      inline-base64 `file_data` records from before Firebase Storage was
 *      adopted there) remain fully readable here.
 *   2. Documents uploaded through this canonical path remain fully readable
 *      by the standalone backend for as long as it stays live during the
 *      migration window.
 * Deliberately uses the raw MongoDB driver (mongoose.connection.db), not a
 * Mongoose model, because `uploaded_documents` is not part of the canonical
 * User schema and this service must not require an Auth/User schema change
 * (out of scope for a documents-only phase) to keep working.
 */

import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { getFirebaseStorage, resolveFirebaseStorageBucket } from "../config/firebase.js";
import { authorizeTenantStorageObject } from "./documentStorageAuthorization.service.js";

const DOC_MAX_BYTES = 5 * 1024 * 1024; // 5 MB — mirrors the standalone backend's limit
const DOCUMENT_CONTENT_MAX_BYTES = 50 * 1024 * 1024;
const LOCAL_ONLY_URI_PATTERN = /^(?:file|content|ph|assets-library|blob|ms-appdata):\/\/|^\/data\/user\/|^\/storage\/|^\/private\/var\/|^\/var\/mobile\/|(?:^|[\\/])cache(?:[\\/]|$)/i;

export const ALLOWED_DOC_TYPES = [
  "government_id", "passport", "drivers_license", "student_id", "company_id",
  "lease_extension", "proof_of_income", "authorization_letter", "other",
];

const DOC_TYPE_LABELS = {
  government_id: "Government ID",
  passport: "Passport",
  drivers_license: "Driver's License",
  student_id: "Student ID",
  company_id: "Company/Employee ID",
  lease_extension: "Lease Extension",
  proof_of_income: "Proof of Income",
  authorization_letter: "Authorization Letter",
  other: "Other Document",
};

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
  "image/bmp", "image/heic", "image/heif", "application/pdf",
]);

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const VALID_ID_TYPE_LABELS = {
  national_id: "National ID",
  passport: "Passport",
  drivers_license: "Driver's License",
  sss: "SSS ID",
  philhealth: "PhilHealth ID",
  tin: "TIN ID",
  postal: "Postal ID",
  voters: "Voter's ID",
  prc: "PRC ID",
  umid: "UMID",
  student_id: "Student ID",
};

const APPROVED_RESERVATION_FILTER = {
  $or: [
    { status: { $regex: /^(approved|confirmed|active|completed|checked_in|movein)$/i } },
    { applicationStatus: { $regex: /^(approved|confirmed|active|completed|checked_in|movein)$/i } },
    { approvalStatus: { $regex: /^(approved|confirmed|active|completed|checked_in|movein)$/i } },
    { isApproved: true },
  ],
};

function usersCollection() {
  return mongoose.connection.db.collection("users");
}

function reservationsCollection() {
  return mongoose.connection.db.collection("reservations");
}

function sanitize(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>]/g, "").trim();
}

function isLocalOnlyStoredUrl(value = "") {
  const normalized = String(value || "").trim();
  return Boolean(normalized) && LOCAL_ONLY_URI_PATTERN.test(normalized);
}

/**
 * Validate + normalize the pre-uploaded-to-Firebase metadata the mobile app
 * posts to create a document record. Mirrors the standalone backend's
 * normalizeUploadedDocumentMetadata() field-for-field so the mobile upload
 * screen (my-documents.jsx) needs no changes. The client uploads bytes to
 * Firebase Storage first (via the existing firebase-storage upload proxy);
 * this endpoint only ever receives and validates a resulting URL/metadata —
 * it never accepts inline file bytes for new uploads.
 */
export function normalizeUploadedDocumentMetadata(body = {}) {
  const downloadUrl = sanitize(body.downloadUrl || body.file_url || body.url);
  const mimeType = sanitize(body.mimeType || body.type || "").toLowerCase();
  const originalName = sanitize(body.originalName || body.name || "Uploaded document");
  const storagePath = sanitize(body.storagePath || "");
  const provider = sanitize(body.provider || "firebase-storage") || "firebase-storage";
  const size = Number(body.size);

  if (!downloadUrl) return { error: "downloadUrl is required." };
  if (isLocalOnlyStoredUrl(downloadUrl) || !/^https:\/\//i.test(downloadUrl)) {
    return { error: "Document upload must use a Firebase HTTPS download URL." };
  }
  if (provider !== "firebase-storage") {
    return { error: "Document upload provider must be firebase-storage." };
  }
  if (!/firebasestorage(?:\.googleapis\.com|\.app)/i.test(downloadUrl)) {
    return { error: "Document upload must use a Firebase Storage download URL." };
  }
  if (!mimeType || !ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType)) {
    return { error: "File must be an image or PDF." };
  }
  if (!storagePath) return { error: "storagePath is required." };
  if (Number.isFinite(size) && size > DOC_MAX_BYTES) {
    return { error: "File is too large (max 5 MB)." };
  }

  return {
    value: {
      file_url: downloadUrl,
      downloadUrl,
      storagePath,
      originalName,
      mimeType,
      size: Number.isFinite(size) ? size : null,
      uploadedAt: body.uploadedAt ? new Date(body.uploadedAt) : new Date(),
      provider,
    },
  };
}

/**
 * Map an approved Reservation's onboarding-submitted files (valid ID,
 * selfie, NBI clearance, company ID, proof of payment) into the same
 * pseudo-document shape the mobile "My Documents" screen already expects
 * from the standalone backend — field names and doc_id scheme
 * (`res_<reservationId>_<slot>`) match exactly so no frontend change is
 * needed. These are read-only, source: 'reservation' entries — never
 * created/edited/deleted through this service.
 */
export function buildReservationDocs(reservation) {
  if (!reservation) return [];
  const docs = [];
  const resId = reservation._id?.toString() || "unknown";
  const submittedAt = reservation.applicationSubmittedAt || reservation.createdAt || new Date();

  if (reservation.validIDFrontUrl) {
    const idLabel = VALID_ID_TYPE_LABELS[reservation.validIDType] || "Valid ID";
    docs.push({
      doc_id: `res_${resId}_valid_id_front`, type: "government_id", label: `${idLabel} (Front)`,
      status: "verified", uploaded_at: submittedAt, source: "reservation",
      file_url: reservation.validIDFrontUrl, mimeType: "image/jpeg",
    });
  }
  if (reservation.validIDBackUrl) {
    const idLabel = VALID_ID_TYPE_LABELS[reservation.validIDType] || "Valid ID";
    docs.push({
      doc_id: `res_${resId}_valid_id_back`, type: "government_id", label: `${idLabel} (Back)`,
      status: "verified", uploaded_at: submittedAt, source: "reservation",
      file_url: reservation.validIDBackUrl, mimeType: "image/jpeg",
    });
  }
  if (reservation.selfiePhotoUrl) {
    docs.push({
      doc_id: `res_${resId}_selfie`, type: "government_id", label: "Selfie Photo",
      status: "verified", uploaded_at: submittedAt, source: "reservation",
      file_url: reservation.selfiePhotoUrl, mimeType: "image/jpeg",
    });
  }
  if (reservation.nbiClearanceUrl) {
    docs.push({
      doc_id: `res_${resId}_nbi`, type: "other", label: "NBI Clearance",
      status: "verified", uploaded_at: submittedAt, source: "reservation",
      file_url: reservation.nbiClearanceUrl, mimeType: "image/jpeg",
    });
  }
  if (reservation.companyIDUrl) {
    docs.push({
      doc_id: `res_${resId}_company_id`, type: "company_id", label: "Company / Employee ID",
      status: "verified", uploaded_at: submittedAt, source: "reservation",
      file_url: reservation.companyIDUrl, mimeType: "image/jpeg",
    });
  }
  if (reservation.proofOfPaymentUrl) {
    docs.push({
      doc_id: `res_${resId}_proof_of_payment`, type: "other", label: "Proof of Payment",
      status: "verified", uploaded_at: submittedAt, source: "reservation",
      file_url: reservation.proofOfPaymentUrl, mimeType: "image/jpeg",
    });
  }
  return docs;
}

async function findApprovedReservationForTenant(mobileTenant) {
  const mongoId = mobileTenant?._id;
  const userId = mobileTenant?.user_id;
  const identityFilters = [
    ...(mongoId ? [{ userId: mongoId }, { tenantId: mongoId }] : []),
    ...(userId ? [{ user_id: userId }, { tenant_id: userId }] : []),
  ];
  if (!identityFilters.length) return null;
  return reservationsCollection().findOne(
    { $and: [{ $or: identityFilters }, APPROVED_RESERVATION_FILTER] },
    { sort: { createdAt: -1 } },
  );
}

/**
 * List the authenticated tenant's documents — their own Firebase/legacy
 * uploaded documents PLUS onboarding-submitted reservation documents.
 * Ownership is derived exclusively from `mobileTenant` (resolved server-side
 * from the session by mobileTenantAuth) — never from any client input.
 */
export async function listUserDocuments(mobileTenant) {
  const user = await usersCollection().findOne(
    { user_id: mobileTenant.user_id },
    { projection: { uploaded_documents: 1, _id: 1 } },
  );

  const uploadedDocs = (user?.uploaded_documents || []).map(({ file_data, ...rest }) => rest);
  const reservation = await findApprovedReservationForTenant(mobileTenant);
  const reservationDocs = buildReservationDocs(reservation);

  return [...reservationDocs, ...uploadedDocs].map(({ file_url, downloadUrl, storagePath, ...doc }) => doc);
}

/**
 * Record a document the client already uploaded to Firebase Storage.
 * Returns { error } on validation failure, or { value } with the created
 * document's response shape (matching the standalone backend's POST
 * /users/documents response field-for-field).
 */
export async function uploadUserDocument(mobileTenant, body = {}) {
  const { type, label } = body;
  if (!type || !ALLOWED_DOC_TYPES.includes(type)) {
    return { error: `Invalid document type. Allowed: ${ALLOWED_DOC_TYPES.join(", ")}` };
  }

  const metadata = normalizeUploadedDocumentMetadata(body);
  if (metadata.error) return { error: metadata.error };

  // Prove the submitted storagePath is genuinely this tenant's own object
  // (own upload prefix, and downloadUrl decodes to that exact bucket/path)
  // before any privileged Firebase Admin access is ever performed against it
  // from getUserDocumentContent/deleteUserDocument below. Fail closed.
  const authorization = authorizeTenantStorageObject({
    downloadUrl: metadata.value.downloadUrl,
    storagePath: metadata.value.storagePath,
    userId: mobileTenant.user_id,
    configuredBucket: resolveFirebaseStorageBucket(),
  });
  if (!authorization.authorized) {
    return { error: "Document storage location could not be verified." };
  }

  const docId = `doc_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
  const docEntry = {
    doc_id: docId,
    type,
    label: sanitize(label) || DOC_TYPE_LABELS[type] || type,
    ...metadata.value,
    uploaded_at: metadata.value.uploadedAt,
    status: "pending_review",
  };

  await usersCollection().updateOne(
    { user_id: mobileTenant.user_id },
    { $push: { uploaded_documents: docEntry } },
  );

  return {
    value: {
      doc_id: docId,
      type: docEntry.type,
      label: docEntry.label,
      uploaded_at: docEntry.uploaded_at,
      status: docEntry.status,
      downloadUrl: docEntry.downloadUrl,
      storagePath: docEntry.storagePath,
      originalName: docEntry.originalName,
      mimeType: docEntry.mimeType,
      size: docEntry.size,
      provider: docEntry.provider,
    },
  };
}

/**
 * Resolve a tenant-owned document's binary content, trying (in order):
 *   1. legacy inline base64 (`file_data`, a `data:<mime>;base64,...` URI) —
 *      preserves documents created before Firebase Storage was adopted.
 *   2. canonical Firebase Storage object (`storagePath`) — streamed by
 *      content-type-aware magic-byte validation (NOT hardcoded to PDF, since
 *      a tenant-uploaded document may legitimately be a JPEG/PNG).
 *   3. a stored remote HTTPS URL (`file_url`/`downloadUrl`) fallback.
 * Ownership is enforced by only ever looking inside `mobileTenant`'s own
 * uploaded_documents / reservation record — a docId that doesn't resolve
 * there returns { status: 404 } without ever touching another tenant's data.
 */
export async function getUserDocumentContent(mobileTenant, docId) {
  const user = await usersCollection().findOne(
    { user_id: mobileTenant.user_id },
    { projection: { _id: 1, uploaded_documents: 1 } },
  );
  if (!user) return { status: 404, detail: "Document not found." };

  let doc;
  if (docId.startsWith("res_")) {
    const reservation = await findApprovedReservationForTenant(mobileTenant);
    doc = buildReservationDocs(reservation).find((entry) => entry.doc_id === docId);
  } else {
    doc = (user.uploaded_documents || []).find((entry) => entry.doc_id === docId);
  }
  if (!doc) return { status: 404, detail: "Document not found." };

  if (doc.file_data && /^data:/i.test(doc.file_data)) {
    const match = doc.file_data.match(/^data:([^;,]+);base64,(.+)$/i);
    if (!match) return { status: 422, detail: "Document file is invalid." };
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > DOCUMENT_CONTENT_MAX_BYTES) {
      return { status: 422, detail: "Document file is invalid." };
    }
    return { status: 200, buffer, contentType: match[1], disposition: null };
  }

  if (doc.storagePath) {
    // Re-verify ownership before every privileged read, not just at
    // registration time, so a record stored before this invariant existed
    // (or corrupted/tampered after the fact) can never be served.
    const authorization = authorizeTenantStorageObject({
      downloadUrl: doc.downloadUrl,
      storagePath: doc.storagePath,
      userId: mobileTenant.user_id,
      configuredBucket: resolveFirebaseStorageBucket(),
    });
    if (!authorization.authorized) {
      return { status: 409, detail: "This document could not be verified and must be re-uploaded." };
    }

    let buffer;
    try {
      [buffer] = await getFirebaseStorage().file(doc.storagePath).download();
    } catch (error) {
      return { status: 503, detail: "Document storage is not configured." };
    }
    if (!buffer.length || buffer.length > DOCUMENT_CONTENT_MAX_BYTES) {
      return { status: 422, detail: "Document file is invalid." };
    }
    const declaredMime = String(doc.mimeType || "").toLowerCase();
    const valid = validateMagicBytes(buffer, declaredMime);
    if (!valid) return { status: 422, detail: "Document file is invalid." };
    return { status: 200, buffer, contentType: declaredMime || "application/octet-stream", disposition: "inline" };
  }

  const sourceUrl = doc.file_url || doc.downloadUrl;
  if (!sourceUrl || !/^https:\/\//i.test(sourceUrl)) {
    return { status: 404, detail: "Document file is missing." };
  }
  let upstream;
  try {
    upstream = await fetch(sourceUrl, { signal: AbortSignal.timeout(15000) });
  } catch (error) {
    if (error?.name === "TimeoutError") return { status: 504, detail: "Document request timed out." };
    return { status: 502, detail: "Document file is unavailable." };
  }
  if (!upstream.ok) return { status: 502, detail: "Document file is unavailable." };
  const contentType = String(upstream.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!contentType.startsWith("image/") && contentType !== "application/pdf") {
    return { status: 415, detail: "Document type is not supported." };
  }
  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (!buffer.length || buffer.length > DOCUMENT_CONTENT_MAX_BYTES || !validateMagicBytes(buffer, contentType)) {
    return { status: 422, detail: "Document file is invalid." };
  }
  return { status: 200, buffer, contentType, disposition: "inline" };
}

function validateMagicBytes(buffer, mimeType) {
  const isPdf = buffer.subarray(0, 5).toString() === "%PDF-";
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";

  if (mimeType === "application/pdf") return isPdf;
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return isJpeg;
  if (mimeType === "image/png") return isPng;
  if (mimeType === "image/webp") return isWebp;
  // Other allowed types (gif/bmp/heic/heif) have no cheap magic-byte check
  // here; accept them as long as they're within the declared allow-list —
  // matches the standalone backend's equally permissive handling of these
  // less common types.
  return ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType);
}

/**
 * Delete a tenant-owned uploaded document: mark deletion-pending, delete the
 * underlying Firebase Storage object (if any), then remove the metadata
 * record. If storage deletion fails, the pending flag is rolled back and an
 * error returned rather than leaving an orphaned-but-inaccessible record.
 * Reservation-sourced (`res_`) documents are never deletable through this
 * path (they belong to the onboarding record, not to uploaded_documents).
 */
export async function deleteUserDocument(mobileTenant, docId) {
  if (docId.startsWith("res_")) {
    return { status: 404, detail: "Document not found." };
  }

  const owner = await usersCollection().findOne(
    { user_id: mobileTenant.user_id, "uploaded_documents.doc_id": docId },
    { projection: { uploaded_documents: 1 } },
  );
  const document = owner?.uploaded_documents?.find((entry) => entry.doc_id === docId);
  if (!document) return { status: 404, detail: "Document not found." };

  const marked = await usersCollection().updateOne(
    { user_id: mobileTenant.user_id, uploaded_documents: { $elemMatch: { doc_id: docId, deletion_pending: { $ne: true } } } },
    { $set: { "uploaded_documents.$.deletion_pending": true, "uploaded_documents.$.deletion_requested_at": new Date() } },
  );
  if (marked.matchedCount === 0 && document.deletion_pending !== true) {
    return { status: 409, detail: "Document changed before deletion could start. Please try again." };
  }

  if (document.storagePath) {
    // Re-verify ownership before every privileged delete — same invariant as
    // getUserDocumentContent above. The record belongs to this tenant but its
    // stored path can't be verified (e.g. predates this invariant, or was
    // tampered with) — never issue a privileged delete against an unverified
    // path. Undo the pending-deletion marker and leave the record for review
    // instead of silently discarding it.
    const authorization = authorizeTenantStorageObject({
      downloadUrl: document.downloadUrl,
      storagePath: document.storagePath,
      userId: mobileTenant.user_id,
      configuredBucket: resolveFirebaseStorageBucket(),
    });
    if (!authorization.authorized) {
      await usersCollection().updateOne(
        { user_id: mobileTenant.user_id, "uploaded_documents.doc_id": docId },
        { $unset: { "uploaded_documents.$.deletion_pending": "", "uploaded_documents.$.deletion_requested_at": "" } },
      ).catch(() => {});
      return { status: 409, detail: "This document could not be verified and must be re-uploaded." };
    }

    try {
      await getFirebaseStorage().file(document.storagePath).delete({ ignoreNotFound: true });
    } catch (storageError) {
      await usersCollection().updateOne(
        { user_id: mobileTenant.user_id, "uploaded_documents.doc_id": docId },
        { $unset: { "uploaded_documents.$.deletion_pending": "", "uploaded_documents.$.deletion_requested_at": "" } },
      ).catch(() => {});
      return { status: 503, detail: "Document file could not be deleted. Please try again." };
    }
  }

  const result = await usersCollection().updateOne(
    { user_id: mobileTenant.user_id, "uploaded_documents.doc_id": docId },
    { $pull: { uploaded_documents: { doc_id: docId } } },
  );
  if (result.modifiedCount === 0) {
    return { status: 503, detail: "Document file was deleted, but its record could not be finalized. Retrying is safe." };
  }

  return { status: 200, value: { status: "deleted", doc_id: docId } };
}
