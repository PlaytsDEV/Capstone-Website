import React, { useRef, useState } from "react";
import { uploadToImageKit, validateFile } from "../../../../../shared/utils/imageUpload";
import { CheckCircle, AlertTriangle, Upload } from "lucide-react";

function formatFileSize(bytes) {
 if (!bytes) return "";
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateName(name, max = 28) {
 if (!name || name.length <= max) return name;
 const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
 return name.slice(0, max - ext.length - 3) + "..." + ext;
}

const FileUploadField = ({
 label, value, onChange,
 accept = "image/*,.pdf", hint, userId,
 onUploadComplete,
 aiCheck,
 isChecking = false,
 hasError, required,
}) => {
 const inputRef = useRef(null);
 const [uploading, setUploading] = useState(false);
 const [progress, setProgress] = useState(0);
 const [error, setError] = useState(null);
 const [fileMeta, setFileMeta] = useState(null);

 const isUploaded = typeof value === "string" && value.startsWith("http");
 const isFile = value instanceof File;
 const showFieldError = hasError && !isUploaded && !isFile;

 const handleClick = () => {
 if (!uploading) inputRef.current?.click();
 };

 const processFile = async (file) => {
 if (!file) return;
 const check = validateFile(file);
 if (!check.valid) {
 setError(check.error);
 return;
 }

 setFileMeta({ name: file.name, size: file.size });
 setError(null);
 setUploading(true);
 setProgress(0);

 try {
 const url = await uploadToImageKit(file, (pct) => setProgress(pct));
 setUploading(false);
 setProgress(100);
 onChange(url);
  try {
  await onUploadComplete?.(url, file);
  } catch (postUploadError) {
 console.warn("Document pre-check fell back to manual review after upload.");
  setError(
  "Document uploaded, but the automatic pre-check could not be completed. Admin will still review this file.",
  );
  }
 } catch (err) {
 setUploading(false);
 setProgress(0);
 setError(err.message || "Upload failed. Please try again.");
 onChange(file);
 }
 };

 const handleChange = (event) => {
 const file = event.target.files?.[0] || null;
 processFile(file);
 event.target.value = "";
 };

 const handleDrop = (event) => {
 event.preventDefault();
 const file = event.dataTransfer.files?.[0] || null;
 if (file) processFile(file);
 };

 const handleDragOver = (event) => event.preventDefault();

 const handleKeyDown = (event) => {
 if (event.key === "Enter" || event.key === " ") {
 event.preventDefault();
 handleClick();
 }
 };

 const aiWarnings = Array.isArray(aiCheck?.aiCheckWarnings)
 ? aiCheck.aiCheckWarnings.filter(Boolean)
 : [];
 const aiStatus = isChecking ? "checking" : aiCheck?.aiCheckStatus || "not_checked";
 const suppressApplicantAiFeedback =
 !isChecking && aiCheck?.provider === "unconfigured";
 const showAiFeedback =
 !suppressApplicantAiFeedback &&
 (aiStatus !== "not_checked" ||
 Boolean(aiCheck?.summaryMessage) ||
 aiWarnings.length > 0);

 const zoneClass = [
 "rf-upload-zone",
 showFieldError ? "rf-upload-zone--error" : "",
 error ? "rf-upload-zone--error" : "",
 isUploaded ? "rf-upload-zone--success" : "",
 uploading ? "rf-upload-zone--uploading" : "",
 ]
 .filter(Boolean)
 .join(" ");

 const aiStatusTone =
 aiStatus === "passed" ? "success" : aiStatus === "checking" ? "info" : "warning";

 return (
 <div className="form-group">
 <label className="form-label">
 {label}
 {required && <span className="rf-required"> *</span>}
 </label>
 <input
 ref={inputRef}
 type="file"
 accept={accept}
 onChange={handleChange}
 className="rf-file-input-hidden"
 />
 <div
 className={zoneClass}
 onClick={handleClick}
 onDrop={handleDrop}
 onDragOver={handleDragOver}
 onKeyDown={handleKeyDown}
 role="button"
 tabIndex={0}
 >
 {uploading ? (
 <>
 <div className="rf-upload-status rf-upload-status--uploading">
 Uploading... {progress}%
 </div>
 {fileMeta ? <div className="rf-upload-filename">{truncateName(fileMeta.name)}</div> : null}
 <div className="rf-upload-progress-track">
 <div className="rf-upload-progress-fill" style={{ width: `${progress}%` }} />
 </div>
 </>
 ) : isUploaded ? (
 <div>
 <div className="rf-upload-status rf-upload-status--success">
 <CheckCircle size={15} /> Uploaded successfully
 </div>
 {fileMeta ? (
 <div className="rf-upload-meta">
 <span className="rf-upload-meta__name">{truncateName(fileMeta.name)}</span>
 <span className="rf-upload-meta__dot">·</span>
 <span>{formatFileSize(fileMeta.size)}</span>
 </div>
 ) : (
 <div className="rf-upload-hint">File uploaded</div>
 )}
 <div className="rf-upload-replace-hint">Click to replace</div>
 </div>
 ) : isFile ? (
 <div className="rf-upload-status rf-upload-status--success">
 <CheckCircle size={14} /> {value.name}
 </div>
 ) : (
 <>
 <div className="rf-upload-icon"><Upload size={20} /></div>
 <div className="rf-upload-cta">Click to upload or drag and drop</div>
 </>
 )}

 {error && !uploading ? (
 <div className="rf-upload-error">
 <AlertTriangle size={12} /> {error}
 </div>
 ) : null}

 {hint && !error ? <div className="rf-upload-hint">{hint}</div> : null}

 {!isUploaded && !isFile && !uploading && !error ? (
 <div className="rf-upload-limit">Max 5MB · JPEG, PNG, or PDF</div>
 ) : null}

 {showAiFeedback && !error ? (
 <div className={`rf-upload-ai-status rf-upload-ai-status--${aiStatusTone}`}>
 {aiStatus === "checking" ? (
 <span>Checking document quality...</span>
 ) : (
 <>
 {aiCheck?.summaryMessage ? <span>{aiCheck.summaryMessage}</span> : null}
 {aiWarnings.length > 0 ? (
 <ul className="rf-upload-ai-status__list">
 {aiWarnings.map((warning, index) => (
 <li key={`${warning}-${index}`}>{warning}</li>
 ))}
 </ul>
 ) : null}
 {aiStatus === "passed" ? (
 <span className="rf-upload-ai-status__footnote">
 Your documents will still be reviewed by admin before payment becomes available.
 </span>
 ) : null}
 </>
 )}
 </div>
 ) : null}
 </div>
 </div>
 );
};

export default FileUploadField;
