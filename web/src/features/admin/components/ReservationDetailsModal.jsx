import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, ClipboardList, CreditCard, Eye } from "lucide-react";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { reservationApi } from "../../../shared/api/apiClient";
import { useVisitAvailability } from "../../../shared/hooks/queries/useReservations";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import getFriendlyError from "../../../shared/utils/friendlyError";
import {
 getAllowedReservationActions,
 getReservationStatusAppearance,
 readMoveInDate,
} from "../../../shared/utils/lifecycleNaming";
import {
 fmtDate as sharedFmtDate,
 fmtDateTime as sharedFmtDateTime,
} from "../../../shared/utils/dateFormat";
import { showNotification } from "../../../shared/utils/notification";
import { getVisitManagementAvailability } from "../utils/visitStatusRules";
import "../styles/reservation-details-modal.css";

const ACTION_MSGS = {
 moveIn: {
 title: "Move In Tenant",
 message:
 "Mark this tenant as moved in? They'll be promoted to Tenant role with full system access.",
 confirmText: "Yes, Move In",
 variant: "info",
 },
 cancel: {
 title: "Cancel reservation",
 message:
 "This will permanently remove the reservation. The reservation fee is non-refundable, and the bed will be released.",
 confirmText: "Cancel reservation",
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
 variant: "info",
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
 const [showMeterPrompt, setShowMeterPrompt] = useState(false);
 const [confirmModal, setConfirmModal] = useState({
 open: false,
 title: "",
 message: "",
 variant: "info",
 onConfirm: null,
 });

 useBodyScrollLock(Boolean(reservation));
 useEscapeClose(Boolean(reservation), onClose);

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
 const appearance = getReservationStatusAppearance(status);
 const allowedActions = getAllowedReservationActions(status);
 const moveInDate = readMoveInDate(reservation);
 const cancellationPending =
   reservation?.cancellationRequested && reservation?.cancellationStatus === "pending";
 const isMovedOut = status === "moveOut";
 const isOverdue =
 status === "reserved" && moveInDate && new Date(moveInDate) < new Date();
 const daysOverdue = isOverdue
 ? Math.floor((new Date() - new Date(moveInDate)) / 86400000)
 : 0;
 const docs = reservation ? buildDocs(reservation) : [];
 const guestName = reservation?.customer ?? "Unknown";
 const guestInitials = getInitials(guestName);
 const stageGuide = STAGE_GUIDANCE[status];
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
 {
 label: "Current Status",
 value: appearance.label,
 },
 ].filter(Boolean);

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
 <div className="rdm-top-header rdm-top-header--gradient">
 <div className="rdm-guest-block">
 <div className="rdm-avatar" aria-hidden="true">
 {guestInitials}
 </div>
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
 className="rdm-status-chip rdm-status-chip-dark"
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
 className="rdm-close rdm-close-dark"
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
 <div className="rdm-section rdm-surface-card">
 <h3 className="rdm-top-section-label">Booking Details</h3>
 <div className="rdm-info-grid rdm-info-grid-dark">
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
 <span className="rdm-info-value">{fmt(reservation.visitCode)}</span>
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
 <div className="rdm-doc-links" style={{ marginTop: 12 }}>
 {roomImages.map((image, index) => (
 <button
 key={`${image}-${index}`}
 type="button"
 className="rdm-doc-view"
 onClick={() => openImage(image, `Room photo ${index + 1}`)}
 >
 Room Photo {index + 1}
 </button>
 ))}
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
 Track the physical visit separately from application review. Completing a
 visit or allowing the applicant to proceed will not unlock payment.
 </p>
 </div>
 {visitStatusAppearance && (
 <div
 className="rdm-status-chip"
 style={{
 background: visitStatusAppearance.bg,
 color: visitStatusAppearance.color,
 padding: "5px 12px",
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
 <span className="rdm-info-value">{fmt(reservation.visitCode)}</span>
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
 borderRadius: 10,
 background: "rgba(15, 23, 42, 0.03)",
 border: "1px solid rgba(15, 23, 42, 0.08)",
 }}
 >
 <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
 <strong style={{ fontSize: "0.84rem", color: "#0F172A" }}>
 {VISIT_STATUS_CONFIG[entry.status]?.label ||
  (entry.status === "completed"
    ? "Visit Completed"
    : entry.status === "no_show"
      ? "No-Show"
      : entry.status === "visit_cancelled"
        ? "Visit Cancelled"
        : entry.status === "rescheduled"
          ? "Rescheduled"
          : entry.status === "allowed_without_visit"
            ? "Allowed to Proceed Without Visit"
            : "Visit Updated")}
 </strong>
 <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
 {fmtDateTime(entry.updatedAt || entry.scheduledAt)}
 </span>
 </div>
 <div style={{ fontSize: "0.8rem", color: "#334155", marginTop: 6 }}>
 Old: {fmtDate(entry.visitDate)} {entry.visitTime ? `at ${entry.visitTime}` : ""}
 </div>
 {(entry.rescheduledToDate || entry.rescheduledToTime) && (
 <div style={{ fontSize: "0.8rem", color: "#334155", marginTop: 4 }}>
 New: {fmtDate(entry.rescheduledToDate)}{" "}
 {entry.rescheduledToTime ? `at ${entry.rescheduledToTime}` : ""}
 </div>
 )}
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

                 <div className="rdm-visit-management-panel">
                 {visitActionAvailability.completed ? (
                 <div className="rdm-visit-action-helper rdm-visit-action-helper-success">
                 {visitActionAvailability.helperMessage}
                 </div>
                 ) : visitStatusKey === "allowed_without_visit" ? (
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
 doc.precheck?.adminNote,
 ...(Array.isArray(doc.precheck?.aiCheckWarnings)
 ? doc.precheck.aiCheckWarnings
 : []),
 ]
 .map((note) => String(note || "").trim())
 .filter(Boolean);
 if (!appearance && notes.length === 0) return null;
 return (
 <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
 {appearance ? (
 <span
 style={{
 display: "inline-flex",
 alignItems: "center",
 width: "fit-content",
 padding: "2px 8px",
 borderRadius: 999,
 fontSize: "0.72rem",
 fontWeight: 700,
 background: appearance.bg,
 color: appearance.color,
 }}
 >
 {appearance.label}
 </span>
 ) : null}
 {notes.slice(0, 2).map((warning, warningIndex) => (
 <span
 key={`${doc.label}-warning-${warningIndex}`}
 style={{ fontSize: "0.78rem", color: "#6B7280", lineHeight: 1.4 }}
 >
 {warning}
 </span>
 ))}
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
 <strong>{fmt(reservation.paymentMethod)}</strong>
 </div>
 </div>
 </div>

 {status !== "cancelled" && !isMovedOut && (
 <div className="rdm-side-card">
 <h4 className="rdm-side-title">
   Quick Actions
   {cancellationPending && (
     <span
       style={{
         marginLeft: "0.5rem",
         fontSize: "0.7rem",
         fontWeight: 700,
         background: "#B91C1C",
         color: "#fff",
         borderRadius: "4px",
         padding: "2px 6px",
         verticalAlign: "middle",
         letterSpacing: "0.03em",
       }}
     >
       CANCEL REQUEST
     </span>
   )}
 </h4>
 <div className="rdm-actions-card rdm-actions-card-dark">
 {stageGuide && (
 <div className="rdm-stage-guide rdm-stage-guide-dark">
 <div className="rdm-stage-guide-icon-wrap">
 <stageGuide.Icon size={16} strokeWidth={1.75} />
 </div>
 <p className="rdm-stage-guide-msg">{stageGuide.message}</p>
 </div>
 )}

 {allowedActions.includes("moveIn") && (
 <button
 className="rdm-action rdm-action-dark"
 onClick={() => {
 setMeterReadingVal("");
 setShowMeterPrompt(true);
 }}
 disabled={isSubmitting}
 title="Mark tenant as moved in and record the initial meter reading"
 >
 Mark as moved in
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
 className="rdm-action rdm-action-dark"
 onClick={() =>
 doAction(
 "approveForPayment",
 () =>
 reservationApi.update(reservation.id, {
 status: "approved_for_payment",
 applicationReviewReason: null,
 }),
 "Application approved for payment",
 )
 }
 disabled={isSubmitting}
 >
 Approve for Payment
 </button>
 )}

 {allowedActions.includes("needs_revision") && (
 <button
 className="rdm-action rdm-action-dark"
 onClick={() => {
 if (!adminNotes.trim()) {
 showNotification("Add a reason in Admin Notes before requesting revision.", "warning");
 return;
 }
 doAction(
 "requestRevision",
 () =>
 reservationApi.update(reservation.id, {
 status: "needs_revision",
 applicationReviewReason: adminNotes.trim(),
 }),
 "Revision request sent to applicant",
 );
 }}
 disabled={isSubmitting}
 >
 Request Revision
 </button>
 )}

 {allowedActions.includes("rejected") && (
 <button
 className="rdm-action rdm-action-dark rdm-action-dark-cancel"
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
 Reject
 </button>
 )}

 {cancellationPending && (
   <>
     <button
       className="rdm-action rdm-action-dark rdm-action-dark-cancel"
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
       className="rdm-action rdm-action-dark"
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
   </>
 )}

 {allowedActions.includes("cancelled") && !cancellationPending && (
 <button
 className="rdm-action rdm-action-dark rdm-action-dark-cancel"
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
 Cancel reservation
 </button>
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

 {showMeterPrompt && (
 <div
 className="rdm-extend-overlay"
 onClick={() => setShowMeterPrompt(false)}
 >
 <div
 className="rdm-extend-dialog"
 onClick={(event) => event.stopPropagation()}
 >
 <div className="rdm-extend-dialog-body">
 <h3 className="rdm-extend-dialog-title">Move-In Details</h3>
 <p className="rdm-extend-dialog-copy">
  Enter the starting kWh meter reading to confirm this tenant&apos;s
  occupancy baseline. Move-in date and time will be recorded
  automatically as today.
 </p>

 {/* Meter reading */}
 <label
 style={{
 display: "block",
 fontSize: "0.75rem",
 fontWeight: 600,
 marginBottom: 4,
 color: "var(--muted-foreground, #6b7280)",
 }}
 >
 Starting Meter Reading (kWh) <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
 </label>
 <div
 className="rdm-extend-dialog-input-row"
 style={{ width: "100%" }}
 >
 <input
 type="number"
 min="0"
 max="99999"
 step="0.01"
 value={meterReadingVal}
 onChange={(event) => setMeterReadingVal(event.target.value)}
 className="rdm-extend-dialog-input rdm-extend-dialog-input--wide"
 placeholder="e.g. 1250"
 autoFocus
 />
 <span className="rdm-extend-dialog-unit">kWh</span>
 </div>
 </div>
 <div className="rdm-extend-dialog-actions">
 <button
 className="rdm-extend-dialog-cancel"
 onClick={() => setShowMeterPrompt(false)}
 >
 Cancel
 </button>
 <button
 className="rdm-extend-dialog-confirm"
 onClick={() => {
 const reading = Number(meterReadingVal);
 if (!meterReadingVal.trim() || Number.isNaN(reading) || reading < 0) {
 showNotification(
 "A valid meter reading (kWh) is required.",
 "error",
 4000,
 );
 return;
 }

 setShowMeterPrompt(false);
 doAction(
 "moveIn",
 async () => {
 try {
 await reservationApi.update(reservation.id, {
 status: "moveIn",
 meterReading: reading,
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
 Move In
 </button>
 </div>
 </div>
 </div>
 )}

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
 </>,
 document.body,
 );
}
