import {
  canAccessTenantApplication,
  getPhysicalVisitApplicantState,
  getReservationViewingPreference,
  isPhysicalVisitPreference,
} from "./physicalVisitFlow.js";
import {
  canReservationAccessPayment,
  hasReservationStatus,
  normalizeReservationStatus,
} from "../../../shared/utils/lifecycleNaming.js";

/**
 * Reservation progress calculation logic.
 * Extracted from ProfilePage.getReservationProgress() (~160 lines).
 *
 * Computes the current step, step statuses, and step metadata
 * for the reservation progress tracker.
 */

const STEP_ORDER = [
 "room_selected",
 "visit_scheduled",
 "visit_completed",
 "application_submitted",
 "payment_submitted",
 "reserved",
];

export const DEFAULT_STEPS = [
 {
 step: "room_selected",
 title: "1. Room Selection",
 description: "Select a room to reserve",
 status: "current",
 },
 {
 step: "visit_scheduled",
 title: "2. Policies & Visit Scheduled",
 description: "Acknowledge policies and schedule your room visit",
 status: "locked",
 },
 {
 step: "visit_completed",
 title: "3. Visit Completed",
 description: "Room visit completed and verified",
 status: "locked",
 },
 {
 step: "application_submitted",
 title: "4. Tenant Application Submitted",
 description: "Personal details and documents uploaded",
 status: "locked",
 },
 {
 step: "payment_submitted",
 title: "5. Payment Submitted",
 description: "Reservation fee paid via PayMongo",
 status: "locked",
 },
 {
 step: "reserved",
 title: "6. Room Reserved",
 description: "Room reservation confirmed",
 status: "locked",
 },
];

export function getReservationProgress(reservation) {
 if (!reservation) {
 return { currentStep: "not_started", steps: [], currentStepIndex: -1 };
 }

 const status = normalizeReservationStatus(
 reservation.reservationStatus || reservation.status || "pending",
 );
 const viewingPreference = getReservationViewingPreference(reservation);
 const physicalVisitState = getPhysicalVisitApplicantState(reservation);

 const hasRoom = Boolean(reservation.roomId);
 const hasPoliciesAccepted = Boolean(reservation.agreedToPrivacy === true);
 const hasVisitRequest = Boolean(viewingPreference);
 const isVisitScheduled = hasPoliciesAccepted && hasVisitRequest;
 const isVisitCompleted = canAccessTenantApplication(reservation);
 const hasApplication = Boolean(
 reservation.applicationSubmittedAt ||
 hasReservationStatus(
 status,
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
 const hasPayment = hasReservationStatus(
 status,
 "payment_pending",
 "reserved",
 "moveIn",
 "moveOut",
 );
 const isConfirmed = hasReservationStatus(status, "reserved", "moveIn", "moveOut");

 const isScheduleRejected = Boolean(reservation.scheduleRejected === true);
 const scheduleRejectionReason = reservation.scheduleRejectionReason || null;

 let currentStepIndex = -1;
 if (hasRoom) currentStepIndex = 0;
 if (reservation.roomConfirmed) currentStepIndex = 1;
 if (isVisitScheduled && !isScheduleRejected) currentStepIndex = 1;
 if (isVisitCompleted) currentStepIndex = 2;
 if (hasApplication) currentStepIndex = 3;
 if (hasPayment) currentStepIndex = 4;
 if (isConfirmed) currentStepIndex = 5;

 const isApplicationEditable =
 hasReservationStatus(status, "needs_revision") && !hasPayment && !isConfirmed;
 // Schedules are auto-approved at booking time — no admin approval step needed
 const isSchedulePendingApproval = false;
 const isPaymentPendingApproval = hasReservationStatus(status, "payment_pending");

 const steps = [
 {
 step: "room_selected",
 title: "1. Room Selection",
 description: "Room selected and reserved",
 status: currentStepIndex >= 0 ? "completed" : "current",
 completedDate: reservation.createdAt,
 roomName: reservation.roomId?.name || "Unknown Room",
 branch: reservation.roomId?.branch,
 },
 {
 step: "visit_scheduled",
 title: "2. Policies & Visit Scheduled",
 description: isScheduleRejected
 ? `Schedule rejected: ${scheduleRejectionReason || "Please reschedule your visit"}`
 : "Acknowledge policies and schedule your room visit",
 status: isScheduleRejected
 ? "rejected"
 : currentStepIndex >= 1
 ? isSchedulePendingApproval
 ? "pending_approval"
 : "completed"
 : currentStepIndex === 0
 ? "current"
 : "locked",
 completedDate: currentStepIndex >= 1 ? reservation.updatedAt : undefined,
 rejectionReason: scheduleRejectionReason,
 rejectedAt: reservation.scheduleRejectedAt,
 },
 {
 step: "visit_completed",
 title: "3. Visit Completed",
 description: !isPhysicalVisitPreference(reservation)
 ? "Viewing preference saved. You may proceed to the tenant application."
 : physicalVisitState?.message || "Complete your scheduled visit first",
 status:
 currentStepIndex >= 2
 ? "completed"
 : currentStepIndex === 1 &&
   isPhysicalVisitPreference(reservation) &&
   isVisitScheduled
 ? "awaiting_visit"
 : "locked",
 completedDate:
 currentStepIndex >= 2 ? reservation.visitCompletedAt : undefined,
 },
 {
 step: "application_submitted",
 title: "4. Tenant Application Submitted",
 description: isApplicationEditable
 ? "Application submitted - can still edit"
 : isConfirmed
 ? "Application locked - reservation secured"
 : hasPayment
 ? "Application locked - payment submitted"
 : "Personal details and documents submitted",
 status:
 currentStepIndex >= 3
 ? "completed"
 : currentStepIndex === 2
 ? "current"
 : "locked",
 completedDate:
 currentStepIndex >= 3 ? reservation.applicationSubmittedAt : undefined,
 editable: isApplicationEditable,
 },
 {
 step: "payment_submitted",
 title: "5. Payment Submitted",
 description: isPaymentPendingApproval
 ? "Awaiting payment confirmation"
 : "Reservation fee paid and verified",
 status: isPaymentPendingApproval
 ? "pending_approval"
 : currentStepIndex >= 4
 ? "completed"
 : currentStepIndex === 3
 ? "current"
 : "locked",
 completedDate:
 currentStepIndex >= 4 ? reservation.paymentDate : undefined,
 },
 {
 step: "reserved",
 title: "6. Room Reserved",
 description: isPaymentPendingApproval
 ? "Pending admin payment verification"
 : "Room reservation confirmed",
 status: currentStepIndex >= 5 ? "completed" : "locked",
 completedDate:
 currentStepIndex >= 5 ? reservation.approvedDate : undefined,
 },
 ];

 return {
 currentStep: STEP_ORDER[currentStepIndex] || "room_selected",
 steps,
 currentStepIndex: Math.max(currentStepIndex, 0),
 };
}

/**
 * Determines the next action CTA for the user based on reservation progress.
 */
export function getNextAction(activeReservation, reservationProgress) {
 if (!activeReservation) {
 return {
 title: "Start Your Reservation",
 description: "Browse available rooms and start the reservation process",
 buttonText: "Browse Rooms",
 buttonLink: "/applicant/check-availability",
 };
 }

 const currentStep = reservationProgress.currentStep;
 const status = normalizeReservationStatus(
 activeReservation.reservationStatus || activeReservation.status || "pending",
 );
 const paymentUnlocked = canReservationAccessPayment(status);
 const physicalVisitState = getPhysicalVisitApplicantState(activeReservation);
 const canAccessApplication = canAccessTenantApplication(activeReservation);
 const hasApplication = Boolean(
 activeReservation.firstName && activeReservation.lastName,
 );

 if (hasReservationStatus(status, "rejected", "cancelled", "expired", "archived")) {
 return {
 title: hasReservationStatus(status, "rejected")
 ? "Application Rejected"
 : "Reservation Closed",
 description:
 activeReservation.applicationReviewReason ||
 "This reservation is no longer available for application submission.",
 buttonText: "View Status",
 buttonLink: "/applicant/profile",
 buttonVariant: "outline",
 };
 }

 if (hasReservationStatus(status, "payment_pending")) {
 return {
 title: "Payment In Progress",
 description:
 "Your checkout was started. The reservation will be confirmed once payment is completed.",
 buttonText: "Review Payment",
 buttonLink: "/applicant/reservation",
 reservationId: activeReservation._id,
 step: 4,
 };
 }

 if (hasReservationStatus(status, "reserved")) {
 return {
 title: "Room Reserved",
 description:
 "Your room reservation has been confirmed. Please wait for further instructions from the admin.",
 buttonText: "View Reservation Status",
 buttonLink: "/applicant/profile",
 };
 }

 if (hasReservationStatus(status, "moveIn", "moveOut")) {
 return {
 title: hasReservationStatus(status, "moveOut") ? "Stay Completed" : "Tenant Stay Active",
 description: hasReservationStatus(status, "moveOut")
 ? "This stay has been completed."
 : "Your tenant stay is active.",
 buttonText: "View Details",
 buttonLink: "/applicant/profile",
 };
 }

 if (
 physicalVisitState &&
 !canAccessApplication &&
 !hasApplication
 ) {
 return {
 title: physicalVisitState.title,
 description: physicalVisitState.message,
 buttonText: physicalVisitState.buttonLabel?.replace(/\s*(->|→)\s*$/, "") || "Review Visit",
 buttonLink: physicalVisitState.route || "/applicant/reservation?step=2",
 reservationId: activeReservation._id,
 step: 2,
 };
 }

 switch (currentStep) {
 case "room_selected":
 return {
 title: "Confirm Room & Continue",
 description: "Review your selected room and confirm your choice.",
 buttonText: "Continue",
 buttonLink: "/applicant/reservation",
 reservationId: activeReservation._id,
 step: 1,
 };
 case "visit_scheduled": {
 const viewingPreference = getReservationViewingPreference(activeReservation);
 // Non-physical users have already saved their preference — send to application
 if (viewingPreference && viewingPreference !== "physical_visit") {
 return {
 title: "Submit Your Application",
 description:
 "Your viewing preference was saved. Fill in your personal details and upload required documents.",
 buttonText: "Fill Application Form",
 buttonLink: "/applicant/reservation",
 reservationId: activeReservation._id,
 step: 3,
 };
 }
 const hasVisitDate = Boolean(activeReservation.visitDate);
 if (!hasVisitDate) {
 return {
 title: "Schedule Your Visit",
 description:
 "Pick a date and time to visit the dormitory and review policies.",
 buttonText: "Schedule Visit",
 buttonLink: "/applicant/reservation",
 reservationId: activeReservation._id,
 step: 2,
 };
 }
 if (
 physicalVisitState &&
 !canAccessApplication
 ) {
 return {
 title: physicalVisitState.title,
 description: physicalVisitState.message,
 buttonText:
 physicalVisitState.buttonLabel?.replace(/\s*(->|→)\s*$/, "") || "Review Visit",
 buttonLink: physicalVisitState.route || "/applicant/reservation?step=2",
 reservationId: activeReservation._id,
 step: 2,
 };
 }
 return {
 title: "Waiting for Visit Completion",
 description:
 "Your visit has been scheduled. Please complete your visit and wait for admin verification.",
 buttonText: "View Status",
 buttonLink: "/applicant/profile",
 buttonVariant: "outline",
 };
 }
 case "visit_completed":
 return {
 title: "Submit Your Application",
 description:
 "Provide your personal details and upload required documents for admin review.",
 buttonText: "Fill Application Form",
 buttonLink: "/applicant/reservation",
 reservationId: activeReservation._id,
 step: 3,
 };
 case "application_submitted": {
 const reservationFeeAmount = activeReservation.reservationFeeAmount || 2000;
 if (hasReservationStatus(status, "needs_revision")) {
 return {
 title: "Application Needs Revision",
 description:
 activeReservation.applicationReviewReason ||
 "Please update your application or documents so admin can review them again.",
 buttonText: "Update Application",
 buttonLink: "/applicant/reservation",
 reservationId: activeReservation._id,
 step: 3,
 };
 }
 if (hasReservationStatus(status, "rejected")) {
 return {
 title: "Application Rejected",
 description:
 activeReservation.applicationReviewReason ||
 "Your application was not approved. Payment remains locked.",
 buttonText: "View Status",
 buttonLink: "/applicant/profile",
 buttonVariant: "outline",
 };
 }
 if (!paymentUnlocked) {
 return {
 title: "Application Under Review",
 description:
 "Payment will be available once your application and documents are approved.",
 buttonText: "View Status",
 buttonLink: "/applicant/profile",
 buttonVariant: "outline",
 };
 }
 return {
 title: "Submit Your Payment",
 description:
 `Your application has been submitted. Pay PHP ${reservationFeeAmount.toLocaleString("en-PH")} online to confirm your reservation.`,
 buttonText: "Pay Now",
 buttonLink: "/applicant/reservation",
 reservationId: activeReservation._id,
 step: 4,
 };
 }
 case "payment_submitted":
 return {
 title: "Payment Submitted",
 description:
 "Your payment is being reviewed. The reservation will be confirmed after admin verification.",
 buttonText: "View Status",
 buttonLink: "/applicant/profile",
 };
 case "reserved":
 return {
 title: "Room Reserved",
 description:
 "Your room reservation has been confirmed. Please wait for further instructions from the admin.",
 buttonText: "View Reservation Status",
 buttonLink: "/applicant/profile",
 };
 default:
 return {
 title: "Get Started",
 description: "Browse available rooms to begin your reservation",
 buttonText: "Browse Rooms",
 buttonLink: "/applicant/check-availability",
 };
 }
}
