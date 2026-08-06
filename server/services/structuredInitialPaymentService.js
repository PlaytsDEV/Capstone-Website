import { randomUUID } from "crypto";
import {
  AuditLog,
  Bill,
  Payment,
  Reservation,
  Room,
  Stay,
} from "../models/index.js";
import {
  STRUCTURED_INITIAL_PAYMENT_WORKFLOW,
  usesStructuredInitialPayment,
} from "../config/structuredInitialPayment.js";
import { notify } from "../utils/notificationService.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
import {
  buildRollingRentalPeriod,
  calculateStructuredInitialPayment,
  resolveVerifiedReservationFeeCredit,
} from "./structuredInitialPaymentPolicy.js";
export * from "./structuredInitialPaymentPolicy.js";

export async function createStructuredInitialPaymentBill({
  reservation: reservationInput,
  reservationFeePayment,
  now = new Date(),
} = {}) {
  const reservation = reservationInput?._id
    ? reservationInput
    : await Reservation.findById(reservationInput);
  if (!reservation || !usesStructuredInitialPayment(reservation)) {
    return { status: "skipped", reason: "legacy_workflow" };
  }
  if (!reservation.pricingSnapshot?.approvedAt) {
    return { status: "blocked", reason: "pricing_snapshot_missing" };
  }
  const payment = reservationFeePayment?._id
    ? reservationFeePayment
    : await Payment.findOne({
        reservationId: reservation._id,
        purpose: { $in: ["reservation_fee", "reservation_deposit"] },
        status: "confirmed",
      }).sort({ processedAt: -1, createdAt: -1 });
  if (!payment || payment.status !== "confirmed" || payment.method !== "paymongo") {
    return { status: "blocked", reason: "reservation_fee_not_verified" };
  }

  const verifiedCredit = resolveVerifiedReservationFeeCredit(
    payment,
    reservation.pricingSnapshot.reservationFeeAmount,
  );
  const calculation = calculateStructuredInitialPayment({
    advanceRent: reservation.pricingSnapshot.advanceRentAmount,
    securityDeposit: reservation.pricingSnapshot.securityDepositAmount,
    approvedInitialCharges: reservation.pricingSnapshot.approvedInitialCharges,
    reservationFeeCredit: verifiedCredit,
  });
  const existing = await Bill.findOne({
    reservationId: reservation._id,
    billType: "initial_payment",
    structuredWorkflowVersion: STRUCTURED_INITIAL_PAYMENT_WORKFLOW,
    isArchived: { $ne: true },
  });
  if (existing) return { status: "existing", bill: existing, calculation };

  const bill = new Bill({
    reservationId: reservation._id,
    userId: reservation.userId,
    roomId: reservation.roomId,
    branch: reservation.pricingSnapshot.branchId,
    billingMonth: now,
    dueDate: null,
    billType: "initial_payment",
    structuredWorkflowVersion: STRUCTURED_INITIAL_PAYMENT_WORKFLOW,
    pricingSnapshotVersion: reservation.pricingSnapshot.snapshotVersion,
    reservationFeePaymentId: payment._id,
    initialPaymentBreakdown: calculation,
    charges: {
      rent: 0,
      electricity: 0,
      water: 0,
      applianceFees: 0,
      corkageFees: 0,
      penalty: 0,
      discount: 0,
    },
    grossAmount: calculation.grossInitialAmount,
    reservationCreditApplied: calculation.reservationFeeCredit,
    totalAmount: calculation.initialPaymentTotal,
    remainingAmount: calculation.initialPaymentTotal,
    status: calculation.initialPaymentTotal === 0 ? "paid" : "pending",
  });

  try {
    await bill.save();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const concurrent = await Bill.findOne({
      reservationId: reservation._id,
      billType: "initial_payment",
      structuredWorkflowVersion: STRUCTURED_INITIAL_PAYMENT_WORKFLOW,
      isArchived: { $ne: true },
    });
    return { status: "existing", bill: concurrent, calculation };
  }

  reservation.initialPaymentBillId = bill._id;
  reservation.initialPaymentStatus = bill.status === "paid" ? "paid" : "pending";
  reservation.reservationFeePaymentStatus = "verified";
  reservation.reservationFeePaymentId = payment._id;
  await reservation.save({ validateModifiedOnly: true });

  await AuditLog.create({
    logId: `LOG-${randomUUID()}`,
    type: "data_modification",
    action: "reservation.initial_payment_bill_created",
    severity: "high",
    user: "system",
    userRole: "system",
    branch: bill.branch,
    entityType: "bill",
    entityId: String(bill._id),
    details: "Created prospective structured initial-payment Bill.",
    metadata: {
      reservationId: String(reservation._id),
      billId: String(bill._id),
      reservationFeePaymentId: String(payment._id),
      workflowVersion: STRUCTURED_INITIAL_PAYMENT_WORKFLOW,
      amount: calculation.initialPaymentTotal,
    },
  });
  try {
    await notify.general(
      reservation.userId,
      "Remaining Initial Balance Available",
      `Your structured initial-payment Bill is ready. Remaining balance: PHP ${calculation.initialPaymentTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Continue to PayMongo to complete payment.`,
      {
        entityType: "bill",
        entityId: String(bill._id),
        actionUrl: "/applicant/billing",
      },
    );
  } catch {
    // Notification delivery is non-transactional; Bill creation remains authoritative.
  }
  return { status: "created", bill, calculation };
}

export async function finalizeStructuredAdvanceCoverage({
  reservation,
  actualMoveInDate,
} = {}) {
  if (!usesStructuredInitialPayment(reservation)) {
    return { status: "skipped", reason: "legacy_workflow" };
  }
  const advance = buildRollingRentalPeriod(actualMoveInDate, 0);
  const firstRegular = buildRollingRentalPeriod(actualMoveInDate, 1);
  reservation.advanceCoverageStart = advance.coverageStart;
  reservation.advanceCoverageEndExclusive = advance.coverageEndExclusive;
  reservation.advanceCoverageEnd = advance.displayEnd;
  reservation.nextRegularBillingDate = firstRegular.coverageStart;
  return { status: "finalized", advance, firstRegular };
}

export async function getStructuredMoveInBlockers(
  reservation,
  { houseRulesPrepared = false, moveInException = null } = {},
) {
  if (!usesStructuredInitialPayment(reservation)) return [];
  const blockers = [];
  if (reservation.reservationFeePaymentStatus !== "verified") {
    blockers.push("Reservation Fee must be verified through PayMongo.");
  }
  if (!reservation.pricingSnapshot?.approvedAt) blockers.push("Approved pricing snapshot is missing.");
  if (!reservation.initialPaymentBillId) {
    blockers.push("Structured initial-payment Bill is missing.");
    return blockers;
  }
  const bill = await Bill.findById(reservation.initialPaymentBillId).lean();
  if (!bill || bill.billType !== "initial_payment") {
    blockers.push("Structured initial-payment Bill is invalid.");
  } else if (bill.status !== "paid" || money(bill.remainingAmount) !== 0) {
    blockers.push("Structured initial-payment Bill must be fully paid with zero remaining balance.");
  }
  if (!reservation.emergencyContact?.name || !reservation.emergencyContact?.contactNumber) {
    blockers.push("Emergency contact is incomplete.");
  }
  const effectiveException = moveInException || reservation.moveInException;
  const exceptionActive =
    effectiveException?.active === true &&
    effectiveException?.approvedBy &&
    effectiveException?.expiresAt &&
    new Date(effectiveException.expiresAt) >= new Date();
  const documentsComplete = Boolean(
    reservation.selfiePhotoUrl &&
      reservation.validIDFrontUrl &&
      reservation.validIDBackUrl &&
      reservation.agreedToPrivacy &&
      reservation.agreedToCertification,
  );
  if (!documentsComplete && !exceptionActive) {
    blockers.push("Required documents are incomplete and no active approved exception exists.");
  }
  if (!reservation.houseRulesPreparedAt && !houseRulesPrepared) {
    blockers.push("House rules must be prepared for acknowledgment.");
  }
  if (!reservation.roomId) blockers.push("Room assignment is missing.");
  if (!reservation.selectedBed?.id) blockers.push("Bed or slot assignment is missing.");
  if (reservation.roomId) {
    const roomId = reservation.roomId?._id || reservation.roomId;
    const room = await Room.findById(roomId).select("branch beds").lean();
    if (!room || room.branch !== reservation.pricingSnapshot?.branchId) {
      blockers.push("Room assignment does not match the approved branch.");
    } else if (
      reservation.selectedBed?.id &&
      !room.beds?.some((bed) => bed.id === reservation.selectedBed.id)
    ) {
      blockers.push("Selected bed or slot does not belong to the assigned Room.");
    }
    const conflictingStay = await Stay.findOne({
      reservationId: { $ne: reservation._id },
      roomId,
      ...(reservation.selectedBed?.id
        ? { bedId: reservation.selectedBed.id }
        : {}),
      status: { $in: ["active", "ending_soon"] },
    })
      .select("_id")
      .lean();
    if (conflictingStay) blockers.push("A conflicting active Stay already uses this room or bed.");
    const conflictingAssignment = await Reservation.findOne({
      _id: { $ne: reservation._id },
      roomId,
      isArchived: { $ne: true },
      status: { $in: ["reserved", "moveIn"] },
      ...(reservation.selectedBed?.id
        ? { "selectedBed.id": reservation.selectedBed.id }
        : {}),
    })
      .select("_id")
      .lean();
    if (conflictingAssignment) {
      blockers.push("A conflicting active Reservation already uses this room or bed.");
    }
  }
  return blockers;
}

/**
 * Read-only, display-oriented wrapper around getStructuredMoveInBlockers for
 * API responses (see attachMoveInReadiness in reservationCrudController.js).
 * This is the SAME backend query set the real move-in mutation enforces —
 * unlike the frontend's reservationReadiness.js mirror, it is authoritative
 * because it actually queries Bill/Room/Stay/Reservation instead of guessing
 * from fields already present on the serialized reservation. The frontend
 * must treat this as the only source that can claim final "ready" and must
 * not recompute room/bed/occupancy conflict checks itself.
 */
export async function getStructuredMoveInReadinessSummary(reservation) {
  if (!usesStructuredInitialPayment(reservation)) {
    return { status: "not_applicable", blockers: [] };
  }
  const blockers = await getStructuredMoveInBlockers(reservation);
  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
  };
}

export async function syncStructuredReservationAfterBillSettlement(bill) {
  if (
    bill?.billType !== "initial_payment" ||
    bill?.structuredWorkflowVersion !== STRUCTURED_INITIAL_PAYMENT_WORKFLOW
  ) return;
  const remaining = money(Math.max(Number(bill.totalAmount || 0) - Number(bill.paidAmount || 0), 0));
  await Reservation.updateOne(
    {
      _id: bill.reservationId,
      financialWorkflowVersion: STRUCTURED_INITIAL_PAYMENT_WORKFLOW,
    },
    {
      $set: {
        initialPaymentStatus: remaining === 0 ? "paid" : "partial",
      },
    },
  );
  await AuditLog.create({
    logId: `LOG-${randomUUID()}`,
    type: "data_modification",
    action: "reservation.initial_payment_settled",
    severity: "high",
    user: "paymongo",
    userRole: "paymongo_webhook",
    branch: bill.branch,
    entityType: "bill",
    entityId: String(bill._id),
    details: "Updated prospective structured initial-payment settlement state.",
    metadata: {
      reservationId: String(bill.reservationId),
      billId: String(bill._id),
      workflowVersion: bill.structuredWorkflowVersion,
      amountPaid: money(bill.paidAmount),
      remainingAmount: remaining,
      newState: remaining === 0 ? "paid" : "partial",
    },
  });
  if (remaining === 0) {
    try {
      await notify.general(
        bill.userId,
        "Initial Payment Confirmed and Complete",
        "Your initial payment is complete. Your one-month advance rent covers your first rental month, and regular rent billing begins with your second rental month.",
        {
          entityType: "bill",
          entityId: String(bill._id),
          actionUrl: "/applicant/billing",
        },
      );
    } catch {
      // Settlement must not be rolled back by a notification delivery failure.
    }
  }
}

export async function quarantineStructuredSettlementMismatch({
  bill,
  paymentReference,
  settledAmount,
  currency,
  source,
  metadata = {},
  reason,
  now = new Date(),
} = {}) {
  const existing = paymentReference
    ? await Payment.findOne({ externalPaymentId: paymentReference })
    : null;
  const payment =
    existing ||
    (await Payment.create({
      tenantId: bill.userId,
      billId: bill._id,
      branch: bill.branch,
      purpose: "initial_payment",
      amount: money(settledAmount),
      expectedAmount: money(bill.remainingAmount ?? bill.totalAmount),
      paidAmount: money(settledAmount),
      currency,
      method: "paymongo",
      source,
      provider: "paymongo",
      providerPaymentId: paymentReference,
      externalPaymentId: paymentReference,
      externalSessionId: metadata.sessionId || null,
      webhookEventReference: metadata.eventId || null,
      settlementTimestamp: now,
      status:
        reason === "amount_mismatch"
          ? "amount_mismatch"
          : "reconciliation_required",
      processedAt: now,
      metadata: {
        reconciliationReason: reason,
        expectedAmount: money(bill.remainingAmount ?? bill.totalAmount),
        receivedAmount: money(settledAmount),
        expectedCurrency: "PHP",
        receivedCurrency: currency,
      },
    }));
  bill.paymentProof = {
    verificationStatus: "rejected",
    verifiedAt: now,
    submittedAmount: money(settledAmount),
    rejectionReason: `PayMongo ${reason.replaceAll("_", " ")} requires reconciliation.`,
  };
  await bill.save();
  await Reservation.updateOne(
    {
      _id: bill.reservationId,
      financialWorkflowVersion: STRUCTURED_INITIAL_PAYMENT_WORKFLOW,
    },
    { $set: { initialPaymentStatus: "reconciliation_required" } },
  );
  await AuditLog.create({
    logId: `LOG-${randomUUID()}`,
    type: "data_modification",
    action: "reservation.initial_payment_reconciliation_required",
    severity: "high",
    user: "paymongo",
    userRole: "paymongo_webhook",
    branch: bill.branch,
    entityType: "bill",
    entityId: String(bill._id),
    details: "Structured initial-payment settlement was quarantined for reconciliation.",
    metadata: {
      reservationId: String(bill.reservationId),
      billId: String(bill._id),
      paymentId: String(payment._id),
      reason,
      expectedAmount: money(bill.remainingAmount ?? bill.totalAmount),
      receivedAmount: money(settledAmount),
      expectedCurrency: "PHP",
      receivedCurrency: currency,
    },
  });
  return payment;
}
