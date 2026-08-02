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

export const CASH_METHOD_PATTERN = /(^|[_\s-])(cash|petty[_\s-]?cash|counter[_\s-]?payment|walk[_\s-]?in[_\s-]?cash|cash[_\s-]?(payment|on[_\s-]?hand|at[_\s-]?branch|on[_\s-]?move[_\s-]?in))($|[_\s-])/i;
export const INVALID_PROOF_STATUSES = new Set(["pending", "processing", "being_processed", "scheduled", "queued", "failed", "cancelled"]);

export const isCashMethod = (value) => CASH_METHOD_PATTERN.test(String(value || "").trim().replaceAll("-", "_"));

export function expectedCorePenalty(dueDateInput, evaluationDate = new Date(), ratePerDay = 50) {
  const dueDate = dateValue(dueDateInput); const evaluated = dateValue(evaluationDate);
  if (!dueDate || !evaluated) return { penaltyStartDate: null, penaltyDays: null, expectedPenalty: null };
  const dueDay = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const evaluationDay = Date.UTC(evaluated.getUTCFullYear(), evaluated.getUTCMonth(), evaluated.getUTCDate());
  const penaltyStart = dueDay + 2 * 86_400_000;
  const penaltyDays = evaluationDay < penaltyStart ? 0 : Math.floor((evaluationDay - penaltyStart) / 86_400_000) + 1;
  return { penaltyStartDate: new Date(penaltyStart).toISOString(), penaltyDays, expectedPenalty: roundMoney(penaltyDays * ratePerDay) };
}

export function periodsOverlap(startA, endA, startB, endB) {
  const values = [startA, endA, startB, endB].map(dateValue);
  if (values.some((value) => !value || Number.isNaN(value.getTime()))) return null;
  return values[0] < values[3] && values[2] < values[1];
}

export function expectedLeaseType(duration) {
  const months = finite(duration);
  if (months === null) return "missing";
  if (months >= 1 && months <= 5) return "short_term";
  if (months >= 6 && months <= 12) return "long_term";
  return "unsupported";
}

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

function contractPolicyState(contract, reservation) {
  if (!contract) return "No Contract";
  if (contract.archivedAt || contract.status === "archived") return "Archived";
  if (["terminated", "cancelled", "voided", "rejected"].includes(contract.status)) return contract.status === "terminated" ? "Terminated" : "Pre-Terminated";
  if (["expired", "renewed"].includes(contract.status)) return "Completed";
  if (contract.status === "active") return "Active";
  if (contract.publishedAt || contract.status === "published") return "Verified";
  if (contract.notarizationVerifiedAt) return "Verified";
  if (contract.notarizedUploadedAt || contract.notarizedDocuments?.length || contract.status === "notarized") return "Notarized";
  if (["awaiting_notarization", "ready_for_publication"].includes(contract.status)) return "Pending Notarization";
  if (contract.signedUploadedAt || contract.signedDocuments?.length || ["signed", "partially_signed"].includes(contract.status)) return "Signed";
  if (contract.printedAt) return "Printed";
  if (contract.generatedAt || contract.generatedVersion > 0 || ["generated", "awaiting_signatures"].includes(contract.status)) return "Ready for Printing";
  if (contract.lastValidatedAt && reservation?.status === "moveIn") return "Ready for Printing";
  if ((contract.preparedDocuments || []).some((document) => !document.superseded)) return reservation?.status === "moveIn" ? "Ready for Validation" : "Waiting for Move-In";
  if (["ready_for_generation"].includes(contract.status)) return "Prepared";
  if (["draft", "incomplete"].includes(contract.status)) return "Draft";
  return "Unknown current repository state";
}

const hasSuccessfulReference = (payment) => Boolean(payment?.externalPaymentId || payment?.externalSessionId || payment?.paymentReference || payment?.referenceNumber);
const isVerifiedPayment = (payment) => paymentSuccessful(payment) && (Boolean(payment.verifiedAt && payment.verifiedBy) || ["paymongo", "paymongo-polling", "paymongo-webhook"].includes(payment.source));

function verifiedReservationFee(reservation, payments) {
  const expected = finite(reservation.reservationFeeAmount) ?? 2000;
  return payments.find((payment) => payment.purpose === "reservation_deposit" && isVerifiedPayment(payment) && moneyEqual(payment.amount, expected) && hasSuccessfulReference(payment)) || null;
}

function evidenceKind(row) {
  return JSON.stringify(row || {}).toLowerCase().replaceAll("_", " ").replaceAll("-", " ");
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
    return { ...hold, roomState: room?.available === false ? "unavailable" : "available", bedState: bed?.status || "missing", roomCapacityAffected: Boolean(bed && ["reserved", "occupied", "locked"].includes(bed.status)), paidReservationInvolved: false, competingActiveReservations: competingReservations.length, activeStays: linkedStays.length, uniqueIndexPresent, uniqueIndexSatisfied: competingReservations.length === 0, releaseWouldCreateInconsistency: linkedStays.length > 0 || competingReservations.length > 0, classification: "expired_payment_window_inventory_review" };
  });

  const moveInContractAudit = data.reservations.filter((r) => r.status === "moveIn" && !isArchived(r)).flatMap((r) => {
    const linked = contractsByReservation.get(id(r._id)) || [];
    if (!linked.length) return [{ reservationId: id(r._id), branch: branchOfReservation(r, rooms), moveInDate: r.confirmedMoveInDate || r.moveInDate || null, contractId: null, contractNumber: null, contractStatus: null, policyState: "No Contract", preparedDraftExists: false, signed: false, notarized: false, published: false, currentMoveInBlockersChecksContract: false, classification: "missing_expected_prepared_draft" }];
    return linked.map((c) => {
      const policyState = contractPolicyState(c, r); const preparedDraftExists = Boolean((c.preparedDocuments || []).some((document) => !document.superseded) || c.generatedAt || c.generatedVersion > 0);
      return { reservationId: id(r._id), branch: branchOfReservation(r, rooms), moveInDate: r.confirmedMoveInDate || r.moveInDate || null, contractId: id(c._id), contractNumber: c.contractNumber || null, contractStatus: c.status || null, policyState, preparedDraftExists, signed: Boolean(c.signedUploadedAt || c.signedDocuments?.length), notarized: Boolean(c.notarizedUploadedAt || c.notarizedDocuments?.length), published: Boolean(c.publishedAt), currentMoveInBlockersChecksContract: false, multipleContracts: linked.length > 1, classification: !preparedDraftExists ? "missing_expected_prepared_draft" : linked.length > 1 ? "duplicate_contract_review" : "policy_timing_review", signedBeforeMoveInRequired: false };
    });
  });

  const contractPricingReconciliation = data.contracts.map((c) => {
    const reservation = reservations.get(id(c.reservationId)); const room = rooms.get(id(c.roomId));
    const issues = analyzePricing(c, reservation, room, latestSettings);
    return { contractId: id(c._id), reservationId: id(c.reservationId), branch: c.branch || null, roomId: id(c.roomId), bedId: c.bedId || reservation?.selectedBed?.id || null, leaseType: c.leaseType || null, leaseDurationMonths: c.leaseDurationMonths || null, regularMonthlyRate: c.regularMonthlyRate ?? null, approvedMonthlyRate: c.approvedMonthlyRate ?? null, reservationMonthlyRent: reservation?.monthlyRent ?? reservation?.totalPrice ?? null, discountPercentage: c.discountPercentage ?? null, discountAmount: c.discountAmount ?? null, reservationFeeAmount: c.reservationFeeAmount ?? null, advanceRentAmount: c.advanceRentAmount ?? null, securityDepositAmount: c.securityDepositAmount ?? null, applianceFees: reservation?.applianceFees ?? null, issues, mismatch: issues.some((value) => !["security_deposit_based_on_discounted_rent", "security_deposit_based_on_regular_rent", "business_settings_changed_after_approval"].includes(value)) };
  }).filter((row) => row.issues.length);

  const confirmedReservationStatuses = new Set(["reserved", "moveIn", "moveOut"]);
  const reservationPaymentAudit = data.reservations.filter((r) => confirmedReservationStatuses.has(r.status) && !isArchived(r)).map((r) => {
    const linked = paymentsByReservation.get(id(r._id)) || []; const verified = verifiedReservationFee(r, linked); const fee = finite(r.reservationFeeAmount) ?? 2000;
    const depositPayments = linked.filter((payment) => payment.purpose === "reservation_deposit"); const issues = [];
    if (!verified) issues.push("confirmed_reservation_without_verified_fee");
    if (depositPayments.some((payment) => paymentSuccessful(payment) && !moneyEqual(payment.amount, fee))) issues.push("reservation_fee_amount_mismatch");
    if (depositPayments.some((payment) => paymentSuccessful(payment) && !hasSuccessfulReference(payment))) issues.push("verified_fee_missing_external_reference");
    if (r.proofOfPaymentPresent && depositPayments.every((payment) => !isVerifiedPayment(payment))) issues.push("proof_present_but_not_verified");
    if (r.paymentStatus !== "paid") issues.push("reservation_payment_status_not_paid");
    return { reservationId: id(r._id), userFingerprint: fingerprint(r.userId), branch: branchOfReservation(r, rooms), status: r.status, reservationFeeSnapshot: fee, verifiedPaymentId: verified ? id(verified._id) : null, proofPresent: Boolean(r.proofOfPaymentPresent), paymentStatus: r.paymentStatus || null, issues, classification: issues.length ? "admin_payment_review" : "verified_fee_evidence_present" };
  }).filter((row) => row.issues.length);

  const initialPaymentAudit = data.reservations.filter((r) => ["reserved", "moveIn", "moveOut"].includes(r.status) && !isArchived(r)).map((r) => {
    const linkedBills = data.bills.filter((bill) => id(bill.reservationId) === id(r._id)); const linkedPayments = paymentsByReservation.get(id(r._id)) || [];
    const linkedContracts = contractsByReservation.get(id(r._id)) || []; const textRows = [...linkedBills, ...linkedPayments];
    const advanceBill = linkedBills.some((row) => evidenceKind(row).includes("advance rent"));
    const depositBill = linkedBills.some((row) => evidenceKind(row).includes("security deposit"));
    const initialBill = linkedBills.some((row) => evidenceKind(row).includes("initial payment"));
    const advancePayment = linkedPayments.some((row) => paymentSuccessful(row) && evidenceKind(row).includes("advance rent"));
    const depositPayment = linkedPayments.some((row) => paymentSuccessful(row) && evidenceKind(row).includes("security deposit"));
    const verifiedManualBank = linkedPayments.some((row) => isVerifiedPayment(row) && ["admin-manual", "manual_admin", "manual_proof", "tenant-proof"].includes(row.source) && !isCashMethod(row.method) && hasSuccessfulReference(row));
    const providerPayment = linkedPayments.some((row) => isVerifiedPayment(row) && ["paymongo", "paymongo-polling", "paymongo-webhook"].includes(row.source));
    const reservationCredit = linkedBills.reduce((sum, bill) => sum + (finite(bill.reservationCreditApplied) || 0), 0);
    const contractOnlyAmounts = linkedContracts.some((contract) => (finite(contract.advanceRentAmount) || 0) > 0 || (finite(contract.securityDepositAmount) || 0) > 0);
    let classification = "no_evidence";
    if ((advanceBill || advancePayment) && (depositBill || depositPayment) && (verifiedManualBank || providerPayment)) classification = "complete_system_collection_path";
    else if (advanceBill || depositBill || initialBill || advancePayment || depositPayment || verifiedManualBank || providerPayment) classification = "partial_or_manual_path";
    else if (contractOnlyAmounts) classification = "contract_only_values";
    const expectedCredit = verifiedReservationFee(r, linkedPayments) ? (finite(r.reservationFeeAmount) ?? 2000) : 0;
    const issues = [];
    if (expectedCredit > 0 && !moneyEqual(reservationCredit, expectedCredit) && !linkedContracts.some((contract) => moneyEqual(contract.reservationFeeCreditAmount, expectedCredit))) issues.push("reservation_fee_credit_not_reflected");
    if (classification !== "complete_system_collection_path") issues.push(classification);
    return { reservationId: id(r._id), branch: branchOfReservation(r, rooms), advanceBill, securityDepositBill: depositBill, initialBill, advancePayment, securityDepositPayment: depositPayment, verifiedManualBank, providerPayment, reservationCreditApplied: roundMoney(reservationCredit), expectedReservationFeeCredit: expectedCredit, approvedInitialChargesEvidence: textRows.some((row) => evidenceKind(row).includes("initial charge")), classification, issues };
  });

  const advanceRentCoverageAudit = data.reservations.filter((r) => r.status === "moveIn" && !isArchived(r)).map((r) => {
    const linkedContracts = contractsByReservation.get(id(r._id)) || []; const contract = linkedContracts.find((row) => row.isCurrent !== false) || linkedContracts[0];
    const actualMoveIn = r.confirmedMoveInDate || staysByReservation.get(id(r._id))?.find((stay) => ["active", "ending_soon"].includes(stay.status))?.leaseStartDate || null;
    const start = contract?.advanceCoverageStart || actualMoveIn; const end = contract?.advanceCoverageEnd || (start ? new Date(new Date(start).setUTCMonth(new Date(start).getUTCMonth() + 1)) : null);
    const billsForReservation = data.bills.filter((bill) => id(bill.reservationId) === id(r._id) && (bill.charges?.rent || 0) > 0 && !isArchived(bill));
    const overlaps = billsForReservation.filter((bill) => periodsOverlap(bill.billingCycleStart, bill.billingCycleEnd, start, end) === true);
    const initialEvidence = initialPaymentAudit.find((row) => row.reservationId === id(r._id));
    let classification = "valid_next_cycle_billing";
    if (!actualMoveIn || !start || !end) classification = "missing_advance_coverage_data";
    else if (!initialEvidence?.advancePayment && !initialEvidence?.advanceBill) classification = "no_advance_payment_evidence";
    else if (overlaps.length > 1 || overlaps.some((bill) => bill.status === "paid")) classification = "confirmed_duplicate_billing";
    else if (overlaps.length === 1) classification = "possible_duplicate_billing";
    return { reservationId: id(r._id), branch: branchOfReservation(r, rooms), actualMoveInDate: actualMoveIn, advanceCoverageStart: start, advanceCoverageEnd: end, overlappingBillIds: overlaps.map((bill) => id(bill._id)).sort(), firstRegularBillId: billsForReservation.sort((a, b) => new Date(a.billingCycleStart || 0) - new Date(b.billingCycleStart || 0))[0]?._id?.toString() || null, reservationCreditApplied: initialEvidence?.reservationCreditApplied ?? null, classification };
  });

  const securityDepositAudit = data.contracts.map((contract) => {
    const reservation = reservations.get(id(contract.reservationId)); const linkedPayments = paymentsByReservation.get(id(contract.reservationId)) || [];
    const depositPayments = linkedPayments.filter((payment) => paymentSuccessful(payment) && evidenceKind(payment).includes("security deposit")); const issues = [];
    if (finite(contract.securityDepositAmount) === null || finite(contract.approvedMonthlyRate) === null) issues.push("missing_deposit_or_approved_rate");
    else if (!moneyEqual(contract.securityDepositAmount, contract.approvedMonthlyRate)) issues.push("deposit_not_equal_to_approved_final_monthly_rate");
    if ((reservation?.depositRefundProcessedAt || reservation?.depositRefundStatus === "processed") && !depositPayments.length) issues.push("refund_without_traceable_original_collection");
    if (reservation?.depositForfeited && !reservation.depositForfeitureReason) issues.push("forfeiture_missing_reason");
    if (reservation?.depositForfeited && !reservation.depositRefundProcessedBy) issues.push("forfeiture_missing_approver");
    if (reservation?.depositForfeited && reservation.depositForfeitureReason === "early_vacancy") issues.push("automatic_forfeiture_indicator");
    const room = rooms.get(id(contract.roomId)); if (room && moneyEqual(contract.securityDepositAmount, room.monthlyPrice ?? room.price) && !moneyEqual(contract.securityDepositAmount, contract.approvedMonthlyRate)) issues.push("deposit_based_on_live_room_price");
    return { contractId: id(contract._id), reservationId: id(contract.reservationId), branch: contract.branch || null, securityDepositAmount: contract.securityDepositAmount ?? null, approvedFinalMonthlyRate: contract.approvedMonthlyRate ?? null, originalDepositPaymentIds: depositPayments.map((payment) => id(payment._id)).sort(), refundStatus: reservation?.depositRefundStatus || null, approverPresent: Boolean(reservation?.depositRefundProcessedBy), reasonPresent: Boolean(reservation?.depositForfeitureReason), issues, classification: issues.length ? "manual_deposit_review" : "traceable_and_reconciled" };
  }).filter((row) => row.issues.length);

  const readinessReservationIds = new Set([
    ...data.reservations.filter((r) => r.status === "moveIn" && !isArchived(r)).map((r) => id(r._id)),
    ...data.stays.filter((stay) => ["active", "ending_soon"].includes(stay.status)).map((stay) => id(stay.reservationId)),
  ]);
  const moveInReadinessAudit = [...readinessReservationIds].map((reservationId) => {
    const r = reservations.get(reservationId); const stay = (staysByReservation.get(reservationId) || []).find((row) => ["active", "ending_soon"].includes(row.status));
    if (!r) return { reservationId, issues: ["active_stay_missing_reservation"], classification: "critical_reference_gap" };
    const linkedPayments = paymentsByReservation.get(reservationId) || []; const initial = initialPaymentAudit.find((row) => row.reservationId === reservationId);
    const linkedBills = data.bills.filter((bill) => id(bill.reservationId) === reservationId); const arrangement = linkedBills.some((bill) => bill.isMilestoneSubInvoice && bill.parentInvoiceId);
    const room = rooms.get(id(r.roomId)); const user = users.get(id(r.userId)); const issues = [];
    if (!confirmedReservationStatuses.has(r.status)) issues.push("reservation_not_confirmed");
    if (!verifiedReservationFee(r, linkedPayments)) issues.push("reservation_fee_not_verified");
    if (initial?.classification !== "complete_system_collection_path" && !arrangement) issues.push("initial_balance_not_proven_and_no_arrangement");
    if (arrangement) { issues.push("payment_arrangement_approver_or_reason_not_structured"); }
    const docs = r.documentEvidence || {}; if (!(docs.selfiePresent && docs.validIdFrontPresent && docs.validIdBackPresent)) issues.push("required_document_evidence_incomplete");
    if (!r.roomId || !room) issues.push("room_not_assigned");
    if (!r.selectedBed?.id || !room?.beds?.some((bed) => String(bed.id) === String(r.selectedBed.id))) issues.push("bed_not_assigned_or_unresolved");
    if (!(r.confirmedMoveInDate || stay?.leaseStartDate)) issues.push("actual_move_in_date_missing");
    const contract = (contractsByReservation.get(reservationId) || [])[0]; if (!contract?.pricingApprovedAt || !contract?.pricingApprovedBy) issues.push("rate_snapshot_not_approved");
    if (!(r.emergencyContact?.present || (user?.emergencyContact && user?.emergencyPhone))) issues.push("emergency_contact_missing");
    if (!r.agreedToCertification) issues.push("house_rules_readiness_not_evidenced");
    if (!stay || !["active", "ending_soon"].includes(stay.status)) issues.push("stay_not_active");
    if (stay && room?.branch && stay.branch !== room.branch) issues.push("branch_inconsistent");
    return { reservationId, stayId: id(stay?._id), branch: branchOfReservation(r, rooms), reservationConfirmed: confirmedReservationStatuses.has(r.status), reservationFeeVerified: Boolean(verifiedReservationFee(r, linkedPayments)), initialBalanceEvidence: initial?.classification || "no_evidence", approvedPaymentArrangement: arrangement, roomAssigned: Boolean(room), bedAssigned: Boolean(r.selectedBed?.id), actualMoveInDate: r.confirmedMoveInDate || stay?.leaseStartDate || null, rateSnapshotApproved: Boolean(contract?.pricingApprovedAt && contract?.pricingApprovedBy), emergencyContactPresent: Boolean(r.emergencyContact?.present || (user?.emergencyContact && user?.emergencyPhone)), houseRulesEvidence: Boolean(r.agreedToCertification), stayActive: Boolean(stay), issues, classification: issues.length ? "readiness_gap" : "ready_evidence_complete" };
  });

  const contractTimingAudit = data.reservations.filter((r) => confirmedReservationStatuses.has(r.status) && !isArchived(r)).flatMap((r) => {
    const linked = contractsByReservation.get(id(r._id)) || [];
    if (!linked.length) return [{ reservationId: id(r._id), contractId: null, policyState: "No Contract", issues: ["prepared_draft_missing_after_reservation_confirmation"] }];
    return linked.map((contract) => {
      const issues = []; const actualMoveIn = r.confirmedMoveInDate || (staysByReservation.get(id(r._id)) || [])[0]?.leaseStartDate || null;
      const prepared = Boolean((contract.preparedDocuments || []).some((document) => !document.superseded) || contract.generatedAt || contract.generatedVersion > 0);
      if (!prepared) issues.push("prepared_draft_missing_after_reservation_confirmation");
      if (contract.generatedAt && !actualMoveIn) issues.push("final_generation_before_actual_move_in_details");
      if (actualMoveIn && contract.leaseStartDate && new Date(actualMoveIn).toISOString().slice(0, 10) !== new Date(contract.leaseStartDate).toISOString().slice(0, 10)) issues.push("contract_start_date_differs_from_actual_move_in");
      if (id(contract.roomId) !== id(r.roomId)) issues.push("contract_room_differs_from_active_assignment");
      if (contract.bedId && r.selectedBed?.id && String(contract.bedId) !== String(r.selectedBed.id)) issues.push("contract_bed_differs_from_active_assignment");
      if (finite(contract.advanceRentAmount) === null) issues.push("advance_rent_missing");
      if (finite(contract.securityDepositAmount) === null) issues.push("security_deposit_missing");
      if (!moneyEqual(contract.reservationFeeCreditAmount, r.reservationFeeAmount ?? 2000)) issues.push("reservation_fee_credit_missing_or_inconsistent");
      if (expectedLeaseType(contract.leaseDurationMonths) !== contract.leaseType) issues.push("lease_type_duration_mismatch");
      if (linked.filter((row) => row.isCurrent !== false && !isArchived(row)).length > 1) issues.push("multiple_active_contracts");
      return { reservationId: id(r._id), contractId: id(contract._id), branch: contract.branch || branchOfReservation(r, rooms), policyState: contractPolicyState(contract, r), preparedDraftExists: prepared, actualMoveInDate: actualMoveIn, contractStartDate: contract.leaseStartDate || null, issues };
    });
  });

  const leaseTypeAudit = data.contracts.map((contract) => {
    const reservation = reservations.get(id(contract.reservationId)); const expected = expectedLeaseType(contract.leaseDurationMonths); const reservationExpected = expectedLeaseType(reservation?.leaseDuration); const issues = [];
    if (expected === "missing") issues.push("missing_duration"); else if (expected === "unsupported") issues.push("unsupported_duration"); else if (contract.leaseType !== expected) issues.push("contract_lease_type_inconsistent_with_duration");
    if (!["missing", "unsupported"].includes(reservationExpected) && contract.leaseType !== reservationExpected) issues.push("contract_lease_type_differs_from_reservation_duration");
    return { contractId: id(contract._id), reservationId: id(contract.reservationId), durationMonths: contract.leaseDurationMonths ?? null, leaseType: contract.leaseType || null, expectedLeaseType: expected, reservationDuration: reservation?.leaseDuration ?? null, issues, classification: issues.length ? "lease_policy_mismatch" : "lease_type_valid" };
  }).filter((row) => row.issues.length);

  const zeroDiscountAudit = data.contracts.filter((contract) => finite(contract.discountPercentage) === 0).map((contract) => {
    const mathematicallyValid = moneyEqual(contract.discountAmount, 0) && moneyEqual(contract.approvedMonthlyRate, contract.regularMonthlyRate);
    return { contractId: id(contract._id), reservationId: id(contract.reservationId), discountPercentage: 0, discountAmount: contract.discountAmount ?? null, regularMonthlyRate: contract.regularMonthlyRate ?? null, approvedMonthlyRate: contract.approvedMonthlyRate ?? null, mathematicallyValid, blockedByCurrentApprovalCode: true, issues: mathematicallyValid ? ["valid_zero_discount_blocked_by_current_code"] : ["zero_discount_math_inconsistent"] };
  });

  const penaltyPolicyAudit = data.bills.filter((bill) => bill.dueDate && new Date(bill.dueDate) < now && (finite(bill.remainingAmount) || 0) > 0).map((bill) => {
    const core = expectedCorePenalty(bill.dueDate, now, 50); const stored = finite(bill.charges?.penalty); const zeroGraceDays = Math.max(0, Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(new Date(bill.dueDate).getUTCFullYear(), new Date(bill.dueDate).getUTCMonth(), new Date(bill.dueDate).getUTCDate())) / 86_400_000));
    let classification = "another_inconsistent_result";
    if (stored === null) classification = "missing_data"; else if (moneyEqual(stored, core.expectedPenalty)) classification = "matches_one_day_grace_php50_per_day"; else if (moneyEqual(stored, zeroGraceDays * 50)) classification = "matches_zero_grace_php50_per_day"; else if (zeroGraceDays > 3 && moneyEqual(stored, 500)) classification = "matches_three_day_grace_php500_flat";
    if (bill.status === "partially-paid") classification = `unresolved_due_to_partial_payment:${classification}`;
    return { billId: id(bill._id), branch: bill.branch || null, dueDate: bill.dueDate, penaltyStartDate: core.penaltyStartDate, expectedPenaltyDays: core.penaltyDays, expectedPenalty: core.expectedPenalty, storedPenalty: stored, storedDaysLate: bill.penaltyDetails?.daysLate ?? null, storedRatePerDay: bill.penaltyDetails?.ratePerDay ?? null, classification };
  }).filter((row) => !row.classification.includes("matches_one_day_grace_php50_per_day") || row.classification.startsWith("unresolved"));

  const prohibitedCashPayments = [];
  for (const payment of data.payments) if (isCashMethod(payment.method)) prohibitedCashPayments.push({ recordType: "payment", recordId: id(payment._id), targetId: id(payment.billId || payment.reservationId), branch: payment.branch || null, method: payment.method, classification: "prohibited_cash_payment" });
  for (const bill of data.bills) if (isCashMethod(bill.paymentMethod)) prohibitedCashPayments.push({ recordType: "bill", recordId: id(bill._id), targetId: id(bill.reservationId), branch: bill.branch || null, method: bill.paymentMethod, classification: "bill_paid_or_marked_through_cash" });
  for (const reservation of data.reservations) if (isCashMethod(reservation.paymentMethod)) prohibitedCashPayments.push({ recordType: "reservation", recordId: id(reservation._id), targetId: id(reservation._id), branch: branchOfReservation(reservation, rooms), method: reservation.paymentMethod, classification: "reservation_cash_method" });

  const paymentProofAudit = data.payments.flatMap((payment) => {
    const issues = []; const providerStatus = String(payment.safeEvidence?.providerStatus || "").toLowerCase().replaceAll(" ", "_");
    if (INVALID_PROOF_STATUSES.has(providerStatus) && paymentSuccessful(payment)) issues.push("invalid_proof_status_accepted");
    if (paymentSuccessful(payment) && !payment.safeEvidence?.transactionDatePresent) issues.push("transaction_date_missing");
    if (paymentSuccessful(payment) && !hasSuccessfulReference(payment)) issues.push("external_reference_missing");
    if (paymentSuccessful(payment) && !payment.safeEvidence?.receivingAccountPresent && !["paymongo", "paymongo-webhook", "paymongo-polling"].includes(payment.source)) issues.push("receiving_account_evidence_missing");
    if (paymentSuccessful(payment) && !payment.proofPresent && !payment.externalPaymentId) issues.push("successful_proof_or_provider_evidence_missing");
    if (paymentSuccessful(payment) && !payment.verifiedBy && !["paymongo", "paymongo-webhook", "paymongo-polling"].includes(payment.source)) issues.push("verifier_missing");
    if (paymentSuccessful(payment) && !payment.verifiedAt && !["paymongo", "paymongo-webhook", "paymongo-polling"].includes(payment.source)) issues.push("verification_timestamp_missing");
    if (finite(payment.expectedAmount) !== null && !moneyEqual(payment.amount, payment.expectedAmount)) issues.push("amount_mismatch");
    if (payment.safeEvidence?.accountMatch === false) issues.push("receiving_account_mismatch");
    return issues.length ? [{ paymentId: id(payment._id), targetId: id(payment.billId || payment.reservationId), branch: payment.branch || null, externalReferenceFingerprint: fingerprint(payment.externalPaymentId || payment.referenceNumber || payment.paymentReference), proofPresent: Boolean(payment.proofPresent), status: payment.status || null, providerStatus: payment.safeEvidence?.providerStatus || null, issues, classification: "payment_proof_review" }] : [];
  });
  for (const bill of data.bills) if (bill.paymentProof?.verificationStatus === "approved" && (!bill.paymentProof.verifierPresent || !bill.paymentProof.verifiedAt)) paymentProofAudit.push({ paymentId: null, targetId: id(bill._id), branch: bill.branch || null, externalReferenceFingerprint: null, proofPresent: Boolean(bill.paymentProof.imagePresent), status: bill.status || null, providerStatus: bill.paymentProof.verificationStatus, issues: [!bill.paymentProof.verifierPresent ? "verifier_missing" : null, !bill.paymentProof.verifiedAt ? "verification_timestamp_missing" : null].filter(Boolean), classification: "approved_bill_proof_missing_audit_evidence" });
  for (const reservation of data.reservations) if (reservation.proofOfPaymentPresent && reservation.paymentStatus === "paid" && !verifiedReservationFee(reservation, paymentsByReservation.get(id(reservation._id)) || [])) paymentProofAudit.push({ paymentId: null, targetId: id(reservation._id), branch: branchOfReservation(reservation, rooms), externalReferenceFingerprint: null, proofPresent: true, status: reservation.paymentStatus, providerStatus: null, issues: ["proof_upload_may_have_directly_marked_reservation_paid"], classification: "settlement_evidence_missing" });

  const paymentAllocationAudit = data.payments.flatMap((payment) => {
    const allocations = payment.safeEvidence?.allocations || []; const issues = [];
    if (allocations.length) {
      const allocated = roundMoney(allocations.reduce((sum, allocation) => sum + (finite(allocation.amount) || 0), 0)); const unallocated = finite(payment.safeEvidence.unallocatedAmount) || 0;
      if (!moneyEqual(allocated + unallocated, payment.amount)) issues.push("allocated_plus_unallocated_does_not_equal_payment");
      for (const allocation of allocations) { const target = bills.get(id(allocation.targetId)); if (!target) issues.push("allocation_target_missing"); else { if ((finite(allocation.amount) || 0) > (finite(target.totalAmount) || 0) + MONEY_TOLERANCE) issues.push("allocation_exceeds_bill_amount"); if (target.branch && payment.branch && target.branch !== payment.branch) issues.push("cross_branch_allocation"); if (id(target.userId) !== id(payment.tenantId)) issues.push("cross_tenant_allocation"); } }
    }
    return issues.length ? [{ paymentId: id(payment._id), targetId: id(payment.billId || payment.reservationId), branch: payment.branch || null, amount: payment.amount ?? null, allocationCount: allocations.length, issues, classification: "allocation_reconciliation_required" }] : [];
  });
  for (const bill of data.bills) {
    const remaining = finite(bill.remainingAmount); if (bill.status === "paid" && remaining !== null && remaining > MONEY_TOLERANCE) paymentAllocationAudit.push({ paymentId: null, targetId: id(bill._id), branch: bill.branch || null, amount: bill.paidAmount ?? null, allocationCount: null, issues: ["paid_bill_has_remaining_balance"], classification: "bill_balance_mismatch" });
    if (["pending", "overdue"].includes(bill.status) && remaining !== null && Math.abs(remaining) <= MONEY_TOLERANCE) paymentAllocationAudit.push({ paymentId: null, targetId: id(bill._id), branch: bill.branch || null, amount: bill.paidAmount ?? null, allocationCount: null, issues: ["unpaid_bill_has_zero_remaining_balance"], classification: "bill_balance_mismatch" });
  }

  const temporaryLockAudit = [];
  for (const room of data.rooms) for (const bed of room.beds || []) {
    const lockedReservation = reservations.get(id(bed.occupiedBy?.reservationId)); const activeStayReferencesBed = data.stays.some((stay) => id(stay.roomId) === id(room._id) && String(stay.bedId) === String(bed.id) && ["active", "ending_soon"].includes(stay.status));
    if (bed.status === "locked" && bed.lockExpiresAt && new Date(bed.lockExpiresAt) < now) temporaryLockAudit.push({ roomId: id(room._id), bedId: bed.id || null, branch: room.branch || null, reservationId: id(bed.occupiedBy?.reservationId), bedState: bed.status, roomCapacityAffected: true, paidReservationInvolved: lockedReservation?.paymentStatus === "paid", activeStayReferencesBed, classification: "abandoned_temporary_lock", automaticReleaseUnsafe: Boolean(bed.occupiedBy?.reservationId || activeStayReferencesBed) });
    if (bed.status === "locked" && lockedReservation?.paymongoSessionId && (paymentsByReservation.get(id(lockedReservation._id)) || []).some((payment) => ["failed", "cancelled", "expired"].includes(payment.status))) temporaryLockAudit.push({ roomId: id(room._id), bedId: bed.id || null, branch: room.branch || null, reservationId: id(lockedReservation._id), bedState: bed.status, roomCapacityAffected: true, paidReservationInvolved: false, activeStayReferencesBed, classification: "failed_checkout_lock", automaticReleaseUnsafe: activeStayReferencesBed });
    const heldReservation = reservations.get(id(bed.occupiedBy?.reservationId));
    if (["cancelled", "archived", "rejected", "expired", "moveOut"].includes(heldReservation?.status) && ["reserved", "occupied", "locked"].includes(bed.status)) temporaryLockAudit.push({ roomId: id(room._id), bedId: bed.id || null, branch: room.branch || null, reservationId: id(heldReservation._id), bedState: bed.status, roomCapacityAffected: true, paidReservationInvolved: heldReservation.paymentStatus === "paid", activeStayReferencesBed, classification: "inactive_reservation_still_holding_inventory", automaticReleaseUnsafe: activeStayReferencesBed });
  }

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
    const serialized = JSON.stringify({ purpose: p.purpose, safeEvidenceCategory: p.safeEvidence?.category, notes: p.notes }).toLowerCase();
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

  const categories = {
    nonCanonicalStatuses,
    expiredPaymentHolds,
    inventoryHoldAudit: [...inventoryHoldAudit, ...temporaryLockAudit],
    reservationPaymentAudit,
    initialPaymentAudit,
    advanceRentCoverageAudit,
    securityDepositAudit,
    moveInReadinessAudit,
    moveInContractAudit: [...moveInContractAudit, ...contractTimingAudit],
    contractPricingReconciliation,
    leaseTypeAudit,
    zeroDiscountAudit,
    penaltyPolicyAudit,
    prohibitedCashPayments,
    paymentProofAudit,
    paymentAllocationAudit,
    orphanedRecords,
    paymentReconciliation,
    billingOrphans,
    branchConsistency,
    duplicateRiskIndicators,
    financialEvidence,
  };
  for (const value of Object.values(categories)) value.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    generatedAt: new Date(now).toISOString(), canonicalReservationStatuses: [...CANONICAL_RESERVATION_STATUSES], moneyTolerance: MONEY_TOLERANCE,
    collectionWarnings: [...data.collectionWarnings].sort(), counts: {
      ...Object.fromEntries(Object.entries(categories).map(([name, rows]) => [name, rows.length])),
      expiredHoldsStillHoldingInventory: inventoryHoldAudit.filter((row) => row.inventoryStillHeld).length,
      moveInsWithoutReadyContracts: moveInContractAudit.filter((row) => !row.preparedDraftExists).length,
      contractPricingMismatches: contractPricingReconciliation.filter((row) => row.mismatch).length,
      reconciliationRequiredPayments: paymentReconciliation.length,
      branchMismatches: branchConsistency.length,
    },
    advanceDepositConclusion, ...categories,
  };
}
