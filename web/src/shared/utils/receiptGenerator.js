import jsPDF from "jspdf";

/**
 * Generate a downloadable PDF receipt matching the Lilycrest email template.
 *
 * Layout mirrors the email: dark navy header → "Order details" section →
 * amount, description, payment method + date, reference ID → navy footer.
 *
 * @param {Object} reservation - The reservation object with payment details
 * @param {Object} profile - The user profile (name, email)
 */
export function generateDepositReceipt(reservation, profile) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 25;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ── Colors (matching email template) ──
  const navy = [24, 49, 83]; // #0A1628
  const gold = [212, 152, 43]; // #FF8C42
  const darkText = [17, 24, 39]; // #111827
  const bodyText = [55, 65, 81]; // #374151
  const mutedText = [156, 163, 175]; // #9CA3AF
  const lightLine = [229, 231, 235]; // #E5E7EB
  const white = [255, 255, 255];

  // ── Helper: draw filled rectangle ──
  const fillRect = (x, yPos, w, h, color) => {
    doc.setFillColor(...color);
    doc.rect(x, yPos, w, h, "F");
  };

  // ── Helper: draw horizontal line ──
  const drawLine = (yPos) => {
    doc.setDrawColor(...lightLine);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  // ── Helper: format date ──
  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const room = reservation.roomId || {};
  const fullName = profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
    : "—";

  // ==========================================================================
  // HEADER — Dark navy block (matches email #0A1628)
  // ==========================================================================
  const headerHeight = 38;
  fillRect(0, 0, pageWidth, headerHeight, navy);

  // "Your receipt from" in gold
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...gold);
  doc.text("Your receipt from", margin, 16);

  // "LILYCREST DORMITORY" in white bold
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...white);
  doc.text("LILYCREST DORMITORY", margin, 28);

  y = headerHeight + 16;

  // ==========================================================================
  // GREETING
  // ==========================================================================
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...bodyText);
  doc.text(`Hi ${fullName},`, margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(...mutedText);
  doc.text("Thank you for your payment. Here's a copy of your receipt.", margin, y);
  y += 14;

  // ==========================================================================
  // "ORDER DETAILS" SECTION
  // ==========================================================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text("ORDER DETAILS", margin, y);
  y += 3;
  drawLine(y);
  y += 10;

  // ── Amount paid ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text("AMOUNT PAID", margin, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...darkText);
  doc.text("₱ 2,000.00", margin, y);
  y += 12;

  // ── Description ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text("DESCRIPTION", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...bodyText);
  const roomName = room.name || "Room";
  const branch = room.branch === "gil-puyat" ? "Gil Puyat" : room.branch === "guadalupe" ? "Guadalupe" : room.branch || "Lilycrest";
  doc.text(`Security Deposit — ${roomName} (${branch})`, margin, y);
  y += 10;

  drawLine(y);
  y += 8;

  // ── Payment method + Date paid (side by side) ──
  const halfWidth = contentWidth / 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text("PAYMENT METHOD", margin, y);
  doc.text("DATE PAID", margin + halfWidth, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...bodyText);
  const paymentMethod = reservation.paymentMethod === "paymongo" ? "Online (PayMongo)" : reservation.paymentMethod || "Online";
  doc.text(paymentMethod, margin, y);
  doc.text(formatDate(reservation.paymentDate), margin + halfWidth, y);
  y += 10;

  drawLine(y);
  y += 8;

  // ── Reference ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text("REFERENCE", margin, y);
  y += 6;

  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...bodyText);
  const refId = reservation.paymongoPaymentId || reservation.reservationCode || reservation._id?.slice(-8)?.toUpperCase() || "—";
  doc.text(refId, margin, y);
  y += 12;

  drawLine(y);
  y += 10;

  // ==========================================================================
  // RESERVATION INFO
  // ==========================================================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text("RESERVATION DETAILS", margin, y);
  y += 3;
  drawLine(y);
  y += 8;

  const addDetailRow = (label, value) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...mutedText);
    doc.text(label, margin, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...bodyText);
    doc.text(String(value || "—"), margin + halfWidth, y);
    y += 8;
  };

  addDetailRow("TENANT", fullName);
  addDetailRow("EMAIL", profile?.email || "—");
  addDetailRow("ROOM", roomName);
  addDetailRow("BRANCH", branch);
  addDetailRow("LEASE", `${reservation.leaseDuration || 12} months`);
  addDetailRow("MOVE-IN", formatDate(reservation.targetMoveInDate || reservation.finalMoveInDate));
  if (reservation.selectedBed?.position) {
    addDetailRow("BED", `${reservation.selectedBed.position}`);
  }

  y += 6;

  // ==========================================================================
  // FOOTER — Dark navy block (matches email footer)
  // ==========================================================================
  const footerY = y + 4;
  const footerHeight = 30;
  fillRect(0, footerY, pageWidth, footerHeight, navy);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255, 180);
  doc.text(
    "You're receiving this because you made a payment at Lilycrest Dormitory.",
    pageWidth / 2,
    footerY + 10,
    { align: "center" },
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...gold);
  doc.text("🏠 Lilycrest Dormitory", pageWidth / 2, footerY + 18, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255, 130);
  doc.text(
    `Generated on ${new Date().toLocaleString("en-PH")}`,
    pageWidth / 2,
    footerY + 24,
    { align: "center" },
  );

  // ── Save ──
  const filename = `Lilycrest_Receipt_${reservation.reservationCode || "deposit"}.pdf`;
  doc.save(filename);
}
