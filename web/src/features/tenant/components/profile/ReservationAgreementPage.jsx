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
} from "lucide-react";
import dayjs from "dayjs";
import { generateDepositReceipt } from "../../../../shared/utils/receiptGenerator";
import { useCurrentUser } from "../../../../shared/hooks/queries/useUsers";

/* ── Amenity icon mapper ──────────────────────────── */
const AMENITY_ICONS = {
  wifi: Wifi,
  "air conditioning": Wind,
  ac: Wind,
  "study desk": BookOpen,
  desk: BookOpen,
  security: ShieldCheck,
  cctv: Video,
  "hot shower": Droplets,
  shower: Droplets,
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

/* ── Info Block ────────────────────────────────────── */
const InfoBlock = ({ label, value, highlight = false }) => (
  <div style={{ borderTop: "2.5px solid #E8734A", paddingTop: 10 }}>
    <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
    <p style={{ fontSize: 14, fontWeight: highlight ? 700 : 600, color: highlight ? "#E8734A" : "#0A1628", margin: 0 }}>{value}</p>
  </div>
);

/* ── Main Component ────────────────────────────────── */
const ReservationAgreementPage = ({ reservation, onBack }) => {
  const navigate = useNavigate();
  const { data: profile } = useCurrentUser();
  const [selectedImage, setSelectedImage] = useState(0);

  if (!reservation) return null;

  const room = reservation.roomId || {};
  const images = room.images || [];
  const amenities = room.amenities || [];
  const heroImage = images[selectedImage] || images[0] || null;
  const code = reservation.reservationCode || "—";
  const bookedOn = dayjs(reservation.createdAt).format("MMMM D, YYYY");
  const moveInDate = reservation.targetMoveInDate ? dayjs(reservation.targetMoveInDate).format("MMMM D, YYYY") : "TBD";
  const tenantName = `${reservation.firstName || profile?.firstName || ""} ${reservation.lastName || profile?.lastName || ""}`.trim() || "Tenant";
  const monthlyRent = reservation.monthlyRent || reservation.totalPrice || room.price || 0;
  const paymentDate = reservation.paymentDate ? dayjs(reservation.paymentDate).format("MMMM D, YYYY") : null;
  const paymentRef = reservation.paymongoPaymentId || reservation.paymentReference || "—";
  const paymentMethod = reservation.paymentMethod === "paymongo" ? "PayMongo Online" : reservation.paymentMethod || "Online";
  const branchDisplay = room.branch === "gil-puyat" ? "Gil Puyat" : room.branch === "guadalupe" ? "Guadalupe" : room.branch || "—";
  const roomType = room.type === "private" ? "Private" : room.type === "double-sharing" ? "Double Sharing" : room.type === "quadruple-sharing" ? "Quadruple Sharing" : room.type || "—";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      {/* ── Back Button ─────────────────────────────── */}
      {onBack && (
        <button
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748B", fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 16, padding: 0 }}
        >
          <ChevronLeft size={16} /> Back to Dashboard
        </button>
      )}

      {/* ── Hero Image ──────────────────────────────── */}
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", marginBottom: 20, background: "#1E293B" }}>
        {heroImage ? (
          <img
            src={heroImage}
            alt={room.name || "Room"}
            style={{ width: "100%", height: 340, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", fontSize: 16 }}>
            <Building size={48} style={{ opacity: 0.3 }} />
          </div>
        )}
        {/* Gradient overlay */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 120, background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }} />
        {/* Code + badge overlay */}
        <div style={{ position: "absolute", bottom: 20, left: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>{code}</span>
          <span style={{ background: "#059669", color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>Reserved</span>
        </div>
      </div>

      {/* ── Two Column Layout ──────────────────────── */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* LEFT: Room Details ────────────────────────── */}
        <div style={{ flex: "1 1 520px", minWidth: 300 }}>
          {/* Room Info Card */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8EBF0", padding: "24px", marginBottom: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0A1628", margin: "0 0 12px" }}>{room.name || "Room"}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {[branchDisplay, `${room.floor || 1}${room.floor === 1 ? "st" : room.floor === 2 ? "nd" : room.floor === 3 ? "rd" : "th"} Floor`, roomType, `${room.capacity || "—"} beds`].map((tag) => (
                <span key={tag} style={{ background: "#F1F5F9", color: "#475569", fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 6 }}>{tag}</span>
              ))}
            </div>

            {/* Thumbnail Gallery */}
            {images.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(images.length, 4)}, 1fr)`, gap: 8+0 }}>
                {images.slice(0, 4).map((img, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    style={{
                      borderRadius: 8,
                      overflow: "hidden",
                      cursor: "pointer",
                      border: selectedImage === i ? "2px solid #E8734A" : "2px solid transparent",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <img src={img} alt={`Room view ${i + 1}`} style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Amenities Card */}
          {amenities.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8EBF0", padding: "24px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0A1628", margin: "0 0 16px" }}>Amenities</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 16 }}>
                {amenities.map((amenity) => {
                  const Icon = getAmenityIcon(amenity);
                  return (
                    <div key={amenity} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={18} color="#475569" />
                      </div>
                      <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500, textAlign: "center" }}>{amenity}</span>
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
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8EBF0", padding: "24px", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0A1628", margin: "0 0 20px" }}>Reservation Summary</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
              <InfoBlock label="Tenant" value={tenantName} />
              <InfoBlock label="Booked On" value={bookedOn} />
              <InfoBlock label="Move-in Date" value={moveInDate} />
              <InfoBlock label="Lease Duration" value={`${reservation.leaseDuration || 12} months`} />
              <InfoBlock label="Monthly Rent" value={`₱${monthlyRent.toLocaleString()}`} highlight />
              <InfoBlock label="Bed Position" value={reservation.selectedBed?.position || "TBD"} />
            </div>
          </div>

          {/* Payment Receipt */}
          <div style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E8EBF0", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <FileText size={16} color="#475569" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0A1628", margin: 0 }}>Payment Receipt</h3>
            </div>

            {paymentDate ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Reference ID", value: paymentRef.slice(0, 16) },
                    { label: "Amount", value: "₱2,000" },
                    { label: "Date Paid", value: paymentDate },
                    { label: "Method", value: paymentMethod },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#94A3B8", fontWeight: 500 }}>{label}</span>
                      <span style={{ color: "#0A1628", fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button
                    onClick={() => generateDepositReceipt(reservation, profile)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "9px 16px",
                      background: "#E8734A",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Download size={14} /> Download PDF
                  </button>
                  <button
                    onClick={() => generateDepositReceipt(reservation, profile)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "9px 16px",
                      background: "transparent",
                      color: "#0A1628",
                      border: "1.5px solid #0A1628",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Eye size={14} /> View Receipt
                  </button>
                </div>
              </>
            ) : (
              <p style={{ color: "#94A3B8", fontSize: 13 }}>Payment information will appear here once your deposit is processed.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationAgreementPage;
