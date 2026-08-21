import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  Calendar,
  CalendarCheck,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Coins,
  Copy,
  DollarSign,
  Download,
  Droplets,
  ExternalLink,
  Eye,
  File,
  FileCheck,
  FileImage,
  FileSpreadsheet,
  FileText,
  Flame,
  Hammer,
  History,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageSquare,
  PhoneCall,
  PlayCircle,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Trash2,
  TrendingUp,
  Upload,
  User,
  UserCheck,
  Wrench,
  X,
  XCircle,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  fmtDateTime,
  formatBranchLabel,
  formatCleanRoomName,
  formatMaintenanceStatus,
  formatPeso,
  formatTurnaroundDuration,
  getClosureMethodMeta,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentUri,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
  getRemainingObservationDays,
  getRequestBranch,
  getStatusBadgeMeta,
  isMaintenanceImageAttachment,
  isMaintenancePdfAttachment,
} from "../maintenanceUtils";
import { BRANCH_DISPLAY_NAMES } from "../../../../../shared/utils/constants";
import {
  getAllowedAdminMaintenanceStatuses,
  LOCKED_ADMIN_MAINTENANCE_STATUSES,
  CANONICAL_MAINTENANCE_STEPS,
  getMaintenanceStepIndex,
  getNextRecommendedStageAction,
} from "../../../../../shared/utils/maintenanceConfig";
import { showNotification } from "../../../../../shared/utils/notification";
import { maintenanceApi } from "../../../../../shared/api/maintenanceApi";
import {
  useScheduleAdminMaintenance,
  useSaveMaintenanceProof,
  useSendMaintenanceReply,
  useReopenAdminMaintenanceRequest,
} from "../../../../../shared/hooks/queries/useMaintenance";
import { MaintenanceConversationSection } from "../../../../../shared/components/MaintenanceConversationSection";
import { ServiceProviderAssignmentPanel } from "./ServiceProviderAssignmentPanel";
import { ProviderRatingCard } from "./ProviderRatingCard";
import { CostAttributionCard } from "./CostAttributionCard";
import { MaintenanceTimeline } from "./MaintenanceTimeline";
import { ModernDateTimePicker } from "./ModernDateTimePicker";

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

function AttachmentThumbnail({
  attachment,
  index = 0,
  onPreviewImage,
  tag = "Tenant Upload",
  size = "normal",
}) {
  const uri = getMaintenanceAttachmentUri(attachment);
  const name = getMaintenanceAttachmentName(attachment) || `Attachment ${index + 1}`;
  const isPdf =
    isMaintenancePdfAttachment(attachment) ||
    String(name).toLowerCase().endsWith(".pdf") ||
    String(uri).toLowerCase().includes(".pdf");
  const [imgError, setImgError] = useState(false);

  const containerSizeClass = size === "large" ? "h-24 w-full" : "h-16 w-20";

  if (isPdf) {
    return (
      <a
        href={uri}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`Click to open PDF: ${name}`}
        className={`group relative flex flex-col items-center justify-center p-2 ${containerSizeClass} shrink-0 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100/80 dark:hover:bg-rose-900/50 hover:border-rose-300 transition text-center shadow-xs cursor-pointer select-none`}
      >
        <FileText size={size === "large" ? 24 : 18} className="text-rose-600 dark:text-rose-400 group-hover:scale-110 transition" />
        <span className="mt-1 text-[10px] font-bold text-rose-950 dark:text-rose-200 truncate w-full px-0.5 leading-tight">
          {name}
        </span>
        <span className="text-[9px] uppercase font-extrabold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-1 py-0.2 rounded mt-0.5">
          PDF
        </span>
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition">
          <ExternalLink size={10} className="text-rose-600 dark:text-rose-400" />
        </div>
      </a>
    );
  }

  return (
    <div
      onClick={() => uri && onPreviewImage?.({ uri, name, tag })}
      title={`Click to view: ${name}`}
      className={`group relative ${size === "large" ? "h-24 w-full" : "h-16 w-16"} shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:border-primary transition shadow-xs`}
    >
      {imgError || !uri ? (
        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 p-1 text-center">
          <ImageIcon size={size === "large" ? 22 : 16} className="mb-0.5" />
          <span className="text-[9px] truncate max-w-full text-slate-500 font-medium px-1">{name}</span>
        </div>
      ) : (
        <>
          <img
            src={uri}
            alt={name}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover group-hover:scale-105 transition"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
            <Eye size={14} className="text-white" />
          </div>
        </>
      )}
    </div>
  );
}

function ReopenRequestModal({
  open,
  onClose,
  request,
  onSubmit,
  isSubmitting,
}) {
  const [reasonNote, setReasonNote] = useState("");
  const [nextStatus, setNextStatus] = useState("in_progress");
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open) {
      setReasonNote("");
      setNextStatus("in_progress");
      setError("");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const cleanNote = reasonNote.trim();
    if (!cleanNote) {
      setError("Please enter a brief reason note explaining why this maintenance request is being reopened.");
      return;
    }
    setError("");
    await onSubmit({ note: cleanNote, nextStatus });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50/70 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs">
              <RefreshCw size={15} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Reopen Maintenance Request
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                #{request?.ticketNumber || request?.request_id?.slice(-8)?.toUpperCase() || "—"} • Next Cycle: Iteration #{((request?.reopenCount || 0) + 1)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Reason for Reopening <span className="text-rose-500">*</span>
            </label>
            <textarea
              ref={textareaRef}
              rows={3}
              value={reasonNote}
              onChange={(e) => {
                setReasonNote(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g., Tenant reported in person that the faucet is still leaking after technician visit."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-primary dark:focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-primary dark:focus:ring-sky-500 transition resize-none"
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
              <span>Reason will be permanently recorded in the audit history.</span>
              <span>{reasonNote.length} characters</span>
            </div>
            {error && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle size={12} />
                <span>{error}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Target Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNextStatus("in_progress")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  nextStatus === "in_progress"
                    ? "border-primary bg-primary/5 dark:bg-sky-500/10 text-slate-900 dark:text-slate-100 font-bold"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
              >
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>In Progress</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 font-normal">
                  Continue work with the assigned technician.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setNextStatus("pending")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  nextStatus === "pending"
                    ? "border-primary bg-primary/5 dark:bg-sky-500/10 text-slate-900 dark:text-slate-100 font-bold"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
              >
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span>Pending Triage</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 font-normal">
                  Return to intake queue for reassessment.
                </p>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reasonNote.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Reopening...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={13} />
                  <span>Reopen Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function ForceFinalizeModal({
  open,
  onClose,
  request,
  onConfirm,
  isSubmitting,
}) {
  const [confirmedCheck, setConfirmedCheck] = useState(false);

  useEffect(() => {
    if (open) {
      setConfirmedCheck(false);
    }
  }, [open]);

  if (!open || !request) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50/70 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Staff Direct Sign-Off
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                #{request?.ticketNumber || request?.request_id?.slice(-8)?.toUpperCase() || "—"} • Advance to Stage 5
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
            <p>
              This action will <strong>bypass the remaining 7-day tenant observation window</strong> and immediately advance this maintenance ticket to <strong>Stage 5 (Completed)</strong>.
            </p>
            <p>
              Please only use this direct sign-off if the tenant has verbally confirmed repair satisfaction, verified in person at the front desk, or has checked out.
            </p>
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmedCheck}
              onChange={(e) => setConfirmedCheck(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              I confirm on-site staff inspection and authorize immediate completion of this ticket.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!confirmedCheck || isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <Check size={13} />
                  <span>Confirm Staff Sign-Off</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MaintenanceDetailModal({
  open,
  onClose,
  request: incomingRequest,
  onSchedule,
  onRespondToReschedule,
  isRespondingToReschedule: isRespondingProp = false,
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
  onGenerateReport,
}) {
  const [localRequestOverride, setLocalRequestOverride] = useState(null);
  const [forceShowActiveWork, setForceShowActiveWork] = useState(false);
  const [isStartingWork, setIsStartingWork] = useState(false);

  // Clear override when modal closes or switches to a different request
  useEffect(() => {
    setLocalRequestOverride(null);
    setForceShowActiveWork(false);
    setIsStartingWork(false);
    setStaffSignOffConfirmed(false);
    setIsSubmittingStage4(false);
  }, [open, incomingRequest?.request_id, incomingRequest?._id]);

  const request = useMemo(() => {
    if (!incomingRequest) return null;
    const incId = String(
      incomingRequest.request_id || incomingRequest.id || incomingRequest._id || "",
    );
    const overrideId = String(
      localRequestOverride?.request_id ||
        localRequestOverride?.id ||
        localRequestOverride?._id ||
        "",
    );
    if (localRequestOverride && (!overrideId || overrideId === incId)) {
      return {
        ...incomingRequest,
        ...localRequestOverride,
      };
    }
    return incomingRequest;
  }, [incomingRequest, localRequestOverride]);

  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'conversation' | 'timeline'
  const [viewedTabs, setViewedTabs] = useState(() => new Set(["overview"]));

  useEffect(() => {
    setViewedTabs(new Set(["overview"]));
  }, [incomingRequest?.request_id, incomingRequest?._id, open]);

  const handleTabChange = useCallback((nextTab) => {
    setActiveTab(nextTab);
    setViewedTabs((prev) => {
      const next = new Set(prev);
      next.add(nextTab);
      return next;
    });
    if (nextTab === "conversation" && (request?.request_id || request?._id)) {
      markConversationSeen(request.request_id || request._id);
    }
  }, [request?.request_id, request?._id]);

  useEffect(() => {
    if (activeTab) {
      setViewedTabs((prev) => {
        if (prev.has(activeTab)) return prev;
        const next = new Set(prev);
        next.add(activeTab);
        return next;
      });
    }
  }, [activeTab]);

  const [isCopiedId, setIsCopiedId] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [showProviderAssigner, setShowProviderAssigner] = useState(false);

  const [seenConvMap, setSeenConvMap] = useState(() => {
    try {
      const map = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("lilycrest_seen_conv_")) {
          map[key] = localStorage.getItem(key);
        }
      }
      return map;
    } catch {
      return {};
    }
  });

  const getUnreadConvCount = (req, isTabActive = false) => {
    if (!req || !Array.isArray(req.conversation) || req.conversation.length === 0) {
      return 0;
    }
    if (isTabActive) {
      return 0;
    }
    const key = `lilycrest_seen_conv_${req.request_id || req._id}_admin`;
    const rawSeen = seenConvMap[key] || localStorage.getItem(key);
    const seenTime = rawSeen ? new Date(rawSeen).getTime() : 0;

    const unread = req.conversation.filter((msg) => {
      // Only messages from tenant are incoming to admin
      if (msg.sender_side === "admin") return false;
      const msgTime = new Date(msg.created_at).getTime();
      return msgTime > seenTime;
    });

    return unread.length;
  };

  const markConversationSeen = (reqId) => {
    if (!reqId) return;
    const key = `lilycrest_seen_conv_${reqId}_admin`;
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(key, nowIso);
    } catch {}
    setSeenConvMap((prev) => ({ ...prev, [key]: nowIso }));
  };

  const [tenantIsTyping, setTenantIsTyping] = useState(false);
  const [tenantTypingName, setTenantTypingName] = useState("");
  const tenantTypingTimerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const currentTicketId = String(
      incomingRequest?.request_id || incomingRequest?._id || "",
    );
    if (!currentTicketId) return;

    const handleMaintenanceEvent = (e) => {
      const detail = e.detail || {};
      const targetIds = [
        detail.requestId,
        detail.request_id,
        detail.ticketId,
        detail.ticketNumber,
        detail.request?._id,
        detail.request?.request_id,
        detail.request?.ticketNumber,
      ].filter(Boolean);

      const match = targetIds.some(
        (id) =>
          String(id) === String(incomingRequest?._id) ||
          String(id) === String(incomingRequest?.id) ||
          String(id) === String(incomingRequest?.request_id) ||
          String(id) === String(incomingRequest?.ticketNumber) ||
          String(id) === String(request?._id) ||
          String(id) === String(request?.request_id) ||
          String(id) === String(request?.ticketNumber),
      );

      if (match) {
        if (detail.conversation || detail.request) {
          setLocalRequestOverride((prev) => ({
            ...(prev || {}),
            ...(detail.request || {}),
            conversation: detail.conversation || detail.request?.conversation || prev?.conversation,
            status: detail.status || detail.request?.status || prev?.status,
            updated_at: detail.updated_at || detail.request?.updated_at || new Date().toISOString(),
          }));
        }
        if (activeTab === "conversation") {
          markConversationSeen(incomingRequest?.request_id || incomingRequest?._id);
        }
      }
    };

    const handleTypingEvent = (e) => {
      const detail = e.detail || {};
      const targetIds = [
        detail.requestId,
        detail.request_id,
        detail.ticketId,
        detail.ticketNumber,
      ].filter(Boolean);

      const match = targetIds.some(
        (id) =>
          String(id) === String(incomingRequest?._id) ||
          String(id) === String(incomingRequest?.id) ||
          String(id) === String(incomingRequest?.request_id) ||
          String(id) === String(incomingRequest?.ticketNumber) ||
          String(id) === String(request?._id) ||
          String(id) === String(request?.request_id) ||
          String(id) === String(request?.ticketNumber),
      );

      if (match && detail.senderSide === "tenant") {
        setTenantIsTyping(Boolean(detail.isTyping));
        setTenantTypingName(detail.senderName || "Tenant");

        if (tenantTypingTimerRef.current) clearTimeout(tenantTypingTimerRef.current);
        if (detail.isTyping) {
          tenantTypingTimerRef.current = setTimeout(() => {
            setTenantIsTyping(false);
          }, 3500);
        }
      }
    };

    window.addEventListener("lilycrest:maintenance-updated", handleMaintenanceEvent);
    window.addEventListener("lilycrest:maintenance-message", handleMaintenanceEvent);
    window.addEventListener("lilycrest:maintenance-typing", handleTypingEvent);

    return () => {
      window.removeEventListener("lilycrest:maintenance-updated", handleMaintenanceEvent);
      window.removeEventListener("lilycrest:maintenance-message", handleMaintenanceEvent);
      window.removeEventListener("lilycrest:maintenance-typing", handleTypingEvent);
      if (tenantTypingTimerRef.current) clearTimeout(tenantTypingTimerRef.current);
    };
  }, [open, incomingRequest?._id, incomingRequest?.id, incomingRequest?.request_id, activeTab]);

  useEffect(() => {
    if (request?._id || request?.request_id) {
      if (activeTab === "conversation") {
        markConversationSeen(request.request_id || request._id);
      }
    }
  }, [request?.request_id, request?._id, activeTab, request?.conversation?.length]);

  // Proof Upload & Unified Stage 3 Resolution State
  const costCardRef = useRef(null);
  const providerRatingRef = useRef(null);
  const saveProofMutation = useSaveMaintenanceProof();
  const sendReplyMutation = useSendMaintenanceReply();
  const [proofFile, setProofFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState(null);
  const [proofNote, setProofNote] = useState("");
  const [proofTouched, setProofTouched] = useState(false);
  const [isDraggingProof, setIsDraggingProof] = useState(false);
  const [isSubmittingUnified, setIsSubmittingUnified] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [staffSignOffConfirmed, setStaffSignOffConfirmed] = useState(false);
  const [isSubmittingStage4, setIsSubmittingStage4] = useState(false);
  const proofFileInputRef = useRef(null);

  // Reopen modal state
  const reopenAdminMutation = useReopenAdminMaintenanceRequest();
  const [showReopenDialog, setShowReopenDialog] = useState(false);

  // Force Finalize (Manual Override) modal state
  const [showForceFinalizeModal, setShowForceFinalizeModal] = useState(false);
  const [isForceFinalizing, setIsForceFinalizing] = useState(false);

  const handleConfirmReopen = async ({ note, nextStatus }) => {
    const targetRequestId = request?.request_id || request?.id || request?._id;
    if (!targetRequestId) return;
    try {
      const res = await reopenAdminMutation.mutateAsync({
        requestId: targetRequestId,
        payload: {
          note,
          nextStatus,
        },
      });
      const updatedReq = res?.request || res?.data?.request || (res?.status ? res : null);
      if (updatedReq) {
        setLocalRequestOverride(updatedReq);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          status: nextStatus,
          isReopened: true,
          reopenCount: ((prev || request)?.reopenCount || 0) + 1,
          reopen_note: note,
          resolved_at: null,
          closed_at: null,
          resolution_note: null,
        }));
      }
      setShowReopenDialog(false);
      showNotification({
        title: "Request Reopened",
        message: `Request #${request?.ticketNumber || (targetRequestId ? String(targetRequestId).slice(-8).toUpperCase() : "—")} reopened and returned to ${nextStatus === "pending" ? "Pending Triage" : "In Progress"}.`,
        type: "success",
      });
    } catch (err) {
      showNotification({
        title: "Reopen Failed",
        message: err?.response?.data?.message || err?.message || "Failed to reopen maintenance request.",
        type: "error",
      });
      throw err;
    }
  };

  const handleRatingSubmit = async (ratingPayload) => {
    const targetRequestId =
      request?.request_id ||
      request?.id ||
      request?._id ||
      incomingRequest?.request_id ||
      incomingRequest?.id ||
      incomingRequest?._id;

    const res = await onRateProvider?.({
      requestId: targetRequestId,
      ...ratingPayload,
    });

    const savedRating =
      res?.providerRating ||
      res?.data?.providerRating ||
      res?.request?.providerRating ||
      res?.data?.request?.providerRating || {
        rating: ratingPayload.rating,
        tags: ratingPayload.tags,
        feedback: ratingPayload.feedback,
        ratedAt: new Date().toISOString(),
        ratedByName: "Admin",
      };

    if (savedRating) {
      setLocalRequestOverride((prev) => ({
        ...(prev || request || {}),
        providerRating: savedRating,
      }));
    }

    return res;
  };

  const handleConfirmForceFinalize = async () => {
    const rawReqId = request?.request_id || request?.id || request?._id;
    if (!rawReqId) return;

    const isLocked =
      request?.status === "completed" ||
      request?.status === "closed" ||
      request?.status === "cancelled" ||
      request?.status === "rejected";

    if (isLocked) {
      showNotification({
        title: "Ticket Locked",
        message: "This maintenance request is locked and its status cannot be modified.",
        type: "warning",
      });
      return;
    }

    try {
      setIsForceFinalizing(true);

      // 1. Save Cost Attribution if changes exist
      if (costCardRef.current?.saveCost) {
        await costCardRef.current.saveCost();
      }

      // 2. Save Contractor Rating if provided and uncommitted
      if (providerRatingRef.current?.saveRating) {
        await providerRatingRef.current.saveRating();
      }

      // 3. Advance status to Completed (Stage 5) via direct admin override
      const res = await onQuickStatusChange?.(rawReqId, "completed");
      const updatedReq = res?.request || res?.data?.request || (res?.status ? res : null);
      if (updatedReq) {
        setLocalRequestOverride(updatedReq);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          status: "completed",
          closed_at: new Date().toISOString(),
        }));
      }

      setShowForceFinalizeModal(false);
      showNotification({
        title: "Maintenance Ticket Completed",
        message: `Ticket #${request?.ticketNumber || String(rawReqId).slice(-8).toUpperCase()} has been confirmed fixed and finalized via staff direct sign-off.`,
        type: "success",
      });
    } catch (err) {
      showNotification({
        title: "Finalization Failed",
        message: err?.response?.data?.message || err?.message || "Failed to finalize maintenance sign-off.",
        type: "error",
      });
    } finally {
      setIsForceFinalizing(false);
    }
  };

  // Scheduling panel state
  const scheduleMutation = useScheduleAdminMaintenance();
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
  const currentScheduledDate =
    request?.scheduledDate ||
    request?.scheduled_date ||
    request?.schedule?.scheduledDate ||
    localRequestOverride?.scheduledDate ||
    null;

  const rescheduleRequestData =
    request?.rescheduleRequest ||
    request?.reschedule_request ||
    localRequestOverride?.rescheduleRequest ||
    null;

  const handleConfirmProviderAndSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      showNotification({
        title: "Schedule Required",
        message: "Please select a visit date and time for the technician.",
        type: "warning",
      });
      return;
    }
    try {
      setIsSubmittingSchedule(true);
      const scheduledIso = `${scheduleDate}T${scheduleTime}:00`;
      const res = await onAssignProvider?.({
        scheduledDate: scheduledIso,
        scheduleNotes: scheduleNote.trim() || undefined,
      });

      // 1. Advance to Stage 3 (Scheduled & Awaiting Visit)
      const updatedReq = res?.request || res?.data?.request || (res?.status ? res : null);
      if (updatedReq) {
        setLocalRequestOverride(updatedReq);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          status: "scheduled",
          scheduledDate: scheduledIso,
          schedule: {
            scheduledDate: scheduledIso,
            notes: scheduleNote.trim() || undefined,
          },
        }));
      }

      // 2. Safely reset schedule form data
      setScheduleDate("");
      setScheduleTime("");
      setScheduleNote("");
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleStartRepairWork = async () => {
    if (rescheduleRequestData?.status === "pending") {
      showNotification({
        title: "Pending Reschedule Request",
        message: "Please accept, propose an alternate date, or decline the tenant's reschedule request before starting repair work.",
        type: "warning",
      });
      return;
    }
    const rawReqId = request?.request_id || request?.id || request?._id;
    try {
      setIsStartingWork(true);
      const res = await onQuickStatusChange?.(rawReqId, "in_progress");
      const updatedReq = res?.request || res?.data?.request || (res?.status ? res : null);
      if (updatedReq) {
        setLocalRequestOverride(updatedReq);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          status: "in_progress",
          in_progress_at: new Date().toISOString(),
        }));
      }
      setForceShowActiveWork(true);
      showNotification({
        title: "Repair Work Started",
        message: "Status updated to In Progress. Technician is now actively working on site.",
        type: "success",
      });
    } catch (err) {
      showNotification({
        title: "Failed to Start Work",
        message: err?.response?.data?.message || err?.message || "Failed to start repair work.",
        type: "error",
      });
    } finally {
      setIsStartingWork(false);
    }
  };

  const [showAlternatePanel, setShowAlternatePanel] = useState(false);
  const [alternateDate, setAlternateDate] = useState("");
  const [alternateTime, setAlternateTime] = useState("");
  const [alternateNote, setAlternateNote] = useState("");
  const [isSubmittingAlternate, setIsSubmittingAlternate] = useState(false);
  const [isAcceptingReschedule, setIsAcceptingReschedule] = useState(false);

  const isRespondingToReschedule = Boolean(isRespondingProp || isAcceptingReschedule);

  const handleAcceptReschedule = async (proposedDate) => {
    if (!proposedDate) return;
    try {
      setIsAcceptingReschedule(true);
      const res = await onRespondToReschedule?.({
        action: "accept",
        scheduledDate: proposedDate,
      });

      const updatedReq = res?.request || res?.data?.request || (res?.status ? res : null);
      if (updatedReq) {
        setLocalRequestOverride(updatedReq);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          scheduledDate: proposedDate,
          schedule: {
            ...(prev || request)?.schedule,
            scheduledDate: proposedDate,
          },
          rescheduleRequest: {
            ...(prev || request)?.rescheduleRequest,
            status: "accepted",
          },
        }));
      }

      showNotification({
        title: "Reschedule Accepted",
        message: `Visit schedule updated to ${fmtDateTime(proposedDate)}.`,
        type: "success",
      });
    } catch (err) {
      showNotification({
        title: "Failed to Accept Reschedule",
        message: err?.response?.data?.message || err?.message || "Failed to accept reschedule.",
        type: "error",
      });
    } finally {
      setIsAcceptingReschedule(false);
    }
  };

  const handleSetAlternateSchedule = async () => {
    if (!alternateDate || !alternateTime) {
      showNotification({
        title: "Date & Time Required",
        message: "Please select both an alternate visit date and time.",
        type: "warning",
      });
      return;
    }
    if (!alternateNote.trim() || alternateNote.trim().length < 5) {
      showNotification({
        title: "Explanation Note Required",
        message: "Please provide a brief note (at least 5 characters) explaining why an alternate schedule was set.",
        type: "warning",
      });
      return;
    }

    try {
      setIsSubmittingAlternate(true);
      const scheduledIso = `${alternateDate}T${alternateTime}:00`;
      const res = await onRespondToReschedule?.({
        action: "adjust",
        scheduledDate: scheduledIso,
        notes: alternateNote.trim(),
      });

      const updatedReq = res?.request || res?.data?.request || (res?.status ? res : null);
      if (updatedReq) {
        setLocalRequestOverride(updatedReq);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          scheduledDate: scheduledIso,
          schedule: {
            ...(prev || request)?.schedule,
            scheduledDate: scheduledIso,
            notes: alternateNote.trim(),
          },
          rescheduleRequest: {
            ...(prev || request)?.rescheduleRequest,
            status: "adjusted",
            responseNote: alternateNote.trim(),
          },
        }));
      }

      setShowAlternatePanel(false);
      setAlternateDate("");
      setAlternateTime("");
      setAlternateNote("");

      showNotification({
        title: "Alternate Schedule Sent",
        message: `Alternate visit set for ${alternateDate} at ${alternateTime}.`,
        type: "success",
      });
    } catch (err) {
      showNotification({
        title: "Failed to Send Alternate Schedule",
        message: err?.response?.data?.message || err?.message || "Failed to set alternate schedule.",
        type: "error",
      });
    } finally {
      setIsSubmittingAlternate(false);
    }
  };

  const [showDeclinePanel, setShowDeclinePanel] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);

  const handleDeclineReschedule = async () => {
    if (!declineReason || declineReason.trim().length < 5) {
      showNotification({
        title: "Reason Required",
        message: "Please provide a brief reason (at least 5 characters) for declining the reschedule request.",
        type: "warning",
      });
      return;
    }

    try {
      setIsSubmittingDecline(true);
      const res = await onRespondToReschedule?.({
        action: "decline",
        notes: declineReason.trim(),
      });

      const updatedReq = res?.request || res?.data?.request || (res?.status ? res : null);
      if (updatedReq) {
        setLocalRequestOverride(updatedReq);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          rescheduleRequest: {
            ...(prev || request)?.rescheduleRequest,
            status: "declined",
            responseNote: declineReason.trim(),
          },
        }));
      }

      setShowDeclinePanel(false);
      setDeclineReason("");
      showNotification({
        title: "Reschedule Request Declined",
        message: "The tenant's reschedule request has been declined. Original visit schedule maintained.",
        type: "success",
      });
    } catch (err) {
      showNotification({
        title: "Error Declining Request",
        message: err?.response?.data?.message || err?.message || "Failed to decline reschedule request.",
        type: "error",
      });
    } finally {
      setIsSubmittingDecline(false);
    }
  };

  const handleScheduleVisit = async () => {
    if (!scheduleDate || !scheduleTime) {
      showNotification({
        title: "Date & Time Required",
        message: "Please select both a visit date and time.",
        type: "warning",
      });
      return;
    }
    try {
      setIsSubmittingSchedule(true);
      const reqId = request?.request_id || request?.id || request?._id;
      let rawDate = scheduleDate;
      if (typeof rawDate === "string" && rawDate.includes("T")) {
        rawDate = rawDate.split("T")[0];
      }
      let rawTime = scheduleTime;
      if (typeof rawTime === "string" && rawTime.length === 5) {
        rawTime = `${rawTime}:00`;
      }
      const scheduledIso = `${rawDate}T${rawTime}`;
      const result = await scheduleMutation.mutateAsync({
        requestId: reqId,
        payload: {
          scheduledDate: scheduledIso,
          notes: scheduleNote.trim() || undefined,
        },
      });

      const updatedReq =
        result?.request || result?.data?.request || (result?.status ? result : null);
      if (updatedReq) {
        setLocalRequestOverride(updatedReq);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          scheduledDate: scheduledIso,
          schedule: {
            ...(prev || request)?.schedule,
            scheduledDate: scheduledIso,
            notes: scheduleNote.trim() || undefined,
          },
        }));
      }

      showNotification({
        title: "Visit Scheduled",
        message: `Repair visit scheduled for ${scheduleDate} at ${scheduleTime}.`,
        type: "success",
      });
      setShowScheduler(false);
      setScheduleDate("");
      setScheduleTime("");
      setScheduleNote("");
      onSchedule?.();
    } catch (err) {
      showNotification({
        title: "Scheduling Failed",
        message: err?.response?.data?.message || err?.message || "Failed to schedule repair visit.",
        type: "error",
      });
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleClearSchedule = async () => {
    try {
      setIsSubmittingSchedule(true);
      const reqId = request?.request_id || request?.id || request?._id;
      const result = await scheduleMutation.mutateAsync({
        requestId: reqId,
        payload: {
          clearSchedule: true,
          action: "reject_schedule",
          scheduledDate: null,
        },
      });

      const updatedReq =
        result?.request || result?.data?.request || (result?.status ? result : null);
      if (updatedReq) {
        setLocalRequestOverride(updatedReq);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          scheduledDate: null,
          schedule: {
            ...(prev || request)?.schedule,
            scheduledDate: null,
          },
        }));
      }

      showNotification({
        title: "Planned Schedule Rejected",
        message: "The planned schedule date has been rejected and removed. You can set a new schedule anytime.",
        type: "success",
      });
      setShowScheduler(false);
      setScheduleDate("");
      setScheduleTime("");
      onSchedule?.();
    } catch (err) {
      showNotification({
        title: "Failed to Reject Schedule",
        message: err?.response?.data?.message || err?.message || "Failed to reject planned schedule.",
        type: "error",
      });
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const [selectedPreset, setSelectedPreset] = useState(null);

  const applySchedulePreset = (preset) => {
    setSelectedPreset(preset);
    const now = new Date();
    if (preset === "today") {
      now.setHours(now.getHours() + 2, 0, 0, 0);
    } else if (preset === "tomorrow_morning") {
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
    } else if (preset === "tomorrow_afternoon") {
      now.setDate(now.getDate() + 1);
      now.setHours(14, 0, 0, 0);
    }
    const dStr = now.toISOString().slice(0, 10);
    const tStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setScheduleDate(dStr);
    setScheduleTime(tStr);
  };

  const handleAdminSendReply = async ({ message, attachments = [] }) => {
    const reqId = request?.request_id || request?.id || request?._id;
    return sendReplyMutation.mutateAsync({
      requestId: reqId,
      payload: {
        message,
        attachments,
      },
    });
  };

  const handleAdminTypingChange = (isTyping) => {
    const reqId = request?.request_id || request?.id || request?._id || incomingRequest?.request_id || incomingRequest?._id;
    if (!reqId) return;
    maintenanceApi.sendAdminTyping(reqId, isTyping).catch(() => {});
  };

  const handleCopyPhone = (phone) => {
    if (!phone) return;
    navigator.clipboard?.writeText?.(phone);
    setCopiedPhone(true);
    showNotification({
      title: "Contact Copied",
      message: `Phone number ${phone} copied to clipboard.`,
      type: "success",
    });
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleProcessProofFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showNotification({
        title: "Invalid File Type",
        message: "Please upload an image file (PNG, JPG, JPEG, WEBP).",
        type: "error",
      });
      return;
    }
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
    setProofTouched(false);
  };

  const handleSelectProofFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessProofFile(file);
    }
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


  // Unified Multi-Card Next Action for Stage 3 (In Progress -> Resolved)
  const handleUnifiedCompleteAndResolve = async () => {
    if (rescheduleRequestData?.status === "pending") {
      showNotification({
        title: "Pending Reschedule Request",
        message: "Cannot mark work as done while a tenant reschedule request is pending. Please accept, adjust, or decline the reschedule request first.",
        type: "warning",
      });
      return;
    }

    setProofTouched(true);

    // 1. Validate proof photo
    if (!proofFile) {
      showNotification({
        title: "Proof Photo Required",
        message: "Please attach a photo proof of the completed repair before resolving.",
        type: "warning",
      });
      return;
    }

    // 2. Validate Cost Attribution Card
    const costValidation = costCardRef.current?.validate?.();
    if (costValidation && !costValidation.valid) {
      showNotification({
        title: "Expense Validation Error",
        message: costValidation.message || "Please fix errors in the Repair Expenses section.",
        type: "warning",
      });
      return;
    }

    try {
      setIsSubmittingUnified(true);

      // 3. Save Cost Attribution if changed
      if (costValidation?.hasChanges) {
        await costCardRef.current.saveCost();
      }

      // 4. Upload Proof & Resolve Request
      const reqId = request?.request_id || request?.id || request?._id;
      const uploadRes = await maintenanceApi.uploadAdminMaintenanceAttachment(
        reqId,
        proofFile,
        { visibility: "tenant_admin" },
      );

      const rawAttachment =
        uploadRes?.data?.attachment || uploadRes?.attachment || uploadRes?.data || uploadRes;
      const fileUrl =
        rawAttachment?.url || rawAttachment?.downloadUrl || rawAttachment?.uri || rawAttachment?.src;

      const attachment = {
        id: rawAttachment?.id || rawAttachment?.storagePath || fileUrl,
        name: rawAttachment?.name || rawAttachment?.originalName || proofFile.name,
        uri: fileUrl,
        url: fileUrl,
        downloadUrl: fileUrl,
        type: rawAttachment?.type || rawAttachment?.mimeType || proofFile.type || "image/png",
        mimeType: rawAttachment?.mimeType || rawAttachment?.type || proofFile.type || "image/png",
        size: rawAttachment?.size || proofFile.size,
        visibility: "tenant_admin",
        storagePath: rawAttachment?.storagePath || null,
        provider: rawAttachment?.provider || null,
      };

      const result = await saveProofMutation.mutateAsync({
        requestId: reqId,
        payload: {
          note: proofNote.trim() || "Resolution proof verified and uploaded.",
          attachments: [attachment],
          status: "resolved",
        },
      });

      const updatedRequest =
        result?.request || result?.data?.request || (result?.status ? result : null);

      // 1. Immediately advance to the next stage (Stage 4: Resolved) FIRST!
      if (updatedRequest) {
        setLocalRequestOverride(updatedRequest);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          status: "resolved",
          work_log: [
            ...((prev || request)?.work_log || []),
            {
              note: proofNote.trim() || "Resolution proof verified and uploaded.",
              attachments: [attachment],
              logged_at: new Date().toISOString(),
            },
          ],
        }));
      }

      showNotification({
        title: "Work Marked as Done",
        message: "Resolution proof and repair details saved. The tenant has been notified to inspect and confirm.",
        type: "success",
      });

      // 2. NOW safely reset local form data
      handleClearProofFile();
      setProofNote("");
      setProofTouched(false);
    } catch (err) {
      showNotification({
        title: "Resolution Failed",
        message: err?.message || "Failed to complete repair and save proof.",
        type: "error",
      });
    } finally {
      setIsSubmittingUnified(false);
    }
  };

  // Reset tab and state on open
  useEffect(() => {
    if (open) {
      setActiveTab("overview");
      setLightboxImage(null);
      setLightboxZoom(1);
      handleClearProofFile();
      setProofTouched(false);
      setIsDraggingProof(false);
      setCopiedPhone(false);
      setShowScheduler(false);
      setShowProviderAssigner(false);
      setShowAlternatePanel(false);
      setShowReopenDialog(false);
      setShowForceFinalizeModal(false);
      setScheduleDate("");
      setScheduleTime("");
      setScheduleNote("");
      setAlternateDate("");
      setAlternateTime("");
      setAlternateNote("");
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

  if (!open || !request) return null;

  const rawRequestId = request?.request_id || request?.id || request?._id || "";
  const shortId = rawRequestId ? rawRequestId.slice(-8).toUpperCase() : "—";
  const branchKey = getRequestBranch(request) || request?.branch;
  const branchDisplayName =
    BRANCH_DISPLAY_NAMES[branchKey] || formatBranchLabel(branchKey) || "All Branches";
  const statusMeta = formatMaintenanceStatus(request?.status);
  const urgencyMeta = getMaintenanceUrgencyMeta(request?.urgency);
  const typeMeta = getMaintenanceTypeMeta(request?.request_type);

  const tenantName =
    request?.tenant?.full_name ||
    request?.tenant?.fullName ||
    request?.tenantName ||
    request?.user?.fullName ||
    (request?.tenant?.firstName
      ? `${request.tenant.firstName} ${request.tenant.lastName || ""}`.trim()
      : "") ||
    "Tenant";

  const rawRoomCandidate =
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
          "";

  const roomName = formatCleanRoomName(rawRoomCandidate) || rawRoomCandidate || "Unit Unassigned";

  const bedSlot =
    request?.occupancyContext?.bedNumber
      ? `Bed ${request.occupancyContext.bedNumber}`
      : request?.occupancy_context?.bedNumber
        ? `Bed ${request.occupancy_context.bedNumber}`
        : request?.bedIdentifier ||
          request?.bed?.bedNumber ||
          request?.bedNumber ||
          null;

  const fullLocationLabel = `${branchDisplayName} • ${roomName}${bedSlot ? ` (${bedSlot})` : ""}`;
  const allowedStatuses = getAllowedAdminMaintenanceStatuses(request?.status);
  const isLocked = LOCKED_ADMIN_MAINTENANCE_STATUSES.includes(request?.status || "");
  const isTerminal = ["completed", "closed", "rejected", "cancelled"].includes(request?.status || "");
  const isReopened = request?.isReopened === true;
  const currentStepIndex = getMaintenanceStepIndex(request?.status);
  const nextAction = getNextRecommendedStageAction(request);

  const status = String(request?.status || "").toLowerCase();
  const isIntakeStage = ["pending", "pending_review", "submitted"].includes(status);
  const isAssignAndScheduleStage = ["viewed", "reviewed", "under_review"].includes(status);
  const isExecutionStage = ["provider_assigned", "scheduled", "in_progress", "waiting_tenant"].includes(status);
  const isResolvedStage = status === "resolved";
  const isCompletedStage = ["completed", "closed"].includes(status);

  const isAwaitingVisitPhase =
    !forceShowActiveWork &&
    (status === "scheduled" || status === "provider_assigned") &&
    !isReopened;

  const isActiveWorkPhase =
    forceShowActiveWork ||
    status === "in_progress" ||
    status === "waiting_tenant" ||
    isReopened;

  // Attachment Collections
  const initialAttachments = Array.isArray(request?.attachments)
    ? request.attachments.filter((att) => !att?.isRemoved)
    : [];

  const rawWorkLog = request?.workLog || request?.work_log || [];
  const workLogAttachments = Array.isArray(rawWorkLog)
    ? rawWorkLog.flatMap((log) =>
        Array.isArray(log?.attachments) ? log.attachments.filter((att) => !att?.isRemoved) : [],
      )
    : [];

  const assignedProviderName =
    request?.assignedProviderName ||
    request?.assigned_to ||
    request?.assignedProvider?.providerName ||
    null;

  const assignedProviderContact =
    request?.assignedProviderContact ||
    request?.assignedProvider?.contactNumber ||
    request?.providerDetails?.privateContact ||
    null;

  const assignedProviderType =
    request?.providerDetails?.providerType ||
    (request?.assignedProviderId ? "EXTERNAL" : request?.assigned_to ? "IN_HOUSE" : null);

  const assignedProviderCategory =
    request?.assignedProviderCategory ||
    request?.assignedProvider?.serviceType ||
    request?.providerDetails?.category ||
    null;

  const assignedQuotedCost = Number(
    request?.providerDetails?.quotedCost || request?.estimatedCost || 0,
  );

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
        return "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60";
      case "scheduled":
        return "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700/60";
      case "provider_assigned":
        return "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700/60";
      case "reviewed":
        return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300";
      case "resolved":
        return "bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-700/60";
      case "reopened":
        return "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/60";
      default:
        return "bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= HEADER ================= */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            {/* Title, Ticket ID & Urgency */}
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                <span>Maintenance Ticket</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  title="Click to copy full ID"
                  className="inline-flex items-center gap-1 rounded-md bg-transparent border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <Copy size={11} className={isCopiedId ? "text-emerald-600" : "text-slate-400"} />
                  <span>#{request.ticketNumber || shortId}</span>
                </button>
              </h2>

              {/* Category Concern Badge in Header */}
              {typeMeta && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 bg-transparent text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  {(() => {
                    const CategoryIcon = typeMeta.icon || Wrench;
                    return <CategoryIcon size={12} className="text-slate-600 dark:text-slate-400" />;
                  })()}
                  <span>{typeMeta.label}</span>
                </span>
              )}

              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 bg-transparent border border-slate-200 dark:border-slate-700"
                style={{
                  color: urgencyMeta.color,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: urgencyMeta.color }} />
                <span>{urgencyMeta.label} Priority</span>
              </span>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${getStatusBadgeMeta(request?.status).badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${getStatusBadgeMeta(request?.status).dot}`} />
                <span>{formatMaintenanceStatus(request?.status, { includeStage: true })}</span>
              </span>

              {status === "resolved" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-transparent text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>Awaiting Verification</span>
                </span>
              )}

              {isReopened && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-transparent text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>Reopened (Iteration #{request?.reopenCount || 2})</span>
                </span>
              )}
            </div>

            {/* Right: Tenant, Room Info & Close */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                  <User size={13} className="text-slate-400" />
                  <span>{tenantName}</span>
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <MapPin size={13} className="text-slate-400" />
                  <span>{fullLocationLabel}</span>
                </span>
              </div>

              {/* Close Modal Button */}
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Clean Top Navigation Tabs */}
          <div className="flex items-center gap-2 mt-3.5 border-t border-slate-200/80 dark:border-slate-800/80 pt-2.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => handleTabChange("overview")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer shrink-0 ${
                activeTab === "overview"
                  ? "bg-[#0A1628] text-white dark:bg-slate-100 dark:text-slate-900 border-[#0A1628] dark:border-slate-100 shadow-2xs font-bold"
                  : "border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              }`}
            >
              <ClipboardCheck size={14} />
              <span>Overview &amp; Action Hub</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("conversation")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer shrink-0 ${
                activeTab === "conversation"
                  ? "bg-[#0A1628] text-white dark:bg-slate-100 dark:text-slate-900 border-[#0A1628] dark:border-slate-100 shadow-2xs font-bold"
                  : "border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              }`}
            >
              <MessageSquare size={14} />
              <span>Conversation Thread</span>
              {getUnreadConvCount(request, activeTab === "conversation") > 0 && activeTab !== "conversation" && !viewedTabs.has("conversation") && (
                <span className="rounded-full px-1.5 py-0.2 text-[10px] font-bold bg-transparent text-sky-700 dark:text-sky-400 border border-slate-200 dark:border-slate-700">
                  {getUnreadConvCount(request, activeTab === "conversation")}
                </span>
              )}
            </button>


            <button
              type="button"
              onClick={() => handleTabChange("timeline")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer shrink-0 ${
                activeTab === "timeline"
                  ? "bg-[#0A1628] text-white dark:bg-slate-100 dark:text-slate-900 border-[#0A1628] dark:border-slate-100 shadow-2xs font-bold"
                  : "border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              }`}
            >
              <History size={14} />
              <span>Audit &amp; Timeline</span>
              {timelineItems.length > 0 && activeTab !== "timeline" && !viewedTabs.has("timeline") && (
                <span className="rounded-full px-1.5 py-0.2 text-[10px] font-bold bg-transparent text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {timelineItems.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ================= BODY ================= */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3 text-xs text-slate-900 dark:text-slate-100">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100">Potential Duplicate Tickets Detected</span>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-400 leading-relaxed">
                      {duplicateData.count} other ticket(s) logged for this unit/room within 48 hours. Please check existing work orders before dispatching new contractors.
                    </p>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════ */}
              {/* TAB 1: OVERVIEW & ACTION HUB                */}
              {/* ═══════════════════════════════════════════ */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  {/* 1. TENANT CONCERN & CONTEXT CARD (EMPHASIZED CATEGORY OF CONCERN) */}
                  <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-4">
                    {/* Emphasized Category Header Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs">
                          {(() => {
                            const CategoryIcon = typeMeta.icon || Wrench;
                            return <CategoryIcon size={20} className="text-slate-700 dark:text-slate-300" />;
                          })()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Tenant Category Concern
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.2 rounded text-[11px] font-bold bg-transparent text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                              <span>{typeMeta.label}</span>
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                            {typeMeta.label} Request
                          </h3>
                        </div>
                      </div>

                      {/* Reporter Context & Timestamp */}
                      <div className="flex flex-wrap items-center gap-2 sm:text-right text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex flex-col sm:items-end">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1">
                            <User size={13} className="text-slate-400" />
                            {tenantName}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 inline-flex items-center gap-1">
                            <Clock size={11} className="text-slate-400" />
                            Submitted {fmtDateTime(request.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Category Key Metadata Context Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                          Category of Concern
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                          {(() => {
                            const CategoryIcon = typeMeta.icon || Wrench;
                            return <CategoryIcon size={14} className="text-slate-600 dark:text-slate-400 shrink-0" />;
                          })()}
                          <span className="truncate">{typeMeta.label}</span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                          Priority &amp; Target ETA
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: urgencyMeta.color }} />
                          <span>{urgencyMeta.label} Priority</span>
                          <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                            • {urgencyMeta.estimate || "1-2 days"}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                          Assigned Location
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                          <MapPin size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
                          <span className="truncate">{fullLocationLabel}</span>
                        </div>
                      </div>
                    </div>

                    {/* Reported Problem Text */}
                    <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 block">
                        Problem Description
                      </span>
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
                        {request.description || "No specific problem details provided by tenant."}
                      </p>
                      {request.notes && (
                        <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Staff Notes: </span>
                          {request.notes}
                        </div>
                      )}
                    </div>

                    {/* Tenant Attached Media Strip */}
                    {initialAttachments.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 block">
                          Tenant Attached Photos &amp; Documents ({initialAttachments.length})
                        </span>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {initialAttachments.map((att, idx) => (
                            <AttachmentThumbnail
                              key={idx}
                              attachment={att}
                              index={idx}
                              onPreviewImage={setLightboxImage}
                              tag="Tenant Upload"
                              size="normal"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. DYNAMIC STAGE ACTION HUB */}
                  <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ClipboardCheck size={16} className="text-slate-700 dark:text-slate-300" />
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                          Guided Stage Action Hub
                        </h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                          • {status === "completed" || status === "closed"
                              ? "All 5 Stages Completed • Ticket Closed"
                              : status === "resolved"
                                ? "Step 4 of 5: Resolved (Awaiting Tenant Feedback & Verification)"
                                : currentStepIndex >= 0
                                  ? `Step ${currentStepIndex + 1} of ${CANONICAL_MAINTENANCE_STEPS.length}: ${statusMeta}`
                                  : statusMeta}
                        </span>
                      </div>
                    </div>

                    {/* 5-Step Horizontal Stepper (Always Visible Across All Lifecycle Stages) */}
                    <div className="px-2 pt-1 pb-1">
                      <div className="flex items-start justify-between relative">
                        {CANONICAL_MAINTENANCE_STEPS.map((step, idx) => {
                          const isDone =
                            status === "completed" || status === "closed"
                              ? true
                              : idx < currentStepIndex;
                          const isActive =
                            status !== "completed" && status !== "closed" && idx === currentStepIndex;
                          return (
                            <div key={step.key} className="flex-1 flex flex-col items-center relative text-center group">
                              {idx < CANONICAL_MAINTENANCE_STEPS.length - 1 && (
                                <div
                                  className={`absolute top-3.5 z-0 transition-colors ${
                                    idx < currentStepIndex || status === "completed" || status === "closed"
                                      ? "bg-emerald-500"
                                      : "bg-slate-200 dark:bg-slate-700"
                                  }`}
                                  style={{
                                    left: "50%",
                                    right: "-50%",
                                    height: "2px",
                                  }}
                                />
                              )}
                              <div
                                className={`relative z-10 flex items-center justify-center rounded-full transition-all duration-200 ${
                                  isDone
                                    ? "h-7 w-7 bg-emerald-600 text-white shadow-xs border border-emerald-600"
                                    : isActive
                                      ? "h-7 w-7 bg-blue-600 text-white font-bold text-xs border border-blue-600 shadow-sm"
                                      : "h-7 w-7 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-semibold text-xs border border-slate-200 dark:border-slate-700"
                                }`}
                              >
                                {isDone ? <Check size={13} strokeWidth={3} /> : <span>{idx + 1}</span>}
                              </div>
                              <span
                                className={`mt-1.5 text-xs max-w-[84px] leading-tight transition-colors ${
                                  isActive
                                    ? "font-bold text-blue-600 dark:text-blue-400"
                                    : isDone
                                      ? "font-semibold text-slate-700 dark:text-slate-300"
                                      : "font-medium text-slate-400 dark:text-slate-500"
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Reopened High-Priority Alert Banner */}
                    {isReopened && (
                      <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3 text-xs">
                        <RefreshCw size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 animate-spin-slow" />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            Reopened by Tenant — Iteration #{request?.reopenCount || 1}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {request?.reopen_history?.[request.reopen_history.length - 1]?.note ||
                              request?.reopen_note ||
                              "Tenant reported the issue persists. Please reassess, reassign or reschedule the repair."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Stage 4 Resolved Alert Banner (Awaiting Tenant Feedback & 7-Day Auto-Completion Notice) */}
                    {isResolvedStage && (
                      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs">
                        <div className="flex items-start gap-2.5">
                          <Clock size={16} className="text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                Stage 4: Work Resolved • Awaiting Tenant Verification &amp; Feedback
                              </span>
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                7-Day Auto-Completion Policy
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                              Repair details and completion proof have been saved. The tenant has been notified on mobile to inspect the repair and submit feedback. If no issues or objections are reported within <strong>7 days (1 week)</strong>, this ticket will automatically close as Completed.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stage 5: Terminal Cancelled / Rejected Banner (Completed tickets render the Unified Executive Voucher below) */}
                    {isTerminal && !isCompletedStage && (
                      <div className="flex flex-col gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs">
                        <div className="flex items-start gap-2.5">
                          {request?.status === "completed" || request?.status === "closed" ? (
                            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          ) : request?.status === "rejected" ? (
                            <XCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle size={16} className="text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {request?.status === "completed"
                                  ? "Stage 5: Ticket Completed & Confirmed Fixed"
                                  : request?.status === "rejected"
                                    ? "Ticket Rejected"
                                    : request?.status === "cancelled"
                                      ? "Ticket Cancelled"
                                      : "Stage 5: Ticket Closed & Archived"}
                              </span>
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {request?.status === "cancelled" ? "Cancelled" : request?.status === "rejected" ? "Rejected" : "Officially Closed"}
                              </span>
                            </div>
                            {request?.status === "cancelled" ? (
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                This maintenance request was cancelled. The ticket is closed and preserved in audit history.
                              </p>
                            ) : request?.status === "rejected" ? (
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                This request was reviewed and rejected. No further work orders will be scheduled.
                              </p>
                            ) : request?.resolutionConfirmation?.confirmedAt ? (
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                Tenant confirmed resolution on {fmtDateTime(request.resolutionConfirmation.confirmedAt)}
                                {request.resolutionConfirmation.tenantFeedback
                                  ? ` • "${request.resolutionConfirmation.tenantFeedback}"`
                                  : ""}
                              </p>
                            ) : (
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                Officially completed and finalized. All service records, contractor ratings, and cost attributions are permanently logged.
                              </p>
                            )}
                          </div>
                        </div>
                        {onGenerateReport && (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => onGenerateReport("admin")}
                              title="Generate or view official maintenance completion report"
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98] transition cursor-pointer shadow-sm"
                            >
                              <Sparkles size={13} />
                              <span>
                                {request?.completionReport
                                  ? "View / Edit Completion Report"
                                  : "Generate AI Completion Report"}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3. STAGE-SPECIFIC OPERATIONAL CARDS (Progressive Disclosure - 5 Unified Stages) */}

                  {/* STAGE 2: UNDER REVIEW (Unified Provider Assignment & Visit Scheduling) */}
                  {isAssignAndScheduleStage && (
                    <div className="space-y-4">
                      {/* Unified Single Card for Assignment & Scheduling */}
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
                        {/* Unified Card Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <UserCheck size={16} className="text-slate-700 dark:text-slate-300" />
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                              Assign Service Provider &amp; Schedule Repair Visit
                            </h3>
                          </div>
                          <span className="rounded bg-transparent px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700">
                            Stage 2: Under Review
                          </span>
                        </div>

                        {/* Part 1: Contractor & AI Assignment (Embedded) */}
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
                          onAssign={handleConfirmProviderAndSchedule}
                          onSuggest={onSuggestProvider}
                          onUseSuggestion={onUseProviderSuggestion}
                          embedded={true}
                          hideActions={true}
                        />

                        {/* Part 2: Repair Visit Scheduling */}
                        <div className="border-t border-slate-200/80 dark:border-slate-800/80 pt-3.5 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0A1628] text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-bold shadow-2xs">
                                2
                              </span>
                              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                                Set Repair Visit Schedule
                              </h4>
                            </div>
                            <span className="rounded bg-transparent px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Required *
                            </span>
                          </div>

                          {/* Modern Friendly Date & Time Picker */}
                          <ModernDateTimePicker
                            dateValue={scheduleDate}
                            timeValue={scheduleTime}
                            onDateChange={setScheduleDate}
                            onTimeChange={setScheduleTime}
                            disabled={isLocked || isSubmittingSchedule || isAssigningProvider}
                          />

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                                Room Access Notes / Tenant Instructions <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
                              </label>
                              <span className="text-[10px] text-slate-400">
                                {scheduleNote.length}/300
                              </span>
                            </div>
                            <input
                              type="text"
                              maxLength={300}
                              value={scheduleNote}
                              onChange={(e) => setScheduleNote(e.target.value)}
                              placeholder="e.g., Knock twice, tenant in room, pass key at reception"
                              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-slate-900 dark:focus:border-slate-100 focus:ring-1 focus:ring-slate-900/10 focus:outline-none transition"
                            />
                          </div>
                        </div>

                        {/* Part 3: Single Unified Confirmation Action Bar */}
                        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs text-slate-600 dark:text-slate-400 min-w-0">
                            {scheduleDate && scheduleTime ? (
                              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                <CheckCircle2 size={13} className="shrink-0" />
                                <span className="truncate">
                                  Ready: Visit set for <strong>{scheduleDate}</strong> at <strong>{scheduleTime}</strong> (Transitions to <strong>In Progress</strong>).
                                </span>
                              </div>
                            ) : (
                              <span>
                                Select contractor and set visit date &amp; time window to confirm dispatch.
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleConfirmProviderAndSchedule}
                            disabled={!scheduleDate || !scheduleTime || isAssigningProvider || isSubmittingSchedule}
                            title={
                              !scheduleDate || !scheduleTime
                                ? "Select visit date and time before confirming"
                                : "Confirm service provider assignment and visit schedule"
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-5 py-2.5 text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shrink-0 active:scale-[0.98]"
                          >
                            {isAssigningProvider || isSubmittingSchedule ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            <span>
                              {isAssigningProvider || isSubmittingSchedule
                                ? "Confirming..."
                                : "Confirm Assignment & Schedule"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STAGE 3: PROGRESSIVE 2-PHASE HUB (Phase 3A: Awaiting Visit vs Phase 3B: Active Work) */}
                  {(isExecutionStage || isReopened) && (
                    <div id="maintenance-stage3-actions" className="space-y-4">
                      {/* ─────────────────────────────────────────────────────────────
                          PHASE 3A: SCHEDULED & AWAITING VISIT (Triage & Reschedule Hub)
                          ───────────────────────────────────────────────────────────── */}
                      {isAwaitingVisitPhase && (
                        <div className="space-y-4">
                          {/* Confirmed Visit & Schedule Management Card */}
                          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
                            {/* Phase 3A Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                              <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-sky-600 dark:text-sky-400" />
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                                  Scheduled &amp; Awaiting Repair Visit
                                </h3>
                              </div>
                              <span className="rounded bg-transparent px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-400 border border-slate-200 dark:border-slate-700">
                                Stage 3: Awaiting Visit
                              </span>
                            </div>

                            {/* Grid: Technician Summary (Left) & Scheduled Arrival Details (Right) */}
                            <div className="grid gap-3 sm:grid-cols-2">
                              {/* Left: Assigned Provider Box */}
                              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3.5 space-y-2.5">
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                                  Assigned Service Provider
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                    {assignedProviderName || "LilyCrest Facilities Team"}
                                  </span>
                                  {assignedProviderCategory && (
                                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                      {assignedProviderCategory}
                                    </span>
                                  )}
                                </div>

                                {assignedProviderContact && (
                                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-700/80 text-xs">
                                    <a
                                      href={`tel:${assignedProviderContact}`}
                                      className="text-slate-700 dark:text-slate-300 font-semibold hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-1.5"
                                    >
                                      <PhoneCall size={12} className="text-slate-500" />
                                      <span>{assignedProviderContact}</span>
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyPhone(assignedProviderContact)}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                                    >
                                      {copiedPhone ? (
                                        <Check size={12} className="text-emerald-600" />
                                      ) : (
                                        <Copy size={12} />
                                      )}
                                      <span>{copiedPhone ? "Copied" : "Copy"}</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Right: Confirmed Schedule Box with Relative Arrival Badge */}
                              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                                    Confirmed Arrival
                                  </span>
                                  {currentScheduledDate && (
                                    <span className="text-[10px] font-bold text-sky-700 dark:text-sky-400">
                                      {(() => {
                                        const d = new Date(currentScheduledDate);
                                        if (Number.isNaN(d.getTime())) return null;
                                        const diffHours = Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60));
                                        if (diffHours < 0) return "Visit slot has arrived";
                                        if (diffHours === 0) return "Arriving in less than 1 hr";
                                        if (diffHours < 24) return `In ~${diffHours} hours`;
                                        const diffDays = Math.round(diffHours / 24);
                                        return `In ${diffDays} day${diffDays > 1 ? "s" : ""}`;
                                      })()}
                                    </span>
                                  )}
                                </div>

                                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                  <Clock size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                                  <span>{currentScheduledDate ? fmtDateTime(currentScheduledDate) : "No date set"}</span>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-700/80 text-xs">
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                                    {request?.schedule?.notes || "Standard room access"}
                                  </span>
                                  {rescheduleRequestData?.status !== "pending" && (
                                    <button
                                      type="button"
                                      onClick={() => setShowScheduler((v) => !v)}
                                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 active:scale-[0.98] transition cursor-pointer shadow-2xs"
                                    >
                                      {showScheduler ? "Hide Calendar" : "Reschedule / Update"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Tenant Reschedule Request Alert Banner (High Priority) */}
                            {rescheduleRequestData?.status === "pending" && (
                              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/60 p-4 space-y-3.5 text-xs shadow-2xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                                    <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span className="text-xs">Tenant Requested Schedule Adjustment</span>
                                  </div>
                                  {currentScheduledDate && rescheduleRequestData?.proposedDate && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 bg-transparent">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                      <span>
                                        {(() => {
                                          const d1 = new Date(currentScheduledDate).getTime();
                                          const d2 = new Date(rescheduleRequestData.proposedDate).getTime();
                                          if (Number.isNaN(d1) || Number.isNaN(d2)) return null;
                                          const diffHours = Math.round((d2 - d1) / (1000 * 60 * 60));
                                          if (diffHours === 0) return "Same Day / Time Shift";
                                          if (Math.abs(diffHours) < 24) {
                                            return diffHours > 0 ? `+${diffHours}h Later` : `${diffHours}h Earlier`;
                                          }
                                          const diffDays = Math.round(diffHours / 24);
                                          return diffDays > 0 ? `+${diffDays} Day${diffDays > 1 ? "s" : ""} Later` : `${diffDays} Day${Math.abs(diffDays) > 1 ? "s" : ""} Earlier`;
                                        })()}
                                      </span>
                                    </span>
                                  )}
                                </div>

                                {/* Side-by-Side Comparison Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {/* Left: Currently Scheduled */}
                                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-1.5 shadow-2xs">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                      Current Scheduled Arrival
                                    </span>
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                      {currentScheduledDate ? fmtDateTime(currentScheduledDate) : "Not yet set"}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                      Provider: {assignedProviderName || "LilyCrest Facilities Team"}
                                    </div>
                                  </div>

                                  {/* Right: Tenant Requested */}
                                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-1.5 shadow-2xs">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                      Tenant Requested Slot
                                    </span>
                                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                      {fmtDateTime(rescheduleRequestData.proposedDate)}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                      {rescheduleRequestData.reason ? (
                                        <span className="italic text-slate-600 dark:text-slate-300">
                                          &ldquo;{rescheduleRequestData.reason}&rdquo;
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">No specific reason provided</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Quick Action Button Grid (3 Balanced Columns) */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                                  {/* Accept New Date CTA */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAcceptReschedule(
                                        rescheduleRequestData.proposedDate,
                                      )
                                    }
                                    disabled={isRespondingToReschedule || isSubmittingAlternate || isSubmittingDecline}
                                    title="Accept tenant's requested date & time adjustment"
                                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98] transition shadow-2xs cursor-pointer disabled:opacity-50"
                                  >
                                    {isRespondingToReschedule ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Check size={13} />
                                    )}
                                    <span>
                                      {isRespondingToReschedule
                                        ? "Accepting..."
                                        : "Accept New Date"}
                                    </span>
                                  </button>

                                  {/* Propose Alternate Date */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAlternatePanel((v) => !v);
                                      setShowDeclinePanel(false);
                                    }}
                                    title="Pick an alternate date/time and send explanation note to tenant"
                                    className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer active:scale-[0.98] ${
                                      showAlternatePanel
                                        ? "border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-slate-600"
                                        : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
                                    }`}
                                  >
                                    <Calendar size={13} />
                                    <span>Propose Alternate</span>
                                    {showAlternatePanel ? <ChevronUp size={12} className="opacity-70" /> : <ChevronDown size={12} className="opacity-70" />}
                                  </button>

                                  {/* Decline Request */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowDeclinePanel((v) => !v);
                                      setShowAlternatePanel(false);
                                    }}
                                    title="Decline this reschedule request and keep the current schedule"
                                    className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer active:scale-[0.98] ${
                                      showDeclinePanel
                                        ? "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-300 dark:ring-rose-800"
                                        : "border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-200 dark:hover:border-rose-900"
                                    }`}
                                  >
                                    <X size={13} />
                                    <span>Decline Request</span>
                                    {showDeclinePanel ? <ChevronUp size={12} className="opacity-70" /> : <ChevronDown size={12} className="opacity-70" />}
                                  </button>
                                </div>

                                {/* Expandable Decline Request Panel */}
                                {showDeclinePanel && (
                                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3 mt-1 transition-all">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                        Decline Tenant Reschedule Request
                                      </span>
                                      <span className="text-[10px] text-slate-500">Current schedule will remain active</span>
                                    </div>

                                    <div>
                                      <div className="flex justify-between items-center mb-1">
                                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                          Reason for Declining * (Min 5 chars)
                                        </label>
                                        <span className="text-[10px] text-slate-400">{declineReason.length}/300</span>
                                      </div>
                                      <textarea
                                        rows={2}
                                        maxLength={300}
                                        placeholder="e.g. Technician already dispatched and en route; cannot postpone."
                                        value={declineReason}
                                        onChange={(e) => setDeclineReason(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 resize-none transition"
                                      />
                                      {declineReason.length > 0 && declineReason.trim().length < 5 && (
                                        <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 font-medium">
                                          <AlertCircle size={12} />
                                          Please enter at least 5 characters ({5 - declineReason.trim().length} more needed).
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowDeclinePanel(false);
                                          setDeclineReason("");
                                        }}
                                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleDeclineReschedule}
                                        disabled={!declineReason || declineReason.trim().length < 5 || isSubmittingDecline}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                                      >
                                        {isSubmittingDecline ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                                        <span>{isSubmittingDecline ? "Declining..." : "Confirm Decline"}</span>
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Expandable Alternate Date & Explanation Note Panel */}
                                {showAlternatePanel && (
                                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3 mt-1 transition-all">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                        Propose Alternate Visit Date &amp; Reason
                                      </span>
                                      <span className="text-[10px] text-slate-500">Operating hours: 8 AM – 6 PM</span>
                                    </div>

                                    <ModernDateTimePicker
                                      dateValue={alternateDate}
                                      timeValue={alternateTime}
                                      onDateChange={setAlternateDate}
                                      onTimeChange={setAlternateTime}
                                      disabled={isSubmittingAlternate}
                                    />

                                    <div>
                                      <div className="flex justify-between items-center mb-1">
                                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                          Staff Explanation Note to Tenant * (Min 5 chars)
                                        </label>
                                        <span className="text-[10px] text-slate-400">{alternateNote.length}/300</span>
                                      </div>
                                      <textarea
                                        rows={2}
                                        maxLength={300}
                                        placeholder="e.g. Technician fully booked in the morning; available at 2:00 PM."
                                        value={alternateNote}
                                        onChange={(e) => setAlternateNote(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none transition"
                                      />
                                      {alternateNote.length > 0 && alternateNote.trim().length < 5 && (
                                        <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1 font-medium">
                                          <AlertCircle size={12} />
                                          Please enter at least 5 characters ({5 - alternateNote.trim().length} more needed).
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                      <button
                                        type="button"
                                        onClick={() => setShowAlternatePanel(false)}
                                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleSetAlternateSchedule}
                                        disabled={!alternateDate || !alternateTime || alternateNote.trim().length < 5 || isSubmittingAlternate}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                                      >
                                        {isSubmittingAlternate ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                        <span>{isSubmittingAlternate ? "Updating..." : "Submit Alternate Schedule"}</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Interactive Rescheduler if opened */}
                            {showScheduler && (
                              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3.5 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 block">
                                    Update Repair Visit Date &amp; Time
                                  </span>
                                  <span className="text-[10px] text-slate-500">Operating hours: 8 AM – 6 PM</span>
                                </div>

                                <ModernDateTimePicker
                                  dateValue={scheduleDate}
                                  timeValue={scheduleTime}
                                  onDateChange={setScheduleDate}
                                  onTimeChange={setScheduleTime}
                                  disabled={isSubmittingSchedule}
                                />

                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex-wrap">
                                  <div className="text-[11px] text-slate-500">
                                    {scheduleDate && scheduleTime ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                        <Check size={12} />
                                        <span>Selected: {scheduleDate} at {scheduleTime}</span>
                                      </span>
                                    ) : (
                                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                                        Please pick both visit date and arrival time.
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-2 items-center flex-wrap">
                                    {currentScheduledDate && (
                                      <button
                                        type="button"
                                        onClick={handleClearSchedule}
                                        disabled={isSubmittingSchedule}
                                        title="Reject and remove the planned schedule date without cancelling the maintenance request"
                                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg active:scale-[0.98] cursor-pointer transition border border-rose-200 dark:border-rose-900/40"
                                      >
                                        Reject Planned Schedule
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setShowScheduler(false)}
                                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg active:scale-[0.98] cursor-pointer"
                                    >
                                      Close
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleScheduleVisit}
                                      disabled={
                                        !scheduleDate ||
                                        !scheduleTime ||
                                        isSubmittingSchedule
                                      }
                                      title={
                                        !scheduleDate || !scheduleTime
                                          ? "Select date and time first"
                                          : "Save updated visit schedule"
                                      }
                                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer shadow-xs transition"
                                    >
                                      {isSubmittingSchedule ? (
                                        <Loader2 size={13} className="animate-spin" />
                                      ) : (
                                        <Check size={13} />
                                      )}
                                      <span>
                                        {isSubmittingSchedule
                                          ? "Saving..."
                                          : "Save Schedule"}
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Phase 3A Primary Action Footer Bar */}
                          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                            {rescheduleRequestData?.status === "pending" && (
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5 flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                                <span>
                                  <strong>Pending Reschedule Request:</strong> Please accept, propose an alternate date, or decline the tenant's reschedule request above before starting repair work.
                                </span>
                              </div>
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="text-xs text-slate-600 dark:text-slate-400 min-w-0">
                                {rescheduleRequestData?.status === "pending" ? (
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Start action locked until the pending reschedule request is resolved above.
                                  </span>
                                ) : isStartingWork ? (
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Loader2 size={13} className="animate-spin text-sky-600" />
                                    Starting repair work and dispatching active status...
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                                    <Sparkles size={13} className="text-sky-600 shrink-0" />
                                    <span>
                                      Technician on site? Click <strong>Start Repair Work</strong> to unlock resolution proof &amp; expense accounting.
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setForceShowActiveWork(true)}
                                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline font-medium px-2 py-1 cursor-pointer"
                                >
                                  Jump to Proof Form
                                </button>
                                <button
                                  type="button"
                                  onClick={handleStartRepairWork}
                                  disabled={isLocked || isStartingWork || rescheduleRequestData?.status === "pending"}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white px-5 py-2.5 text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer active:scale-[0.98]"
                                >
                                  {isStartingWork ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                                  <span>{isStartingWork ? "Starting Work..." : "Start Repair Work"}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ─────────────────────────────────────────────────────────────
                          PHASE 3B: ACTIVE WORK & RESOLUTION (Technician On-Site, Proof, Expenses)
                          ───────────────────────────────────────────────────────────── */}
                      {isActiveWorkPhase && (
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2 items-stretch">
                            {/* Left Column: Active Technician & Work Order Info */}
                            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between space-y-4">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                    <PlayCircle size={16} className="text-emerald-600 dark:text-emerald-500" />
                                    <span>Active Work In Progress</span>
                                  </h3>
                                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-transparent text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700">
                                    Active on site
                                  </span>
                                </div>

                                {/* Assigned Technician Profile Box */}
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3.5 space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                                        Assigned Service Provider
                                      </span>
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                          {assignedProviderName || "LilyCrest Facilities Team"}
                                        </span>
                                        {assignedProviderCategory && (
                                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                            {assignedProviderCategory}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {assignedProviderContact && (
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-700/80 text-xs">
                                      <a
                                        href={`tel:${assignedProviderContact}`}
                                        className="text-slate-700 dark:text-slate-300 font-semibold hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-1.5"
                                      >
                                        <PhoneCall size={12} className="text-slate-500" />
                                        <span>{assignedProviderContact}</span>
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyPhone(assignedProviderContact)}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                                      >
                                        {copiedPhone ? (
                                          <Check size={12} className="text-emerald-600" />
                                        ) : (
                                          <Copy size={12} />
                                        )}
                                        <span>{copiedPhone ? "Copied" : "Copy"}</span>
                                      </button>
                                    </div>
                                  )}

                                  {/* Scheduled Arrival Row */}
                                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs">
                                    <div>
                                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                                        Scheduled Arrival
                                      </span>
                                      {currentScheduledDate ? (
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                          {fmtDateTime(currentScheduledDate)}
                                        </span>
                                      ) : (
                                        <span className="text-slate-500 dark:text-slate-400 italic">
                                          No visit date scheduled yet
                                        </span>
                                      )}
                                    </div>
                                    {rescheduleRequestData?.status === "pending" && (
                                      <span
                                        title="A tenant schedule adjustment request is pending review below."
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 bg-transparent"
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                        <span>Adjustment Pending</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Tenant Reschedule Request Alert Banner with Side-by-Side Comparison */}
                                {rescheduleRequestData?.status === "pending" && (
                                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/60 p-4 space-y-3.5 text-xs shadow-2xs">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                                        <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span className="text-xs">Tenant Requested Schedule Adjustment</span>
                                      </div>
                                      {currentScheduledDate && rescheduleRequestData?.proposedDate && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 bg-transparent">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                          <span>
                                            {(() => {
                                              const d1 = new Date(currentScheduledDate).getTime();
                                              const d2 = new Date(rescheduleRequestData.proposedDate).getTime();
                                              if (Number.isNaN(d1) || Number.isNaN(d2)) return null;
                                              const diffHours = Math.round((d2 - d1) / (1000 * 60 * 60));
                                              if (diffHours === 0) return "Same Day / Time Shift";
                                              if (Math.abs(diffHours) < 24) {
                                                return diffHours > 0 ? `+${diffHours}h Later` : `${diffHours}h Earlier`;
                                              }
                                              const diffDays = Math.round(diffHours / 24);
                                              return diffDays > 0 ? `+${diffDays} Day${diffDays > 1 ? "s" : ""} Later` : `${diffDays} Day${Math.abs(diffDays) > 1 ? "s" : ""} Earlier`;
                                            })()}
                                          </span>
                                        </span>
                                      )}
                                    </div>

                                    {/* Side-by-Side Comparison Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                      {/* Left: Currently Scheduled */}
                                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-1.5 shadow-2xs">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                          Current Scheduled Arrival
                                        </span>
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                          {currentScheduledDate ? fmtDateTime(currentScheduledDate) : "Not yet set"}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                          Provider: {assignedProviderName || "LilyCrest Facilities Team"}
                                        </div>
                                      </div>

                                      {/* Right: Tenant Requested */}
                                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-1.5 shadow-2xs">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                          Tenant Requested Slot
                                        </span>
                                        <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                          {fmtDateTime(rescheduleRequestData.proposedDate)}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                          {rescheduleRequestData.reason ? (
                                            <span className="italic text-slate-600 dark:text-slate-300">
                                              &ldquo;{rescheduleRequestData.reason}&rdquo;
                                            </span>
                                          ) : (
                                            <span className="text-slate-400">No specific reason provided</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Quick Action Button Grid (3 Balanced Columns) */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                                      {/* Accept New Date CTA */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAcceptReschedule(
                                            rescheduleRequestData.proposedDate,
                                          )
                                        }
                                        disabled={isRespondingToReschedule || isSubmittingAlternate || isSubmittingDecline}
                                        title="Accept tenant's requested date & time adjustment"
                                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98] transition shadow-2xs cursor-pointer disabled:opacity-50"
                                      >
                                        {isRespondingToReschedule ? (
                                          <Loader2 size={13} className="animate-spin" />
                                        ) : (
                                          <Check size={13} />
                                        )}
                                        <span>
                                          {isRespondingToReschedule
                                            ? "Accepting..."
                                            : "Accept New Date"}
                                        </span>
                                      </button>

                                      {/* Propose Alternate Date */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowAlternatePanel((v) => !v);
                                          setShowDeclinePanel(false);
                                        }}
                                        title="Pick an alternate date/time and send explanation note to tenant"
                                        className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer active:scale-[0.98] ${
                                          showAlternatePanel
                                            ? "border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-slate-600"
                                            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
                                        }`}
                                      >
                                        <Calendar size={13} />
                                        <span>Propose Alternate</span>
                                        {showAlternatePanel ? <ChevronUp size={12} className="opacity-70" /> : <ChevronDown size={12} className="opacity-70" />}
                                      </button>

                                      {/* Decline Request */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowDeclinePanel((v) => !v);
                                          setShowAlternatePanel(false);
                                        }}
                                        title="Decline this reschedule request and keep the current schedule"
                                        className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer active:scale-[0.98] ${
                                          showDeclinePanel
                                            ? "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-300 dark:ring-rose-800"
                                            : "border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-200 dark:hover:border-rose-900"
                                        }`}
                                      >
                                        <X size={13} />
                                        <span>Decline Request</span>
                                        {showDeclinePanel ? <ChevronUp size={12} className="opacity-70" /> : <ChevronDown size={12} className="opacity-70" />}
                                      </button>
                                    </div>

                                    {/* Expandable Decline Request Panel */}
                                    {showDeclinePanel && (
                                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3 mt-1 transition-all">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                            Decline Tenant Reschedule Request
                                          </span>
                                          <span className="text-[10px] text-slate-500">Current schedule will remain active</span>
                                        </div>

                                        <div>
                                          <div className="flex justify-between items-center mb-1">
                                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                              Reason for Declining * (Min 5 chars)
                                            </label>
                                            <span className="text-[10px] text-slate-400">{declineReason.length}/300</span>
                                          </div>
                                          <textarea
                                            rows={2}
                                            maxLength={300}
                                            placeholder="e.g. Technician already dispatched and en route; cannot postpone."
                                            value={declineReason}
                                            onChange={(e) => setDeclineReason(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 resize-none transition"
                                          />
                                          {declineReason.length > 0 && declineReason.trim().length < 5 && (
                                            <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 font-medium">
                                              <AlertCircle size={12} />
                                              Please enter at least 5 characters ({5 - declineReason.trim().length} more needed).
                                            </p>
                                          )}
                                        </div>

                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setShowDeclinePanel(false);
                                              setDeclineReason("");
                                            }}
                                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={handleDeclineReschedule}
                                            disabled={!declineReason || declineReason.trim().length < 5 || isSubmittingDecline}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                                          >
                                            {isSubmittingDecline ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                                            <span>{isSubmittingDecline ? "Declining..." : "Confirm Decline"}</span>
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Expandable Alternate Date & Explanation Note Panel */}
                                    {showAlternatePanel && (
                                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3 mt-1 transition-all">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                            Propose Alternate Visit Date &amp; Reason
                                          </span>
                                          <span className="text-[10px] text-slate-500">Operating hours: 8 AM – 6 PM</span>
                                        </div>

                                        <ModernDateTimePicker
                                          dateValue={alternateDate}
                                          timeValue={alternateTime}
                                          onDateChange={setAlternateDate}
                                          onTimeChange={setAlternateTime}
                                          disabled={isSubmittingAlternate}
                                        />

                                        <div>
                                          <div className="flex justify-between items-center mb-1">
                                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                              Staff Explanation Note to Tenant * (Min 5 chars)
                                            </label>
                                            <span className="text-[10px] text-slate-400">{alternateNote.length}/300</span>
                                          </div>
                                          <textarea
                                            rows={2}
                                            maxLength={300}
                                            placeholder="e.g. Technician fully booked in the morning; available at 2:00 PM."
                                            value={alternateNote}
                                            onChange={(e) => setAlternateNote(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none transition"
                                          />
                                          {alternateNote.length > 0 && alternateNote.trim().length < 5 && (
                                            <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1 font-medium">
                                              <AlertCircle size={12} />
                                              Please enter at least 5 characters ({5 - alternateNote.trim().length} more needed).
                                            </p>
                                          )}
                                        </div>

                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                          <button
                                            type="button"
                                            onClick={() => setShowAlternatePanel(false)}
                                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={handleSetAlternateSchedule}
                                            disabled={!alternateDate || !alternateTime || alternateNote.trim().length < 5 || isSubmittingAlternate}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                                          >
                                            {isSubmittingAlternate ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                            <span>{isSubmittingAlternate ? "Updating..." : "Submit Alternate Schedule"}</span>
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
                                Technician is active on site. Attach completion proof and record expenses to proceed to tenant verification.
                              </div>
                            </div>

                            {/* Right Column: Resolution Proof Uploader */}
                            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between space-y-4">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                    <ShieldCheck size={16} className="text-slate-700 dark:text-slate-300" />
                                    <span>Upload Resolution Proof</span>
                                  </h3>
                                  <span className="rounded bg-transparent px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                    Required *
                                  </span>
                                </div>

                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                  Upload photo proof of the completed repair. This will notify the tenant to inspect and verify the resolution.
                                </p>

                                {/* Custom File Upload Dropzone / Trigger */}
                                <input
                                  ref={proofFileInputRef}
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  onChange={handleSelectProofFile}
                                  className="hidden"
                                />

                                {!proofFile ? (
                                  <div
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      setIsDraggingProof(true);
                                    }}
                                    onDragLeave={() => setIsDraggingProof(false)}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      setIsDraggingProof(false);
                                      const file = e.dataTransfer.files?.[0];
                                      if (file) handleProcessProofFile(file);
                                    }}
                                    onClick={() => proofFileInputRef.current?.click()}
                                    className={`flex flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center cursor-pointer transition ${
                                      isDraggingProof
                                        ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                                        : proofTouched && !proofFile
                                          ? "border-rose-500 bg-rose-50/30 dark:bg-rose-950/20"
                                          : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30"
                                    }`}
                                  >
                                    <div className="flex shrink-0 items-center justify-center text-slate-500 dark:text-slate-400 mb-2">
                                      <Upload size={22} />
                                    </div>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                      Click to upload photo proof or drag &amp; drop
                                    </span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                      Supports PNG, JPG, JPEG, WEBP (Max 5MB)
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-2.5">
                                    {proofPreviewUrl && (
                                      <div className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
                                        <img
                                          src={proofPreviewUrl}
                                          alt="Proof Preview"
                                          className="h-full w-full object-cover"
                                        />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                        {proofFile.name}
                                      </p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        {(proofFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to submit
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleClearProofFile}
                                      className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                      title="Remove photo"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                )}

                                {proofTouched && !proofFile && (
                                  <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                    <AlertCircle size={11} className="shrink-0" />
                                    <span>Resolution proof photo is required to mark resolved.</span>
                                  </p>
                                )}

                                {/* Resolution Notes Input */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                      Resolution Notes <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
                                    </label>
                                    <span className="text-[10px] text-slate-400">
                                      {proofNote.length}/500
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    maxLength={500}
                                    value={proofNote}
                                    onChange={(e) => setProofNote(e.target.value)}
                                    placeholder="e.g., Replaced ball valve, sealed hairline crack, tested water pressure"
                                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-slate-900 dark:focus:border-slate-100 focus:outline-none transition"
                                  />
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
                                Photo proof will be displayed in the tenant's mobile verification screen.
                              </div>
                            </div>
                          </div>

                          {/* Post-Service Cost & Company Expense Accounting (Embedded with standalone save hidden) */}
                          <CostAttributionCard
                            ref={costCardRef}
                            request={request}
                            disabled={isLocked}
                            hideStandaloneAction={true}
                            defaultSummaryMode={false}
                          />

                          {/* Unified Stage 3 Primary Action Footer Bar */}
                          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                            {rescheduleRequestData?.status === "pending" && (
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5 flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                                <span>
                                  <strong>Pending Reschedule Request:</strong> You cannot mark work as done while a tenant reschedule request is pending. Please accept, propose an alternate date, or decline the request above first.
                                </span>
                              </div>
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="text-xs text-slate-600 dark:text-slate-400 min-w-0">
                                {isSubmittingUnified ? (
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Loader2 size={13} className="animate-spin text-emerald-600" />
                                    Saving repair details and submitting proof...
                                  </span>
                                ) : rescheduleRequestData?.status === "pending" ? (
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Action locked until the pending reschedule request is resolved.
                                  </span>
                                ) : (
                                  <span>
                                    Ready to finish? This saves the repair details, logs the proof, and lets the tenant know the repair is done.
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={handleUnifiedCompleteAndResolve}
                                disabled={isLocked || isSubmittingUnified || rescheduleRequestData?.status === "pending"}
                                title={
                                  rescheduleRequestData?.status === "pending"
                                    ? "Resolve the pending reschedule request first before marking work as done"
                                    : "Mark work as done and submit proof"
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-6 py-2.5 text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shrink-0 active:scale-[0.98]"
                              >
                                {isSubmittingUnified ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={14} />
                                )}
                                <span>
                                  {isSubmittingUnified
                                    ? "Marking as Done..."
                                    : "Mark Work Done & Upload Proof"}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STAGE 4: RESOLVED (Waiting with Summary Hub & 7-Day Auto-Completion) */}
                  {isResolvedStage && (() => {
                    const observation = getRemainingObservationDays(
                      request?.resolved_at || request?.updatedAt || request?.created_at,
                    );
                    const latestResolutionLog =
                      Array.isArray(rawWorkLog) && rawWorkLog.length > 0
                        ? rawWorkLog[rawWorkLog.length - 1]
                        : null;
                    const resolutionNoteText =
                      latestResolutionLog?.note ||
                      request?.resolution_note ||
                      request?.resolutionNote ||
                      null;
                    const hasTenantConfirmed = Boolean(request?.resolutionConfirmation?.confirmedAt);
                    const totalLabor = Number(request?.costBreakdown?.laborCost || 0);
                    const totalMaterials = Number(request?.costBreakdown?.materialsCost || 0);
                    const totalCost = totalLabor + totalMaterials;

                    return (
                      <div className="space-y-4">
                        {/* 1. Observation Window & Live Tenant Verification Status */}
                        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Clock size={16} className="text-slate-700 dark:text-slate-300 shrink-0" />
                              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                                Stage 4: Work Resolved • Waiting for Tenant Feedback &amp; Rating
                              </h3>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-transparent text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span>
                                {observation.isExpired
                                  ? "7-Day Window Elapsed (Eligible for Auto-Completion)"
                                  : `Day ${observation.elapsedDays + 1} of 7 • ${observation.remainingDays} Day${observation.remainingDays === 1 ? "" : "s"} Remaining`}
                              </span>
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 flex-wrap gap-1">
                              <span>
                                {observation.isExpired
                                  ? "Observation period completed. Ticket is eligible for immediate finalization."
                                  : `Technician repair proof and resolution details have been recorded. The tenant has been prompted to inspect and submit a star rating. Auto-finalizes on ${observation.targetDate ? fmtDateTime(observation.targetDate) : "in 7 days"}.`}
                              </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 shrink-0">
                                {observation.percent}% Elapsed
                              </span>
                            </div>

                            {/* Clean 1px solid Progress Bar (No Gradients) */}
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  observation.isExpired ? "bg-amber-600 dark:bg-amber-500" : "bg-blue-600 dark:bg-blue-500"
                                }`}
                                style={{ width: `${Math.max(5, observation.percent)}%` }}
                              />
                            </div>
                          </div>

                          {/* 4-Stat Metric Grid for Waiting Summary */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 space-y-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                Assigned Provider
                              </span>
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {assignedProviderName || "LilyCrest Team"}
                              </div>
                              {assignedProviderCategory && (
                                <span className="text-[9px] font-semibold text-slate-500 uppercase">
                                  {assignedProviderCategory}
                                </span>
                              )}
                            </div>

                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 space-y-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                Total Repair Cost
                              </span>
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {formatPeso(totalCost)}
                              </div>
                              <span className="text-[9px] text-slate-500">
                                {formatPeso(totalLabor)} labor + {formatPeso(totalMaterials)} mat.
                              </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 space-y-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                Work Resolved At
                              </span>
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {request?.resolved_at ? fmtDateTime(request.resolved_at) : "Just Now"}
                              </div>
                              <span className="text-[9px] text-slate-500">
                                Proof Verified
                              </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 space-y-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                Auto-Close Target
                              </span>
                              <div className="text-xs font-bold text-amber-700 dark:text-amber-400 truncate">
                                {observation.targetDate ? fmtDateTime(observation.targetDate) : "In 7 Days"}
                              </div>
                              <span className="text-[9px] text-slate-500">
                                {observation.remainingDays} days left
                              </span>
                            </div>
                          </div>

                          {/* Live Tenant Confirmation Feedback Status */}
                          {hasTenantConfirmed ? (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                  <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                                  <span>Tenant Feedback Received</span>
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {fmtDateTime(request.resolutionConfirmation.confirmedAt)}
                                </span>
                              </div>
                              {request?.resolutionConfirmation?.rating && (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center text-amber-500">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        size={12}
                                        className={
                                          star <= request.resolutionConfirmation.rating
                                            ? "fill-amber-400 text-amber-500"
                                            : "text-slate-300 dark:text-slate-600"
                                        }
                                      />
                                    ))}
                                  </div>
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {request.resolutionConfirmation.rating} / 5 Stars
                                  </span>
                                </div>
                              )}
                              {request?.resolutionConfirmation?.tenantFeedback && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                                  &ldquo;{request.resolutionConfirmation.tenantFeedback}&rdquo;
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 flex-wrap gap-2">
                              <span>Awaiting tenant feedback &amp; rating on web/mobile app...</span>
                              <button
                                type="button"
                                onClick={() => setActiveTab("conversation")}
                                className="text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Send size={11} />
                                <span>Send Message to Tenant</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 2. Side-by-Side Before vs After Visual Proof & Inspection Grid */}
                        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                            <div className="flex items-center gap-2">
                              <ShieldCheck size={16} className="text-slate-700 dark:text-slate-300 shrink-0" />
                              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                                Work Order Proof &amp; Inspection
                              </h3>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-transparent text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              Side-by-Side Review
                            </span>
                          </div>

                          {resolutionNoteText && (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3 text-xs space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider">
                                Technician Resolution Notes
                              </span>
                              <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                {resolutionNoteText}
                              </p>
                            </div>
                          )}

                          <div className="grid gap-3 sm:grid-cols-2">
                            {/* Tenant Reported Media (Before) */}
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-3 space-y-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                                1. Tenant Reported Issue (Before)
                              </span>
                              {initialAttachments.length === 0 ? (
                                <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-400">
                                  No initial media attached
                                </div>
                              ) : (
                                <div className="grid grid-cols-3 gap-2">
                                  {initialAttachments.map((att, idx) => (
                                    <AttachmentThumbnail
                                      key={idx}
                                      attachment={att}
                                      index={idx}
                                      onPreviewImage={setLightboxImage}
                                      tag="Before Repair"
                                      size="large"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Technician Resolution Proof (After) */}
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-3 space-y-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                                2. Technician Completion Proof (After)
                              </span>
                              {workLogAttachments.length === 0 ? (
                                <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-400">
                                  No resolution proof logged
                                </div>
                              ) : (
                                <div className="grid grid-cols-3 gap-2">
                                  {workLogAttachments.map((att, idx) => (
                                    <AttachmentThumbnail
                                      key={idx}
                                      attachment={att}
                                      index={idx}
                                      onPreviewImage={setLightboxImage}
                                      tag="Resolution Proof (After)"
                                      size="large"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 3. Contractor Performance Rating Form */}
                        <ProviderRatingCard
                          ref={providerRatingRef}
                          request={request}
                          isSubmitting={isRatingProvider || isSubmittingStage4}
                          onSubmitRating={handleRatingSubmit}
                          disabled={isLocked && Boolean(request?.providerRating?.rating)}
                          hideStandaloneAction={false}
                        />

                        {/* 4. Cost Attribution Accounting */}
                        <CostAttributionCard
                          ref={costCardRef}
                          request={request}
                          disabled={isLocked}
                          hideStandaloneAction={false}
                          defaultSummaryMode={false}
                        />

                        {/* 5. Stage 4 Waiting Action Footer Bar */}
                        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs text-slate-600 dark:text-slate-400 min-w-0">
                              <span>
                                Stage 4 resolution is active. The ticket will advance to <strong>Stage 5 (Completed)</strong> when the tenant confirms on mobile/web, or auto-complete after <strong>7 days</strong>.
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setActiveTab("conversation")}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer active:scale-[0.98] shadow-2xs"
                              >
                                <Send size={13} className="text-sky-600 dark:text-sky-400" />
                                <span>Send Reminder</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setShowReopenDialog(true)}
                                disabled={isSubmittingStage4 || isLocked}
                                title="Reopen this request for additional maintenance servicing"
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer active:scale-[0.98] shadow-2xs disabled:opacity-50"
                              >
                                <RefreshCw size={13} className="text-amber-600 dark:text-amber-400" />
                                <span>Reopen Request</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setShowForceFinalizeModal(true)}
                                disabled={isLocked || isForceFinalizing}
                                title="Staff on-site verification and direct sign-off"
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2 text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer active:scale-[0.98]"
                              >
                                <CheckCircle2 size={14} />
                                <span>Staff Direct Sign-Off</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* STAGE 5: COMPLETED (Single Unified Executive Completion Summary Voucher) */}
                  {isCompletedStage && (() => {
                    const closureMeta = getClosureMethodMeta(request);
                    const turnaroundDuration = formatTurnaroundDuration(
                      request?.createdAt || request?.created_at,
                      request?.resolutionConfirmation?.confirmedAt ||
                        request?.closed_at ||
                        request?.resolved_at ||
                        request?.updatedAt,
                    );
                    const totalLabor = Number(request?.costBreakdown?.laborCost || 0);
                    const totalMaterials = Number(request?.costBreakdown?.materialsCost || 0);
                    const totalCost = totalLabor + totalMaterials;
                    const isTenantBilled = Boolean(request?.costBreakdown?.isTenantChargeable);
                    const tenantRating = request?.resolutionConfirmation?.rating;
                    const tenantComment = request?.resolutionConfirmation?.tenantFeedback;
                    const latestResolutionLog =
                      Array.isArray(rawWorkLog) && rawWorkLog.length > 0
                        ? rawWorkLog[rawWorkLog.length - 1]
                        : null;
                    const resolutionNoteText =
                      latestResolutionLog?.note ||
                      request?.resolution_note ||
                      request?.resolutionNote ||
                      null;
                    const closedDate =
                      request?.resolutionConfirmation?.confirmedAt ||
                      request?.closed_at ||
                      request?.resolved_at ||
                      request?.updatedAt;

                    return (
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-4">
                        {/* 1. Official Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                              <CheckCircle2 size={20} />
                            </div>
                            <div>
                              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <span>Maintenance Request Completed</span>
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Ticket #{request.ticketNumber || shortId} • Closed on {fmtDateTime(closedDate)}
                              </p>
                            </div>
                          </div>

                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${closureMeta.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${closureMeta.dot} shrink-0`} />
                            <span>{closureMeta.label}</span>
                          </span>
                        </div>

                        {/* 2. 4-Column Quick-Stats Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {/* Col 1: Turnaround Duration */}
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider flex items-center gap-1">
                              <Timer size={12} className="text-slate-400 shrink-0" />
                              <span>Turnaround Time</span>
                            </span>
                            <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                              {turnaroundDuration}
                            </div>
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium block truncate">
                              Work Completed
                            </span>
                          </div>

                          {/* Col 2: Total Cost Settlement */}
                          <div
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-1"
                            title={
                              totalCost > 0
                                ? `Labor: ${formatPeso(totalLabor)} • Materials: ${formatPeso(totalMaterials)}`
                                : undefined
                            }
                          >
                            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider flex items-center gap-1">
                              <Receipt size={12} className="text-slate-400 shrink-0" />
                              <span>Total Cost</span>
                            </span>
                            <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                              {totalCost > 0 ? formatPeso(totalCost) : "PHP 0.00"}
                            </div>
                            <span className={`text-[10px] font-medium block truncate ${isTenantBilled ? "text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
                              {isTenantBilled ? "Billed to Tenant" : "Dormitory Covered"}
                            </span>
                          </div>

                          {/* Col 3: Service Provider */}
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider flex items-center gap-1">
                              <UserCheck size={12} className="text-slate-400 shrink-0" />
                              <span>Technician / Provider</span>
                            </span>
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {assignedProviderName || "Facilities Team"}
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                              {assignedProviderCategory || "Internal Maintenance"}
                            </span>
                          </div>

                          {/* Col 4: Quality & Satisfaction Scorecard */}
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider flex items-center gap-1">
                              <Star size={12} className="text-amber-500 shrink-0" />
                              <span>Tenant Rating</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                                {tenantRating ? `${tenantRating}/5` : "5/5"}
                              </span>
                              <div className="flex items-center text-amber-500">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={11}
                                    className={
                                      star <= (tenantRating || 5)
                                        ? "fill-amber-400 text-amber-500"
                                        : "text-slate-300 dark:text-slate-600"
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                              {tenantRating ? "Tenant Verified" : "Staff Verified"}
                            </span>
                          </div>
                        </div>

                        {/* 3. Technician Notes & Tenant Feedback Quotes */}
                        {(resolutionNoteText || tenantComment) && (
                          <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
                            {resolutionNoteText && (
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-3 space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                                  Technician Resolution Note
                                </span>
                                <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                  {resolutionNoteText}
                                </p>
                              </div>
                            )}

                            {tenantComment && (
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-3 space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                                  Tenant Comment
                                </span>
                                <p className="text-slate-800 dark:text-slate-200 italic leading-relaxed">
                                  &ldquo;{tenantComment}&rdquo;
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. Compact Side-by-Side Visual Proof Strip */}
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/20 p-3 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                              <span>Verified Visual Proof (Before &amp; After)</span>
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              Click any photo to enlarge
                            </span>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            {/* Before Attachments */}
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                                1. Tenant Initial Report (Before)
                              </span>
                              {initialAttachments.length === 0 ? (
                                <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 dark:bg-slate-800/30 text-[11px] text-slate-400">
                                  No initial media attached
                                </div>
                              ) : (
                                <div className="grid grid-cols-3 gap-1.5">
                                  {initialAttachments.map((att, idx) => (
                                    <AttachmentThumbnail
                                      key={idx}
                                      attachment={att}
                                      index={idx}
                                      onPreviewImage={setLightboxImage}
                                      tag="Before"
                                      size="small"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* After Attachments */}
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                                2. Technician Resolution Proof (After)
                              </span>
                              {workLogAttachments.length === 0 ? (
                                <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 dark:bg-slate-800/30 text-[11px] text-slate-400">
                                  No resolution proof media logged
                                </div>
                              ) : (
                                <div className="grid grid-cols-3 gap-1.5">
                                  {workLogAttachments.map((att, idx) => (
                                    <AttachmentThumbnail
                                      key={idx}
                                      attachment={att}
                                      index={idx}
                                      onPreviewImage={setLightboxImage}
                                      tag="After"
                                      size="small"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 5. Clean Action Footer Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveTab("conversation")}
                              className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold flex items-center gap-1.5 cursor-pointer transition"
                            >
                              <History size={13} />
                              <span>View Complete Audit Timeline</span>
                            </button>

                            <span className="text-slate-300 dark:text-slate-700">|</span>

                            <button
                              type="button"
                              onClick={() => setShowReopenDialog(true)}
                              className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw size={12} />
                              <span>Reopen Request</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {onGenerateReport && (
                              <button
                                type="button"
                                onClick={() => onGenerateReport("admin")}
                                title="Generate or view official maintenance completion report"
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98] transition cursor-pointer shadow-sm"
                              >
                                <Sparkles size={13} />
                                <span>
                                  {request?.completionReport?.summary
                                    ? "View Official Completion Report"
                                    : "Generate AI Completion Report"}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ═══════════════════════════════════════════ */}
              {/* TAB 2: CONVERSATION THREAD                  */}
              {/* ═══════════════════════════════════════════ */}
              {activeTab === "conversation" && (
                <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-primary" />
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        Two-Way Tenant Communication
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500">
                      {request.conversation?.length || 0} Messages
                    </span>
                  </div>

                  <MaintenanceConversationSection
                    conversation={request.conversation || []}
                    currentSide="admin"
                    isActiveTicket={!["cancelled", "closed"].includes(String(request.status || "").toLowerCase())}
                    ticketStatus={formatMaintenanceStatus(request.status)}
                    onSendReply={handleAdminSendReply}
                    isSending={sendReplyMutation.isPending}
                    onPreviewAttachment={(attachment) => {
                      const uri = getMaintenanceAttachmentUri(attachment);
                      const name = getMaintenanceAttachmentName(attachment);
                      if (uri) {
                        setLightboxImage({
                          uri,
                          name: name || "Conversation Photo",
                          tag: "Conversation Photo",
                          attachment,
                        });
                        setLightboxZoom(1);
                      }
                    }}
                    requestId={request.request_id || request._id}
                    isOtherTyping={tenantIsTyping}
                    otherTypingName={tenantTypingName}
                    onTypingChange={handleAdminTypingChange}
                  />
                </div>
              )}

              {/* ═══════════════════════════════════════════ */}
              {/* TAB 3: AUDIT & TIMELINE                     */}
              {/* ═══════════════════════════════════════════ */}
              {activeTab === "timeline" && (
                <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <History size={16} className="text-primary" />
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        Audit Log &amp; Timeline History
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500">
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

      {/* ================= LIGHTBOX MODAL ================= */}
      {lightboxImage &&
        typeof document !== "undefined" &&
        (() => {
          const activeUri = typeof lightboxImage === "string" ? lightboxImage : lightboxImage?.uri || "";
          const activeName = typeof lightboxImage === "object" ? lightboxImage?.name || "Attachment" : "Attachment";
          const activeTag = typeof lightboxImage === "object" ? lightboxImage?.tag || "Attachment" : "Attachment";
          const isPdf = isMaintenancePdfAttachment(activeUri) || String(activeName).toLowerCase().endsWith(".pdf") || String(activeUri).toLowerCase().includes(".pdf");

          return createPortal(
            <div
              className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxImage(null);
              }}
            >
              {/* Top Floating Controls */}
              <div
                className="fixed top-4 right-4 z-50 flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {!isPdf && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxZoom((z) => Math.min(z + 0.25, 2.5));
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxZoom((z) => Math.max(z - 0.25, 0.5));
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut size={14} />
                    </button>
                  </>
                )}

                <a
                  href={activeUri}
                  download
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  title="Download File"
                >
                  <Download size={14} />
                </a>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxImage(null);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  title="Close (Esc)"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Bottom Caption */}
              <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                <div className="flex items-center gap-2 rounded-full bg-black/80 border border-white/15 px-4 py-1.5 text-xs text-white shadow-2xl backdrop-blur-md">
                  <span className="font-semibold text-white/90 text-[11px] uppercase tracking-wider">
                    {activeTag}
                  </span>
                  <span className="text-white/30">•</span>
                  <span className="text-white/80 font-mono text-[11px] truncate max-w-xs sm:max-w-md">
                    {activeName}
                  </span>
                </div>
              </div>

              {/* Centered Content */}
              <div
                className="flex items-center justify-center overflow-auto p-2"
                onClick={(e) => e.stopPropagation()}
              >
                {isPdf ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-700 rounded-2xl text-white space-y-4 max-w-md text-center shadow-2xl">
                    <div className="flex shrink-0 items-center justify-center text-rose-500">
                      <FileText size={42} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white mb-1">{activeName}</h4>
                      <p className="text-xs text-slate-400">PDF Document Attachment</p>
                    </div>
                    <a
                      href={activeUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer"
                    >
                      <ExternalLink size={13} />
                      <span>Open PDF in New Tab</span>
                    </a>
                  </div>
                ) : (
                  <img
                    src={activeUri}
                    alt={activeName}
                    style={{ transform: `scale(${lightboxZoom})`, transition: "transform 0.15s ease" }}
                    className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl border border-white/10"
                  />
                )}
              </div>
            </div>,
            document.body,
          );
        })()}

      <ReopenRequestModal
        open={showReopenDialog}
        onClose={() => setShowReopenDialog(false)}
        request={request}
        onSubmit={handleConfirmReopen}
        isSubmitting={reopenAdminMutation.isPending}
      />

      <ForceFinalizeModal
        open={showForceFinalizeModal}
        onClose={() => setShowForceFinalizeModal(false)}
        request={request}
        onConfirm={handleConfirmForceFinalize}
        isSubmitting={isForceFinalizing}
      />
    </div>
  );
}
