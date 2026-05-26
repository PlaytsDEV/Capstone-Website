import jsPDF from "jspdf";
import defaultLogo from "../../assets/images/LOGO.png";

/**
 * Safe number formatter — avoids toLocaleString locale issues in jsPDF context.
 * Returns e.g. "2,000.00"
 */
const fmtAmt = (n) => {
  const fixed = Number(n || 0).toFixed(2);
  const [int, dec] = fixed.split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + dec;
};

const PAGE = {
  margin: 16,
  gap: 5,
  pad: 6,
  radius: 4,
  footerReserve: 18,
};

const COLORS = {
  page: [248, 250, 252],
  card: [255, 255, 255],
  cardAlt: [249, 250, 251],
  border: [226, 232, 240],
  borderSoft: [241, 245, 249],
  text: [15, 23, 42],
  body: [51, 65, 85],
  muted: [100, 116, 139],
  subMuted: [148, 163, 184],
  accent: [212, 152, 43],
  accentSoft: [255, 251, 240],
  accentBorder: [245, 208, 116],
  success: [22, 163, 74],
  successSoft: [236, 253, 245],
  successBorder: [187, 247, 208],
  successText: [21, 128, 61],
  slate: [71, 85, 105],
};

const safeString = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatMonth = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
  });
};

const drawPageBackground = (doc, pageWidth, pageHeight) => {
  doc.setFillColor(...COLORS.page);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
};

const loadImageAsDataURL = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    if (typeof src === "string" && src.startsWith("data:")) return resolve(src);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const context = canvas.getContext("2d");
        context.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        console.error("Logo rasterize failed:", error);
        resolve(null);
      }
    };
    img.onerror = (error) => {
      console.error("Logo load failed:", error);
      resolve(null);
    };
    img.src = typeof src === "string" ? src : URL.createObjectURL(src);
  });

const drawRoundedCard = (doc, x, y, w, h, fill = COLORS.card, border = COLORS.border, radius = PAGE.radius) => {
  doc.setFillColor(...fill);
  doc.setDrawColor(...border);
  doc.setLineWidth(0.22);
  doc.roundedRect(x, y, w, h, radius, radius, "FD");
};

const drawPill = (doc, x, y, label, fill, textColor, border = fill) => {
  const padX = 4.2;
  const height = 6.4;
  const width = doc.getTextWidth(label) + padX * 2;
  doc.setFillColor(...fill);
  doc.setDrawColor(...border);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, height / 2, height / 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...textColor);
  doc.text(label, x + width / 2, y + 4.45, { align: "center" });
  return width;
};

const drawSectionTitle = (doc, x, y, title, subtitle = "") => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.3);
  doc.setTextColor(...COLORS.text);
  doc.text(title, x, y);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.0);
    doc.setTextColor(...COLORS.muted);
    doc.text(subtitle, x, y + 4.2);
  }
};

const drawField = (doc, x, y, w, label, value) => {
  const labelText = safeString(label);
  const valueText = safeString(value);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.subMuted);
  doc.text(labelText.toUpperCase(), x, y);

  const lines = doc.splitTextToSize(valueText, w);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.0);
  doc.setTextColor(...COLORS.body);
  doc.text(lines, x, y + 4.9);

  return 5.0 + lines.length * 4.1;
};

const renderTwoColumnCard = (doc, x, y, w, title, fields, options = {}) => {
  const pad = options.pad || PAGE.pad;
  const headerH = options.headerH || 13;
  const colGap = options.colGap || 4;
  const innerW = w - pad * 2;
  const colW = (innerW - colGap) / 2;
  const rows = [];

  for (let i = 0; i < fields.length; i += 2) {
    rows.push([fields[i], fields[i + 1]].filter(Boolean));
  }

  const rowHeights = rows.map((pair) => {
    const heights = pair.map((field) => {
      const lines = doc.splitTextToSize(safeString(field.value), colW);
      return 5.0 + lines.length * 4.1;
    });
    return Math.max(...heights, 0);
  });

  const totalBodyH = rowHeights.reduce((sum, value) => sum + value, 0) + Math.max(rows.length - 1, 0) * 5;
  const cardH = Math.max(options.minHeight || 38, pad + headerH + totalBodyH + pad);

  drawRoundedCard(doc, x, y, w, cardH, options.fill || COLORS.card, options.border || COLORS.border);
  drawSectionTitle(doc, x + pad, y + 6.8, title, options.subtitle || "");

  let cy = y + headerH;
  rows.forEach((pair, rowIndex) => {
    const rowH = rowHeights[rowIndex];
    const leftField = pair[0];
    const rightField = pair[1];
    const leftX = x + pad;
    const rightX = x + pad + colW + colGap;

    if (leftField) {
      drawField(doc, leftX, cy, colW, leftField.label, leftField.value);
    }
    if (rightField) {
      drawField(doc, rightX, cy, colW, rightField.label, rightField.value);
    }

    cy += rowH + 5;
  });

  return { height: cardH };
};

const renderSummaryCard = (doc, x, y, w, config) => {
  const pad = PAGE.pad;
  const cardH = config.height || 48;
  const leftW = w * 0.62;

  drawRoundedCard(doc, x, y, w, cardH, COLORS.card, COLORS.border);
  doc.setFillColor(...COLORS.accentSoft);
  doc.roundedRect(x + 1.2, y + 1.2, w - 2.4, 3, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(...COLORS.accent);
  doc.text(config.label || "PAYMENT SUMMARY", x + pad, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.text);
  doc.text(config.amount || "PHP 0.00", x + pad, y + 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  const descriptionLines = doc.splitTextToSize(safeString(config.description), leftW - pad);
  doc.text(descriptionLines, x + pad, y + 30);

  const metaX = x + leftW + pad;
  const metaY = y + 11;
  const metaFields = config.metaFields || [];
  metaFields.forEach((field, idx) => {
    const fieldY = metaY + idx * 11.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...COLORS.subMuted);
    doc.text(field.label.toUpperCase(), metaX, fieldY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.4);
    doc.setTextColor(...COLORS.body);
    doc.text(safeString(field.value), metaX, fieldY + 4.6);
  });

  return { height: cardH };
};

const renderChargesCard = (doc, x, y, w, title, rows, options = {}) => {
  const pad = options.pad || PAGE.pad;
  const headerH = 13;
  const rowH = 8.5;
  const cardH = Math.max(options.minHeight || 38, pad + headerH + rows.length * rowH + pad - 2);

  drawRoundedCard(doc, x, y, w, cardH, options.fill || COLORS.card, options.border || COLORS.border);
  drawSectionTitle(doc, x + pad, y + 6.8, title, options.subtitle || "");

  let ry = y + headerH;
  rows.forEach((row, idx) => {
    if (idx > 0) {
      doc.setDrawColor(...COLORS.borderSoft);
      doc.setLineWidth(0.25);
      doc.line(x + pad, ry - 1.8, x + w - pad, ry - 1.8);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.1);
    doc.setTextColor(...COLORS.subMuted);
    doc.text(safeString(row.label).toUpperCase(), x + pad, ry + 1.5);
    doc.setFont("helvetica", row.emphasis ? "bold" : "normal");
    doc.setFontSize(row.emphasis ? 9.3 : 8.9);
    doc.setTextColor(...(row.emphasis ? COLORS.text : COLORS.body));
    doc.text(safeString(row.value), x + w - pad, ry + 1.5, { align: "right" });
    ry += rowH;
  });

  return { height: cardH };
};

const renderFooter = (doc, pageWidth, pageHeight, note) => {
  const footerY = pageHeight - 16;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, footerY - 4, pageWidth - PAGE.margin, footerY - 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(...COLORS.text);
  doc.text("Lilycrest Dormitory", pageWidth / 2, footerY + 1.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...COLORS.muted);
  doc.text(safeString(note, "Premium billing and receipt records for Lilycrest Dormitory."), pageWidth / 2, footerY + 6.2, { align: "center" });
};

const renderBrandHeader = (doc, logoData, x, y, title, subtitle) => {
  const logoSize = 13;
  const titleX = x + logoSize + 4;
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", x, y, logoSize, logoSize);
    } catch (error) {
      console.error("addImage failed:", error);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17.5);
  doc.setTextColor(...COLORS.text);
  doc.text(title, titleX, y + 5.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...COLORS.muted);
  doc.text(subtitle, titleX, y + 10.8);

  return titleX;
};

/**
 * Builds the PDF receipt, faithfully matching the server-side email template
 * (generatePaymentReceiptHtml in server/config/email.js).
 *
 * Color references from the email:
 *   Header/Footer bg : #183153  → [24, 49, 83]
 *   Gold label       : #D4982B  → [212, 152, 43]
 *   Dark text        : #111827  → [17, 24, 39]
 *   Body text        : #374151  → [55, 65, 81]
 *   Muted / labels   : #9CA3AF  → [156, 163, 175]
 *   Sub-muted        : #6B7280  → [107, 114, 128]
 *   Divider line     : #E5E7EB  → [229, 231, 235]
 *
 * NOTE: jsPDF's built-in Helvetica font does NOT support U+20B1 (₱).
 * Use "PHP" as the currency prefix in all doc.text() calls.
 */
async function buildReceiptDoc(reservation, profile) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE.margin;
  const contentW = pageWidth - margin * 2;
  const gap = PAGE.gap;
  const leftW = (contentW - gap) / 2;
  const rightX = margin + leftW + gap;
  let y = margin;

  drawPageBackground(doc, pageWidth, pageHeight);
  const logoData = await loadImageAsDataURL(defaultLogo);

  const room = reservation.roomId || {};
  const fullName = profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "—"
    : "—";

  const roomName = room.name || "Room";
  const branch =
    room.branch === "gil-puyat" ? "Gil Puyat"
      : room.branch === "guadalupe" ? "Guadalupe"
      : room.branch || "Lilycrest";
  const paymentMethod = reservation.paymentMethod === "paymongo"
    ? "Online Payment"
    : safeString(reservation.paymentMethod, "Online Payment");
  const refId = reservation.paymongoPaymentId
    || reservation.reservationCode
    || reservation._id?.slice(-8)?.toUpperCase()
    || "—";
  const amountText = reservation.amountPaid
    ? `PHP ${fmtAmt(reservation.amountPaid)}`
    : "PHP 2,000.00";

  renderBrandHeader(doc, logoData, margin, y + 1, "Lilycrest Dormitory", "Reservation payment receipt");
  const pillW = drawPill(doc, pageWidth - margin - 22, y + 2, "PAID", COLORS.successSoft, COLORS.successText, COLORS.successBorder);

  y += 18;

  const summary = renderSummaryCard(doc, margin, y, contentW, {
    label: "PAYMENT RECEIVED",
    amount: amountText,
    description: `Security deposit for ${roomName} at ${branch}.`,
    metaFields: [
      { label: "Receipt reference", value: refId },
      { label: "Payment date", value: formatDate(reservation.paymentDate) },
      { label: "Payment method", value: paymentMethod },
    ],
  });
  y += summary.height + 6;

  const reservationFields = [
    { label: "Tenant", value: fullName },
    { label: "Email", value: profile?.email || "—" },
    { label: "Room", value: roomName },
    { label: "Branch", value: branch },
    { label: "Lease", value: `${reservation.leaseDuration || 12} months` },
    { label: "Move-in", value: formatDate(reservation.targetMoveInDate || reservation.finalMoveInDate) },
    { label: "Bed", value: reservation.selectedBed?.position || "—" },
    { label: "Reference", value: refId },
  ];

  const paymentFields = [
    { label: "Payment method", value: paymentMethod },
    { label: "Payment date", value: formatDate(reservation.paymentDate) },
    { label: "Amount paid", value: amountText },
    { label: "Receipt status", value: "PAID" },
  ];

  const row1Left = renderTwoColumnCard(doc, margin, y, leftW, "Reservation details", reservationFields, {
    fill: COLORS.card,
  });
  const row1Right = renderTwoColumnCard(doc, rightX, y, leftW, "Payment details", paymentFields, {
    fill: COLORS.card,
  });

  y += Math.max(row1Left.height, row1Right.height) + 6;

  const tenantCard = renderTwoColumnCard(doc, margin, y, leftW, "Tenant information", [
    { label: "Tenant name", value: fullName },
    { label: "Tenant email", value: profile?.email || "—" },
    { label: "Room", value: roomName },
    { label: "Branch", value: branch },
  ], {
    fill: COLORS.card,
  });

  const billingCard = renderTwoColumnCard(doc, rightX, y, leftW, "Billing details", [
    { label: "Security deposit", value: amountText },
    { label: "Reference", value: refId },
    { label: "Lease duration", value: `${reservation.leaseDuration || 12} months` },
    { label: "Move-in date", value: formatDate(reservation.targetMoveInDate || reservation.finalMoveInDate) },
  ], {
    fill: COLORS.card,
  });

  y += Math.max(tenantCard.height, billingCard.height) + 8;

  renderFooter(doc, pageWidth, pageHeight, "Premium receipt records for Lilycrest Dormitory.");

  return doc;
}

/** Download the receipt PDF directly to the user's device. */
export async function generateDepositReceipt(reservation, profile) {
  const doc = await buildReceiptDoc(reservation, profile);
  const filename = `Lilycrest_Receipt_${reservation.reservationCode || "deposit"}.pdf`;
  doc.save(filename);
}

/** Open the receipt PDF in a new browser tab without downloading. */
export async function viewDepositReceipt(reservation, profile) {
  const doc = await buildReceiptDoc(reservation, profile);
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank");
}

// ==========================================================================
// BILLING RECEIPT PDF — matches email receipt template (generatePaymentReceiptHtml)
// Called from pdfReceipt.js via BillingPage "Download Receipt"
// ==========================================================================

/**
 * Builds a billing payment receipt PDF matching the email receipt template.
 * @param {Object} bill - Bill object with paymentDate, totalAmount, etc.
 */
async function buildBillingReceiptDoc(bill) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE.margin;
  const contentW = pageWidth - margin * 2;
  const gap = PAGE.gap;
  const leftW = (contentW - gap) / 2;
  const rightX = margin + leftW + gap;
  let y = margin;

  drawPageBackground(doc, pageWidth, pageHeight);
  const logoData = await loadImageAsDataURL(defaultLogo);

  const METHOD_LABELS = {
    gcash: "GCash",
    paymaya: "Maya",
    maya: "Maya",
    card: "Credit/Debit Card",
    grabpay: "GrabPay",
    grab_pay: "GrabPay",
    paymongo: "Online Payment",
    cash: "Cash",
    bank: "Bank Transfer",
  };

  const amount = bill.paidAmount || bill.totalAmount || 0;
  const monthLabel = bill.billingMonth ? formatMonth(bill.billingMonth) : "Monthly Bill";
  const rawMethod = safeString(bill.paymentMethod).toLowerCase().replace(/[_\s-]/g, "");
  const paymentMethodLabel = METHOD_LABELS[rawMethod] || safeString(bill.paymentMethod, "Online Payment");
  const refId = bill.paymongoPaymentId
    || bill.id?.slice(-8)?.toUpperCase()
    || bill._id?.slice(-8)?.toUpperCase()
    || "—";
  const tenantName = safeString(bill.tenantName || bill.tenant || bill.customerName || "—");

  renderBrandHeader(doc, logoData, margin, y + 1, "Lilycrest Dormitory", "Billing invoice and payment receipt");
  drawPill(doc, pageWidth - margin - 22, y + 2, "PAID", COLORS.successSoft, COLORS.successText, COLORS.successBorder);

  y += 18;

  const summary = renderSummaryCard(doc, margin, y, contentW, {
    label: "PAYMENT RECORDED",
    amount: `PHP ${fmtAmt(amount)}`,
    description: `Monthly billing record for ${monthLabel}.`,
    metaFields: [
      { label: "Reference", value: refId },
      { label: "Payment date", value: formatDate(bill.paymentDate || bill.updatedAt) },
      { label: "Method", value: paymentMethodLabel },
    ],
  });
  y += summary.height + 6;

  const tenantFields = [
    { label: "Tenant", value: tenantName },
    { label: "Email", value: bill.email || bill.tenantEmail || "—" },
    { label: "Room", value: safeString(bill.room) },
    { label: "Branch", value: safeString(bill.branch) },
  ];

  const billingFields = [
    { label: "Billing period", value: monthLabel },
    { label: "Payment date", value: formatDate(bill.paymentDate || bill.updatedAt) },
    { label: "Receipt reference", value: refId },
    { label: "Payment status", value: "PAID" },
  ];

  const row1Left = renderTwoColumnCard(doc, margin, y, leftW, "Tenant information", tenantFields, {
    fill: COLORS.card,
    subtitle: "Account holder and room context",
  });

  const row1Right = renderTwoColumnCard(doc, rightX, y, leftW, "Billing details", billingFields, {
    fill: COLORS.card,
    subtitle: "Invoice period and receipt metadata",
  });

  y += Math.max(row1Left.height, row1Right.height) + 6;

  const billingBreakdown = renderChargesCard(doc, margin, y, contentW, "Breakdown charges", [
    { label: "Rent", value: `PHP ${fmtAmt(bill.charges?.rent || 0)}`, emphasis: true },
    { label: "Electricity", value: `PHP ${fmtAmt(bill.charges?.electricity || 0)}` },
    { label: "Water", value: `PHP ${fmtAmt(bill.charges?.water || 0)}` },
    { label: "Penalty", value: `PHP ${fmtAmt(bill.charges?.penalty || 0)}` },
  ], {
    fill: COLORS.card,
    subtitle: "Itemized billing summary",
  });

  y += billingBreakdown.height + 8;

  renderFooter(doc, pageWidth, pageHeight, "Clean billing documents for Lilycrest Dormitory.");

  return doc;
}

/**
 * Download a billing payment receipt as PDF.
 * Called from pdfReceipt.js → BillingPage "Download Receipt" button.
 */
export async function generateReceiptPDF(bill) {
  const doc = await buildBillingReceiptDoc(bill);
  const receiptNo = bill.paymongoPaymentId
    ? bill.paymongoPaymentId.slice(-12).toUpperCase()
    : (bill.id || bill._id || "receipt").slice(-8).toUpperCase();
  doc.save(`Lilycrest_Receipt_${receiptNo}.pdf`);
}

/**
 * Download a billing statement as PDF (charge breakdown).
 * Called from pdfUtils.js → BillingPage "Download Statement" button.
 */
export async function generateBillingReceiptPDF(bill) {
  const doc = await buildBillingReceiptDoc(bill);
  const monthSlug = bill.billingMonth
    ? new Date(bill.billingMonth).toLocaleDateString("en-PH", { year: "numeric", month: "short" }).replace(/\s/g, "-")
    : "statement";
  doc.save(`Lilycrest_Statement_${monthSlug}.pdf`);
}

