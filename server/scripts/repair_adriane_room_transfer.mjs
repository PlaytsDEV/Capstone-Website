/**
 * Adriane Handumon Room Transfer forensic reconstruction and narrow repair.
 * DEFAULT: DRY RUN. --apply remains explicit but is refused by the production
 * read-only audit connection path. Repair proof predicates remain preserved for
 * a separately reviewed future repair procedure.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Bill, Contract, Payment, Reservation, Room, ScheduledRoomTransfer, Stay, User } from "../models/index.js";
import { resolveVerifiedSecurityDepositHeld } from "../services/billing/securityDepositEvidenceService.js";
import { roundMoney, sumBillCharges } from "../services/billing/billingPolicy.js";
import {
  openRoomTransferReadOnlyAudit,
  parseRoomTransferAuditMode,
  printRoomTransferAuditMode,
} from "./roomTransferReadOnlyAuditSafety.mjs";

const { apply } = parseRoomTransferAuditMode(process.argv.slice(2));
printRoomTransferAuditMode({ apply });

const sid = (value) => (value ? String(value) : null);
const SETTLED_PAYMENT_STATUSES = ["approved", "paid", "confirmed"];

const auditConnection = await openRoomTransferReadOnlyAudit({
  mongoose,
  models: { Bill, Contract, Payment, Reservation, Room, ScheduledRoomTransfer, Stay, User },
  apply,
});
try {
  const users = await User.find({ firstName: /^Adriane$/i, lastName: /^Handumon$/i }).lean();
  if (users.length !== 1) throw new Error(`Expected exactly one Adriane Handumon user; found ${users.length}.`);
  const tenant = users[0];
  const reservations = await Reservation.find({ userId: tenant._id, isArchived: { $ne: true } }).sort({ createdAt: 1 }).lean();
  if (reservations.length !== 1) throw new Error(`Expected exactly one active reservation for Adriane; found ${reservations.length}.`);
  const reservation = reservations[0];
  const [stays, contracts, schedules, bills, rooms] = await Promise.all([
    Stay.find({ reservationId: reservation._id }).sort({ createdAt: 1 }).lean(),
    Contract.find({ reservationId: reservation._id }).sort({ version: 1, createdAt: 1 }).lean(),
    ScheduledRoomTransfer.find({ reservationId: reservation._id }).sort({ createdAt: 1 }).lean(),
    Bill.find({ reservationId: reservation._id, isArchived: { $ne: true } }).sort({ createdAt: 1 }).lean(),
    Room.find({ _id: { $in: [reservation.roomId, ...stays.map((stay) => stay.roomId)] } }).lean(),
  ]);
  const payments = await Payment.find({ billId: { $in: bills.map((bill) => bill._id) } }).sort({ createdAt: 1 }).lean();
  const depositEvidence = await resolveVerifiedSecurityDepositHeld({
    reservation,
    bills: bills.filter((bill) => bill.billType === "initial_payment"),
    payments,
    ignoreCanonical: true,
    ignoreLedger: true,
  });
  const transferBills = bills.filter((bill) => bill.billType === "transfer_settlement" && bill.status !== "voided");
  const executedSchedules = schedules.filter((schedule) => schedule.status === "executed");
  const bill = transferBills.length === 1 ? transferBills[0] : null;
  const schedule = executedSchedules.length === 1 ? executedSchedules[0] : null;
  const destinationRequired = roundMoney(bill?.transferSnapshot?.destinationRequiredDeposit);
  const previousVerifiedHeld = depositEvidence.heldKnown ? roundMoney(depositEvidence.amount) : null;
  const correctedDepositDue = previousVerifiedHeld === null || !(destinationRequired > 0)
    ? null
    : roundMoney(Math.max(destinationRequired - previousVerifiedHeld, 0));
  const correctedCharges = bill && correctedDepositDue !== null
    ? { ...bill.charges, securityDeposit: correctedDepositDue }
    : null;
  const correctedTotal = correctedCharges ? sumBillCharges(correctedCharges) : null;
  const billPayments = bill ? payments.filter((payment) => sid(payment.billId) === sid(bill._id)) : [];
  const settledPaymentTotal = roundMoney(billPayments
    .filter((payment) => SETTLED_PAYMENT_STATUSES.includes(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || payment.paidAmount || 0), 0));
  const canonicalPaidAmount = roundMoney(bill?.paidAmount || 0);
  const provenPaid = Math.max(settledPaymentTotal, canonicalPaidAmount);
  const correctedRemaining = correctedTotal === null ? null : roundMoney(Math.max(correctedTotal - provenPaid, 0));
  const correctedStatus = correctedRemaining === 0 ? "paid" : bill?.status;
  const correctedHeld = correctedDepositDue !== null && provenPaid + 0.01 >= correctedTotal
    ? roundMoney(previousVerifiedHeld + correctedDepositDue)
    : null;

  const proofPredicates = {
    oneReservation: reservations.length === 1,
    oneExecutedTransfer: executedSchedules.length === 1,
    oneTransferSettlementBill: transferBills.length === 1,
    previousHeldProvenFromPaidInitialEvidence: depositEvidence.classification === "VERIFIED" && depositEvidence.heldKnown,
    destinationRequirementRecorded: destinationRequired > 0,
    exactSettlementRecomputable: correctedTotal !== null,
    paymentCoversCorrectedSettlement: correctedTotal !== null && provenPaid + 0.01 >= correctedTotal,
    noPaymentFabricationRequired: billPayments.length > 0 || canonicalPaidAmount > 0,
  };
  const repairReady = Object.values(proofPredicates).every(Boolean);

  const beforeAfter = bill ? {
    transferSettlementBill: {
      id: sid(bill._id),
      before: {
        securityDepositCharge: bill.charges?.securityDeposit ?? null,
        totalAmount: bill.totalAmount,
        paidAmount: bill.paidAmount,
        remainingAmount: bill.remainingAmount,
        status: bill.status,
        depositPreviouslyHeld: bill.transferSnapshot?.depositPreviouslyHeld ?? null,
        additionalDepositDue: bill.transferSnapshot?.additionalDepositDue ?? null,
      },
      after: {
        securityDepositCharge: correctedDepositDue,
        totalAmount: correctedTotal,
        paidAmount: bill.paidAmount,
        remainingAmount: correctedRemaining,
        status: correctedStatus,
        depositPreviouslyHeld: previousVerifiedHeld,
        additionalDepositDue: correctedDepositDue,
      },
    },
    reservationDepositHeld: {
      before: reservation.securityDepositHeld ?? null,
      after: correctedHeld,
      correction: correctedHeld === null ? null : roundMoney(correctedHeld - Number(reservation.securityDepositHeld || 0)),
    },
  } : null;

  let applied = false;
  if (apply) {
    if (!repairReady) throw new Error("Repair proof predicates are not all true; refusing apply.");
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const ledgerKey = `adriane_room_transfer_reconciliation:${sid(bill._id)}`;
        const billResult = await Bill.updateOne(
          {
            _id: bill._id,
            totalAmount: bill.totalAmount,
            paidAmount: bill.paidAmount,
            remainingAmount: bill.remainingAmount,
            "transferSnapshot.depositPreviouslyHeld": bill.transferSnapshot?.depositPreviouslyHeld ?? null,
          },
          {
            $set: {
              "charges.securityDeposit": correctedDepositDue,
              totalAmount: correctedTotal,
              grossAmount: correctedTotal,
              remainingAmount: correctedRemaining,
              status: correctedStatus,
              "transferSnapshot.depositPreviouslyHeld": previousVerifiedHeld,
              "transferSnapshot.additionalDepositDue": correctedDepositDue,
              "transferSnapshot.depositComponentDue": correctedDepositDue,
              "transferSnapshot.totalImmediateDue": correctedTotal,
            },
          },
          { session },
        );
        if (billResult.modifiedCount !== 1) throw new Error("Transfer Bill changed since dry-run; refusing repair.");
        const adjustment = roundMoney(correctedHeld - Number(reservation.securityDepositHeld || 0));
        const reservationResult = await Reservation.updateOne(
          { _id: reservation._id, securityDepositHeld: reservation.securityDepositHeld ?? null, "securityDepositLedger.idempotencyKey": { $ne: ledgerKey } },
          {
            $set: { securityDepositHeld: correctedHeld },
            $push: { securityDepositLedger: {
              kind: "manual_correction",
              previousHeld: reservation.securityDepositHeld ?? null,
              adjustmentAmount: adjustment,
              resultingHeld: correctedHeld,
              sourceRef: { kind: "bill", id: bill._id },
              scheduledRoomTransferId: schedule._id,
              billId: bill._id,
              idempotencyKey: ledgerKey,
              reason: "Forensic Room Transfer reconciliation from paid initial-deposit evidence and existing settlement payments; no payment record changed.",
              createdAt: new Date(),
            } },
          },
          { session },
        );
        if (reservationResult.modifiedCount !== 1) throw new Error("Reservation deposit state changed since dry-run; refusing repair.");
      });
      applied = true;
    } finally {
      await session.endSession();
    }
  }

  const roomById = new Map(rooms.map((room) => [sid(room._id), room]));
  const timeline = {
    sourceStay: stays[0] ? { ...stays[0], _id: sid(stays[0]._id), room: roomById.get(sid(stays[0].roomId))?.roomNumber || null } : null,
    sourceContract: contracts[0] || null,
    depositEvidence,
    securityDepositLedger: reservation.securityDepositLedger || [],
    destinationStay: stays.at(-1) ? { ...stays.at(-1), _id: sid(stays.at(-1)._id), room: roomById.get(sid(stays.at(-1).roomId))?.roomNumber || null } : null,
    scheduledTransfer: schedule,
    transferSettlement: bill,
    paymentPostings: billPayments,
    currentSettlementState: bill ? { totalAmount: bill.totalAmount, paidAmount: bill.paidAmount, remainingAmount: bill.remainingAmount, status: bill.status } : null,
  };
  process.stdout.write(`${JSON.stringify({
    dryRun: !apply,
    generatedAt: new Date().toISOString(),
    tenant: { id: sid(tenant._id), name: `${tenant.firstName} ${tenant.lastName}` },
    proofPredicates,
    repairReady,
    evidence: { previousVerifiedHeld, destinationRequired, correctedDepositDue, correctedTotal, settledPaymentTotal, canonicalPaidAmount, provenPaid },
    beforeAfter,
    timeline,
    applied,
    paymentsCreatedOrChanged: false,
  }, null, 2)}\n`);
} finally {
  await auditConnection.close();
}
