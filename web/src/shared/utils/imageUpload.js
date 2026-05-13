/**
 * Applicant File Upload — Firebase Storage
 *
 * All applicant uploads now go to Firebase Storage.
 * This module keeps the same public API (`validateFile`, `uploadIfFile`) so
 * existing callers in the reservation hook do not need to change.
 *
 * The old ImageKit endpoint (/api/upload/imagekit-auth) is no longer called.
 */

export {
  validateFile,
  isValidDownloadUrl,
  validateDownloadUrl,
  uploadIfFile,
} from "./firebaseStorageUpload";

/**
 * uploadToImageKit — kept as a named export for backward compatibility with
 * FileUploadField.jsx and any other direct callers.
 *
 * Delegates to Firebase Storage and returns just the download URL so the
 * call site receives the same string it always expected.
 *
 * @param {File}   file
 * @param {(pct: number) => void} [onProgress]
 * @returns {Promise<string>}  HTTPS Firebase Storage download URL
 */
export async function uploadToImageKit(file, onProgress) {
  const { uploadToFirebaseStorage } = await import("./firebaseStorageUpload");
  const result = await uploadToFirebaseStorage(file, {}, onProgress);
  return result.downloadUrl;
}
