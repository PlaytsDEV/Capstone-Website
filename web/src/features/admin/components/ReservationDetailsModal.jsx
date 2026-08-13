import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calendar, Camera, CheckCircle, ClipboardList, CreditCard, Eye, Image as ImageIcon, Info, Maximize2 } from "lucide-react";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { reservationApi } from "../../../shared/api/apiClient";
import { SUBMETER_BRANCHES } from "../../../shared/utils/constants";
import { useVisitAvailability } from "../../../shared/hooks/queries/useReservations";
import { useUtilityLatestReading } from "../../../shared/hooks/queries/useUtility";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import getFriendlyError from "../../../shared/utils/friendlyError";
import {
 getAllowedReservationActions,
 getReservationStatusAppearance,
 normalizeReservationStatus,
 readMoveInDate,
} from "../../../shared/utils/lifecycleNaming";
import {
 fmtDate as sharedFmtDate,
 fmtDateTime as sharedFmtDateTime,
} from "../../../shared/utils/dateFormat";
import { showNotification } from "../../../shared/utils/notification";
import { getVisitManagementAvailability } from "../utils/visitStatusRules";
import { resolveReservationApprovalPricingGate } from "../utils/reservationPricingGate";
import { resolveApplicantPhotoUrl } from "../utils/applicantPhotoResolution";
import { formatSubmittedAddress } from "../utils/reservationAddressFormat";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import { formatPaymentMethod } from "../../../shared/utils/formatPaymentMethod";
import "../styles/reservation-details-modal.css";

 const ACTION_MSGS = {
  moveIn: {
    title: "Move In Tenant",
    message:
      "Mark this tenant as moved in? They'll be promoted to Tenant role with full system access.",
    confirmText: "Yes, Move In",
    variant: "success",
  },
  cancel: {
    title: "Cancel Reservation",
    message:
      "This will permanently remove the reservation. The reservation fee is non-refundable, and the bed will be released.",
    confirmText: "Cancel Reservation",
    variant: "danger",
  },
  approveCancellation: {
    title: "Approve Cancellation Request",
    message:
      "Approving will cancel the reservation and release the bed. The reservation fee is non-refundable.",
    confirmText: "Approve & Cancel",
    variant: "danger",
  },
  rejectCancellation: {
    title: "Reject Cancellation Request",
    message:
      "The cancellation request will be dismissed. The reservation stays active.",
    confirmText: "Reject Request",
    variant: "info",
  },
  approveForPayment: {
    title: "Approve for Payment",
    message:
      "This confirms the tenant's application and documents are approved. Payment will be unlocked for the applicant.",
    confirmText: "Approve for Payment",
    variant: "success",
  },
 requestRevision: {
 title: "Request Revision",
 message:
 "This keeps payment locked and asks the applicant to correct their application or documents.",
 confirmText: "Request Revision",
 variant: "info",
 },
 rejectApplication: {
 title: "Reject Application",
 message:
 "This rejects the application and keeps payment locked.",
 confirmText: "Reject Application",
 variant: "danger",
 },
};

const getQuickActionsEmptyState = (status, isMovedOut) => {
  const normStatus = normalizeReservationStatus(status);
  if (normStatus === "moveIn" || normStatus === "checked-in") {
    return {
      Icon: CheckCircle,
      iconColor: "#059669",
      bgColor: "#ECFDF5",
      borderColor: "#A7F3D0",
      title: "Tenant Currently Moved In",
      desc: "This tenant has completed move-in. Occupancy, room stay details, and utility billing are actively managed under Tenancy & Rooms.",
    };
  }
  if (normStatus === "moveOut" || isMovedOut) {
    return {
      Icon: CheckCircle,
      iconColor: "#475569",
      bgColor: "#F8FAFC",
      borderColor: "#E2E8F0",
      title: "Tenant Checked Out",
      desc: "This tenant's stay has ended and they have checked out of the room.",
    };
  }
  if (normStatus === "cancelled") {
    return {
      Icon: Info,
      iconColor: "#DC2626",
      bgColor: "#FEF2F2",
      borderColor: "#FCA5A5",
      title: "Reservation Cancelled",
      desc: "This reservation is cancelled. The assigned bed has been released and no further admin actions are required.",
    };
  }
  if (normStatus === "rejected") {
    return {
      Icon: Info,
      iconColor: "#DC2626",
      bgColor: "#FEF2F2",
      borderColor: "#FCA5A5",
      title: "Application Rejected",
      desc: "This application was rejected. No further admin actions are required.",
    };
  }
  if (normStatus === "approved_for_payment") {
    return {
      Icon: Info,
      iconColor: "#2563EB",
      bgColor: "#EFF6FF",
      borderColor: "#BFDBFE",
      title: "Awaiting Tenant Payment",
      desc: "Application approved. Waiting for the applicant to settle their reservation payment.",
    };
  }
  if (normStatus === "payment_pending") {
    return {
      Icon: Info,
      iconColor: "#D97706",
      bgColor: "#FFFBEB",
      borderColor: "#FDE68A",
      title: "Payment Processing",
      desc: "Payment has been submitted and is awaiting settlement confirmation from the gateway.",
    };
  }
  return {
    Icon: Info,
    iconColor: "#475569",
    bgColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    title: "No Quick Actions Available",
    desc: "There are no pending quick actions required for this reservation stage.",
  };
};

const fmt = (value) =>
 value === null || value === undefined || value === "" ? "\u2014" : value;

const fmtDate = sharedFmtDate;
const fmtDateTime = sharedFmtDateTime;

const toDateInputValue = (value) => {
 if (!value) return "";
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "";
 const year = date.getFullYear();
 const month = String(date.getMonth() + 1).padStart(2, "0");
 const day = String(date.getDate()).padStart(2, "0");
 return `${year}-${month}-${day}`;
};

const isSafeDocumentUrl = (url) =>
 /^https:\/\//i.test(String(url || "").trim());

const isTemporaryLocalUrl = (url) =>
 /^(file|content|blob):/i.test(String(url || "").trim());

const formatSelectedBed = (selectedBed) => {
 if (!selectedBed) return "\u2014";
 const position = selectedBed.position
 ? `${String(selectedBed.position).charAt(0).toUpperCase()}${String(selectedBed.position).slice(1)}`
 : "Bed";
 return `${position}${selectedBed.id ? ` (${selectedBed.id})` : ""}`;
};

const getTomorrowISO = () => {
 const tomorrow = new Date();
 tomorrow.setHours(0, 0, 0, 0);
 tomorrow.setDate(tomorrow.getDate() + 1);
 return toDateInputValue(tomorrow);
};

const VISIT_STATUS_CONFIG = {
 schedule_approved: {
 label: "Schedule Approved",
 color: "#0A5C9B",
 bg: "#E0EBF5",
 dot: "#3B82F6",
 },
 physical_visit_scheduled: {
  label: "Physical Visit Scheduled",
  color: "#1D4ED8",
  bg: "#DBEAFE",
 dot: "#3B82F6",
 },
 visit_completed: {
 label: "Visit Completed",
 color: "#047857",
 bg: "#D1FAE5",
 dot: "#10B981",
 },
 no_show: {
 label: "No-Show",
 color: "#B45309",
 bg: "#FEF3C7",
 dot: "#F59E0B",
 },
 rescheduled: {
 label: "Rescheduled",
 color: "#7C3AED",
 bg: "#EDE9FE",
 dot: "#8B5CF6",
 },
 visit_cancelled: {
  label: "Visit Cancelled",
  color: "#B91C1C",
  bg: "#FEE2E2",
  dot: "#EF4444",
 },
 allowed_without_visit: {
  label: "Allowed to Proceed Without Visit",
  color: "#0F766E",
  bg: "#CCFBF1",
  dot: "#14B8A6",
 },
};

const hasPhysicalVisit = (reservation) =>
 reservation?.viewingPreference === "physical_visit" ||
 reservation?.viewingType === "inperson" ||
 Boolean(reservation?.visitDate);

const getVisitStatusKey = (reservation) => {
 const explicit = String(reservation?.visitStatus || "")
 .trim()
 .toLowerCase()
 .replace(/^cancelled$/, "visit_cancelled")
 .replace(/^canceled$/, "visit_cancelled");
 if (VISIT_STATUS_CONFIG[explicit]) return explicit;
 if (reservation?.scheduleRejected) return "visit_cancelled";
 if (reservation?.visitApproved) return "visit_completed";
 if (reservation?.scheduleApproved) return "schedule_approved";
 if (hasPhysicalVisit(reservation)) return "physical_visit_scheduled";
 return "";
};

const normalizeVisitHistoryStatus = (status) => {
 const normalized = String(status || "").trim().toLowerCase();
 if (normalized === "completed") return "visit_completed";
 if (normalized === "approved") return "schedule_approved";
 if (normalized === "cancelled" || normalized === "canceled") return "visit_cancelled";
 return normalized;
};

const formatVisitSchedule = (date, time) => {
 const dateLabel = fmtDate(date);
 return `${dateLabel}${time ? ` at ${time}` : ""}`;
};

const getVisitHistoryTitle = (entry) => {
 const status = normalizeVisitHistoryStatus(entry?.status);
 return (
  VISIT_STATUS_CONFIG[status]?.label ||
  (status === "no_show"
    ? "No-Show"
    : status === "allowed_without_visit"
      ? "Allowed to Proceed Without Visit"
      : "Visit Updated")
 );
};

const getVisitHistoryScheduleLines = (entry) => {
 const status = normalizeVisitHistoryStatus(entry?.status);
 const currentSchedule = formatVisitSchedule(entry?.visitDate, entry?.visitTime);
 const nextSchedule = formatVisitSchedule(
  entry?.rescheduledToDate,
  entry?.rescheduledToTime,
 );

 if (status === "rescheduled") {
  const lines = [{ label: "Changed from:", value: currentSchedule }];
  if (entry?.rescheduledToDate || entry?.rescheduledToTime) {
   lines.push({ label: "Changed to:", value: nextSchedule });
  }
  return lines;
 }

 if (status === "visit_completed") {
  return [{ label: "Completed visit scheduled for:", value: currentSchedule }];
 }

 if (status === "schedule_approved" || status === "physical_visit_scheduled") {
  return [{ label: "Scheduled for:", value: currentSchedule }];
 }

 if (status === "no_show") {
  return [{ label: "No-show recorded for:", value: currentSchedule }];
 }

 if (status === "visit_cancelled") {
  return [{ label: "Cancelled visit scheduled for:", value: currentSchedule }];
 }

 if (status === "allowed_without_visit") {
  return entry?.visitDate || entry?.visitTime
   ? [{ label: "Visit requirement waived for:", value: currentSchedule }]
   : [{ label: "Visit requirement:", value: "Waived by admin" }];
 }

 return [{ label: "Visit schedule:", value: currentSchedule }];
};

const openImage = (url, title, options = {}) => {
 if (!url) {
 showNotification("No file available", "error");
 return;
 }
 if (options.requireHttps && !isSafeDocumentUrl(url)) {
 showNotification("This file link is invalid or temporary. Ask the applicant to re-upload the document.", "error");
 return;
 }
 if (!options.requireHttps && isTemporaryLocalUrl(url)) {
 showNotification("This file link is invalid or temporary.", "error");
 return;
 }

 const preview = window.open("", "_blank");
 preview?.document.write(
 `<html><head><title>${title}</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111;"><img src="${url}" style="max-width:100%;max-height:100vh;object-fit:contain;" alt="${title}"/></body></html>`,
 );
};

const buildDocs = (reservation) => [
 {
 label: "Selfie Photo",
 url: reservation.selfiePhotoUrl,
 precheck: reservation.documentPrechecks?.selfiePhoto,
 },
 {
 label: `Valid ID Front${reservation.validIDType ? ` (${reservation.validIDType})` : ""}`,
 url: reservation.validIDFrontUrl,
 precheck: reservation.documentPrechecks?.validIDFront,
 },
 {
 label: "Valid ID Back",
 url: reservation.validIDBackUrl,
 precheck: reservation.documentPrechecks?.validIDBack,
 },
 {
 label: "NBI Clearance",
 url: reservation.nbiClearanceUrl,
 reason: reservation.nbiReason,
 precheck: reservation.documentPrechecks?.nbiClearance,
 },
 {
 label: "Company/School ID",
 url: reservation.companyIDUrl,
 reason: reservation.companyIDReason,
 precheck: reservation.documentPrechecks?.companyID,
 },
];

const getPrecheckAppearance = (precheck) => {
 const precheckStatus = String(precheck?.precheckStatus || "").toLowerCase();
 if (precheckStatus === "ready_for_submission") {
 return { label: "Ready for Submission", color: "#047857", bg: "#D1FAE5" };
 }
 if (precheckStatus === "checking") {
 return { label: "Checking", color: "#1D4ED8", bg: "#DBEAFE" };
 }
 if (
 precheckStatus === "needs_reupload" &&
 precheck?.documentTypeStatus === "possible_mismatch"
 ) {
 return { label: "Check Document Type", color: "#B45309", bg: "#FEF3C7" };
 }
 if (precheckStatus === "needs_reupload") {
 return { label: "Needs Clearer Upload", color: "#B91C1C", bg: "#FEE2E2" };
 }
 if (precheckStatus === "manual_review_fallback") {
 return { label: "Manual Review Required", color: "#7C3AED", bg: "#EDE9FE" };
 }

 const status = String(precheck?.aiCheckStatus || "not_checked").toLowerCase();
 if (status === "passed") {
 return { label: "Ready for Submission", color: "#047857", bg: "#D1FAE5" };
 }
 if (status === "checking") {
 return { label: "Checking", color: "#1D4ED8", bg: "#DBEAFE" };
 }
 if (status === "warning") {
 return { label: "Check Document Type", color: "#B45309", bg: "#FEF3C7" };
 }
 if (status === "failed") {
 return { label: "Needs Clearer Upload", color: "#B91C1C", bg: "#FEE2E2" };
 }
 if (status === "error") {
 return { label: "Manual Review Required", color: "#7C3AED", bg: "#EDE9FE" };
 }
 return null;
};

const PERSONAL_FIELDS = (reservation) => [
 ["First Name", fmt(reservation.firstName || reservation.userId?.firstName)],
 ["Last Name", fmt(reservation.lastName || reservation.userId?.lastName)],
 ["Middle Name", fmt(reservation.middleName)],
 ["Nickname", fmt(reservation.nickname)],
 ["Birthday", fmtDate(reservation.birthday)],
 ["Marital Status", fmt(reservation.maritalStatus)],
 ["Nationality", fmt(reservation.nationality)],
 ["Education", fmt(reservation.educationLevel)],
 ["Address", fmt(formatSubmittedAddress(reservation.address))],
 ["Phone", fmt(reservation.phone || reservation.mobileNumber)],
];

const getInitials = (name) => {
 const initials = String(name || "")
 .trim()
 .split(/\s+/)
 .filter(Boolean)
 .slice(0, 2)
 .map((part) => part.charAt(0).toUpperCase())
 .join("");

 return initials || "GU";
};

const STAGE_GUIDANCE = {
 pending: {
 Icon: Calendar,
 message: "Waiting for the tenant to select a viewing preference.",
 },
 viewing_preference_selected: {
 Icon: Eye,
 message:
 "Viewing preference recorded. Waiting for the tenant to submit the application and required documents.",
 },
  visit_pending: {
  Icon: Eye,
  message:
  "Physical visit is pending schedule approval or completion. Payment remains locked.",
  },
  visit_approved: {
  Icon: ClipboardList,
  message:
  "Visit schedule is approved or the visit requirement has been cleared. Waiting for the tenant application.",
  },
 pending_application_review: {
 Icon: ClipboardList,
 message:
 "Application and documents are under review. Payment remains locked until admin approval.",
 },
 needs_revision: {
 Icon: ClipboardList,
 message:
 "Application needs corrections. Payment stays locked until the tenant resubmits and admin approves it.",
 },
 approved_for_payment: {
 Icon: CreditCard,
 message:
 "Application approved. The applicant can now proceed to reservation payment.",
 },
 rejected: {
 Icon: ClipboardList,
 message:
 "Application rejected. Payment stays locked unless the reservation is reopened.",
 },
 payment_pending: {
 Icon: CreditCard,
 message:
 "Payment submitted and awaiting automatic verification from the payment gateway.",
 },
};

export default function ReservationDetailsModal({
 reservation,
 focusCancellation = false,
 onClose,
 onUpdate,
}) {
 const reservationId = reservation?.id || reservation?._id || "";
 const reservationFeeAmount = reservation?.reservationFeeAmount || 2000;
 const reservationFeeLabel = `PHP ${reservationFeeAmount.toLocaleString("en-PH")}`;
 const queryClient = useQueryClient();
 const [adminNotes, setAdminNotes] = useState(reservation?.notes || "");
 const [visitRemarks, setVisitRemarks] = useState(
 reservation?.visitOutcomeNotes || "",
 );
 const [visitActionMode, setVisitActionMode] = useState("");
 const [rescheduleDate, setRescheduleDate] = useState(
 toDateInputValue(reservation?.visitDate),
 );
 const [rescheduleTime, setRescheduleTime] = useState(
 reservation?.visitTime || "",
 );
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [showDocs, setShowDocs] = useState(false);
 const [showPersonal, setShowPersonal] = useState(false);
 const [extendDays, setExtendDays] = useState(3);
 const [showExtendPrompt, setShowExtendPrompt] = useState(false);
 const [meterReadingVal, setMeterReadingVal] = useState("");
 const [actualMoveInDate, setActualMoveInDate] = useState(
 new Date().toISOString().slice(0, 10),
 );
 const [houseRulesPrepared, setHouseRulesPrepared] = useState(false);
 const [showMeterPrompt, setShowMeterPrompt] = useState(false);
 const cancellationPanelRef = useRef(null);
 const [confirmModal, setConfirmModal] = useState({
 open: false,
 title: "",
 message: "",
 variant: "info",
 onConfirm: null,
 });
 const [revisionModal, setRevisionModal] = useState({ open: false });

 useBodyScrollLock(Boolean(reservation));
 useEscapeClose(Boolean(reservation), onClose);
 const cancellationPending = Boolean(
   reservation?.cancellationRequested && reservation?.cancellationStatus === "pending",
 );

 useEffect(() => {
 if (!focusCancellation || !cancellationPending) return;

 const timer = window.setTimeout(() => {
 cancellationPanelRef.current?.scrollIntoView({
 block: "center",
 behavior: "smooth",
 });
 }, 120);

 return () => window.clearTimeout(timer);
 }, [cancellationPending, focusCancellation]);

 const status = reservation?.status || "pending";
 const physicalVisitSelected = hasPhysicalVisit(reservation);
 const visitStatusKey = getVisitStatusKey(reservation);
 const visitStatusAppearance = visitStatusKey
 ? VISIT_STATUS_CONFIG[visitStatusKey]
 : null;
 const hasVisitSchedule = Boolean(reservation?.visitDate && reservation?.visitTime);
 const visitActionAvailability = getVisitManagementAvailability({
 visitStatusKey,
 hasVisitSchedule,
 });
 const visitBranch = reservation?.roomId?.branch || reservation?.branch || "";
 const visitRoomId = reservation?.roomId?._id || reservation?.roomId || "";
 /** True for branches with physical submeters (e.g. Gil Puyat). False for fixed-rate branches (e.g. Guadalupe). */
 const branchUsesSubmeter = SUBMETER_BRANCHES.has(visitBranch);
 const appearance = getReservationStatusAppearance(status);
 const allowedActions = getAllowedReservationActions(status);
 const isMovedOut = status === "moveOut";
 const stageGuide = STAGE_GUIDANCE[status];
 const hasActionButtons =
   allowedActions.includes("moveIn") ||
   allowedActions.includes("extend") ||
   allowedActions.includes("approve_for_payment") ||
   allowedActions.includes("needs_revision") ||
   allowedActions.includes("rejected") ||
   (allowedActions.includes("cancelled") && !cancellationPending);
 const hasQuickActions = showMeterPrompt || Boolean(stageGuide) || hasActionButtons;
 const emptyStateInfo = useMemo(
   () => getQuickActionsEmptyState(status, isMovedOut),
   [status, isMovedOut],
 );

 const moveInDate = readMoveInDate(reservation);
 const isOverdue =
 status === "reserved" && moveInDate && new Date(moveInDate) < new Date();
 const daysOverdue = isOverdue
 ? Math.floor((new Date() - new Date(moveInDate)) / 86400000)
 : 0;
 const docs = reservation ? buildDocs(reservation) : [];
 const guestName = reservation?.customer ?? "Unknown";
 const guestInitials = getInitials(guestName);
 const guestPhotoUrl = resolveApplicantPhotoUrl(reservation);
 const availabilityParams = useMemo(
 () => ({
 branch: visitBranch,
 from: getTomorrowISO(),
 days: 30,
 roomId: visitRoomId,
 reservationId,
 }),
 [reservationId, visitBranch, visitRoomId],
 );
  const {
    data: visitAvailability,
    isLoading: loadingVisitAvailability,
  } = useVisitAvailability(availabilityParams, {
    enabled: physicalVisitSelected && Boolean(visitBranch),
  });
  const { data: latestUtilityRes } = useUtilityLatestReading(
    "electricity",
    visitRoomId,
    { enabled: Boolean(visitRoomId) && branchUsesSubmeter },
  );
  const previousMeterReading =
    latestUtilityRes?.reading ??
    latestUtilityRes?.data?.reading ??
    reservation?.roomId?.lastMeterReading ??
    null;
 const rescheduleDateOption = useMemo(
 () =>
 Array.isArray(visitAvailability?.dates)
 ? visitAvailability.dates.find((entry) => entry.date === rescheduleDate) || null
 : null,
 [rescheduleDate, visitAvailability],
 );
 const rescheduleSlots = rescheduleDateOption?.slots?.length
 ? rescheduleDateOption.slots
 : [];
 const visitHistory = Array.isArray(reservation?.visitHistory)
 ? reservation.visitHistory
     .slice()
     .sort(
       (a, b) =>
         new Date(b?.updatedAt || b?.scheduledAt || 0) -
         new Date(a?.updatedAt || a?.scheduledAt || 0),
     )
 : [];

 if (!reservation) return null;
 const viewingPreferenceLabel =
 reservation.viewingPreference === "remote_2d_viewing"
 ? "2D Remote Viewing"
 : reservation.viewingPreference === "urgent_move_in_review"
 ? "Urgent Move-in Review"
 : reservation.viewingPreference === "physical_visit" ||
   reservation.viewingType === "inperson" ||
   reservation.visitDate
 ? "Schedule Physical Visit"
 : "\u2014";
 const roomImages = Array.isArray(reservation.roomId?.images)
 ? reservation.roomId.images.filter(Boolean)
 : [];
 const bookingDetails = [
 ["Room", reservation.room ?? "\u2014"],
 ["Room type", reservation.roomType ?? "\u2014"],
 ["Bed / Slot", formatSelectedBed(reservation.selectedBed)],
 ["Branch", reservation.branch ?? "\u2014"],
 ["Viewing Preference", viewingPreferenceLabel],
 ["Move-in", fmtDate(moveInDate)],
 ["Lease term", reservation.leaseDuration ? `${reservation.leaseDuration} months` : "\u2014"],
 ["Contact", reservation.phone ?? reservation.mobileNumber ?? "\u2014"],
 [
 "Application Review",
 reservation.status === "pending_application_review"
 ? "Pending Application Review"
 : reservation.status === "needs_revision"
 ? "Needs Revision"
 : reservation.status === "approved_for_payment"
 ? "Approved for Payment"
 : reservation.status === "rejected"
 ? "Rejected"
 : "\u2014",
 { wide: true },
 ],
 ];
  const isRawId = (val) => typeof val === "string" && /^[0-9a-fA-F]{24}$/.test(val.trim());

  const cancelledByPerson = (() => {
    if (reservation.cancellationSource === "applicant" || reservation.cancellationSource === "user") {
      return reservation.customer || "Applicant";
    }
    if (reservation.cancellationSource === "system") {
      return "System Sweeper (24h Hold Expired)";
    }
    if (typeof reservation.cancelledBy === "object" && reservation.cancelledBy?.role) {
      const { role } = reservation.cancelledBy;
      if (role === "branch_admin") return "Branch Admin";
      if (role === "owner") return "System Owner";
      if (role === "applicant" || role === "tenant") return reservation.customer || "Applicant";
      return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    if (reservation.cancelledByName && !isRawId(reservation.cancelledByName)) {
      return reservation.cancelledByName;
    }
    if (reservation.cancellationSource === "admin" || reservation.cancelledAt) {
      return "Branch Admin";
    }
    return reservation.customer || "Applicant";
  })();

  const isCancelled = reservation.status === "cancelled" || Boolean(reservation.cancelledAt);
  const cancellationDetail = isCancelled
    ? reservation.cancelledAt
      ? `${fmtDate(reservation.cancelledAt)}${cancelledByPerson ? ` by ${cancelledByPerson}` : ""}`
      : `Cancelled by ${cancelledByPerson}`
    : null;


  const cancellationRequestDetails = [
    ["Requested", fmtDate(reservation.cancellationRequestedAt)],
    ["Requested By", cancelledByPerson || reservation.customer || "Applicant"],
    ["Reason", reservation.cancellationReason?.trim() || "No reason provided"],
  ];

  const activityTimeline = [
    {
      label: "Reservation Created",
      value: fmtDate(reservation.createdAt),
    },
    {
      label: "Target Move-in",
      value: fmtDate(moveInDate),
    },
    reservation.finalMoveInDate
      ? {
          label: "Final Move-in",
          value: fmtDate(reservation.finalMoveInDate),
        }
      : null,
    cancellationDetail
      ? {
          label: "Cancellation",
          value: cancellationDetail,
        }
      : null,
    {
      label: "Current Status",
      value: appearance.label,
    },
  ].filter(Boolean);

 const pricingDisplay = reservation?.pricingDisplay || null;
 const { pricingIsUsable, pricingIsMissing, pricingBlocksApproval } =
 resolveReservationApprovalPricingGate(pricingDisplay);
 const formatPhp = (value) =>
 Number.isFinite(Number(value))
 ? `PHP ${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
 : "—";
 const leaseCategoryLabel =
 pricingDisplay?.leaseType === "long_term"
 ? "Long-term"
 : pricingDisplay?.leaseType === "short_term"
 ? "Short-term"
 : "—";

 const doAction = (key, apiCall, successMsg) => {
 const modalConfig =
 key === "extend"
 ? {
 title: `Extend Move-in by ${extendDays} Day${extendDays > 1 ? "s" : ""}`,
 message: `Push the move-in date forward by ${extendDays} day${extendDays > 1 ? "s" : ""}. Reservation stays reserved.`,
 confirmText: "Extend",
 variant: "info",
 }
 : key === "cancel"
 ? {
 ...ACTION_MSGS.cancel,
 message: `The ${reservationFeeLabel} reservation fee is non-refundable. The bed will be freed and user reset to applicant.`,
 }
 : ACTION_MSGS[key];

 setConfirmModal({
 open: true,
 ...modalConfig,
 onConfirm: async () => {
 setConfirmModal((previous) => ({ ...previous, open: false }));
 setIsSubmitting(true);

 try {
 await apiCall();
 showNotification(successMsg, "success");
 onUpdate?.();
 onClose();
 } catch (error) {
 const errorCode = error?.response?.data?.code;
 const isCancellationReviewAction =
 key === "approveCancellation" || key === "rejectCancellation";
 if (isCancellationReviewAction) {
 try {
 const latest = await reservationApi.getById(reservation.id);
 const latestReservation = latest?.reservation || latest;
 const latestCancellationPending =
 latestReservation?.cancellationRequested &&
 latestReservation?.cancellationStatus === "pending";
 const reviewWasApplied =
 key === "approveCancellation"
 ? latestReservation?.status === "cancelled" ||
 latestReservation?.cancellationStatus === "approved"
 : !latestCancellationPending &&
 (latestReservation?.cancellationStatus === "rejected" ||
 latestReservation?.cancellationRequested === false);

 if (reviewWasApplied) {
 showNotification(successMsg, "success");
 onUpdate?.();
 onClose();
 return;
 }
 } catch (refreshError) {
 console.warn("Failed to verify cancellation review state:", refreshError);
 }
 }
 if (
 isCancellationReviewAction &&
 errorCode === "NO_PENDING_REQUEST"
 ) {
 showNotification(
 "This cancellation request was already reviewed. Refreshing reservation details.",
 "info",
 );
 onUpdate?.();
 onClose();
 return;
 }
 console.error(error);
 showNotification(
 getFriendlyError(error, "Action failed. Please try again."),
 "error",
 );
 } finally {
 setIsSubmitting(false);
 }
 },
 });
 };

 const runVisitManagementAction = ({
 action,
 payload = {},
 successMsg,
 modalTitle,
 modalMessage,
 confirmText,
 variant = "info",
 }) => {
 setConfirmModal({
 open: true,
 title: modalTitle,
 message: modalMessage,
 confirmText,
 variant,
 onConfirm: async () => {
 setConfirmModal((previous) => ({ ...previous, open: false }));
 setIsSubmitting(true);

     try {
 const result = await reservationApi.manageVisit(reservationId, {
 action,
 note: visitRemarks.trim(),
 ...payload,
 });
 await Promise.all([
 queryClient.invalidateQueries({ queryKey: ["reservations", "list"] }),
 queryClient.invalidateQueries({ queryKey: ["reservations", "visitAvailability"] }),
 reservationId
 ? queryClient.invalidateQueries({ queryKey: ["reservations", "detail", reservationId] })
 : Promise.resolve(),
 ]);
 showNotification(result?.message || successMsg, "success");
 if (result?.emailWarning) {
 showNotification(result.emailWarning, "warning");
 }
 onUpdate?.();
 onClose();
 } catch (error) {
 console.error(error);
 showNotification(
 getFriendlyError(error, "Visit update failed. Please try again."),
 "error",
 );
 } finally {
 setIsSubmitting(false);
 }
 },
 });
 };

 const handleRescheduleVisit = async () => {
 if (!visitActionAvailability.canReschedule) {
 showNotification(
 visitActionAvailability.helperMessage ||
 "This visit cannot be rescheduled from its current status.",
 "warning",
 );
 return;
 }
 if (!rescheduleDate) {
 showNotification("Select a new visit date before rescheduling.", "warning");
 return;
 }
 if (!rescheduleTime) {
 showNotification("Select a new visit time slot before rescheduling.", "warning");
 return;
 }

 setIsSubmitting(true);

  try {
 const result = await reservationApi.manageVisit(reservationId, {
 action: "reschedule",
 note: visitRemarks.trim(),
 visitDate: rescheduleDate,
 visitTime: rescheduleTime,
 });
 await Promise.all([
 queryClient.invalidateQueries({ queryKey: ["reservations", "list"] }),
 queryClient.invalidateQueries({ queryKey: ["reservations", "visitAvailability"] }),
 reservationId
 ? queryClient.invalidateQueries({ queryKey: ["reservations", "detail", reservationId] })
 : Promise.resolve(),
 ]);
 showNotification(result?.message || "Visit schedule updated", "success");
 if (result?.emailWarning) {
 showNotification(result.emailWarning, "warning");
 }
 onUpdate?.();
 onClose();
 } catch (error) {
 console.error(error);
 showNotification(
 getFriendlyError(error, "Unable to reschedule the visit right now."),
 "error",
 );
 } finally {
 setIsSubmitting(false);
 }
 };

 const saveNotes = async (event) => {
 event.preventDefault();
 setIsSubmitting(true);

 try {
 await reservationApi.update(reservationId, { notes: adminNotes });
 showNotification("Notes saved", "success");
 onUpdate?.();
 } catch {
 showNotification("Failed to save notes", "error");
 } finally {
 setIsSubmitting(false);
 }
 };

 return createPortal(
 <>
 <div className="rdm-overlay" onClick={onClose}>
 <div className="rdm" onClick={(event) => event.stopPropagation()}>
 <div className="rdm-top-card">
 <div className="rdm-top-header">
 <div className="rdm-guest-block">
 <ProfileAvatar
 className="rdm-avatar"
 src={guestPhotoUrl}
 initials={guestInitials}
 alt={`${guestName} profile photo`}
 size={44}
 />
 <div className="rdm-guest-copy">
 <h2 className="rdm-title">{guestName}</h2>
 <div className="rdm-header-meta">
 <span className="rdm-code">
 {reservation.reservationCode || "\u2014"}
 </span>
 <span className="rdm-header-sep">&bull;</span>
 <span className="rdm-header-detail">
 {reservation.email ?? "\u2014"}
 </span>
 </div>
 </div>
 </div>
 <div className="rdm-header-actions">
 <div
 className="rdm-status-chip"
 style={{
 "--rdm-status-bg": appearance.bg,
 "--rdm-status-color": appearance.color,
 "--rdm-status-dot": appearance.dot,
 }}
 >
 <span className="rdm-status-dot" />
 {appearance.label}
 </div>
 {isOverdue && (
 <div className="rdm-overdue-chip">
 {daysOverdue} day{daysOverdue > 1 ? "s" : ""} overdue
 </div>
 )}
 <button
 className="rdm-close"
 onClick={onClose}
 aria-label="Close"
 >
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
 <path
 d="M18 6L6 18M6 6l12 12"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 />
 </svg>
 </button>
 </div>
 </div>
 </div>

 <div className="rdm-body rdm-layout">
 <div className="rdm-main-column">
 {cancellationPending && (
 <div
 ref={cancellationPanelRef}
 className={`rdm-section rdm-surface-card rdm-cancellation-request${
 focusCancellation ? " rdm-cancellation-request--focused" : ""
 }`}
 >
 <div className="rdm-cancellation-request__header">
 <div>
 <h4 className="rdm-section-title rdm-cancellation-request__title">
 Cancellation Request
 </h4>
 <p className="rdm-cancellation-request__copy">
 Review this tenant request before releasing the bed. The reservation fee is non-refundable.
 </p>
 </div>
 <span className="rdm-cancellation-request__badge">
 Pending Review
 </span>
 </div>
 <div className="rdm-info-grid rdm-cancellation-request__details">
 {cancellationRequestDetails.map(([label, value]) => (
 <div className="rdm-info-item" key={label}>
 <span className="rdm-info-label">{label}</span>
 <span className="rdm-info-value">{value}</span>
 </div>
 ))}
 </div>
 <div className="rdm-cancellation-request__impact">
 <AlertTriangle size={15} style={{ flexShrink: 0 }} />
 <span>Approving cancels the reservation and releases the assigned bed.</span>
 </div>
 <div className="rdm-cancellation-request__actions">
 <button
 className="rdm-action rdm-action-danger-solid"
 onClick={() =>
 doAction(
 "approveCancellation",
 () => reservationApi.approveCancellationRequest(reservation.id),
 "Cancellation approved. Reservation cancelled and bed released.",
 )
 }
 disabled={isSubmitting}
 >
 Approve Cancellation
 </button>
 <button
 className="rdm-action rdm-action-neutral-outline"
 onClick={() =>
 doAction(
 "rejectCancellation",
 () => reservationApi.rejectCancellationRequest(reservation.id),
 "Cancellation request rejected. Reservation remains active.",
 )
 }
 disabled={isSubmitting}
 >
 Reject Request
 </button>
 </div>
 </div>
 )}

 <div className="rdm-section rdm-surface-card">
 <h3 className="rdm-top-section-label">Booking Details</h3>
 <div className="rdm-info-grid">
 {bookingDetails.map(([label, value, opts = {}]) => (
 <div className={`rdm-info-item${opts.wide ? " rdm-info-item--wide" : ""}`} key={label}>
 <span className="rdm-info-label">{label}</span>
 <span
 className={`rdm-info-value ${label === "Move-in" && isOverdue ? "rdm-danger" : ""}`}
 >
 {value}
 </span>
 </div>
 ))}
 </div>
 </div>

 <div className="rdm-section rdm-surface-card">
 <h3 className="rdm-top-section-label">Pricing &amp; Initial Payment</h3>
 {pricingIsUsable ? (
 <>
 <div className="rdm-info-grid">
 <div className="rdm-info-item">
 <span className="rdm-info-label">Lease Category</span>
 <span className="rdm-info-value">{leaseCategoryLabel}</span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Regular Monthly Rate</span>
 <span className="rdm-info-value">{formatPhp(pricingDisplay.regularMonthlyRate)}</span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Discount</span>
 <span className="rdm-info-value">
 {Number.isFinite(Number(pricingDisplay.discountPercentage))
 ? `${pricingDisplay.discountPercentage}% (${formatPhp(pricingDisplay.discountAmount)})`
 : "—"}
 </span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Final Monthly Rate</span>
 <span className="rdm-info-value">{formatPhp(pricingDisplay.finalMonthlyRate)}</span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Advance Rent</span>
 <span className="rdm-info-value">{formatPhp(pricingDisplay.advanceRentAmount)}</span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Security Deposit</span>
 <span className="rdm-info-value">{formatPhp(pricingDisplay.securityDepositAmount)}</span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Reservation-Fee Credit</span>
 <span className="rdm-info-value">{formatPhp(pricingDisplay.reservationFeeAmount)}</span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">
 {pricingDisplay.status === "snapshotted" ? "Initial Payment Total" : "Estimated Initial Payment Total"}
 </span>
 <span className="rdm-info-value">{formatPhp(pricingDisplay.estimatedInitialPaymentTotal)}</span>
 </div>
 </div>
 </>
 ) : (
 <p style={{ fontSize: "0.85rem", color: "#B91C1C", fontWeight: 600 }}>
 {pricingIsMissing
 ? "Pricing information unavailable. Refresh and try again."
 : <>
 Pricing configuration is unavailable. This reservation cannot be approved yet.
 {pricingDisplay?.message ? ` (${pricingDisplay.message})` : ""}
 </>}
 </p>
 )}
 </div>


 <div className="rdm-section rdm-surface-card">
 <h4 className="rdm-section-title">Viewing Preference</h4>
 <div className="rdm-info-grid">
 <div className="rdm-info-item">
 <span className="rdm-info-label">Selected Option</span>
 <span className="rdm-info-value">{viewingPreferenceLabel}</span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Preferred Visit Date</span>
 <span className="rdm-info-value">{fmtDate(reservation.visitDate)}</span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Preferred Visit Time</span>
 <span className="rdm-info-value">{fmt(reservation.visitTime)}</span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Visit Code</span>
 <span className="rdm-info-value">
 {reservation.visitCode ? (
 <button
 type="button"
 className="rdm-visit-code-badge"
 onClick={() => {
 navigator.clipboard.writeText(reservation.visitCode);
 showNotification("Visit Code copied to clipboard!", "success", 2000);
 }}
 title="Click to copy Visit Code"
 >
 <span>{reservation.visitCode}</span>
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
 </button>
 ) : (
 "\u2014"
 )}
 </span>
 </div>
 <div className="rdm-info-item rdm-info-item--wide">
 <span className="rdm-info-label">Remote Viewing Acknowledgement</span>
 <span className="rdm-info-value">
 {reservation.remoteViewingAcknowledged ? "Yes" : "No"}
 </span>
 </div>
 <div className="rdm-info-item rdm-info-item--wide">
 <span className="rdm-info-label">Urgent Move-in Review</span>
 <span className="rdm-info-value">
 {reservation.isUrgentMoveIn ? "Requested" : "No"}
 </span>
 </div>
 <div className="rdm-info-item rdm-info-item--wide">
 <span className="rdm-info-label">Applicant Questions / Concerns</span>
 <span className="rdm-info-value">
 {fmt(reservation.remoteViewingQuestions || reservation.applicationReviewReason)}
 </span>
 </div>
 </div>
 {roomImages.length > 0 && (
  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
  <span className="rdm-info-label" style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
  <Camera size={13} style={{ color: "#64748B" }} />
  <span>Assigned Room Photos</span>
  </span>
  <span style={{ fontSize: "0.74rem", color: "#64748B", fontWeight: 500 }}>
  {roomImages.length} photo{roomImages.length > 1 ? "s" : ""}
  </span>
  </div>
  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
  {roomImages.map((imageUrl, index) => (
  <button
  key={`${imageUrl}-${index}`}
  type="button"
  onClick={() => openImage(imageUrl, `Room Photo ${index + 1}`)}
  style={{
  position: "relative",
  width: 80,
  height: 60,
  borderRadius: 8,
  overflow: "hidden",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "#F8FAFC",
  padding: 0,
  cursor: "pointer",
  transition: "all 0.15s ease-in-out",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
  }}
  className="hover:border-slate-400 focus:outline-none group"
  title={`Click to view Room Photo ${index + 1}`}
  >
  <img
  src={imageUrl}
  alt={`Room photo ${index + 1}`}
  style={{ width: "100%", height: "100%", objectFit: "cover" }}
  onError={(event) => {
  event.target.style.display = "none";
  if (event.target.nextSibling) event.target.nextSibling.style.display = "flex";
  }}
  />
  <div
  style={{
  display: "none",
  width: "100%",
  height: "100%",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 2,
  background: "#F1F5F9",
  color: "#64748B",
  fontSize: "0.68rem",
  }}
  >
  <ImageIcon size={16} />
  <span>Photo {index + 1}</span>
  </div>
  <div
  style={{
  position: "absolute",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#FFFFFF",
  opacity: 0,
  transition: "opacity 0.15s ease",
  }}
  className="group-hover:opacity-100"
  >
  <Maximize2 size={15} />
  </div>
  </button>
  ))}
  </div>
  </div>
  )}
 </div>

 {physicalVisitSelected && (
 <div className="rdm-section rdm-surface-card">
 <div className="rdm-visit-management-header">
 <div>
 <h4 className="rdm-section-title" style={{ marginBottom: 6 }}>
 Visit Management
 </h4>
 <p className="rdm-visit-management-copy">
 Visit completion only records attendance. Application review and payment remain separate.
 </p>
 </div>
 {visitStatusAppearance && (
 <div
 className="rdm-status-chip rdm-visit-status-chip"
 style={{
 background: "transparent",
 color: visitStatusAppearance.color,
 padding: "2px 0",
 }}
 >
 <span
 className="rdm-status-dot"
 style={{ background: visitStatusAppearance.dot }}
 />
 {visitStatusAppearance.label}
 </div>
 )}
 </div>

 {visitActionAvailability.completed && (
 <div className="rdm-visit-completed-banner">
 {visitActionAvailability.helperMessage}
 </div>
 )}

 <div className="rdm-info-grid">
 <div className="rdm-info-item">
 <span className="rdm-info-label">Preferred Visit Date</span>
 <span className="rdm-info-value">{fmtDate(reservation.visitDate)}</span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Preferred Visit Time</span>
 <span className="rdm-info-value">{fmt(reservation.visitTime)}</span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Visit Code</span>
 <span className="rdm-info-value">
 {reservation.visitCode ? (
 <button
 type="button"
 className="rdm-visit-code-badge"
 onClick={() => {
 navigator.clipboard.writeText(reservation.visitCode);
 showNotification("Visit Code copied to clipboard!", "success", 2000);
 }}
 title="Click to copy Visit Code"
 >
 <span>{reservation.visitCode}</span>
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
 </button>
 ) : (
 "\u2014"
 )}
 </span>
 </div>
 <div className="rdm-info-item">
 <span className="rdm-info-label">Current Visit Status</span>
 <span className="rdm-info-value">
 {visitStatusAppearance?.label || "\u2014"}
 </span>
 </div>
 {reservation.visitOutcomeUpdatedAt && (
 <div className="rdm-info-item">
 <span className="rdm-info-label">Last Updated</span>
 <span className="rdm-info-value">
 {fmtDateTime(reservation.visitOutcomeUpdatedAt)}
 </span>
 </div>
 )}
 {reservation.visitOutcomeUpdatedByName && (
 <div className="rdm-info-item">
 <span className="rdm-info-label">Updated By</span>
 <span className="rdm-info-value">
 {fmt(reservation.visitOutcomeUpdatedByName)}
 </span>
 </div>
 )}
 </div>

 {reservation.visitOutcomeNotes && (
 <div className="rdm-visit-management-note">
 <span className="rdm-info-label">Latest Visit Remarks</span>
 <p>{reservation.visitOutcomeNotes}</p>
 </div>
 )}

 {visitHistory.length > 0 && (
 <div className="rdm-visit-management-note" style={{ marginTop: 12 }}>
 <span className="rdm-info-label">Visit History</span>
 <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
 {visitHistory.slice(0, 5).map((entry, index) => (
 <div
 key={`${entry.status || "visit"}-${entry.updatedAt || entry.scheduledAt || index}`}
 style={{
 padding: "10px 12px",
 borderRadius: 8,
 background: "transparent",
 border: "1px solid rgba(15, 23, 42, 0.08)",
 }}
 >
 <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
 <strong style={{ fontSize: "0.84rem", color: "#0F172A" }}>
 {getVisitHistoryTitle(entry)}
 </strong>
 <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
 {fmtDateTime(entry.updatedAt || entry.scheduledAt)}
 </span>
 </div>
 {getVisitHistoryScheduleLines(entry).map((line) => (
 <div
 key={`${line.label}-${line.value}`}
 style={{ fontSize: "0.8rem", color: "#334155", marginTop: 6 }}
 >
 <span style={{ fontWeight: 650 }}>{line.label}</span> {line.value}
 </div>
 ))}
 {entry.updatedByName && (
 <div style={{ fontSize: "0.78rem", color: "#64748B", marginTop: 4 }}>
 Updated by {entry.updatedByName}
 </div>
 )}
 {entry.notes && (
 <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: 6 }}>
 {entry.notes}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

                 {!visitActionAvailability.completed && (
                 <div className="rdm-visit-management-panel">
                 {visitStatusKey === "allowed_without_visit" ? (
                 <div className="rdm-visit-action-helper rdm-visit-action-helper-info">
                 Visit requirement has been waived. Applicant may proceed without a physical visit.
                 </div>
                 ) : (
                 <>
                 <label className="rdm-visit-field">
                 <span className="rdm-info-label">Visit Remarks</span>
                 <textarea
                 className="rdm-notes-input"
                 placeholder="Add optional visit remarks for the next action..."
                 value={visitRemarks}
                 onChange={(event) => setVisitRemarks(event.target.value)}
                 rows="2"
                 />
                 </label>

                  <div className="rdm-visit-actions-grid">
                  {visitActionAvailability.canApproveSchedule && (
                  <button type="button" className="rdm-action rdm-action-outline"
                  disabled={isSubmitting}
                  onClick={() => runVisitManagementAction({
                    action: "approve_schedule", successMsg: "Visit schedule approved",
                    modalTitle: "Approve Visit Schedule",
                    modalMessage: "Confirm the applicant's selected physical visit schedule. The application will remain locked until the visit is completed or waived.",
                    confirmText: "Approve Schedule",
                  })}>
                  Approve Schedule
                  </button>
                  )}
                  {visitActionAvailability.canRejectSchedule && (
                  <button type="button" className="rdm-action rdm-action-outline rdm-action-outline-danger"
                  disabled={isSubmitting}
                  onClick={() => runVisitManagementAction({
                    action: "reject_schedule", successMsg: "Visit schedule rejected",
                    modalTitle: "Reject Visit Schedule",
                    modalMessage: "Reject the selected visit schedule and ask the applicant to choose another date or time.",
                    confirmText: "Reject Schedule", variant: "warning",
                  })}>
                  Reject Schedule
                  </button>
                  )}
                  {visitActionAvailability.canMarkVisited && (
                  <button type="button" className="rdm-action rdm-action-outline"
                  disabled={isSubmitting}
                 onClick={() => runVisitManagementAction({
                   action: "mark_visited", successMsg: "Visit marked as completed",
                   modalTitle: "Mark As Visited",
                   modalMessage: "Record that the applicant attended the scheduled physical visit. This will not approve the application or unlock payment.",
                   confirmText: "Mark as Visited",
                 })}>
                 Mark as Visited
                 </button>
                 )}
                 {visitActionAvailability.canMarkNoShow && (
                 <button type="button" className="rdm-action rdm-action-outline"
                 disabled={isSubmitting}
                 onClick={() => runVisitManagementAction({
                   action: "mark_no_show", successMsg: "Visit marked as no-show",
                   modalTitle: "Mark As No-Show",
                   modalMessage: "Record that the applicant missed the scheduled physical visit. The reservation and application review will remain separate.",
                   confirmText: "Mark No-Show", variant: "warning",
                 })}>
                 Mark as No-Show
                 </button>
                 )}
                 {visitActionAvailability.canReschedule && (
                 <button type="button"
                 className={`rdm-action rdm-action-outline${visitActionMode === "reschedule" ? " rdm-action-outline-active" : ""}`}
                 disabled={isSubmitting}
                 onClick={() => setVisitActionMode((p) => p === "reschedule" ? "" : "reschedule")}>
                 Reschedule Visit
                 </button>
                 )}
                 {visitActionAvailability.canCancelVisit && (
                 <button type="button" className="rdm-action rdm-action-outline rdm-action-outline-danger"
                 disabled={isSubmitting}
                 onClick={() => runVisitManagementAction({
                   action: "cancel_visit", successMsg: "Visit schedule cancelled",
                   modalTitle: "Cancel Visit Schedule",
                   modalMessage: "Cancel only the physical visit schedule. This will not cancel the reservation or unlock payment.",
                   confirmText: "Cancel Visit", variant: "danger",
                 })}>
                 Cancel Visit Schedule
                 </button>
                 )}
                 {visitActionAvailability.canAllowWithoutVisit && (
                 <button type="button" className="rdm-action rdm-action-outline"
                 disabled={isSubmitting}
                 onClick={() => runVisitManagementAction({
                   action: "allow_without_visit", successMsg: "Applicant may proceed without a completed visit",
                   modalTitle: "Allow Application Without Visit",
                   modalMessage: "Allow the applicant to continue to the tenant application without a completed physical visit. This will not approve the application or unlock payment.",
                   confirmText: "Allow Application",
                 })}>
                 Allow Application Without Visit
                 </button>
                 )}
                 </div>
                 </>
                 )}

 {visitActionMode === "reschedule" && visitActionAvailability.canReschedule && (
 <div className="rdm-visit-reschedule">
 <div className="rdm-visit-reschedule-grid">
 <label className="rdm-visit-field">
 <span className="rdm-info-label">New Visit Date</span>
 <input
 type="date"
 className="rdm-notes-input"
 value={rescheduleDate}
 onChange={(event) => {
 setRescheduleDate(event.target.value);
 if (rescheduleTime) setRescheduleTime("");
 }}
 min={getTomorrowISO()}
 />
 </label>
 <div className="rdm-visit-field">
 <span className="rdm-info-label">New Visit Time</span>
 <div className="rdm-visit-slot-grid">
 {loadingVisitAvailability ? (
 <span className="rdm-visit-slot-empty">Loading available slots...</span>
 ) : rescheduleDate && rescheduleSlots.length > 0 ? (
 rescheduleSlots.map((slot) => (
 <button
 key={slot.label}
 type="button"
 className={`rdm-visit-slot${rescheduleTime === slot.label ? " selected" : ""}`}
 disabled={!slot.available}
 onClick={() => setRescheduleTime(slot.label)}
 >
 <span>{slot.label}</span>
 {!slot.available && slot.disabledReason ? (
 <small>{slot.disabledReason}</small>
 ) : slot.available && slot.remaining != null ? (
 <small>{slot.remaining} left</small>
 ) : null}
 </button>
 ))
 ) : rescheduleDate ? (
 <span className="rdm-visit-slot-empty">
 No available time slots for the selected date.
 </span>
 ) : (
 <span className="rdm-visit-slot-empty">
 Select a new date to load available visit time slots.
 </span>
 )}
 </div>
 </div>
 </div>
 <div className="rdm-visit-reschedule-actions">
 <button
 type="button"
 className="rdm-action rdm-action-outline"
 disabled={isSubmitting}
 onClick={() => setVisitActionMode("")}
 >
 Keep Current Schedule
 </button>
 <button
 type="button"
 className="rdm-action rdm-action-dark"
 disabled={isSubmitting || !rescheduleDate || !rescheduleTime}
 onClick={handleRescheduleVisit}
 >
 Save Reschedule
 </button>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 )}

 <div className="rdm-section rdm-surface-card">
 <h4 className="rdm-section-title">Admin Notes</h4>
 <form onSubmit={saveNotes} className="rdm-notes-form">
 <textarea
 className="rdm-notes-input"
 placeholder="Add internal notes..."
 value={adminNotes}
 onChange={(event) => setAdminNotes(event.target.value)}
 rows="2"
 />
 {adminNotes !== (reservation?.notes || "") && (
 <button
 type="submit"
 className="rdm-action rdm-action-outline"
 disabled={isSubmitting}
 >
 {isSubmitting ? "Saving..." : "Save Notes"}
 </button>
 )}
 </form>
 </div>

 <button
 type="button"
 className="rdm-expand-btn"
 onClick={() => setShowPersonal((previous) => !previous)}
 >
 Personal Details
 <svg
 className={`rdm-chevron ${showPersonal ? "open" : ""}`}
 width="14"
 height="14"
 viewBox="0 0 24 24"
 fill="none"
 >
 <path
 d="M6 9l6 6 6-6"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 />
 </svg>
 </button>
 {showPersonal && (
 <div className="rdm-expand-content">
 <div className="rdm-info-grid">
 {PERSONAL_FIELDS(reservation).map(([label, value]) => (
 <div className="rdm-info-item" key={label}>
 <span className="rdm-info-label">{label}</span>
 <span className="rdm-info-value">{value}</span>
 </div>
 ))}
 </div>

 {reservation.emergencyContact && (
 <div className="rdm-info-grid" style={{ marginTop: 10 }}>
 {[
 [
 "Emergency Contact",
 fmt(reservation.emergencyContact.name),
 ],
 [
 "Relationship",
 fmt(reservation.emergencyContact.relationship),
 ],
 [
 "Contact #",
 fmt(reservation.emergencyContact.contactNumber),
 ],
 ].map(([label, value]) => (
 <div className="rdm-info-item" key={label}>
 <span className="rdm-info-label">{label}</span>
 <span className="rdm-info-value">{value}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 <button
 type="button"
 className="rdm-expand-btn"
 onClick={() => setShowDocs((previous) => !previous)}
 >
 Submitted Documents
 <svg
 className={`rdm-chevron ${showDocs ? "open" : ""}`}
 width="14"
 height="14"
 viewBox="0 0 24 24"
 fill="none"
 >
 <path
 d="M6 9l6 6 6-6"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 />
 </svg>
 </button>
 {showDocs && (
 <div className="rdm-expand-content">
 {docs.map((doc, index) => (
 <div key={`${doc.label}-${index}`} className="rdm-doc-row">
 <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
 <span className="rdm-doc-label">{doc.label}</span>
  {(() => {
  const appearance = getPrecheckAppearance(doc.precheck);
  const notes = [
  doc.precheck?.applicantMessage,
  doc.precheck?.adminNote,
  ...(Array.isArray(doc.precheck?.aiCheckWarnings)
  ? doc.precheck.aiCheckWarnings
  : []),
  ]
  .map((note) => String(note || "").trim())
  .filter(Boolean);

  if (!appearance && notes.length === 0) return null;

  const tooltipText =
  notes.length > 0
  ? notes.join(" • ")
  : appearance?.label || "Manual admin inspection recommended";

  const isWarningState =
  appearance &&
  (appearance.label.includes("Manual") ||
  appearance.label.includes("Clearer") ||
  appearance.label.includes("Type"));

  return (
  <div style={{ display: "inline-flex", alignItems: "center", marginTop: 2 }}>
  {appearance ? (
  <span
  title={`Document Review Note:\n• ${tooltipText}`}
  style={{
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: "0.72rem",
  fontWeight: 600,
  background: appearance.bg,
  color: appearance.color,
  cursor: "help",
  border: `1px solid ${appearance.color}30`,
  }}
  >
  {isWarningState ? (
  <AlertTriangle size={12} style={{ flexShrink: 0 }} />
  ) : (
  <CheckCircle size={12} style={{ flexShrink: 0 }} />
  )}
  <span>{appearance.label}</span>
  </span>
  ) : null}
  </div>
  );
  })()}
 </div>
 {doc.url && isSafeDocumentUrl(doc.url) ? (
 <button
 type="button"
 className="rdm-doc-view"
 onClick={() => openImage(doc.url, doc.label, { requireHttps: true })}
 >
 View
 </button>
 ) : (
 <span className="rdm-doc-na">
 {doc.url
 ? "Invalid file link. Ask applicant to re-upload."
 : doc.reason
   ? `Skipped: ${doc.reason}`
   : "Not submitted"}
 </span>
 )}
 </div>
 ))}
 </div>
 )}
 </div>

 <aside className="rdm-side-column">
 <div className="rdm-side-card">
 <h4 className="rdm-side-title">Quick Summary</h4>
 <div className="rdm-side-summary-list">
 <div className="rdm-side-summary-item">
 <span>Reservation Fee</span>
 <strong>{reservationFeeLabel}</strong>
 </div>
 <div className="rdm-side-summary-item">
 <span>Payment Status</span>
 <strong>{fmt(reservation.paymentStatus)}</strong>
 </div>
 <div className="rdm-side-summary-item">
 <span>Payment Method</span>
 <strong>{formatPaymentMethod(reservation.paymentMethod)}</strong>
 </div>
 </div>
 </div>

 {status !== "cancelled" && !isMovedOut && (
 <div className="rdm-side-card">
 <h4 className="rdm-side-title">
 {showMeterPrompt ? "Move-In Details" : "Quick Actions"}
 </h4>
 <div className="rdm-actions-card">
 {!hasQuickActions ? (
 <div
 className="rdm-empty-actions"
 style={{
 background: emptyStateInfo.bgColor,
 border: `1px solid ${emptyStateInfo.borderColor}`,
 }}
 >
 <div
 className="rdm-empty-actions-icon-wrap"
 style={{ background: "rgba(255, 255, 255, 0.7)" }}
 >
 <emptyStateInfo.Icon
 size={18}
 style={{ color: emptyStateInfo.iconColor }}
 />
 </div>
 <div className="rdm-empty-actions-content">
 <h5 className="rdm-empty-actions-title">
 {emptyStateInfo.title}
 </h5>
 <p className="rdm-empty-actions-desc">
 {emptyStateInfo.desc}
 </p>
 </div>
 </div>
 ) : showMeterPrompt ? (
 <div className="rdm-inline-movein-form">
 <p className="rdm-inline-form-copy">
 {branchUsesSubmeter
   ? "Confirm actual move-in date and initial meter reading before recording occupancy."
   : "Confirm actual move-in date before recording occupancy."}
 </p>

 <div className="rdm-inline-field">
 <label className="rdm-inline-label">
 Actual Move-In Date <span className="rdm-asterisk">*</span>
 </label>
 <input
 type="date"
 value={actualMoveInDate}
 onChange={(event) => setActualMoveInDate(event.target.value)}
 className="rdm-inline-input"
 />
 </div>

 {branchUsesSubmeter && (
 <div className="rdm-inline-field">
                       <div className="rdm-inline-label-group">
                         <label className="rdm-inline-label">
                           Starting Meter Reading <span className="rdm-asterisk">*</span>
                         </label>
                         <div
                           className="rdm-meter-info-badge"
                           onClick={() => {
                             if (previousMeterReading != null) {
                               setMeterReadingVal(String(previousMeterReading));
                             }
                           }}
                           title={previousMeterReading != null ? "Click to auto-fill previous reading baseline" : "No previous reading logged"}
                         >
                           <Info size={16} className="rdm-meter-info-icon" />
                           <div className="rdm-meter-tooltip">
                             <span>
                               {previousMeterReading != null ? (
                                 <>Last Recorded: <strong>{Number(previousMeterReading).toLocaleString("en-PH")} kWh</strong></>
                               ) : (
                                 "No previous reading logged yet for this room."
                               )}
                             </span>
                             <span className="rdm-meter-tooltip-hint">
                               {previousMeterReading != null
                                 ? "Click to auto-fill starting baseline"
                                 : "Enter initial room meter reading"}
                             </span>
                           </div>
                         </div>
                       </div>
 <div className="rdm-inline-addon-group">
 <input
 type="number"
 min="0"
 max="99999"
 step="0.01"
 value={meterReadingVal}
 onChange={(event) => setMeterReadingVal(event.target.value)}
 className="rdm-inline-addon-input"
 placeholder="e.g. 1250"
 autoFocus
 />
 <span className="rdm-inline-addon-label">kWh</span>
 </div>
 </div>
 )}

 <div className="rdm-inline-actions">
 <button
 type="button"
 className="rdm-action rdm-action-secondary"
 onClick={() => setShowMeterPrompt(false)}
 disabled={isSubmitting}
 >
 Cancel
 </button>
 <button
 type="button"
 className="rdm-action rdm-action-primary rdm-action-success"
 onClick={() => {
 const reading = branchUsesSubmeter ? Number(meterReadingVal) : null;
 if (branchUsesSubmeter && (!meterReadingVal.trim() || Number.isNaN(reading) || reading < 0)) {
 showNotification(
 "A valid meter reading (kWh) is required.",
 "error",
 4000,
 );
 return;
 }
 if (!actualMoveInDate) {
 showNotification("The actual move-in date is required.", "error", 4000);
 return;
 }

 doAction(
 "moveIn",
 async () => {
 try {
 await reservationApi.update(reservation.id, {
 status: "moveIn",
 ...(branchUsesSubmeter && reading !== null ? { meterReading: reading } : {}),
 actualMoveInDate,
 houseRulesPrepared: true,
 });
 // Invalidate utility caches so the billing timeline auto-updates.
 await queryClient.invalidateQueries({ queryKey: ["utilities"] });
 } catch (apiErr) {
 // Surface backend blocker reasons if available
 const blockers = apiErr?.response?.data?.missing || apiErr?.data?.missing;
 if (blockers && blockers.length > 0) {
 throw new Error(
 "Move-in prerequisites not met:\n• " + blockers.join("\n• "),
 );
 }
 throw apiErr;
 }
 },
 "Tenant moved in successfully",
 );
 }}
 disabled={isSubmitting}
 >
 {isSubmitting ? "Processing..." : "Move In"}
 </button>
 </div>
 </div>
 ) : (
 <>
 {stageGuide && (
 <div className="rdm-stage-guide">
 <div className="rdm-stage-guide-icon-wrap">
 <stageGuide.Icon size={16} strokeWidth={1.75} />
 </div>
 <p className="rdm-stage-guide-msg">{stageGuide.message}</p>
 </div>
 )}

 {allowedActions.includes("moveIn") && (
 <button
 className="rdm-action rdm-action-primary"
 onClick={() => {
 setMeterReadingVal("");
 setShowMeterPrompt(true);
 }}
 disabled={isSubmitting}
 title="Mark tenant as moved in and record the initial meter reading"
 >
 Mark as Moved In
 </button>
 )}

 {allowedActions.includes("extend") && (
 <button
 className="rdm-action rdm-action-dark"
 onClick={() => setShowExtendPrompt(true)}
 disabled={isSubmitting}
 >
 Reschedule move-in
 </button>
 )}

 {allowedActions.includes("approve_for_payment") && (
 <button
 className="rdm-action rdm-action-primary"
 onClick={() => {
 if (pricingBlocksApproval) {
 showNotification(
 pricingIsMissing
 ? "Pricing information unavailable. Refresh and try again."
 : "Pricing configuration is unavailable. This reservation cannot be approved yet.",
 "error",
 );
 return;
 }
 doAction(
 "approveForPayment",
 () =>
 reservationApi.update(reservation.id, {
 status: "approved_for_payment",
 applicationReviewReason: null,
 }),
 "Application approved for payment",
 );
 }}
 disabled={isSubmitting || pricingBlocksApproval}
 title={
 pricingBlocksApproval
 ? (pricingIsMissing
 ? "Pricing information unavailable. Refresh and try again."
 : "Pricing configuration is unavailable. This reservation cannot be approved yet.")
 : undefined
 }
 >
 Approve for Payment
 </button>
 )}

 {allowedActions.includes("needs_revision") && (
 <button
 className="rdm-action rdm-action-dark"
 onClick={() => setRevisionModal({ open: true })}
 disabled={isSubmitting}
 >
 Request Revision
 </button>
 )}

 {allowedActions.includes("rejected") && (
 <button
 className="rdm-action rdm-action-danger-outline"
 onClick={() => {
 if (!adminNotes.trim()) {
 showNotification("Add a reason in Admin Notes before rejecting.", "warning");
 return;
 }
 doAction(
 "rejectApplication",
 () =>
 reservationApi.update(reservation.id, {
 status: "rejected",
 applicationReviewReason: adminNotes.trim(),
 }),
 "Application rejected",
 );
 }}
 disabled={isSubmitting}
 >
 Reject Application
 </button>
 )}

 {allowedActions.includes("cancelled") && !cancellationPending && (
 <button
 className="rdm-action rdm-action-danger-outline"
 onClick={() =>
 doAction(
 "cancel",
 () =>
 reservationApi.update(reservation.id, {
 status: "cancelled",
 }),
 "Reservation cancelled",
 )
 }
 disabled={isSubmitting}
 >
 Cancel Reservation
 </button>
 )}
 </>
 )}
 </div>
 </div>
 )}

 <div className="rdm-side-card">
 <h4 className="rdm-side-title">Activity Timeline</h4>
 <div className="rdm-timeline">
 {activityTimeline.map((item, index) => (
 <div className="rdm-timeline-item" key={`${item.label}-${index}`}>
 <span className="rdm-timeline-dot" />
 <div className="rdm-timeline-copy">
 <span className="rdm-timeline-label">{item.label}</span>
 <span className="rdm-timeline-value">{item.value}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </aside>
 </div>
 </div>
 </div>

 {showExtendPrompt && (
 <div
 className="rdm-extend-overlay"
 onClick={() => setShowExtendPrompt(false)}
 >
 <div
 className="rdm-extend-dialog"
 onClick={(event) => event.stopPropagation()}
 >
 <div className="rdm-extend-dialog-body">
 <h3 className="rdm-extend-dialog-title">Extend Move-in Date</h3>
 <div className="rdm-extend-dialog-input-row">
 <input
 type="number"
 min="1"
 max="30"
 value={extendDays}
 onChange={(event) =>
 setExtendDays(
 Math.max(1, Math.min(30, Number(event.target.value) || 1)),
 )
 }
 className="rdm-extend-dialog-input"
 autoFocus
 />
 <span className="rdm-extend-dialog-unit">
 day{extendDays > 1 ? "s" : ""}
 </span>
 </div>
 </div>
 <div className="rdm-extend-dialog-actions">
 <button
 className="rdm-extend-dialog-cancel"
 onClick={() => setShowExtendPrompt(false)}
 >
 Cancel
 </button>
 <button
 className="rdm-extend-dialog-confirm"
 onClick={() => {
 setShowExtendPrompt(false);
 doAction(
 "extend",
 () =>
 reservationApi.extend(reservation.id, {
 extensionDays: extendDays,
 }),
 `Move-in extended by ${extendDays} day${extendDays > 1 ? "s" : ""}`,
 );
 }}
 disabled={isSubmitting}
 >
  Confirm
  </button>
  </div>
  </div>
  </div>
  )}

 <ConfirmModal
 isOpen={confirmModal.open}
 onClose={() => setConfirmModal((previous) => ({ ...previous, open: false }))}
 onConfirm={confirmModal.onConfirm}
 title={confirmModal.title}
 message={confirmModal.message}
 variant={confirmModal.variant}
 confirmText={confirmModal.confirmText || "Confirm"}
 />

 {revisionModal.open && (
 <RevisionReasonModal
 onClose={() => setRevisionModal({ open: false })}
 onSubmit={(reason) => {
 setRevisionModal({ open: false });
 doAction(
 "requestRevision",
 () =>
 reservationApi.update(reservation.id, {
 status: "needs_revision",
 applicationReviewReason: reason,
 }),
 "Revision request sent to applicant",
 );
 }}
 />
 )}
 </>,
 document.body,
 );
}

/* ──────────────────────────────────────────────────────────────
 RevisionReasonModal — template-based revision request modal
────────────────────────────────────────────────────────────── */

const REVISION_TEMPLATES = [
  {
    id: "blurry_id",
    label: "Blurry / Unreadable ID",
    text: "Your uploaded ID photo is blurry or unreadable. Please re-upload a clear, well-lit photo of your valid government ID (front and back).",
  },
  {
    id: "wrong_doc_type",
    label: "Wrong Document Type",
    text: "The document you uploaded does not match the required type. Please upload the correct document as specified in the requirements.",
  },
  {
    id: "incomplete_info",
    label: "Incomplete Information",
    text: "Some required fields in your application are incomplete or contain placeholder text. Please review and fill out all required fields.",
  },
  {
    id: "mismatch_name",
    label: "Name Mismatch",
    text: "The name on your submitted ID does not match the name in your application form. Please correct your application details or upload the correct ID.",
  },
  {
    id: "missing_nbi",
    label: "Missing NBI Clearance",
    text: "Your NBI Clearance document is missing or was not uploaded. Please upload a valid NBI Clearance, or provide a reason if you are unable to obtain one.",
  },
  {
    id: "expired_id",
    label: "Expired ID",
    text: "The ID you submitted appears to be expired. Please upload a current, non-expired government-issued ID.",
  },
  {
    id: "selfie_issue",
    label: "Selfie Photo Issue",
    text: "Your selfie photo does not meet the requirements. Please upload a clear, recent photo of yourself with adequate lighting and a neutral background.",
  },
  {
    id: "company_id_missing",
    label: "Missing Company / School ID",
    text: "Your company or school ID was not uploaded. Please upload a valid company or school ID, or provide a reason if unavailable.",
  },
];

function RevisionReasonModal({ onClose, onSubmit }) {
  const [selected, setSelected] = useState([]);
  const [customNote, setCustomNote] = useState("");

  const toggleTemplate = (template) => {
    setSelected((prev) =>
      prev.find((t) => t.id === template.id)
        ? prev.filter((t) => t.id !== template.id)
        : [...prev, template],
    );
  };

  const composedReason = [
    ...selected.map((t) => `• ${t.text}`),
    ...(customNote.trim() ? [`• ${customNote.trim()}`] : []),
  ].join("\n");

  const canSubmit = selected.length > 0 || customNote.trim().length > 0;

  return (
    <div className="rdm-revision-overlay" onClick={onClose}>
      <div
        className="rdm-revision-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rdm-revision-header">
          <h3 className="rdm-revision-title">Request Revision</h3>
          <p className="rdm-revision-subtitle">
            Select the reason(s) for requesting a revision. The applicant will
            see these in their notification.
          </p>
        </div>

        <div className="rdm-revision-templates">
          {REVISION_TEMPLATES.map((tpl) => {
            const isActive = selected.find((t) => t.id === tpl.id);
            return (
              <button
                key={tpl.id}
                type="button"
                className={`rdm-revision-chip ${isActive ? "rdm-revision-chip--active" : ""}`}
                onClick={() => toggleTemplate(tpl)}
              >
                <span className="rdm-revision-chip-check">
                  {isActive ? "✓" : "+"}
                </span>
                {tpl.label}
              </button>
            );
          })}
        </div>

        <div className="rdm-revision-custom">
          <label className="rdm-revision-custom-label">
            Additional notes (optional)
          </label>
          <textarea
            className="rdm-notes-input"
            placeholder="Add specific details about what needs to be corrected..."
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            rows="3"
          />
        </div>

        {composedReason && (
          <div className="rdm-revision-preview">
            <span className="rdm-revision-preview-label">Preview</span>
            <p className="rdm-revision-preview-text">{composedReason}</p>
          </div>
        )}

        <div className="rdm-revision-actions">
          <button
            type="button"
            className="rdm-action rdm-action-outline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rdm-action rdm-action-dark"
            disabled={!canSubmit}
            onClick={() => onSubmit(composedReason)}
          >
            Send Revision Request
          </button>
        </div>
      </div>
    </div>
  );
}
