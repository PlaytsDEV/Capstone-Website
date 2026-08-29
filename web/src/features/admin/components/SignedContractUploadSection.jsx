import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  History,
  ShieldCheck,
  Repeat,
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

const friendlyDocumentFetchError = (err, fallback) => {
  const code = err?.response?.data?.code;
  if (err?.response?.status === 410 || code === "FINAL_DOCUMENT_STORAGE_MISSING" || code === "CONTRACT_ARTIFACT_STORAGE_MISSING") {
    return "The saved contract file is unavailable in storage. Replace the signed copy to restore it.";
  }
  return fallback;
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
  const [deletingVersion, setDeletingVersion] = useState(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const fileInputRef = useRef(null);

  // Formal final-document replacement (once contract.finalDocument exists,
  // the normal /documents/signed upload is blocked server-side with
  // FINAL_DOCUMENT_REPLACEMENT_REQUIRES_FORMAL_PROCESS — this is that
  // process: a distinct flow requiring a mandatory reason and confirmation).
  const [showReplaceForm, setShowReplaceForm] = useState(false);
  const [replaceFile, setReplaceFile] = useState(null);
  const [replacePreviewUrl, setReplacePreviewUrl] = useState(null);
  const [replaceReason, setReplaceReason] = useState("");
  const [replaceConfirming, setReplaceConfirming] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [documentHistory, setDocumentHistory] = useState(null);
  const replaceFileInputRef = useRef(null);

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

  // Preview URL for the file selected in the Replace Final Contract modal
  useEffect(() => {
    if (!replaceFile) {
      setReplacePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(replaceFile);
    setReplacePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [replaceFile]);

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
      const uploadResult = await contractApi.uploadSignedContract(activeContractId, selectedFile, uploadReason);

      // Fetch the updated contract record
      const updated = await contractApi.getContract(activeContractId);
      if (updated?.contract) {
        setContractDetails(updated.contract);
        if (onContractUpdated) onContractUpdated(updated.contract);
      }

      setSelectedFile(null);
      setNotes("");
      setShowUploadForm(false);
      // The plain wet-signed upload finalizes the Contract immediately — no
      // separate notarization step is required for the tenant to see it.
      const finalized = Boolean(uploadResult?.finalDocument) || Boolean(updated?.contract?.finalDocument?.sourceType === "admin_scan");
      showNotification(
        finalized
          ? "Wet-signed contract uploaded — this is now the tenant's final contract."
          : "Scanned contract copy uploaded successfully!",
        "success",
      );
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
    } catch (err) {
      showNotification(friendlyDocumentFetchError(err, "Failed to download signed contract scan."), "error");
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
    } catch (err) {
      showNotification(friendlyDocumentFetchError(err, "Failed to preview signed contract scan."), "error");
    } finally {
      setViewingLoading(false);
    }
  };

  const handleDeleteSigned = async (version) => {
    const contractId = contractDetails?._id || dedicatedContract?._id;
    if (!contractId) return;
    setDeletingVersion(version);
    try {
      await contractApi.deleteSignedContract(contractId, version);
      showNotification("Signed contract scan deleted successfully.", "success");

      if (viewingDoc?.version === version) {
        closeDocViewer();
      }
      setDeleteConfirmDoc(null);

      const updated = await contractApi.getContract(contractId);
      if (updated?.contract) {
        setContractDetails(updated.contract);
        if (onContractUpdated) onContractUpdated(updated.contract);
      }
    } catch (err) {
      showNotification(err?.message || "Failed to delete signed contract scan.", "error");
    } finally {
      setDeletingVersion(null);
    }
  };

  const closeReplaceForm = () => {
    setShowReplaceForm(false);
    setReplaceFile(null);
    setReplaceReason("");
    setReplaceConfirming(false);
  };

  const handleReplaceFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showNotification("Signed contract file must be 10MB or smaller.", "warning");
      return;
    }
    setReplaceFile(file);
    if (e.target) e.target.value = "";
  };

  const handleConfirmReplace = async () => {
    const contractId = contractDetails?._id || dedicatedContract?._id;
    if (!contractId || !replaceFile || !replaceReason.trim()) return;
    setReplacing(true);
    try {
      await contractApi.replaceFinalContract(contractId, replaceFile, replaceReason.trim());
      const updated = await contractApi.getContract(contractId);
      if (updated?.contract) {
        setContractDetails(updated.contract);
        if (onContractUpdated) onContractUpdated(updated.contract);
      }
      showNotification("Final contract replaced. The tenant will see the new document.", "success");
      closeReplaceForm();
      setDocumentHistory(null);
    } catch (err) {
      showNotification(err?.message || "Failed to replace the final contract.", "error");
    } finally {
      setReplacing(false);
    }
  };

  const handleToggleHistory = async () => {
    const contractId = contractDetails?._id || dedicatedContract?._id;
    if (!contractId) return;
    const next = !showHistory;
    setShowHistory(next);
    if (next && !documentHistory) {
      setHistoryLoading(true);
      try {
        const res = await contractApi.getFinalDocumentHistory(contractId);
        setDocumentHistory({ current: res?.current || null, history: res?.history || [] });
      } catch {
        showNotification("Failed to load document version history.", "error");
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const signedDocs = (contractDetails?.signedDocuments || [])
    .filter((doc) => !doc.superseded)
    .sort((a, b) => (b.version || 0) - (a.version || 0));

  const hasFinalDocument = Boolean(contractDetails?.finalDocument);

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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {hasFinalDocument ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Final Contract Published
            </span>
          ) : signedDocs.length > 0 ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              {signedDocs.length} Scan{signedDocs.length > 1 ? "s" : ""} Attached
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
              No Scan Uploaded
            </span>
          )}

          {hasFinalDocument && (
            <button
              type="button"
              onClick={handleToggleHistory}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{showHistory ? "Hide History" : "Version History"}</span>
            </button>
          )}

          {hasFinalDocument ? (
            !showReplaceForm && (
              <button
                type="button"
                onClick={() => setShowReplaceForm(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                title="Replace the tenant-visible final contract (e.g. wrong scan was uploaded)"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Replace Final Contract</span>
              </button>
            )
          ) : (
            !showUploadForm && (
              <button
                type="button"
                onClick={() => setShowUploadForm(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Scan</span>
              </button>
            )
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {hasFinalDocument
          ? "This contract already has a published final document, visible to the tenant on Web and Mobile. To correct a wrong upload, use Replace Final Contract below — the previous version is preserved in Version History, never discarded."
          : "Upload scanned PDF copies or photo attachments of the physical contract containing wet signatures, hand notations, or special contract amendments."}
      </p>

      {/* Version History */}
      {showHistory && (
        <div className="bg-card border border-border rounded-xl p-3.5 space-y-2">
          {historyLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading version history…
            </div>
          ) : (
            <>
              {documentHistory?.current && (
                <div className="flex items-start gap-3 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">v{documentHistory.current.version || 1}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-600 text-white">Active</span>
                      <span className="text-xs text-foreground truncate">{documentHistory.current.fileName}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Published {formatDate(documentHistory.current.publishedAt)}
                      {documentHistory.current.replacementReason && ` — "${documentHistory.current.replacementReason}"`}
                    </p>
                  </div>
                </div>
              )}
              {(documentHistory?.history || []).map((entry) => (
                <div key={entry.version} className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                  <History className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">v{entry.version}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground">Superseded</span>
                      <span className="text-xs text-muted-foreground truncate">{entry.fileName}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Replaced {formatDate(entry.supersededAt)}
                      {entry.replacementReason && ` — Reason: "${entry.replacementReason}"`}
                    </p>
                  </div>
                </div>
              ))}
              {!documentHistory?.current && !(documentHistory?.history || []).length && (
                <p className="text-xs text-muted-foreground py-1">No document history yet.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Replace Final Contract Form */}
      {showReplaceForm && (
        <div className="bg-card border border-amber-300 dark:border-amber-800 rounded-xl p-4 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-amber-600" />
              Replace Final Contract
            </span>
            <button
              type="button"
              onClick={closeReplaceForm}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              The current final contract will be replaced as the tenant-visible document on Web and Mobile.
              The previous version is kept in Version History, never deleted.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Select Replacement File (PDF, JPG, or PNG)
            </label>
            <input
              type="file"
              ref={replaceFileInputRef}
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleReplaceFileChange}
              className="hidden"
            />
            {replaceFile ? (
              <div className="border border-border rounded-xl p-3 bg-muted/20 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {replacePreviewUrl && replaceFile.type.startsWith("image/") ? (
                      <img src={replacePreviewUrl} alt="Replacement preview" className="w-12 h-12 object-cover rounded-lg border border-border flex-shrink-0 bg-background" />
                    ) : (
                      <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate max-w-xs sm:max-w-md">{replaceFile.name}</p>
                      <span className="text-[11px] text-muted-foreground font-mono">{formatFileSize(replaceFile.size)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplaceFile(null)}
                    className="p-1.5 rounded-lg border border-border bg-background hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {replacePreviewUrl && replaceFile.type === "application/pdf" && (
                  <iframe src={replacePreviewUrl} className="w-full h-64 rounded-lg border border-border bg-white" title="Replacement PDF preview" />
                )}
              </div>
            ) : (
              <div
                onClick={() => replaceFileInputRef.current?.click()}
                className="border border-dashed rounded-xl p-5 text-center cursor-pointer transition-all border-border hover:border-amber-500/60 bg-muted/20 hover:bg-muted/40"
              >
                <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1.5" />
                <p className="text-xs font-medium text-foreground">Click to select the corrected contract file</p>
                <p className="text-[11px] text-muted-foreground">Up to 10MB</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Replacement Reason (Required)
            </label>
            <textarea
              rows={2}
              value={replaceReason}
              onChange={(e) => setReplaceReason(e.target.value)}
              placeholder="e.g. Wrong tenant's scan was uploaded by mistake; replacing with the correct signed copy."
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {!replaceConfirming ? (
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeReplaceForm}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!replaceFile || !replaceReason.trim()}
                onClick={() => setReplaceConfirming(true)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Continue</span>
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs text-rose-800 dark:text-rose-300 font-medium">
                  Confirm: this replaces the tenant-visible final contract immediately. Continue?
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={replacing}
                    onClick={() => setReplaceConfirming(false)}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={replacing}
                    onClick={handleConfirmReplace}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {replacing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Replacing…</span>
                      </>
                    ) : (
                      <span>Confirm Replacement</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Form Modal / Drawer */}
      {!hasFinalDocument && showUploadForm && (
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
                      <div className="flex shrink-0 items-center justify-center text-primary">
                        <FileText className="w-8 h-8" />
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
                className={`border border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
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
              }}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              title={
                !selectedFile
                  ? "Please select a scanned contract PDF or image to upload"
                  : uploading
                  ? "Uploading scan..."
                  : "Upload scanned contract"
              }
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0A1628] hover:bg-[#13243D] text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading Scan…</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Contract Scan</span>
                </>
              )}
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
                <div className="flex shrink-0 items-center justify-center text-primary mt-0.5">
                  <FileCheck className="w-6 h-6" />
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

                <button
                  type="button"
                  disabled={deletingVersion === doc.version}
                  onClick={() => setDeleteConfirmDoc(doc)}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-destructive/10 text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  title="Delete signed contract scan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* In-App Document Preview Modal */}
      {viewingDoc && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={closeDocViewer}
          role="dialog"
          aria-modal="true"
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
            <div className="p-3.5 border-t border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground truncate">
                {viewingDoc.replacementReason ? (
                  <span className="italic">
                    Note: &ldquo;{viewingDoc.replacementReason}&rdquo;
                  </span>
                ) : (
                  <span>Verified Signed Contract Scan</span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  disabled={deletingVersion === viewingDoc.version}
                  onClick={() => {
                    const targetDoc = (contractDetails?.signedDocuments || []).find((d) => d.version === viewingDoc.version) || viewingDoc;
                    setDeleteConfirmDoc(targetDoc);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-destructive/10 text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Delete signed contract scan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Scan</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const title = `Signed Contract v${viewingDoc.version || "1"} - ${contract?.contractNumber || "Contract"}`;
                    const win = window.open("", "_blank");
                    if (win) {
                      win.document.write(`<!doctype html><html><head><title>${title}</title><style>html,body{margin:0;height:100%;background:#525659;overflow:hidden;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe src="${viewingDoc.url}" title="${title}"></iframe></body></html>`);
                      win.document.close();
                    } else {
                      window.open(viewingDoc.url, "_blank");
                    }
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
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmDoc && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            if (!deletingVersion) setDeleteConfirmDoc(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground">
                  Delete Signed Contract Scan
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Are you sure you want to delete{" "}
                  <strong className="text-foreground font-semibold">
                    {deleteConfirmDoc.fileName || `Version ${deleteConfirmDoc.version}`}
                  </strong>
                  ? This will remove this document for both administrators and the tenant.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                disabled={Boolean(deletingVersion)}
                onClick={() => setDeleteConfirmDoc(null)}
                className="px-3.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingVersion)}
                onClick={() => handleDeleteSigned(deleteConfirmDoc.version)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {deletingVersion === deleteConfirmDoc.version ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Scan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

