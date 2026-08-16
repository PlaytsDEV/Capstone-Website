import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Droplets,
  Eye,
  FileImage,
  Flame,
  Hammer,
  History,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Loader2,
  PhoneCall,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
  Wrench,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import {
  fmtDateTime,
  formatBranchLabel,
  formatMaintenanceStatus,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentUri,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
  getRequestBranch,
  isRemoteUri,
} from "../maintenanceUtils";
import { BRANCH_DISPLAY_NAMES } from "../../../../../shared/utils/constants";
import {
  getAllowedAdminMaintenanceStatuses,
  LOCKED_ADMIN_MAINTENANCE_STATUSES,
} from "../../../../../shared/utils/maintenanceConfig";
import { showNotification } from "../../../../../shared/utils/notification";
import { maintenanceApi } from "../../../../../shared/api/maintenanceApi";
import { useSaveMaintenanceProof } from "../../../../../shared/hooks/queries/useMaintenance";
import { ServiceProviderAssignmentPanel } from "./ServiceProviderAssignmentPanel";
import { ProviderRatingCard } from "./ProviderRatingCard";
import { CostAttributionCard } from "./CostAttributionCard";
import { MaintenanceProofInspector } from "./MaintenanceProofInspector";
import { MaintenanceTimeline } from "./MaintenanceTimeline";

function getTypeIcon(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("plumb") || t.includes("pipe") || t.includes("water") || t.includes("leak")) {
    return <Droplets size={16} className="text-sky-600 dark:text-sky-400" />;
  }
  if (t.includes("elect") || t.includes("power") || t.includes("light") || t.includes("wire")) {
    return <Zap size={16} className="text-amber-600 dark:text-amber-400" />;
  }
  if (t.includes("carp") || t.includes("door") || t.includes("lock") || t.includes("furn")) {
    return <Hammer size={16} className="text-amber-700 dark:text-amber-500" />;
  }
  if (t.includes("appliance") || t.includes("ac") || t.includes("aircon")) {
    return <Flame size={16} className="text-rose-600 dark:text-rose-400" />;
  }
  return <Wrench size={16} className="text-slate-600 dark:text-slate-400" />;
}

export function MaintenanceDetailModal({
  open,
  onClose,
  request,
  isLoading = false,
  duplicateData = null,
  timelineItems = [],
  serviceProviders = [],
  isLoadingProviders = false,
  providerChoice,
  onProviderChoiceChange,
  manualProvider,
  onManualProviderChange,
  saveManualProviderForFuture,
  onSaveManualProviderForFutureChange,
  providerFieldErrors = {},
  providerFormMessage = "",
  providerSuggestion = null,
  onAssignProvider,
  onSuggestProvider,
  onUseProviderSuggestion,
  onRateProvider,
  isAssigningProvider = false,
  isSuggestingProvider = false,
  isRatingProvider = false,
  onQuickStatusChange,
  onRemoveAttachment,
  canRemoveAttachments = false,
}) {
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'proof' | 'timeline'
  const [isCopiedId, setIsCopiedId] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  // Proof Upload State
  const saveProofMutation = useSaveMaintenanceProof();
  const [proofFile, setProofFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState(null);
  const [proofNote, setProofNote] = useState("");
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [showProofUploader, setShowProofUploader] = useState(false);
  const proofFileInputRef = useRef(null);

  const handleSelectProofFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showNotification({
        title: "File Too Large",
        message: "Maximum file size is 5MB.",
        type: "error",
      });
      return;
    }
    setProofFile(file);
    setProofPreviewUrl(URL.createObjectURL(file));
  };

  const handleClearProofFile = () => {
    setProofFile(null);
    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
      setProofPreviewUrl(null);
    }
    if (proofFileInputRef.current) {
      proofFileInputRef.current.value = "";
    }
  };

  const handleUploadAndSaveProof = async () => {
    if (!proofFile) {
      showNotification({
        title: "Proof Photo Required",
        message: "Please select a completion proof photo before saving.",
        type: "warning",
      });
      return;
    }

    try {
      setIsUploadingProof(true);
      const reqId = request?.request_id || request?.id || request?._id;
      const uploadRes = await maintenanceApi.uploadAdminMaintenanceAttachment(
        reqId,
        proofFile,
        { visibility: "admin_only" },
      );

      const rawAttachment = uploadRes?.data?.attachment || uploadRes?.attachment || uploadRes?.data || uploadRes;
      const fileUrl = rawAttachment?.url || rawAttachment?.downloadUrl || rawAttachment?.uri || rawAttachment?.src;

      const attachment = {
        id: rawAttachment?.id || rawAttachment?.storagePath || fileUrl,
        name: rawAttachment?.name || rawAttachment?.originalName || proofFile.name,
        uri: fileUrl,
        url: fileUrl,
        downloadUrl: fileUrl,
        type: rawAttachment?.type || rawAttachment?.mimeType || proofFile.type || "image/png",
        mimeType: rawAttachment?.mimeType || rawAttachment?.type || proofFile.type || "image/png",
        size: rawAttachment?.size || proofFile.size,
        visibility: "admin_only",
        storagePath: rawAttachment?.storagePath || null,
        provider: rawAttachment?.provider || null,
      };

      await saveProofMutation.mutateAsync({
        requestId: reqId,
        payload: {
          note: proofNote.trim() || "Resolution proof verified and signed off.",
          attachments: [attachment],
        },
      });

      showNotification({
        title: "Resolution Proof Saved",
        message: "Proof photo uploaded successfully. Ticket has been marked as Completed.",
        type: "success",
      });

      handleClearProofFile();
      setProofNote("");
      setShowProofUploader(false);
    } catch (err) {
      showNotification({
        title: "Upload Failed",
        message: err?.message || "Failed to upload resolution proof.",
        type: "error",
      });
    } finally {
      setIsUploadingProof(false);
    }
  };

  // Reset tab and state on open
  useEffect(() => {
    if (open) {
      setActiveTab("overview");
      setLightboxImage(null);
      setLightboxZoom(1);
      handleClearProofFile();
      setShowProofUploader(false);
    }
  }, [open, request?.request_id]);

  // Handle ESC
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, lightboxImage, onClose]);

  if (!open) return null;

  const rawRequestId = request?.request_id || request?.id || request?._id || "";
  const shortId = rawRequestId ? rawRequestId.slice(-8).toUpperCase() : "—";
  const branchKey = getRequestBranch(request) || request?.branch;
  const branchDisplayName = BRANCH_DISPLAY_NAMES[branchKey] || formatBranchLabel(branchKey) || "All Branches";
  const statusMeta = formatMaintenanceStatus(request?.status);
  const urgencyMeta = getMaintenanceUrgencyMeta(request?.urgency);
  const typeMeta = getMaintenanceTypeMeta(request?.request_type);
  const tenantName =
    request?.tenant?.full_name ||
    request?.tenant?.fullName ||
    request?.tenantName ||
    request?.user?.fullName ||
    (request?.tenant?.firstName ? `${request.tenant.firstName} ${request.tenant.lastName || ""}`.trim() : "") ||
    "Resident";
  const roomName =
    request?.occupancyContext?.unitNumber
      ? `Unit ${request.occupancyContext.unitNumber}`
      : request?.occupancy_context?.unitNumber
        ? `Unit ${request.occupancy_context.unitNumber}`
        : request?.room?.name ||
          (request?.room?.roomNumber ? `Room ${request.room.roomNumber}` : "") ||
          (request?.roomId?.name ? request.roomId.name : "") ||
          (request?.roomId?.roomNumber ? `Room ${request.roomId.roomNumber}` : "") ||
          request?.room_number ||
          request?.roomNumber ||
          "Unit Unassigned";
  const bedSlot =
    request?.occupancyContext?.bedNumber
      ? `Bed ${request.occupancyContext.bedNumber}`
      : request?.occupancy_context?.bedNumber
        ? `Bed ${request.occupancy_context.bedNumber}`
        : request?.bedIdentifier ||
          request?.bed?.bedNumber ||
          request?.bedNumber ||
          null;

  const allowedStatuses = getAllowedAdminMaintenanceStatuses(request?.status);
  const isLocked = LOCKED_ADMIN_MAINTENANCE_STATUSES.includes(request?.status || "");

  // Attachment Collections
  const initialAttachments = Array.isArray(request?.attachments)
    ? request.attachments.filter((att) => !att?.isRemoved)
    : [];

  const rawWorkLog = request?.workLog || request?.work_log || [];
  const workLogAttachments = Array.isArray(rawWorkLog)
    ? rawWorkLog.flatMap((log) =>
        Array.isArray(log?.attachments)
          ? log.attachments.filter((att) => !att?.isRemoved)
          : [],
      )
    : [];

  const handleCopyId = () => {
    if (!rawRequestId) return;
    navigator.clipboard?.writeText(rawRequestId);
    setIsCopiedId(true);
    setTimeout(() => setIsCopiedId(false), 2000);
    showNotification({
      title: "Ticket ID Copied",
      message: `Full ID #${rawRequestId} copied to clipboard.`,
      type: "success",
    });
  };

  const getStatusToneClass = (status) => {
    switch (status) {
      case "completed":
        return "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/60";
      case "in_progress":
        return "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700/60";
      case "approved":
      case "service_provider_assigned":
        return "bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700/60";
      case "pending":
      case "viewed":
        return "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60";
      case "cancelled":
      case "rejected":
        return "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/60";
      default:
        return "bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  const getUrgencyToneClass = (urgency) => {
    switch (urgency) {
      case "emergency":
      case "high":
        return "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/60";
      case "medium":
        return "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60";
      default:
        return "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/60";
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-2 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="maintenance-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !lightboxImage) {
          onClose?.();
        }
      }}
    >
      <div
        className="flex flex-col w-full max-w-5xl h-[700px] max-h-[92vh] rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= HEADER ================= */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/90 px-5 py-3 gap-2.5">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="maintenance-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                Maintenance Request
              </h2>
              <button
                type="button"
                onClick={handleCopyId}
                title="Click to copy ticket ID"
                className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.2 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                {isCopiedId ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                <span>#{shortId}</span>
              </button>
            </div>

            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className={`inline-flex items-center px-2 py-0.2 rounded-full font-semibold text-[11px] border ${getStatusToneClass(request?.status)}`}>
                {statusMeta}
              </span>
              <span className={`inline-flex items-center px-2 py-0.2 rounded-full font-semibold text-[11px] border ${getUrgencyToneClass(request?.urgency)}`}>
                Priority: {urgencyMeta.label}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full font-semibold text-[11px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                <User size={11} className="text-primary" />
                <span>{tenantName}</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.2 rounded-full font-medium text-[11px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {branchDisplayName} • {roomName}{bedSlot ? ` (${bedSlot})` : ""}
              </span>
            </div>
          </div>

          {/* Modal Header Actions */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ================= TAB NAVIGATION ================= */}
        <div className="shrink-0 flex items-center border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-5">
          <div className="flex gap-1 -mb-px">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                activeTab === "overview"
                  ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Wrench size={13} />
              <span>Overview & Dispatch</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("proof")}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                activeTab === "proof"
                  ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <ShieldCheck size={13} />
              <span>Photos & Proof</span>
              {(initialAttachments.length > 0 || workLogAttachments.length > 0) && (
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  {initialAttachments.length + workLogAttachments.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("timeline")}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                activeTab === "timeline"
                  ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <History size={13} />
              <span>Activity & Timeline</span>
              {timelineItems.length > 0 && (
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  {timelineItems.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ================= BODY ================= */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {!request && isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-44 rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-44 rounded-xl bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          ) : (
            <>
              {/* Duplicate Alert Banner */}
              {duplicateData?.hasPotentialDuplicates && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/30 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="font-bold">Potential Duplicate Tickets Detected</span>
                    <p className="mt-0.5 text-amber-800 dark:text-amber-300 leading-relaxed">
                      {duplicateData.count} other ticket(s) logged for this unit/room within 48 hours. Please check existing work orders before dispatching new contractors.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 1: OVERVIEW & DISPATCH */}
              {activeTab === "overview" && (
                <div className="grid gap-3.5 lg:grid-cols-2 items-start">
                  {/* Left Column */}
                  <div className="space-y-3">
                    {/* Compact Problem Details Card */}
                    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-md border text-xs"
                            style={{
                              backgroundColor: `${typeMeta.color}14`,
                              borderColor: `${typeMeta.color}33`,
                              color: typeMeta.color,
                            }}
                          >
                            {getTypeIcon(request.request_type)}
                          </span>
                          <div>
                            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {typeMeta.label} Request
                            </h3>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {fmtDateTime(request.created_at)}
                        </span>
                      </div>

                      {/* Reported Problem Blockquote */}
                      <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                          Reported Problem
                        </span>
                        <blockquote className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed italic border-l-2 border-primary pl-2">
                          "{request.description || "No specific problem details provided by resident."}"
                        </blockquote>
                        {request.notes && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Staff Notes: </span>
                            {request.notes}
                          </div>
                        )}
                      </div>

                      {/* Initial Photo Thumbnails Strip (if any) */}
                      {initialAttachments.length > 0 && (
                        <div className="space-y-1 pt-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                            Attached Photos ({initialAttachments.length})
                          </span>
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                            {initialAttachments.map((att, idx) => {
                              const uri = getMaintenanceAttachmentUri(att);
                              const name = getMaintenanceAttachmentName(att) || `Photo ${idx + 1}`;
                              return (
                                <div
                                  key={idx}
                                  onClick={() => uri && setLightboxImage({ uri, name, tag: "Reported Photo" })}
                                  className="group relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:border-primary transition"
                                >
                                  <img src={uri} alt={name} className="h-full w-full object-cover group-hover:scale-105 transition" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                    <Eye size={12} className="text-white" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cost & Damage Attribution */}
                    <CostAttributionCard request={request} disabled={isLocked} />
                  </div>

                  {/* Right Column: Service Provider Assignment */}
                  <div className="space-y-5">
                    <ServiceProviderAssignmentPanel
                      request={request}
                      providers={serviceProviders}
                      isLoadingProviders={isLoadingProviders}
                      selectedChoice={providerChoice}
                      manualProvider={manualProvider}
                      saveForFuture={saveManualProviderForFuture}
                      fieldErrors={providerFieldErrors}
                      formMessage={providerFormMessage}
                      suggestion={providerSuggestion}
                      isAssigning={isAssigningProvider}
                      isSuggesting={isSuggestingProvider}
                      disabled={isLocked}
                      assignmentDisabled={isLocked}
                      onChoiceChange={onProviderChoiceChange}
                      onManualChange={onManualProviderChange}
                      onSaveForFutureChange={onSaveManualProviderForFutureChange}
                      onAssign={onAssignProvider}
                      onSuggest={onSuggestProvider}
                      onUseSuggestion={onUseProviderSuggestion}
                    />

                    {/* Contractor Performance Rating Card */}
                    <ProviderRatingCard
                      request={request}
                      isSubmitting={isRatingProvider}
                      onSubmitRating={onRateProvider}
                      disabled={isLocked && Boolean(request?.providerRating?.rating)}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: PHOTOS & QUALITY PROOF */}
              {activeTab === "proof" && (
                <div className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    {/* Reported Issue Photos (Before) */}
                    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2">
                          <FileImage size={16} className="text-sky-600 dark:text-sky-400" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Reported Issue ({initialAttachments.length})
                          </h3>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Initial Resident Upload
                        </span>
                      </div>

                      {initialAttachments.length === 0 ? (
                        <div className="flex h-44 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4 text-center">
                          <ImageIcon size={28} className="text-slate-400 dark:text-slate-600 mb-1.5" />
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            No initial photos attached to this request
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {initialAttachments.map((att, idx) => {
                            const uri = getMaintenanceAttachmentUri(att);
                            const name = getMaintenanceAttachmentName(att) || `Reported Photo ${idx + 1}`;
                            const isImg = !uri?.toLowerCase().endsWith(".pdf");

                            return (
                              <div
                                key={idx}
                                onClick={() =>
                                  uri &&
                                  setLightboxImage({
                                    uri,
                                    name,
                                    tag: "Reported Issue (Before)",
                                    attachment: att,
                                    source: "request",
                                    attachmentIndex: idx,
                                  })
                                }
                                className="group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 transition hover:border-primary hover:shadow-md"
                              >
                                {isImg && uri ? (
                                  <img
                                    src={uri}
                                    alt={name}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-1 p-2 text-center text-slate-500">
                                    <FileImage size={24} />
                                    <span className="text-[10px] font-medium line-clamp-2">{name}</span>
                                  </div>
                                )}

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                                  <Eye size={18} className="text-white" />
                                </div>

                                {/* Quick Delete Button */}
                                {canRemoveAttachments && onRemoveAttachment && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveAttachment({
                                        attachment: att,
                                        target: {
                                          source: "request",
                                          attachmentIndex: idx,
                                          attachmentId: att?.id || att?.storagePath,
                                          uri,
                                        },
                                        scope: "request",
                                      });
                                    }}
                                    title="Remove this image"
                                    className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white/90 hover:bg-rose-600 hover:text-white transition opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Resolution Proof (After) */}
                    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            Resolution Proof ({workLogAttachments.length})
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowProofUploader((prev) => !prev)}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Upload Proof</span>
                        </button>
                      </div>

                      {/* Hidden file input */}
                      <input
                        ref={proofFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSelectProofFile}
                        className="hidden"
                      />

                      {/* Inline Proof Uploader Form */}
                      {showProofUploader && (
                        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                              Upload Completion Sign-Off Photo
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                handleClearProofFile();
                                setShowProofUploader(false);
                              }}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {!proofFile ? (
                            <div
                              onClick={() => proofFileInputRef.current?.click()}
                              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-emerald-300 dark:border-emerald-700/60 bg-white/70 dark:bg-slate-900/60 p-4 text-center cursor-pointer hover:bg-white dark:hover:bg-slate-900 transition"
                            >
                              <Upload size={22} className="text-emerald-600 dark:text-emerald-400 mb-1" />
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                Click or drag repair photo here
                              </p>
                              <p className="text-[10px] text-slate-400">JPG, PNG up to 5MB</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 p-2.5">
                              {proofPreviewUrl && (
                                <img
                                  src={proofPreviewUrl}
                                  alt="Proof Preview"
                                  className="h-12 w-12 rounded object-cover border"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                                  {proofFile.name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {(proofFile.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={handleClearProofFile}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}

                          <input
                            type="text"
                            value={proofNote}
                            onChange={(e) => setProofNote(e.target.value)}
                            placeholder="Optional completion note (e.g. Work inspected, faucet leak fixed)"
                            className="h-8 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                          />

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                handleClearProofFile();
                                setShowProofUploader(false);
                              }}
                              className="rounded px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleUploadAndSaveProof}
                              disabled={!proofFile || isUploadingProof}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                            >
                              {isUploadingProof ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                              <span>{isUploadingProof ? "Saving..." : "Save Proof & Complete"}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Display Existing Resolution Proof Photos */}
                      {workLogAttachments.length === 0 && !showProofUploader ? (
                        <div className="flex h-44 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4 text-center">
                          <ShieldCheck size={28} className="text-slate-400 dark:text-slate-600 mb-1.5" />
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            No completion proof photos uploaded yet
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {workLogAttachments.map((att, idx) => {
                            const uri = getMaintenanceAttachmentUri(att);
                            const name = getMaintenanceAttachmentName(att) || `Resolution Proof ${idx + 1}`;
                            const isImg = !uri?.toLowerCase().endsWith(".pdf");

                            return (
                              <div
                                key={idx}
                                onClick={() =>
                                  uri &&
                                  setLightboxImage({
                                    uri,
                                    name,
                                    tag: "Resolution Proof (After)",
                                    attachment: att,
                                    source: "work_log",
                                    attachmentIndex: idx,
                                  })
                                }
                                className="group relative flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 transition hover:border-emerald-500 hover:shadow-md"
                              >
                                {isImg && uri ? (
                                  <img
                                    src={uri}
                                    alt={name}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-1 p-2 text-center text-slate-500">
                                    <FileImage size={24} />
                                    <span className="text-[10px] font-medium line-clamp-2">{name}</span>
                                  </div>
                                )}

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                                  <Eye size={18} className="text-white" />
                                </div>

                                {/* Quick Delete Button */}
                                {canRemoveAttachments && onRemoveAttachment && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveAttachment({
                                        attachment: att,
                                        target: {
                                          source: "work_log",
                                          attachmentIndex: idx,
                                          attachmentId: att?.id || att?.storagePath,
                                          uri,
                                        },
                                        scope: "request",
                                      });
                                    }}
                                    title="Remove this completion proof photo"
                                    className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white/90 hover:bg-rose-600 hover:text-white transition opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ACTIVITY & TIMELINE */}
              {activeTab === "timeline" && (
                <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <History size={16} className="text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Audit Log & Activity History
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {timelineItems.length} Events Logged
                    </span>
                  </div>

                  <MaintenanceTimeline
                    items={timelineItems}
                    onRemoveAttachment={onRemoveAttachment}
                    canRemoveAttachments={canRemoveAttachments}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================= ULTRA-MINIMALIST & RESILIENT LIGHTBOX (PORTAL) ================= */}
      {lightboxImage &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-150 select-none"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
          >
            {/* Top-Right Floating Controls */}
            <div
              className="fixed top-4 right-4 z-50 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxZoom((z) => Math.min(z + 0.25, 2.5));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxZoom((z) => Math.max(z - 0.25, 0.5));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>

              <a
                href={lightboxImage.uri}
                download
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Download Image"
              >
                <Download size={15} />
              </a>

              {/* Direct Delete Image Option (Neutral Default) */}
              {canRemoveAttachments && onRemoveAttachment && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetAtt = lightboxImage.attachment;
                    const source = lightboxImage.source || "request";
                    const attachmentIndex = lightboxImage.attachmentIndex;
                    setLightboxImage(null);
                    onRemoveAttachment({
                      attachment: targetAtt,
                      target: {
                        source,
                        attachmentIndex,
                        attachmentId: targetAtt?.id || targetAtt?.storagePath,
                        uri: lightboxImage.uri,
                      },
                      scope: "request",
                    });
                  }}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white px-3 text-xs font-medium transition cursor-pointer"
                  title="Remove this photo"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxImage(null);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Close (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            {/* Bottom Minimalist Caption Pill (Neutral Default) */}
            <div
              className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            >
              <div className="flex items-center gap-2 rounded-full bg-black/80 border border-white/15 px-4 py-1.5 text-xs text-white shadow-2xl backdrop-blur-md">
                <span className="font-semibold text-white/90 text-[11px] uppercase tracking-wider">
                  {lightboxImage.tag || "Attachment"}
                </span>
                <span className="text-white/30">•</span>
                <span className="text-white/80 font-mono text-[11px] truncate max-w-xs sm:max-w-md">
                  {lightboxImage.name}
                </span>
              </div>
            </div>

            {/* Centered Image Container */}
            <div
              className="flex items-center justify-center overflow-auto p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxImage.uri}
                alt={lightboxImage.name}
                style={{ transform: `scale(${lightboxZoom})`, transition: "transform 0.15s ease" }}
                className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl border border-white/10"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
