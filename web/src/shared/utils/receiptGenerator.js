import jsPDF from "jspdf";
import defaultLogo from "../../assets/images/LOGO.png";
import { formatPaymentMethod } from "./formatPaymentMethod.js";
import { formatDisplayReference } from "./formatPaymentReference.js";
import { getBedDisplayLabel } from "./bedIdentifier.js";
import { resolveReservationFinancials } from "./depositUtils.js";

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

const safeString = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

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

// ==========================================================================
// UNIFIED TEMPLATE DRAWING PRIMITIVES
// ==========================================================================

/**
 * 1. Draws the Standardized Official Brand & Document Header
 */
const drawOfficialHeader = (doc, logoData, branch, title, docNo, dateIssued, statusText, options = {}) => {
  const margin = PAGE.margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = margin;

  // Pure White Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), "F");

  // Logo (16x16mm)
  const logoSize = 16;
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", margin, y, logoSize, logoSize);
    } catch (error) {
      console.error("Logo render error:", error);
    }
  }

  // Left Brand Title
  const brandX = margin + logoSize + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text("LILYCREST DORMITORY", brandX, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Official Property Management & Student Housing", brandX, y + 10.5);
  doc.text(`Branch Location: ${branch || "Main"} Branch`, brandX, y + 15.5);

  // Right Official Metadata Box
  const metaW = options.metaW || 78;
  const metaX = pageWidth - margin - metaW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(0, 0, 0);
  doc.text(title || "OFFICIAL RECEIPT", metaX, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.text(`${options.noLabel || "OR NO"}: ${docNo || "—"}`, metaX, y + 10.5);

  doc.setFont("helvetica", "normal");
  doc.text(`DATE ISSUED: ${dateIssued || formatDateTime(new Date())}`, metaX, y + 15.5);

  doc.setFont("helvetica", "bold");
  doc.text(`PAYMENT STATUS: ${statusText || "PAID IN FULL"}`, metaX, y + 20.5);

  y += 26;

  // Solid Divider Line (0.6mm)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  return y;
};

/**
 * 2. Draws the Standardized Two-Column Parties & Assignment Block
 */
const drawTwoColumnParties = (doc, startY, leftTitle, leftFields, rightTitle, rightFields) => {
  const margin = PAGE.margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentW = pageWidth - margin * 2;
  const gap = PAGE.gap;
  const leftW = (contentW - gap) / 2;
  const rightX = margin + leftW + gap;
  let y = startY;

  // Column Section Titles with solid underlines
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(leftTitle.toUpperCase(), margin, y);
  doc.text(rightTitle.toUpperCase(), rightX, y);

  doc.setLineWidth(0.25);
  doc.line(margin, y + 1.8, margin + leftW, y + 1.8);
  doc.line(rightX, y + 1.8, rightX + leftW, y + 1.8);
  y += 7.5;

  const maxRows = Math.max(leftFields.length, rightFields.length);
  for (let i = 0; i < maxRows; i++) {
    const left = leftFields[i];
    const right = rightFields[i];

    if (left) {
      if (left.isHeader) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(sanitizeForPdfWrap(left.value), margin, y);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(`${left.label}:`, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(sanitizeForPdfWrap(safeString(left.value)), margin + (left.offset || 32), y);
      }
    }

    if (right) {
      if (right.isHeader) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(sanitizeForPdfWrap(right.value), rightX, y);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(`${right.label}:`, rightX, y);
        doc.setFont("helvetica", "normal");
        doc.text(sanitizeForPdfWrap(safeString(right.value)), rightX + (right.offset || 34), y);
      }
    }

    y += 5.5;
  }

  y += 4;
  return y;
};

/**
 * 3. Draws the Standardized Itemized Official Table
 */
const drawItemizedTable = (doc, startY, items, tableHeaderTitle = "ITEM / DESCRIPTION OF CHARGE") => {
  const margin = PAGE.margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = startY;

  // Solid top rule
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  const colItemX = margin + 2;
  const colQtyX = margin + 105;
  const colUnitPriceX = margin + 142;
  const colTotalX = pageWidth - margin - 2;

  // Table Headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(tableHeaderTitle, colItemX, y + 5);
  doc.text("QTY", colQtyX, y + 5, { align: "center" });
  doc.text("UNIT PRICE", colUnitPriceX, y + 5, { align: "right" });
  doc.text("AMOUNT (PHP)", colTotalX, y + 5, { align: "right" });

  doc.line(margin, y + 7.5, pageWidth - margin, y + 7.5);
  y += 13;

  // Render Rows
  items.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.2);
    doc.setTextColor(0, 0, 0);
    doc.text(item.title, colItemX, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(String(item.qty ?? "1"), colQtyX, y, { align: "center" });
    doc.text(item.unitPrice ? fmtAmt(item.unitPrice) : fmtAmt(item.amount), colUnitPriceX, y, { align: "right" });

    doc.setFont("helvetica", "bold");
    const prefix = item.isCredit ? "-" : "";
    doc.text(`${prefix}${fmtAmt(item.amount)}`, colTotalX, y, { align: "right" });

    if (item.subtext) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      const subLines = doc.splitTextToSize(item.subtext, 98);
      doc.text(subLines, colItemX, y + 4.2);
      y += 4.2 * subLines.length + 6.5;
    } else {
      y += 8;
    }
  });

  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  return y;
};

/**
 * 4. Draws the Standardized Accounting Totals Box
 */
const drawAccountingTotals = (doc, startY, totals, mainTotalLabel = "TOTAL AMOUNT PAID:") => {
  const margin = PAGE.margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const totalsW = 90;
  const totalsX = pageWidth - margin - totalsW;
  let y = startY;

  totals.forEach((row) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(row.label, totalsX, y);
    const prefix = row.isCredit ? "-PHP " : "PHP ";
    doc.text(`${prefix}${fmtAmt(row.amount)}`, pageWidth - margin - 2, y, { align: "right" });
    y += 5.2;
  });

  y += 1.5;
  doc.setLineWidth(0.4);
  doc.line(totalsX, y, pageWidth - margin, y);
  y += 5.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text(mainTotalLabel, totalsX, y);
  doc.text(`PHP ${fmtAmt(totals.mainTotal ?? totals[totals.length - 1]?.amount)}`, pageWidth - margin - 2, y, { align: "right" });

  // Double underline
  doc.line(totalsX, y + 2.5, pageWidth - margin, y + 2.5);
  doc.line(totalsX, y + 3.2, pageWidth - margin, y + 3.2);

  y += 16;
  return y;
};

/**
 * 5. Draws the Standardized Payment Audit Trail Box & Authorized Sign-off
 */
const drawAuditAndSignOff = (doc, startY, auditFields, signOffTitle = "Authorized Representative", signOffSub = "Lilycrest Dormitory Management Office") => {
  const margin = PAGE.margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const auditBoxW = 92;
  const auditBoxH = 45;
  const y = startY;

  // Left Audit Box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, auditBoxW, auditBoxH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("PAYMENT AUDIT TRAIL", margin + 4, y + 6);
  doc.setLineWidth(0.2);
  doc.line(margin + 4, y + 8, margin + auditBoxW - 4, y + 8);

  let auditY = y + 14;
  auditFields.forEach((field) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`${field.label}:`, margin + 4, auditY);

    doc.setFont("helvetica", "normal");
    doc.text(sanitizeForPdfWrap(safeString(field.value)), margin + 34, auditY);
    auditY += 7;
  });

  // Right Signature Box
  const sigW = 65;
  const sigX = pageWidth - margin - sigW;
  const sigY = y + 24;
  doc.setLineWidth(0.4);
  doc.line(sigX, sigY, sigX + sigW, sigY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(signOffTitle, sigX + sigW / 2, sigY + 5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(signOffSub, sigX + sigW / 2, sigY + 9.5, { align: "center" });

  return y + auditBoxH + 10;
};

/**
 * 6. Draws the Standardized Footer
 */
const drawOfficialFooter = (doc, note = "Official receipt records for Lilycrest Dormitory.") => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 14;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(PAGE.margin, footerY - 4, pageWidth - PAGE.margin, footerY - 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Lilycrest Dormitory Management Office", pageWidth / 2, footerY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  doc.text(note, pageWidth / 2, footerY + 4, { align: "center" });
};

// ==========================================================================
// 1. RESERVATION DEPOSIT OFFICIAL RECEIPT
// ==========================================================================

async function buildReceiptDoc(reservation, profile) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logoData = await loadImageAsDataURL(defaultLogo);

  const room = reservation.roomId || reservation.room || {};
  const resFn = reservation.firstName || profile?.firstName || "";
  const resLn = reservation.lastName || profile?.lastName || "";
  const fullName = `${resFn} ${resLn}`.trim() || "Account Holder";

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
  const rawRef = reservation.paymentReference
    || reservation.reservationCode
    || reservation._id?.slice(-8)?.toUpperCase()
    || "—";
  const refId = formatDisplayReference(rawRef);

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
  const moveInDisplay = formattedMoveIn !== "—" ? formattedMoveIn : "To be scheduled (Pending Approval)";

  const leaseDurationMonths = Number(reservation.leaseDuration || reservation.applicationForm?.leaseDuration);
  const leaseTermDisplay = Number.isFinite(leaseDurationMonths) && leaseDurationMonths > 0
    ? `${leaseDurationMonths}-Month Agreement`
    : "Standard Agreement";

  // 1. Header
  let y = drawOfficialHeader(
    doc,
    logoData,
    branch,
    "OFFICIAL RECEIPT",
    `OR-${reservation.reservationCode || refId}`,
    formatDateTime(reservation.paymentDate || reservation.updatedAt || new Date()),
    "PAID IN FULL"
  );

  // 2. Parties
  const leftFields = [
    { value: fullName, isHeader: true },
    { label: "Account Email", value: profile?.email || reservation.email || "—" },
    { label: "Mobile Contact", value: profile?.mobileNumber || reservation.mobileNumber || "—" },
    { label: "Emergency", value: reservation.emergencyContactName || "On File" },
  ];

  const rightFields = [
    { value: cleanRoomName, isHeader: true },
    { label: "Bed Space / Slot", value: bedDisplay },
    { label: "Lease Term", value: leaseTermDisplay },
    { label: "Move-In Schedule", value: moveInDisplay },
  ];

  y = drawTwoColumnParties(
    doc,
    y,
    "Received From (Tenant Account Holder)",
    leftFields,
    "Reservation & Unit Allocation",
    rightFields
  );

  // 3. Itemized Table
  const tableItems = [
    {
      title: "Room Reservation Deposit / Unit Hold Security Fee",
      subtext: `Official holding deposit for ${cleanRoomName}${bedText ? ` (${bedText})` : ""} at ${branch} Branch. Applied directly towards holding the allocated bed space prior to move-in. Ref: ${reservation.reservationCode || refId}`,
      qty: 1,
      unitPrice: feeAmount,
      amount: feeAmount,
    },
  ];

  y = drawItemizedTable(doc, y, tableItems);

  // 4. Totals
  const totals = [
    { label: "Subtotal:", amount: feeAmount },
    { label: "VAT / Tax (Exempt):", amount: 0 },
  ];
  totals.mainTotal = feeAmount;

  y = drawAccountingTotals(doc, y, totals, "TOTAL AMOUNT PAID:");

  // 5. Audit & Sign Off
  const auditFields = [
    { label: "Payment Method", value: paymentMethod },
    { label: "Transaction Ref", value: refId },
    { label: "Channel Status", value: "Confirmed & Cleared" },
    { label: "Verification", value: "Electronic Seal Approved" },
  ];

  drawAuditAndSignOff(doc, y, auditFields);

  // 6. Footer
  drawOfficialFooter(doc, "This document serves as your official electronic receipt for your room reservation deposit. Please present this along with your Reservation Code on move-in day.");

  return doc;
}

function openReceiptInTab(doc, title) {
  doc.setProperties({
    title,
    subject: "Official Receipt",
    author: "Lilycrest Dormitory",
    creator: "Lilycrest Dormitory",
  });
  const blobUrl = doc.output("bloburl");
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(`<!doctype html><html><head><title>${title}</title><style>html,body{margin:0;height:100%;background:#525659;overflow:hidden;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe src="${blobUrl}" title="${title}"></iframe></body></html>`);
    win.document.close();
  } else {
    window.open(blobUrl, "_blank");
  }
}

export async function generateDepositReceipt(reservation, profile) {
  const doc = await buildReceiptDoc(reservation, profile);
  const filename = `Lilycrest_Receipt_${reservation.reservationCode || "deposit"}.pdf`;
  doc.save(filename);
}

export async function viewDepositReceipt(reservation, profile) {
  const doc = await buildReceiptDoc(reservation, profile);
  openReceiptInTab(doc, `Official Receipt - ${reservation.reservationCode || "Deposit"}`);
}

// ==========================================================================
// 2. MOVE-IN SETTLEMENT OFFICIAL RECEIPT
// ==========================================================================

async function buildMoveInReceiptDoc(reservation, profile, bill) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logoData = await loadImageAsDataURL(defaultLogo);

  const room = reservation.roomId || reservation.room || {};
  const resFn = reservation.firstName || profile?.firstName || "";
  const resLn = reservation.lastName || profile?.lastName || "";
  const fullName = `${resFn} ${resLn}`.trim() || "Account Holder";

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
  const rawRef = bill?.paymentReference
    || reservation.paymentReference
    || reservation.reservationCode
    || reservation._id?.slice(-8)?.toUpperCase()
    || "—";
  const refId = formatDisplayReference(rawRef);

  const {
    monthlyRent,
    advanceRent,
    securityDeposit,
    grossTotal,
    reservationFeeAmount,
    appliedReservationCredit,
    isReservationFeePaid,
    remainingDue: calculatedRemainingDue,
  } = resolveReservationFinancials(reservation, profile);

  const totalSettlementAmount = Number(
    bill?.paidAmount ||
      bill?.totalAmount ||
      calculatedRemainingDue ||
      Math.max(0, advanceRent + securityDeposit - (appliedReservationCredit || 0)),
  );

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
    reservation.actualMoveInDate ||
    reservation.moveInDate ||
    reservation.intendedMoveInDate ||
    reservation.targetMoveInDate;
  const formattedMoveIn = formatDate(moveInDateRaw);
  const moveInDisplay = formattedMoveIn !== "—" ? formattedMoveIn : "Scheduled upon Check-In";

  const leaseDurationMonths = Number(reservation.leaseDuration || reservation.applicationForm?.leaseDuration);
  const leaseTermDisplay = Number.isFinite(leaseDurationMonths) && leaseDurationMonths > 0
    ? `${leaseDurationMonths}-Month Agreement`
    : "Standard Agreement";

  // 1. Header
  let y = drawOfficialHeader(
    doc,
    logoData,
    branch,
    "OFFICIAL RECEIPT",
    `OR-SETTLE-${reservation.reservationCode || refId}`,
    formatDateTime(bill?.paymentDate || reservation.paymentDate || new Date()),
    "SETTLED IN FULL"
  );

  // 2. Parties
  const leftFields = [
    { value: fullName, isHeader: true },
    { label: "Account Email", value: profile?.email || reservation.email || "—" },
    { label: "Mobile Contact", value: profile?.mobileNumber || reservation.mobileNumber || "—" },
    { label: "Emergency", value: reservation.emergencyContactName || "On File" },
  ];

  const rightFields = [
    { value: cleanRoomName, isHeader: true },
    { label: "Bed Space / Slot", value: bedDisplay },
    { label: "Lease Term", value: leaseTermDisplay },
    { label: "Move-In Schedule", value: moveInDisplay },
  ];

  y = drawTwoColumnParties(
    doc,
    y,
    "Received From (Tenant Account Holder)",
    leftFields,
    "Reservation & Unit Allocation",
    rightFields
  );

  // 3. Itemized Table
  const tableItems = [
    {
      title: "1-Month Advance Rent",
      subtext: `Prepaid first month rent for ${cleanRoomName}${bedText ? ` (${bedText})` : ""}. Covers Month 1 rental period.`,
      qty: 1,
      unitPrice: advanceRent,
      amount: advanceRent,
    },
    {
      title: "1-Month Security Deposit",
      subtext: "Refundable security deposit held for room maintenance & final utility clearing upon move-out.",
      qty: 1,
      unitPrice: securityDeposit,
      amount: securityDeposit,
    },
  ];

  if (isReservationFeePaid && (appliedReservationCredit || reservationFeeAmount) > 0) {
    tableItems.push({
      title: "Less: Slot Reservation Fee Credit",
      subtext: "Online reservation fee previously settled — credited directly against move-in requirements.",
      qty: 1,
      unitPrice: appliedReservationCredit || reservationFeeAmount,
      amount: appliedReservationCredit || reservationFeeAmount,
      isCredit: true,
    });
  }

  y = drawItemizedTable(doc, y, tableItems, "ADVANCE RENT & SECURITY DEPOSIT SETTLEMENT");

  // 4. Totals
  const subtotal = advanceRent + securityDeposit;
  const totals = [
    { label: "Subtotal Charges:", amount: subtotal },
  ];
  if (isReservationFeePaid && (appliedReservationCredit || reservationFeeAmount) > 0) {
    totals.push({ label: "Less: Slot Reservation Credit:", amount: appliedReservationCredit || reservationFeeAmount, isCredit: true });
  }
  totals.push({ label: "VAT / Tax (Exempt):", amount: 0 });
  totals.mainTotal = totalSettlementAmount;

  y = drawAccountingTotals(doc, y, totals, "TOTAL AMOUNT PAID:");

  // 5. Audit & Sign Off
  const auditFields = [
    { label: "Payment Method", value: paymentMethod },
    { label: "Transaction Ref", value: refId },
    { label: "Channel Status", value: "Confirmed & Cleared" },
    { label: "Verification", value: "Electronic Seal Verified" },
  ];

  drawAuditAndSignOff(doc, y, auditFields);

  // 6. Footer
  drawOfficialFooter(doc, "This document serves as your official electronic receipt for your 1-Month Advance Rent and 1-Month Security Deposit settlement.");

  return doc;
}

export async function generateMoveInReceipt(reservation, profile, bill) {
  const doc = await buildMoveInReceiptDoc(reservation, profile, bill);
  const filename = `Lilycrest_MoveIn_Receipt_${reservation.reservationCode || "settlement"}.pdf`;
  doc.save(filename);
}

export async function viewMoveInReceipt(reservation, profile, bill) {
  const doc = await buildMoveInReceiptDoc(reservation, profile, bill);
  openReceiptInTab(doc, `Official Move-In Receipt - ${reservation.reservationCode || "Settlement"}`);
}

// ==========================================================================
// 3. MOVE-IN STATEMENT PDF
// ==========================================================================

async function buildMoveInStatementDoc(reservation, profile) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
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

  const {
    monthlyRent,
    advanceRent,
    securityDeposit,
    grossTotal,
    reservationFeeAmount,
    appliedReservationCredit,
    isReservationFeePaid,
    remainingDue: netDue,
    isSettled,
  } = resolveReservationFinancials(reservation, profile);

  // 1. Header
  let y = drawOfficialHeader(
    doc,
    logoData,
    branch,
    "MOVE-IN STATEMENT",
    `STM-${reservation.reservationCode || "MOVEIN"}`,
    formatDateTime(new Date()),
    isSettled ? "SETTLED / PAID" : "PENDING MOVE-IN SETTLEMENT",
    { noLabel: "STATEMENT NO" }
  );

  // 2. Parties
  const leftFields = [
    { value: fullName, isHeader: true },
    { label: "Account Email", value: userEmail },
    { label: "Contact Phone", value: userPhone },
    { label: "Target Move-In", value: moveInDisplay },
  ];

  const rightFields = [
    { value: cleanRoomName, isHeader: true },
    { label: "Bed Assignment", value: bedDisplay },
    { label: "Monthly Base Rent", value: `PHP ${fmtAmt(monthlyRent)} / month` },
    { label: "Reservation Code", value: reservation.reservationCode || "—" },
  ];

  y = drawTwoColumnParties(
    doc,
    y,
    "Tenant Account Information",
    leftFields,
    "Reserved Unit Allocation",
    rightFields
  );

  // 3. Itemized Table
  const tableItems = [
    {
      title: "One (1) Month Advance Rent",
      subtext: "Prepaid rental charge covering the initial month of stay.",
      qty: 1,
      unitPrice: advanceRent,
      amount: advanceRent,
    },
    {
      title: "One (1) Month Security Deposit",
      subtext: "Refundable security deposit held for unit maintenance & final clearing.",
      qty: 1,
      unitPrice: securityDeposit,
      amount: securityDeposit,
    },
  ];

  if (isReservationFeePaid && (appliedReservationCredit || reservationFeeAmount) > 0) {
    tableItems.push({
      title: "Less: Slot Reservation Fee Credit",
      subtext: "Online deposit previously settled — credited directly against move-in requirements.",
      qty: 1,
      unitPrice: appliedReservationCredit || reservationFeeAmount,
      amount: appliedReservationCredit || reservationFeeAmount,
      isCredit: true,
    });
  }

  y = drawItemizedTable(doc, y, tableItems, "MOVE-IN FINANCIAL SCHEDULE & BREAKDOWN");

  // 4. Totals
  const totals = [
    { label: "Gross Total Requirements:", amount: grossTotal },
  ];
  if (isReservationFeePaid && (appliedReservationCredit || reservationFeeAmount) > 0) {
    totals.push({ label: "Reservation Fee Credit Applied:", amount: appliedReservationCredit || reservationFeeAmount, isCredit: true });
  }
  totals.mainTotal = netDue;

  y = drawAccountingTotals(doc, y, totals, "NET REMAINING BALANCE DUE:");

  // 5. Settlement Instructions
  const auditFields = [
    { label: "Online Settlement", value: "Available in tenant portal via PayMongo" },
    { label: "Front Desk Option", value: "Pay upon arrival via Cash or Bank Transfer" },
    { label: "Advance Coverage", value: "Month 1 covered; regular billing starts Month 2" },
    { label: "Document Status", value: isSettled ? "Settled in full" : "Pending move-in settlement" },
  ];

  drawAuditAndSignOff(doc, y, auditFields, "Authorized Representative", "Lilycrest Dormitory Administration");

  // 6. Footer
  drawOfficialFooter(doc, "Lilycrest Dormitory Management System · Official Move-In Settlement Document · Retain a copy for your personal records");

  return doc;
}

export async function generateMoveInStatementPDF(reservation, profile) {
  const doc = await buildMoveInStatementDoc(reservation, profile);
  const filename = `Lilycrest_MoveIn_Statement_${reservation.reservationCode || "statement"}.pdf`;
  doc.save(filename);
}

export async function viewMoveInStatementPDF(reservation, profile) {
  const doc = await buildMoveInStatementDoc(reservation, profile);
  openReceiptInTab(doc, `Move-In Statement - ${reservation.reservationCode || "Statement"}`);
}

// ==========================================================================
// 4. MONTHLY BILLING PAYMENT RECEIPT PDF
// ==========================================================================

async function buildBillingReceiptDoc(bill) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logoData = await loadImageAsDataURL(defaultLogo);

  const amount = bill.paidAmount || bill.totalAmount || 0;
  const monthLabel = bill.billingMonth ? formatMonth(bill.billingMonth) : "Monthly Bill";
  const paymentMethodLabel = formatPaymentMethod(bill.paymentMethod || "paymongo");
  const rawRef = bill.paymentReference
    || bill.paymongoReference
    || bill.billReference
    || bill.id?.slice(-8)?.toUpperCase()
    || bill._id?.slice(-8)?.toUpperCase()
    || "—";
  const refId = formatDisplayReference(rawRef);

  const tenantName = safeString(bill.tenantName || bill.tenant || bill.customerName || "Resident Tenant");
  const branch = bill.branch || "Lilycrest";
  const roomName = bill.room || "Assigned Room";

  // 1. Header
  let y = drawOfficialHeader(
    doc,
    logoData,
    branch,
    "OFFICIAL RECEIPT",
    `OR-BILL-${refId}`,
    formatDateTime(bill.paymentDate || bill.updatedAt || new Date()),
    "PAID IN FULL"
  );

  // 2. Parties
  const leftFields = [
    { value: tenantName, isHeader: true },
    { label: "Account Email", value: bill.email || bill.tenantEmail || "—" },
    { label: "Contact Phone", value: bill.phone || bill.mobileNumber || "—" },
    { label: "Payment Date", value: formatDate(bill.paymentDate || bill.updatedAt) },
  ];

  const rightFields = [
    { value: `${roomName} (${branch})`, isHeader: true },
    { label: "Billing Period", value: monthLabel },
    { label: "Payment Status", value: "PAID IN FULL" },
    { label: "Payment Channel", value: paymentMethodLabel },
  ];

  y = drawTwoColumnParties(
    doc,
    y,
    "Received From (Tenant Account Holder)",
    leftFields,
    "Billing Period & Room Allocation",
    rightFields
  );

  // 3. Itemized Table
  const tableItems = [];
  const rentAmt = Number(bill.charges?.rent || bill.rentAmount || 0);
  const elecAmt = Number(bill.charges?.electricity || bill.electricityAmount || 0);
  const waterAmt = Number(bill.charges?.water || bill.waterAmount || 0);
  const penaltyAmt = Number(bill.charges?.penalty || bill.penaltyAmount || 0);
  const discountAmt = Number(bill.charges?.discount || bill.discountAmount || 0);

  if (rentAmt > 0 || (elecAmt === 0 && waterAmt === 0)) {
    tableItems.push({
      title: `Monthly Base Rent (${monthLabel})`,
      subtext: `Room accommodation rental charge for ${roomName} for ${monthLabel}.`,
      qty: 1,
      unitPrice: rentAmt || amount,
      amount: rentAmt || amount,
    });
  }

  if (elecAmt > 0) {
    const elecSub = bill.kwhUsage ? `Electricity consumption (${fmtAmt(bill.kwhUsage)} kWh)` : "Electricity utility share";
    tableItems.push({
      title: "Electricity Utility Charge",
      subtext: elecSub,
      qty: 1,
      unitPrice: elecAmt,
      amount: elecAmt,
    });
  }

  if (waterAmt > 0) {
    tableItems.push({
      title: "Water Utility Charge",
      subtext: "Water supply utility charge for billing cycle.",
      qty: 1,
      unitPrice: waterAmt,
      amount: waterAmt,
    });
  }

  if (penaltyAmt > 0) {
    tableItems.push({
      title: "Late Payment Penalty Fee",
      subtext: "Administrative late payment surcharge.",
      qty: 1,
      unitPrice: penaltyAmt,
      amount: penaltyAmt,
    });
  }

  if (discountAmt > 0) {
    tableItems.push({
      title: "Applied Discount / Credit Adjustment",
      subtext: "Approved account credit applied to bill.",
      qty: 1,
      unitPrice: discountAmt,
      amount: discountAmt,
      isCredit: true,
    });
  }

  y = drawItemizedTable(doc, y, tableItems, "ITEMIZED BILLING CHARGES & COVERAGE");

  // 4. Totals
  const baseSubtotal = (rentAmt + elecAmt + waterAmt) || Math.max(0, amount - penaltyAmt + discountAmt);
  const totals = [
    { label: "Base Subtotal Charges:", amount: baseSubtotal },
  ];
  if (penaltyAmt > 0) {
    totals.push({ label: "Late Payment Penalty:", amount: penaltyAmt });
  }
  if (discountAmt > 0) {
    totals.push({ label: "Discount / Credit Adjustment:", amount: discountAmt, isCredit: true });
  }
  totals.push({ label: "VAT / Tax (Exempt):", amount: 0 });
  totals.mainTotal = amount || Math.max(0, baseSubtotal + penaltyAmt - discountAmt);

  y = drawAccountingTotals(doc, y, totals, "TOTAL AMOUNT PAID:");

  // 5. Audit & Sign Off
  const auditFields = [
    { label: "Payment Method", value: paymentMethodLabel },
    { label: "Transaction Ref", value: refId },
    { label: "Channel Status", value: "Confirmed & Cleared" },
    { label: "Verification", value: "Electronic Seal Approved" },
  ];

  drawAuditAndSignOff(doc, y, auditFields);

  // 6. Footer
  drawOfficialFooter(doc, "Official electronic receipt for Lilycrest Dormitory monthly billing. Please keep a copy for your records.");

  return doc;
}

export async function generateReceiptPDF(bill) {
  const doc = await buildBillingReceiptDoc(bill);
  const rawRef = bill.paymentReference || bill.paymongoReference || bill.billReference || (bill.id || bill._id || "receipt").slice(-8).toUpperCase();
  const receiptNo = formatDisplayReference(rawRef, "receipt").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Lilycrest_Receipt_${receiptNo}.pdf`);
}

export async function viewReceiptPDF(bill) {
  const doc = await buildBillingReceiptDoc(bill);
  const rawRef = bill.paymentReference || bill.paymongoReference || bill.billReference || (bill.id || bill._id || "receipt").slice(-8).toUpperCase();
  openReceiptInTab(doc, `Official Receipt - ${rawRef}`);
}

// ==========================================================================
// 5. MONTHLY BILLING STATEMENT / INVOICE PDF (Unpaid or Statement View)
// ==========================================================================

async function buildBillingStatementDoc(bill) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logoData = await loadImageAsDataURL(defaultLogo);

  const amount = bill.totalAmount || bill.amount || bill.paidAmount || 0;
  const monthLabel = bill.billingMonth ? formatMonth(bill.billingMonth) : "Monthly Bill";
  const refId = bill.id?.slice(-8)?.toUpperCase()
    || bill._id?.slice(-8)?.toUpperCase()
    || "—";

  const tenantName = safeString(bill.tenantName || bill.tenant || bill.customerName || "Resident Tenant");
  const branch = bill.branch || "Lilycrest";
  const roomName = bill.room || "Assigned Room";
  const isPaid = bill.status === "paid";
  const statusLabel = isPaid ? "PAID" : bill.status === "overdue" ? "OVERDUE" : "DUE & PAYABLE";

  // 1. Header
  let y = drawOfficialHeader(
    doc,
    logoData,
    branch,
    "BILLING STATEMENT & INVOICE",
    `INV-BILL-${refId}`,
    formatDateTime(bill.createdAt || new Date()),
    statusLabel,
    { noLabel: "STATEMENT NO" }
  );

  // 2. Parties
  const leftFields = [
    { value: tenantName, isHeader: true },
    { label: "Account Email", value: bill.email || bill.tenantEmail || "—" },
    { label: "Due Date", value: formatDate(bill.dueDate) },
    { label: "Invoice Status", value: statusLabel },
  ];

  const rightFields = [
    { value: `${roomName} (${branch})`, isHeader: true },
    { label: "Billing Period", value: monthLabel },
    { label: "Room / Bed", value: roomName },
    { label: "Branch", value: branch },
  ];

  y = drawTwoColumnParties(
    doc,
    y,
    "Billed To (Tenant Account Holder)",
    leftFields,
    "Billing Details & Room Allocation",
    rightFields
  );

  // 3. Itemized Table
  const tableItems = [];
  const rentAmt = Number(bill.charges?.rent || bill.rentAmount || 0);
  const elecAmt = Number(bill.charges?.electricity || bill.electricityAmount || 0);
  const waterAmt = Number(bill.charges?.water || bill.waterAmount || 0);
  const penaltyAmt = Number(bill.charges?.penalty || bill.penaltyAmount || 0);
  const discountAmt = Number(bill.charges?.discount || bill.discountAmount || 0);

  if (rentAmt > 0 || (elecAmt === 0 && waterAmt === 0)) {
    tableItems.push({
      title: `Monthly Base Rent (${monthLabel})`,
      subtext: `Room accommodation rental charge for ${roomName} for ${monthLabel}.`,
      qty: 1,
      unitPrice: rentAmt || amount,
      amount: rentAmt || amount,
    });
  }

  if (elecAmt > 0) {
    const elecSub = bill.kwhUsage ? `Electricity consumption (${fmtAmt(bill.kwhUsage)} kWh)` : "Electricity utility share";
    tableItems.push({
      title: "Electricity Utility Charge",
      subtext: elecSub,
      qty: 1,
      unitPrice: elecAmt,
      amount: elecAmt,
    });
  }

  if (waterAmt > 0) {
    tableItems.push({
      title: "Water Utility Charge",
      subtext: "Water supply utility charge for billing cycle.",
      qty: 1,
      unitPrice: waterAmt,
      amount: waterAmt,
    });
  }

  if (penaltyAmt > 0) {
    tableItems.push({
      title: "Late Payment Penalty Surcharge",
      subtext: "Applicable fee for settlements past the due date.",
      qty: 1,
      unitPrice: penaltyAmt,
      amount: penaltyAmt,
    });
  }

  if (discountAmt > 0) {
    tableItems.push({
      title: "Applied Credit / Discount",
      subtext: "Approved credit deduction.",
      qty: 1,
      unitPrice: discountAmt,
      amount: discountAmt,
      isCredit: true,
    });
  }

  y = drawItemizedTable(doc, y, tableItems, "ITEMIZED STATEMENT CHARGES");

  // 4. Totals
  const baseSubtotal = (rentAmt + elecAmt + waterAmt) || Math.max(0, amount - penaltyAmt + discountAmt);
  const totals = [
    { label: "Base Subtotal Charges:", amount: baseSubtotal },
  ];
  if (penaltyAmt > 0) {
    totals.push({ label: "Late Payment Penalty:", amount: penaltyAmt });
  }
  if (discountAmt > 0) {
    totals.push({ label: "Applied Credit / Discount:", amount: discountAmt, isCredit: true });
  }
  totals.push({ label: "VAT / Tax (Exempt):", amount: 0 });
  totals.mainTotal = amount || Math.max(0, baseSubtotal + penaltyAmt - discountAmt);

  y = drawAccountingTotals(doc, y, totals, isPaid ? "TOTAL AMOUNT PAID:" : "TOTAL AMOUNT DUE:");

  // 5. Settlement Instructions
  const auditFields = [
    { label: "Payment Options", value: "Pay online via PayMongo (GCash/Card/Maya)" },
    { label: "Due Date", value: formatDate(bill.dueDate) },
    { label: "Grace Period", value: "Settle on or before due date to avoid penalty" },
    { label: "Account Status", value: isPaid ? "Paid in Full" : "Pending Settlement" },
  ];

  drawAuditAndSignOff(doc, y, auditFields, "Authorized Representative", "Lilycrest Dormitory Billing Office");

  // 6. Footer
  drawOfficialFooter(doc, "Billing Statement generated by Lilycrest Dormitory Management System. Please settle promptly.");

  return doc;
}

export async function generateBillingReceiptPDF(bill) {
  const doc = await buildBillingStatementDoc(bill);
  const monthSlug = bill.billingMonth
    ? new Date(bill.billingMonth).toLocaleDateString("en-PH", { year: "numeric", month: "short" }).replace(/\s/g, "-")
    : "statement";
  doc.save(`Lilycrest_Statement_${monthSlug}.pdf`);
}

export async function viewBillingReceiptPDF(bill) {
  const doc = await buildBillingStatementDoc(bill);
  const monthSlug = bill.billingMonth
    ? new Date(bill.billingMonth).toLocaleDateString("en-PH", { year: "numeric", month: "short" })
    : "Statement";
  openReceiptInTab(doc, `Billing Statement (${monthSlug}) - ${bill.invoiceNumber || "Invoice"}`);
}

// ==========================================================================
// 6. SETTLEMENT ESTIMATE PDF (Room Transfer & Move-Out)
// ==========================================================================

async function buildSettlementDoc(data) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logoData = await loadImageAsDataURL(defaultLogo);

  const isTransfer = data.type === "transfer";
  const docTitle = isTransfer ? "ROOM TRANSFER SETTLEMENT ESTIMATE" : "MOVE-OUT SETTLEMENT ESTIMATE";

  const branchLabel =
    data.branch === "gil-puyat" ? "Gil Puyat"
    : data.branch === "guadalupe" ? "Guadalupe"
    : data.branch || "Lilycrest";

  // Room-transfer PDFs are driven ENTIRELY by the canonical server preview
  // (data.transferPreview) so the printed figures match what Admin sees on
  // screen. There is no separate frontend proration.
  const xfer = isTransfer ? (data.transferPreview || null) : null;

  const totalAmt = isTransfer
    ? Number(xfer?.totalImmediateDue || 0)
    : data.isEarlyVacancy
      ? 0
      : (data.netSettlement || 0);

  const statusLabel = isTransfer
    ? "SETTLEMENT ESTIMATE"
    : data.isEarlyVacancy
      ? "DEPOSIT FORFEITED"
      : data.remainingDebt > 0
        ? "BALANCE DUE"
        : "REFUNDABLE";

  // 1. Header
  let y = drawOfficialHeader(
    doc,
    logoData,
    branchLabel,
    docTitle,
    `EST-${isTransfer ? "XFER" : "MOUT"}-${Date.now().toString().slice(-6)}`,
    formatDateTime(new Date()),
    statusLabel,
    { noLabel: "ESTIMATE NO" }
  );

  // 2. Parties & Move details
  const leftFields = [
    { value: safeString(data.tenantName), isHeader: true },
    { label: "Current Room", value: safeString(data.fromRoom) },
    { label: "Current Bed", value: safeString(data.fromBed) },
    { label: "Effective Date", value: formatDate(data.effectiveDate) },
  ];

  const rightFields = isTransfer
    ? [
        { value: `Target: ${safeString(data.toRoom)} (${safeString(data.toBed)})`, isHeader: true },
        { label: "Old / Current Rent", value: (xfer?.rent?.sourceEffectiveRate ?? data.currentRent) ? `PHP ${fmtAmt(xfer?.rent?.sourceEffectiveRate ?? data.currentRent)}/mo` : "—" },
        { label: "Destination Rent", value: (xfer?.rent?.destinationApprovedRate ?? data.newRent) ? `PHP ${fmtAmt(xfer?.rent?.destinationApprovedRate ?? data.newRent)}/mo` : "—" },
        { label: "Branch", value: branchLabel },
      ]
    : [
        { value: `${safeString(data.fromRoom)} (${branchLabel})`, isHeader: true },
        { label: "Move-Out Time", value: safeString(data.moveOutTime) },
        { label: "Final Meter", value: data.finalMeterReading ? `${data.finalMeterReading} kWh` : "—" },
        { label: "Stay Category", value: data.isEarlyVacancy ? "Early Vacancy" : "Normal Move-Out" },
      ];

  y = drawTwoColumnParties(
    doc,
    y,
    "Tenant Account Information",
    leftFields,
    isTransfer ? "Target Unit Allocation" : "Move-Out Assignment Details",
    rightFields
  );

  // 3. Itemized Table
  const tableItems = [];
  if (isTransfer) {
    const r = xfer?.rent || {};
    const d = xfer?.deposit || {};

    // ── RENT ADJUSTMENT — a distinct category (never netted with deposit) ──
    tableItems.push({
      title: "Rent Adjustment (current cycle)",
      subtext: `${r.destinationDays ?? 0}d destination-room prorated (PHP ${fmtAmt(r.destinationProratedValue)}) less unused prepaid rent (PHP ${fmtAmt(r.unusedPrepaidCredit)}).`,
      qty: 1,
      unitPrice: Number(r.adjustmentDue || 0),
      amount: Number(r.adjustmentDue || 0),
    });
    if (Number(r.excessCredit || 0) > 0) {
      tableItems.push({
        title: "Excess Prepaid Rent -> Rent Credit",
        subtext: "Applied automatically to future rent bills. Not a refund, not netted against the deposit.",
        qty: 1,
        unitPrice: Number(r.excessCredit || 0),
        amount: Number(r.excessCredit || 0),
        isCredit: true,
      });
    }

    // ── SECURITY DEPOSIT — a distinct category ──
    tableItems.push({
      title: "Security Deposit Required (destination room)",
      subtext: "One month's rent at the destination rate.",
      qty: 1,
      unitPrice: Number(d.required || 0),
      amount: Number(d.required || 0),
    });
    tableItems.push({
      title: "Less: Security Deposit Already Held",
      subtext: d.heldKnown
        ? "Deposit cash currently on file, credited against the destination requirement."
        : "Legacy record — held deposit amount unavailable; verify manually before settlement.",
      qty: 1,
      unitPrice: d.heldKnown ? Number(d.held || 0) : 0,
      amount: d.heldKnown ? Number(d.held || 0) : 0,
      isCredit: true,
    });
    if (Number(d.balanceDue || 0) > 0) {
      tableItems.push({
        title: "Additional Security Deposit Due",
        subtext: "Difference between the destination requirement and the deposit already held.",
        qty: 1,
        unitPrice: Number(d.balanceDue || 0),
        amount: Number(d.balanceDue || 0),
      });
    }
    if (Number(d.excessHeld || 0) > 0) {
      tableItems.push({
        title: "Excess Deposit Held",
        subtext: "Destination requires a smaller deposit. The excess stays as refundable held deposit — not auto-refunded, not converted to a rent credit.",
        qty: 1,
        unitPrice: Number(d.excessHeld || 0),
        amount: Number(d.excessHeld || 0),
        isCredit: true,
      });
    }

    // ── ELECTRICITY — informational only, NOT in Total Immediate Due ──
    tableItems.push({
      title: "Estimated Source-Room Electricity (informational)",
      subtext:
        data.estimatedElectricityCost != null
          ? `Approx. PHP ${fmtAmt(data.estimatedElectricityCost)} for ~${fmtAmt(data.kwhPreview)} kWh. Final charge is generated during the normal utility period close — NOT included in Total Immediate Due.`
          : "The final charge is generated during the normal utility period close — NOT included in Total Immediate Due.",
      qty: 1,
      unitPrice: 0,
      amount: 0,
    });

    // ── WATER — follows existing policy, never an immediate transfer charge ──
    tableItems.push({
      title: "Water (informational)",
      subtext:
        "Follows the current room/branch water policy and is settled at its normal period close (or not billed separately where included in rent). NOT included in Total Immediate Due.",
      qty: 1,
      unitPrice: 0,
      amount: 0,
    });

    if (data.outstandingBalance > 0) {
      tableItems.push({
        title: "Prior Outstanding Balance (existing, unrelated)",
        subtext: "Carried-forward unpaid prior charges. Shown for context; not part of the transfer settlement total.",
        qty: 1,
        unitPrice: data.outstandingBalance,
        amount: data.outstandingBalance,
      });
    }
  } else {
    tableItems.push({
      title: "Security Deposit Held on File",
      subtext: "Deposit credited towards final account clearing.",
      qty: 1,
      unitPrice: data.securityDeposit || 0,
      amount: data.securityDeposit || 0,
    });
    if (data.outstandingBal > 0) {
      tableItems.push({
        title: "Less: Outstanding Unpaid Balance",
        subtext: "Deduction for unpaid billing cycles.",
        qty: 1,
        unitPrice: data.outstandingBal,
        amount: data.outstandingBal,
        isCredit: true,
      });
    }
    if (data.electricityDeduction > 0) {
      tableItems.push({
        title: "Less: Final Electricity Consumption Deduction",
        subtext: `Estimated electricity charge (${fmtAmt(data.kwhPreview)} kWh).`,
        qty: 1,
        unitPrice: data.electricityDeduction,
        amount: data.electricityDeduction,
        isCredit: true,
      });
    }
    if (data.keyFee > 0) {
      tableItems.push({
        title: "Less: Key Replacement / Return Fee",
        subtext: "Key clearing deduction.",
        qty: 1,
        unitPrice: data.keyFee,
        amount: data.keyFee,
        isCredit: true,
      });
    }
    if (data.damageFee > 0) {
      tableItems.push({
        title: "Less: Unit Damage / Cleaning Fee",
        subtext: "Room inspection assessment deduction.",
        qty: 1,
        unitPrice: data.damageFee,
        amount: data.damageFee,
        isCredit: true,
      });
    }
  }

  y = drawItemizedTable(doc, y, tableItems, "SETTLEMENT ITEMS & DEPOSIT CLEARANCE");

  // 4. Totals
  const totals = [];
  if (isTransfer) {
    const r = xfer?.rent || {};
    const d = xfer?.deposit || {};
    totals.push({ label: "Rent Adjustment:", amount: Number(r.adjustmentDue || 0) });
    totals.push({ label: "Additional Security Deposit:", amount: Number(d.balanceDue || 0) });
    totals.mainTotal = totalAmt; // = rent adjustment + additional deposit (server canonical)
    y = drawAccountingTotals(doc, y, totals, "TOTAL IMMEDIATE DUE:");
  } else {
    if (data.isEarlyVacancy) {
      totals.push({ label: "Deposit Status:", amount: 0 });
      totals.mainTotal = 0;
      y = drawAccountingTotals(doc, y, totals, "DEPOSIT FORFEITED (EARLY VACANCY):");
    } else if (data.remainingDebt > 0) {
      totals.push({ label: "Remaining Debt:", amount: data.remainingDebt });
      totals.mainTotal = data.remainingDebt;
      y = drawAccountingTotals(doc, y, totals, "REMAINING BALANCE DUE:");
    } else {
      totals.push({ label: "Estimated Refundable Deposit:", amount: data.netSettlement || 0 });
      totals.mainTotal = data.netSettlement || 0;
      y = drawAccountingTotals(doc, y, totals, "ESTIMATED REFUNDABLE DEPOSIT:");
    }
  }

  // 5. Settlement Notice & Sign-off
  const auditFields = isTransfer
    ? [
        { label: "Total Basis", value: "Rent Adjustment + Additional Security Deposit only" },
        { label: "Electricity / Water", value: "Informational — billed at normal utility period close" },
        { label: "Action Effective", value: formatDate(data.effectiveDate) },
        { label: "Processing Office", value: `${branchLabel} Branch Administration` },
      ]
    : [
        { label: "Estimate Status", value: "Preliminary calculation only" },
        { label: "Final Confirmation", value: "Confirmed upon billing cycle generation" },
        { label: "Action Effective", value: formatDate(data.effectiveDate) },
        { label: "Processing Office", value: `${branchLabel} Branch Administration` },
      ];

  drawAuditAndSignOff(doc, y, auditFields, "Authorized Representative", "Lilycrest Dormitory Management Office");

  // 6. Footer
  drawOfficialFooter(
    doc,
    isTransfer
      ? "Total Immediate Due = Rent Adjustment + Additional Security Deposit, using the canonical server settlement preview. Electricity and water are shown for information only and are billed once during their normal utility period close."
      : "All amounts shown are preliminary estimates. Final charges are confirmed at billing generation time.",
  );

  return doc;
}

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

export async function viewSettlementReceiptPDF(data) {
  const doc = await buildSettlementDoc(data);
  const typeSlug = data.type === "transfer" ? "Transfer Estimate" : "Move-Out Estimate";
  openReceiptInTab(doc, `${typeSlug} - ${data.tenantName || "Tenant"}`);
}

// ==========================================================================
// 7. UTILITY STATEMENT PDF
// ==========================================================================

export async function generateUtilityStatementPDF(data) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logoData = await loadImageAsDataURL(defaultLogo);

  const utilityLabel = data.utilityType === "water" ? "Water" : "Electricity";
  const unit = data.utilityType === "water" ? "cu.m." : "kWh";
  const branchLabel = data.branch || "Lilycrest";
  const roomName = data.roomName || "Room";

  // 1. Header
  let y = drawOfficialHeader(
    doc,
    logoData,
    branchLabel,
    `${utilityLabel.toUpperCase()} UTILITY STATEMENT`,
    `UTIL-${roomName.replace(/\s+/g, "")}-${Date.now().toString().slice(-6)}`,
    formatDateTime(new Date()),
    "STATEMENT GENERATED",
    { noLabel: "STATEMENT NO" }
  );

  // 2. Meter Details
  const leftFields = [
    { value: `${roomName} (${branchLabel})`, isHeader: true },
    { label: "Billing Cycle", value: `${formatDate(data.startDate)} – ${formatDate(data.endDate)}` },
    { label: "Utility Type", value: `${utilityLabel} Consumption` },
  ];

  const rightFields = [
    { value: `Total Usage: ${fmtAmt(data.kwhUsage)} ${unit}`, isHeader: true },
    { label: "Initial Meter", value: `${fmtAmt(data.startReading)} ${unit}` },
    { label: "Final Meter", value: `${fmtAmt(data.endReading)} ${unit}` },
    { label: "Unit Rate", value: `PHP ${fmtAmt(data.ratePerUnit)} / ${unit}` },
  ];

  y = drawTwoColumnParties(
    doc,
    y,
    "Room & Utility Period",
    leftFields,
    "Meter Readings & Rate",
    rightFields
  );

  // 3. Itemized Tenant Splits
  const splits = Array.isArray(data.tenantSplits) ? data.tenantSplits : [];
  const tableItems = splits.map((t) => ({
    title: `${t.name || "Tenant"} (${t.bed || "Bed Space"})`,
    subtext: t.isProRata ? `Prorated occupancy share: ${t.daysInCycle || 0} active days in cycle.` : "Full monthly billing cycle share.",
    qty: 1,
    unitPrice: t.shareAmount || 0,
    amount: t.shareAmount || 0,
  }));

  if (tableItems.length === 0) {
    tableItems.push({
      title: "Room Utility Total",
      subtext: `Total consumption for ${roomName}`,
      qty: 1,
      unitPrice: data.totalCost || 0,
      amount: data.totalCost || 0,
    });
  }

  y = drawItemizedTable(doc, y, tableItems, "TENANT PRO-RATA COST ALLOCATION");

  // 4. Totals
  const totals = [
    { label: "Total Room Consumption:", amount: data.totalCost || 0 },
    { label: "VAT / Tax (Exempt):", amount: 0 },
  ];
  totals.mainTotal = data.totalCost || 0;

  y = drawAccountingTotals(doc, y, totals, "TOTAL ROOM CHARGE:");

  // 5. Audit & Sign Off
  const auditFields = [
    { label: "Utility Category", value: utilityLabel },
    { label: "Active Tenants", value: `${splits.length} resident(s)` },
    { label: "Computation", value: "Verified pro-rata allocation" },
    { label: "Status", value: "Ready for billing integration" },
  ];

  drawAuditAndSignOff(doc, y, auditFields, "Authorized Representative", "Lilycrest Dormitory Engineering & Billing");

  // 6. Footer
  drawOfficialFooter(doc, "Official utility statement generated for Lilycrest Dormitory management & resident records.");

  const slug = roomName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  doc.save(`Lilycrest_Utility_Statement_${slug}_${data.utilityType || "utility"}.pdf`);
}