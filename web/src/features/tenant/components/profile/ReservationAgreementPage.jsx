import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
 MapPin,
 Bed,
 Building,
 Layers,
 Download,
 Eye,
 FileText,
 Wifi,
 Wind,
 BookOpen,
 ShieldCheck,
 Droplets,
 Video,
 Lamp,
 CookingPot,
 WashingMachine,
 ChevronLeft,
 Users,
 DoorOpen,
 AlertCircle,
} from "lucide-react";
import dayjs from "dayjs";
import { useQueryClient } from "@tanstack/react-query";
import { generateDepositReceipt, viewDepositReceipt } from "../../../../shared/utils/receiptGenerator";
import { getBedDisplayLabel } from "../../../../shared/utils/bedIdentifier";
import { useCurrentUser } from "../../../../shared/hooks/queries/useUsers";
import { reservationApi } from "../../../../shared/api/reservationApi";
import { showNotification } from "../../../../shared/utils/notification";
import {
 canReservationAccessPayment,
 hasReservationStatus,
 readMoveInDate,
} from "../../../../shared/utils/lifecycleNaming";
import {
 RESERVATION_FEE_NON_REFUNDABLE_NOTICE,
 getReservationCancellationUiState,
} from "./reservationCancellationUi";

/* ── Ordinal suffix helper ────────────────────────── */
function ordinal(n) {
 const s = ["th", "st", "nd", "rd"];
 const v = n % 100;
 return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ── Amenity icon mapper ──────────────────────────── */
const AMENITY_ICONS = {
 wifi: Wifi,
 "air conditioning": Wind,
 ac: Wind,
 aircon: Wind,
 "study desk": BookOpen,
 desk: BookOpen,
 security: ShieldCheck,
 cctv: Video,
 "hot shower": Droplets,
 shower: Droplets,
 water: Droplets,
 lamp: Lamp,
 kitchen: CookingPot,
 laundry: WashingMachine,
};

function getAmenityIcon(amenity) {
 const key = amenity.toLowerCase().trim();
 for (const [match, Icon] of Object.entries(AMENITY_ICONS)) {
 if (key.includes(match)) return Icon;
 }
 return ShieldCheck;
}

function getEffectiveMonthlyRent(reservation) {
  if (!reservation) return 0;
  const room = reservation.roomId || {};
  const leaseDuration = Number(reservation.leaseDuration || 12);
  const normType = String(room.type || "").toLowerCase();

  let baseLongRate = room.regularLongRate ?? 6000;
  let discountPercent = room.quadrupleDiscountPercent ?? 10;

  if (normType.includes("double")) {
    baseLongRate = room.regularLongRate ?? 9000;
    discountPercent = room.doubleDiscountPercent ?? 20;
  } else if (normType.includes("private")) {
    baseLongRate = room.regularLongRate ?? 15000;
    discountPercent = room.privateDiscountPercent ?? 10;
  }

  const isLongTerm = leaseDuration >= 6;
  const computedRent = isLongTerm
    ? Math.round(baseLongRate * (1 - discountPercent / 100))
    : (room.regularShortRate ?? 7000);

  const rawRent = reservation.monthlyRent;
  if (!rawRent || rawRent === 5670 || (isLongTerm && rawRent > baseLongRate)) {
    return computedRent;
  }

  return rawRent;
}

/* ── Main Component ────────────────────────────────── */
const ReservationAgreementPage = ({ reservation, onBack, onReservationUpdated }) => {
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 const { data: profile } = useCurrentUser();
 const [selectedImage, setSelectedImage] = useState(0);
 const [showCancellationModal, setShowCancellationModal] = useState(false);
 const [isRequestingCancellation, setIsRequestingCancellation] = useState(false);
 const [cancellationReason, setCancellationReason] = useState("");
 const [acknowledgedCancellationPolicy, setAcknowledgedCancellationPolicy] = useState(false);

 if (!reservation) {
 return (
 <div style={{ width: "100%" }}>
 <div style={{ marginBottom: 24 }}>
 <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0A1628", margin: "0 0 4px" }}>My Reservation</h1>
 <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>Your active reservation details</p>
 </div>
 <div style={{
 display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
 textAlign: "center", padding: "56px 24px",
 background: "#fff", borderRadius: 10, border: "1px solid #E8EBF0",
 }}>
 <Building size={48} color="#D1D5DB" />
 <h3 style={{ fontSize: 16, fontWeight: 600, color: "#374151", margin: "16px 0 8px" }}>
 No Reservation Yet
 </h3>
 <p style={{ fontSize: 13, color: "#9CA3AF", maxWidth: 300, margin: "0 0 24px", lineHeight: 1.6 }}>
 You don't have an active reservation. Browse available rooms and start your application.
 </p>
 <button
 onClick={() => navigate("/applicant/check-availability")}
 style={{
 padding: "12px 28px", background: "#E8734A", color: "#fff",
 border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
 cursor: "pointer", transition: "all 0.15s",
 }}
 onMouseEnter={(e) => { e.currentTarget.style.background = "#D4622F"; e.currentTarget.style.transform = "translateY(-1px)"; }}
 onMouseLeave={(e) => { e.currentTarget.style.background = "#E8734A"; e.currentTarget.style.transform = "translateY(0)"; }}
 >
 Browse Available Rooms
 </button>
 </div>
 </div>
 );
 }

 const room = reservation.roomId || {};
 const images = room.images || [];
 const amenities = room.amenities || [];
 const heroImage = images[selectedImage] || images[0] || null;
 const code = reservation.reservationCode || "—";
 const bookedOn = dayjs(reservation.createdAt).format("MMMM D, YYYY [at] h:mm A");
 const moveInDate = readMoveInDate(reservation) || reservation.targetMoveInDate;
 const moveInDateLabel = moveInDate
 ? dayjs(moveInDate).format("MMMM D, YYYY")
 : "TBD";
 const reservationStatus = reservation.reservationStatus || reservation.status || "pending";
 const isFullTenantReservation = hasReservationStatus(reservationStatus, "moveIn", "moveOut");
 const isReservedApplicant =
 hasReservationStatus(reservationStatus, "reserved") && !isFullTenantReservation;
 const personLabel = isFullTenantReservation ? "Tenant" : "Applicant";
 const resFirstName = reservation.firstName || profile?.firstName || "";
 const resLastName = reservation.lastName || profile?.lastName || "";
 const personName =
 `${resFirstName} ${resLastName}`.trim() ||
 personLabel;
 const reservationFeeLabel = isFullTenantReservation ? "Deposit" : "Reservation Fee";
 const paymentDescriptor = isFullTenantReservation ? "deposit" : "reservation fee";
 const statusDisplay = (() => {
 const s = reservationStatus;
 if (s === "cancelled") return { label: "Cancelled", bg: "#EF4444" };
 if (hasReservationStatus(s, "moveOut")) return { label: "Completed", bg: "#6B7280" };
 if (hasReservationStatus(s, "moveIn")) return { label: "Moved In", bg: "#6366F1" };
 if (s === "reserved" || reservation.paymentStatus === "paid")
 return { label: "Reserved", bg: "#059669" };
 if (s === "pending_application_review")
 return { label: "Pending Review", bg: "#D97706" };
 if (s === "needs_revision")
 return { label: "Needs Revision", bg: "#EA580C" };
 if (s === "approved_for_payment" || canReservationAccessPayment(s))
 return { label: "Approved for Payment", bg: "#0F766E" };
 if (s === "payment_pending")
 return { label: "Payment Pending", bg: "#D97706" };
 if (s === "viewing_preference_selected")
 return { label: "Viewing Preference Selected", bg: "#2563EB" };
 if (s === "visit_approved" || reservation.scheduleApproved || reservation.visitApproved)
 return { label: "Visit Approved", bg: "#7C3AED" };
 if (s === "visit_pending" || (reservation.visitDate && !reservation.scheduleRejected))
 return { label: "Visit Scheduled", bg: "#2563EB" };
 if (reservation.scheduleRejected)
 return { label: "Reschedule Needed", bg: "#DC2626" };
 return { label: "Room Selected", bg: "#0EA5E9" };
 })();

 const monthlyRent = getEffectiveMonthlyRent(reservation);
 const reservationFeeAmount = reservation.reservationFeeAmount || 2000;
 const paymentDate = reservation.paymentDate
 ? dayjs(reservation.paymentDate).format("MMMM D, YYYY [at] h:mm A")
 : null;
 const cancellationUi = getReservationCancellationUiState(reservation);
 const branchDisplay =
 room.branch === "gil-puyat" ? "Gil Puyat" : room.branch === "guadalupe" ? "Guadalupe" : room.branch || "—";
 const roomType =
 room.type === "private"
 ? "Private"
 : room.type === "double-sharing"
 ? "Double Sharing"
 : room.type === "quadruple-sharing"
 ? "Quadruple Sharing"
 : room.type || "—";

 /* ── Styles ──────────────────────────────────────── */
 const card = {
 background: "var(--surface-card, #fff)",
 borderRadius: 12,
 border: "1px solid var(--border-card, #E8EBF0)",
 padding: 24,
 marginBottom: 16,
 };
 const sectionTitle = {
 fontSize: 15,
 fontWeight: 700,
 color: "var(--text-heading, #0A1628)",
 margin: "0 0 16px",
 };
 const detailRow = {
 display: "flex",
 justifyContent: "space-between",
 alignItems: "center",
 padding: "10px 0",
 borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
 fontSize: 13,
 };

 const resetCancellationModal = () => {
 setShowCancellationModal(false);
 setCancellationReason("");
 setAcknowledgedCancellationPolicy(false);
 };

 const handleRequestCancellation = async () => {
 if (!reservation?._id || isRequestingCancellation) return;
 if (!acknowledgedCancellationPolicy) {
 showNotification("Please acknowledge that the reservation fee is non-refundable.", "warning", 4000);
 return;
 }

 setIsRequestingCancellation(true);
 try {
 await reservationApi.requestCancellation(reservation._id, cancellationReason.trim());
 resetCancellationModal();
 showNotification(
 "Cancellation request submitted. Your reservation fee is non-refundable and the request is pending admin review.",
 "success",
 5000,
 );
 await Promise.all([
 queryClient.invalidateQueries({ queryKey: ["reservations"] }),
 queryClient.invalidateQueries({ queryKey: ["users", "currentUser"] }),
 ]);
 await onReservationUpdated?.();
 } catch (error) {
 const errorCode = error?.response?.data?.code;
 if (errorCode === "CANCELLATION_REQUEST_ALREADY_PENDING") {
 resetCancellationModal();
 showNotification("Cancellation request is already pending admin review.", "info", 5000);
 await queryClient.invalidateQueries({ queryKey: ["reservations"] });
 await onReservationUpdated?.();
 return;
 }

 console.error("Cancellation request failed:", error);
 showNotification(
 error?.message || "Failed to submit cancellation request. Please try again.",
 "error",
 5000,
 );
 } finally {
 setIsRequestingCancellation(false);
 }
 };

 return (
 <div style={{ width: "100%" }}>

 {/* ── Hero Image ──────────────────────────────── */}
 <div
 style={{
 position: "relative",
 borderRadius: 14,
 overflow: "hidden",
 marginBottom: 20,
 background: "#1E293B",
 }}
 >
 {heroImage ? (
 <img
 src={heroImage}
 alt={room.name || "Room"}
 style={{ width: "100%", height: 480, objectFit: "cover", display: "block" }}
 onError={(e) => {
 // Replace with the no-photo fallback if URL is invalid
 e.currentTarget.style.display = "none";
 const parent = e.currentTarget.parentElement;
 const fallback = parent.querySelector("[data-photo-fallback]");
 if (fallback) fallback.style.display = "flex";
 }}
 />
 ) : (
 <div
 data-photo-fallback
 style={{
 width: "100%",
 height: 240,
 display: "flex",
 flexDirection: "column",
 alignItems: "center",
 justifyContent: "center",
 color: "#475569",
 gap: 8,
 background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
 }}
 >
 <Building size={32} style={{ opacity: 0.3, color: "#94A3B8" }} />
 <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>
 Room photos not yet available
 </span>
 </div>
 )}
 {/* Gradient overlay */}
 <div
 style={{
 position: "absolute",
 bottom: 0,
 left: 0,
 right: 0,
 height: 100,
 background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
 }}
 />
 {/* Code + badge */}
 <div
 style={{
 position: "absolute",
 bottom: 20,
 left: 24,
 display: "flex",
 alignItems: "center",
 gap: 12,
 }}
 >
 <span
 style={{
 fontFamily: "monospace",
 fontSize: 18,
 fontWeight: 700,
 color: "#fff",
 letterSpacing: "0.02em",
 }}
 >
 {code}
 </span>
 <span
 style={{
 background: statusDisplay.bg,
 color: "#fff",
 fontSize: 12,
 fontWeight: 600,
 padding: "4px 12px",
 borderRadius: 20,
 }}
 >
 {statusDisplay.label}
 </span>
 </div>
 </div>

 {/* ── Two Column Layout ──────────────────────── */}
 {isReservedApplicant && (
 <div
 style={{
 ...card,
 background: "#F0FDF4",
 borderColor: "#BBF7D0",
 display: "flex",
 alignItems: "flex-start",
 gap: 12,
 }}
 >
 <div
 style={{
 width: 40,
 height: 40,
 borderRadius: 999,
 background: "#DCFCE7",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 flexShrink: 0,
 }}
 >
 <ShieldCheck size={20} color="#047857" />
 </div>
 <div>
 <h2 style={{ fontSize: 18, fontWeight: 700, color: "#065F46", margin: "0 0 6px" }}>
 Room Reserved
 </h2>
 <p style={{ color: "#166534", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
 Your room reservation has been confirmed. Please wait for further instructions from the admin.
 </p>
 <p style={{ color: "#047857", fontSize: 12, lineHeight: 1.6, margin: "8px 0 0" }}>
 You remain an applicant until admin completes the tenant conversion.
 </p>
 </div>
 </div>
 )}

 <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
 {/* LEFT: Room Details ────────────────────────── */}
 <div style={{ flex: "1 1 520px", minWidth: 300 }}>
 {/* Room Info Card */}
 <div style={card}>
 <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-heading, #0A1628)", margin: "0 0 12px" }}>
 {room.name || "Room"}
 </h2>

 {/* Tags */}
 <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
 {[
 branchDisplay,
 `${ordinal(room.floor || 1)} Floor`,
 roomType,
 (() => {
 const cap = room.capacity || (
 room.type === "private" ? 1
 : room.type === "double-sharing" ? 2
 : room.type === "quadruple-sharing" ? 4
 : null
 );
 return cap ? `${cap} ${cap === 1 ? "person" : "persons"}` : null;
 })(),
 ].filter(Boolean).map((tag) => (
 <span
 key={tag}
 style={{
 background: "#F1F5F9",
 color: "#475569",
 fontSize: 12,
 fontWeight: 500,
 padding: "4px 12px",
 borderRadius: 6,
 }}
 >
 {tag}
 </span>
 ))}
 </div>

 {/* Room Details List */}
 <div style={{ marginBottom: images.length > 1 ? 20 : 0 }}>
 <div style={detailRow}>
 <span style={{ color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
 <MapPin size={14} /> Branch
 </span>
 <span style={{ color: "var(--text-heading, #0A1628)", fontWeight: 600 }}>{branchDisplay}</span>
 </div>
 <div style={detailRow}>
 <span style={{ color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
 <Layers size={14} /> Floor
 </span>
 <span style={{ color: "var(--text-heading, #0A1628)", fontWeight: 600 }}>{ordinal(room.floor || 1)} Floor</span>
 </div>
 <div style={detailRow}>
 <span style={{ color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
 <DoorOpen size={14} /> Room Type
 </span>
 <span style={{ color: "var(--text-heading, #0A1628)", fontWeight: 600 }}>{roomType}</span>
 </div>
 <div style={detailRow}>
 <span style={{ color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
 <Users size={14} /> Capacity
 </span>
 <span style={{ color: "var(--text-heading, #0A1628)", fontWeight: 600 }}>
 {(() => {
 const cap = room.capacity || (
 room.type === "private" ? 1
 : room.type === "double-sharing" ? 2
 : room.type === "quadruple-sharing" ? 4
 : null
 );
 if (!cap) return "N/A";
 return `${cap} ${cap === 1 ? "person" : "persons"}`;
 })()}
 </span>
 </div>
 {room.type !== "private" && (
 <div style={detailRow}>
 <span style={{ color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
 <Bed size={14} /> Assigned Bed
 </span>
 <span style={{ color: "var(--text-heading, #0A1628)", fontWeight: 600 }}>
 {reservation.selectedBed ? getBedDisplayLabel(reservation.selectedBed) : "TBD"}
 </span>
 </div>
 )}
 {room.description && (
 <div style={{ ...detailRow, borderBottom: "none", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
 <span style={{ color: "#64748B", fontSize: 12, fontWeight: 500 }}>Description</span>
 <span style={{ color: "#475569", fontSize: 13, lineHeight: 1.5 }}>{room.description}</span>
 </div>
 )}
 </div>

 {/* Thumbnail Gallery */}
 {images.length > 1 && (
 <div
 style={{
 display: "grid",
 gridTemplateColumns: `repeat(${Math.min(images.length, 4)}, 1fr)`,
 gap: 8,
 }}
 >
 {images.slice(0, 4).map((img, i) => (
 <div
 key={i}
 onClick={() => setSelectedImage(i)}
 style={{
 borderRadius: 8,
 overflow: "hidden",
 cursor: "pointer",
 border:
 selectedImage === i ? "2px solid #E8734A" : "2px solid transparent",
 transition: "border-color 0.15s",
 }}
 >
 <img
 src={img}
 alt={`Room view ${i + 1}`}
 style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }}
 />
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Amenities Card */}
 {amenities.length > 0 && (
 <div style={card}>
 <h3 style={sectionTitle}>Amenities</h3>
 <div
 style={{
 display: "grid",
 gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
 gap: 16,
 }}
 >
 {amenities.map((amenity) => {
 const Icon = getAmenityIcon(amenity);
 return (
 <div
 key={amenity}
 style={{
 display: "flex",
 flexDirection: "column",
 alignItems: "center",
 gap: 6,
 }}
 >
 <div
 style={{
 width: 40,
 height: 40,
 borderRadius: 10,
 background: "#F8FAFC",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 }}
 >
 <Icon size={18} color="#475569" />
 </div>
 <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500, textAlign: "center" }}>
 {amenity}
 </span>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>

 {/* RIGHT: Summary + Receipt ────────────────── */}
 <div style={{ flex: "1 1 320px", minWidth: 280 }}>
 {/* Reservation Summary */}
 <div style={card}>
 <h3 style={sectionTitle}>Reservation Summary</h3>
 {[
 { label: personLabel, value: personName },
 { label: "Booked On", value: bookedOn },
 { label: "Move-in Date", value: moveInDateLabel },
 { label: "Lease Duration", value: `${reservation.leaseDuration || 12} months` },
 {
 label: "Monthly Rent",
 value: `₱${monthlyRent.toLocaleString()}`,
 highlight: true,
 },
 {
 label: reservationFeeLabel,
 value: paymentDate ? `PHP ${reservationFeeAmount.toLocaleString("en-PH")} — Paid ✓` : "Pending",
 paid: !!paymentDate,
 },
 ].map(({ label, value, highlight, paid }) => (
 <div key={label} style={detailRow}>
 <span style={{ color: "#64748B", fontWeight: 500 }}>{label}</span>
 <span
 style={{
 color: highlight ? "#E8734A" : paid ? "#059669" : "#0A1628",
 fontWeight: 600,
 }}
 >
 {value}
 </span>
 </div>
 ))}
 </div>

 {/* Receipt Download Card */}
 <div style={{ ...card, background: "var(--surface-muted, #F8FAFC)" }}>
 <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
 <FileText size={16} color="#475569" />
 <h3 style={{ ...sectionTitle, margin: 0 }}>
 {isFullTenantReservation ? "Payment Receipt" : "Reservation Fee Payment"}
 </h3>
 </div>

 {paymentDate ? (
 <>
 <p style={{ color: "#475569", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
 Your {paymentDescriptor} payment of <strong>{`PHP ${reservationFeeAmount.toLocaleString("en-PH")}`}</strong> was confirmed on{" "}
 <strong>{paymentDate}</strong>.
 </p>
 <div style={{ display: "flex", gap: 10 }}>
 <button
 onClick={() => generateDepositReceipt(reservation, profile)}
 style={{
 flex: 1,
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 gap: 6,
 padding: "10px 16px",
 background: "#E8734A",
 color: "#fff",
 border: "none",
 borderRadius: 8,
 fontSize: 13,
 fontWeight: 600,
 cursor: "pointer",
 transition: "all 0.15s",
 }}
 onMouseEnter={(e) => {
 e.currentTarget.style.background = "#D4622F";
 e.currentTarget.style.transform = "translateY(-1px)";
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.background = "#E8734A";
 e.currentTarget.style.transform = "translateY(0)";
 }}
 >
 <Download size={14} /> Download PDF
 </button>
 <button
 onClick={() => viewDepositReceipt(reservation, profile)}
 style={{
 flex: 1,
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 gap: 6,
 padding: "10px 16px",
 background: "transparent",
 color: "#0A1628",
 border: "1.5px solid #0A1628",
 borderRadius: 8,
 fontSize: 13,
 fontWeight: 600,
 cursor: "pointer",
 transition: "all 0.15s",
 }}
 onMouseEnter={(e) => {
 e.currentTarget.style.background = "#0A1628";
 e.currentTarget.style.color = "#fff";
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.background = "transparent";
 e.currentTarget.style.color = "#0A1628";
 }}
 >
 <Eye size={14} /> View Receipt
 </button>
 </div>
 </>
 ) : (
 <p style={{ color: "#94A3B8", fontSize: 13, lineHeight: 1.6 }}>
 Your receipt will appear here once your deposit is confirmed.
 </p>
 )}
 </div>

 {/* Cancellation Request Card */}
 {cancellationUi.visible && (
 <div style={{ ...card, borderColor: cancellationUi.isPending ? "#F59E0B" : "#FECACA" }}>
 <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
 <AlertCircle size={18} color={cancellationUi.isPending ? "#D97706" : "#DC2626"} style={{ marginTop: 1 }} />
 <div>
 <h3 style={{ ...sectionTitle, margin: 0 }}>
 {cancellationUi.isPending ? "Cancellation Request Pending" : "Request Reservation Cancellation"}
 </h3>
 <p style={{ color: "#64748B", fontSize: 13, lineHeight: 1.6, margin: "8px 0 0" }}>
 {cancellationUi.isPending
 ? "Your cancellation request is waiting for admin review. Your bed remains reserved until admin approves the request."
 : RESERVATION_FEE_NON_REFUNDABLE_NOTICE}
 </p>
 </div>
 </div>

 {cancellationUi.isPending ? (
 <div
 style={{
 borderRadius: 8,
 background: "#FFFBEB",
 color: "#92400E",
 padding: "10px 12px",
 fontSize: 13,
 fontWeight: 600,
 }}
 >
 Pending admin review
 </div>
 ) : (
 <button
 type="button"
 onClick={() => setShowCancellationModal(true)}
 style={{
 width: "100%",
 padding: "11px 16px",
 background: "#DC2626",
 color: "#fff",
 border: "none",
 borderRadius: 8,
 fontSize: 13,
 fontWeight: 700,
 cursor: "pointer",
 }}
 >
 Request Cancellation
 </button>
 )}
 </div>
 )}
 </div>
 </div>
 {showCancellationModal && (
 <div
 onClick={() => {
 if (!isRequestingCancellation) resetCancellationModal();
 }}
 style={{
 position: "fixed",
 inset: 0,
 background: "rgba(15, 23, 42, 0.55)",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 padding: 20,
 zIndex: 1000,
 }}
 >
 <div
 onClick={(event) => event.stopPropagation()}
 style={{
 width: "min(520px, 100%)",
 background: "#fff",
 borderRadius: 14,
 boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
 padding: 24,
 }}
 >
 <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
 <div
 style={{
 width: 42,
 height: 42,
 borderRadius: 12,
 background: "#FEF2F2",
 color: "#DC2626",
 display: "grid",
 placeItems: "center",
 flexShrink: 0,
 }}
 >
 <AlertCircle size={22} />
 </div>
 <div>
 <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "#0A1628" }}>
 Request reservation cancellation?
 </h3>
 <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.6 }}>
 {RESERVATION_FEE_NON_REFUNDABLE_NOTICE} Your bed will only be released if admin approves your request.
 </p>
 </div>
 </div>

 <label style={{ display: "block", marginTop: 16 }}>
 <span style={{ display: "block", color: "#334155", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
 Reason for cancellation (optional)
 </span>
 <textarea
 rows={4}
 value={cancellationReason}
 onChange={(event) => setCancellationReason(event.target.value)}
 disabled={isRequestingCancellation}
 placeholder="Share a short reason for admin review."
 style={{
 width: "100%",
 resize: "vertical",
 border: "1px solid #CBD5E1",
 borderRadius: 10,
 padding: "10px 12px",
 fontSize: 13,
 color: "#0F172A",
 outline: "none",
 boxSizing: "border-box",
 }}
 />
 </label>

 <label
 style={{
 display: "flex",
 gap: 10,
 alignItems: "flex-start",
 marginTop: 14,
 padding: "12px 14px",
 background: "#FFF7ED",
 border: "1px solid #FED7AA",
 borderRadius: 10,
 color: "#7C2D12",
 fontSize: 13,
 lineHeight: 1.5,
 }}
 >
 <input
 type="checkbox"
 checked={acknowledgedCancellationPolicy}
 onChange={(event) => setAcknowledgedCancellationPolicy(event.target.checked)}
 disabled={isRequestingCancellation}
 style={{ marginTop: 3 }}
 />
 <span>
 I understand that the reservation fee is non-refundable even if my cancellation request is approved.
 </span>
 </label>

 <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
 <button
 type="button"
 onClick={resetCancellationModal}
 disabled={isRequestingCancellation}
 style={{
 padding: "10px 16px",
 borderRadius: 8,
 border: "1px solid #CBD5E1",
 background: "#fff",
 color: "#334155",
 fontSize: 13,
 fontWeight: 700,
 cursor: isRequestingCancellation ? "default" : "pointer",
 }}
 >
 Keep Reservation
 </button>
 <button
 type="button"
 onClick={handleRequestCancellation}
 disabled={isRequestingCancellation || !acknowledgedCancellationPolicy}
 style={{
 padding: "10px 16px",
 borderRadius: 8,
 border: "none",
 background: "#DC2626",
 color: "#fff",
 fontSize: 13,
 fontWeight: 700,
 cursor: isRequestingCancellation || !acknowledgedCancellationPolicy ? "default" : "pointer",
 opacity: isRequestingCancellation || !acknowledgedCancellationPolicy ? 0.6 : 1,
 }}
 >
 {isRequestingCancellation ? "Submitting..." : "Submit Request"}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default ReservationAgreementPage;
