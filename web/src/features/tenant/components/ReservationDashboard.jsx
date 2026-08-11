import React from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { showNotification } from "../../../shared/utils/notification";
import BaseModal from "../../../shared/components/BaseModal";

import {
  Home,
  Calendar,
  FileText,
  CreditCard,
  CheckCircle,
  Clock,
  ArrowRight,
  AlertCircle,
  MapPin,
} from "lucide-react";
import {
  canReservationAccessPayment,
  hasReservationStatus,
  readMoveInDate,
} from "../../../shared/utils/lifecycleNaming";
import {
  getReservationFeeStatusLabel,
  getMoveInReadinessLabel,
  resolveDisplayMoveInDate,
} from "../utils/reservationReadiness";
import {
  getPhysicalVisitApplicantState,
  getReservationVisitStatus,
  getReservationViewingPreference,
  isPhysicalVisitPreference,
} from "../utils/physicalVisitFlow";
import { fmtShortDate, APP_LOCALE } from "../../../shared/utils/dateFormat";

const getReservationStatus = (reservation) =>
  reservation?.reservationStatus || reservation?.status || "pending";

const getViewingPreferenceLabel = (reservation) => {
  const preference = getReservationViewingPreference(reservation);

  switch (preference) {
    case "physical_visit":
      return "Physical Visit";
    case "remote_2d_viewing":
      return "Remote Viewing";
    case "urgent_move_in_review":
      return "Priority Viewing Review";
    default:
      return "Viewing Preference";
  }
};

const hasViewingPreference = (reservation) =>
  Boolean(
    reservation?.viewingPreference ||
      reservation?.viewingType ||
      reservation?.visitDate ||
      reservation?.visitTime ||
      reservation?.remoteViewingAcknowledged ||
      reservation?.isUrgentMoveIn,
  );

const hasSubmittedApplication = (reservation) =>
  Boolean(
    reservation?.applicationSubmittedAt ||
      (reservation?.agreedToCertification &&
        reservation?.firstName &&
        reservation?.lastName) ||
      hasReservationStatus(
        getReservationStatus(reservation),
        "pending_application_review",
        "needs_revision",
        "approved_for_payment",
        "payment_pending",
        "reserved",
        "moveIn",
        "moveOut",
        "rejected",
      ),
  );

const STEPS = [
  {
    key: "room_selected",
    label: "Room Selection",
    desc: "Review and confirm your chosen room",
    icon: Home,
    stage: 1,
    category: "Getting Started",
  },
  {
    key: "viewing_preference",
    label: "Viewing Preference",
    desc: "Choose a physical visit, remote viewing, or priority review",
    icon: Calendar,
    stage: 2,
    category: "Getting Started",
  },
  {
    key: "application_review",
    label: "Application Review",
    desc: "Submit your application and documents for admin review",
    icon: FileText,
    stage: 3,
    category: "Verification",
  },
  {
    key: "payment_submitted",
    label: "Payment",
    desc: "Available after your application is approved",
    icon: CreditCard,
    stage: 4,
    category: "Finalization",
  },
  {
    key: "reserved",
    label: "Confirmation",
    desc: "Reservation secured and ready",
    icon: CheckCircle,
    stage: 5,
    category: "Finalization",
  },
];

/* ── helpers ─────────────────────────────────────────────────────────────── */

function resolveCurrentStage(reservation) {
  if (!reservation) return 0;
  const status = getReservationStatus(reservation);
  const physicalVisitState = getPhysicalVisitApplicantState(reservation);

  if (hasReservationStatus(status, "reserved", "moveIn", "moveOut")) return 5;
  if (canReservationAccessPayment(status)) return 4;
  if (hasReservationStatus(status, "payment_pending")) return 4;
  if (hasSubmittedApplication(reservation)) return 3;
  if (physicalVisitState && !physicalVisitState.canFillApplication) return 2;
  if (
    hasViewingPreference(reservation) ||
    hasReservationStatus(
      status,
      "viewing_preference_selected",
      "visit_pending",
      "visit_approved",
    )
  ) {
    return 3;
  }

  // room confirmed — ready for visit scheduling
  if (reservation.roomConfirmed) return 2;

  // room selected (reservation exists but not yet reserved)
  return 1;
}

function getStepStatus(stepStage, currentStage, reservation) {
  const status = getReservationStatus(reservation);
  const physicalVisitState = getPhysicalVisitApplicantState(reservation);
  if (stepStage < currentStage) return "complete";
  if (stepStage === currentStage) {
    // Step 5 is the final step — if reservation is confirmed, mark as complete (green)
    if (
      stepStage === 5 &&
      reservation &&
      hasReservationStatus(status, "reserved", "moveIn", "moveOut")
    ) {
      return "complete";
    }
    if (stepStage === 3 && hasReservationStatus(status, "pending_application_review")) {
      return "waiting";
    }
    if (stepStage === 3 && hasReservationStatus(status, "needs_revision", "rejected")) {
      return "rejected";
    }
    if (stepStage === 4 && hasReservationStatus(status, "payment_pending")) {
      return "waiting";
    }
    if (stepStage === 2 && physicalVisitState && !physicalVisitState.canFillApplication) {
      return physicalVisitState.isRejected ? "rejected" : "waiting";
    }
    // Step 4: PayMongo is instant — never show "waiting"; payment is either
    // pending (user still needs to pay) or confirmed (reservation = reserved).
    return "current";
  }
  return "locked";
}

function getNextAction(reservation, currentStage) {
  const reservationFeeAmount = reservation?.reservationFeeAmount || 2000;
  if (!reservation) {
    return {
      title: "Start Your Reservation",
      description: "Browse rooms to begin your application",
      buttonLabel: "Browse Rooms",
      route: "/applicant/rooms",
      isWaiting: false,
    };
  }

  const status = getReservationStatus(reservation);
  const physicalVisitState = getPhysicalVisitApplicantState(reservation);

  if (hasReservationStatus(status, "reserved", "moveIn", "moveOut")) {
    return {
      title: "Reservation Secured",
      description: "Your reservation is secured. You're all set for move-in!",
      buttonLabel: null,
      route: null,
      isWaiting: false,
    };
  }

  if (hasReservationStatus(status, "rejected")) {
    return {
      title: "Application Rejected",
      description:
        reservation.applicationReviewReason ||
        "Your application was not approved. Payment remains locked.",
      buttonLabel: null,
      route: null,
      isWaiting: false,
      isRejected: true,
    };
  }

  if (hasReservationStatus(status, "needs_revision")) {
    return {
      title: "Application Needs Revision",
      description:
        reservation.applicationReviewReason ||
        "Please update your application or documents so admin can review them again.",
      buttonLabel: "Update Application ->",
      route: "/applicant/reservation?step=3",
      isWaiting: false,
      isRejected: true,
    };
  }

  if (hasReservationStatus(status, "pending_application_review")) {
    return {
      title: "Application Under Review",
      description:
        "Payment will be available once your application and documents are approved.",
      buttonLabel: null,
      route: null,
      isWaiting: true,
    };
  }

  if (hasReservationStatus(status, "payment_pending")) {
    return {
      title: "Payment In Progress",
      description:
        "Your checkout was started. We'll confirm the reservation once payment is completed.",
      buttonLabel: "Review Payment ->",
      route: "/applicant/reservation?step=4",
      isWaiting: true,
    };
  }

  if (canReservationAccessPayment(status)) {
    return {
      title: "Pay Reservation Fee",
      description: `Pay PHP ${reservationFeeAmount.toLocaleString("en-PH")} online to secure your reservation.`,
      buttonLabel: "Pay Reservation Fee ->",
      route: "/applicant/reservation?step=4",
      isWaiting: false,
    };
  }

  if (
    physicalVisitState &&
    !physicalVisitState.canFillApplication &&
    !hasSubmittedApplication(reservation)
  ) {
    return {
      title: physicalVisitState.title,
      description: physicalVisitState.message,
      buttonLabel: physicalVisitState.buttonLabel,
      route: physicalVisitState.route,
      isWaiting: physicalVisitState.isWaiting,
      isRejected: physicalVisitState.isRejected,
    };
  }

  switch (currentStage) {
    case 1:
      return {
        title: "Confirm Room & Continue",
        description: "Review your selected room and confirm your choice",
        buttonLabel: "Continue →",
        route: `/applicant/reservation?step=1`,
        isWaiting: false,
      };
    case 2: {
      const viewPref = getReservationViewingPreference(reservation);
      const hasSchedule = reservation.visitDate || viewPref;
      if (physicalVisitState && !physicalVisitState.canFillApplication) {
        return {
          title: physicalVisitState.title,
          description: physicalVisitState.message,
          buttonLabel: physicalVisitState.buttonLabel,
          route: physicalVisitState.route,
          isWaiting: physicalVisitState.isWaiting,
          isRejected: physicalVisitState.isRejected,
        };
      }
      if (hasSchedule) {
        if (viewPref === "remote_2d_viewing") {
          return {
            title: "Remote Viewing Requested",
            description:
              "Your remote viewing request was saved. You may now complete your tenant application.",
            buttonLabel: "Fill Application ->",
            route: `/applicant/reservation?step=3`,
            isWaiting: false,
          };
        }
        if (viewPref === "urgent_move_in_review") {
          return {
            title: "Priority Review Requested",
            description:
              "Your priority viewing request has been saved. Proceed to complete your application.",
            buttonLabel: "Fill Application →",
            route: `/applicant/reservation?step=3`,
            isWaiting: false,
          };
        }
        const fDate = reservation.visitDate
          ? fmtShortDate(reservation.visitDate)
          : "";
        return {
          title: "Physical Visit Confirmed",
          description: `Your physical visit${fDate ? ` on ${fDate}` : ""} has been completed or cleared by admin. You may now continue to the tenant application.`,
          buttonLabel: "Fill Application ->",
          route: `/applicant/reservation?step=3`,
          isWaiting: false,
        };
      }
      return {
        title: "Choose Your Viewing Preference",
        description:
          "Select a physical visit, remote viewing, or priority review before submitting your application.",
        buttonLabel: "Continue ->",
        route: `/applicant/reservation?step=2`,
        isWaiting: false,
      };
    }
    case 3:
      return {
        title: "Complete Your Application",
        description: "Fill in personal details and upload required documents",
        buttonLabel: "Fill Application →",
        route: `/applicant/reservation?step=3`,
        isWaiting: false,
      };
    case 4: {
      return {
        title: "Pay Reservation Fee",
        description: `Pay PHP ${reservationFeeAmount.toLocaleString("en-PH")} online via GCash, Maya, or Card to secure your reservation`,
        buttonLabel: "Pay Reservation Fee ->",
        route: `/applicant/reservation?step=4`,
        isWaiting: false,
      };
    }
    default:
      return {
        title: "Reservation Complete",
        description: "All steps are done!",
        buttonLabel: null,
        route: null,
        isWaiting: false,
      };
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return fmtShortDate(dateStr);
  } catch {
    return "—";
  }
}

function getStepDesc(step, status, reservation) {
  if (!reservation || status === "locked") return step.desc;

  const room = reservation.roomId || {};
  const roomName = room.name || "Room";
  const reservationStatus = getReservationStatus(reservation);
  const viewingPreferenceLabel = getViewingPreferenceLabel(reservation);

  switch (step.stage) {
    case 1:
      if (
        status === "complete" ||
        status === "current" ||
        status === "waiting"
      ) {
        return `${roomName} selected`;
      }
      return step.desc;
    case 2: {
      const physicalVisitState = getPhysicalVisitApplicantState(reservation);
      if (status === "rejected") {
        return physicalVisitState?.title || "Physical visit needs rescheduling";
      }
      if (status === "waiting") {
        const vp = getReservationViewingPreference(reservation);
        if (vp === "remote_2d_viewing") return "Remote viewing requested";
        if (vp === "urgent_move_in_review") return "Priority review pending";
        if (physicalVisitState?.statusKey === "rescheduled") {
          return `Rescheduled to ${formatDate(reservation.visitDate)}`;
        }
        if (physicalVisitState?.statusKey === "no_show") {
          return "No-show recorded";
        }
        if (physicalVisitState?.statusKey === "visit_cancelled") {
          return "Visit schedule cancelled";
        }
        return reservation.visitDate
          ? `Physical visit on ${formatDate(reservation.visitDate)}`
          : "Viewing preference saved";
      }
      if (status === "complete") {
        return physicalVisitState?.title || viewingPreferenceLabel;
      }
      return step.desc;
    }
    case 3:
      if (status === "waiting") {
        return "Pending admin review";
      }
      if (status === "rejected") {
        return hasReservationStatus(reservationStatus, "rejected")
          ? "Application rejected"
          : "Revision requested";
      }
      if (status === "complete") {
        return hasReservationStatus(
          reservationStatus,
          "approved_for_payment",
          "payment_pending",
          "reserved",
          "moveIn",
          "moveOut",
        )
          ? "Approved for payment"
          : "Application submitted";
      }
      return step.desc;
    case 4:
      if (status === "waiting") {
        return "Payment processing";
      }
      if (status === "current") {
        return "Ready for payment";
      }
      if (status === "complete") {
        return getReservationFeeStatusLabel(reservation);
      }
      return step.desc;
    case 5:
      if (status === "complete") {
        // getMoveInReadinessLabel only claims "Move-in ready!" once the
        // server's authoritative reservation.moveInReadiness confirms every
        // backend blocker (Bill, documents, room/bed assignment, occupancy
        // conflicts) is clear — applicant-side completeness alone is not
        // enough. See reservationReadiness.js for the full contract.
        return getMoveInReadinessLabel(reservation);
      }
      return step.desc;
    default:
      return step.desc;
  }
}

/* ── component ───────────────────────────────────────────────────────────── */

export default function ReservationDashboard({
  reservation,
  visits = [],
  feedback = null,
  onDismissFeedback,
  onGoToReservation,
}) {
  const navigate = useNavigate();
  const goToFlow = (to) => {
    if (reservation?._id) {
      sessionStorage.setItem("activeReservationId", reservation._id);
    }
    navigate(to, { state: { continueFlow: true, reservationId: reservation?._id } });
  };
  const queryClient = useQueryClient();
  const currentStage = resolveCurrentStage(reservation);
  const totalSegments = Math.max(STEPS.length - 1, 1);
  const progressSegments = Math.max(0, Math.min(totalSegments, currentStage - 1));
  const stepperProgressPercent = (progressSegments / totalSegments) * 100;
  const action = getNextAction(reservation, currentStage);
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [showRequestCancelModal, setShowRequestCancelModal] = React.useState(false);
  const [isRequesting, setIsRequesting] = React.useState(false);

  React.useEffect(() => {
    if (!showCancelModal) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isCancelling) {
        setShowCancelModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCancelModal, isCancelling]);

  /* ── no reservation ──────────────────────────────────────────────────── */
  if (!reservation) {
    return (
      <div style={styles.card}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <Home size={32} color="#94A3B8" />
          </div>
          <h3 style={styles.emptyTitle}>No Active Reservation</h3>
          <p style={styles.emptyDescription}>
            You don't have a reservation yet. Start by browsing available rooms.
          </p>
          <button
            onClick={() => navigate("/applicant/check-availability")}
            style={styles.primaryButton}
          >
            Browse Rooms
            <ArrowRight
              size={16}
              style={{ marginLeft: 8, color: "var(--color-primary, #D4AF37)" }}
            />
          </button>
        </div>
      </div>
    );
  }

  /* ── reservation details ─────────────────────────────────────────────── */
  const room = reservation.roomId || {};
  const roomName = room.name || "Room";
  const branch = room.branch || "Lilycrest";
  const code = reservation.reservationCode || "—";
  const physicalVisitState = getPhysicalVisitApplicantState(reservation);
  const visitStatusKey = getReservationVisitStatus(reservation);
  const isConfirmed = hasReservationStatus(
    getReservationStatus(reservation),
    "reserved",
    "moveIn",
    "moveOut",
  );

  return (
    <div style={styles.card}>
      {/* ── Header — full width ──────────────────────────────────────────── */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerRow}>
            <h3 style={styles.roomTitle}>{roomName}</h3>
            {isConfirmed ? (
              <span style={styles.confirmedBadge}>✓ Reserved</span>
            ) : (
              <span style={styles.pendingBadge}>In Progress</span>
            )}
          </div>
          <div style={styles.headerMeta}>
            <span style={styles.metaItem}>
              <MapPin size={13} style={{ marginRight: 4 }} />
              {branch}
            </span>

            {(() => {
              const { primaryDate, showRequested, requestedDate } = resolveDisplayMoveInDate(
                reservation,
                readMoveInDate,
                formatDate,
              );
              if (!primaryDate) return null;
              return (
                <>
                  <span style={styles.metaDot}>·</span>
                  <span style={styles.metaItem}>Move-in: {formatDate(primaryDate)}</span>
                  {showRequested && (
                    <>
                      <span style={styles.metaDot}>·</span>
                      <span style={styles.metaItem}>
                        Originally requested: {formatDate(requestedDate)}
                      </span>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Viewing Preference Receipt ───────────────────────────────────── */}
      {feedback && (
        <div style={styles.receiptCard}>
          <div style={styles.receiptCardHeader}>
            <div style={styles.receiptCardHeaderLeft}>
              <span style={styles.receiptCardTitle}>Viewing Preference Saved</span>
              <span
                style={{
                  ...styles.receiptStatusPill,
                  ...(feedback.viewingPreference === "physical_visit"
                    ? styles.receiptPillPhysical
                    : feedback.viewingPreference === "urgent_move_in_review"
                      ? styles.receiptPillUrgent
                      : styles.receiptPillRemote),
                }}
              >
                {feedback.viewingPreference === "physical_visit"
                  ? "Physical Visit"
                  : feedback.viewingPreference === "urgent_move_in_review"
                    ? "Priority Review"
                    : "Remote Viewing"}
              </span>
            </div>
            {onDismissFeedback && (
              <button
                type="button"
                onClick={onDismissFeedback}
                style={styles.receiptDismissBtn}
              >
                ✕
              </button>
            )}
          </div>
          <div style={styles.receiptRows}>
            <div style={styles.receiptRow}>
              <span style={styles.receiptRowLabel}>Room</span>
              <span style={styles.receiptRowValue}>{roomName}</span>
            </div>
            <div style={styles.receiptRow}>
              <span style={styles.receiptRowLabel}>Branch</span>
              <span style={styles.receiptRowValue}>{branch}</span>
            </div>
            {feedback.viewingPreference === "physical_visit" ? (
              <>
                {feedback.visitDate && (
                  <div style={styles.receiptRow}>
                    <span style={styles.receiptRowLabel}>Preferred Date</span>
                    <span style={styles.receiptRowValue}>
                      {formatDate(feedback.visitDate)}
                    </span>
                  </div>
                )}
                {feedback.visitTime && (
                  <div style={styles.receiptRow}>
                    <span style={styles.receiptRowLabel}>Preferred Time</span>
                    <span style={styles.receiptRowValue}>{feedback.visitTime}</span>
                  </div>
                )}
                {feedback.visitCode && (
                  <div style={styles.receiptRow}>
                    <span style={styles.receiptRowLabel}>Visit Code</span>
                    <span
                      style={{ ...styles.receiptRowValue, ...styles.receiptCode }}
                    >
                      {feedback.visitCode}
                    </span>
                  </div>
                )}
              </>
            ) : feedback.viewingPreference === "urgent_move_in_review" ? (
              <div style={styles.receiptRow}>
                <span style={styles.receiptRowLabel}>Request Type</span>
                <span style={styles.receiptRowValue}>Priority Viewing Review</span>
              </div>
            ) : (
              <div style={styles.receiptRow}>
                <span style={styles.receiptRowLabel}>Viewing Type</span>
                <span style={styles.receiptRowValue}>Remote Viewing</span>
              </div>
            )}
            <div style={styles.receiptRow}>
              <span style={styles.receiptRowLabel}>Status</span>
              <span style={styles.receiptRowValue}>
                {feedback.viewingPreference === "physical_visit"
                  ? physicalVisitState?.title || "Physical Visit Scheduled"
                  : "Application Ready"}
              </span>
            </div>
          </div>
          <div style={styles.receiptNote}>
            {feedback.viewingPreference === "physical_visit"
              ? "Please attend your scheduled room visit first. You may continue to the tenant application after admin confirms your visit or allows you to proceed. Payment will remain locked until your application and documents are approved."
              : "Payment is locked until your application and documents are reviewed and approved by admin."}
          </div>
          <div style={styles.receiptActions}>
            {feedback.viewingPreference === "physical_visit" ? (
              <button
                type="button"
                onClick={() => goToFlow("/applicant/reservation?step=2&edit=1")}
                style={styles.receiptPrimaryBtn}
              >
                Review Visit Schedule
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goToFlow("/applicant/reservation?step=3")}
                style={styles.receiptPrimaryBtn}
              >
                Complete Application
              </button>
            )}
            <button
              type="button"
              onClick={() => goToFlow("/applicant/reservation?step=2&edit=1")}
              style={styles.receiptSecondaryBtn}
            >
              Change Viewing Preference
            </button>
          </div>
        </div>
      )}


      {/* ── Step Indicator ────────────────────────────────────────────────── */}
      <div style={styles.stepperWrapper}>
        <div style={styles.stepperProgressRail}>
          <div
            style={{
              ...styles.stepperTrackProgress,
              width: `${stepperProgressPercent}%`,
            }}
          />
        </div>
        <div style={styles.stepperInner}>
          {STEPS.map((step, i) => {
            const status = getStepStatus(step.stage, currentStage, reservation);
            const Icon = step.icon;
            const isFirst = i === 0;
            const isLast = i === STEPS.length - 1;
            return (
              <div
                key={step.key}
                style={{
                  ...styles.stepItem,
                  ...(isFirst ? styles.stepItemFirst : {}),
                  ...(isLast ? styles.stepItemLast : {}),
                  cursor:
                    status === "complete" ||
                    status === "current" ||
                    status === "waiting" ||
                    status === "rejected"
                      ? "pointer"
                      : "default",
                  opacity: status === "locked" ? 0.4 : 1,
                }}
                onClick={() => {
                  if (
                    step.stage === 1 &&
                    (status === "complete" || status === "waiting")
                  ) {
                    goToFlow(`/applicant/reservation?step=${step.stage}`);
                    return;
                  }
                  if (status === "current" && action.route) {
                    goToFlow(action.route);
                  } else if (status === "complete" || status === "waiting") {
                    goToFlow(`/applicant/reservation?step=${step.stage}`);
                  }
                }}
                title={
                  status === "locked"
                    ? "Complete previous steps first"
                    : `Step ${step.stage}: ${step.label} — ${step.desc}`
                }
              >
                <div
                  style={{
                    ...styles.stepCircle,
                    ...(status === "complete"
                      ? styles.stepComplete
                      : status === "current"
                        ? styles.stepCurrent
                        : status === "waiting"
                          ? styles.stepWaiting
                          : status === "rejected"
                            ? styles.stepRejected
                            : styles.stepLocked),
                  }}
                >
                  {status === "complete" ? (
                    <CheckCircle size={20} color="#fff" />
                  ) : status === "waiting" ? (
                    <Clock size={20} color="#fff" />
                  ) : status === "rejected" ? (
                    <AlertCircle size={20} color="#fff" />
                  ) : (
                    <Icon
                      size={20}
                      color={status === "current" ? "#fff" : "#94A3B8"}
                    />
                  )}
                </div>
                <span
                  style={{
                    ...styles.stepLabel,
                    color:
                      status === "complete"
                        ? "#059669"
                        : status === "current"
                          ? "var(--color-primary, #D4AF37)"
                          : status === "waiting"
                            ? "#2563EB"
                            : status === "rejected"
                              ? "#DC2626"
                              : "#94A3B8",
                    fontWeight:
                      status === "current" ||
                      status === "waiting" ||
                      status === "rejected"
                        ? 600
                        : 400,
                  }}
                >
                  {step.label}
                </span>
                <span
                  style={{
                    ...styles.stepDesc,
                    color:
                      status === "complete"
                        ? "#6EE7B7"
                        : status === "current"
                          ? "#E7CF87"
                          : status === "rejected"
                            ? "#FCA5A5"
                            : "#CBD5E1",
                  }}
                >
                  {getStepDesc(step, status, reservation)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Next Action Row ──────────────────────────────────────────────── */}
      {action.title && !isConfirmed && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 8,
            background: action.isRejected
              ? "rgba(220, 38, 38, 0.08)"
              : action.isWaiting
                ? "rgba(37, 99, 235, 0.06)"
                : "rgba(15, 23, 42, 0.08)",
            border: `1px solid ${action.isRejected ? "rgba(220, 38, 38, 0.2)" : action.isWaiting ? "rgba(37, 99, 235, 0.15)" : "rgba(15, 23, 42, 0.2)"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                flexShrink: 0,
                background: action.isRejected
                  ? "#DC2626"
                  : action.isWaiting
                    ? "#2563EB"
                    : "var(--text-heading, #0F172A)",
              }}
            />
            <div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: action.isRejected
                    ? "#DC2626"
                    : action.isWaiting
                      ? "#1D4ED8"
                      : "#0F172A",
                  marginRight: 6,
                }}
              >
                {action.title}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: action.isRejected ? "#7F1D1D" : "#94A3B8",
                }}
              >
                {action.description}
              </span>
            </div>
          </div>
          {action.buttonLabel && action.route && (
            <button
              onClick={() => goToFlow(action.route)}
              style={{
                flexShrink: 0,
                padding: "6px 14px",
                background: action.isRejected
                  ? "#DC2626"
                  : "var(--text-heading, #0F172A)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {action.buttonLabel}
            </button>
          )}
        </div>
      )}

      {/* ── Post-Confirmation Dashboard ─────────────────────────────────── */}
      {isConfirmed &&
        (() => {
          // Use the confirmed move-in date (readMoveInDate) as the active
          // date; fall back to the originally requested date only when no
          // confirmed date has been reconciled yet.
          const moveIn = readMoveInDate(reservation) || reservation.targetMoveInDate;
          const daysLeft = moveIn
            ? Math.ceil(
                (new Date(moveIn) - new Date()) / (1000 * 60 * 60 * 24),
              )
            : null;

          return (
            <div style={styles.confirmedDashboard}>
              {daysLeft !== null && (
                <div style={styles.countdownCard}>
                  <div style={styles.countdownLeft}>
                    <Calendar
                      size={18}
                      color="#6366F1"
                      style={{ flexShrink: 0 }}
                    />
                    <div>
                      <div style={styles.countdownLabel}>Move-in Date</div>
                      <div style={styles.countdownDate}>
                        {formatDate(moveIn)}
                      </div>
                    </div>
                  </div>
                  <div style={styles.countdownBadge}>
                    {daysLeft > 0 ? (
                      <>
                        <span style={styles.countdownNumber}>{daysLeft}</span>{" "}
                        day{daysLeft !== 1 ? "s" : ""} away
                      </>
                    ) : daysLeft === 0 ? (
                      <span style={{ color: "#059669", fontWeight: 700 }}>
                        Today!
                      </span>
                    ) : (
                      <span style={{ color: "#94A3B8" }}>Passed</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {/* ── Footer — full width ───────────────────────────────────────────── */}
      {(reservation.reservationStatus || reservation.status) !== "cancelled" &&
        (reservation.reservationStatus || reservation.status) !== "moveIn" && (
          <div style={styles.footer}>
            <div style={styles.footerLeft}>
              {!isConfirmed &&
                currentStage <= 2 &&
                !reservation.viewingPreference &&
                !reservation.viewingType &&
                !reservation.visitApproved &&
                !reservation.scheduleApproved && (
                  <button
                    onClick={() =>
                      navigate(
                        `/applicant/check-availability?changeRoom=1&reservationId=${reservation._id}`,
                      )
                    }
                    style={styles.footerLinkSecondary}
                  >
                    ↩ Change Room
                  </button>
                )}
            </div>
            {isConfirmed ? (
              reservation.cancellationRequested &&
              reservation.cancellationStatus === "pending" ? (
                <span
                  style={{
                    ...styles.footerLinkDanger,
                    opacity: 0.5,
                    cursor: "default",
                    fontSize: "0.8rem",
                  }}
                >
                  Cancellation pending review
                </span>
              ) : (
                <button
                  onClick={() => {
                    if (onGoToReservation) {
                      onGoToReservation();
                    } else {
                      setShowRequestCancelModal(true);
                    }
                  }}
                  style={styles.footerLinkDanger}
                >
                  Request Cancellation
                </button>
              )
            ) : (
              <button
                onClick={() => {
                  setShowCancelModal(true);
                }}
                style={styles.footerLinkDanger}
              >
                Cancel reservation process
              </button>
            )}
          </div>
        )}

      {/* ── Cancel Confirmation Modal ─────────────────────────────────────── */}
      <BaseModal
        isOpen={showCancelModal}
        onClose={() => {
          if (!isCancelling) setShowCancelModal(false);
        }}
        title="Cancel Reservation Process?"
        subtitle={`Room: ${roomName}`}
        variant="warning"
        size="sm"
        cancelText="Keep process"
        confirmText={isCancelling ? "Cancelling Process..." : "Cancel Process"}
        loading={isCancelling}
        onConfirm={async () => {
          setIsCancelling(true);
          try {
            const { reservationApi } = await import(
              "../../../shared/api/reservationApi"
            );
            await reservationApi.updateByUser(reservation._id, {
              cancelReservation: true,
            });
            setShowCancelModal(false);
            showNotification(
              "Reservation process cancelled.",
              "success",
              3000,
            );
            queryClient.invalidateQueries({
              queryKey: ["reservations"],
            });
          } catch (err) {
            console.error("Cancel failed:", err);
            setIsCancelling(false);
            setShowCancelModal(false);
            showNotification(
              "Failed to cancel reservation process. Please try again.",
              "error",
              4000,
            );
          }
        }}
      >
        <p style={{ margin: 0, color: "var(--text-secondary, #475569)", lineHeight: 1.5 }}>
          This will cancel your current room reservation process for <strong>{roomName}</strong> and release your selected room. You can select another room at any time.
        </p>
      </BaseModal>

      {/* ── Request Cancellation Modal (paid reservations) ───────────────── */}
      <BaseModal
        isOpen={showRequestCancelModal}
        onClose={() => {
          if (!isRequesting) setShowRequestCancelModal(false);
        }}
        title="Request Cancellation?"
        subtitle={`Room: ${roomName}`}
        variant="warning"
        size="sm"
        cancelText="Keep it"
        confirmText={isRequesting ? "Submitting..." : "Submit Request"}
        loading={isRequesting}
        onConfirm={async () => {
          setIsRequesting(true);
          try {
            const { reservationApi } = await import(
              "../../../shared/api/reservationApi"
            );
            await reservationApi.requestCancellation(reservation._id);
            setShowRequestCancelModal(false);
            showNotification(
              "Cancellation request submitted. Pending admin review.",
              "success",
              4000,
            );
            queryClient.invalidateQueries({
              queryKey: ["reservations"],
            });
          } catch (err) {
            console.error("Cancellation request failed:", err);
            setIsRequesting(false);
            setShowRequestCancelModal(false);
            showNotification(
              "Failed to submit cancellation request. Please try again.",
              "error",
              4000,
            );
          }
        }}
      >
        <p style={{ margin: 0, color: "var(--text-secondary, #475569)", lineHeight: 1.5 }}>
          Your reservation fee for <strong>{roomName}</strong> is{" "}
          <strong>non-refundable</strong>. Submitting this request will
          place it under admin review. Your bed will only be released once an admin approves.
        </p>
      </BaseModal>
    </div>
  );
}

/* ── styles ──────────────────────────────────────────────────────────────── */

const styles = {
  card: {
    background: "var(--surface-card, #FFFFFF)",
    borderRadius: 12,
    border: "1px solid var(--border-card, #E2E8F0)",
    padding: "24px 28px",
    marginBottom: 0,
  },

  /* empty state */
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "var(--surface-muted, #F1F5F9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text-heading, #0F172A)",
    margin: "0 0 8px",
  },
  emptyDescription: {
    fontSize: 14,
    color: "var(--text-secondary, #64748B)",
    margin: "0 0 24px",
    lineHeight: 1.5,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    padding: "10px 24px",
    background: "#FFFFFF",
    color: "var(--color-primary, #D4AF37)",
    border: "1px solid var(--color-primary, #D4AF37)",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
  },

  /* header */
  header: {
    marginBottom: 20,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  roomTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text-heading, #0F172A)",
    margin: 0,
    letterSpacing: "-0.01em",
  },
  confirmedBadge: {
    fontSize: 12,
    fontWeight: 600,
    color: "#059669",
    background: "rgba(16, 185, 129, 0.12)",
    padding: "3px 10px",
    borderRadius: 999,
  },
  pendingBadge: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--color-primary, #D4AF37)",
    background: "rgba(212, 175, 55, 0.14)",
    padding: "3px 10px",
    borderRadius: 999,
  },
  headerMeta: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  metaItem: {
    fontSize: 13,
    color: "var(--text-secondary, #64748B)",
    display: "inline-flex",
    alignItems: "center",
  },
  metaDot: {
    fontSize: 13,
    color: "#CBD5E1",
    margin: "0 4px",
  },

  /* receipt card */
  receiptCard: {
    marginBottom: 18,
    padding: "14px 16px",
    borderRadius: 10,
    background: "rgba(15, 23, 42, 0.03)",
    border: "1px solid rgba(15, 23, 42, 0.1)",
  },
  receiptCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  receiptCardHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  receiptCardTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-heading, #0F172A)",
    letterSpacing: "-0.01em",
  },
  receiptStatusPill: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 999,
    letterSpacing: "0.02em",
  },
  receiptPillPhysical: {
    background: "rgba(212, 175, 55, 0.14)",
    color: "#92650a",
  },
  receiptPillRemote: {
    background: "rgba(37, 99, 235, 0.1)",
    color: "#1D4ED8",
  },
  receiptPillUrgent: {
    background: "rgba(99, 102, 241, 0.1)",
    color: "#4F46E5",
  },
  receiptPillSuccess: {
    background: "rgba(16, 185, 129, 0.12)",
    color: "#047857",
  },
  receiptPillDanger: {
    background: "rgba(220, 38, 38, 0.12)",
    color: "#B91C1C",
  },
  receiptDismissBtn: {
    background: "transparent",
    border: "none",
    color: "#94A3B8",
    fontSize: 13,
    cursor: "pointer",
    padding: "2px 4px",
    lineHeight: 1,
  },
  receiptRows: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    marginBottom: 10,
  },
  receiptRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 12,
    padding: "5px 0",
    borderBottom: "1px solid rgba(15, 23, 42, 0.05)",
  },
  receiptRowLabel: {
    color: "#94A3B8",
    fontWeight: 500,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  receiptRowValue: {
    color: "var(--text-heading, #0F172A)",
    fontWeight: 500,
    textAlign: "right",
  },
  receiptCode: {
    fontFamily: "monospace",
    fontSize: 12,
    letterSpacing: "0.05em",
  },
  receiptNote: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 1.5,
    marginBottom: 10,
    paddingTop: 2,
  },
  receiptSubnote: {
    fontSize: 11,
    color: "#334155",
    lineHeight: 1.5,
    marginBottom: 10,
    padding: "10px 12px",
    borderRadius: 8,
    background: "rgba(15, 23, 42, 0.04)",
    border: "1px solid rgba(15, 23, 42, 0.08)",
  },
  receiptActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  receiptPrimaryBtn: {
    flex: 1,
    minWidth: 140,
    padding: "7px 12px",
    background: "var(--text-heading, #0F172A)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
  },
  receiptSecondaryBtn: {
    flex: 1,
    minWidth: 140,
    padding: "7px 12px",
    background: "transparent",
    color: "var(--text-secondary, #64748B)",
    border: "1px solid rgba(15, 23, 42, 0.15)",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "center",
  },

  /* category row */
  categoryRow: {
    display: "flex",
    justifyContent: "center",
    gap: 0,
    marginBottom: 8,
  },
  categoryGroup: {
    textAlign: "center",
  },
  categoryLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    fontWeight: 700,
    color: "#94A3B8",
    paddingBottom: 6,
    borderBottom: "1px solid #E2E8F0",
    display: "inline-block",
  },

  /* stepper */
  stepperWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "min(100%, 980px)",
    margin: "0 auto 20px",
    padding: "16px 0",
    gap: 0,
  },
  stepperProgressRail: {
    position: "absolute",
    top: 42,
    left: "calc(10% - 18px)",
    right: "calc(10% - 18px)",
    height: 2,
    borderRadius: 999,
    overflow: "hidden",
    zIndex: 0,
  },
  stepperTrackProgress: {
    height: "100%",
    borderRadius: 999,
    background: "#10B981",
    transition: "width 0.25s ease",
  },
  stepperInner: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 0,
    width: "100%",
    padding: "0 8px",
  },
  stepItem: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    flex: "1 1 0",
    minWidth: 0,
    padding: "0 8px",
  },
  stepItemFirst: {
    transform: "translateX(-18px)",
  },
  stepItemLast: {
    transform: "translateX(18px)",
  },
  stepCircle: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },
  stepComplete: {
    background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
    boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.2)",
  },
  stepCurrent: {
    background: "linear-gradient(135deg, #D4AF37 0%, #c49a1f 100%)",
    boxShadow:
      "0 0 0 4px rgba(212, 175, 55, 0.25), 0 0 12px rgba(212, 175, 55, 0.3)",
  },
  stepWaiting: {
    background: "#2563EB",
    boxShadow: "0 0 0 4px rgba(37, 99, 235, 0.15)",
  },
  stepRejected: {
    background: "linear-gradient(135deg, #DC2626 0%, #EF4444 100%)",
    boxShadow:
      "0 0 0 4px rgba(220, 38, 38, 0.2), 0 0 12px rgba(220, 38, 38, 0.15)",
  },
  stepLocked: {
    background: "var(--surface-muted, #F1F5F9)",
    border: "1px solid var(--border-card, #E2E8F0)",
  },
  stepLabel: {
    fontSize: 14,
    textAlign: "center",
    whiteSpace: "normal",
    lineHeight: 1.3,
    maxWidth: 170,
  },
  stepDesc: {
    fontSize: 12,
    textAlign: "center",
    whiteSpace: "normal",
    lineHeight: 1.3,
    maxWidth: 190,
    marginTop: 0,
  },

  /* action card */
  actionCard: {
    background: "var(--surface-muted, #F8FAFC)",
    borderRadius: 8,
    padding: "16px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  actionContent: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },
  actionIconWrap: {
    marginTop: 2,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: 600,
    margin: "0 0 4px",
  },
  actionDescription: {
    fontSize: 13,
    color: "var(--text-secondary, #64748B)",
    margin: 0,
    lineHeight: 1.5,
  },
  actionButton: {
    padding: "8px 20px",
    background: "var(--text-heading, #0F172A)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  /* post-confirmation dashboard */
  confirmedDashboard: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  countdownCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(99, 102, 241, 0.06)",
    borderRadius: 10,
    padding: "14px 18px",
    border: "1px solid rgba(99, 102, 241, 0.15)",
  },
  countdownLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  countdownLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: 500,
    marginBottom: 1,
  },
  countdownDate: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-heading, #0F172A)",
  },
  countdownBadge: {
    fontSize: 13,
    color: "#6366F1",
    fontWeight: 600,
    background: "rgba(99, 102, 241, 0.1)",
    padding: "4px 12px",
    borderRadius: 20,
    whiteSpace: "nowrap",
  },
  countdownNumber: {
    fontSize: 18,
    fontWeight: 700,
    marginRight: 3,
  },

  /* footer */
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    paddingTop: 16,
    borderTop: "1px solid var(--border-subtle, #F1F5F9)",
  },
  footerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  footerLinkSecondary: {
    background: "none",
    border: "none",
    color: "var(--text-secondary, #64748B)",
    fontSize: 13,
    cursor: "pointer",
    padding: "6px 10px",
    borderRadius: 6,
    fontWeight: 500,
    transition: "background 0.15s, color 0.15s",
  },
  footerLinkDanger: {
    background: "none",
    border: "1px solid #FCA5A5",
    color: "#DC2626",
    fontSize: 13,
    cursor: "pointer",
    padding: "6px 12px",
    borderRadius: 6,
    fontWeight: 500,
    transition: "background 0.15s",
  },
  cancelLink: {
    background: "none",
    border: "none",
    color: "#94A3B8",
    fontSize: 13,
    cursor: "pointer",
    padding: 4,
    textDecoration: "underline",
    textUnderlineOffset: 2,
  },

  /* cancel modal */
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalCard: {
    background: "var(--surface-card, #FFFFFF)",
    borderRadius: 16,
    padding: "32px",
    maxWidth: 400,
    width: "90%",
    boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
    textAlign: "center",
  },
  modalIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text-heading, #0F172A)",
    margin: "0 0 8px",
  },
  modalDesc: {
    fontSize: 14,
    color: "var(--text-secondary, #64748B)",
    margin: "0 0 24px",
    lineHeight: 1.5,
  },
  modalActions: {
    display: "flex",
    gap: 12,
  },
  modalHint: {
    fontSize: 13,
    color: "var(--text-secondary, #64748B)",
    margin: "14px 0 0",
  },
  modalBtnSecondary: {
    flex: 1,
    padding: "12px",
    background: "var(--surface-muted, #F3F4F6)",
    color: "var(--text-body, #374151)",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 500,
    fontSize: 14,
  },
  modalBtnDanger: {
    flex: 1,
    padding: "12px",
    background: "#DC2626",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
};
