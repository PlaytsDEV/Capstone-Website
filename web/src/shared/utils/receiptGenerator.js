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
  page: [255, 255, 255],
  card: [255, 255, 255],
  cardAlt: [255, 255, 255],
  border: [0, 0, 0],
  borderSoft: [200, 200, 200],
  text: [0, 0, 0],
  body: [0, 0, 0],
  muted: [0, 0, 0],
  subMuted: [0, 0, 0],
  accent: [0, 0, 0],
  accentSoft: [255, 255, 255],
  accentBorder: [0, 0, 0],
  success: [0, 0, 0],
  successSoft: [255, 255, 255],
  successBorder: [0, 0, 0],
  successText: [0, 0, 0],
  slate: [0, 0, 0],
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

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const dateStr = date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateStr} at ${timeStr}`;
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
/**
 * Builds the PDF receipt for a reservation payment, formatted as a real-world Official Receipt document.
 */
/**
 * Builds the PDF receipt for a reservation payment, formatted as a full-page real-world Official Receipt document.
 */
async function buildReceiptDoc(reservation, profile) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE.margin;
  const contentW = pageWidth - margin * 2;
  const gap = PAGE.gap;
  const leftW = (contentW - gap) / 2;
  const rightX = margin + leftW + gap;
  let y = margin;

  // Pure White Document Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  const logoData = await loadImageAsDataURL(defaultLogo);

  const room = reservation.roomId || reservation.room || {};
  const resFn = reservation.firstName || profile?.firstName || "";
  const resLn = reservation.lastName || profile?.lastName || "";
  const fullName = `${resFn} ${resLn}`.trim() || "—";

  const roomNameRaw = room.name || room.roomNumber || reservation.roomNumber || reservation.roomName || "";
  const cleanRoomName = roomNameRaw
    ? (String(roomNameRaw).trim().toLowerCase().startsWith("room")
        ? String(roomNameRaw).trim()
        : `Room ${String(roomNameRaw).trim()}`)
    : "Allocated Room";

  const branch =
    room.branch === "gil-puyat" ? "Gil Puyat"
      : room.branch === "guadalupe" ? "Guadalupe"
      : room.branch || "Lilycrest";
  const paymentMethod = formatPaymentMethod(reservation.paymentMethod);
  const refId = reservation.paymongoPaymentId
    || reservation.reservationCode
    || reservation._id?.slice(-8)?.toUpperCase()
    || "—";
  const feeAmount = Number(reservation.amountPaid || reservation.reservationFeeAmount || 2000);
  const selectedBedRaw = reservation.selectedBed || reservation.bed || reservation.bedId;
  let bedText = "";
  if (typeof selectedBedRaw === "string" && selectedBedRaw.trim()) {
    bedText = selectedBedRaw.trim();
  } else if (selectedBedRaw && typeof selectedBedRaw === "object") {
    bedText = getBedDisplayLabel(selectedBedRaw, 0, room.type);
  }
  if (!bedText || bedText === "Bed" || bedText === "—") {
    if (reservation.bedNumber || reservation.bedLabel || reservation.bedPosition) {
      bedText = reservation.bedNumber || reservation.bedLabel || reservation.bedPosition;
    }
  }
  const bedDisplay = bedText ? bedText : "Assigned upon check-in";

  const moveInDateRaw =
    reservation.targetMoveInDate ||
    reservation.finalMoveInDate ||
    reservation.moveInDate ||
    reservation.intendedMoveInDate ||
    reservation.targetMoveIn ||
    reservation.moveIn ||
    profile?.targetMoveInDate ||
    profile?.moveInDate;

  const formattedMoveIn = formatDate(moveInDateRaw);
  const moveInDisplay = formattedMoveIn !== "—" ? formattedMoveIn : "To be scheduled (Pending Admin Approval)";

  const roomTypeLabel = room.type
    ? room.type.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Standard";

  // 1. BRAND HEADER & RECEIPT METADATA BOX (y = 16 to 40)
  const logoSize = 16;
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", margin, y, logoSize, logoSize);
    } catch (error) {
      console.error("Logo render failed:", error);
    }
  }

  const brandX = margin + logoSize + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text("LILYCREST DORMITORY", brandX, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Official Property Management & Student Housing", brandX, y + 10.5);
  doc.text(`Branch Location: ${branch} Branch`, brandX, y + 15.5);

  // Right-side Official Metadata Box
  const metaW = 72;
  const metaX = pageWidth - margin - metaW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("OFFICIAL RECEIPT", metaX, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`OR NO: OR-${reservation.reservationCode || refId}`, metaX, y + 10.5);
  doc.setFont("helvetica", "normal");
  doc.text(`DATE ISSUED: ${formatDateTime(reservation.paymentDate || reservation.updatedAt || new Date())}`, metaX, y + 15.5);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT STATUS: PAID IN FULL", metaX, y + 20.5);

  y += 26;

  // Solid Divider Line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // 2. PARTIES / TENANT & UNIT ALLOCATION (y = 50 to 90)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("RECEIVED FROM (TENANT ACCOUNT HOLDER)", margin, y);
  doc.text("RESERVATION & UNIT ALLOCATION", rightX, y);
  doc.setLineWidth(0.25);
  doc.line(margin, y + 1.8, margin + leftW, y + 1.8);
  doc.line(rightX, y + 1.8, rightX + leftW, y + 1.8);
  y += 8;

  // Tenant Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text(fullName, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Account Email: ${profile?.email || reservation.email || "—"}`, margin, y + 5.5);
  doc.text(`Mobile Contact: ${profile?.mobileNumber || reservation.mobileNumber || "—"}`, margin, y + 11);
  doc.text(`Emergency Contact: ${reservation.emergencyContactName || "On File"}`, margin, y + 16.5);

  // Unit Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text(cleanRoomName, rightX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Bed Space / Slot: ${bedDisplay}`, rightX, y + 5.5);
  const leaseDurationMonths = Number(reservation.leaseDuration || reservation.applicationForm?.leaseDuration);
  const leaseTermDisplay = Number.isFinite(leaseDurationMonths) && leaseDurationMonths > 0
    ? `${leaseDurationMonths}-Month Agreement`
    : "Standard Agreement";
  doc.text(`Lease Term: ${leaseTermDisplay}`, rightX, y + 16.5);
  doc.text(`Scheduled Move-In: ${moveInDisplay}`, rightX, y + 22);

  y += 28;

  // 3. ITEMIZED OFFICIAL INVOICE TABLE (y = 94 to 160)
  const tableTopY = y;
  doc.setLineWidth(0.5);
  doc.line(margin, tableTopY, pageWidth - margin, tableTopY);

  // Clear Non-Overlapping Column X Positions (mm)
  const colItemX = margin + 2;                // 17mm (Left)
  const colQtyX = margin + 105;               // 120mm (Center)
  const colUnitPriceX = margin + 142;         // 157mm (Right)
  const colTotalX = pageWidth - margin - 2;   // 193mm (Right)

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("ITEM / DESCRIPTION OF CHARGE", colItemX, tableTopY + 5);
  doc.text("QTY", colQtyX, tableTopY + 5, { align: "center" });
  doc.text("UNIT PRICE", colUnitPriceX, tableTopY + 5, { align: "right" });
  doc.text("AMOUNT (PHP)", colTotalX, tableTopY + 5, { align: "right" });

  doc.line(margin, tableTopY + 7.5, pageWidth - margin, tableTopY + 7.5);

  let rowY = tableTopY + 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Room Reservation Deposit / Unit Hold Security Fee", colItemX, rowY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.text(`Official holding deposit for ${cleanRoomName}${bedText ? ` (${bedText})` : ""} at ${branch} Branch.`, colItemX, rowY + 5.5);
  doc.text(`Applied directly towards holding the allocated bed space prior to move-in.`, colItemX, rowY + 10.5);
  doc.text(`Reservation Code Reference: ${reservation.reservationCode || refId}`, colItemX, rowY + 15.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("1", colQtyX, rowY, { align: "center" });
  doc.text(`${fmtAmt(feeAmount)}`, colUnitPriceX, rowY, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(`${fmtAmt(feeAmount)}`, colTotalX, rowY, { align: "right" });

  rowY += 28;
  doc.setLineWidth(0.4);
  doc.line(margin, rowY, pageWidth - margin, rowY);
  y = rowY + 8;

  // 4. ACCOUNTING TOTALS BOX (y = 164 to 205)
  const totalsW = 85;
  const totalsX = pageWidth - margin - totalsW;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Subtotal:", totalsX, y);
  doc.text(`PHP ${fmtAmt(feeAmount)}`, pageWidth - margin - 2, y, { align: "right" });

  doc.text("VAT / Tax (Exempt):", totalsX, y + 5.5);
  doc.text("PHP 0.00", pageWidth - margin - 2, y + 5.5, { align: "right" });

  y += 12;
  doc.setLineWidth(0.4);
  doc.line(totalsX, y, pageWidth - margin, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL AMOUNT PAID:", totalsX, y + 5.5);
  doc.text(`PHP ${fmtAmt(feeAmount)}`, pageWidth - margin - 2, y + 5.5, { align: "right" });

  doc.line(totalsX, y + 8, pageWidth - margin, y + 8);
  doc.line(totalsX, y + 8.8, pageWidth - margin, y + 8.8);

  y += 24;

  // 5. PAYMENT METADATA BOX & AUTHORIZED SIGN-OFF (y = 210 to 265)
  // Left side payment audit details
  const auditBoxW = 90;
  const auditBoxH = 45;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, auditBoxW, auditBoxH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PAYMENT AUDIT TRAIL", margin + 4, y + 6);
  doc.setLineWidth(0.2);
  doc.line(margin + 4, y + 8, margin + auditBoxW - 4, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Payment Method:", margin + 4, y + 14);
  doc.setFont("helvetica", "normal");
  doc.text(paymentMethod, margin + 34, y + 14);

  doc.setFont("helvetica", "bold");
  doc.text("Transaction Ref:", margin + 4, y + 21);
  doc.setFont("helvetica", "normal");
  doc.text(refId, margin + 34, y + 21);

  doc.setFont("helvetica", "bold");
  doc.text("Channel Status:", margin + 4, y + 28);
  doc.setFont("helvetica", "normal");
  doc.text("Confirmed & Cleared", margin + 34, y + 28);

  doc.setFont("helvetica", "bold");
  doc.text("Verification:", margin + 4, y + 35);
  doc.setFont("helvetica", "normal");
  doc.text("Electronic Seal Approved", margin + 34, y + 35);

  // Right side Signature Box
  const sigW = 65;
  const sigX = pageWidth - margin - sigW;
  const sigY = y + 26;
  doc.setLineWidth(0.4);
  doc.line(sigX, sigY, sigX + sigW, sigY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Authorized Representative", sigX + sigW / 2, sigY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Lilycrest Dormitory Management Office", sigX + sigW / 2, sigY + 9.5, { align: "center" });

  // 6. FOOTER DISCLAIMER (y = 280)
  const footerY = pageHeight - 14;
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Lilycrest Dormitory Management Office", pageWidth / 2, footerY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("This document serves as your official electronic receipt for your room reservation deposit. Please present this along with your Reservation Code on move-in day.", pageWidth / 2, footerY + 4, { align: "center" });

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
// MOVE-IN SETTLEMENT OFFICIAL RECEIPT PDF
// ==========================================================================

async function buildMoveInReceiptDoc(reservation, profile, bill) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE.margin;
  const contentW = pageWidth - margin * 2;
  const gap = PAGE.gap;
  const leftW = (contentW - gap) / 2;
  const rightX = margin + leftW + gap;
  let y = margin;

  // Pure White Document Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  const logoData = await loadImageAsDataURL(defaultLogo);

  const room = reservation.roomId || reservation.room || {};
  const resFn = reservation.firstName || profile?.firstName || "";
  const resLn = reservation.lastName || profile?.lastName || "";
  const fullName = `${resFn} ${resLn}`.trim() || "—";

  const roomNameRaw = room.name || room.roomNumber || reservation.roomNumber || reservation.roomName || "";
  const cleanRoomName = roomNameRaw
    ? (String(roomNameRaw).trim().toLowerCase().startsWith("room")
        ? String(roomNameRaw).trim()
        : `Room ${String(roomNameRaw).trim()}`)
    : "Allocated Room";

  const branch =
    room.branch === "gil-puyat" ? "Gil Puyat"
      : room.branch === "guadalupe" ? "Guadalupe"
      : room.branch || "Lilycrest";
  const paymentMethod = formatPaymentMethod(bill?.paymentMethod || reservation.paymentMethod || "paymongo");
  const refId = bill?.paymongoPaymentId
    || bill?.paymentReference
    || reservation.paymongoPaymentId
    || reservation.reservationCode
    || reservation._id?.slice(-8)?.toUpperCase()
    || "—";

  const monthlyRent = Number(
    reservation.monthlyRent ??
      reservation.pricingSnapshot?.finalMonthlyRate ??
      room.monthlyPrice ??
      room.price ??
      0,
  );
  const reservationFeeAmount = Number(reservation.reservationFeeAmount || 2000);
  const advanceRent = reservation.moveInCashOut?.monthlyAdvance ?? monthlyRent;
  const securityDeposit = reservation.moveInCashOut?.securityDeposit ?? monthlyRent;
  const grossTotal = advanceRent + securityDeposit;
  const remainingDue = Math.max(0, grossTotal - reservationFeeAmount);

  const selectedBedRaw = reservation.selectedBed || reservation.bed || reservation.bedId;
  let bedText = "";
  if (typeof selectedBedRaw === "string" && selectedBedRaw.trim()) {
    bedText = selectedBedRaw.trim();
  } else if (selectedBedRaw && typeof selectedBedRaw === "object") {
    bedText = getBedDisplayLabel(selectedBedRaw, 0, room.type);
  }
  if (!bedText || bedText === "Bed" || bedText === "—") {
    if (reservation.bedNumber || reservation.bedLabel || reservation.bedPosition) {
      bedText = reservation.bedNumber || reservation.bedLabel || reservation.bedPosition;
    }
  }
  const bedDisplay = bedText ? bedText : "Assigned upon check-in";

  const moveInDateRaw =
    reservation.targetMoveInDate ||
    reservation.finalMoveInDate ||
    reservation.moveInDate ||
    reservation.intendedMoveInDate ||
    reservation.targetMoveIn ||
    reservation.moveIn ||
    profile?.targetMoveInDate ||
    profile?.moveInDate;

  const formattedMoveIn = formatDate(moveInDateRaw);
  const moveInDisplay = formattedMoveIn !== "—" ? formattedMoveIn : "Scheduled upon Check-In";

  // 1. BRAND HEADER & RECEIPT METADATA BOX (y = 16 to 40)
  const logoSize = 16;
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", margin, y, logoSize, logoSize);
    } catch (error) {
      console.error("Logo render failed:", error);
    }
  }

  const brandX = margin + logoSize + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text("LILYCREST DORMITORY", brandX, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Official Property Management & Student Housing", brandX, y + 10.5);
  doc.text(`Branch Location: ${branch} Branch`, brandX, y + 15.5);

  // Right-side Official Metadata Box
  const metaW = 75;
  const metaX = pageWidth - margin - metaW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("OFFICIAL RECEIPT", metaX, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`OR NO: OR-SETTLE-${reservation.reservationCode || refId}`, metaX, y + 10.5);
  doc.setFont("helvetica", "normal");
  doc.text(`DATE ISSUED: ${formatDateTime(bill?.paymentDate || reservation.paymentDate || new Date())}`, metaX, y + 15.5);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT STATUS: SETTLED IN FULL", metaX, y + 20.5);

  y += 26;

  // Solid Divider Line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // 2. PARTIES / TENANT & UNIT ALLOCATION (y = 50 to 90)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("RECEIVED FROM (TENANT ACCOUNT HOLDER)", margin, y);
  doc.text("RESERVATION & UNIT ALLOCATION", rightX, y);
  doc.setLineWidth(0.25);
  doc.line(margin, y + 1.8, margin + leftW, y + 1.8);
  doc.line(rightX, y + 1.8, rightX + leftW, y + 1.8);
  y += 8;

  // Tenant Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text(fullName, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Account Email: ${profile?.email || reservation.email || "—"}`, margin, y + 5.5);
  doc.text(`Mobile Contact: ${profile?.mobileNumber || reservation.mobileNumber || "—"}`, margin, y + 11);
  doc.text(`Emergency Contact: ${reservation.emergencyContactName || "On File"}`, margin, y + 16.5);

  // Unit Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text(cleanRoomName, rightX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Bed Space / Slot: ${bedDisplay}`, rightX, y + 5.5);
  const leaseDurationMonths = Number(reservation.leaseDuration || reservation.applicationForm?.leaseDuration);
  const leaseTermDisplay = Number.isFinite(leaseDurationMonths) && leaseDurationMonths > 0
    ? `${leaseDurationMonths}-Month Agreement`
    : "Standard Agreement";
  doc.text(`Lease Term: ${leaseTermDisplay}`, rightX, y + 16.5);
  doc.text(`Scheduled Move-In: ${moveInDisplay}`, rightX, y + 22);

  y += 28;

  // 3. ITEMIZED MOVE-IN SETTLEMENT TABLE
  const tableTopY = y;
  doc.setLineWidth(0.5);
  doc.line(margin, tableTopY, pageWidth - margin, tableTopY);

  const colItemX = margin + 2;
  const colQtyX = margin + 105;
  const colUnitPriceX = margin + 142;
  const colTotalX = pageWidth - margin - 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("ITEM / DESCRIPTION OF CHARGE", colItemX, tableTopY + 5);
  doc.text("QTY", colQtyX, tableTopY + 5, { align: "center" });
  doc.text("UNIT PRICE", colUnitPriceX, tableTopY + 5, { align: "right" });
  doc.text("AMOUNT (PHP)", colTotalX, tableTopY + 5, { align: "right" });

  doc.line(margin, tableTopY + 7.5, pageWidth - margin, tableTopY + 7.5);

  // Item 1: 1-Month Advance Rent
  let rowY = tableTopY + 13;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.text("1-Month Advance Rent", colItemX, rowY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Prepaid first month rent for ${cleanRoomName}${bedText ? ` (${bedText})` : ""}. Covers Month 1 rental period.`, colItemX, rowY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("1", colQtyX, rowY, { align: "center" });
  doc.text(`${fmtAmt(advanceRent)}`, colUnitPriceX, rowY, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(`${fmtAmt(advanceRent)}`, colTotalX, rowY, { align: "right" });

  // Item 2: 1-Month Security Deposit
  rowY += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.text("1-Month Security Deposit", colItemX, rowY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Refundable security deposit held for room maintenance & final utility clearing.`, colItemX, rowY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("1", colQtyX, rowY, { align: "center" });
  doc.text(`${fmtAmt(securityDeposit)}`, colUnitPriceX, rowY, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(`${fmtAmt(securityDeposit)}`, colTotalX, rowY, { align: "right" });

  // Item 3: Slot Reservation Deposit Credit
  rowY += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.text("Less: Slot Reservation Fee Credit (Paid Online)", colItemX, rowY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Online slot reservation holding fee previously settled — credited against move-in.`, colItemX, rowY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("1", colQtyX, rowY, { align: "center" });
  doc.text(`-${fmtAmt(reservationFeeAmount)}`, colUnitPriceX, rowY, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(`-${fmtAmt(reservationFeeAmount)}`, colTotalX, rowY, { align: "right" });

  rowY += 14;
  doc.setLineWidth(0.4);
  doc.line(margin, rowY, pageWidth - margin, rowY);
  y = rowY + 6;

  // 4. ACCOUNTING TOTALS BOX
  const totalsW = 90;
  const totalsX = pageWidth - margin - totalsW;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Gross Move-In Total:", totalsX, y);
  doc.text(`PHP ${fmtAmt(grossTotal)}`, pageWidth - margin - 2, y, { align: "right" });

  doc.text("Reservation Fee Credit Applied:", totalsX, y + 5);
  doc.text(`-PHP ${fmtAmt(reservationFeeAmount)}`, pageWidth - margin - 2, y + 5, { align: "right" });

  y += 10;
  doc.setLineWidth(0.4);
  doc.line(totalsX, y, pageWidth - margin, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("NET SETTLEMENT PAID:", totalsX, y + 5);
  doc.text(`PHP ${fmtAmt(remainingDue)}`, pageWidth - margin - 2, y + 5, { align: "right" });

  doc.line(totalsX, y + 7.5, pageWidth - margin, y + 7.5);
  doc.line(totalsX, y + 8.2, pageWidth - margin, y + 8.2);

  y += 18;

  // 5. PAYMENT METADATA BOX & AUTHORIZED SIGN-OFF
  const auditBoxW = 90;
  const auditBoxH = 45;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, auditBoxW, auditBoxH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PAYMENT AUDIT TRAIL", margin + 4, y + 6);
  doc.setLineWidth(0.2);
  doc.line(margin + 4, y + 8, margin + auditBoxW - 4, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Payment Method:", margin + 4, y + 14);
  doc.setFont("helvetica", "normal");
  doc.text(paymentMethod, margin + 34, y + 14);

  doc.setFont("helvetica", "bold");
  doc.text("Transaction Ref:", margin + 4, y + 21);
  doc.setFont("helvetica", "normal");
  doc.text(refId, margin + 34, y + 21);

  doc.setFont("helvetica", "bold");
  doc.text("Channel Status:", margin + 4, y + 28);
  doc.setFont("helvetica", "normal");
  doc.text("Confirmed & Cleared", margin + 34, y + 28);

  doc.setFont("helvetica", "bold");
  doc.text("Verification:", margin + 4, y + 35);
  doc.setFont("helvetica", "normal");
  doc.text("Electronic Seal Verified", margin + 34, y + 35);

  // Right side Signature Box
  const sigW = 65;
  const sigX = pageWidth - margin - sigW;
  const sigY = y + 24;
  doc.setLineWidth(0.4);
  doc.line(sigX, sigY, sigX + sigW, sigY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Authorized Representative", sigX + sigW / 2, sigY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Lilycrest Dormitory Management Office", sigX + sigW / 2, sigY + 9.5, { align: "center" });

  // 6. FOOTER DISCLAIMER
  const footerY = pageHeight - 14;
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Lilycrest Dormitory Management Office", pageWidth / 2, footerY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("This document serves as your official electronic receipt for your move-in financial settlement (advance rent & security deposit).", pageWidth / 2, footerY + 4, { align: "center" });

  return doc;
}

/** Download the Move-In Settlement receipt PDF directly to the user's device. */
export async function generateMoveInReceipt(reservation, profile, bill) {
  const doc = await buildMoveInReceiptDoc(reservation, profile, bill);
  const filename = `Lilycrest_MoveIn_Receipt_${reservation.reservationCode || "settlement"}.pdf`;
  doc.save(filename);
}

/** Open the Move-In Settlement receipt PDF in a new browser tab without downloading. */
export async function viewMoveInReceipt(reservation, profile, bill) {
  const doc = await buildMoveInReceiptDoc(reservation, profile, bill);
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank");
}

// ==========================================================================
// MOVE-IN STATEMENT PDF — Itemized Move-In Settlement Breakdown
// ==========================================================================

async function buildMoveInStatementDoc(reservation, profile) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE.margin;
  const contentW = pageWidth - margin * 2;
  const gap = PAGE.gap;
  const leftW = (contentW - gap) / 2;
  const rightX = margin + leftW + gap;
  let y = margin;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  const logoData = await loadImageAsDataURL(defaultLogo);
  const room = reservation.roomId || reservation.room || {};
  const resFn = reservation.firstName || profile?.firstName || "";
  const resLn = reservation.lastName || profile?.lastName || "";
  const fullName = `${resFn} ${resLn}`.trim() || "Applicant";
  const userEmail = reservation.email || profile?.email || "—";
  const userPhone = reservation.contactNumber || reservation.phone || profile?.phone || profile?.contactNumber || "—";

  const roomNameRaw = room.name || room.roomNumber || reservation.roomNumber || reservation.roomName || "";
  const cleanRoomName = roomNameRaw
    ? (String(roomNameRaw).trim().toLowerCase().startsWith("room")
        ? String(roomNameRaw).trim()
        : `Room ${String(roomNameRaw).trim()}`)
    : "Allocated Room";

  const branch =
    room.branch === "gil-puyat" ? "Gil Puyat"
      : room.branch === "guadalupe" ? "Guadalupe"
      : room.branch || "Lilycrest";

  const selectedBedRaw = reservation.selectedBed || reservation.bed || reservation.bedId;
  let bedText = "";
  if (typeof selectedBedRaw === "string" && selectedBedRaw.trim()) {
    bedText = selectedBedRaw.trim();
  } else if (selectedBedRaw && typeof selectedBedRaw === "object") {
    bedText = getBedDisplayLabel(selectedBedRaw, 0, room.type);
  }
  const bedDisplay = bedText || "Assigned Bed";

  const moveInDateRaw =
    reservation.targetMoveInDate ||
    reservation.finalMoveInDate ||
    reservation.moveInDate ||
    profile?.targetMoveInDate;
  const moveInDisplay = formatDate(moveInDateRaw);

  const monthlyRent = Number(
    reservation.monthlyRent ??
      reservation.pricingSnapshot?.finalMonthlyRate ??
      room.monthlyPrice ??
      room.price ??
      0,
  );
  const reservationFeeAmount = Number(reservation.reservationFeeAmount || 2000);
  const advanceRent = reservation.moveInCashOut?.monthlyAdvance ?? monthlyRent;
  const securityDeposit = reservation.moveInCashOut?.securityDeposit ?? monthlyRent;
  const grossTotal = advanceRent + securityDeposit;
  const netDue = Math.max(0, grossTotal - reservationFeeAmount);
  const isSettled = reservation.initialPaymentStatus === "paid" || reservation.paymentStatus === "paid_in_full";

  // 1. BRAND HEADER
  const logoSize = 16;
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", margin, y, logoSize, logoSize);
    } catch (error) {
      console.error("Logo render failed:", error);
    }
  }

  const brandX = margin + logoSize + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(0, 0, 0);
  doc.text("LILYCREST DORMITORY", brandX, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Official Property Management & Student Housing", brandX, y + 10.5);
  doc.text(`Branch Location: ${branch} Branch`, brandX, y + 15.5);

  // Right-side Box
  const metaW = 78;
  const metaX = pageWidth - margin - metaW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text("MOVE-IN STATEMENT", metaX, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`STATEMENT NO: STM-${reservation.reservationCode || "MOVEIN"}`, metaX, y + 10.5);
  doc.setFont("helvetica", "normal");
  doc.text(`DATE GENERATED: ${formatDateTime(new Date())}`, metaX, y + 15.5);
  doc.setFont("helvetica", "bold");
  doc.text(
    `STATUS: ${isSettled ? "SETTLED / PAID" : "PENDING MOVE-IN SETTLEMENT"}`,
    metaX,
    y + 20.5,
  );

  y += 26;

  // Solid Divider Line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // 2. TENANT & ALLOCATION INFO
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("TENANT ACCOUNT INFORMATION", margin, y);
  doc.text("RESERVED UNIT ALLOCATION", rightX, y);
  doc.setLineWidth(0.25);
  doc.line(margin, y + 1.8, margin + leftW, y + 1.8);
  doc.line(rightX, y + 1.8, rightX + leftW, y + 1.8);
  y += 7;

  const tenantRows = [
    { label: "Account Holder:", value: fullName },
    { label: "Registered Email:", value: userEmail },
    { label: "Contact Phone:", value: userPhone },
    { label: "Target Move-In:", value: moveInDisplay },
  ];

  const unitRows = [
    { label: "Allocated Unit:", value: `${cleanRoomName} (${branch})` },
    { label: "Bed Assignment:", value: bedDisplay },
    { label: "Monthly Base Rent:", value: `PHP ${fmtAmt(monthlyRent)} / month` },
    { label: "Reservation Code:", value: reservation.reservationCode || "—" },
  ];

  doc.setFontSize(8.5);
  for (let i = 0; i < Math.max(tenantRows.length, unitRows.length); i++) {
    const t = tenantRows[i];
    const u = unitRows[i];
    if (t) {
      doc.setFont("helvetica", "bold");
      doc.text(t.label, margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(t.value, margin + 32, y);
    }
    if (u) {
      doc.setFont("helvetica", "bold");
      doc.text(u.label, rightX, y);
      doc.setFont("helvetica", "normal");
      doc.text(u.value, rightX + 34, y);
    }
    y += 5.5;
  }

  y += 4;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // 3. FINANCIAL TERMS & SETTLEMENT BREAKDOWN TABLE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("MOVE-IN FINANCIAL SCHEDULE & SETTLEMENT BREAKDOWN", margin, y);
  doc.setLineWidth(0.25);
  doc.line(margin, y + 1.8, pageWidth - margin, y + 1.8);
  y += 7;

  // Table Headers
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentW, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("ITEM DESCRIPTION & COVERAGE", margin + 3, y + 4.5);
  doc.text("AMOUNT (PHP)", pageWidth - margin - 3, y + 4.5, { align: "right" });
  y += 6.5;

  const finItems = [
    {
      desc: "One (1) Month Advance Rent (Covers your first rental month of stay)",
      amt: `PHP ${fmtAmt(advanceRent)}`,
    },
    {
      desc: "One (1) Month Security Deposit (Refundable upon contract completion & move-out)",
      amt: `PHP ${fmtAmt(securityDeposit)}`,
    },
    {
      desc: "Gross Total Move-In Requirements",
      amt: `PHP ${fmtAmt(grossTotal)}`,
      bold: true,
    },
    {
      desc: "Less: Slot Reservation Fee Credit (Paid online deposit applied to move-in)",
      amt: `-PHP ${fmtAmt(reservationFeeAmount)}`,
      credit: true,
    },
  ];

  for (const item of finItems) {
    doc.setFont("helvetica", item.bold ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.text(item.desc, margin + 3, y + 5);
    doc.text(item.amt, pageWidth - margin - 3, y + 5, { align: "right" });
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.15);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);
    y += 7;
  }

  y += 2;

  // Net Balance Callout Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentW, 11, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("NET REMAINING BALANCE DUE ON MOVE-IN:", margin + 4, y + 7);
  doc.text(`PHP ${fmtAmt(netDue)}`, pageWidth - margin - 4, y + 7, { align: "right" });
  y += 16;

  // 4. SETTLEMENT OPTIONS & INSTRUCTIONS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("SETTLEMENT OPTIONS & MOVE-IN GUIDELINES", margin, y);
  doc.setLineWidth(0.25);
  doc.line(margin, y + 1.8, pageWidth - margin, y + 1.8);
  y += 6.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("1. ONLINE SETTLEMENT: You may settle the PHP " + fmtAmt(netDue) + " balance online via PayMongo (GCash, Maya, Debit/Credit Card) in your portal.", margin, y);
  y += 4.5;
  doc.text("2. FRONT DESK SETTLEMENT: Alternatively, you may pay upon arrival on your move-in day at the Lilycrest Front Desk via Cash or Bank Transfer.", margin, y);
  y += 4.5;
  doc.text("3. ADVANCE COVERAGE: Your 1-Month Advance Rent already covers Month 1. Your regular rent billing will start on Month 2.", margin, y);
  y += 12;

  // 5. SIGNATURE / AUTHORIZATION
  const sigW = 65;
  const sigX = pageWidth - margin - sigW;
  doc.setLineWidth(0.4);
  doc.line(sigX, y + 10, sigX + sigW, y + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Authorized Representative", sigX + sigW / 2, y + 14, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Lilycrest Dormitory Administration", sigX + sigW / 2, y + 18, { align: "center" });

  // 6. FOOTER
  const footerY = pageHeight - 12;
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "Lilycrest Dormitory Management System \u00b7 Official Move-In Settlement Document \u00b7 Retain a copy for your personal records",
    pageWidth / 2,
    footerY,
    { align: "center" },
  );

  return doc;
}

export async function generateMoveInStatementPDF(reservation, profile) {
  const doc = await buildMoveInStatementDoc(reservation, profile);
  const filename = `Lilycrest_MoveIn_Statement_${reservation.reservationCode || "statement"}.pdf`;
  doc.save(filename);
}

export async function viewMoveInStatementPDF(reservation, profile) {
  const doc = await buildMoveInStatementDoc(reservation, profile);
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
  doc.text("PRELIMINARY ESTIMATE", margin + PAGE.pad, y + 6.5);
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