/**
 * Applicant File Upload — re-exports from firebaseStorageUpload.js
 *
 * ImageKit has been fully removed. All uploads now go to Firebase Storage.
 * This file is kept only so existing imports of { uploadIfFile, validateFile }
 * continue to resolve without touching every call site.
 */

export {
  validateFile,
  isValidDownloadUrl,
  validateDownloadUrl,
  uploadIfFile,
} from "./firebaseStorageUpload";
