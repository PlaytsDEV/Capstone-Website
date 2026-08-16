import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  Droplets,
  ExternalLink,
  Eye,
  File,
  FileCheck,
  FileImage,
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
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User,
  UserCheck,
  Wrench,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  fmtDateTime,
  formatBranchLabel,
  formatCleanRoomName,
  formatMaintenanceStatus,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentUri,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
  getRequestBranch,
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
  tag = "Resident Upload",
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

export function MaintenanceDetailModal({
  open,
  onClose,
  request: incomingRequest,
  onSchedule,
  onRespondToReschedule,
  isRespondingToReschedule = false,
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

  // Clear override when modal closes or switches to a different request
  useEffect(() => {
    setLocalRequestOverride(null);
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

  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'conversation' | 'proof' | 'timeline'
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

  useEffect(() => {
    if (request?._id || request?.request_id) {
      if (activeTab === "conversation") {
        markConversationSeen(request.request_id || request._id);
      }
    }
  }, [request?.request_id, request?._id, activeTab, request?.conversation?.length]);

  // Proof Upload & Unified Stage 3 Resolution State
  const costCardRef = useRef(null);
  const saveProofMutation = useSaveMaintenanceProof();
  const sendReplyMutation = useSendMaintenanceReply();
  const [proofFile, setProofFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState(null);
  const [proofNote, setProofNote] = useState("");
  const [proofTouched, setProofTouched] = useState(false);
  const [isDraggingProof, setIsDraggingProof] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isSubmittingUnified, setIsSubmittingUnified] = useState(false);
  const [showProofUploader, setShowProofUploader] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const proofFileInputRef = useRef(null);

  // Scheduling panel state
  const scheduleMutation = useScheduleAdminMaintenance();
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

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

      // 1. Immediately advance to next stage (Stage 3: In Progress) FIRST!
      const updatedReq = res?.request || res?.data?.request || (res?.status ? res : null);
      if (updatedReq) {
        setLocalRequestOverride(updatedReq);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          status: "in_progress",
          scheduledDate: scheduledIso,
          schedule: {
            scheduledDate: scheduledIso,
            notes: scheduleNote.trim() || undefined,
          },
        }));
      }

      // 2. NOW safely reset schedule form data
      setScheduleDate("");
      setScheduleTime("");
      setScheduleNote("");
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleAcceptReschedule = async (proposedDate) => {
    if (!proposedDate) return;
    await onRespondToReschedule?.({
      action: "accept",
      scheduledDate: proposedDate,
    });
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
      const scheduledIso = `${scheduleDate}T${scheduleTime}:00`;
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
        message: err?.message || "Failed to schedule repair visit.",
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

      // 1. Immediately advance to next stage (Stage 4: Resolved) FIRST!
      if (updatedRequest) {
        setLocalRequestOverride(updatedRequest);
      } else {
        setLocalRequestOverride((prev) => ({
          ...(prev || request),
          status: "resolved",
        }));
      }

      showNotification({
        title: "Resolution Proof Saved",
        message: "Proof photo saved. Ticket is now Resolved (Awaiting Resident Verification).",
        type: "success",
      });

      // 2. NOW safely reset proof inputs
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

  // Unified Multi-Card Next Action for Stage 3 (In Progress -> Resolved)
  const handleUnifiedCompleteAndResolve = async () => {
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
        title: "Repair Marked as Resolved",
        message: "Photo proof and repair details saved. The tenant has been notified to check the work.",
        type: "success",
      });

      // 2. NOW safely reset local form data
      handleClearProofFile();
      setProofNote("");
      setProofTouched(false);
      setShowProofUploader(false);
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
      setShowProofUploader(false);
      setShowScheduler(false);
      setShowProviderAssigner(false);
      setScheduleDate("");
      setScheduleTime("");
      setScheduleNote("");
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
    "Resident";

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
        return "bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700/60";
      case "reviewed":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300";
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
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Maintenance Ticket</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  title="Click to copy full ID"
                  className="inline-flex items-center gap-1 rounded-md bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <Copy size={11} className={isCopiedId ? "text-emerald-600" : "text-slate-400"} />
                  <span>#{request.ticketNumber || shortId}</span>
                </button>
              </h2>

              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0"
                style={{
                  backgroundColor: `${urgencyMeta.color}15`,
                  color: urgencyMeta.color,
                  border: `1px solid ${urgencyMeta.color}30`,
                }}
              >
                {urgencyMeta.label} Priority
              </span>
            </div>

            {/* Right: Resident, Room Info & Close */}
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
              onClick={() => setActiveTab("overview")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer shrink-0 ${
                activeTab === "overview"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-2xs font-bold"
                  : "border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              }`}
            >
              <ClipboardCheck size={14} />
              <span>Overview &amp; Action Hub</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("conversation");
                markConversationSeen(request.request_id || request._id);
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer shrink-0 ${
                activeTab === "conversation"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-2xs font-bold"
                  : "border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              }`}
            >
              <MessageSquare size={14} />
              <span>Conversation Thread</span>
              {getUnreadConvCount(request, activeTab === "conversation") > 0 && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === "conversation"
                    ? "bg-white/20 text-white dark:bg-slate-900/30 dark:text-slate-900"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                }`}>
                  {getUnreadConvCount(request, activeTab === "conversation")}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("proof")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer shrink-0 ${
                activeTab === "proof"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-2xs font-bold"
                  : "border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              }`}
            >
              <ShieldCheck size={14} />
              <span>Proof &amp; Completion Report</span>
              {workLogAttachments.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === "proof"
                    ? "bg-white/20 text-white dark:bg-slate-900/30 dark:text-slate-900"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}>
                  {workLogAttachments.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("timeline")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer shrink-0 ${
                activeTab === "timeline"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-2xs font-bold"
                  : "border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              }`}
            >
              <History size={14} />
              <span>Audit &amp; Timeline</span>
              {timelineItems.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === "timeline"
                    ? "bg-white/20 text-white dark:bg-slate-900/30 dark:text-slate-900"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}>
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
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="font-bold">Potential Duplicate Tickets Detected</span>
                    <p className="mt-0.5 text-amber-800 dark:text-amber-300 leading-relaxed">
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
                  {/* 1. RESIDENT CONCERN & CONTEXT CARD */}
                  <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-lg border text-xs shrink-0"
                          style={{
                            backgroundColor: `${typeMeta.color}15`,
                            borderColor: `${typeMeta.color}35`,
                            color: typeMeta.color,
                          }}
                        >
                          {getTypeIcon(request.request_type)}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {typeMeta.label} Request
                          </h3>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Submitted on {fmtDateTime(request.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 md:hidden font-medium">
                        <span>{tenantName} • {fullLocationLabel}</span>
                      </div>
                    </div>

                    {/* Reported Problem Text */}
                    <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 p-3 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Problem Description
                      </span>
                      <p className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed font-normal whitespace-pre-wrap">
                        {request.description || "No specific problem details provided by resident."}
                      </p>
                      {request.notes && (
                        <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Staff Notes: </span>
                          {request.notes}
                        </div>
                      )}
                    </div>

                    {/* Resident Attached Media Strip */}
                    {initialAttachments.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          Resident Attached Photos / Documents ({initialAttachments.length})
                        </span>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {initialAttachments.map((att, idx) => (
                            <AttachmentThumbnail
                              key={idx}
                              attachment={att}
                              index={idx}
                              onPreviewImage={setLightboxImage}
                              tag="Resident Upload"
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
                      <div className="flex items-center gap-2">
                        <ClipboardCheck size={16} className="text-slate-700 dark:text-slate-300" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Guided Stage Action Hub
                        </h3>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline">
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
                                className={`mt-1.5 text-[11px] max-w-[76px] leading-tight transition-colors ${
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
                      <div className="flex items-start gap-2.5 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs">
                        <RefreshCw size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 animate-spin-slow" />
                        <div className="min-w-0">
                          <div className="font-bold text-rose-900 dark:text-rose-200">
                            Reopened by Resident — Iteration #{request?.reopenCount || 1}
                          </div>
                          <p className="mt-0.5 text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                            {request?.reopen_history?.[request.reopen_history.length - 1]?.note ||
                              request?.reopen_note ||
                              "Resident reported the issue persists. Please reassess, reassign or reschedule the repair."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Stage 4 Resolved Alert Banner (Awaiting Tenant Feedback & 7-Day Auto-Completion Notice) */}
                    {isResolvedStage && (
                      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs">
                        <div className="flex items-start gap-2.5">
                          <Clock size={16} className="text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                Stage 4: Work Resolved • Awaiting Tenant Verification &amp; Feedback
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                7-Day Auto-Completion Policy
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              Repair details and completion proof have been saved. The tenant has been notified on mobile to inspect the repair and submit feedback. If no issues or objections are reported within <strong>7 days (1 week)</strong>, this ticket will automatically close as Completed.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stage 5: Terminal Completed Banner with AI Report Generator */}
                    {isTerminal && (
                      <div className="flex flex-col gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs">
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {request?.status === "completed"
                                  ? "Stage 5: Ticket Completed & Confirmed Fixed"
                                  : request?.status === "rejected"
                                    ? "Ticket Rejected"
                                    : request?.status === "cancelled"
                                      ? "Ticket Cancelled"
                                      : "Stage 5: Ticket Closed & Archived"}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                Officially Closed
                              </span>
                            </div>
                            {request?.resolutionConfirmation?.confirmedAt ? (
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                Resident confirmed resolution on {fmtDateTime(request.resolutionConfirmation.confirmedAt)}
                                {request.resolutionConfirmation.tenantFeedback
                                  ? ` • "${request.resolutionConfirmation.tenantFeedback}"`
                                  : ""}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
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
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer shadow-sm"
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
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                              Assign Service Provider &amp; Schedule Repair Visit
                            </h3>
                          </div>
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
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
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-bold shadow-2xs">
                                2
                              </span>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                Set Repair Visit Schedule
                              </h4>
                            </div>
                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
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
                                Room Access Notes / Resident Instructions <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
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
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-5 py-2.5 text-xs font-bold shadow-sm disabled:opacity-40 transition cursor-pointer shrink-0 active:scale-[0.98]"
                          >
                            {isAssigningProvider || isSubmittingSchedule ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            <span>
                              {isAssigningProvider || isSubmittingSchedule
                                ? "Confirming..."
                                : "Confirm"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STAGE 3: IN PROGRESS (Active Execution, Resident Reschedule, Proof Upload & Expenses) */}
                  {(isExecutionStage || isReopened) && (
                    <div id="maintenance-stage3-actions" className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2 items-stretch">
                        {/* Left Column: Active Technician & Work Order Info */}
                        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <PlayCircle size={16} className="text-amber-600 dark:text-amber-500" />
                                <span>Active Work In Progress</span>
                              </h3>
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
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
                                    className="text-slate-700 dark:text-slate-300 font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5"
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

                              {request?.scheduledDate && (
                                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs">
                                  <div>
                                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                                      Scheduled Arrival
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {fmtDateTime(request.scheduledDate)}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setShowScheduler((v) => !v)}
                                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                                  >
                                    {showScheduler ? "Hide" : "Reschedule"}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Resident Reschedule Request Alert Banner */}
                            {request?.rescheduleRequest?.status === "pending" && (
                              <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2 text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                                  <Clock size={14} className="text-amber-600 shrink-0" />
                                  <span>Resident Requested Schedule Adjustment</span>
                                </div>
                                <p className="text-amber-800 dark:text-amber-300">
                                  Preferred:{" "}
                                  <strong>
                                    {fmtDateTime(request.rescheduleRequest.proposedDate)}
                                  </strong>
                                  {request.rescheduleRequest.reason
                                    ? ` • "${request.rescheduleRequest.reason}"`
                                    : ""}
                                </p>
                                <div className="flex gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAcceptReschedule(
                                        request.rescheduleRequest.proposedDate,
                                      )
                                    }
                                    disabled={isRespondingToReschedule}
                                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs cursor-pointer"
                                  >
                                    {isRespondingToReschedule
                                      ? "Updating..."
                                      : "Accept New Date"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowScheduler(true)}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 text-amber-900 hover:bg-amber-100 transition cursor-pointer"
                                  >
                                    Set Alternate Date
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Interactive Rescheduler if opened */}
                            {showScheduler && (
                              <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/30 p-3.5 space-y-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-950 dark:text-sky-200 block">
                                  Update Repair Visit Date &amp; Time
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="date"
                                    value={scheduleDate}
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    min={new Date().toISOString().slice(0, 10)}
                                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                                  />
                                  <input
                                    type="time"
                                    value={scheduleTime}
                                    onChange={(e) => setScheduleTime(e.target.value)}
                                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                                  />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setShowScheduler(false)}
                                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleScheduleVisit}
                                    disabled={
                                      !scheduleDate ||
                                      !scheduleTime ||
                                      isSubmittingSchedule
                                    }
                                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shadow-xs"
                                  >
                                    {isSubmittingSchedule
                                      ? "Saving..."
                                      : "Save Schedule"}
                                  </button>
                                </div>
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
                              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <ShieldCheck size={16} className="text-slate-700 dark:text-slate-300" />
                                <span>Upload Resolution Proof</span>
                              </h3>
                              <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
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
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mb-2">
                                  <Upload size={16} />
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
                      />

                      {/* Unified Stage 3 Primary Action Footer Bar */}
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs text-slate-600 dark:text-slate-400 min-w-0">
                          {isSubmittingUnified ? (
                            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <Loader2 size={13} className="animate-spin text-emerald-600" />
                              Saving repair details and submitting proof...
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
                          disabled={isLocked || isSubmittingUnified}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-6 py-2.5 text-xs font-bold shadow-sm disabled:opacity-40 transition cursor-pointer shrink-0 active:scale-[0.98]"
                        >
                          {isSubmittingUnified ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          <span>
                            {isSubmittingUnified
                              ? "Marking as Resolved..."
                              : "Mark as Resolved"}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STAGE 4: RESOLVED (Tenant Verification & Rating Window) */}
                  {isResolvedStage && (
                    <div className="space-y-4">
                      {/* Tenant Verification Status & Actions Card */}
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-slate-700 dark:text-slate-300 shrink-0" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                              Tenant Verification &amp; Feedback Window
                            </h3>
                          </div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Awaiting Feedback
                          </span>
                        </div>

                        {/* Tenant Feedback Status */}
                        {request?.resolutionConfirmation?.confirmedAt ? (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                  Verified by Resident
                                </span>
                              </div>
                              {request?.resolutionConfirmation?.confirmedAt && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                  {fmtDateTime(request.resolutionConfirmation.confirmedAt)}
                                </span>
                              )}
                            </div>

                            {/* Tenant Star Rating if provided */}
                            {request?.resolutionConfirmation?.rating ? (
                              <div className="flex items-center gap-2 pt-0.5">
                                <div className="flex items-center text-amber-500">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      size={14}
                                      className={
                                        star <= request.resolutionConfirmation.rating
                                          ? "fill-amber-400 text-amber-500"
                                          : "text-slate-300 dark:text-slate-600"
                                      }
                                    />
                                  ))}
                                </div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  {request.resolutionConfirmation.rating} / 5 Rating
                                </span>
                              </div>
                            ) : null}

                            {request?.resolutionConfirmation?.tenantFeedback ? (
                              <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                                "{request.resolutionConfirmation.tenantFeedback}"
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                Resident confirmed resolution without additional comments.
                              </p>
                            )}

                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                              Observation window active: Ticket will automatically finalize as Completed after 7 days of inactivity.
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                              <Clock size={14} className="text-slate-500" />
                              <span>Pending Tenant Feedback on Web &amp; Mobile</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              The tenant was notified to inspect the resolved issue and rate the repair. If no further movement or issues are reported within <strong>7 days (1 week)</strong>, the ticket will automatically close as Completed.
                            </p>
                          </div>
                        )}

                        {/* Action Buttons: In-Person Confirmation or Reopen */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            The ticket will auto-complete after 7 days. If the resident confirmed in person, you can manually complete now.
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                setLocalRequestOverride((prev) => ({ ...(prev || request), status: "in_progress" }));
                                await onQuickStatusChange?.(rawRequestId, "in_progress");
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                              <RefreshCw size={13} />
                              <span>Reopen Issue</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                setLocalRequestOverride((prev) => ({ ...(prev || request), status: "completed" }));
                                await onQuickStatusChange?.(rawRequestId, "completed");
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                              <CheckCircle2 size={13} />
                              <span>Staff Early Close Override</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Contractor Performance Rating (Available in Stage 4) */}
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                        <ProviderRatingCard
                          request={request}
                          isSubmitting={isRatingProvider}
                          onSubmitRating={onRateProvider}
                          disabled={isLocked && Boolean(request?.providerRating?.rating)}
                        />
                      </div>

                      {/* Assigned Service Provider & Schedule Summary */}
                      {(assignedProviderName || request?.scheduledDate) && (
                        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <UserCheck size={14} className="text-slate-500" />
                              <span>Assigned Service Provider &amp; Schedule</span>
                            </span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              Work Logged
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                                Provider
                              </span>
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {assignedProviderName || "LilyCrest Facilities Team"}
                              </span>
                              {assignedProviderCategory && (
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                                  {assignedProviderCategory}
                                </span>
                              )}
                            </div>
                            {assignedProviderContact && (
                              <div>
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                                  Contact
                                </span>
                                <a href={`tel:${assignedProviderContact}`} className="font-semibold text-slate-700 dark:text-slate-300 hover:underline">
                                  {assignedProviderContact}
                                </a>
                              </div>
                            )}
                            {request?.scheduledDate && (
                              <div>
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                                  Visit Date
                                </span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {fmtDateTime(request.scheduledDate)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Before vs After Photo Comparison */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                            1. Resident Reported Media (Before)
                          </span>
                          {initialAttachments.length === 0 ? (
                            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
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

                        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                            2. Technician Resolution Proof (After)
                          </span>
                          {workLogAttachments.length === 0 ? (
                            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                              No resolution proof media logged
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

                      <CostAttributionCard request={request} disabled={isLocked} />
                    </div>
                  )}

                  {/* STAGE 5: COMPLETED (Official Report & Final Records) */}
                  {isCompletedStage && (
                    <div className="space-y-4">
                      {/* Official Completion & Resolution Summary Card */}
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-slate-700 dark:text-slate-300 shrink-0" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                              Official Ticket Resolution Record
                            </h3>
                          </div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Closed &amp; Archived
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3 space-y-1.5">
                            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                              Verification &amp; Resident Rating
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {request?.resolutionConfirmation?.confirmedAt
                                ? "Verified by Resident on Web/Mobile"
                                : "Staff In-Person Verification & Closure"}
                            </span>

                            {request?.resolutionConfirmation?.rating ? (
                              <div className="flex items-center gap-1.5 pt-0.5">
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
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                  {request.resolutionConfirmation.rating} / 5 Stars
                                </span>
                              </div>
                            ) : null}

                            {request?.resolutionConfirmation?.tenantFeedback && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 italic pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                "{request.resolutionConfirmation.tenantFeedback}"
                              </p>
                            )}
                          </div>

                          <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                              Final Closure Date
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {fmtDateTime(request?.resolutionConfirmation?.confirmedAt || request?.updatedAt)}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                              Archived to property maintenance history
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contractor Rating Card (Only when finished) */}
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                        <ProviderRatingCard
                          request={request}
                          isSubmitting={isRatingProvider}
                          onSubmitRating={onRateProvider}
                          disabled={isLocked && Boolean(request?.providerRating?.rating)}
                        />
                      </div>

                      {/* Assigned Service Provider & Schedule Summary */}
                      {(assignedProviderName || request?.scheduledDate) && (
                        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <UserCheck size={14} className="text-slate-500" />
                              <span>Assigned Service Provider &amp; Schedule</span>
                            </span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Completed Work
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                                Provider
                              </span>
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {assignedProviderName || "LilyCrest Facilities Team"}
                              </span>
                              {assignedProviderCategory && (
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                                  {assignedProviderCategory}
                                </span>
                              )}
                            </div>
                            {assignedProviderContact && (
                              <div>
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                                  Contact
                                </span>
                                <a href={`tel:${assignedProviderContact}`} className="font-semibold text-slate-700 dark:text-slate-300 hover:underline">
                                  {assignedProviderContact}
                                </a>
                              </div>
                            )}
                            {request?.scheduledDate && (
                              <div>
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                                  Visit Date
                                </span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {fmtDateTime(request.scheduledDate)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Before vs After Photo Comparison */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                            1. Resident Reported Media (Before)
                          </span>
                          {initialAttachments.length === 0 ? (
                            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
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

                        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                            2. Technician Resolution Proof (After)
                          </span>
                          {workLogAttachments.length === 0 ? (
                            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                              No resolution proof media logged
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

                      <CostAttributionCard request={request} disabled={isLocked} />
                    </div>
                  )}
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
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Two-Way Resident Communication
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
                  />
                </div>
              )}

              {/* ═══════════════════════════════════════════ */}
              {/* TAB 3: PROOF & COMPLETION REPORT            */}
              {/* ═══════════════════════════════════════════ */}
              {activeTab === "proof" && (
                <div className="space-y-4">
                  {/* Proof of Resolution Card */}
                  <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Proof of Work &amp; Resolution Photos
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowProofUploader((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>{showProofUploader ? "Close Upload" : "Add Resolution Photo"}</span>
                      </button>
                    </div>

                    {/* Proof Upload Box */}
                    {showProofUploader && (
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 p-3 space-y-2">
                        <span className="text-[11px] font-bold uppercase text-emerald-900 dark:text-emerald-200 block">
                          Upload Completed Repair Proof
                        </span>
                        <input
                          ref={proofFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleSelectProofFile}
                          className="text-xs"
                        />
                        <input
                          type="text"
                          value={proofNote}
                          onChange={(e) => setProofNote(e.target.value)}
                          placeholder="Resolution notes (e.g. pipe replaced, leak sealed)"
                          className="h-8 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleClearProofFile}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleUploadAndSaveProof}
                            disabled={!proofFile || isUploadingProof}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                          >
                            {isUploadingProof ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                            <span>{isUploadingProof ? "Saving..." : "Save Proof & Mark Resolved"}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {workLogAttachments.length === 0 && !showProofUploader ? (
                      <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 p-4 text-center">
                        <ShieldCheck size={24} className="text-slate-400 mb-1" />
                        <p className="text-xs text-slate-500">No resolution proof uploaded yet.</p>
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

                  {/* Post-Resolution Contractor Rating (Only shown once resolved or completed) */}
                  {(request?.status === "resolved" || request?.status === "completed" || request?.status === "closed") && (
                    <div className="pt-2">
                      <ProviderRatingCard
                        request={request}
                        isSubmitting={isRatingProvider}
                        onSubmitRating={onRateProvider}
                        disabled={isLocked && Boolean(request?.providerRating?.rating)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════ */}
              {/* TAB 4: AUDIT & TIMELINE                     */}
              {/* ═══════════════════════════════════════════ */}
              {activeTab === "timeline" && (
                <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <div className="flex items-center gap-1.5">
                      <History size={16} className="text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
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
                    <div className="h-16 w-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-500 shadow-inner">
                      <FileText size={36} />
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
    </div>
  );
}
