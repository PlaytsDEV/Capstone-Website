import crypto from "node:crypto";
import { CANONICAL_RESERVATION_STATUSES } from "../../utils/lifecycleNaming.js";
import { ROOM_BRANCHES } from "../../config/branches.js";

export const MONEY_TOLERANCE = 0.01;
export const SUCCESSFUL_PAYMENT_STATUSES = new Set(["approved", "paid", "confirmed"]);
export const ACTIVE_RESERVATION_STATUSES = new Set([
  "pending", "viewing_preference_selected", "visit_pending", "visit_approved",
  "pending_application_review", "needs_revision", "approved_for_payment",
  "payment_pending", "reserved", "moveIn",
]);
export const MUTATION_WORDS = Object.freeze([
  "fix", "repair", "apply", "migrate", "delete", "update", "insert", "upsert",
  "save", "write", "bulk-write", "bulk_write", "replace", "merge", "out",
]);

const id = (value) => value == null ? null : String(value);
const keyById = (rows = []) => new Map(rows.map((row) => [id(row._id), row]));
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const dateValue = (value) => value ? new Date(value) : null;
const isArchived = (row) => Boolean(row?.isArchived || row?.archivedAt);
const hasId = (map, value) => value != null && map.has(id(value));
const branchOfReservation = (reservation, rooms) => rooms.get(id(reservation.roomId))?.branch || reservation.branch || null;
const groupBy = (rows, toKey) => {
  const groups = new Map();
  for (const row of rows) {
    const key = toKey(row);
    if (key == null || key === "") continue;
    const bucket = groups.get(key) || [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  return groups;
};

export function assertReportOnlyArgs(args = []) {
  const normalized = args.map((arg) => String(arg).trim().toLowerCase());
  for (const arg of normalized) {
    const token = arg.replace(/^--/, "").split("=")[0];
    if (MUTATION_WORDS.some((word) => token === word || token.startsWith(`${word}-`))) {
      throw new Error(`Unsupported mutation option: ${arg}`);
    }
  }
  const allowed = new Set(["--report-only", "--metadata-only"]);
  for (const arg of normalized) {
    if (!allowed.has(arg)) throw new Error(`Unsupported audit option: ${arg}`);
  }
  if (!normalized.includes("--report-only")) {
    throw new Error("The audit requires --report-only.");
  }
  return { reportOnly: true, metadataOnly: normalized.includes("--metadata-only") };
}

export function fingerprint(value, namespace = "lilycrest-phase-0") {
  if (value == null || value === "") return null;
  return crypto.createHash("sha256").update(`${namespace}:${String(value)}`).digest("hex").slice(0, 12);
}

export function maskEmail(value) {
  const email = String(value || "").trim();
  const at = email.indexOf("@");
  if (at < 1) return email ? "***" : null;
  return `${email[0]}***${email.slice(at)}`;
}

export function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `${"*".repeat(Math.max(6, digits.length - 4))}${digits.slice(-4)}` : null;
}

export const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
export const moneyEqual = (left, right, tolerance = MONEY_TOLERANCE) => {
  if (finite(left) === null || finite(right) === null) return false;
  return Math.abs(roundMoney(left) - roundMoney(right)) <= tolerance + 1e-9;
};

export function classifyEnvironment({ environmentName, hostCategory, databaseName, privilegeAssessment, explicitlyAuthorized = false }) {
  const env = String(environmentName || "").toLowerCase();
  const database = String(databaseName || "").toLowerCase();
  const safeName = /(^|[-_])(test|testing|staging|stage|sandbox|disposable)([-_]|$)/.test(database);
  const local = hostCategory === "local";
  const production = env === "production" || /(^|[-_])prod(uction)?([-_]|$)/.test(database);
  const readOnly = privilegeAssessment === "read-only";
  const unrestricted = privilegeAssessment === "write-capable" || privilegeAssessment === "unknown";

  if (production && !(explicitlyAuthorized && readOnly)) {
    return { safe: false, category: "operational-or-production", reason: "Production inspection requires explicit authorization and proven read-only credentials." };
  }
  if ((local || safeName) && readOnly) return { safe: true, category: local ? "local" : "non-production", reason: "Target identity and read-only privileges are established." };
  if ((local || safeName) && privilegeAssessment === "unavailable") {
    return { safe: false, category: local ? "local-unverified" : "non-production-unverified", reason: "Database privileges could not be established as read-only." };
  }
  if (!local && !safeName && unrestricted) {
    return { safe: false, category: "operational-unverified", reason: "Remote database identity is not demonstrably disposable and credentials are not proven read-only." };
  }
  if (!local && !safeName && readOnly && explicitlyAuthorized) {
    return { safe: true, category: "operational-read-only-authorized", reason: "Remote inspection was explicitly authorized and credentials are read-only." };
  }
  return { safe: false, category: "unknown", reason: "Database safety was not independently established." };
}

function paymentSuccessful(payment) {
  return SUCCESSFUL_PAYMENT_STATUSES.has(String(payment?.status || "").toLowerCase());
}

function contractReadiness(contract) {
  if (!contract) return "no_contract";
  if (contract.status === "draft" || contract.status === "incomplete") return "draft";
  if (!contract.pricingApprovedAt) return "pricing_not_approved";
  if (!["signed", "awaiting_notarization", "notarized", "ready_for_publication", "published", "active"].includes(contract.status)) return "prepared_not_signed";
  if (!contract.signedUploadedAt && !(contract.signedDocuments || []).length) return "prepared_not_signed";
  if (!["notarized", "ready_for_publication", "published", "active"].includes(contract.status)) return "signed_not_notarized";
  if (!contract.notarizedUploadedAt && !(contract.notarizedDocuments || []).length) return "signed_not_notarized";
  if (!["published", "active"].includes(contract.status) || !contract.publishedAt) return "notarized_not_published";
  return "fully_ready";
}

function analyzePricing(contract, reservation, room, settings) {
  const issues = [];
  const approvedRate = finite(contract.approvedMonthlyRate);
  const reservationRate = finite(reservation?.monthlyRent ?? reservation?.totalPrice);
  const regular = finite(contract.regularMonthlyRate);
  const percentage = finite(contract.discountPercentage);
  const discount = finite(contract.discountAmount);
  const expectedDiscount = regular !== null && percentage !== null ? roundMoney(regular * percentage / 100) : null;
  const expectedApproved = regular !== null && discount !== null ? roundMoney(regular - discount) : null;
  if (reservationRate === null || approvedRate === null) issues.push("required_monthly_rate_missing");
  else if (!moneyEqual(approvedRate, reservationRate)) issues.push("contract_reservation_monthly_rent_mismatch");
  if (expectedDiscount === null || discount === null || !moneyEqual(expectedDiscount, discount)) issues.push("discount_amount_does_not_reconcile");
  if (expectedApproved === null || approvedRate === null || !moneyEqual(expectedApproved, approvedRate)) issues.push("approved_rate_does_not_reconcile");
  if (percentage === 0 && (discount !== 0 || (regular !== null && !moneyEqual(regular, approvedRate)))) issues.push("zero_percent_discount_inconsistent");
  const liveRegular = contract.leaseType === "long_term" ? finite(room?.regularLongRate) : finite(room?.regularShortRate);
  if (liveRegular !== null && regular !== null && moneyEqual(liveRegular, regular) && room?.updatedAt && contract?.createdAt && new Date(room.updatedAt) > new Date(contract.createdAt)) {
    issues.push("matches_later_live_room_pricing_possible_drift");
  }
  const fee = finite(reservation?.reservationFeeAmount);
  if (fee !== null && !moneyEqual(fee, 2000)) issues.push("reservation_fee_differs_from_2000_assumption");
  if (fee !== null && finite(contract.reservationFeeAmount) !== null && !moneyEqual(fee, contract.reservationFeeAmount)) issues.push("reservation_fee_mismatch");
  if (approvedRate !== null && finite(contract.securityDepositAmount) !== null) {
    if (moneyEqual(contract.securityDepositAmount, approvedRate)) issues.push("security_deposit_based_on_discounted_rent");
    else if (regular !== null && moneyEqual(contract.securityDepositAmount, regular)) issues.push("security_deposit_based_on_regular_rent");
    else issues.push("security_deposit_basis_unclear");
  }
  if (settings?.updatedAt && reservation?.approvedForPaymentAt && new Date(settings.updatedAt) > new Date(reservation.approvedForPaymentAt)) issues.push("business_settings_changed_after_approval");
  if (reservation && id(contract.roomId) !== id(reservation.roomId)) issues.push("contract_reservation_room_mismatch");
  if (room && contract.roomType && contract.roomType !== room.type) issues.push("contract_room_type_mismatch");
  if (reservation?.selectedBed?.id && contract.bedId && String(reservation.selectedBed.id) !== String(contract.bedId)) issues.push("contract_reservation_bed_mismatch");
  if (finite(reservation?.leaseDuration) !== null && finite(contract.leaseDurationMonths) !== null && finite(reservation.leaseDuration) !== finite(contract.leaseDurationMonths)) issues.push("contract_reservation_lease_duration_mismatch");
  return issues;
}

function classifyNonCanonicalStatus(status) {
  if (status == null || status === "") return "corrupt";
  if (["approved", "completed", "active", "checked_in", "checked-in", "moved_in", "moved_out"].includes(String(status).toLowerCase())) return "legacy";
  return "unknown";
}

function issue(category, relation, source, target, impact, extra = {}) {
  return { category, relation, sourceId: id(source?._id ?? source), targetId: id(target?._id ?? target), impact, ...extra };
}

export function analyzeAuditDataset(dataset = {}, { now = new Date() } = {}) {
  const data = {
    reservations: dataset.reservations || [], contracts: dataset.contracts || [], bills: dataset.bills || [],
    payments: dataset.payments || [], rooms: dataset.rooms || [], users: dataset.users || [],
    stays: dataset.stays || [], settings: dataset.settings || [], auditLogs: dataset.auditLogs || [],
    webhookEvents: dataset.webhookEvents || [], notifications: dataset.notifications || [], collectionWarnings: dataset.collectionWarnings || [], indexes: dataset.indexes || {},
  };
  const rooms = keyById(data.rooms); const users = keyById(data.users); const reservations = keyById(data.reservations);
  const stays = keyById(data.stays); const bills = keyById(data.bills); const contracts = keyById(data.contracts);
  const paymentsByReservation = groupBy(data.payments, (p) => id(p.reservationId));
  const paymentsByBill = groupBy(data.payments, (p) => id(p.billId));
  const contractsByReservation = groupBy(data.contracts, (c) => id(c.reservationId));
  const staysByReservation = groupBy(data.stays, (s) => id(s.reservationId));
  const latestSettings = [...data.settings].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;

  const nonCanonicalStatuses = data.reservations.filter((r) => !CANONICAL_RESERVATION_STATUSES.includes(r.status)).map((r) => ({
    reservationId: id(r._id), userFingerprint: fingerprint(r.userId), branch: branchOfReservation(r, rooms), roomId: id(r.roomId),
    currentStatus: r.status ?? null, createdAt: r.createdAt || null, updatedAt: r.updatedAt || null,
    frontendCanRepresent: false, schemaAccepts: false,
    classification: classifyNonCanonicalStatus(r.status), requiresAdminReview: true,
  }));

  const expiredPaymentHolds = data.reservations.filter((r) => {
    if (!["approved_for_payment", "payment_pending"].includes(r.status)) return false;
    const expires = dateValue(r.paymentExpiresAt);
    const successful = (paymentsByReservation.get(id(r._id)) || []).some(paymentSuccessful);
    return expires && expires < now && r.paymentStatus !== "paid" && !successful && !isArchived(r);
  }).map((r) => {
    const room = rooms.get(id(r.roomId));
    const bed = room?.beds?.find((entry) => String(entry.id) === String(r.selectedBed?.id));
    const expiredMs = now.getTime() - new Date(r.paymentExpiresAt).getTime();
    return {
      reservationId: id(r._id), branch: branchOfReservation(r, rooms), roomId: id(r.roomId), bedId: r.selectedBed?.id || null,
      status: r.status, paymentStatus: r.paymentStatus || null, paymentExpiresAt: r.paymentExpiresAt,
      hoursExpired: Math.floor(expiredMs / 3_600_000), daysExpired: Math.floor(expiredMs / 86_400_000),
      inventoryStillHeld: ["reserved", "occupied", "locked"].includes(bed?.status) || id(bed?.occupiedBy?.reservationId) === id(r._id),
      checkoutSessionExists: Boolean(r.paymongoSessionId), successfulPaymentExists: false,
      currentExpirationServiceEligible: ["approved_for_payment", "approved", "pending", "pending_application_review"].includes(r.status) && r.paymentStatus === "pending",
    };
  });

  const inventoryHoldAudit = expiredPaymentHolds.map((hold) => {
    const room = rooms.get(hold.roomId); const bed = room?.beds?.find((entry) => String(entry.id) === String(hold.bedId));
    const competingReservations = data.reservations.filter((r) => id(r._id) !== hold.reservationId && id(r.roomId) === hold.roomId && String(r.selectedBed?.id) === String(hold.bedId) && ACTIVE_RESERVATION_STATUSES.has(r.status) && !isArchived(r));
    const linkedStays = data.stays.filter((s) => id(s.roomId) === hold.roomId && String(s.bedId) === String(hold.bedId) && ["active", "ending_soon"].includes(s.status));
    const reservationIndexes = data.indexes.reservations || [];
    const uniqueIndexPresent = reservationIndexes.some((index) => index.unique && index.key?.roomId === 1 && index.key?.["selectedBed.id"] === 1);
    return { ...hold, roomState: room?.available === false ? "unavailable" : "available", bedState: bed?.status || "missing", competingActiveReservations: competingReservations.length, activeStays: linkedStays.length, uniqueIndexPresent, uniqueIndexSatisfied: competingReservations.length === 0, releaseWouldCreateInconsistency: linkedStays.length > 0 || competingReservations.length > 0 };
  });

  const moveInContractAudit = data.reservations.filter((r) => r.status === "moveIn" && !isArchived(r)).flatMap((r) => {
    const linked = contractsByReservation.get(id(r._id)) || [];
    if (!linked.length) return [{ reservationId: id(r._id), branch: branchOfReservation(r, rooms), moveInDate: r.confirmedMoveInDate || r.moveInDate || null, contractId: null, contractNumber: null, contractStatus: null, readiness: "no_contract", signed: false, notarized: false, published: false, currentMoveInBlockersChecksContract: false, classification: "critical_admin_review" }];
    return linked.map((c) => ({ reservationId: id(r._id), branch: branchOfReservation(r, rooms), moveInDate: r.confirmedMoveInDate || r.moveInDate || null, contractId: id(c._id), contractNumber: c.contractNumber || null, contractStatus: c.status || null, readiness: contractReadiness(c), signed: Boolean(c.signedUploadedAt || c.signedDocuments?.length), notarized: Boolean(c.notarizedUploadedAt || c.notarizedDocuments?.length), published: Boolean(c.publishedAt), currentMoveInBlockersChecksContract: false, multipleContracts: linked.length > 1, classification: contractReadiness(c) === "fully_ready" && linked.length === 1 ? "ready" : "admin_review" }));
  });

  const contractPricingReconciliation = data.contracts.map((c) => {
    const reservation = reservations.get(id(c.reservationId)); const room = rooms.get(id(c.roomId));
    const issues = analyzePricing(c, reservation, room, latestSettings);
    return { contractId: id(c._id), reservationId: id(c.reservationId), branch: c.branch || null, roomId: id(c.roomId), bedId: c.bedId || reservation?.selectedBed?.id || null, leaseType: c.leaseType || null, leaseDurationMonths: c.leaseDurationMonths || null, regularMonthlyRate: c.regularMonthlyRate ?? null, approvedMonthlyRate: c.approvedMonthlyRate ?? null, reservationMonthlyRent: reservation?.monthlyRent ?? reservation?.totalPrice ?? null, discountPercentage: c.discountPercentage ?? null, discountAmount: c.discountAmount ?? null, reservationFeeAmount: c.reservationFeeAmount ?? null, advanceRentAmount: c.advanceRentAmount ?? null, securityDepositAmount: c.securityDepositAmount ?? null, applianceFees: reservation?.applianceFees ?? null, issues, mismatch: issues.some((value) => !["security_deposit_based_on_discounted_rent", "security_deposit_based_on_regular_rent", "business_settings_changed_after_approval"].includes(value)) };
  }).filter((row) => row.issues.length);

  const orphanedRecords = [];
  for (const r of data.reservations) {
    if (!hasId(users, r.userId)) orphanedRecords.push(issue("orphan", "reservation.user", r, r.userId, "Applicant identity cannot be resolved."));
    const room = rooms.get(id(r.roomId));
    if (!room) orphanedRecords.push(issue("orphan", "reservation.room", r, r.roomId, "Room and branch cannot be resolved."));
    else if (r.selectedBed?.id && !room.beds?.some((bed) => String(bed.id) === String(r.selectedBed.id))) orphanedRecords.push(issue("broken_reference", "reservation.selectedBed", r, r.selectedBed.id, "Selected bed is not present in the room."));
    if (r.currentStayId && !hasId(stays, r.currentStayId)) orphanedRecords.push(issue("orphan", "reservation.currentStay", r, r.currentStayId, "Current stay cannot be resolved."));
    if (!isArchived(r) && (isArchived(users.get(id(r.userId))) || isArchived(rooms.get(id(r.roomId))))) orphanedRecords.push(issue("archived_parent", "active_reservation.archived_parent", r, r.userId, "Active Reservation links to an archived User or Room."));
  }
  for (const c of data.contracts) {
    if (!hasId(reservations, c.reservationId)) orphanedRecords.push(issue("orphan", "contract.reservation", c, c.reservationId, "Contract source reservation cannot be resolved."));
    if (!hasId(users, c.tenantId)) orphanedRecords.push(issue("orphan", "contract.tenant", c, c.tenantId, "Contract tenant cannot be resolved."));
    if (!hasId(rooms, c.roomId)) orphanedRecords.push(issue("orphan", "contract.room", c, c.roomId, "Contract room cannot be resolved."));
    if (c.stayId && !hasId(stays, c.stayId)) orphanedRecords.push(issue("orphan", "contract.stay", c, c.stayId, "Contract stay cannot be resolved."));
    if (!ROOM_BRANCHES.includes(c.branch)) orphanedRecords.push(issue("broken_reference", "contract.branch", c, c.branch, "Contract branch is missing or non-canonical."));
    if (!isArchived(c) && (isArchived(users.get(id(c.tenantId))) || isArchived(rooms.get(id(c.roomId))) || isArchived(reservations.get(id(c.reservationId))))) orphanedRecords.push(issue("archived_parent", "active_contract.archived_parent", c, c.reservationId, "Active Contract links to an archived parent."));
  }
  for (const b of data.bills) {
    if (b.reservationId && !hasId(reservations, b.reservationId)) orphanedRecords.push(issue("orphan", "bill.reservation", b, b.reservationId, "Bill reservation cannot be resolved."));
    if (!hasId(users, b.userId)) orphanedRecords.push(issue("orphan", "bill.user", b, b.userId, "Bill user cannot be resolved."));
    if (b.roomId && !hasId(rooms, b.roomId)) orphanedRecords.push(issue("orphan", "bill.room", b, b.roomId, "Bill room cannot be resolved."));
    if (b.stayId && !hasId(stays, b.stayId)) orphanedRecords.push(issue("orphan", "bill.stay", b, b.stayId, "Bill stay cannot be resolved."));
    if (!isArchived(b) && (isArchived(users.get(id(b.userId))) || isArchived(rooms.get(id(b.roomId))) || isArchived(reservations.get(id(b.reservationId))))) orphanedRecords.push(issue("archived_parent", "active_bill.archived_parent", b, b.reservationId || b.userId, "Active Bill links to an archived parent."));
  }
  for (const p of data.payments) {
    if (!p.billId && !p.reservationId) orphanedRecords.push(issue("orphan", "payment.target", p, null, "Payment has no Bill or Reservation target."));
    if (p.billId && !hasId(bills, p.billId)) orphanedRecords.push(issue("orphan", "payment.bill", p, p.billId, "Payment Bill target cannot be resolved."));
    if (p.reservationId && !hasId(reservations, p.reservationId)) orphanedRecords.push(issue("orphan", "payment.reservation", p, p.reservationId, "Payment Reservation target cannot be resolved."));
    if (!hasId(users, p.tenantId)) orphanedRecords.push(issue("orphan", "payment.tenant", p, p.tenantId, "Payment tenant cannot be resolved."));
  }
  for (const s of data.stays) {
    if (!hasId(reservations, s.reservationId)) orphanedRecords.push(issue("orphan", "stay.reservation", s, s.reservationId, "Stay Reservation cannot be resolved."));
    if (!hasId(users, s.tenantId)) orphanedRecords.push(issue("orphan", "stay.tenant", s, s.tenantId, "Stay tenant cannot be resolved."));
    const room = rooms.get(id(s.roomId));
    if (!room) orphanedRecords.push(issue("orphan", "stay.room", s, s.roomId, "Stay room cannot be resolved."));
    else if (s.bedId && !room.beds?.some((bed) => String(bed.id) === String(s.bedId))) orphanedRecords.push(issue("broken_reference", "stay.bed", s, s.bedId, "Stay bed is not present in the room."));
  }
  for (const room of data.rooms) if (!ROOM_BRANCHES.includes(room.branch)) orphanedRecords.push(issue("broken_reference", "room.branch", room, room.branch, "Room branch is not canonical."));

  const paymentReconciliation = data.payments.flatMap((p) => {
    const rows = []; const target = p.billId ? bills.get(id(p.billId)) : reservations.get(id(p.reservationId));
    const external = Boolean(p.externalPaymentId || p.externalSessionId || p.paymentReference);
    const localPaid = p.billId ? target?.status === "paid" && finite(target?.remainingAmount) === 0 : target?.paymentStatus === "paid";
    let reason = null;
    if (["amount_mismatch", "reconciliation_required"].includes(p.status)) reason = p.status;
    else if (paymentSuccessful(p) && !localPaid) reason = "successful_payment_without_local_settlement";
    else if (localPaid && !external && !["admin-manual", "manual_admin", "manual_proof", "tenant-proof"].includes(p.source)) reason = "local_paid_without_external_reference";
    if (reason) rows.push({ paymentId: id(p._id), externalReferenceFingerprint: fingerprint(p.externalPaymentId || p.externalSessionId || p.paymentReference), targetType: p.billId ? "bill" : "reservation", targetId: id(p.billId || p.reservationId), amount: p.amount ?? null, currency: p.currency || null, status: p.status || null, createdAt: p.createdAt || null, updatedAt: p.updatedAt || null, reconciliationReason: reason, targetMarkedPaid: localPaid, auditLogExists: data.auditLogs.some((log) => String(log.entityId) === id(p._id)), reviewCategory: "manual_financial_reconciliation" });
    return rows;
  });
  for (const event of data.webhookEvents.filter((e) => e.processingStatus === "failed")) paymentReconciliation.push({ paymentId: null, externalReferenceFingerprint: fingerprint(event.eventId), targetType: "paymongo_event", targetId: null, amount: null, currency: null, status: event.processingStatus, createdAt: event.createdAt || event.receivedAt || null, updatedAt: event.updatedAt || null, reconciliationReason: "failed_webhook_processing", targetMarkedPaid: null, auditLogExists: false, reviewCategory: "external_success_state_unknown_manual_review" });
  for (const [billId, rows] of paymentsByBill) {
    const bill = bills.get(billId); const successful = rows.filter(paymentSuccessful); const totalPaid = roundMoney(successful.reduce((sum, payment) => sum + (finite(payment.amount) || 0), 0));
    if (bill && successful.length > 1 && finite(bill.totalAmount) !== null && totalPaid > roundMoney(bill.totalAmount) + MONEY_TOLERANCE) paymentReconciliation.push({ paymentId: successful.map((p) => id(p._id)).sort().join("|"), externalReferenceFingerprint: null, targetType: "bill", targetId: billId, amount: totalPaid, currency: successful[0]?.currency || "PHP", status: "multiple_successful", createdAt: successful.map((p) => p.createdAt).filter(Boolean).sort()[0] || null, updatedAt: null, reconciliationReason: "successful_payments_exceed_bill_total", targetMarkedPaid: bill.status === "paid", auditLogExists: false, reviewCategory: "possible_overpayment" });
  }

  const billingOrphans = data.bills.flatMap((b) => {
    const problems = []; const total = finite(b.totalAmount); const remaining = finite(b.remainingAmount); const paid = finite(b.paidAmount ?? b.amountPaid) || 0;
    if (!b.reservationId && !b.userId) problems.push("no_reservation_or_tenant");
    if (remaining !== null && remaining < 0) problems.push("negative_remaining_amount");
    if (remaining !== null && total !== null && remaining > total + MONEY_TOLERANCE) problems.push("remaining_exceeds_total");
    if (b.status === "paid" && remaining !== null && remaining > MONEY_TOLERANCE) problems.push("paid_with_nonzero_balance");
    if (["pending", "unpaid", "overdue"].includes(b.status) && remaining !== null && Math.abs(remaining) <= MONEY_TOLERANCE) problems.push("unpaid_with_zero_balance");
    const chargeTotal = b.charges ? roundMoney(
      ["rent", "electricity", "water", "applianceFees", "corkageFees", "penalty"].reduce((sum, key) => sum + (finite(b.charges?.[key]) || 0), 0)
      + (b.additionalCharges || []).reduce((sum, charge) => sum + (finite(charge.amount) || 0), 0)
      - (finite(b.charges?.discount) || 0)
      - (finite(b.reservationCreditApplied) || 0),
    ) : null;
    if (chargeTotal !== null && total !== null && !moneyEqual(chargeTotal, total)) problems.push("stored_charges_do_not_match_total");
    if (total !== null && remaining !== null && !moneyEqual(total - paid, remaining)) problems.push("paid_remaining_total_mismatch");
    return problems.length ? [{ billId: id(b._id), reservationId: id(b.reservationId), userFingerprint: fingerprint(b.userId), branch: b.branch || null, billingMonth: b.billingMonth || null, totalAmount: total, remainingAmount: remaining, status: b.status || null, problems }] : [];
  });

  const branchConsistency = [];
  const compareBranch = (sourceType, source, targetType, target, sourceBranch, targetBranch) => {
    if (sourceBranch && targetBranch && sourceBranch !== targetBranch) branchConsistency.push({ sourceType, sourceId: id(source._id), targetType, targetId: id(target._id), sourceBranch, targetBranch });
  };
  for (const r of data.reservations) { const room = rooms.get(id(r.roomId)); compareBranch("reservation", r, "room", room || r.roomId, r.branch, room?.branch); }
  for (const c of data.contracts) { const r = reservations.get(id(c.reservationId)); const room = rooms.get(id(c.roomId)); compareBranch("contract", c, "room", room || c.roomId, c.branch, room?.branch); if (r) compareBranch("contract", c, "reservation-room", r, c.branch, branchOfReservation(r, rooms)); }
  for (const b of data.bills) { const room = rooms.get(id(b.roomId)); if (room) compareBranch("bill", b, "room", room, b.branch, room.branch); const stay = stays.get(id(b.stayId)); if (stay) compareBranch("bill", b, "stay", stay, b.branch, stay.branch); }
  for (const p of data.payments) { const target = p.billId ? bills.get(id(p.billId)) : reservations.get(id(p.reservationId)); const targetBranch = p.billId ? target?.branch : target ? branchOfReservation(target, rooms) : null; if (target) compareBranch("payment", p, p.billId ? "bill" : "reservation", target, p.branch, targetBranch); }
  for (const b of data.bills) { const tenant = users.get(id(b.userId)); if (tenant?.branch) compareBranch("bill", b, "tenant", tenant, b.branch, tenant.branch); }
  for (const s of data.stays) { const room = rooms.get(id(s.roomId)); if (room) compareBranch("stay", s, "room", room, s.branch, room.branch); const tenant = users.get(id(s.tenantId)); if (tenant?.branch) compareBranch("stay", s, "tenant", tenant, s.branch, tenant.branch); }
  for (const log of data.auditLogs) { const actor = users.get(id(log.userId)); if (actor?.branch && log.branch && !["general", ""].includes(log.branch)) compareBranch("audit_log", log, "actor", actor, log.branch, actor.branch); }

  const duplicateRiskIndicators = [];
  const addDuplicates = (category, groups) => { for (const [key, rows] of groups) if (rows.length > 1) duplicateRiskIndicators.push({ category, keyFingerprint: fingerprint(key), count: rows.length, recordIds: rows.map((row) => id(row._id)).sort() }); };
  addDuplicates("multiple_active_reservations_per_user", groupBy(data.reservations.filter((r) => ACTIVE_RESERVATION_STATUSES.has(r.status) && !isArchived(r)), (r) => id(r.userId)));
  addDuplicates("multiple_active_reservations_per_bed", groupBy(data.reservations.filter((r) => ACTIVE_RESERVATION_STATUSES.has(r.status) && !isArchived(r) && r.selectedBed?.id), (r) => `${id(r.roomId)}:${r.selectedBed.id}`));
  addDuplicates("multiple_active_contracts_per_reservation", groupBy(data.contracts.filter((c) => c.isCurrent !== false && !isArchived(c)), (c) => id(c.reservationId)));
  addDuplicates("multiple_active_contracts_per_stay", groupBy(data.contracts.filter((c) => c.isCurrent !== false && !isArchived(c) && c.stayId), (c) => id(c.stayId)));
  addDuplicates("duplicate_successful_reservation_fee_payments", groupBy(data.payments.filter((p) => paymentSuccessful(p) && p.purpose === "reservation_deposit"), (p) => id(p.reservationId)));
  addDuplicates("duplicate_external_payment_references", groupBy(data.payments.filter((p) => p.externalPaymentId), (p) => p.externalPaymentId));
  addDuplicates("duplicate_billing_period", groupBy(data.bills.filter((b) => !isArchived(b)), (b) => `${id(b.reservationId || b.userId)}:${String(b.billingCycleStart || b.billingMonth || "")}:${b.billType || ""}`));
  addDuplicates("reservation_credit_applied_multiple_times", groupBy(data.bills.filter((b) => (finite(b.reservationCreditApplied) || 0) > 0), (b) => id(b.reservationId)));
  addDuplicates("duplicate_webhook_event_id", groupBy(data.webhookEvents, (e) => e.eventId));
  const nearDuplicateLogs = groupBy(data.auditLogs, (log) => `${id(log.userId)}:${log.action || ""}:${log.entityType || ""}:${log.entityId || ""}`);
  for (const [key, rows] of nearDuplicateLogs) {
    const sorted = [...rows].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    if (sorted.some((row, index) => index > 0 && new Date(row.timestamp) - new Date(sorted[index - 1].timestamp) <= 5_000)) duplicateRiskIndicators.push({ category: "repeated_admin_action_within_5_seconds", keyFingerprint: fingerprint(key), count: rows.length, recordIds: rows.map((row) => id(row._id)).sort() });
  }
  addDuplicates("duplicate_notifications", groupBy(data.notifications, (n) => `${id(n.userId)}:${n.type || ""}:${n.entityType || ""}:${n.entityId || ""}:${new Date(n.createdAt || 0).toISOString().slice(0, 16)}`));

  const financialEvidence = [];
  for (const b of data.bills) {
    const serialized = JSON.stringify({ billType: b.billType, description: b.description, items: b.additionalCharges, charges: b.charges }).toLowerCase();
    if (serialized.includes("advance rent")) financialEvidence.push({ evidenceType: "bill_advance_rent", recordId: id(b._id), branch: b.branch || null });
    if (serialized.includes("security deposit")) financialEvidence.push({ evidenceType: "bill_security_deposit", recordId: id(b._id), branch: b.branch || null });
  }
  for (const p of data.payments) {
    const serialized = JSON.stringify({ purpose: p.purpose, metadata: p.metadata, notes: p.notes }).toLowerCase();
    if (serialized.includes("advance rent")) financialEvidence.push({ evidenceType: "payment_advance_rent", recordId: id(p._id), branch: p.branch || null, source: p.source || null });
    if (serialized.includes("security deposit")) financialEvidence.push({ evidenceType: "payment_security_deposit", recordId: id(p._id), branch: p.branch || null, source: p.source || null });
  }
  for (const c of data.contracts) if ((finite(c.advanceRentAmount) || 0) > 0 || (finite(c.securityDepositAmount) || 0) > 0) financialEvidence.push({ evidenceType: "contract_amounts", recordId: id(c._id), branch: c.branch || null, hasAdvanceRent: (finite(c.advanceRentAmount) || 0) > 0, hasSecurityDeposit: (finite(c.securityDepositAmount) || 0) > 0 });
  for (const r of data.reservations) if (r.depositRefundProcessedAt || r.depositRefundStatus === "processed") {
    const original = financialEvidence.some((e) => e.evidenceType === "payment_security_deposit" && (paymentsByReservation.get(id(r._id)) || []).some((p) => id(p._id) === e.recordId));
    if (!original) financialEvidence.push({ evidenceType: "deposit_refund_without_traceable_original_payment", recordId: id(r._id), branch: branchOfReservation(r, rooms) });
  }
  const systemCollection = financialEvidence.some((e) => e.evidenceType.startsWith("payment_") && !["admin-manual", "manual_admin", "manual_proof", "tenant-proof"].includes(e.source));
  const manualCollection = financialEvidence.some((e) => e.evidenceType.startsWith("payment_"));
  const advanceDepositConclusion = systemCollection ? "Confirmed system collection path exists" : manualCollection ? "Partial or manual collection evidence exists" : financialEvidence.some((e) => e.evidenceType === "contract_amounts") ? "No system collection evidence found; Contract-only amounts exist" : "No system collection evidence found";

  const categories = { nonCanonicalStatuses, expiredPaymentHolds, inventoryHoldAudit, moveInContractAudit, contractPricingReconciliation, orphanedRecords, paymentReconciliation, billingOrphans, branchConsistency, duplicateRiskIndicators, financialEvidence };
  for (const value of Object.values(categories)) value.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    generatedAt: new Date(now).toISOString(), canonicalReservationStatuses: [...CANONICAL_RESERVATION_STATUSES], moneyTolerance: MONEY_TOLERANCE,
    collectionWarnings: [...data.collectionWarnings].sort(), counts: {
      ...Object.fromEntries(Object.entries(categories).map(([name, rows]) => [name, rows.length])),
      expiredHoldsStillHoldingInventory: inventoryHoldAudit.filter((row) => row.inventoryStillHeld).length,
      moveInsWithoutReadyContracts: moveInContractAudit.filter((row) => row.readiness !== "fully_ready").length,
      contractPricingMismatches: contractPricingReconciliation.filter((row) => row.mismatch).length,
      reconciliationRequiredPayments: paymentReconciliation.length,
      branchMismatches: branchConsistency.length,
    },
    advanceDepositConclusion, ...categories,
  };
}
