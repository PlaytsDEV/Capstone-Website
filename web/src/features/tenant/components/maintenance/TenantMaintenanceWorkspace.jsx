import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock,
  ClipboardList,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Pencil,
  PhoneCall,
  Plus,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Star,
  Trash2,
  UploadCloud,
  User,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import {
  useCancelMaintenanceRequest,
  useConfirmMaintenanceResolution,
  useCreateMaintenanceRequest,
  useMyMaintenanceRequests,
  useReopenMaintenanceRequest,
  useRequestMaintenanceReschedule,
  useSendTenantMaintenanceReply,
  useUpdateMyMaintenanceRequest,
  useMarkTenantMaintenanceRead,
} from "../../../../shared/hooks/queries/useMaintenance";
import { useAuth } from "../../../../shared/hooks/useAuth";
import Pagination from "../../../../shared/components/Pagination";
import { showNotification } from "../../../../shared/utils/notification";
import {
  ACTIVE_MAINTENANCE_STATUSES,
  MAINTENANCE_REQUEST_TYPES,
  MAX_MAINTENANCE_DESCRIPTION_LENGTH,
  MIN_MAINTENANCE_DESCRIPTION_LENGTH,
  REOPENABLE_MAINTENANCE_STATUSES,
  RESOLVED_MAINTENANCE_STATUSES,
  formatMaintenanceStatus,
  formatMaintenanceType,
  getMaintenanceStatusMeta,
  getMaintenanceStepIndex,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
  validateMaintenanceSlot,
  MAINTENANCE_TIME_SLOTS,
  MAINTENANCE_OPERATING_HOURS,
} from "../../../../shared/utils/maintenanceConfig";
import {
  getMaintenanceAttachmentKind,
  getMaintenanceAttachmentLabel,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentUri,
  isViewableMaintenanceAttachmentUri,
  normalizeMaintenanceAttachments,
} from "../../../../shared/utils/maintenanceAttachments";
import { uploadMaintenanceAttachment, validateFile } from "../../../../shared/utils/firebaseStorageUpload";
import { MaintenanceConversationSection } from "../../../../shared/components/MaintenanceConversationSection";
import { maintenanceApi } from "../../../../shared/api/maintenanceApi";
import "../../styles/tenant-common.css";
import "../../../admin/styles/design-tokens.css";

const EMPTY_FORM_DATA = Object.freeze({
  request_type: "maintenance",
  urgency: "normal",
  description: "",
  attachments: [],
});

const RESOLVED_STATUS_SET = new Set(["resolved", "completed", "closed"]);
const REJECTED_STATUS_SET = new Set(["rejected", "cancelled", "canceled"]);

const STATUS_FILTERS = [
  { key: "active", label: "Active Requests" },
  { key: "resolved", label: "Completed / History" },
  { key: "all", label: "All Requests" },
];

const DETAIL_TABS = [
  { key: "details", label: "Details" },
  { key: "conversation", label: "Conversation" },
  { key: "reopen", label: "Reopen" },
];

const CANONICAL_STEPS = [
  { key: "pending_review", label: "Pending Review" },
  { key: "reviewed",       label: "Under Review"   },
  { key: "in_progress",    label: "In Progress"    },
  { key: "resolved",       label: "Work Done"      },
  { key: "completed",      label: "Completed"      },
];

const URGENCY_OPTIONS = [
  {
    key: "normal",
    label: "Normal Priority",
    eta: "24–48 hrs",
    description: "Standard repair timeline for non-disruptive facility items.",
  },
  {
    key: "urgent",
    label: "Urgent Priority",
    eta: "12–24 hrs",
    description: "Priority triage for essential appliances, power, or leaks.",
  },
  {
    key: "emergency",
    label: "Emergency Priority",
    eta: "Immediate",
    description: "Critical safety hazard, active flooding, or electrical risk.",
  },
];

function getStepIndex(s) {
  const idx = getMaintenanceStepIndex(s);
  return idx >= 0 ? idx : 0;
}

const fmtDate = (value) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const fmtDateTime = (value) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getLocalDateString = (daysOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatSlaLabel = (slaState) => {
  if (!slaState) return "No Target Timeline";
  if (slaState.label === "delayed") return "Delayed";
  if (slaState.label === "priority") return "Priority";
  if (slaState.label === "closed") return "Closed";
  return "On Track";
};

const getStatusIcon = (status) => {
  if (RESOLVED_STATUS_SET.has(status)) return CheckCircle2;
  if (REJECTED_STATUS_SET.has(status)) return X;
  if (["pending", "pending_review", "viewed", "reviewed"].includes(status)) return Clock;
  return RefreshCcw;
};

function MaintenanceStepTracker({
  status,
  isReopened = false,
  reopenCount,
  inspectedStageIndex,
  onSelectStage,
}) {
  const isReopenedRequest = isReopened === true;
  const currentIndex = getStepIndex(status);
  const selectedIdx = typeof inspectedStageIndex === "number" ? inspectedStageIndex : currentIndex;

  return (
    <div className="maintenance-step-tracker" role="tablist" aria-label="Maintenance progress steps">
      {isReopenedRequest ? (
        <div className="step-tracker-reopened-badge">
          <AlertTriangle size={14} />
          <span>Reopened Request (Iteration #{reopenCount || 1}) - Under Active Service</span>
        </div>
      ) : null}
      <div className="step-tracker-track">
        {CANONICAL_STEPS.map((step, idx) => {
          const isCompleted =
            idx < currentIndex ||
            (idx === CANONICAL_STEPS.length - 1 && currentIndex === CANONICAL_STEPS.length - 1);
          const isCurrent =
            idx === currentIndex && currentIndex !== CANONICAL_STEPS.length - 1;
          const isClickable = isCompleted || isCurrent;
          const isInspected = idx === selectedIdx;

          return (
            <button
              type="button"
              key={step.key}
              role="tab"
              disabled={!isClickable}
              aria-disabled={!isClickable}
              aria-selected={isInspected}
              aria-label={`Step ${idx + 1}: ${step.label} (${isCurrent ? "Active" : isCompleted ? "Completed" : "Upcoming (Not yet reached)"})`}
              className={`step-item ${isClickable ? "is-clickable" : "is-disabled"} ${isCompleted ? "completed" : ""} ${isCurrent ? "active" : ""} ${isInspected ? "is-inspected" : ""}`}
              onClick={isClickable ? () => onSelectStage?.(idx) : undefined}
            >
              <div className="step-dot">
                {isCompleted ? <Check size={12} strokeWidth={3} /> : <span>{idx + 1}</span>}
              </div>
              <span className="step-label">{step.label}</span>
              {idx < CANONICAL_STEPS.length - 1 && <div className="step-line" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MaintenanceStageCardWindow({
  request,
  inspectedStageIndex,
  onResetActiveStage,
  onReschedule,
  onConfirmResolution,
  onRejectResolution,
  onViewReport,
  hideActions = false,
}) {
  const isReopenedRequest = request.isReopened === true;
  const currentIndex = getStepIndex(request.status);
  const selectedIdx = typeof inspectedStageIndex === "number" ? inspectedStageIndex : currentIndex;
  const inspectedStep = CANONICAL_STEPS[selectedIdx] || CANONICAL_STEPS[currentIndex] || CANONICAL_STEPS[0];
  const inspectedKey = inspectedStep.key;

  const isInspectingCurrent = selectedIdx === currentIndex;
  const isInspectingCompleted =
    selectedIdx < currentIndex ||
    (selectedIdx === CANONICAL_STEPS.length - 1 && currentIndex === CANONICAL_STEPS.length - 1);
  const isInspectingUpcoming = !isInspectingCurrent && !isInspectingCompleted;

  const statusHistory = Array.isArray(request.statusHistory) ? request.statusHistory : [];
  const urgencyMeta = getMaintenanceUrgencyMeta(request.urgency || "normal");
  const providerLabel =
    request.tenantVisibleProviderLabel ||
    request.providerDetails?.tenantVisibleLabel ||
    request.providerDetails?.providerName ||
    "";
  const scheduledDate = request.schedule?.scheduledDate;
  const hasReport = Boolean(request.completionReport && !request.completionReport.isDraft);
  const isConfirmed = Boolean(
    request.resolutionConfirmation?.confirmedAt &&
      request.resolutionConfirmation?.action !== "rejected_back_to_in_progress" &&
      ["completed", "closed"].includes(request.status)
  );

  let milestoneTime = "";
  let milestoneActor = "";
  let milestoneSummary = "";
  let milestoneNext = "";
  let milestoneFact = "";

  if (inspectedKey === "pending_review") {
    milestoneTime = request.created_at ? fmtDateTime(request.created_at) : "Date pending";
    milestoneActor = "Submitted by Tenant";
    milestoneFact = `${urgencyMeta.label} Priority (Turnaround: ${urgencyMeta.estimate || "24–48 hrs"})`;
    milestoneSummary = "Ticket received and placed into the facilities triage queue.";
    milestoneNext = "Facilities team will review ticket details and assess service requirements.";
  } else if (inspectedKey === "reviewed") {
    const reviewedEntry = statusHistory.find((h) => h.status === "reviewed" || h.status === "under_review");
    milestoneTime = reviewedEntry?.timestamp
      ? fmtDateTime(reviewedEntry.timestamp)
      : currentIndex >= 1
        ? fmtDateTime(request.updated_at)
        : "Awaiting triage";
    milestoneActor = reviewedEntry?.actor_name || "Facilities Management Team";
    milestoneFact = `Category: ${formatMaintenanceType(request.request_type)}`;
    milestoneSummary = request.notes
      ? `Admin Note: "${request.notes}"`
      : `Assessed for ${formatMaintenanceType(request.request_type)} with ${urgencyMeta.label}.`;
    milestoneNext = "Coordinating technician schedule and assigning service specialist.";
  } else if (inspectedKey === "in_progress") {
    const inProgressEntry = statusHistory.find((h) => h.status === "in_progress");
    milestoneTime = scheduledDate
      ? fmtDateTime(scheduledDate)
      : inProgressEntry?.timestamp
        ? fmtDateTime(inProgressEntry.timestamp)
        : currentIndex >= 2
          ? fmtDateTime(request.updated_at)
          : "Awaiting assignment";
    milestoneActor = providerLabel || "Authorized Service Specialist";
    milestoneFact = scheduledDate
      ? `${urgencyMeta.label} Priority • On-site Service`
      : providerLabel
        ? `${urgencyMeta.label} Priority • Specialist Assigned`
        : "Technician Assignment In Progress";
    milestoneSummary = request.schedule?.notes
      ? `Schedule Notes: ${request.schedule.notes}`
      : providerLabel
        ? `${providerLabel} has been assigned to handle this repair.`
        : "Facilities staff is assigning an authorized service technician.";
    milestoneNext = "Technician will conduct on-site inspection and perform required repairs.";
  } else if (inspectedKey === "resolved") {
    const resolvedEntry = statusHistory.find((h) => h.status === "resolved");
    milestoneTime = request.resolved_at
      ? fmtDateTime(request.resolved_at)
      : resolvedEntry?.timestamp
        ? fmtDateTime(resolvedEntry.timestamp)
        : currentIndex >= 3
          ? fmtDateTime(request.updated_at)
          : "Pending work completion";
    milestoneActor = request.completionReport?.finalizedByName || providerLabel || "Service Specialist";
    milestoneFact = hasReport
      ? "Official Report Filed"
      : currentIndex >= 3
        ? "Repairs Finished On-Site"
        : "Pending Inspection";
    milestoneSummary =
      request.completionReport?.workDone ||
      request.completionReport?.summary ||
      "Technician has concluded maintenance work on-site.";
    milestoneNext = isConfirmed
      ? "Work inspected and approved by tenant."
      : "Please inspect your room and confirm resolution or report remaining issues.";
  } else if (inspectedKey === "completed") {
    milestoneTime = request.resolutionConfirmation?.confirmedAt
      ? fmtDateTime(request.resolutionConfirmation.confirmedAt)
      : request.resolved_at
        ? fmtDateTime(request.resolved_at)
        : currentIndex >= 4
          ? fmtDateTime(request.updated_at)
          : "Pending ticket closure";
    milestoneActor = isConfirmed
      ? "Confirmed by Tenant"
      : currentIndex >= 4
        ? "Facilities Management"
        : "Pending Closure";
    milestoneFact = request.resolutionConfirmation?.rating
      ? `Rating: ${request.resolutionConfirmation.rating} / 5 Stars`
      : currentIndex >= 4
        ? "Ticket Closed"
        : "Archived After Confirmation";
    milestoneSummary = request.resolutionConfirmation?.tenantFeedback
      ? `Tenant Feedback: "${request.resolutionConfirmation.tenantFeedback}"`
      : "Maintenance ticket completed and verified in dormitory records.";
    milestoneNext = "Ticket archived in history. You can reopen this request if any issues reoccur.";
  }

  let statusBadgeClass = "status-upcoming";
  let statusBadgeLabel = "Upcoming Stage";
  if (isInspectingCurrent) {
    statusBadgeClass = "status-current";
    statusBadgeLabel = "Current Active Stage";
  } else if (isInspectingCompleted) {
    statusBadgeClass = "status-completed";
    statusBadgeLabel = "Completed";
  }

  return (
    <div className="maintenance-stage-window" role="region" aria-label={`Stage ${selectedIdx + 1} details`}>
      <div className="stage-window-header">
        <div className="stage-window-header__title">
          <h4>
            <Wrench size={14} style={{ color: "var(--color-primary, #2563EB)" }} />
            <span>Step {selectedIdx + 1}: {inspectedStep.label}</span>
          </h4>
          <span className={`stage-status-badge ${statusBadgeClass}`}>
            <span className="badge-dot" />
            <span>{statusBadgeLabel}</span>
          </span>
        </div>

        {!isInspectingCurrent ? (
          <button
            type="button"
            className="stage-reset-btn"
            onClick={onResetActiveStage}
            title="Return to the active stage"
          >
            <RefreshCcw size={12} />
            <span>Back to Active Stage (Step {currentIndex + 1})</span>
          </button>
        ) : null}
      </div>

      <div className="stage-milestone-grid">
        <div className="stage-milestone-card">
          <span className="stage-milestone-card__label">
            <Clock size={12} />
            <span>{inspectedKey === "in_progress" && scheduledDate ? "Scheduled For" : "Milestone Time"}</span>
          </span>
          <span className="stage-milestone-card__value">{milestoneTime}</span>
        </div>

        <div className="stage-milestone-card">
          <span className="stage-milestone-card__label">
            <User size={12} />
            <span>Key Contact / Actor</span>
          </span>
          <span className="stage-milestone-card__value">{milestoneActor}</span>
        </div>

        <div className="stage-milestone-card">
          <span className="stage-milestone-card__label">
            <Zap size={12} />
            <span>Key Details</span>
          </span>
          <span className="stage-milestone-card__value">{milestoneFact}</span>
        </div>
      </div>

      <div className="stage-summary-box">
        <div className="stage-summary-box__header">
          <ClipboardList size={12} />
          <span>Stage Overview &amp; Next Expected Action</span>
        </div>
        <p className="stage-summary-box__text">{milestoneSummary}</p>
        <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground, #64748B)", borderTop: "1px solid var(--border, #E2E8F0)", paddingTop: 6, marginTop: 2 }}>
          <strong>Next:</strong> {milestoneNext}
        </div>
      </div>

      {/* Stage Actions - Rendered when no active reschedule status banner is shown */}
      {inspectedKey === "in_progress" &&
      isInspectingCurrent &&
      !request.rescheduleRequest?.status &&
      !["resolved", "completed", "closed", "cancelled"].includes(request.status) &&
      !hideActions ? (
        <div className="stage-actions-bar">
          <button
            type="button"
            onClick={onReschedule}
            className="btn btn-secondary maintenance-reschedule-btn"
            style={{ fontSize: "0.8rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Calendar size={13} /> {scheduledDate ? "Request Reschedule" : "Request Preferred Schedule"}
          </button>
        </div>
      ) : null}

      {/* Standby Reschedule Details (Pending Staff Approval) */}
      {inspectedKey === "in_progress" && request.rescheduleRequest?.status === "pending" ? (
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--foreground)",
            background: "var(--surface-input)",
            border: "1px solid var(--border)",
            padding: "10px 12px",
            borderRadius: 8,
            marginTop: 4,
          }}
          className="space-y-1.5"
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 700, flexWrap: "wrap", gap: 6 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--foreground)" }}>
              <Clock size={14} style={{ color: "#D97706" }} /> Reschedule Request: Pending Approval
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#D97706",
                border: "1px solid var(--border)",
                background: "transparent",
                padding: "2px 8px",
                borderRadius: 9999,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D97706", display: "inline-block" }} />
              <span>Awaiting Staff Review</span>
            </span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", marginTop: 4 }}>
            <strong style={{ color: "var(--foreground)" }}>Your Requested Time:</strong> {fmtDateTime(request.rescheduleRequest.proposedDate)}
            {request.rescheduleRequest.reason ? ` — "${request.rescheduleRequest.reason}"` : ""}
          </div>
          <p style={{ fontSize: "0.74rem", color: "var(--muted-foreground)", margin: "4px 0" }}>
            Dormitory facilities staff is currently reviewing technician availability for this request.
          </p>
          <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 6 }}>
            <strong style={{ color: "var(--foreground)" }}>Current Active Appointment:</strong> {scheduledDate ? fmtDateTime(scheduledDate) : "Pending"}{" "}
            <em>(Remains in place until approved or updated)</em>
          </div>
        </div>
      ) : null}

      {/* Accepted Reschedule Notice */}
      {inspectedKey === "in_progress" && request.rescheduleRequest?.status === "accepted" ? (
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--foreground)",
            background: "var(--surface-input)",
            border: "1px solid var(--border)",
            padding: "10px 12px",
            borderRadius: 8,
            marginTop: 4,
          }}
        >
          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--foreground)" }}>
              <Check size={14} style={{ color: "#059669" }} /> Reschedule Request: Approved
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#059669",
                border: "1px solid var(--border)",
                background: "transparent",
                padding: "2px 8px",
                borderRadius: 9999,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
              <span>Confirmed</span>
            </span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", marginTop: 4 }}>
            Your requested schedule was approved by dormitory facilities staff.
          </div>
          <div
            style={{
              fontSize: "0.76rem",
              fontWeight: 600,
              color: "var(--foreground)",
              marginTop: 6,
              borderTop: "1px solid var(--border)",
              paddingTop: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <span>
              Confirmed Visit Date: <strong>{scheduledDate ? fmtDateTime(scheduledDate) : "Confirmed"}</strong>
            </span>
            {isInspectingCurrent && !["resolved", "completed", "closed", "cancelled"].includes(request.status) && !hideActions ? (
              <button
                type="button"
                onClick={onReschedule}
                className="btn btn-secondary"
                style={{ fontSize: "0.74rem", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Calendar size={12} /> {scheduledDate ? "Request Reschedule" : "Request Preferred Schedule"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Declined Reschedule Notice (Original Schedule Maintained) */}
      {inspectedKey === "in_progress" && request.rescheduleRequest?.status === "declined" ? (
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--foreground)",
            background: "var(--surface-input)",
            border: "1px solid var(--border)",
            padding: "10px 12px",
            borderRadius: 8,
            marginTop: 4,
          }}
        >
          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--foreground)" }}>
              <AlertTriangle size={14} style={{ color: "#E11D48" }} /> Reschedule Request: Not Approved / Declined
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#E11D48",
                border: "1px solid var(--border)",
                background: "transparent",
                padding: "2px 8px",
                borderRadius: 9999,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E11D48", display: "inline-block" }} />
              <span>Original Schedule Maintained</span>
            </span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", marginTop: 4 }}>
            <strong style={{ color: "var(--foreground)" }}>Staff Reason:</strong>{" "}
            {request.rescheduleRequest.responseNote
              ? `"${request.rescheduleRequest.responseNote}"`
              : "The requested time could not be accommodated at this time."}
          </div>
          <div
            style={{
              fontSize: "0.76rem",
              fontWeight: 600,
              color: "var(--foreground)",
              marginTop: 6,
              borderTop: "1px solid var(--border)",
              paddingTop: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <span>
              Original Visit Schedule: <strong>{scheduledDate ? fmtDateTime(scheduledDate) : "the original date"}</strong>
            </span>
            {isInspectingCurrent && !["resolved", "completed", "closed", "cancelled"].includes(request.status) && !hideActions ? (
              <button
                type="button"
                onClick={onReschedule}
                className="btn btn-secondary"
                style={{ fontSize: "0.74rem", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Calendar size={12} /> {scheduledDate ? "Request Reschedule" : "Request Preferred Schedule"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Adjusted Alternate Schedule Proposed by Staff */}
      {inspectedKey === "in_progress" && request.rescheduleRequest?.status === "adjusted" ? (
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--foreground)",
            background: "var(--surface-input)",
            border: "1px solid var(--border)",
            padding: "10px 12px",
            borderRadius: 8,
            marginTop: 4,
          }}
        >
          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--foreground)" }}>
              <Check size={14} style={{ color: "#059669" }} /> Alternate Schedule Set by Staff
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#059669",
                border: "1px solid var(--border)",
                background: "transparent",
                padding: "2px 8px",
                borderRadius: 9999,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
              <span>Adjusted</span>
            </span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", marginTop: 4 }}>
            {request.rescheduleRequest.responseNote
              ? `Staff Note: "${request.rescheduleRequest.responseNote}"`
              : "Dormitory staff has set an alternate repair visit time."}
          </div>
          <div
            style={{
              fontSize: "0.76rem",
              fontWeight: 600,
              color: "var(--foreground)",
              marginTop: 6,
              borderTop: "1px solid var(--border)",
              paddingTop: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <span>
              New Appointment: <strong>{scheduledDate ? fmtDateTime(scheduledDate) : "Confirmed"}</strong>
            </span>
            {isInspectingCurrent && !["resolved", "completed", "closed", "cancelled"].includes(request.status) && !hideActions ? (
              <button
                type="button"
                onClick={onReschedule}
                className="btn btn-secondary"
                style={{ fontSize: "0.74rem", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Calendar size={12} /> {scheduledDate ? "Request Reschedule" : "Request Preferred Schedule"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {inspectedKey === "resolved" && request.status === "resolved" && !isConfirmed && !hideActions ? (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--foreground)",
              background: "var(--surface-input)",
              border: "1px solid var(--border)",
              padding: "10px 12px",
              borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 700, flexWrap: "wrap", gap: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--foreground)" }}>
                <Clock size={14} style={{ color: "#D97706" }} /> 7-Day Inspection &amp; Verification Window
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "#D97706",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  padding: "2px 8px",
                  borderRadius: 9999,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D97706", display: "inline-block" }} />
                <span>Action Required</span>
              </span>
            </div>
            <p style={{ fontSize: "0.76rem", color: "var(--muted-foreground)", margin: "6px 0 0 0", lineHeight: 1.4 }}>
              Please inspect the completed repair in your room and submit your feedback/rating. This request will automatically finalize in <strong>7 days</strong> if no issues are reported.
            </p>
            {getResolutionProofAttachments(request).length ? (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem", color: "var(--foreground)" }}>
                <ShieldCheck size={14} style={{ color: "#16A34A", flexShrink: 0 }} />
                <span>
                  <strong>{getResolutionProofAttachments(request).length}</strong> repair proof photo{getResolutionProofAttachments(request).length === 1 ? "" : "s"} attached below for your inspection.
                </span>
              </div>
            ) : null}
          </div>

          <div className="stage-actions-bar" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="btn-success"
              style={{ fontSize: "0.8rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
              onClick={onConfirmResolution}
            >
              <Check size={13} /> Confirm Resolution &amp; Rate
            </button>
            <button
              type="button"
              className="btn-outline-danger"
              style={{ fontSize: "0.8rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
              onClick={onRejectResolution}
            >
              <AlertTriangle size={13} /> Report Issue Not Fixed
            </button>
          </div>
        </div>
      ) : null}

      {(inspectedKey === "completed" || inspectedKey === "resolved") && hasReport && !hideActions ? (
        <div className="stage-actions-bar" style={{ justifyContent: "space-between", marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#166534", fontSize: "0.8rem", fontWeight: 600 }}>
            <FileCheck size={14} color="#16A34A" />
            <span>Official Completion Report Available</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.78rem", padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}
            onClick={onViewReport}
          >
            <FileText size={12} /> View Official Report
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CompletionReportModal({ request, onClose }) {
  const report = request.completionReport || {};
  const occupancy = request.occupancyContext || {};
  const roomLabel = occupancy.unitNumber
    ? `Unit ${occupancy.unitNumber}${occupancy.bedNumber ? ` - Bed ${occupancy.bedNumber}` : ""}${occupancy.floor ? ` (Floor ${occupancy.floor})` : ""}`
    : request.roomName || "Assigned Room";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="maintenance-modal-backdrop" onClick={onClose}>
      <div className="completion-report-modal printable-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header no-print">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileCheck size={18} color="#059669" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Official Maintenance Completion Report</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 13, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={handlePrint}
            >
              <Printer size={14} /> Print / Save PDF
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: 6, display: "grid", placeItems: "center" }}
              onClick={onClose}
              aria-label="Close Report"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="report-sheet">
          <div className="report-sheet-header">
            <div className="report-brand">
              <span className="brand-name">LilyCrest Residences</span>
              <span className="brand-sub">Facilities & Dormitory Maintenance Management</span>
            </div>
            <div className="report-id-box">
              <span className="id-label">TICKET NUMBER</span>
              <strong className="id-value">{request.ticketNumber || request.request_id || "MNT-2026-####"}</strong>
            </div>
          </div>

          <div className="report-meta-grid">
            <div>
              <span className="meta-label">Location / Room</span>
              <strong className="meta-value">{roomLabel}</strong>
            </div>
            <div>
              <span className="meta-label">Service Category</span>
              <strong className="meta-value">{formatMaintenanceType(request.request_type)}</strong>
            </div>
            <div>
              <span className="meta-label">Assigned Technician</span>
              <strong className="meta-value">
                {request.tenantVisibleProviderLabel || request.providerDetails?.tenantVisibleLabel || "LilyCrest Facilities Team"}
              </strong>
            </div>
            <div>
              <span className="meta-label">Completion Date</span>
              <strong className="meta-value">{fmtDateTime(report.finalizedAt || request.resolved_at || new Date())}</strong>
            </div>
          </div>

          <div className="report-body-section">
            <h4>1. Issue Summary</h4>
            <p>{report.summary || request.description || "Maintenance request completed and verified."}</p>
          </div>

          {report.workDone ? (
            <div className="report-body-section">
              <h4>2. Technical Work Performed</h4>
              <p>{report.workDone}</p>
            </div>
          ) : null}

          {report.partsReplaced && report.partsReplaced !== "None" ? (
            <div className="report-body-section">
              <h4>3. Parts & Materials Replaced</h4>
              <p>{report.partsReplaced}</p>
            </div>
          ) : null}

          {report.preventiveAdvice ? (
            <div className="report-body-section">
              <h4>4. Tenant Preventive Care Advice</h4>
              <p>{report.preventiveAdvice}</p>
            </div>
          ) : null}

          <div className="report-sign-footer">
            <div className="sign-block">
              <div className="sign-line" />
              <span className="sign-name">{report.finalizedByName || "Operations & Facilities Supervisor"}</span>
              <span className="sign-title">Authorized Facilities Signature</span>
            </div>
            <div className="verified-stamp">
              <span>✓ VERIFIED & SIGNED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const getAttachmentKey = (attachment, index = 0) =>
  attachment?.clientId ||
  getMaintenanceAttachmentUri(attachment) ||
  `${attachment?.name || "attachment"}-${index}`;

const buildUploadedAttachment = (file, uploadResult = {}) => {
  const uri = uploadResult.downloadUrl || uploadResult.url || uploadResult.uri;
  const uploadedAttachment = uploadResult.attachment || {};
  const type =
    uploadedAttachment.type ||
    uploadResult.type ||
    uploadedAttachment.mimeType ||
    uploadResult.mimeType ||
    file.type ||
    "application/octet-stream";

  return {
    ...uploadedAttachment,
    name: file.name,
    uri,
    url: uri,
    downloadUrl: uri,
    type,
    mimeType: uploadedAttachment.mimeType || uploadResult.mimeType || type,
    size: uploadResult.size ?? file.size,
    storagePath: uploadResult.storagePath,
  };
};

const filterValidFiles = (files) => {
  const validFiles = [];
  const rejected = [];

  files.forEach((file) => {
    const check = validateFile(file);
    if (check.valid) {
      validFiles.push(file);
    } else {
      rejected.push({ file, error: check.error });
    }
  });

  rejected.forEach(({ file, error }) => {
    showNotification(error || `"${file.name}" cannot be uploaded.`, "error");
  });

  return validFiles;
};

const getTenantVisibleAttachments = (attachments = []) =>
  Array.isArray(attachments)
    ? attachments.filter((attachment) => !attachment?.isRemoved)
    : [];

const getResolutionProofAttachments = (request) => {
  if (!request) return [];
  const proofObj = request.resolutionProof || request.resolution_proof;
  const directProofAtts = Array.isArray(proofObj?.attachments)
    ? proofObj.attachments
    : Array.isArray(request.proofAttachments || request.proof_attachments)
      ? (request.proofAttachments || request.proof_attachments)
      : [];

  const workLogAtts = (Array.isArray(request.workLog || request.work_log) ? (request.workLog || request.work_log) : [])
    .flatMap((entry) => (Array.isArray(entry?.attachments) ? entry.attachments : []));

  const combined = [...directProofAtts, ...workLogAtts];
  const seen = new Set();
  return combined.filter((att) => {
    if (!att || att?.isRemoved) return false;
    if (att?.removedScope === "tenant_only" || att?.removedScope === "request") return false;
    if (att?.visibility === "admin_only") return false;
    const uri = getMaintenanceAttachmentUri(att) || att.url || att.uri;
    if (!uri) return false;
    if (seen.has(uri)) return false;
    seen.add(uri);
    return true;
  });
};

const getLatestTenantReply = (request) => {
  const conversation = Array.isArray(request?.conversation) ? request.conversation : [];
  return conversation.length ? conversation[conversation.length - 1] : null;
};

const getReplySummary = (entry) => {
  if (!entry) return "";
  const message = typeof entry.message === "string" ? entry.message.trim() : "";
  if (message) return message;
  const attachmentCount = Array.isArray(entry.attachments) ? entry.attachments.length : 0;
  if (attachmentCount > 0) {
    return `Admin sent ${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}.`;
  }
  return "Admin sent a reply.";
};

function AttachmentLink({ attachment, index, onPreview }) {
  if (attachment?.isRemoved) return null;

  const kind = getMaintenanceAttachmentKind(attachment);
  const label = getMaintenanceAttachmentLabel(attachment);
  const name = getMaintenanceAttachmentName(attachment, index);
  const uri = getMaintenanceAttachmentUri(attachment);
  const isViewable = isViewableMaintenanceAttachmentUri(uri);
  const Icon = kind === "image" ? ImageIcon : kind === "pdf" ? FileText : Paperclip;

  if (!uri) return null;

  if (kind === "image" && isViewable) {
    return (
      <div className="maintenance-photo-card">
        <button
          type="button"
          className="photo-thumb-btn"
          onClick={() => onPreview?.({ uri, name })}
          title={`Preview ${name}`}
        >
          <img
            src={uri}
            alt={name}
            loading="lazy"
          />
          <div className="photo-thumb-overlay">
            <Eye size={16} />
            <span>Preview</span>
          </div>
        </button>
        <div className="photo-meta">
          <span className="photo-name" title={name}>
            {name}
          </span>
          <div className="photo-actions">
            <button
              type="button"
              className="photo-action-btn"
              onClick={() => onPreview?.({ uri, name })}
            >
              Preview
            </button>
            <span className="action-sep">•</span>
            <a
              href={uri}
              target="_blank"
              rel="noopener noreferrer"
              className="photo-action-link"
            >
              Open
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="maintenance-file-card">
      <div className={`file-icon-badge ${kind === "pdf" ? "is-pdf" : "is-doc"}`}>
        <Icon size={18} />
      </div>
      <div className="file-info">
        <span className="file-name" title={name}>{name}</span>
        <span className="file-kind">{label}</span>
      </div>
      <div className="file-actions">
        <a
          href={uri}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary file-open-btn"
          title="Open attachment in new tab"
        >
          <ExternalLink size={12} />
          <span>Open</span>
        </a>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  danger,
  isProcessing = false,
  onConfirm,
  onCancel,
  maxWidth = 380,
  children,
}) {
  const getConfirmButtonClass = () => {
    if (danger || confirmVariant === "danger") return "btn btn-danger";
    if (confirmVariant === "success") return "btn btn-success";
    return "btn btn-primary";
  };

  return (
    <div
      className="maintenance-modal-backdrop"
      onClick={!isProcessing ? onCancel : undefined}
      style={{ zIndex: 10000 }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "var(--card)",
          borderRadius: 12,
          padding: "18px 20px",
          maxWidth,
          width: "90%",
          boxShadow: "0 20px 48px rgba(0, 0, 0, 0.16)",
          border: "1px solid var(--border)",
        }}
      >
        <h3 style={{ margin: "0 0 6px", fontSize: 15.5, color: "var(--foreground)", fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h3>
        {message ? (
          <p style={{ margin: "0 0 14px", color: "var(--muted-foreground)", fontSize: 13.5, lineHeight: 1.5 }}>
            {message}
          </p>
        ) : null}
        {children}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: children ? 16 : 0 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isProcessing}
            style={{ padding: "5px 13px", fontSize: 12, minHeight: 30, borderRadius: 8 }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={getConfirmButtonClass()}
            onClick={onConfirm}
            disabled={isProcessing}
            style={{ padding: "5px 14px", fontSize: 12, minHeight: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            {isProcessing ? <LoaderCircle size={13} className="admin-announcements-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TenantMaintenanceWorkspace({ embedded = false }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedRequestId = searchParams.get("requestId");
  const [showModal, setShowModal] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(requestedRequestId || null);
  const [detailTab, setDetailTab] = useState("details");
  const [viewedTabs, setViewedTabs] = useState(() => new Set(["details"]));
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [viewingReportRequest, setViewingReportRequest] = useState(null);
  const [reopenNote, setReopenNote] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [uploadingReplyAttachment, setUploadingReplyAttachment] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM_DATA });
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingCancelRequest, setPendingCancelRequest] = useState(null);
  const [pendingDiscardModal, setPendingDiscardModal] = useState(false);
  const [pendingSubmitConfirmation, setPendingSubmitConfirmation] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedCardIds, setExpandedCardIds] = useState(() => {
    const initial = new Set();
    if (requestedRequestId) initial.add(requestedRequestId);
    return initial;
  });
  const [collapsedCardIds, setCollapsedCardIds] = useState(() => new Set());
  const [rescheduleModalRequest, setRescheduleModalRequest] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rejectResolutionModalRequest, setRejectResolutionModalRequest] = useState(null);
  const [rejectionFeedback, setRejectionFeedback] = useState("");
  const [verifyModalRequest, setVerifyModalRequest] = useState(null);
  const [verifyRating, setVerifyRating] = useState(5);
  const [verifyHoverRating, setVerifyHoverRating] = useState(0);
  const [verifyFeedback, setVerifyFeedback] = useState("");

  const fileInputRef = useRef(null);

  const { data, isLoading } = useMyMaintenanceRequests({ limit: 50 });
  const createMutation = useCreateMaintenanceRequest();
  const updateMutation = useUpdateMyMaintenanceRequest();
  const cancelMutation = useCancelMaintenanceRequest();
  const reopenMutation = useReopenMaintenanceRequest();
  const confirmResolutionMutation = useConfirmMaintenanceResolution();
  const requestRescheduleMutation = useRequestMaintenanceReschedule();
  const sendReplyMutation = useSendTenantMaintenanceReply();
  const markTenantReadMutation = useMarkTenantMaintenanceRead();

  useEffect(() => {
    if (requestedRequestId) {
      setExpandedCardIds((prev) => new Set(prev).add(requestedRequestId));
      setSelectedRequestId(requestedRequestId);
    }
  }, [requestedRequestId]);

  const requests = data?.requests || [];
  const [localRequestOverride, setLocalRequestOverride] = useState(null);

  useEffect(() => {
    setLocalRequestOverride(null);
  }, [selectedRequestId]);

  const baseSelectedRequest = useMemo(
    () =>
      requests.find(
        (request) =>
          request.request_id === selectedRequestId ||
          String(request._id) === String(selectedRequestId) ||
          (request.ticketNumber && String(request.ticketNumber) === String(selectedRequestId)),
      ) || null,
    [requests, selectedRequestId],
  );

  const selectedRequest = useMemo(() => {
    if (!baseSelectedRequest && !localRequestOverride) return null;
    const baseId = String(baseSelectedRequest?.request_id || baseSelectedRequest?._id || "");
    const overrideId = String(localRequestOverride?.request_id || localRequestOverride?._id || "");
    if (localRequestOverride && (!overrideId || !baseId || overrideId === baseId)) {
      return {
        ...(baseSelectedRequest || {}),
        ...localRequestOverride,
      };
    }
    return baseSelectedRequest;
  }, [baseSelectedRequest, localRequestOverride]);

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

  const getUnreadConvCount = (request, isTabActive = false) => {
    if (!request || !Array.isArray(request.conversation) || request.conversation.length === 0) {
      return 0;
    }
    if (isTabActive) {
      return 0;
    }
    const key = `lilycrest_seen_conv_${request.request_id || request._id}_tenant`;
    const rawSeen = seenConvMap[key] || localStorage.getItem(key);
    const seenTime = rawSeen ? new Date(rawSeen).getTime() : 0;

    const unread = request.conversation.filter((msg) => {
      // Messages sent by the tenant themselves are not unread to the tenant
      if (msg.sender_side === "tenant") return false;
      const msgTime = new Date(msg.created_at).getTime();
      return msgTime > seenTime;
    });

    return unread.length;
  };

  const markConversationSeen = useCallback((requestId) => {
    if (!requestId) return;
    const key = `lilycrest_seen_conv_${requestId}_tenant`;
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(key, nowIso);
    } catch {}
    setSeenConvMap((prev) => ({ ...prev, [key]: nowIso }));
  }, []);

  const handleDetailTabChange = useCallback((nextTab) => {
    setDetailTab(nextTab);
    setViewedTabs((prev) => {
      const next = new Set(prev);
      next.add(nextTab);
      return next;
    });
    if (nextTab === "conversation" && selectedRequest?.request_id) {
      markConversationSeen(selectedRequest.request_id);
    }
  }, [selectedRequest?.request_id, markConversationSeen]);

  useEffect(() => {
    setViewedTabs(new Set(["details"]));
  }, [selectedRequestId]);

  useEffect(() => {
    if (detailTab) {
      setViewedTabs((prev) => {
        if (prev.has(detailTab)) return prev;
        const next = new Set(prev);
        next.add(detailTab);
        return next;
      });
    }
  }, [detailTab]);

  const [adminIsTyping, setAdminIsTyping] = useState(false);
  const [adminTypingName, setAdminTypingName] = useState("");
  const adminTypingTimerRef = useRef(null);

  useEffect(() => {
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
          String(id) === String(selectedRequestId) ||
          String(id) === String(selectedRequest?._id) ||
          String(id) === String(selectedRequest?.request_id) ||
          String(id) === String(selectedRequest?.ticketNumber),
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
        if (detailTab === "conversation") {
          markConversationSeen(selectedRequestId);
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
          String(id) === String(selectedRequestId) ||
          String(id) === String(selectedRequest?._id) ||
          String(id) === String(selectedRequest?.request_id) ||
          String(id) === String(selectedRequest?.ticketNumber),
      );

      if (match && (detail.senderSide === "admin" || detail.senderSide === "staff")) {
        setAdminIsTyping(Boolean(detail.isTyping));
        setAdminTypingName(detail.senderName || "Dormitory Admin");

        if (adminTypingTimerRef.current) clearTimeout(adminTypingTimerRef.current);
        if (detail.isTyping) {
          adminTypingTimerRef.current = setTimeout(() => {
            setAdminIsTyping(false);
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
      if (adminTypingTimerRef.current) clearTimeout(adminTypingTimerRef.current);
    };
  }, [selectedRequestId, selectedRequest?._id, selectedRequest?.request_id, selectedRequest?.ticketNumber, detailTab, markConversationSeen]);

  const handleTenantTypingChange = (isTyping) => {
    if (!selectedRequestId) return;
    maintenanceApi.sendTenantTyping(selectedRequestId, isTyping).catch(() => {});
  };

  useEffect(() => {
    if (selectedRequestId && detailTab === "conversation") {
      markConversationSeen(selectedRequestId);
    }
  }, [selectedRequestId, detailTab, selectedRequest?.conversation?.length]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") return requests;
    if (statusFilter === "active") {
      return requests.filter((request) => ACTIVE_MAINTENANCE_STATUSES.includes(request.status));
    }
    return requests.filter(
      (request) =>
        RESOLVED_MAINTENANCE_STATUSES.includes(request.status) ||
        RESOLVED_STATUS_SET.has(request.status) ||
        REJECTED_STATUS_SET.has(request.status),
    );
  }, [requests, statusFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const totalItems = filteredRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage) || 1);
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const isCardExpanded = (request) => {
    const id = request.request_id || request._id;
    if (collapsedCardIds.has(id)) return false;
    if (expandedCardIds.has(id)) return true;
    return ACTIVE_MAINTENANCE_STATUSES.includes(request.status);
  };

  const toggleCardExpanded = (request) => {
    const id = request.request_id || request._id;
    const currentlyExpanded = isCardExpanded(request);
    if (currentlyExpanded) {
      setCollapsedCardIds((prev) => new Set(prev).add(id));
      setExpandedCardIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      setExpandedCardIds((prev) => new Set(prev).add(id));
      setCollapsedCardIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (request.isUpdatedForTenant) {
        markTenantReadMutation.mutate(id);
      }
    }
  };

  const areAllFilteredExpanded = useMemo(() => {
    if (!paginatedRequests.length) return false;
    return paginatedRequests.every((r) => isCardExpanded(r));
  }, [paginatedRequests, expandedCardIds, collapsedCardIds]);

  const handleExpandAll = () => {
    const allIds = new Set(paginatedRequests.map((r) => r.request_id || r._id));
    setExpandedCardIds(allIds);
    setCollapsedCardIds(new Set());
  };

  const handleCollapseAll = () => {
    const allIds = new Set(paginatedRequests.map((r) => r.request_id || r._id));
    setCollapsedCardIds(allIds);
    setExpandedCardIds(new Set());
  };

  const [inspectedStageMap, setInspectedStageMap] = useState({});
  const [modalInspectedStageIndex, setModalInspectedStageIndex] = useState(null);

  const getInspectedStageIndex = (request) => {
    const id = request.request_id || request._id;
    const activeIdx = getStepIndex(request.status);
    if (typeof inspectedStageMap[id] === "number") {
      const savedIdx = inspectedStageMap[id];
      if (savedIdx <= activeIdx) {
        return savedIdx;
      }
    }
    return activeIdx;
  };

  const handleSelectStage = (request, stageIdx) => {
    const activeIdx = getStepIndex(request.status);
    if (stageIdx > activeIdx) return;
    const id = request.request_id || request._id;
    setInspectedStageMap((prev) => ({ ...prev, [id]: stageIdx }));
  };

  const handleResetActiveStage = (request) => {
    const id = request.request_id || request._id;
    const activeIdx = getStepIndex(request.status);
    setInspectedStageMap((prev) => ({ ...prev, [id]: activeIdx }));
  };

  useEffect(() => {
    setReplyMessage("");
    setReplyAttachments([]);
    setDetailTab("details");
    setModalInspectedStageIndex(null);
  }, [selectedRequestId]);

  const isEditing = Boolean(editingRequestId);
  const isSavingForm = createMutation.isPending || updateMutation.isPending || uploadingAttachment;
  const descriptionLength = formData.description.trim().length;
  const descriptionTooShort =
    descriptionLength > 0 &&
    descriptionLength < MIN_MAINTENANCE_DESCRIPTION_LENGTH;
  const attachmentCount = formData.attachments?.length || 0;
  const hasRequiredAttachment = attachmentCount >= 1;

  const isFormDirty = useMemo(() => {
    if (!showModal) return false;
    return (
      formData.description.trim().length > 0 ||
      (formData.attachments && formData.attachments.length > 0) ||
      formData.request_type !== "maintenance" ||
      formData.urgency !== "normal"
    );
  }, [showModal, formData]);

  const summary = useMemo(
    () => ({
      total: requests.length,
      active: requests.filter((request) =>
        ACTIVE_MAINTENANCE_STATUSES.includes(request.status),
      ).length,
      resolved: requests.filter(
        (request) =>
          RESOLVED_MAINTENANCE_STATUSES.includes(request.status) ||
          RESOLVED_STATUS_SET.has(request.status) ||
          REJECTED_STATUS_SET.has(request.status),
      ).length,
    }),
    [requests],
  );

  const resetComposer = () => {
    setShowModal(false);
    setEditingRequestId(null);
    setFormData({ ...EMPTY_FORM_DATA });
    setPendingDiscardModal(false);
    setPendingSubmitConfirmation(false);
  };

  const handleRequestModalClose = () => {
    if (isFormDirty && !isEditing) {
      setPendingDiscardModal(true);
    } else {
      resetComposer();
    }
  };

  const openCreateForm = () => {
    setEditingRequestId(null);
    setFormData({ ...EMPTY_FORM_DATA });
    setShowModal(true);
  };

  const openEditForm = (request) => {
    setEditingRequestId(request.request_id);
    setFormData({
      request_type: request.request_type || "maintenance",
      urgency: request.urgency || "normal",
      description: request.description || "",
      attachments: normalizeMaintenanceAttachments(request.attachments),
    });
    setShowModal(true);
    setSelectedRequestId(null);
  };

  const processAttachmentFiles = async (files) => {
    if (files.length === 0) return;

    if ((formData.attachments?.length || 0) + files.length > 5) {
      showNotification("You can upload a maximum of 5 attachments per request.", "error");
      return;
    }

    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;

    setUploadingAttachment(true);

    try {
      const uploaded = [];
      for (const file of validFiles) {
        const uploadResult = await uploadMaintenanceAttachment(file, {
          documentType: "maintenance-attachment",
          context: "maintenance_request",
          visibility: "tenant_admin",
          maintenanceRequestId: editingRequestId,
          requestId: editingRequestId,
          relatedId: editingRequestId,
        });
        uploaded.push(buildUploadedAttachment(file, uploadResult));
      }

      setFormData((current) => ({
        ...current,
        attachments: [...(current.attachments || []), ...uploaded],
      }));
      showNotification("Attachment uploaded successfully.", "success");
    } catch (error) {
      showNotification(error.message || "Failed to upload attachment.", "error");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleAttachmentUpload = (event) => {
    const files = Array.from(event.target.files || []).filter(Boolean);
    processAttachmentFiles(files);
    event.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter(Boolean);
    processAttachmentFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleRemoveAttachment = (attachmentKey) => {
    setFormData((current) => ({
      ...current,
      attachments: (current.attachments || []).filter(
        (entry, index) => getAttachmentKey(entry, index) !== attachmentKey,
      ),
    }));
  };

  const handleReplyAttachmentUpload = async (event) => {
    const files = Array.from(event.target.files || []).filter(Boolean);
    if (files.length === 0 || !selectedRequest) return;

    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) {
      event.target.value = "";
      return;
    }

    setUploadingReplyAttachment(true);

    try {
      const uploaded = [];
      for (const file of validFiles) {
        const uploadResult = await uploadMaintenanceAttachment(file, {
          documentType: "maintenance-reply-attachment",
          context: "maintenance_reply",
          visibility: "tenant_admin",
          maintenanceRequestId: selectedRequest.request_id,
          relatedId: selectedRequest.request_id,
        });
        uploaded.push(buildUploadedAttachment(file, uploadResult));
      }

      setReplyAttachments((current) => [...current, ...uploaded]);
      showNotification("Attachment uploaded successfully.", "success");
    } catch (error) {
      showNotification(error.message || "Failed to upload attachment.", "error");
    } finally {
      setUploadingReplyAttachment(false);
      event.target.value = "";
    }
  };

  const handleRemoveReplyAttachment = (uri) => {
    setReplyAttachments((current) =>
      current.filter((entry) => getMaintenanceAttachmentUri(entry) !== uri),
    );
  };

  const handleSendReply = async (event) => {
    event.preventDefault();
    if (!selectedRequest) return;

    const message = replyMessage.trim();
    if (!message && replyAttachments.length === 0) {
      showNotification("Please enter a message or attach a file before sending.", "error");
      return;
    }

    try {
      await sendReplyMutation.mutateAsync({
        requestId: selectedRequest.request_id,
        payload: {
          message,
          attachments: normalizeMaintenanceAttachments(replyAttachments),
        },
      });
      setReplyMessage("");
      setReplyAttachments([]);
    } catch (error) {
      showNotification(error.message || "Failed to send reply.", "error");
    }
  };

  const handleSubmitRequest = async (event) => {
    event?.preventDefault();

    if (descriptionLength === 0) {
      showNotification("Please provide a description of the maintenance issue.", "error");
      return;
    }

    if (descriptionTooShort) {
      showNotification(
        `Description must be at least ${MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters.`,
        "error",
      );
      return;
    }

    if (!hasRequiredAttachment) {
      showNotification(
        "Please attach at least 1 photo or document showing the issue before submitting.",
        "error",
      );
      return;
    }

    setPendingSubmitConfirmation(true);
  };

  const confirmSubmitRequest = async () => {
    try {
      const existingAttachments = normalizeMaintenanceAttachments(formData.attachments);

      if (isEditing) {
        await updateMutation.mutateAsync({
          requestId: editingRequestId,
          data: {
            ...formData,
            attachments: existingAttachments,
          },
        });
        showNotification("Maintenance request updated.", "success");
      } else {
        await createMutation.mutateAsync({
          ...formData,
          attachments: existingAttachments,
        });
        showNotification("Maintenance request submitted successfully.", "success");
      }

      setPendingSubmitConfirmation(false);
      resetComposer();
    } catch (error) {
      showNotification(
        error.message || `Failed to ${isEditing ? "update" : "submit"} maintenance request.`,
        "error",
      );
    }
  };

  const requestCancelConfirmation = (request) => setPendingCancelRequest(request);

  const confirmCancelRequest = async () => {
    const request = pendingCancelRequest;
    if (!request) return;

    try {
      await cancelMutation.mutateAsync(request.request_id);
      if (selectedRequestId === request.request_id) {
        setSelectedRequestId(null);
      }
      showNotification("Maintenance request cancelled.", "success");
    } catch (error) {
      showNotification(
        error.message || "Failed to cancel maintenance request.",
        "error",
      );
    } finally {
      setPendingCancelRequest(null);
    }
  };

  const handleConfirmResolution = async (request, isResolved, feedbackOrOptions = "") => {
    if (!request) return;
    const targetRequestId =
      request.request_id ||
      request._id ||
      request.ticketNumber ||
      request.ticket_number;
    if (!targetRequestId) return;

    try {
      const feedback =
        typeof feedbackOrOptions === "object"
          ? feedbackOrOptions?.feedback || ""
          : feedbackOrOptions || "";
      const rating =
        typeof feedbackOrOptions === "object"
          ? feedbackOrOptions?.rating
          : undefined;

      if (isResolved) {
        await confirmResolutionMutation.mutateAsync({
          requestId: targetRequestId,
          payload: {
            action: "confirm",
            confirmed: true,
            feedback: feedback?.trim() || undefined,
            rating,
          },
        });
        setVerifyModalRequest(null);
        setVerifyFeedback("");
        setVerifyRating(5);
        showNotification("Thank you! Your rating and resolution review have been recorded.", "success");
      } else {
        await confirmResolutionMutation.mutateAsync({
          requestId: targetRequestId,
          payload: {
            action: "reopen",
            confirmed: false,
            feedback: feedback?.trim() || undefined,
          },
        });
        setRejectResolutionModalRequest(null);
        setRejectionFeedback("");
        showNotification("Your feedback was sent to facilities. The repair has returned to In Progress.", "info");
      }
    } catch (error) {
      showNotification(error.message || "Unable to submit resolution confirmation. Please try again.", "error");
    }
  };

  const handleRequestReschedule = async () => {
    if (!rescheduleModalRequest) return;
    if (!rescheduleDate || !rescheduleTime) {
      showNotification("Please select both a preferred date and time.", "error");
      return;
    }

    const isEmergency = rescheduleModalRequest.urgency === "emergency";
    const slotValidation = validateMaintenanceSlot(rescheduleDate, rescheduleTime, { isEmergency });
    if (!slotValidation.valid) {
      showNotification(slotValidation.reason, "error");
      return;
    }

    try {
      await requestRescheduleMutation.mutateAsync({
        requestId: rescheduleModalRequest.request_id,
        payload: {
          proposedDate: slotValidation.isoString,
          reason: rescheduleReason.trim() || undefined,
        },
      });
        showNotification(
          rescheduleModalRequest.schedule?.scheduledDate || rescheduleModalRequest.scheduledDate
            ? "Reschedule request submitted to facilities management."
            : "Preferred visit schedule submitted to facilities management.",
          "success",
        );
      setRescheduleModalRequest(null);
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleReason("");
    } catch (err) {
      showNotification(err.message || "Failed to submit reschedule request.", "error");
    }
  };

  const handleReopenRequest = async () => {
    if (!selectedRequest) return;

    try {
      await reopenMutation.mutateAsync({
        requestId: selectedRequest.request_id,
        note: reopenNote.trim(),
      });
      setReopenNote("");
      setSelectedRequestId(null);
      showNotification("Maintenance request reopened and returned to active facilities queue.", "success");
    } catch (error) {
      showNotification(
        error.message || "Failed to reopen maintenance request.",
        "error",
      );
    }
  };

  const roomContextLabel = user?.roomNumber
    ? `Unit ${user.roomNumber}${user.bedNumber ? ` - Bed ${user.bedNumber}` : ""}`
    : user?.room
    ? `Room ${user.room}`
    : "Assigned Dormitory Unit";

  return (
    <div className={embedded ? "" : "tenant-page"}>
      {/* Page Header */}
      <div className="page-header maintenance-page-header">
        <div>
          <h1>Maintenance Requests</h1>
          <p>
            Report repair, room, or facilities concerns, track real-time resolution progress, and review completion reports.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateForm}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={15} />
          Report an Issue
        </button>
      </div>

      {/* Standalone Display-Only KPI Overview Cards */}
      <div className="maintenance-kpi-grid">
        <div className="maintenance-kpi-card">
          <div className="maintenance-kpi-card__top">
            <span className="maintenance-kpi-card__label">Active Requests</span>
            <Clock size={16} strokeWidth={2} style={{ color: "#D97706" }} />
          </div>
          <div className="maintenance-kpi-card__val">{summary.active}</div>
          <p className="maintenance-kpi-card__sub">Under review or in progress</p>
        </div>

        <div className="maintenance-kpi-card">
          <div className="maintenance-kpi-card__top">
            <span className="maintenance-kpi-card__label">Completed / History</span>
            <CheckCircle2 size={16} strokeWidth={2} style={{ color: "#059669" }} />
          </div>
          <div className="maintenance-kpi-card__val">{summary.resolved}</div>
          <p className="maintenance-kpi-card__sub">Resolved and verified</p>
        </div>

        <div className="maintenance-kpi-card">
          <div className="maintenance-kpi-card__top">
            <span className="maintenance-kpi-card__label">Total Filed</span>
            <ClipboardList size={16} strokeWidth={2} style={{ color: "#2563EB" }} />
          </div>
          <div className="maintenance-kpi-card__val">{summary.total}</div>
          <p className="maintenance-kpi-card__sub">Lifetime tickets submitted</p>
        </div>
      </div>

      {/* Request Records Section with Dedicated Filter Bar */}
      <div className="section-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Request Records</h2>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              {filteredRequests.length}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                gap: 4,
                background: "var(--muted)",
                padding: 3,
                borderRadius: 999,
                border: "1px solid var(--border)",
              }}
            >
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(filter.key);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    background: statusFilter === filter.key ? "var(--card)" : "transparent",
                    color: statusFilter === filter.key ? "var(--foreground)" : "var(--muted-foreground)",
                    boxShadow: statusFilter === filter.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {requests.length > 0 ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={filteredRequests.length === 0}
                onClick={areAllFilteredExpanded ? handleCollapseAll : handleExpandAll}
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 120,
                  gap: 6,
                  opacity: filteredRequests.length === 0 ? 0.5 : 1,
                  cursor: filteredRequests.length === 0 ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
                title={
                  filteredRequests.length === 0
                    ? "No tickets to expand in this view"
                    : areAllFilteredExpanded
                    ? "Collapse all ticket cards"
                    : "Expand all ticket cards"
                }
              >
                <ChevronsUpDown size={14} />
                <span>{areAllFilteredExpanded ? "Collapse All" : "Expand All"}</span>
              </button>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <p style={{ color: "var(--muted-foreground)", fontSize: 14 }}>Loading maintenance requests...</p>
        ) : requests.length === 0 ? (
          <div className="maintenance-empty-state">
            <ClipboardList size={28} strokeWidth={1.75} style={{ color: "#64748B", marginBottom: 10 }} />
            <strong>No maintenance requests yet</strong>
            <p>
              Use the "Report an Issue" button above whenever you need assistance with room facilities, plumbing, AC, or utilities.
            </p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="maintenance-empty-state">
            <ClipboardList size={28} strokeWidth={1.75} style={{ color: "#64748B", marginBottom: 10 }} />
            <strong>
              No {statusFilter === "resolved" ? "completed or historical" : statusFilter === "active" ? "active" : "matching"} requests
            </strong>
            <p>Switch filter tabs above to view other tickets in your history.</p>
          </div>
        ) : (
          <>
            <div className="maintenance-list">
              {paginatedRequests.map((request) => {
                const requestId = request.request_id || request._id;
                const typeMeta = getMaintenanceTypeMeta(request.request_type);
                const urgencyMeta = getMaintenanceUrgencyMeta(request.urgency);
                const statusMeta = getMaintenanceStatusMeta(request.status);
                const TypeIcon = typeMeta.icon;
                const StatusIcon = getStatusIcon(request.status);
                const isPending = ["pending", "pending_review", "reviewed"].includes(request.status);
                const isReopenable = REOPENABLE_MAINTENANCE_STATUSES.includes(request.status);
                const isConfirmed = Boolean(
                  request.resolutionConfirmation?.confirmedAt &&
                    request.resolutionConfirmation?.action !== "rejected_back_to_in_progress" &&
                    ["completed", "closed"].includes(request.status)
                );
                const hasReport = Boolean(request.completionReport && !request.completionReport.isDraft);
                const providerLabel = request.tenantVisibleProviderLabel || request.providerDetails?.tenantVisibleLabel || request.assigned_to;
                const scheduledDate = request.schedule?.scheduledDate ? new Date(request.schedule.scheduledDate) : null;
                const latestReply = getLatestTenantReply(request);
                const latestReplyAttachments = getTenantVisibleAttachments(latestReply?.attachments);
                const latestReplySummary = getReplySummary(latestReply);

                const isExpanded = isCardExpanded(request);

                return (
                  <article
                    key={requestId}
                    className="maintenance-item"
                    style={{
                      flexDirection: "column",
                      alignItems: "stretch",
                      padding: 0,
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      background: "var(--card)",
                    }}
                  >
                    {/* Collapsible Card Header Bar */}
                    <div
                      onClick={() => toggleCardExpanded(request)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleCardExpanded(request);
                        }
                      }}
                      style={{
                        display: "flex",
                        gap: 14,
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "14px 18px",
                        cursor: "pointer",
                        userSelect: "none",
                        background: "var(--card)",
                        borderBottom: isExpanded ? "1px solid var(--border)" : "none",
                        transition: "background 0.15s ease",
                      }}
                      aria-expanded={isExpanded}
                      title={isExpanded ? "Click to collapse" : "Click to expand details"}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, flex: 1 }}>
                        <TypeIcon size={18} strokeWidth={2} style={{ color: typeMeta.color, flexShrink: 0 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{typeMeta.label}</h3>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", background: "var(--muted)", padding: "2px 8px", borderRadius: 4 }}>
                              {request.ticketNumber || `#${request.request_id?.slice(0, 8)}`}
                            </span>
                          </div>
                          <p style={{ margin: "2px 0 0", color: "var(--muted-foreground)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {fmtDate(request.created_at)} • {urgencyMeta.label} Priority
                            {!isExpanded && request.description ? (
                              <span style={{ marginLeft: 8, color: "var(--foreground)", opacity: 0.8 }}>
                                — {request.description}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                        {request.isUpdatedForTenant && (
                          <span
                            id={`updated-request-badge-${requestId}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 9px",
                              borderRadius: 6,
                              background: "transparent",
                              color: "#2563EB",
                              border: "1px solid var(--border)",
                              fontSize: 11,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                            title="Recent update from facilities team"
                          >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB" }} />
                            Updated
                          </span>
                        )}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 12px",
                            borderRadius: 999,
                            background: statusMeta.bg,
                            color: statusMeta.color,
                            fontSize: 12,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <StatusIcon size={12} />
                          {formatMaintenanceStatus(request.status)}
                        </span>

                        {request.status === "resolved" && !isConfirmed && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: "#FEF3C7",
                              color: "#92400E",
                              border: "1px solid #FDE68A",
                              fontSize: 11,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Work Done • Pending Confirmation
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCardExpanded(request);
                          }}
                          className="btn btn-secondary"
                          style={{
                            padding: "6px 8px",
                            borderRadius: 999,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--muted-foreground)",
                          }}
                          aria-label={isExpanded ? "Collapse card" : "Expand card"}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Card Body */}
                    {isExpanded ? (
                      <div style={{ padding: "16px 20px 20px" }}>
                        {/* Reported Issue Description Callout */}
                        <div className="maintenance-description-callout">
                          <span className="maintenance-description-callout__label">Reported Issue</span>
                          <p className="maintenance-description-callout__text">
                            {request.description || "No description provided."}
                          </p>
                          {request.attachments?.length ? (
                            <div className="maintenance-detail-links" style={{ marginTop: 10 }}>
                              {request.attachments.map((attachment, idx) => (
                                <AttachmentLink
                                  key={getAttachmentKey(attachment, idx)}
                                  attachment={attachment}
                                  index={idx}
                                  onPreview={setPreviewAttachment}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>

                        {/* Step Tracker */}
                        <MaintenanceStepTracker
                          status={request.status}
                          isReopened={request.isReopened === true}
                          reopenCount={request.reopenCount}
                          inspectedStageIndex={getInspectedStageIndex(request)}
                          onSelectStage={(idx) => handleSelectStage(request, idx)}
                        />

                        {/* Hybrid Stage Card Window */}
                        <MaintenanceStageCardWindow
                          request={request}
                          inspectedStageIndex={getInspectedStageIndex(request)}
                          onResetActiveStage={() => handleResetActiveStage(request)}
                          onReschedule={() => {
                            setRescheduleModalRequest(request);
                            setRescheduleDate("");
                            setRescheduleTime("");
                            setRescheduleReason("");
                          }}
                          onConfirmResolution={() => {
                            setVerifyModalRequest(request);
                            setVerifyRating(5);
                            setVerifyHoverRating(0);
                            setVerifyFeedback("");
                          }}
                          onRejectResolution={() => {
                            setRejectResolutionModalRequest(request);
                            setRejectionFeedback("");
                          }}
                          onViewReport={() => setViewingReportRequest(request)}
                          hideActions={Boolean(
                            selectedRequestId ||
                            verifyModalRequest ||
                            rejectResolutionModalRequest ||
                            rescheduleModalRequest ||
                            viewingReportRequest
                          )}
                        />

                        {isConfirmed ? (
                          <div
                            style={{
                              marginTop: 12,
                              borderRadius: 12,
                              padding: "12px 16px",
                              background: "var(--card-bg, #ffffff)",
                              border: "1px solid var(--border, #E2E8F0)",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--success-dark, #15803D)", fontWeight: 600, fontSize: 13 }}>
                                <CheckCircle2 size={15} />
                                <span>Resolution confirmed by tenant on {fmtDate(request.resolutionConfirmation?.confirmedAt)}</span>
                              </div>
                              {request.resolutionConfirmation?.rating ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>
                                  <div style={{ display: "flex", gap: 2 }}>
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star
                                        key={s}
                                        size={13}
                                        style={{
                                          fill: s <= request.resolutionConfirmation.rating ? "#F59E0B" : "none",
                                          stroke: s <= request.resolutionConfirmation.rating ? "#F59E0B" : "#CBD5E1",
                                        }}
                                      />
                                    ))}
                                  </div>
                                  <span>{request.resolutionConfirmation.rating} / 5</span>
                                </div>
                              ) : null}
                            </div>

                            {request.resolutionConfirmation?.tenantFeedback ? (
                              <p style={{ margin: "2px 0 0", color: "var(--muted-foreground, #64748B)", fontSize: 12, fontStyle: "italic" }}>
                                "{request.resolutionConfirmation.tenantFeedback}"
                              </p>
                            ) : null}

                            <div style={{ marginTop: 2, paddingTop: 6, borderTop: "1px solid var(--border, #E2E8F0)", fontSize: 11, color: "var(--muted-foreground, #64748B)" }}>
                              Review period active: This request will automatically close after 7 days if no further issues are reported.
                            </div>
                          </div>
                        ) : null}

                        {request.notes ? (
                          <div
                            style={{
                            marginTop: 14,
                            borderRadius: 12,
                            padding: "12px 14px",
                            background: "var(--warning-light)",
                            color: "var(--warning-dark)",
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <strong style={{ display: "block", marginBottom: 4 }}>
                              Admin Response
                            </strong>
                            <span>{request.notes}</span>
                          </div>
                        </div>
                      ) : null}

                      {latestReply ? (
                        <div
                          style={{
                            marginTop: 14,
                            borderRadius: 12,
                            padding: "12px 14px",
                            background: "var(--info-light)",
                            color: "var(--info-dark)",
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <MessageSquare size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div style={{ width: "100%" }}>
                            <strong style={{ display: "block", marginBottom: 4 }}>
                              Latest Admin Reply
                            </strong>
                            <span>{latestReplySummary}</span>

                            {latestReplyAttachments.length ? (
                              <div className="maintenance-detail-links" style={{ marginTop: 12 }}>
                                {latestReplyAttachments.map((attachment, index) => (
                                  <AttachmentLink
                                    key={`${getMaintenanceAttachmentUri(attachment) || attachment.name}-${index}`}
                                    attachment={attachment}
                                    index={index}
                                    onPreview={setPreviewAttachment}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      <div
                        className="form-actions maintenance-detail-actions"
                        style={{ justifyContent: "space-between", marginTop: 12 }}
                      >
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setSelectedRequestId(request.request_id)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <Eye size={13} />
                          <span>View Details</span>
                        </button>

                        {isReopenable ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setSelectedRequestId(request.request_id);
                              setDetailTab("reopen");
                              setReopenNote(request.reopen_note || "");
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                          >
                            <RefreshCcw size={13} />
                            <span>Reopen</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {totalItems > 0 ? (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onLimitChange={(newLimit) => {
                  setItemsPerPage(newLimit);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[5, 10, 20]}
                itemLabel="tickets"
              />
            </div>
          ) : null}
        </>
      )}
    </div>

      {/* Submit / Edit Maintenance Request Modal */}
      {showModal ? (
        <div className="maintenance-modal-backdrop" onClick={handleRequestModalClose}>
          <div className="maintenance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="maintenance-modal__header">
              <div>
                <h2>{isEditing ? "Edit Maintenance Request" : "Submit Maintenance Request"}</h2>
                <p>Provide details of the issue for fast triage and technician dispatch.</p>
              </div>
              <button type="button" aria-label="Close form" onClick={handleRequestModalClose}>
                <X size={16} />
              </button>
            </div>

            <div className="room-context-pill">
              <User size={14} />
              <span>Reporting for: <strong>{roomContextLabel}</strong> (Auto-populated from tenancy)</span>
            </div>

            <form className="maintenance-form" onSubmit={handleSubmitRequest}>
              {/* Category Picker */}
              <div className="form-group">
                <label>Select Category *</label>
                <div className="category-picker-grid">
                  {MAINTENANCE_REQUEST_TYPES.map((catKey) => {
                    const meta = getMaintenanceTypeMeta(catKey);
                    const Icon = meta.icon;
                    const isSelected = formData.request_type === catKey;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        className={`category-picker-btn ${isSelected ? "selected" : ""}`}
                        onClick={() => setFormData((c) => ({ ...c, request_type: catKey }))}
                      >
                        <Icon size={18} color={isSelected ? "#2563EB" : meta.color} />
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Urgency Selector Cards */}
              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Urgency Level *</label>
                <div className="urgency-picker-grid">
                  {URGENCY_OPTIONS.map((urgency) => {
                    const isSelected = formData.urgency === urgency.key;
                    return (
                      <div
                        key={urgency.key}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        className={`urgency-card ${isSelected ? "selected" : ""} ${urgency.key === "emergency" ? "urgency-card--emergency" : ""}`}
                        onClick={() => setFormData((c) => ({ ...c, urgency: urgency.key }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setFormData((c) => ({ ...c, urgency: urgency.key }));
                          }
                        }}
                      >
                        <div className="urgency-card__header">
                          <span className="urgency-card__title">{urgency.label}</span>
                          <span className="urgency-card__eta">{urgency.eta}</span>
                        </div>
                        <p className="urgency-card__desc">{urgency.description}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Emergency Notice Banner */}
                {formData.urgency === "emergency" ? (
                  <div className="emergency-notice-banner">
                    <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <h5>Emergency Protocol Notice</h5>
                      <p>
                        For active flooding, major power sparks, gas smell, or fire hazards, please notify the 24/7 Front Desk immediately after submitting this ticket.
                      </p>
                      <span className="hotline-pill">
                        <PhoneCall size={12} /> Front Desk Hotline: (02) 8123-4567 / (0917) 123-4567
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Description Field with Live Counter */}
              <div className={`form-group${descriptionTooShort ? " has-error" : ""}`} style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="maintenance-description">Issue Description *</label>
                  <span className={`character-counter ${descriptionLength >= MIN_MAINTENANCE_DESCRIPTION_LENGTH && descriptionLength <= (MAX_MAINTENANCE_DESCRIPTION_LENGTH || 1000) ? "valid" : descriptionLength > 0 ? "invalid" : ""}`}>
                    {descriptionLength} / {MAX_MAINTENANCE_DESCRIPTION_LENGTH || 1000} characters (min {MIN_MAINTENANCE_DESCRIPTION_LENGTH})
                  </span>
                </div>
                <textarea
                  id="maintenance-description"
                  className="form-control"
                  rows="4"
                  maxLength={MAX_MAINTENANCE_DESCRIPTION_LENGTH || 1000}
                  placeholder="Describe the issue in detail (symptoms, location, when it started, and specific unit fixture affected)..."
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  required
                  autoFocus
                />
                <p className="maintenance-help-text">
                  Minimum {MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters. Clear descriptions help technicians arrive with the correct spare parts on the first visit.
                </p>
                {descriptionTooShort ? (
                  <p className="maintenance-field-error">
                    Description must be at least {MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters.
                  </p>
                ) : null}
              </div>

              {/* Attachments Dropzone & List */}
              <div className="form-group" style={{ marginTop: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <label style={{ margin: 0 }}>Photo / Document Attachments *</label>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color:
                        attachmentCount >= 5
                          ? "#D97706"
                          : attachmentCount > 0
                          ? "#2563EB"
                          : "#DC2626",
                    }}
                  >
                    {attachmentCount} / 5 {attachmentCount === 0 ? "(At least 1 required)" : ""}
                  </span>
                </div>
                <div
                  className={`maintenance-dropzone ${isDragOver ? "dragover" : ""}`}
                  onDragOver={attachmentCount < 5 ? handleDragOver : (e) => e.preventDefault()}
                  onDragLeave={attachmentCount < 5 ? handleDragLeave : undefined}
                  onDrop={attachmentCount < 5 ? handleDrop : (e) => e.preventDefault()}
                  onClick={() =>
                    !uploadingAttachment &&
                    attachmentCount < 5 &&
                    fileInputRef.current?.click()
                  }
                  style={
                    uploadingAttachment
                      ? { opacity: 0.85, cursor: "wait" }
                      : attachmentCount >= 5
                      ? {
                          opacity: 0.85,
                          cursor: "default",
                          background: "transparent",
                          borderStyle: "solid",
                        }
                      : attachmentCount > 0
                      ? {
                          padding: "1rem 1.25rem",
                          borderColor: "var(--border-strong, #CBD5E1)",
                        }
                      : {}
                  }
                >
                  {uploadingAttachment ? (
                    <>
                      <LoaderCircle size={22} className="admin-announcements-spin" style={{ color: "#2563EB" }} />
                      <span className="maintenance-dropzone__title" style={{ color: "#2563EB" }}>
                        Uploading attachments...
                      </span>
                      <span className="maintenance-dropzone__sub">
                        Please wait while files are being uploaded
                      </span>
                    </>
                  ) : attachmentCount >= 5 ? (
                    <>
                      <CheckCircle2 size={20} strokeWidth={2} style={{ color: "#059669" }} />
                      <span className="maintenance-dropzone__title" style={{ color: "var(--foreground)" }}>
                        Maximum 5 attachments reached
                      </span>
                      <span className="maintenance-dropzone__sub">
                        Remove an attachment below if you want to upload a different file
                      </span>
                    </>
                  ) : attachmentCount > 0 ? (
                    <>
                      <UploadCloud size={20} style={{ color: "#2563EB" }} />
                      <span className="maintenance-dropzone__title" style={{ color: "var(--foreground)" }}>
                        Add more photos or documents ({5 - attachmentCount} remaining)
                      </span>
                      <span className="maintenance-dropzone__sub">
                        Drag & drop or click to browse additional files (JPG, PNG, WEBP, PDF up to 10MB)
                      </span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={22} color={isDragOver ? "#2563EB" : "var(--muted-foreground)"} />
                      <span className="maintenance-dropzone__title">
                        Drag & drop photos here, or click to browse
                      </span>
                      <span className="maintenance-dropzone__sub">
                        At least 1 photo or document is required (JPG, PNG, WEBP, PDF up to 10MB)
                      </span>
                    </>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  id="maintenance-attachments"
                  type="file"
                  hidden
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                  onChange={handleAttachmentUpload}
                  disabled={uploadingAttachment || isSavingForm}
                />

                {formData.attachments?.length ? (
                  <div className="maintenance-attachment-list" style={{ marginTop: 10 }}>
                    {formData.attachments.map((attachment, index) => {
                      const attachmentKey = getAttachmentKey(attachment, index);
                      return (
                        <div key={attachmentKey} className="maintenance-attachment-row">
                          <span>{getMaintenanceAttachmentName(attachment, index)}</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleRemoveAttachment(attachmentKey)}
                            disabled={uploadingAttachment || isSavingForm}
                            style={{ padding: "6px 10px" }}
                            aria-label="Remove attachment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {/* Form Action Buttons */}
              <div className="form-actions" style={{ marginTop: 18, justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRequestModalClose}
                  disabled={createMutation.isPending || updateMutation.isPending || pendingSubmitConfirmation}
                  style={{ padding: "5px 14px", fontSize: 12, minHeight: 30, borderRadius: 8 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={
                    uploadingAttachment ||
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    pendingSubmitConfirmation ||
                    descriptionTooShort ||
                    descriptionLength === 0 ||
                    !hasRequiredAttachment
                  }
                  style={{ padding: "5px 14px", fontSize: 12, minHeight: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {isEditing ? "Save Changes" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Ticket Details & Conversation Modal */}
      {selectedRequest ? (
        <div
          className="maintenance-modal-backdrop"
          onClick={() => {
            setSelectedRequestId(null);
            setReopenNote("");
          }}
        >
          <div
            className="maintenance-modal"
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const typeMeta = getMaintenanceTypeMeta(selectedRequest.request_type);
              const TypeIcon = typeMeta.icon || Wrench;
              const providerLabel =
                selectedRequest.tenantVisibleProviderLabel ||
                selectedRequest.providerDetails?.tenantVisibleLabel ||
                selectedRequest.assigned_to ||
                "Pending Assignment";
              const urgencyMeta = getMaintenanceUrgencyMeta(selectedRequest.urgency);
              const statusMeta = getMaintenanceStatusMeta(selectedRequest.status);
              const StatusIcon = getStatusIcon(selectedRequest.status);

              return (
                <>
                  <div className="maintenance-modal__header">
                    <div className="maintenance-info" style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div className="maintenance-type-badge-lg">
                          <TypeIcon size={18} strokeWidth={2.2} style={{ color: typeMeta.color || "var(--foreground)" }} />
                          <span>{typeMeta.label}</span>
                        </div>
                        <span className="maintenance-ticket-badge">
                          {selectedRequest.ticketNumber || `#${selectedRequest.request_id?.slice(0, 8)}`}
                        </span>
                        <span className={`maintenance-urgency-chip urgency-${selectedRequest.urgency || "normal"}`}>
                          <span>{urgencyMeta.label}</span>
                        </span>
                        <span
                          className={`maintenance-status-chip status-${selectedRequest.status}`}
                          style={{ fontSize: 12, padding: "2px 8px" }}
                        >
                          <span className="status-dot" />
                          <span>{formatMaintenanceStatus(selectedRequest.status)}</span>
                        </span>
                      </div>
                      <p className="maintenance-submitted-meta" style={{ marginTop: 4 }}>
                        <Clock size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                        <span>Submitted on {fmtDateTime(selectedRequest.created_at)}</span>
                        {selectedRequest.roomName || selectedRequest.occupancyContext?.unitNumber ? (
                          <span style={{ marginLeft: 8, opacity: 0.85 }}>
                            • Room: {selectedRequest.occupancyContext?.unitNumber ? `Unit ${selectedRequest.occupancyContext.unitNumber}${selectedRequest.occupancyContext.bedNumber ? ` - Bed ${selectedRequest.occupancyContext.bedNumber}` : ""}` : selectedRequest.roomName}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="maintenance-modal-close-btn"
                      aria-label="Close maintenance details"
                      onClick={() => {
                        setSelectedRequestId(null);
                        setReopenNote("");
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      borderBottom: "1px solid var(--border)",
                      marginBottom: 16,
                    }}
                  >
                    {DETAIL_TABS.filter(
                      (tab) =>
                        tab.key !== "reopen" ||
                        REOPENABLE_MAINTENANCE_STATUSES.includes(selectedRequest.status),
                    ).map((tab) => {
                      const isConversation = tab.key === "conversation";
                      const unreadCount = isConversation
                        ? getUnreadConvCount(selectedRequest, detailTab === "conversation")
                        : 0;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => handleDetailTabChange(tab.key)}
                          style={{
                            padding: "10px 16px",
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            fontSize: 14,
                            fontWeight: 600,
                            color: detailTab === tab.key ? "var(--color-primary, #0A1628)" : "var(--muted-foreground)",
                            borderBottom: detailTab === tab.key ? "2px solid var(--color-primary, #0A1628)" : "2px solid transparent",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>{tab.label}</span>
                          {isConversation && unreadCount > 0 && detailTab !== "conversation" && !viewedTabs.has("conversation") ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: 999,
                                background: detailTab === tab.key ? "var(--primary-light, #EFF6FF)" : "#DBEAFE",
                                color: detailTab === tab.key ? "var(--primary-dark, #1E3A8A)" : "#1E40AF",
                                border: "1px solid #93C5FD",
                              }}
                            >
                              {unreadCount}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {detailTab === "details" ? (
                    <>
                      {/* 1. Live Progress Stepper & Stage Card */}
                      <MaintenanceStepTracker
                        status={selectedRequest.status}
                        isReopened={selectedRequest.isReopened === true}
                        reopenCount={selectedRequest.reopenCount}
                        inspectedStageIndex={
                          typeof modalInspectedStageIndex === "number"
                            ? modalInspectedStageIndex
                            : getStepIndex(selectedRequest.status)
                        }
                        onSelectStage={(idx) => {
                          const activeIdx = getStepIndex(selectedRequest.status);
                          if (idx <= activeIdx) setModalInspectedStageIndex(idx);
                        }}
                      />

                      <MaintenanceStageCardWindow
                        request={selectedRequest}
                        inspectedStageIndex={
                          typeof modalInspectedStageIndex === "number"
                            ? modalInspectedStageIndex
                            : getStepIndex(selectedRequest.status)
                        }
                        onResetActiveStage={() => {
                          const activeIdx = getStepIndex(selectedRequest.status);
                          setModalInspectedStageIndex(activeIdx);
                        }}
                        onReschedule={() => {
                          setRescheduleModalRequest(selectedRequest);
                          setRescheduleDate("");
                          setRescheduleTime("");
                          setRescheduleReason("");
                        }}
                        onConfirmResolution={() => {
                          setVerifyModalRequest(selectedRequest);
                          setVerifyRating(5);
                          setVerifyHoverRating(0);
                          setVerifyFeedback("");
                        }}
                        onRejectResolution={() => {
                          setRejectResolutionModalRequest(selectedRequest);
                          setRejectionFeedback("");
                        }}
                        onViewReport={() => setViewingReportRequest(selectedRequest)}
                      />

                      {/* 2. Work Completion Proof & Resolution Evidence */}
                      {getResolutionProofAttachments(selectedRequest).length > 0 ||
                      (["resolved", "completed", "closed"].includes(selectedRequest.status) &&
                        (selectedRequest.resolutionProof?.note || selectedRequest.resolution_note)) ? (
                        <section className="maintenance-detail-section" style={{ marginTop: 16 }}>
                          <div className="detail-section-header">
                            <ShieldCheck size={16} style={{ color: "#16A34A" }} />
                            <h3>Work Completion Proof &amp; Resolution Evidence</h3>
                            <span
                              style={{
                                marginLeft: "auto",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                color: "#16A34A",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "2px 8px",
                                borderRadius: 9999,
                                border: "1px solid var(--border)",
                                background: "transparent",
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A", display: "inline-block" }} />
                              <span>Repairs Concluded</span>
                            </span>
                          </div>

                          {selectedRequest.resolutionProof?.note || selectedRequest.resolution_note ? (
                            <div className="maintenance-description-card" style={{ marginBottom: 12 }}>
                              <p>{selectedRequest.resolutionProof?.note || selectedRequest.resolution_note}</p>
                              {selectedRequest.resolutionProof?.resolvedAt || selectedRequest.resolved_at ? (
                                <span style={{ display: "block", marginTop: 6, fontSize: "0.74rem", color: "var(--muted-foreground)" }}>
                                  Resolved on {fmtDateTime(selectedRequest.resolutionProof?.resolvedAt || selectedRequest.resolved_at)}
                                  {selectedRequest.resolutionProof?.resolvedByName ? ` by ${selectedRequest.resolutionProof.resolvedByName}` : ""}
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          {getResolutionProofAttachments(selectedRequest).length ? (
                            <div style={{ marginTop: 10 }}>
                              <span
                                style={{
                                  fontSize: "0.78rem",
                                  fontWeight: 700,
                                  color: "var(--muted-foreground)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.03em",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 5,
                                  marginBottom: 8,
                                }}
                              >
                                <Paperclip size={13} />
                                <span>Resolution Photos &amp; Proof Files ({getResolutionProofAttachments(selectedRequest).length})</span>
                              </span>
                              <div className="maintenance-attachments-grid">
                                {getResolutionProofAttachments(selectedRequest).map((attachment, index) => (
                                  <AttachmentLink
                                    key={`res-proof-${getMaintenanceAttachmentUri(attachment) || attachment.name}-${index}`}
                                    attachment={attachment}
                                    index={index}
                                    onPreview={setPreviewAttachment}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </section>
                      ) : null}

                      {/* 3. Reported Issue & Evidence */}
                      <section className="maintenance-detail-section" style={{ marginTop: 16 }}>
                        <div className="detail-section-header">
                          <ClipboardList size={16} />
                          <h3>Reported Issue &amp; Evidence</h3>
                        </div>
                        <div className="maintenance-description-card">
                          <p>{selectedRequest.description || "No description provided."}</p>
                        </div>
                        {getTenantVisibleAttachments(selectedRequest.attachments).length ? (
                          <div style={{ marginTop: 12 }}>
                            <span
                              style={{
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                color: "var(--muted-foreground)",
                                textTransform: "uppercase",
                                letterSpacing: "0.03em",
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                marginBottom: 8,
                              }}
                            >
                              <Paperclip size={13} />
                              <span>Attached Photos &amp; Files ({getTenantVisibleAttachments(selectedRequest.attachments).length})</span>
                            </span>
                            <div className="maintenance-attachments-grid">
                              {getTenantVisibleAttachments(selectedRequest.attachments).map((attachment, index) => (
                                <AttachmentLink
                                  key={`${getMaintenanceAttachmentUri(attachment) || attachment.name}-${index}`}
                                  attachment={attachment}
                                  index={index}
                                  onPreview={setPreviewAttachment}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </section>

                      {/* 3. Staff Updates & Resolution Notes */}
                      {selectedRequest.notes ? (
                        <div className="maintenance-detail-callout" style={{ marginTop: 14 }}>
                          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <h3>Admin Response</h3>
                            <p>{selectedRequest.notes}</p>
                          </div>
                        </div>
                      ) : null}

                      {selectedRequest.resolutionConfirmation?.confirmedAt &&
                      selectedRequest.resolutionConfirmation?.action !== "rejected_back_to_in_progress" &&
                      ["completed", "closed"].includes(selectedRequest.status) ? (
                        <div
                          style={{
                            marginTop: 14,
                            borderRadius: 10,
                            padding: "12px 16px",
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--success-dark, #15803D)", fontWeight: 600, fontSize: 13 }}>
                              <CheckCircle2 size={15} />
                              <span>Resolution confirmed by tenant on {fmtDate(selectedRequest.resolutionConfirmation.confirmedAt)}</span>
                            </div>
                            {selectedRequest.resolutionConfirmation?.rating ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>
                                <div style={{ display: "flex", gap: 2 }}>
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      size={13}
                                      style={{
                                        fill: s <= selectedRequest.resolutionConfirmation.rating ? "#F59E0B" : "none",
                                        stroke: s <= selectedRequest.resolutionConfirmation.rating ? "#F59E0B" : "#CBD5E1",
                                      }}
                                    />
                                  ))}
                                </div>
                                <span>{selectedRequest.resolutionConfirmation.rating} / 5</span>
                              </div>
                            ) : null}
                          </div>
                          {selectedRequest.resolutionConfirmation?.tenantFeedback ? (
                            <p style={{ margin: "2px 0 0", color: "var(--muted-foreground)", fontSize: 12, fontStyle: "italic" }}>
                              "{selectedRequest.resolutionConfirmation.tenantFeedback}"
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {/* 4. Action Buttons Footer */}
                      <div className="form-actions maintenance-detail-actions" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                        {["pending", "pending_review", "reviewed"].includes(selectedRequest.status) ? (
                          <button
                            type="button"
                            className="btn btn-secondary maintenance-action-btn"
                            onClick={() => openEditForm(selectedRequest)}
                            title="Edit issue description or update attachments"
                          >
                            <Pencil size={14} />
                            <span>Edit Request</span>
                          </button>
                        ) : null}

                        {["pending", "pending_review", "reviewed"].includes(selectedRequest.status) ? (
                          <button
                            type="button"
                            className="btn btn-secondary maintenance-danger-button maintenance-action-btn"
                            disabled={cancelMutation.isPending}
                            onClick={() => requestCancelConfirmation(selectedRequest)}
                            title="Cancel this maintenance ticket"
                          >
                            <Trash2 size={14} />
                            <span>Cancel Request</span>
                          </button>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </>
              );
            })()}

            {detailTab === "conversation" ? (
              <MaintenanceConversationSection
                conversation={selectedRequest.conversation || []}
                currentSide="tenant"
                isActiveTicket={ACTIVE_MAINTENANCE_STATUSES.includes(selectedRequest.status)}
                ticketStatus={formatMaintenanceStatus(selectedRequest.status)}
                onSendReply={async ({ message, attachments }) => {
                  await sendReplyMutation.mutateAsync({
                    requestId: selectedRequest.request_id,
                    payload: { message, attachments },
                  });
                }}
                isSending={sendReplyMutation.isPending}
                onPreviewAttachment={setPreviewAttachment}
                requestId={selectedRequest.request_id}
                isOtherTyping={adminIsTyping}
                otherTypingName={adminTypingName}
                onTypingChange={handleTenantTypingChange}
              />
            ) : null}

            {detailTab === "reopen" && REOPENABLE_MAINTENANCE_STATUSES.includes(selectedRequest.status) ? (
              <section className="maintenance-detail-section">
                <h3>Reopen Request</h3>
                <p>
                  If the issue remains unresolved or has reoccurred, specify what is missing and send it back to the active queue.
                </p>
                <textarea
                  className="form-control"
                  rows="3"
                  style={{ marginTop: 12 }}
                  placeholder="Explain why the issue remains or what still needs repair..."
                  value={reopenNote}
                  onChange={(event) => setReopenNote(event.target.value)}
                />
                <div className="form-actions maintenance-detail-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={reopenMutation.isPending || !reopenNote.trim()}
                    onClick={handleReopenRequest}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCcw size={14} />
                    {reopenMutation.isPending ? "Reopening..." : "Reopen Request"}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Completion Report Printable Modal */}
      {viewingReportRequest ? (
        <CompletionReportModal
          request={viewingReportRequest}
          onClose={() => setViewingReportRequest(null)}
        />
      ) : null}

      {/* Photo Preview Lightbox Modal */}
      {previewAttachment ? (
        <div
          onClick={() => setPreviewAttachment(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewAttachment(null)}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "#FFFFFF",
            }}
            aria-label="Close photo preview"
          >
            <X size={20} />
          </button>
          <img
            src={previewAttachment.uri}
            alt={previewAttachment.name}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              borderRadius: 12,
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
              objectFit: "contain",
            }}
          />
          <span style={{ color: "#CBD5E1", fontSize: 13, fontWeight: 600 }}>{previewAttachment.name}</span>
        </div>
      ) : null}



      {/* Cancel Confirmation Dialog */}
      {pendingCancelRequest ? (
        <ConfirmDialog
          title="Cancel Maintenance Request?"
          message="This request will be marked as cancelled and removed from your active queue. This action cannot be undone."
          cancelLabel="Keep Request"
          confirmLabel={cancelMutation.isPending ? "Cancelling..." : "Cancel Request"}
          danger
          onConfirm={confirmCancelRequest}
          onCancel={() => setPendingCancelRequest(null)}
        />
      ) : null}

      {/* Discard Unsaved Changes Dialog */}
      {pendingDiscardModal ? (
        <ConfirmDialog
          title="Discard Unsaved Changes?"
          message="You have unsaved changes in this maintenance request. Closing will discard your entries."
          cancelLabel="Keep Editing"
          confirmLabel="Discard Changes"
          danger
          onConfirm={resetComposer}
          onCancel={() => setPendingDiscardModal(false)}
        />
      ) : null}

      {/* Submit / Edit Confirmation Dialog */}
      {pendingSubmitConfirmation ? (
        <ConfirmDialog
          title={isEditing ? "Save Changes to Request?" : "Submit Maintenance Request?"}
          message={
            isEditing
              ? "Are you sure you want to update this maintenance request with the changes below?"
              : "Our facilities management team will be notified immediately to review the issue and schedule a technician. Please confirm your request details:"
          }
          cancelLabel="Back to Edit"
          confirmLabel={
            isEditing
              ? updateMutation.isPending
                ? "Saving Changes..."
                : "Yes, Save Changes"
              : createMutation.isPending
              ? "Submitting..."
              : "Yes, Submit Request"
          }
          confirmVariant="success"
          isProcessing={createMutation.isPending || updateMutation.isPending}
          maxWidth={440}
          onConfirm={confirmSubmitRequest}
          onCancel={() => {
            if (!createMutation.isPending && !updateMutation.isPending) {
              setPendingSubmitConfirmation(false);
            }
          }}
        >
          <div
            style={{
              background: "var(--muted)",
              borderRadius: 8,
              padding: "12px 14px",
              border: "1px solid var(--border)",
              fontSize: 13,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>Category:</span>
              <span style={{ fontWeight: 600, color: "var(--foreground)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                {(() => {
                  const meta = getMaintenanceTypeMeta(formData.request_type);
                  const Icon = meta.icon;
                  return (
                    <>
                      <Icon size={14} color={meta.color} />
                      <span>{meta.label}</span>
                    </>
                  );
                })()}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>Urgency:</span>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  textTransform: "capitalize",
                  color: "var(--foreground)",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background:
                      formData.urgency === "emergency"
                        ? "#DC2626"
                        : formData.urgency === "high"
                        ? "#EA580C"
                        : formData.urgency === "normal"
                        ? "#2563EB"
                        : "#64748B",
                  }}
                />
                {formData.urgency}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>Unit / Tenancy:</span>
              <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
                {roomContextLabel}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>Attachments:</span>
              <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
                {formData.attachments?.length || 0} file(s) attached
              </span>
            </div>

            {formData.description ? (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 2 }}>
                <span style={{ color: "var(--muted-foreground)", fontSize: 11.5, display: "block", marginBottom: 3 }}>
                  Description Preview:
                </span>
                <p
                  style={{
                    margin: 0,
                    color: "var(--foreground)",
                    fontSize: 12.5,
                    lineHeight: 1.4,
                    maxHeight: 60,
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {formData.description}
                </p>
              </div>
            ) : null}
          </div>
        </ConfirmDialog>
      ) : null}

      {/* Reschedule Request Modal */}
      {rescheduleModalRequest ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--card)",
              borderRadius: 14,
              padding: 20,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={16} color="#059669" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
                  {rescheduleModalRequest?.schedule?.scheduledDate || rescheduleModalRequest?.scheduledDate
                    ? "Request Schedule Adjustment"
                    : "Request Preferred Visit Schedule"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalRequest(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: "0 0 14px", color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
              {rescheduleModalRequest?.schedule?.scheduledDate || rescheduleModalRequest?.scheduledDate
                ? "If you will not be available in your room during the scheduled repair, specify your preferred date and time (Mon–Sat, 8:00 AM – 6:00 PM) for our facilities team."
                : "Specify your preferred repair visit date and time (Mon–Sat, 8:00 AM – 6:00 PM) so our facilities team can coordinate technician arrival with your schedule."}
            </p>

            {rescheduleModalRequest?.rescheduleRequest?.responseNote && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  lineHeight: 1.4,
                }}
              >
                <strong style={{ color: "var(--foreground)" }}>Previous Staff Note:</strong>{" "}
                {rescheduleModalRequest.rescheduleRequest.responseNote}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "var(--foreground)" }}>
                  Preferred Date *
                </label>
                <input
                  type="date"
                  className="form-control"
                  style={{ cursor: "pointer" }}
                  min={getLocalDateString(0)}
                  value={rescheduleDate}
                  onClick={(e) => {
                    try {
                      e.target.showPicker?.();
                    } catch (err) {}
                  }}
                  onFocus={(e) => {
                    try {
                      e.target.showPicker?.();
                    } catch (err) {}
                  }}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                  {[
                    { label: "Tomorrow", offset: 1 },
                    { label: "+2 Days", offset: 2 },
                    { label: "+3 Days", offset: 3 },
                  ].map((p) => {
                    const val = getLocalDateString(p.offset);
                    const isSelected = rescheduleDate === val;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setRescheduleDate(val)}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: 6,
                          border: isSelected ? "1px solid #059669" : "1px solid var(--border)",
                          background: isSelected ? "#059669" : "var(--muted)",
                          color: isSelected ? "#FFFFFF" : "var(--foreground)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "var(--foreground)" }}>
                  Preferred Time * <span style={{ fontSize: 10, fontWeight: 400, color: "var(--muted-foreground)" }}>(8 AM – 6 PM)</span>
                </label>
                <input
                  type="time"
                  className="form-control"
                  style={{ cursor: "pointer" }}
                  min="08:00"
                  max="18:00"
                  value={rescheduleTime}
                  onClick={(e) => {
                    try {
                      e.target.showPicker?.();
                    } catch (err) {}
                  }}
                  onFocus={(e) => {
                    try {
                      e.target.showPicker?.();
                    } catch (err) {}
                  }}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                />
                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                  {[
                    { label: "9:00 AM", val: "09:00" },
                    { label: "11:00 AM", val: "11:00" },
                    { label: "2:00 PM", val: "14:00" },
                    { label: "4:00 PM", val: "16:00" },
                  ].map((t) => {
                    const isSelected = rescheduleTime === t.val;
                    return (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => setRescheduleTime(t.val)}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: 6,
                          border: isSelected ? "1px solid #059669" : "1px solid var(--border)",
                          background: isSelected ? "#059669" : "var(--muted)",
                          color: isSelected ? "#FFFFFF" : "var(--foreground)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>
                  {rescheduleModalRequest?.schedule?.scheduledDate || rescheduleModalRequest?.scheduledDate
                    ? "Reason for Reschedule"
                    : "Notes / Availability Details"}{" "}
                  <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>(Optional)</span>
                </label>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  {rescheduleReason.length} / 250
                </span>
              </div>
              <input
                type="text"
                className="form-control"
                maxLength={250}
                placeholder="e.g. In class until 3 PM, roommate studying"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
              />
            </div>

            {rescheduleDate && rescheduleTime ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  color: "var(--foreground)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CheckCircle2 size={14} color="#059669" />
                <span>
                  New proposed slot: <strong>{fmtDate(rescheduleDate)} at {rescheduleTime}</strong>
                </span>
              </div>
            ) : (
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--muted-foreground)" }}>
                💡 Select both a preferred date and time (Mon–Sat, 8:00 AM – 6:00 PM) to enable submission.
              </p>
            )}

            <div className="maintenance-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRescheduleModalRequest(null)}
                disabled={requestRescheduleMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleRequestReschedule}
                disabled={!rescheduleDate || !rescheduleTime || requestRescheduleMutation.isPending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#059669",
                  borderColor: "#059669",
                  color: "#FFFFFF",
                }}
              >
                {requestRescheduleMutation.isPending ? <LoaderCircle size={14} className="admin-announcements-spin" /> : <Check size={14} />}
                <span>
                  {requestRescheduleMutation.isPending
                    ? "Submitting..."
                    : rescheduleModalRequest?.schedule?.scheduledDate || rescheduleModalRequest?.scheduledDate
                    ? "Submit Reschedule"
                    : "Submit Preferred Schedule"}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Reject Resolution Feedback Modal */}
      {rejectResolutionModalRequest ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--card)",
              borderRadius: 14,
              padding: 20,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} color="#DC2626" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
                  Report Issue Not Fixed
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectResolutionModalRequest(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: "0 0 14px", color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
              Please describe what still needs attention so facilities staff can perform the necessary follow-up repair work.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--foreground)" }}>
                Defect Details *
              </label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Describe what is still not working properly..."
                value={rejectionFeedback}
                onChange={(e) => setRejectionFeedback(e.target.value)}
              />
            </div>

            <div className="maintenance-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectResolutionModalRequest(null)}
                disabled={confirmResolutionMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleConfirmResolution(rejectResolutionModalRequest, false, rejectionFeedback)}
                disabled={!rejectionFeedback.trim() || confirmResolutionMutation.isPending}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {confirmResolutionMutation.isPending ? <LoaderCircle size={14} className="admin-announcements-spin" /> : <RefreshCcw size={14} />}
                <span>{confirmResolutionMutation.isPending ? "Sending..." : "Send Back for Rework"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Verify / Rate Resolution Modal */}
      {verifyModalRequest ? (
        <div
          className="maintenance-modal-backdrop"
          onClick={() => {
            if (!confirmResolutionMutation.isPending) {
              setVerifyModalRequest(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !confirmResolutionMutation.isPending) {
              setVerifyModalRequest(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                (e.ctrlKey || e.metaKey) &&
                !confirmResolutionMutation.isPending
              ) {
                e.preventDefault();
                handleConfirmResolution(verifyModalRequest, true, {
                  rating: verifyRating,
                  feedback: verifyFeedback,
                });
              }
            }}
            style={{
              background: "var(--card)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 480,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>
                  Confirm Maintenance Resolution
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVerifyModalRequest(null)}
                disabled={confirmResolutionMutation.isPending}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                padding: "10px 14px",
                borderRadius: 10,
                marginBottom: 14,
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--foreground)" }}>
                {formatMaintenanceType(verifyModalRequest.request_type)} Request (#{verifyModalRequest.ticket_number || verifyModalRequest.ticketNumber || verifyModalRequest.request_id})
              </div>
              <div style={{ color: "var(--muted-foreground)", marginTop: 2, wordBreak: "break-word" }}>
                {verifyModalRequest.description}
              </div>
            </div>

            {/* Star Rating Selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--foreground)" }}>
                How satisfied are you with the repair? <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>(Required)</span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (verifyHoverRating || verifyRating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setVerifyRating(star)}
                        onMouseEnter={() => setVerifyHoverRating(star)}
                        onMouseLeave={() => setVerifyHoverRating(0)}
                        aria-label={`${star} star${star > 1 ? "s" : ""}`}
                        aria-pressed={verifyRating === star}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 4,
                          cursor: "pointer",
                          transition: "transform 0.1s ease",
                        }}
                        title={`${star} star${star > 1 ? "s" : ""}`}
                      >
                        <Star
                          size={24}
                          style={{
                            fill: active ? "#F59E0B" : "none",
                            stroke: active ? "#F59E0B" : "var(--muted-foreground)",
                            transition: "fill 0.15s ease, stroke 0.15s ease",
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>
                  {(verifyHoverRating || verifyRating) === 5 && "5 / 5 — Excellent"}
                  {(verifyHoverRating || verifyRating) === 4 && "4 / 5 — Very Good"}
                  {(verifyHoverRating || verifyRating) === 3 && "3 / 5 — Good"}
                  {(verifyHoverRating || verifyRating) === 2 && "2 / 5 — Fair"}
                  {(verifyHoverRating || verifyRating) === 1 && "1 / 5 — Poor"}
                </span>
              </div>
            </div>

            {/* Feedback Comments */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
                  Your Feedback <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>(Optional)</span>
                </label>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  {verifyFeedback.length} / 500
                </span>
              </div>
              <textarea
                className="form-control"
                rows="3"
                maxLength={500}
                placeholder="Share your experience (e.g. work quality, cleanliness, technician)..."
                value={verifyFeedback}
                onChange={(e) => setVerifyFeedback(e.target.value)}
              />
            </div>

            {/* Confirmation Notice */}
            <div
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 16,
                fontSize: 12,
                color: "var(--muted-foreground)",
                lineHeight: 1.45,
              }}
            >
              <strong style={{ color: "var(--foreground)" }}>Resolution Confirmation:</strong> Submitting will confirm that the repair in your room is complete and officially close this maintenance request.
            </div>

            <div className="maintenance-modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setVerifyModalRequest(null)}
                disabled={confirmResolutionMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() =>
                  handleConfirmResolution(verifyModalRequest, true, {
                    rating: verifyRating,
                    feedback: verifyFeedback,
                  })
                }
                disabled={confirmResolutionMutation.isPending}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {confirmResolutionMutation.isPending ? <LoaderCircle size={14} className="admin-announcements-spin" /> : <Check size={14} />}
                <span>{confirmResolutionMutation.isPending ? "Confirming..." : "Confirm Resolution"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
