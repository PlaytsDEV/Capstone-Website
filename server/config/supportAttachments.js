// Canonical support-chat attachment limits for this repository.
//
// These numbers are the cross-repo contract. The LilyCrest mobile backend
// states the identical values in its own
// `backend/constants/supportAttachments.js` — each repo owns its copy so
// neither build depends on the other's source tree, and
// `server/models/chatAttachmentCrossRepoContract.test.js` pins them here.
//
// Anything that enforces a support-chat attachment rule must read from this
// module. Maintenance and contract attachments are separate surfaces with
// their own caps — do not fold them in here.

// Per message. Previously a bare `5` inside normalizeAttachments while the
// mobile client enforced 3, so the two apps advertised different limits.
export const MAX_SUPPORT_ATTACHMENTS = 5;

// Per file. Matches multer's `limits.fileSize` below and the `size.max` on the
// ChatAttachment schema, so a record written by either app validates in both.
export const SUPPORT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

// The types both consoles can actually render inline. Deliberately narrow —
// widening it means widening the mobile allow-list in the same change.
export const SUPPORT_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
