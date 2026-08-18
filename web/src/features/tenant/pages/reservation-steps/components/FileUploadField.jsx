import React, { useRef, useState, useEffect } from "react";
import { uploadToFirebaseStorage, validateFile } from "../../../../../shared/utils/firebaseStorageUpload";
import { useAuth } from "../../../../../shared/hooks/useAuth";
import { CheckCircle, AlertTriangle, Upload, Trash2, User } from "lucide-react";

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

const CircularProgressRing = ({ progress, size = 36, strokeWidth = 3.5 }) => {
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <div className="rf-circular-progress-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rf-circular-progress-svg">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          className="rf-circular-bg"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          className="rf-circular-fill"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

const FileUploadField = ({
  label, value, onChange,
  accept = "image/*,.pdf", hint,
  documentType = "document",
  onUploadComplete,
  hasError, required,
}) => {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [error, setError] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);

  // Smoothly interpolate displayProgress towards real target progress
  useEffect(() => {
    if (!uploading) {
      setDisplayProgress(0);
      return;
    }

    const intervalId = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev < progress) {
          const diff = progress - prev;
          const step = Math.max(1, Math.min(diff, Math.ceil(diff * 0.25)));
          return prev + step;
        } else if (prev < 90 && progress < 90) {
          return prev + 1;
        }
        return prev;
      });
    }, 40);

    return () => clearInterval(intervalId);
  }, [progress, uploading]);

  // An existing HTTPS URL (saved from a previous session) counts as uploaded.
  const isUploaded = uploadSuccess || (typeof value === "string" && value.startsWith("https://"));
  const isFile = value instanceof File;
  const showFieldError = Boolean(hasError);

  const handleClick = () => {
    if (!uploading) inputRef.current?.click();
  };

  const handleClear = (event) => {
    event?.stopPropagation();
    setUploadSuccess(false);
    setFileMeta(null);
    setError(null);
    setProgress(0);
    setDisplayProgress(0);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onChange("");
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
    setUploadSuccess(false);
    setProgress(10);
    setDisplayProgress(5);

    try {
      const result = await uploadToFirebaseStorage(
        file,
        { uid: user?.firebaseUid, documentType },
        (pct) => setProgress(Math.max(10, pct)),
      );
      setProgress(100);
      setDisplayProgress(100);
      // Brief pause at 100% so user sees completion before morphing to success
      await new Promise((resolve) => setTimeout(resolve, 350));
      setUploading(false);
      setUploadSuccess(true);
      onChange(result.downloadUrl);
      try {
        await onUploadComplete?.(result.downloadUrl, file);
      } catch {
        // Safe upload callback fallback
      }
    } catch (err) {
      setUploading(false);
      setUploadSuccess(false);
      setProgress(0);
      setDisplayProgress(0);
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
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0] || null;
    if (file) processFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  const isAttached = isUploaded || isFile;

  const zoneClass = [
    "rf-upload-zone",
    isDragging ? "rf-upload-zone--hover" : "",
    showFieldError || error ? "rf-upload-zone--error" : "",
    isUploaded ? "rf-upload-zone--success" : "",
    uploading ? "rf-upload-zone--uploading" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
        onDragLeave={handleDragLeave}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        {uploading ? (
          /* PANEL 3: UPLOADING PROGRESS STATE */
          <div className="rf-upload-loading-panel">
            <div className="rf-upload-preview-card">
              <div className="rf-upload-doc-icon-wrap">
                <User size={34} className="rf-upload-doc-avatar" />
              </div>
            </div>
            <div className="rf-upload-progress-info">
              <CircularProgressRing progress={displayProgress} />
              <span className="rf-upload-progress-percent">
                {displayProgress < 100 ? `Uploading... ${displayProgress}%` : "Finalizing upload..."}
              </span>
            </div>
          </div>
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
            <div className="rf-upload-actions-row">
              <span className="rf-upload-replace-hint">Click to replace</span>
              <span className="rf-upload-meta__dot">·</span>
              <button
                type="button"
                className="rf-upload-clear-btn"
                onClick={handleClear}
                title="Remove attached file"
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </div>
        ) : isFile ? (
          <div>
            <div className="rf-upload-status rf-upload-status--success">
              <CheckCircle size={14} /> {value.name}
            </div>
            <div className="rf-upload-actions-row">
              <span className="rf-upload-replace-hint">Click to replace</span>
              <span className="rf-upload-meta__dot">·</span>
              <button
                type="button"
                className="rf-upload-clear-btn"
                onClick={handleClear}
                title="Remove attached file"
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </div>
        ) : (
          /* PANEL 1: DEFAULT STATE */
          <div className="rf-upload-default-box">
            <div className="rf-upload-icon"><Upload size={20} /></div>
            <div className="rf-upload-cta">Click to upload or drag and drop</div>
            {hint ? <div className="rf-upload-hint">{hint}</div> : null}
            {!error ? <div className="rf-upload-limit">Max 5MB - JPEG, PNG, or PDF</div> : null}
          </div>
        )}

        {error && !uploading ? (
          <div className="rf-upload-error">
            <AlertTriangle size={12} /> {error}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default FileUploadField;
