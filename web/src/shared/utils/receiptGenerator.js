import jsPDF from "jspdf";

/**
 * Generate a downloadable PDF receipt for a reservation deposit payment.
 *
 * @param {Object} reservation - The reservation object with payment details
 * @param {Object} profile - The user profile (name, email)
 */
export function generateDepositReceipt(reservation, profile) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 25;

  // ── Colors ──
  const navy = [26, 54, 93];       // #1A365D
  const orange = [212, 152, 43];    // #D4982B
  const gray = [100, 116, 139];     // #64748B
  const darkGray = [15, 23, 42];    // #0F172A
  const lightGray = [226, 232, 240]; // #E2E8F0

  // ── Helper: draw horizontal line ──
  const drawLine = (yPos, color = lightGray) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  // ── Header ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...navy);
  doc.text("Lilycrest Dormitory", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.text("Payment Receipt", pageWidth - margin, y, { align: "right" });

  y += 8;
  drawLine(y);
  y += 10;

  // ── Receipt Badge ──
  doc.setFillColor(236, 253, 245); // #ECFDF5
  doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105); // #059669
  doc.text("✓ PAYMENT CONFIRMED", pageWidth / 2, y + 4, { align: "center" });

  y += 18;

  // ── Receipt Details Grid ──
  const labelX = margin;
  const valueX = margin + 45;
  const lineHeight = 8;

  const addRow = (label, value) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...gray);
    doc.text(label, labelX, y);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkGray);
    doc.text(String(value || "—"), valueX, y);
    y += lineHeight;
  };

  const room = reservation.roomId || {};
  const roomName = room.name || "Room";
  const branch = room.branch || "Lilycrest";

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text("Payment Details", margin, y);
  y += lineHeight;

  addRow("Receipt No:", reservation.reservationCode || reservation._id?.slice(-8)?.toUpperCase() || "—");
  addRow("Date Paid:", formatDate(reservation.paymentDate));
  addRow("Payment Method:", reservation.paymentMethod === "paymongo" ? "Online (PayMongo)" : reservation.paymentMethod || "Online");
  addRow("Amount:", "PHP 2,000.00");

  y += 4;
  drawLine(y);
  y += 8;

  // ── Tenant Info ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text("Tenant Information", margin, y);
  y += lineHeight;

  const fullName = profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
    : "—";

  addRow("Name:", fullName || "—");
  addRow("Email:", profile?.email || "—");

  y += 4;
  drawLine(y);
  y += 8;

  // ── Reservation Info ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text("Reservation Details", margin, y);
  y += lineHeight;

  addRow("Room:", roomName);
  addRow("Branch:", branch);
  addRow("Lease Duration:", `${reservation.leaseDuration || 12} months`);
  addRow("Move-In Date:", formatDate(reservation.targetMoveInDate || reservation.finalMoveInDate));
  if (reservation.selectedBed) {
    addRow("Bed:", `${reservation.selectedBed.position} (${reservation.selectedBed.id})`);
  }

  y += 4;
  drawLine(y);
  y += 12;

  // ── Total Box ──
  doc.setFillColor(255, 251, 235); // #FFFBEB
  doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 16, 3, 3, "F");
  doc.setDrawColor(...orange);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 16, 3, 3, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...navy);
  doc.text("Total Paid:", margin + 8, y + 4);
  doc.setTextColor(...orange);
  doc.text("PHP 2,000.00", pageWidth - margin - 8, y + 4, { align: "right" });

  y += 24;

  // ── Footer ──
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(
    "This is a system-generated receipt. No signature required.",
    pageWidth / 2,
    y,
    { align: "center" },
  );
  y += 5;
  doc.text(
    `Generated on ${new Date().toLocaleString("en-PH")}`,
    pageWidth / 2,
    y,
    { align: "center" },
  );

  // ── Save ──
  const filename = `Lilycrest_Receipt_${reservation.reservationCode || "deposit"}.pdf`;
  doc.save(filename);
}
