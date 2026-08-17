import React, { useState } from "react";
import {
  FileText,
  Download,
  CheckCircle2,
  ShieldCheck,
  X,
  Building2,
  Receipt,
  Clock,
  ExternalLink,
} from "lucide-react";
import { formatPaymentMethod } from "../../../../shared/utils/formatPaymentMethod";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import { getBedDisplayLabel } from "../../../../shared/utils/bedIdentifier";
import { getResolvedMonthlyRate } from "../../utils/pricingDisplayHelpers";
import { generateDepositReceipt } from "../../../../shared/utils/receiptGenerator";

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

const fmtAmt = (n) => {
  const fixed = Number(n || 0).toFixed(2);
  const [int, dec] = fixed.split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + dec;
};

/**
 * Standardized High-Contrast Key-Value Field Row
 */
const ReceiptRow = ({
  label,
  value,
  valueColor,
  valueWeight,
  valueSize,
  capitalize,
}) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
      padding: "7px 0",
      borderBottom: "1px solid #E2E8F0",
    }}
  >
    <span style={{ color: "#64748B", fontSize: "12px", fontWeight: "500", flexShrink: 0 }}>
      {label}
    </span>
    <span
      style={{
        color: valueColor || "#0F172A",
        fontWeight: valueWeight || "600",
        fontSize: valueSize || "12.5px",
        textTransform: capitalize ? "capitalize" : undefined,
        textAlign: "right",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
      }}
    >
      {value || "—"}
    </span>
  </div>
);

const SectionTitle = ({ children }) => (
  <p
    style={{
      fontSize: "11px",
      fontWeight: "700",
      color: "#0F172A",
      margin: "0 0 6px",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      borderBottom: "1px solid #CBD5E1",
      paddingBottom: "3px",
    }}
  >
    {children}
  </p>
);

const TimestampBadge = ({ label, date }) => (
  <div
    style={{
      marginTop: "12px",
      padding: "8px 12px",
      backgroundColor: "#F0FDF4",
      borderRadius: "6px",
      border: "1px solid #BBF7D0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: "12px",
    }}
  >
    <span style={{ color: "#64748B" }}>{label}</span>
    <span style={{ color: "#15803D", fontWeight: "700" }}>
      {date
        ? new Date(date).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—"}
    </span>
  </div>
);

const getViewingPreferenceLabel = (reservation) => {
  const preference =
    reservation?.viewingPreference ||
    (reservation?.viewingType === "virtual"
      ? "remote_2d_viewing"
      : reservation?.viewingType === "inperson"
      ? "physical_visit"
      : reservation?.isUrgentMoveIn
      ? "urgent_move_in_review"
      : null);

  switch (preference) {
    case "physical_visit":
      return "Physical Visit";
    case "remote_2d_viewing":
      return "2D Remote Viewing";
    case "urgent_move_in_review":
      return "Urgent Move-in Review";
    default:
      return "Standard Viewing";
  }
};

// ─── Room Selected Content ───────────────────────────────────
const RoomReceipt = ({ reservation }) => {
  const room = reservation?.roomId || {};
  const monthlyRate = getEffectiveMonthlyRate(reservation);

  return (
    <>
      <div style={{ marginBottom: "14px" }}>
        <SectionTitle>Unit & Slot Allocation</SectionTitle>
        <ReceiptRow
          label="Room Identifier"
          value={room.name || room.roomNumber ? `Room ${room.name || room.roomNumber}` : "Allocated Room"}
        />
        <ReceiptRow
          label="Branch Location"
          value={`${room.branch || "Lilycrest"} Branch`}
          capitalize
        />
        <ReceiptRow
          label="Room Category"
          value={room.type || "Standard Room"}
          capitalize
        />
        <ReceiptRow
          label="Floor"
          value={room.floor ? `Floor ${room.floor}` : "Ground Floor"}
        />
        {reservation?.selectedBed && (
          <ReceiptRow
            label="Bed Space"
            value={getBedDisplayLabel(reservation.selectedBed, 0, room.type)}
          />
        )}
      </div>

      <div style={{ marginBottom: "14px" }}>
        <SectionTitle>Pricing & Rates</SectionTitle>
        <ReceiptRow
          label="Monthly Base Rent"
          value={`PHP ${fmtAmt(monthlyRate)}`}
          valueColor="#0F172A"
          valueWeight="700"
        />
        {room.deposit && (
          <ReceiptRow
            label="Security Deposit"
            value={`PHP ${fmtAmt(room.deposit)}`}
          />
        )}
      </div>

      <TimestampBadge label="Room Selected" date={reservation?.createdAt} />
    </>
  );
};

// ─── Visit Scheduled Content ─────────────────────────────────
const VisitReceipt = ({ reservation }) => (
  <>
    <div style={{ marginBottom: "14px" }}>
      <SectionTitle>Viewing Appointment</SectionTitle>
      <ReceiptRow
        label="Viewing Format"
        value={getViewingPreferenceLabel(reservation)}
      />
      <ReceiptRow
        label={reservation?.scheduleApproved ? "Confirmed Schedule" : "Requested Date"}
        value={
          reservation?.visitDate
            ? new Date(reservation.visitDate).toLocaleDateString("en-PH", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "To be confirmed"
        }
      />
      <ReceiptRow
        label="Time Window"
        value={reservation?.visitTime || "Standard Hours"}
      />
      {reservation?.visitCode && (
        <ReceiptRow label="Visit Reference" value={reservation.visitCode} />
      )}
      <ReceiptRow
        label="Schedule Verification"
        value={reservation?.scheduleApproved ? "Confirmed by Administration" : "Pending Confirmation"}
        valueColor={reservation?.scheduleApproved ? "#059669" : "#D97706"}
      />
    </div>

    <div style={{ marginBottom: "14px" }}>
      <SectionTitle>Contact Details</SectionTitle>
      <ReceiptRow
        label="Applicant Name"
        value={
          reservation?.userId?.fullName ||
          `${reservation?.firstName || ""} ${reservation?.lastName || ""}`.trim() ||
          "Account Holder"
        }
      />
      <ReceiptRow
        label="Contact Phone"
        value={reservation?.mobileNumber || reservation?.userId?.mobileNumber || "—"}
      />
      <ReceiptRow
        label="Account Email"
        value={reservation?.userId?.email || "—"}
      />
    </div>

    <TimestampBadge
      label="Booking Logged"
      date={reservation?.scheduleRequestedAt || reservation?.updatedAt}
    />
  </>
);

// ─── Visit Completed Content ─────────────────────────────────
const VisitCompletedReceipt = ({ reservation }) => (
  <>
    <div
      style={{
        textAlign: "center",
        padding: "16px 0",
        borderBottom: "1px solid #E2E8F0",
        marginBottom: "14px",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          backgroundColor: "#ECFDF5",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 8px",
          color: "#059669",
        }}
      >
        <CheckCircle2 size={24} />
      </div>
      <p style={{ color: "#0F172A", fontWeight: "700", fontSize: "15px", margin: "0 0 2px" }}>
        Visit Verification Completed
      </p>
      <p style={{ color: "#64748B", fontSize: "12px", margin: 0 }}>
        {getViewingPreferenceLabel(reservation)} has been confirmed on file.
      </p>
    </div>

    <SectionTitle>Verification Summary</SectionTitle>
    <ReceiptRow
      label="Completion Date"
      value={
        reservation?.visitCompletedAt || reservation?.updatedAt
          ? new Date(reservation?.visitCompletedAt || reservation?.updatedAt).toLocaleDateString("en-PH", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : "Recorded on file"
      }
    />
    <ReceiptRow label="Verification Status" value="Approved by Administration" valueColor="#059669" />
  </>
);

// ─── Application Submitted Content ───────────────────────────
const ApplicationReceipt = ({ reservation }) => (
  <>
    <div style={{ marginBottom: "14px" }}>
      <SectionTitle>Applicant Profile</SectionTitle>
      <ReceiptRow
        label="Full Legal Name"
        value={`${reservation?.firstName || ""} ${reservation?.middleName ? `${reservation.middleName} ` : ""}${reservation?.lastName || ""}`.trim() || "Applicant"}
      />
      <ReceiptRow
        label="Date of Birth"
        value={
          reservation?.dateOfBirth
            ? new Date(reservation.dateOfBirth).toLocaleDateString("en-PH", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "—"
        }
      />
      <ReceiptRow label="Gender" value={reservation?.gender || "—"} capitalize />
      <ReceiptRow label="Contact Phone" value={reservation?.mobileNumber || "—"} />
      <ReceiptRow label="Account Email" value={reservation?.userId?.email || reservation?.email || "—"} />
    </div>

    <div style={{ marginBottom: "14px" }}>
      <SectionTitle>Emergency Information</SectionTitle>
      <ReceiptRow label="Emergency Contact" value={reservation?.emergencyContactName || "—"} />
      <ReceiptRow label="Relationship" value={reservation?.emergencyContactRelation || "—"} capitalize />
      <ReceiptRow label="Emergency Number" value={reservation?.emergencyContactNumber || "—"} />
    </div>

    <TimestampBadge
      label="Application Submitted"
      date={reservation?.applicationSubmittedAt || reservation?.updatedAt}
    />
  </>
);

// ─── Payment Submitted Content ───────────────────────────────
const PaymentReceiptContent = ({ reservation }) => {
  const feeAmount = Number(reservation?.amountPaid || reservation?.reservationFeeAmount || 2000);
  const paymentMethod = formatPaymentMethod(reservation?.paymentMethod);
  const refId = reservation?.paymongoPaymentId || reservation?.reservationCode || reservation?._id?.slice(-8)?.toUpperCase() || "—";
  const isPaid = reservation?.status === "reserved" || reservation?.status === "active";

  return (
    <>
      {/* Official Amount Box */}
      <div
        style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: "8px",
          padding: "14px",
          marginBottom: "14px",
          textAlign: "center",
        }}
      >
        <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#64748B", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.5px" }}>
          Reservation Deposit Amount
        </p>
        <p style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>
          PHP {fmtAmt(feeAmount)}
        </p>
      </div>

      <div style={{ marginBottom: "14px" }}>
        <SectionTitle>Payment Transaction Details</SectionTitle>
        <ReceiptRow label="Payment Channel" value={paymentMethod} />
        <ReceiptRow label="Transaction Reference" value={refId} />
        <ReceiptRow
          label="Verification Status"
          value={isPaid ? "Paid & Verified" : "Confirmed / Cleared"}
          valueColor={isPaid ? "#059669" : "#D97706"}
        />
        <ReceiptRow label="Electronic Verification" value="Electronic Seal Verified" valueColor="#059669" />
      </div>

      <TimestampBadge
        label="Payment Recorded"
        date={reservation?.paymentSubmittedAt || reservation?.paymentDate || reservation?.updatedAt}
      />
    </>
  );
};

// ─── Confirmed Content ───────────────────────────────────────
const ConfirmedReceipt = ({ reservation }) => {
  const room = reservation?.roomId || {};
  const monthlyRate = getEffectiveMonthlyRate(reservation);

  return (
    <>
      <div
        style={{
          textAlign: "center",
          padding: "14px 0",
          borderBottom: "1px solid #E2E8F0",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            width: "44px",
            height: "44px",
            backgroundColor: "#ECFDF5",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 8px",
            color: "#059669",
          }}
        >
          <CheckCircle2 size={24} />
        </div>
        <p style={{ color: "#0F172A", fontWeight: "700", fontSize: "15px", margin: "0 0 2px" }}>
          Reservation Confirmed & Allocated
        </p>
        <p style={{ color: "#64748B", fontSize: "12px", margin: 0 }}>
          Your bed space reservation is securely recorded.
        </p>
      </div>

      <SectionTitle>Allocation Summary</SectionTitle>
      <ReceiptRow
        label="Allocated Room"
        value={room.name || room.roomNumber ? `Room ${room.name || room.roomNumber}` : "Allocated Room"}
      />
      <ReceiptRow label="Branch" value={`${room.branch || "Lilycrest"} Branch`} capitalize />
      <ReceiptRow
        label="Monthly Base Rent"
        value={`PHP ${fmtAmt(monthlyRate)}`}
        valueColor="#0F172A"
        valueWeight="700"
      />
      <ReceiptRow
        label="Move-In Target"
        value={
          reservation?.finalMoveInDate
            ? new Date(reservation.finalMoveInDate).toLocaleDateString("en-PH")
            : "Scheduled on Check-In"
        }
      />

      <TimestampBadge
        label="Confirmed On"
        date={reservation?.confirmedAt || reservation?.updatedAt}
      />
    </>
  );
};

// ─── Step Content Map ────────────────────────────────────────
const STEP_CONTENT = {
  room_selected: RoomReceipt,
  visit_scheduled: VisitReceipt,
  visit_completed: VisitCompletedReceipt,
  application_submitted: ApplicationReceipt,
  payment_submitted: PaymentReceiptContent,
  reserved: ConfirmedReceipt,
};

// ─── Main Modal Component ────────────────────────────────────
const ReceiptModal = ({ isOpen, step, reservation, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  useEscapeClose(isOpen && !!step, onClose);
  if (!isOpen || !step) return null;

  const StepContent = STEP_CONTENT[step.step];
  const refCode = reservation?.reservationCode || reservation?._id?.slice(-8)?.toUpperCase() || "—";
  const branch = reservation?.roomId?.branch || "Lilycrest";

  const handleDownloadPDF = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await generateDepositReceipt(reservation, reservation?.userId);
    } catch (err) {
      console.error("Download receipt error:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "12px",
          padding: "20px 24px",
          maxWidth: "460px",
          width: "100%",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
          border: "1px solid #E2E8F0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Official Receipt Header Banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "2px solid #0F172A",
            paddingBottom: "12px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "#0F172A",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "14px",
              }}
            >
              <Building2 size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0F172A", letterSpacing: "0.2px" }}>
                LILYCREST DORMITORY
              </h3>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748B" }}>
                {branch.toUpperCase()} BRANCH · OFFICIAL RECORD
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Document Tracking Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "6px",
            padding: "8px 12px",
            marginBottom: "16px",
            fontSize: "11.5px",
          }}
        >
          <div>
            <span style={{ color: "#64748B", fontWeight: "500" }}>DOCUMENT NO: </span>
            <strong style={{ color: "#0F172A" }}>OR-RES-{refCode}</strong>
          </div>
          <div
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "10.5px",
              fontWeight: "700",
              background: "#ECFDF5",
              color: "#15803D",
              border: "1px solid #BBF7D0",
            }}
          >
            OFFICIAL RECORD
          </div>
        </div>

        {/* Step-Specific Receipt Content */}
        <div style={{ marginBottom: "16px" }}>
          {StepContent && <StepContent reservation={reservation} />}
        </div>

        {/* Official Document Actions */}
        <div
          style={{
            borderTop: "1px solid #E2E8F0",
            paddingTop: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              backgroundColor: "#0F172A",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: downloading ? "not-allowed" : "pointer",
            }}
          >
            <Download size={13} />
            {downloading ? "Generating PDF..." : "Download Official PDF"}
          </button>

          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "#F1F5F9",
              color: "#475569",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
