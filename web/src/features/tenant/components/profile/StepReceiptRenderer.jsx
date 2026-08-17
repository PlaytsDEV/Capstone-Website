import React from "react";
import { formatPaymentMethod } from "../../../../shared/utils/formatPaymentMethod";
import { getResolvedMonthlyRate } from "../../utils/pricingDisplayHelpers";

const getEffectiveMonthlyRate = (reservation) => {
  const resolved = getResolvedMonthlyRate(reservation?.pricingDisplay);
  if (resolved !== null && resolved !== undefined) return resolved;
  if (Number.isFinite(Number(reservation?.pricingSnapshot?.finalMonthlyRate))) {
    return Number(reservation.pricingSnapshot.finalMonthlyRate);
  }
  if (Number.isFinite(Number(reservation?.approvedMonthlyRate))) {
    return Number(reservation.approvedMonthlyRate);
  }
  if (Number.isFinite(Number(reservation?.monthlyRent))) {
    return Number(reservation.monthlyRent);
  }
  if (Number.isFinite(Number(reservation?.totalPrice))) {
    return Number(reservation.totalPrice);
  }
  if (Number.isFinite(Number(reservation?.roomId?.price))) {
    return Number(reservation.roomId.price);
  }
  return 0;
};

/**
 * Renders inline receipt/summary content for each reservation step.
 * Uses unified solid design tokens with crisp 1px borders, clear typography, and zero gradients.
 */

const ReceiptRow = ({ label, value, valueColor, valueStyle }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
      padding: "4px 0",
    }}
  >
    <span style={{ color: "#64748B", fontSize: "12.5px", flexShrink: 0 }}>{label}</span>
    <span
      style={{
        color: valueColor || "#0F172A",
        fontWeight: "600",
        fontSize: "12.5px",
        textAlign: "right",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        ...valueStyle,
      }}
    >
      {value || "—"}
    </span>
  </div>
);

const ReceiptContainer = ({ bg, border, children }) => (
  <div
    style={{
      padding: "12px 14px",
      background: bg || "#F8FAFC",
      borderRadius: "8px",
      marginTop: "8px",
      fontSize: "13px",
      border: border || "1px solid #E2E8F0",
    }}
  >
    {children}
  </div>
);

const ActionNote = ({ bg, borderColor, color, children }) => (
  <ReceiptContainer
    bg={bg || "#FFFBEB"}
    border={`1px solid ${borderColor || "#FDE68A"}`}
  >
    <p style={{ color: color || "#92400E", margin: 0, fontSize: "12.5px" }}>{children}</p>
  </ReceiptContainer>
);

// ─── Room Selected ───────────────────────────────────────────
const RoomSelectedReceipt = ({ reservation }) => (
  <ReceiptContainer>
    <ReceiptRow
      label="Room"
      value={
        reservation.roomId?.name || reservation.roomId?.roomNumber || "N/A"
      }
    />
    <ReceiptRow
      label="Branch"
      value={reservation.roomId?.branch || "N/A"}
      valueStyle={{ textTransform: "capitalize" }}
    />
    <ReceiptRow
      label="Type"
      value={reservation.roomId?.type || "N/A"}
      valueStyle={{ textTransform: "capitalize" }}
    />
    <ReceiptRow
      label="Monthly Rate"
      value={`PHP ${getEffectiveMonthlyRate(reservation).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
      valueColor="#0F172A"
      valueStyle={{ fontWeight: "700" }}
    />
    {reservation.selectedBed && (
      <ReceiptRow
        label="Bed"
        value={`${reservation.selectedBed.position || "Bed"} (${reservation.selectedBed.id || reservation.selectedBed.code || "Allocated"})`}
        valueStyle={{ textTransform: "capitalize" }}
      />
    )}
  </ReceiptContainer>
);

// ─── Visit Scheduled ─────────────────────────────────────────
const VisitScheduledReceipt = ({ reservation, step }) => {
  if (step.status !== "completed" && step.status !== "current") return null;

  const isCompleted = step.status === "completed";
  return (
    <ReceiptContainer
      bg={isCompleted ? "#F0FDF4" : "#F8FAFC"}
      border={isCompleted ? "1px solid #BBF7D0" : "1px solid #E2E8F0"}
    >
      <ReceiptRow
        label="Visit Type"
        value={
          reservation.viewingType === "inperson"
            ? "🏠 In-Person Visit"
            : reservation.viewingType === "virtual"
            ? "💻 Virtual Verification"
            : "Not selected"
        }
      />
      {reservation.isOutOfTown && (
        <ReceiptRow
          label="Location"
          value={`📍 ${reservation.currentLocation || "Out of town"}`}
        />
      )}
      <ReceiptRow
        label="Policies Accepted"
        value={reservation.agreedToPrivacy ? "✓ Yes" : "No"}
        valueColor={reservation.agreedToPrivacy ? "#059669" : "#64748B"}
        valueStyle={{ fontWeight: "600" }}
      />
      <ReceiptRow
        label="Schedule Status"
        value={
          reservation.scheduleApproved
            ? "✓ Approved"
            : "⏳ Awaiting Admin Approval"
        }
        valueColor={reservation.scheduleApproved ? "#059669" : "#D97706"}
        valueStyle={{ fontWeight: "600" }}
      />
      {step.status === "current" && !reservation.scheduleApproved && (
        <p style={{ color: "#92400E", margin: "8px 0 0", fontSize: "12px" }}>
          <strong>Note:</strong> Please wait for administration to approve your visit schedule.
        </p>
      )}
    </ReceiptContainer>
  );
};

// ─── Visit Completed ─────────────────────────────────────────
const VisitCompletedReceipt = ({ reservation, step }) => {
  if (step.status === "completed") {
    return (
      <ReceiptContainer bg="#F0FDF4" border="1px solid #BBF7D0">
        <ReceiptRow
          label="Visit Type"
          value={
            reservation.viewingType === "inperson"
              ? "🏠 In-Person Visit"
              : "💻 Virtual Verification"
          }
        />
        <ReceiptRow
          label="Schedule Approval"
          value="✓ Approved"
          valueColor="#059669"
          valueStyle={{ fontWeight: "600" }}
        />
        <ReceiptRow
          label="Visit Status"
          value="✓ Completed & Verified"
          valueColor="#059669"
          valueStyle={{ fontWeight: "600" }}
        />
        <ReceiptRow label="Verified By" value="Administration" />
      </ReceiptContainer>
    );
  }
  if (step.status === "current") {
    return (
      <ReceiptContainer bg="#FFFBEB" border="1px solid #FDE68A">
        <ReceiptRow
          label="Visit Type"
          value={
            reservation.viewingType === "inperson"
              ? "🏠 In-Person Visit"
              : "💻 Virtual Verification"
          }
        />
        <ReceiptRow
          label="Schedule"
          value={
            reservation.scheduleApproved ? "✓ Approved" : "⏳ Awaiting Approval"
          }
          valueColor={reservation.scheduleApproved ? "#059669" : "#D97706"}
          valueStyle={{ fontWeight: "600" }}
        />
        <ReceiptRow
          label="Visit Status"
          value="⏳ Awaiting Completion"
          valueColor="#D97706"
          valueStyle={{ fontWeight: "600" }}
        />
        <p style={{ color: "#92400E", margin: "8px 0 0", fontSize: "12px" }}>
          <strong>Note:</strong> Your visit is scheduled. Administration will verify and complete once done.
        </p>
      </ReceiptContainer>
    );
  }
  return null;
};

// ─── Application Submitted ───────────────────────────────────
const ApplicationReceipt = ({ reservation, step }) => {
  if (step.status === "completed") {
    return (
      <ReceiptContainer bg="#F0FDF4" border="1px solid #BBF7D0">
        <ReceiptRow
          label="Applicant"
          value={`${reservation.firstName || ""} ${reservation.middleName ? reservation.middleName + " " : ""}${reservation.lastName || ""}`.trim() || "Applicant"}
        />
        <ReceiptRow label="Mobile" value={reservation.mobileNumber || "N/A"} />
        <ReceiptRow
          label="Emergency Contact"
          value={reservation.emergencyContactName || "N/A"}
        />
        <ReceiptRow
          label="Employer/School"
          value={reservation.employerSchool || "N/A"}
        />
        <ReceiptRow
          label="Status"
          value="✓ Submitted"
          valueColor="#059669"
          valueStyle={{ fontWeight: "600" }}
        />
      </ReceiptContainer>
    );
  }
  if (step.status === "current") {
    return (
      <ActionNote>
        <strong>📝 Action Required:</strong> Submit your personal details and documents for admin review.
      </ActionNote>
    );
  }
  return null;
};

// ─── Payment Submitted ───────────────────────────────────────
const PaymentReceipt = ({ reservation, step }) => {
  const reservationFeeAmount = Number(reservation.reservationFeeAmount || 2000);
  if (step.status === "completed") {
    return (
      <ReceiptContainer bg="#F0FDF4" border="1px solid #BBF7D0">
        <ReceiptRow
          label="Deposit Amount"
          value={`PHP ${reservationFeeAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
          valueColor="#0F172A"
          valueStyle={{ fontWeight: "700" }}
        />
        <ReceiptRow
          label="Payment Method"
          value={formatPaymentMethod(reservation.paymentMethod)}
        />
        <ReceiptRow
          label="Move-in Date"
          value={
            reservation.finalMoveInDate
              ? new Date(reservation.finalMoveInDate).toLocaleDateString("en-PH")
              : "TBD"
          }
        />
        <ReceiptRow
          label="Status"
          value="✓ Verified"
          valueColor="#059669"
          valueStyle={{ fontWeight: "600" }}
        />
        {reservation.paymentReference && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 0 2px",
              borderTop: "1px solid #BBF7D0",
              marginTop: "6px",
              fontSize: "12px",
            }}
          >
            <span style={{ color: "#64748B", fontWeight: "500" }}>
              Payment Reference
            </span>
            <span style={{ color: "#059669", fontWeight: "700" }}>
              {reservation.paymentReference}
            </span>
          </div>
        )}
      </ReceiptContainer>
    );
  }
  if (step.status === "pending_approval") {
    return (
      <ReceiptContainer bg="#FEF3C7" border="1px solid #FCD34D">
        <p style={{ color: "#78350F", marginBottom: "6px", margin: 0, fontSize: "12px" }}>
          <strong>⏳ Pending Review:</strong> Your payment has been submitted and is being confirmed by the payment gateway.
        </p>
        {reservation.paymentReference && (
          <p style={{ color: "#78350F", fontSize: "11.5px", margin: "6px 0 0" }}>
            <strong>Reference:</strong> {reservation.paymentReference}
          </p>
        )}
      </ReceiptContainer>
    );
  }
  if (step.status === "current") {
    return (
      <ActionNote>
        <strong>💳 Action Required:</strong> Pay {`PHP ${reservationFeeAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`} online to secure your reservation.
      </ActionNote>
    );
  }
  return null;
};

// ─── Confirmed ───────────────────────────────────────────────
const ConfirmedReceipt = ({ reservation, step }) => {
  if (step.status === "completed") {
    return (
      <ReceiptContainer bg="#F0FDF4" border="1px solid #BBF7D0">
        <div
          style={{
            textAlign: "center",
            padding: "6px 0",
            borderBottom: "1px solid #BBF7D0",
            marginBottom: "8px",
          }}
        >
          <p
            style={{
              color: "#15803D",
              fontWeight: "700",
              fontSize: "15px",
              margin: "0 0 4px",
            }}
          >
            Reservation Confirmed!
          </p>
          {reservation.reservationCode && (
            <p style={{ color: "#64748B", fontSize: "11.5px", margin: "2px 0" }}>
              Reservation Code:{" "}
              <strong style={{ color: "#0F172A" }}>
                {reservation.reservationCode}
              </strong>
            </p>
          )}
        </div>
        <ReceiptRow
          label="Room"
          value={
            reservation.roomId?.name || reservation.roomId?.roomNumber || "N/A"
          }
        />
        <ReceiptRow
          label="Branch"
          value={reservation.roomId?.branch || "N/A"}
          valueStyle={{ textTransform: "capitalize" }}
        />
        <ReceiptRow
          label="Monthly Rate"
          value={`PHP ${getEffectiveMonthlyRate(reservation).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
          valueColor="#0F172A"
          valueStyle={{ fontWeight: "700" }}
        />
        <ReceiptRow
          label="Move-in Date"
          value={
            reservation.finalMoveInDate
              ? new Date(reservation.finalMoveInDate).toLocaleDateString("en-PH")
              : "TBD"
          }
        />
      </ReceiptContainer>
    );
  }
  if (step.status === "pending_approval") {
    return (
      <ReceiptContainer bg="#FEF3C7" border="1px solid #FCD34D">
        <p style={{ color: "#78350F", margin: 0, fontSize: "12px" }}>
          <strong>⏳ Under Review:</strong> Your payment is being verified by administration. Once approved, your reservation is confirmed.
        </p>
      </ReceiptContainer>
    );
  }
  return null;
};

// ─── Main Export ─────────────────────────────────────────────
const STEP_RENDERERS = {
  room_selected: RoomSelectedReceipt,
  visit_scheduled: VisitScheduledReceipt,
  visit_completed: VisitCompletedReceipt,
  application_submitted: ApplicationReceipt,
  payment_submitted: PaymentReceipt,
  reserved: ConfirmedReceipt,
};

const StepReceiptRenderer = ({ step, reservation }) => {
  if (!reservation) return null;
  const Renderer = STEP_RENDERERS[step.step];
  if (!Renderer) return null;
  return <Renderer reservation={reservation} step={step} />;
};

export default StepReceiptRenderer;
