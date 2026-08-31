/**
 * Room Transfer legacy security-deposit-held backfill.
 * DEFAULT: DRY RUN. --apply remains explicit but is refused by the production
 * read-only audit connection path.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Reservation, Room, User } from "../models/index.js";
import { CURRENT_RESIDENT_STATUS_QUERY } from "../utils/lifecycleNaming.js";
import { resolveVerifiedSecurityDepositHeld } from "../services/billing/securityDepositEvidenceService.js";
import {
  openRoomTransferReadOnlyAudit,
  parseRoomTransferAuditMode,
  printRoomTransferAuditMode,
} from "./roomTransferReadOnlyAuditSafety.mjs";

const { apply } = parseRoomTransferAuditMode(process.argv.slice(2));
printRoomTransferAuditMode({ apply });

const sid = (value) => (value ? String(value) : null);

const auditConnection = await openRoomTransferReadOnlyAudit({
  mongoose,
  models: { Reservation, Room, User },
  apply,
});
try {
  const reservations = await Reservation.find({
    status: CURRENT_RESIDENT_STATUS_QUERY,
    isArchived: { $ne: true },
    $or: [
      { securityDepositHeld: null },
      { securityDepositHeld: { $exists: false } },
    ],
  }).sort({ createdAt: 1 }).lean();

  const tenantIds = reservations.map((reservation) => reservation.userId).filter(Boolean);
  const roomIds = reservations.map((reservation) => reservation.roomId).filter(Boolean);
  const [tenants, rooms] = await Promise.all([
    User.find({ _id: { $in: tenantIds } }).select("firstName lastName email user_id branch").lean(),
    Room.find({ _id: { $in: roomIds } }).select("name roomNumber branch type").lean(),
  ]);
  const tenantsById = new Map(tenants.map((tenant) => [sid(tenant._id), tenant]));
  const roomsById = new Map(rooms.map((room) => [sid(room._id), room]));

  const records = [];
  for (const reservation of reservations) {
    const evidence = await resolveVerifiedSecurityDepositHeld({ reservation });
    const tenant = tenantsById.get(sid(reservation.userId));
    const room = roomsById.get(sid(reservation.roomId));
    const action = evidence.classification === "VERIFIED" && evidence.heldKnown
      ? "BACKFILL"
      : evidence.classification === "PARTIALLY_PROVABLE"
        ? "MANUAL_REVIEW"
        : "MANUAL_REVIEW";
    let applied = false;

    if (apply && action === "BACKFILL") {
      const idempotencyKey = `security_deposit_held_backfill:${sid(reservation._id)}`;
      const result = await Reservation.updateOne(
        {
          _id: reservation._id,
          $or: [
            { securityDepositHeld: null },
            { securityDepositHeld: { $exists: false } },
          ],
          "securityDepositLedger.idempotencyKey": { $ne: idempotencyKey },
        },
        {
          $set: { securityDepositHeld: evidence.amount },
          $push: {
            securityDepositLedger: {
              kind: "backfill",
              previousHeld: null,
              adjustmentAmount: evidence.amount,
              resultingHeld: evidence.amount,
              sourceRef: {
                kind: evidence.evidenceSourceRef?.kind || (evidence.billIds?.[0] ? "bill" : "payment"),
                id: evidence.evidenceSourceRef?.id || evidence.billIds?.[0] || evidence.paymentIds?.[0] || null,
              },
              billId: evidence.billIds?.[0] || null,
              paymentId: evidence.paymentIds?.[0] || null,
              idempotencyKey,
              reason: `Legacy Room Transfer backfill from ${evidence.source}.`,
              createdAt: new Date(),
            },
          },
        },
      );
      applied = result.modifiedCount === 1;
    }

    records.push({
      reservation: sid(reservation._id),
      tenant: tenant ? `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() : null,
      tenantUserId: tenant?.user_id || sid(reservation.userId),
      branch: room?.branch || tenant?.branch || null,
      currentRoom: room?.name || room?.roomNumber || null,
      currentSecurityDepositHeld: reservation.securityDepositHeld ?? null,
      proposedHeldAmount: evidence.heldKnown ? evidence.amount : null,
      exactEvidenceSource: evidence.source,
      billIds: evidence.billIds || [],
      paymentIds: evidence.paymentIds || [],
      confidenceClassification: evidence.classification,
      action,
      applied,
    });
  }

  const counts = {
    audited: records.length,
    VERIFIED: records.filter((record) => record.confidenceClassification === "VERIFIED").length,
    PARTIALLY_PROVABLE: records.filter((record) => record.confidenceClassification === "PARTIALLY_PROVABLE").length,
    UNKNOWN: records.filter((record) => record.confidenceClassification === "UNKNOWN").length,
    BACKFILL: records.filter((record) => record.action === "BACKFILL").length,
    MANUAL_REVIEW: records.filter((record) => record.action === "MANUAL_REVIEW").length,
    SKIP: records.filter((record) => record.action === "SKIP").length,
    applied: records.filter((record) => record.applied).length,
  };
  process.stdout.write(`${JSON.stringify({ dryRun: !apply, generatedAt: new Date().toISOString(), counts, records }, null, 2)}\n`);
} finally {
  await auditConnection.close();
}
