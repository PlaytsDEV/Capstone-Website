import { useState, useMemo, useEffect } from "react";
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
  PhoneCall,
  ShieldCheck,
  Sparkles,
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
import { ServiceProviderAssignmentPanel } from "./ServiceProviderAssignmentPanel";
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
  isAssigningProvider = false,
  isSuggestingProvider = false,
  onQuickStatusChange,
  onRemoveAttachment,
  canRemoveAttachments = false,
}) {
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'proof' | 'timeline'
  const [isCopiedId, setIsCopiedId] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  // Reset tab and state on open
  useEffect(() => {
    if (open) {
      setActiveTab("overview");
      setLightboxImage(null);
      setLightboxZoom(1);
    }
  }, [open, request?.request_id]);

  // Handle ESC
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, lightboxImage, onClose]);

  if (!open) return null;

  const rawRequestId = request?.request_id || request?.id || "";
  const shortId = rawRequestId ? rawRequestId.slice(-8).toUpperCase() : "—";
  const branchKey = getRequestBranch(request);
  const branchDisplayName = BRANCH_DISPLAY_NAMES[branchKey] || formatBranchLabel(branchKey) || "All Branches";
  const statusMeta = formatMaintenanceStatus(request?.status);
  const urgencyMeta = getMaintenanceUrgencyMeta(request?.urgency);
  const typeMeta = getMaintenanceTypeMeta(request?.request_type);
  const tenantName = request?.tenant?.full_name || request?.tenantName || "Unknown Resident";
  const roomName = request?.room?.name || request?.roomId?.name || request?.roomNumber || "Unit Unassigned";
  const bedSlot = request?.bedIdentifier || request?.bed?.bedNumber || request?.bedNumber || null;

  const allowedStatuses = getAllowedAdminMaintenanceStatuses(request?.status);
  const isLocked = LOCKED_ADMIN_MAINTENANCE_STATUSES.includes(request?.status || "");

  // Attachment Collections
  const initialAttachments = Array.isArray(request?.attachments)
    ? request.attachments.filter((att) => !att?.isRemoved)
    : [];

  const workLogAttachments = Array.isArray(request?.work_log)
    ? request.work_log.flatMap((log) =>
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
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-3 sm:p-4 md:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="maintenance-modal-title"
    >
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* ================= HEADER ================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/90 px-6 py-4 gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="maintenance-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Maintenance Request
              </h2>
              <button
                type="button"
                onClick={handleCopyId}
                title="Click to copy ticket ID"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                {isCopiedId ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>#{shortId}</span>
              </button>
            </div>

            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold border ${getStatusToneClass(request?.status)}`}>
                {statusMeta}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold border ${getUrgencyToneClass(request?.urgency)}`}>
                Urgency: {urgencyMeta.label}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {branchDisplayName}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {roomName}{bedSlot ? ` · ${bedSlot}` : ""}
              </span>
            </div>
          </div>

          {/* Quick Actions & Close */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {allowedStatuses.length > 0 && !isLocked && onQuickStatusChange && (
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 hidden sm:inline-block">
                  Status:
                </label>
                <select
                  value={request?.status || "viewed"}
                  onChange={(e) => onQuickStatusChange(request?.request_id, e.target.value)}
                  className="h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {allowedStatuses.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ================= TAB NAVIGATION ================= */}
        <div className="flex items-center border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-6">
          <div className="flex gap-1 -mb-px">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
                activeTab === "overview"
                  ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Wrench size={15} />
              <span>Overview & Dispatch</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("proof")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
                activeTab === "proof"
                  ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <ShieldCheck size={15} />
              <span>Photos & Quality Proof</span>
              {(initialAttachments.length > 0 || workLogAttachments.length > 0) && (
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  {initialAttachments.length + workLogAttachments.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("timeline")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
                activeTab === "timeline"
                  ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <History size={15} />
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading || !request ? (
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
                <div className="grid gap-5 lg:grid-cols-2">
                  {/* Left Column */}
                  <div className="space-y-5">
                    {/* Request Details & Description Card */}
                    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <User size={15} />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Resident & Request Details
                            </h3>
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {fmtDateTime(request.created_at)}
                        </span>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                            Tenant Legal Name
                          </span>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block mt-0.5">
                            {tenantName}
                          </span>
                        </div>

                        <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                            Accommodation
                          </span>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block mt-0.5">
                            {branchDisplayName}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            {roomName}{bedSlot ? ` · ${bedSlot}` : ""}
                          </span>
                        </div>

                        <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                            Service Category
                          </span>
                          <div className="flex items-center gap-1.5 mt-1 font-bold text-slate-900 dark:text-slate-100">
                            {getTypeIcon(request.request_type)}
                            <span>{typeMeta.label}</span>
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                            Urgency / SLA
                          </span>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block mt-0.5">
                            {urgencyMeta.label} Priority
                          </span>
                        </div>
                      </div>

                      {/* Prominent Problem Description Callout */}
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-1.5">
                          Tenant's Reported Problem
                        </span>
                        <blockquote className="text-sm text-slate-800 dark:text-slate-200 font-normal leading-relaxed italic border-l-2 border-primary pl-3">
                          "{request.description || "No specific problem details provided by resident."}"
                        </blockquote>
                        {request.notes && (
                          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Staff Notes: </span>
                            {request.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cost & Damage Attribution */}
                    <CostAttributionCard request={request} />
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
                      onChoiceChange={onProviderChoiceChange}
                      onManualChange={onManualProviderChange}
                      onSaveForFutureChange={onSaveManualProviderForFutureChange}
                      onAssign={onAssignProvider}
                      onSuggest={onSuggestProvider}
                      onUseSuggestion={onUseProviderSuggestion}
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
                                onClick={() => uri && setLightboxImage({ uri, name, tag: "Reported Issue (Before)" })}
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
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                                  <Eye size={20} className="text-white" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Resolution Proof (After) */}
                    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            Resolution Proof ({workLogAttachments.length})
                          </h3>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Work Log & Sign-Off Proof
                        </span>
                      </div>

                      {workLogAttachments.length === 0 ? (
                        <div className="flex h-44 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4 text-center">
                          <ShieldCheck size={28} className="text-slate-400 dark:text-slate-600 mb-1.5" />
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            No completion proof photos uploaded yet
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            Contractor resolution logs will appear here upon completion
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {workLogAttachments.map((att, idx) => {
                            const uri = getMaintenanceAttachmentUri(att);
                            const name = getMaintenanceAttachmentName(att) || `Resolution Proof ${idx + 1}`;
                            const isImg = !uri?.toLowerCase().endsWith(".pdf");

                            return (
                              <div
                                key={idx}
                                onClick={() => uri && setLightboxImage({ uri, name, tag: "Resolution Proof (After)" })}
                                className="group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 transition hover:border-emerald-500 hover:shadow-md"
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
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                                  <Eye size={20} className="text-white" />
                                </div>
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

        {/* ================= FOOTER ================= */}
        <div className="flex items-center justify-between border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/90 px-6 py-3.5">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span>Ticket:</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">#{shortId}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Close Details
          </button>
        </div>
      </div>

      {/* ================= LIGHTBOX MODAL ================= */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[1100] flex flex-col items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          {/* Lightbox Top Control Bar */}
          <div
            className="flex w-full max-w-4xl items-center justify-between py-2 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-0.5">
              <span className="inline-block rounded bg-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                {lightboxImage.tag || "Maintenance Attachment"}
              </span>
              <p className="text-xs text-slate-300 font-mono">{lightboxImage.name}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(z + 0.25, 2.5))}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(z - 0.25, 0.5))}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom(1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                title="Reset Zoom"
              >
                <RotateCcw size={15} />
              </button>
              <a
                href={lightboxImage.uri}
                download
                target="_blank"
                rel="noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                title="Download"
              >
                <Download size={16} />
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition"
                title="Close Lightbox"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Lightbox Image Container */}
          <div
            className="flex max-h-[80vh] max-w-4xl items-center justify-center overflow-auto p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage.uri}
              alt={lightboxImage.name}
              style={{ transform: `scale(${lightboxZoom})`, transition: "transform 0.2s ease" }}
              className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
