import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Upload,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Plus,
  X,
  FileUp,
  Clock,
  MessageSquare,
  Image as ImageIcon,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { contractApi } from "../../../shared/api/contractApi";
import { showNotification } from "../../../shared/utils/notification";

const formatFileSize = (bytes) => {
  if (!bytes) return "—";
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (val) => {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function SignedContractUploadSection({
  tenant,
  dedicatedContract,
  onContractUpdated,
}) {
  const [contractDetails, setContractDetails] = useState(dedicatedContract);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [downloadingVersion, setDownloadingVersion] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setContractDetails(dedicatedContract);
    if (dedicatedContract?._id) {
      contractApi
        .getContract(dedicatedContract._id)
        .then((res) => {
          if (res?.contract) setContractDetails(res.contract);
        })
        .catch(() => {});
    }
  }, [dedicatedContract]);

  // Manage selected file object URL preview
  useEffect(() => {
    if (!selectedFile) {
      setSelectedPreviewUrl(null);
      return;
    }

    const isImg =
      selectedFile.type.startsWith("image/") ||
      Boolean(selectedFile.name.match(/\.(jpe?g|png|webp|jpg)$/i));

    if (isImg) {
      const url = URL.createObjectURL(selectedFile);
      setSelectedPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setSelectedPreviewUrl(null);
    }
  }, [selectedFile]);

  // Clean up viewing document blob URL on modal close
  const closeDocViewer = () => {
    if (viewingDoc?.url) {
      URL.revokeObjectURL(viewingDoc.url);
    }
    setViewingDoc(null);
    setImageZoom(1);
    setImageRotation(0);
  };

  const validateAndProcessFile = (file) => {
    if (!file) return;

    // Limit to 15MB
    if (file.size > 15 * 1024 * 1024) {
      showNotification("File size exceeds 15MB limit.", "warning");
      return;
    }

    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/jpg"];
    const hasValidExt = Boolean(file.name.match(/\.(pdf|jpe?g|png|webp)$/i));

    if (!validTypes.includes(file.type) && !hasValidExt) {
      showNotification("Please upload a PDF document or JPG/PNG image scan.", "warning");
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndProcessFile(file);
    // Reset file input value so selecting the same file again triggers change
    if (e.target) e.target.value = "";
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the current target completely
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showNotification("Please select a scanned contract file to upload.", "warning");
      return;
    }

    setUploading(true);

    try {
      let activeContractId = dedicatedContract?._id || contractDetails?._id;

      // If contract draft doesn't exist yet in the database, initialize it from reservation/stay
      if (!activeContractId) {
        const reservationId = tenant?.reservationId || tenant?._id || tenant?.id;
        const draftRes = await contractApi.createContractDraft({ reservationId });
        activeContractId = draftRes?.contract?._id || draftRes?._id;
      }

      if (!activeContractId) {
        throw new Error("Could not initialize contract record for upload.");
      }

      const uploadReason = notes.trim() || "Uploaded scanned contract copy";
      await contractApi.uploadSignedContract(activeContractId, selectedFile, uploadReason);

      // Fetch the updated contract record
      const updated = await contractApi.getContract(activeContractId);
      if (updated?.contract) {
        setContractDetails(updated.contract);
        if (onContractUpdated) onContractUpdated(updated.contract);
      }

      setSelectedFile(null);
      setNotes("");
      setShowUploadForm(false);
      showNotification("Scanned contract copy uploaded successfully!", "success");
    } catch (err) {
      showNotification(err?.message || "Upload failed. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSigned = async (version, fileName) => {
    const contractId = contractDetails?._id || dedicatedContract?._id;
    if (!contractId) return;
    setDownloadingVersion(version);
    try {
      const blob = await contractApi.getSignedContractFile(contractId, version, true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `Signed-Contract-v${version}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showNotification("Failed to download signed contract scan.", "error");
    } finally {
      setDownloadingVersion(null);
    }
  };

  const handleViewSigned = async (version) => {
    const contractId = contractDetails?._id || dedicatedContract?._id;
    if (!contractId) return;
    setViewingLoading(true);
    try {
      const doc = (contractDetails?.signedDocuments || []).find((d) => d.version === version);
      const blob = await contractApi.getSignedContractFile(contractId, version, false);
      const isImg =
        blob.type.startsWith("image/") ||
        Boolean(doc?.fileName?.match(/\.(jpe?g|png|webp|jpg)$/i));

      const url = URL.createObjectURL(blob);
      setViewingDoc({
        url,
        version,
        fileName: doc?.fileName || `Signed Contract (Version ${version})`,
        fileSize: doc?.fileSize || blob.size,
        uploadedAt: doc?.uploadedAt,
        replacementReason: doc?.replacementReason,
        isImage: isImg,
        mimeType: blob.type,
      });
      setImageZoom(1);
      setImageRotation(0);
    } catch {
      showNotification("Failed to preview signed contract scan.", "error");
    } finally {
      setViewingLoading(false);
    }
  };

  const signedDocs = (contractDetails?.signedDocuments || [])
    .filter((doc) => !doc.superseded)
    .sort((a, b) => (b.version || 0) - (a.version || 0));

  return (
    <div
      className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
          <FileCheck className="w-3.5 h-3.5 text-primary" />
          <span>Wet-Signed Contract Scans &amp; Amendments</span>
        </h4>
        <div className="flex items-center gap-2">
          {signedDocs.length > 0 ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              {signedDocs.length} Scan{signedDocs.length > 1 ? "s" : ""} Attached
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
              No Scan Uploaded
            </span>
          )}

          {!showUploadForm && (
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Scan</span>
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Upload scanned PDF copies or photo attachments of the physical contract containing wet signatures, hand notations, or special contract amendments.
      </p>

      {/* Upload Form Modal / Drawer */}
      {showUploadForm && (
        <form
          onSubmit={handleUpload}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          className="bg-card border border-border rounded-xl p-4 space-y-3.5 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <FileUp className="w-4 h-4 text-primary" />
              Upload Signed Contract Copy
            </span>
            <button
              type="button"
              onClick={() => {
                setShowUploadForm(false);
                setSelectedFile(null);
              }}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* File input / dropzone */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Select Scanned PDF or Image File
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile ? (
              /* Selected File Preview Card */
              <div className="border border-border rounded-xl p-3 bg-muted/20 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {selectedPreviewUrl ? (
                      <img
                        src={selectedPreviewUrl}
                        alt="Selected contract scan preview"
                        className="w-12 h-12 object-cover rounded-lg border border-border flex-shrink-0 bg-background"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 border border-primary/20">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate max-w-xs sm:max-w-md">
                        {selectedFile.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {formatFileSize(selectedFile.size)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-muted text-muted-foreground">
                          {selectedFile.type || selectedFile.name.split(".").pop()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setError("");
                      }}
                      className="p-1.5 rounded-lg border border-border bg-background hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      title="Remove selected file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Dropzone */
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-[0.99]"
                    : "border-border hover:border-primary/60 bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <div className="space-y-1.5">
                  <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center transition-colors ${
                    isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    {isDragging ? (
                      <span className="font-bold text-primary">Drop scanned contract file here</span>
                    ) : (
                      <span>Click to select or drag &amp; drop scanned contract (PDF, PNG, JPG)</span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Up to 15MB file size</p>
                </div>
              </div>
            )}
          </div>

          {/* Notes / Changes in Contract */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Summary of Changes / Signature Details (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Wet-signed on move-in day with 6-month extension notation, approved by lessor."
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowUploadForm(false);
                setSelectedFile(null);
                setError("");
              }}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? "Uploading Scan…" : "Upload Contract Scan"}</span>
            </button>
          </div>
        </form>
      )}

      {/* List of Uploaded Signed Documents */}
      {signedDocs.length > 0 && (
        <div className="space-y-2 pt-1">
          {signedDocs.map((doc, idx) => (
            <div
              key={doc.version || idx}
              className="bg-card border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground truncate max-w-xs sm:max-w-sm">
                      {doc.fileName || `Signed Contract (Version ${doc.version})`}
                    </span>
                    <span className="font-mono text-[10px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      v{doc.version}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatFileSize(doc.fileSize)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(doc.uploadedAt)}
                    </span>
                    {doc.replacementReason && (
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 italic">
                        <MessageSquare className="w-3 h-3 text-muted-foreground" />
                        &ldquo;{doc.replacementReason}&rdquo;
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleViewSigned(doc.version)}
                  disabled={viewingLoading}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  disabled={downloadingVersion === doc.version}
                  onClick={() => handleDownloadSigned(doc.version, doc.fileName)}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{downloadingVersion === doc.version ? "Downloading…" : "Download"}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* In-App Document Preview Modal */}
      {viewingDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={closeDocViewer}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between gap-3 bg-muted/40">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-foreground truncate max-w-md">
                    {viewingDoc.fileName}
                  </h3>
                  <span className="font-mono text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                    Version {viewingDoc.version}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(viewingDoc.fileSize)}
                  </span>
                </div>
                {viewingDoc.uploadedAt && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Uploaded on {formatDate(viewingDoc.uploadedAt)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {viewingDoc.isImage && (
                  <div className="flex items-center gap-1 border border-border rounded-lg bg-background p-1">
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.max(0.5, z - 0.25))}
                      className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono px-1 font-semibold text-foreground">
                      {Math.round(imageZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.min(3, z + 0.25))}
                      className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageRotation((r) => (r + 90) % 360)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors ml-1 border-l border-border pl-1.5"
                      title="Rotate 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={closeDocViewer}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Close viewer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4 bg-muted/20 flex items-center justify-center min-h-[360px] max-h-[68vh]">
              {viewingDoc.isImage ? (
                <div className="overflow-auto max-w-full max-h-full flex items-center justify-center">
                  <img
                    src={viewingDoc.url}
                    alt={viewingDoc.fileName}
                    style={{
                      transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                      transition: "transform 0.15s ease-out",
                    }}
                    className="max-h-[60vh] max-w-full object-contain rounded shadow-md border border-border bg-white"
                  />
                </div>
              ) : (
                <iframe
                  src={viewingDoc.url}
                  className="w-full h-[60vh] rounded-lg border border-border bg-white shadow-xs"
                  title="Contract PDF Viewer"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-border bg-card flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground truncate">
                {viewingDoc.replacementReason ? (
                  <span className="italic">
                    Note: &ldquo;{viewingDoc.replacementReason}&rdquo;
                  </span>
                ) : (
                  <span>Verified Signed Contract Scan</span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    window.open(viewingDoc.url, "_blank");
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Open in Tab</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadSigned(viewingDoc.version, viewingDoc.fileName)}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

