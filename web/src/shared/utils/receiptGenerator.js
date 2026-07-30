import jsPDF from "jspdf";
import defaultLogo from "../../assets/images/LOGO.png";
import { formatPaymentMethod } from "./formatPaymentMethod.js";
import { getBedDisplayLabel } from "./bedIdentifier.js";

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

/**
 * Formats strings cleanly for PDF without inserting artificial mid-word spaces.
 * Only breaks at natural split points (e.g. '@', '_', '-') if necessary.
 */
const sanitizeForPdfWrap = (str) => {
  if (!str || typeof str !== "string") return str;
  return str.trim();
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
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.text);
  doc.text(title, x, y);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.0);
    doc.setTextColor(...COLORS.muted);
    doc.text(subtitle, x, y + 4.5);
  }
};

const drawField = (doc, x, y, w, label, value) => {
  const labelText = safeString(label);
  const rawValueText = safeString(value);
  const valueText = sanitizeForPdfWrap(rawValueText);

  // Label styling — sharp, legible 7.8pt with clear contrast
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...COLORS.muted);
  doc.text(labelText.toUpperCase(), x, y);
  doc.text(String(label).toUpperCase(), x, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(...COLORS.text);

  const cleanVal = sanitizeForPdfWrap(safeString(value));

  if (cleanVal.length > 28) {
    doc.setFontSize(8.2);
  }

  const lines = doc.splitTextToSize(cleanVal, w);
  doc.text(lines, x, y + 4.6);

  return 5.2 + lines.length * 4.2;
};

const renderTwoColumnCard = (doc, x, y, w, title, fields, options = {}) => {
  const pad = options.pad || PAGE.pad;
  // Increase header height when subtitle is present to prevent label collision
  const headerH = options.headerH || (options.subtitle ? 17 : 12);
  const colGap = options.colGap || 4;
  const innerW = w - pad * 2;
  const colW = (innerW - colGap) / 2;
  const rows = [];

  for (let i = 0; i < fields.length; i += 2) {
    rows.push([fields[i], fields[i + 1]].filter(Boolean));
  }

  const rowHeights = rows.map((pair) => {
    const heights = pair.map((field) => {
      const wrapped = sanitizeForPdfWrap(safeString(field.value));
      const lines = doc.splitTextToSize(wrapped, colW);
      return 5.2 + lines.length * 4.2;
    });
    return Math.max(...heights, 0);
  });

  const totalBodyH = rowHeights.reduce((sum, value) => sum + value, 0) + Math.max(rows.length - 1, 0) * 6;
  const cardH = Math.max(options.minHeight || 40, pad + headerH + totalBodyH + pad);

  drawRoundedCard(doc, x, y, w, cardH, options.fill || COLORS.card, options.border || COLORS.border);
  drawSectionTitle(doc, x + pad, y + 6.2, title, options.subtitle || "");

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

    cy += rowH + 6;
  });

  return { height: cardH };
};

const renderInfoBlockCard = (doc, x, y, w, title, items, options = {}) => {
  const pad = options.pad || PAGE.pad;
  const headerH = options.headerH || (options.subtitle ? 18 : 12);
  const innerW = w - pad * 2;

  let contentH = 0;
  items.forEach((item) => {
    const titleText = safeString(item.title);
    const descText = safeString(item.desc);
    const fullText = `• ${titleText}: ${descText}`;
    const lines = doc.splitTextToSize(fullText, innerW);
    contentH += lines.length * 4.5 + 2.5;
  });

  const cardH = Math.max(options.minHeight || 38, pad + headerH + contentH + pad - 2);

  drawRoundedCard(doc, x, y, w, cardH, options.fill || COLORS.card, options.border || COLORS.border);
  drawSectionTitle(doc, x + pad, y + 6.2, title, options.subtitle || "");

  let cy = y + headerH;
  items.forEach((item) => {
    const titleText = safeString(item.title);
    const descText = safeString(item.desc);
    const prefix = `• ${titleText}: `;

    // Draw bold bullet title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...COLORS.text);
    doc.text(prefix, x + pad, cy);

    const prefixW = doc.getTextWidth(prefix);

    // Draw description text without duplicating title
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.0);
    doc.setTextColor(...COLORS.body);

    const firstLineW = innerW - prefixW;
    const descLines = doc.splitTextToSize(descText, firstLineW);

    if (descLines.length === 1) {
      doc.text(descLines[0], x + pad + prefixW, cy);
      cy += 6.0;
    } else {
      doc.text(descLines[0], x + pad + prefixW, cy);
      cy += 4.5;
      const remainingText = descText.slice(descLines[0].length).trim();
      const remainingLines = doc.splitTextToSize(remainingText, innerW - 4);
      remainingLines.forEach((rLine) => {
        doc.text(rLine, x + pad + 4, cy);
        cy += 4.5;
      });
      cy += 1.5;
    }
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

  const leftX = x + pad;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.0);
  doc.setTextColor(...COLORS.accent);
  doc.text(config.label || "PAYMENT SUMMARY", leftX, y + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...COLORS.text);
  doc.text(safeString(config.amount), leftX, y + 21);

  if (config.description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...COLORS.muted);
    const descLines = doc.splitTextToSize(config.description, leftW - pad);
    doc.text(descLines, leftX, y + 28);
  }

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
  doc.text(safeString(note, "Official receipt records for Lilycrest Dormitory."), pageWidth / 2, footerY + 6.2, { align: "center" });
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
 * Builds the PDF receipt for a reservation payment.
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
  const resFn = reservation.firstName || profile?.firstName || "";
  const resLn = reservation.lastName || profile?.lastName || "";
  const fullName = `${resFn} ${resLn}`.trim() || "—";

  const roomName = room.name || room.roomNumber || "Room";
  const branch =
    room.branch === "gil-puyat" ? "Gil Puyat"
      : room.branch === "guadalupe" ? "Guadalupe"
      : room.branch || "Lilycrest";
  const paymentMethod = formatPaymentMethod(reservation.paymentMethod);
  const refId = reservation.paymongoPaymentId
    || reservation.reservationCode
    || reservation._id?.slice(-8)?.toUpperCase()
    || "—";
  const amountText = reservation.amountPaid
    ? `PHP ${fmtAmt(reservation.amountPaid)}`
    : `PHP ${fmtAmt(reservation.reservationFeeAmount || 2000)}`;

  renderBrandHeader(doc, logoData, margin, y + 1, "Lilycrest Dormitory", "Reservation payment receipt");
  drawPill(doc, pageWidth - margin - 22, y + 2, "PAID", COLORS.successSoft, COLORS.successText, COLORS.successBorder);

  y += 18;

  // 1. Top Summary Card — Authoritative Transaction Header
  const summary = renderSummaryCard(doc, margin, y, contentW, {
    label: "PAYMENT RECEIVED",
    amount: amountText,
    description: `Security deposit for ${roomName} at ${branch}.`,
    metaFields: [
      { label: "Receipt reference", value: refId },
      { label: "Payment date", value: formatDate(reservation.paymentDate || reservation.updatedAt) },
      { label: "Payment method", value: paymentMethod },
    ],
  });
  y += summary.height + 6;

  const bedLabel = getBedDisplayLabel(reservation.selectedBed);

  const roomTypeLabel = room.type
    ? room.type.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Standard";

  // 2. Tenant Personal Contact Info (ZERO overlap with Summary card)
  const tenantFields = [
    { label: "Tenant name", value: fullName },
    { label: "Tenant email", value: profile?.email || reservation.email || "—" },
    { label: "Mobile contact", value: profile?.mobileNumber || reservation.mobileNumber || "—" },
    { label: "Emergency contact", value: reservation.emergencyContactName || "On File" },
  ];

  // 3. Room & Lease Details (ZERO overlap with Summary card)
  const reservationFields = [
    { label: "Room", value: roomName },
    { label: "Branch", value: branch },
    { label: "Bed / Slot", value: bedLabel },
    { label: "Room type", value: roomTypeLabel },
    { label: "Lease duration", value: `${reservation.leaseDuration || 12} months` },
    { label: "Target move-in", value: formatDate(reservation.targetMoveInDate || reservation.finalMoveInDate) },
  ];

  const row1Left = renderTwoColumnCard(doc, margin, y, leftW, "Tenant information", tenantFields, {
    fill: COLORS.card,
    subtitle: "Account holder contact details",
    minHeight: 48,
  });
  const row1Right = renderTwoColumnCard(doc, rightX, y, leftW, "Room & lease details", reservationFields, {
    fill: COLORS.card,
    subtitle: "Allocation and move-in schedule",
    minHeight: 48,
  });

  y += Math.max(row1Left.height, row1Right.height) + 12;

  renderFooter(doc, pageWidth, pageHeight, "Official receipt records for Lilycrest Dormitory.");

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

  const amount = bill.paidAmount || bill.totalAmount || 0;
  const monthLabel = bill.billingMonth ? formatMonth(bill.billingMonth) : "Monthly Bill";
  const paymentMethodLabel = formatPaymentMethod(bill.paymentMethod || "Online Payment");
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
    { label: "Tenant name", value: tenantName },
    { label: "Tenant email", value: bill.email || bill.tenantEmail || "—" },
    { label: "Room", value: safeString(bill.room) },
    { label: "Branch", value: safeString(bill.branch) },
  ];

  const billingFields = [
    { label: "Billing period", value: monthLabel },
    { label: "Payment status", value: "PAID" },
    { label: "Due date", value: formatDate(bill.dueDate) },
    { label: "Total paid", value: `PHP ${fmtAmt(amount)}` },
  ];

  const row1Left = renderTwoColumnCard(doc, margin, y, leftW, "Tenant information", tenantFields, {
    fill: COLORS.card,
    subtitle: "Account holder and room context",
  });

  const row1Right = renderTwoColumnCard(doc, rightX, y, leftW, "Billing details", billingFields, {
    fill: COLORS.card,
    subtitle: "Invoice period and payment status",
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

// ==========================================================================
// SETTLEMENT RECEIPT PDF — Transfer & Move-Out wizard settlement estimate
// Called from TenantWorkspaceModals.jsx via "↓ Download Estimate" button
// ==========================================================================

/**
 * Builds the settlement estimate PDF for a Room Transfer or Move-Out action.
 *
 * @param {Object} data
 * @param {"transfer"|"moveOut"} data.type
 * @param {string} data.tenantName
 * @param {string} data.branch
 * @param {string} data.fromRoom
 * @param {string} data.fromBed
 * @param {string} [data.toRoom]            - Transfer only
 * @param {string} [data.toBed]             - Transfer only
 * @param {string} data.effectiveDate
 * @param {number} [data.daysSinceCycleStart]
 * @param {number} [data.daysInMonth]
 * @param {number} [data.currentRent]
 * @param {number} [data.newRent]           - Transfer only
 * @param {number} [data.proRataPreview]
 * @param {number} [data.kwhPreview]
 * @param {number} [data.electricityRate]
 * @param {number} [data.estimatedElectricityCost]
 * @param {number} [data.outstandingBalance]
 * @param {number} [data.estimatedTotal]    - Transfer total
 * @param {number} [data.securityDeposit]   - MoveOut only
 * @param {number} [data.outstandingBal]    - MoveOut only
 * @param {number} [data.keyFee]            - MoveOut only
 * @param {number} [data.damageFee]         - MoveOut only
 * @param {number} [data.electricityDeduction] - MoveOut only
 * @param {number} [data.netSettlement]     - MoveOut only
 * @param {number} [data.remainingDebt]     - MoveOut only
 * @param {boolean} [data.isEarlyVacancy]   - MoveOut only
 * @param {string} [data.finalMeterReading] - MoveOut only
 * @param {string} [data.moveOutTime]       - MoveOut only
 */
async function buildSettlementDoc(data) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE.margin;
  const contentW = pageWidth - margin * 2;
  const gap = PAGE.gap;
  const leftW = (contentW - gap) / 2;
  const rightX = margin + leftW + gap;
  let y = margin;

  drawPageBackground(doc, pageWidth, pageHeight);
  const logoData = await loadImageAsDataURL(defaultLogo);

  const isTransfer = data.type === "transfer";
  const docTitle = isTransfer ? "Room Transfer Settlement Estimate" : "Move-Out Settlement Estimate";
  const docSubtitle = isTransfer
    ? "Preliminary financial estimate — final amounts confirmed at billing generation"
    : "Deposit clearance and final settlement estimate";

  const branchLabel =
    data.branch === "gil-puyat" ? "Gil Puyat"
    : data.branch === "guadalupe" ? "Guadalupe"
    : data.branch || "Lilycrest";

  // ── Header ───────────────────────────────────────────────────────────────
  renderBrandHeader(doc, logoData, margin, y + 1, "Lilycrest Dormitory", docSubtitle);
  drawPill(
    doc,
    pageWidth - margin - 34,
    y + 2,
    "ESTIMATE",
    COLORS.accentSoft,
    COLORS.accent,
    COLORS.accentBorder,
  );
  y += 18;

  // ── Summary hero card ─────────────────────────────────────────────────────
  const totalAmt = isTransfer
    ? (data.estimatedTotal || 0)
    : data.isEarlyVacancy
      ? 0
      : (data.netSettlement || 0);

  const totalLabel = isTransfer
    ? "ESTIMATED SETTLEMENT TOTAL"
    : data.isEarlyVacancy
      ? "DEPOSIT FORFEITED"
      : data.remainingDebt > 0
        ? "REMAINING BALANCE DUE"
        : "ESTIMATED REFUNDABLE DEPOSIT";

  const totalAmtText = `PHP ${fmtAmt(totalAmt)}`;
  const metaFields = isTransfer
    ? [
        { label: "Effective date", value: formatDate(data.effectiveDate) },
        { label: "New room rent", value: data.newRent ? `PHP ${fmtAmt(data.newRent)}/mo` : "—" },
        { label: "Branch", value: branchLabel },
      ]
    : [
        { label: "Move-out date", value: formatDate(data.effectiveDate) },
        { label: "Move-out time", value: safeString(data.moveOutTime) },
        { label: "Branch", value: branchLabel },
      ];

  const summaryResult = renderSummaryCard(doc, margin, y, contentW, {
    label: totalLabel,
    amount: totalAmtText,
    description: isTransfer
      ? `${safeString(data.tenantName)} · Transfer from ${safeString(data.fromRoom)} to ${safeString(data.toRoom)}`
      : `${safeString(data.tenantName)} · Final settlement from ${safeString(data.fromRoom)}`,
    metaFields,
  });
  y += summaryResult.height + 6;

  // ── Tenant & Room columns ─────────────────────────────────────────────────
  const tenantFields = [
    { label: "Tenant name", value: safeString(data.tenantName) },
    { label: "Current room", value: safeString(data.fromRoom) },
    { label: "Current bed", value: safeString(data.fromBed) },
    { label: "Branch", value: branchLabel },
  ];

  const roomFields = isTransfer
    ? [
        { label: "Target room", value: safeString(data.toRoom) },
        { label: "Target bed", value: safeString(data.toBed) },
        { label: "Current rent", value: data.currentRent ? `PHP ${fmtAmt(data.currentRent)}/mo` : "—" },
        { label: "New rent", value: data.newRent ? `PHP ${fmtAmt(data.newRent)}/mo` : "—" },
      ]
    : [
        { label: "Final meter reading", value: data.finalMeterReading ? `${data.finalMeterReading} kWh` : "—" },
        { label: "Move-out time", value: safeString(data.moveOutTime) },
        { label: "Effective date", value: formatDate(data.effectiveDate) },
        { label: "Stay type", value: data.isEarlyVacancy ? "Early Vacancy" : "Normal Move-Out" },
      ];

  const row1Left = renderTwoColumnCard(doc, margin, y, leftW, "Tenant information", tenantFields, {
    fill: COLORS.card,
    subtitle: "Account holder and current assignment",
    minHeight: 46,
  });
  const row1Right = renderTwoColumnCard(doc, rightX, y, leftW, isTransfer ? "Transfer details" : "Move-out details", roomFields, {
    fill: COLORS.card,
    subtitle: isTransfer ? "Target room and rate change" : "Final readings and schedule",
    minHeight: 46,
  });
  y += Math.max(row1Left.height, row1Right.height) + 6;

  // ── Settlement charges breakdown ──────────────────────────────────────────
  const chargeRows = [];

  if (isTransfer) {
    if (data.daysSinceCycleStart != null) {
      chargeRows.push({ label: `Days in old room this cycle (${data.daysSinceCycleStart} of ${data.daysInMonth ?? "—"})`, value: `${data.daysSinceCycleStart} days` });
    }
    if (data.proRataPreview != null) {
      const subLabel = data.daysSinceCycleStart && data.daysInMonth && data.currentRent
        ? `${data.daysSinceCycleStart}d / ${data.daysInMonth}d × PHP ${fmtAmt(data.currentRent)}/mo`
        : "";
      chargeRows.push({ label: `Prorated old room rent${subLabel ? ` (${subLabel})` : ""}`, value: `PHP ${fmtAmt(data.proRataPreview)}` });
    }
    if (data.kwhPreview != null) {
      const rateLabel = data.electricityRate ? ` × PHP ${fmtAmt(data.electricityRate)}/kWh` : "";
      chargeRows.push({
        label: `Electricity usage (${fmtAmt(data.kwhPreview)} kWh${rateLabel})`,
        value: data.estimatedElectricityCost != null
          ? `PHP ${fmtAmt(data.estimatedElectricityCost)}`
          : `${fmtAmt(data.kwhPreview)} kWh — rate TBD`,
      });
    }
    if (data.outstandingBalance > 0) {
      chargeRows.push({ label: "Prior outstanding balance", value: `PHP ${fmtAmt(data.outstandingBalance)}` });
    }
    chargeRows.push({ label: "Estimated settlement total", value: `PHP ${fmtAmt(data.estimatedTotal || 0)}`, emphasis: true });
  } else {
    // MoveOut — deposit clearance
    chargeRows.push({ label: "Security deposit held", value: `PHP ${fmtAmt(data.securityDeposit || 0)}` });
    if (data.outstandingBal > 0) {
      chargeRows.push({ label: "Less: Unpaid balance", value: `(PHP ${fmtAmt(data.outstandingBal)})` });
    }
    if (data.keyFee > 0) {
      chargeRows.push({ label: "Less: Key replacement fee", value: `(PHP ${fmtAmt(data.keyFee)})` });
    }
    if (data.damageFee > 0) {
      chargeRows.push({ label: "Less: Damage / cleaning fee", value: `(PHP ${fmtAmt(data.damageFee)})` });
    }
    if (data.electricityDeduction > 0) {
      const rateLabel = data.electricityRate && data.kwhPreview
        ? `${fmtAmt(data.kwhPreview)} kWh × PHP ${fmtAmt(data.electricityRate)}/kWh`
        : "";
      chargeRows.push({
        label: `Less: Estimated electricity charge${rateLabel ? ` (${rateLabel})` : ""}`,
        value: `(PHP ${fmtAmt(data.electricityDeduction)})`,
      });
    }
    if (data.isEarlyVacancy) {
      chargeRows.push({ label: "Deposit status — Early vacancy forfeiture", value: "FORFEITED", emphasis: true });
    } else if (data.remainingDebt > 0) {
      chargeRows.push({ label: "Remaining balance due (after deposit offset)", value: `PHP ${fmtAmt(data.remainingDebt)}`, emphasis: true });
    } else {
      chargeRows.push({ label: "Estimated refundable deposit", value: `PHP ${fmtAmt(data.netSettlement || 0)}`, emphasis: true });
    }
  }

  const chargesResult = renderChargesCard(doc, margin, y, contentW, docTitle, chargeRows, {
    fill: COLORS.card,
    subtitle: "Itemized settlement breakdown",
  });
  y += chargesResult.height + 6;

  // ── Disclaimer notice ─────────────────────────────────────────────────────
  const noticeH = 16;
  drawRoundedCard(doc, margin, y, contentW, noticeH, COLORS.accentSoft, COLORS.accentBorder);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.0);
  doc.setTextColor(...COLORS.accent);
  doc.text("⚠ PRELIMINARY ESTIMATE", margin + PAGE.pad, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...COLORS.body);
  doc.text(
    "All amounts shown are estimates only. Final charges are confirmed at billing generation time.",
    margin + PAGE.pad,
    y + 11.5,
  );

  renderFooter(doc, pageWidth, pageHeight, "Settlement estimate for Lilycrest Dormitory administrative use only.");

  return doc;
}

/**
 * Download a Room Transfer or Move-Out settlement estimate as PDF.
 * Called from TenantWorkspaceModals.jsx via "↓ Download Estimate" button on Step 3.
 *
 * @param {Object} data  — see buildSettlementDoc JSDoc for full shape
 */
export async function generateSettlementReceiptPDF(data) {
  const doc = await buildSettlementDoc(data);
  const slug = data.tenantName
    ? data.tenantName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20)
    : "Tenant";
  const dateSlug = data.effectiveDate
    ? new Date(data.effectiveDate).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }).replace(/\s/g, "-").replace(/,/g, "")
    : "estimate";
  const typeSlug = data.type === "transfer" ? "Transfer" : "MoveOut";
  doc.save(`Lilycrest_${typeSlug}_Settlement_${slug}_${dateSlug}.pdf`);
}


/**
 * Download a Room Utility Billing Statement as PDF.
 * Called from UtilityBillingTab.jsx via "Export Statement PDF" button.
 *
 * @param {Object} data
 */
export async function generateUtilityStatementPDF(data) {
  const logoDataUrl = await loadImageAsDataURL(defaultLogo);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE.margin;
  const contentW = pageWidth - margin * 2;

  drawPageBackground(doc, pageWidth, pageHeight);

  // ── Header ─────────────────────────────────────────────────────────────────
  let y = renderReceiptHeader(
    doc,
    margin,
    margin,
    contentW,
    logoDataUrl,
    "Lilycrest Dormitory Management System",
    `${data.utilityType === "water" ? "Water" : "Electricity"} Utility Statement`,
    "ESTIMATE STATEMENT",
    COLORS.accentSoft,
    COLORS.accentBorder,
    COLORS.accent,
  );

  y += PAGE.gap;

  // ── Summary Card ───────────────────────────────────────────────────────────
  const summaryResult = renderSummaryCard(
    doc,
    margin,
    y,
    contentW,
    "UTILITY CONSUMPTION & BILLING SUMMARY",
    `PHP ${fmtAmt(data.totalCost || 0)}`,
    `${data.roomName || "Room"} \u00b7 ${data.branch || "Lilycrest"}`,
    [
      { label: "Utility Type", value: data.utilityType === "water" ? "Water" : "Electricity" },
      { label: "Billing Cycle", value: `${formatDate(data.startDate)} \u2013 ${formatDate(data.endDate)}` },
    ],
    { accentColor: COLORS.accent },
  );
  y += summaryResult.height + PAGE.gap;

  // ── Two Column Meter Info Card ─────────────────────────────────────────────
  const unit = data.utilityType === "water" ? "cu.m." : "kWh";
  const rateUnit = data.utilityType === "water" ? "cu.m" : "kWh";

  const meterLeft = [
    { label: "Room / Branch", value: `${data.roomName || "—"} (${data.branch || "—"})` },
    { label: "Initial Meter Reading", value: `${fmtAmt(data.startReading)} ${unit}` },
    { label: "Final Meter Reading", value: `${fmtAmt(data.endReading)} ${unit}` },
  ];

  const meterRight = [
    { label: "Rate per Unit", value: `PHP ${fmtAmt(data.ratePerUnit)} / ${rateUnit}` },
    { label: "Total Usage", value: `${fmtAmt(data.kwhUsage)} ${unit}` },
    { label: "Total Room Charge", value: `PHP ${fmtAmt(data.totalCost)}` },
  ];

  const twoColResult = renderTwoColInfoCard(
    doc,
    margin,
    y,
    contentW,
    "METER READING & RATE BREAKDOWN",
    meterLeft,
    meterRight,
  );
  y += twoColResult.height + PAGE.gap;

  // ── Tenant Pro-rata Allocation Card ───────────────────────────────────────
  const splits = Array.isArray(data.tenantSplits) ? data.tenantSplits : [];
  const chargeRows = splits.map((t) => ({
    label: `${t.name || "Tenant"} (${t.bed || "Bed"})${t.isProRata ? ` [Pro-Rata: ${t.daysInCycle || 0} days]` : ""}`,
    value: `PHP ${fmtAmt(t.shareAmount || 0)}`,
  }));

  if (chargeRows.length === 0) {
    chargeRows.push({ label: "Occupancy status", value: "No active tenants recorded during period" });
  }

  const chargesResult = renderChargesCard(doc, margin, y, contentW, "TENANT PRO-RATA COST SPLIT", chargeRows, {
    fill: COLORS.card,
    subtitle: `${splits.length} tenant(s) sharing utility cost`,
  });
  y += chargesResult.height + 6;

  renderFooter(doc, pageWidth, pageHeight, "Utility Billing Statement generated for Lilycrest administrative use.");

  const slug = (data.roomName || "Room").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  doc.save(`Lilycrest_Utility_Statement_${slug}_${data.utilityType || "utility"}.pdf`);
}