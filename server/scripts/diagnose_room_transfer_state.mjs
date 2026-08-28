/**
 * ============================================================================
 * READ-ONLY: diagnose room-transfer lifecycle inconsistencies
 * ============================================================================
 *
 * Reports, per current tenant, any state that the one-step transfer
 * workflow (server/utils/tenantActionService.js) is designed to prevent but
 * that older two-step / manual transfers may have left behind:
 *
 *   A. >1 non-terminal "replacement" Contract for the same predecessor
 *      (contractPurpose:"replacement", replacesContractId=X, status not in
 *      cancelled/voided/rejected/archived) — MULTIPLE_TRANSFER_SUCCESSORS.
 *   B. A "replaced" predecessor Contract whose successor never became
 *      current (successor.isCurrent !== true) — a stuck cutover.
 *   C. >1 Contract with isCurrent:true for the same tenant.
 *   D. A tenant whose current Contract's roomId disagrees with their active
 *      Stay's roomId (contract points at the old room).
 *   E. A tenant whose active Stay's roomId disagrees with their Reservation's
 *      roomId.
 *   F. A "replacement" successor that is isCurrent:true but still status
 *      "published"/"generated" with no finalDocument AND its predecessor is
 *      still isCurrent:true too (both-current ambiguity).
 *   G. An active BedHistory row whose bedId no longer exists on its room's
 *      beds[] (excluding the private-room sentinel "room-<id>").
 *
 * NEVER writes. Bails out if any write-intent flag is passed.
 * ============================================================================
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Contract, Reservation, Stay, Room, BedHistory, User } from "../models/index.js";

dotenv.config();

if (process.argv.some((a) => ["--write", "--apply", "--fix", "--repair", "--delete"].includes(a))) {
  throw new Error("Read-only script — no write flags accepted.");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const ABANDONED = new Set(["cancelled", "voided", "rejected", "archived"]);
const id = (v) => (v ? String(v) : "");
const same = (a, b) => id(a) && id(a) === id(b);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const findings = { A: [], B: [], C: [], D: [], E: [], F: [], G: [] };

  // ── A + B + F: replacement-Contract lineage ────────────────────────────────
  const replacements = await Contract.find({ contractPurpose: "replacement" })
    .select("_id contractNumber tenantId replacesContractId status isCurrent finalDocument roomId roomNumber")
    .lean();
  const byPredecessor = new Map();
  for (const c of replacements) {
    const k = id(c.replacesContractId);
    if (!k) continue;
    if (!byPredecessor.has(k)) byPredecessor.set(k, []);
    byPredecessor.get(k).push(c);
  }
  for (const [predId, succs] of byPredecessor) {
    const live = succs.filter((s) => !ABANDONED.has(s.status));
    if (live.length > 1) {
      findings.A.push({
        predecessorContractId: predId,
        successors: live.map((s) => ({ id: id(s._id), number: s.contractNumber, status: s.status, isCurrent: s.isCurrent })),
      });
    }
    const predecessor = await Contract.findById(predId)
      .select("_id contractNumber status isCurrent tenantId").lean();
    if (!predecessor) continue;
    if (predecessor.status === "replaced") {
      const current = live.find((s) => s.isCurrent === true);
      if (!current) {
        findings.B.push({
          predecessorContractId: predId,
          predecessorNumber: predecessor.contractNumber,
          tenantId: id(predecessor.tenantId),
          liveSuccessors: live.map((s) => ({ id: id(s._id), status: s.status, isCurrent: s.isCurrent })),
        });
      }
    }
    if (predecessor.isCurrent === true) {
      const currentSucc = live.find((s) => s.isCurrent === true);
      if (currentSucc) {
        findings.F.push({
          predecessorContractId: predId,
          predecessorNumber: predecessor.contractNumber,
          successorId: id(currentSucc._id),
          successorStatus: currentSucc.status,
          successorHasFinal: Boolean(currentSucc.finalDocument),
          tenantId: id(predecessor.tenantId),
        });
      }
    }
  }

  // ── C: >1 current Contract per tenant ─────────────────────────────────────
  const currentByTenant = await Contract.aggregate([
    { $match: { isCurrent: true } },
    { $group: { _id: "$tenantId", count: { $sum: 1 }, contracts: { $push: { id: "$_id", number: "$contractNumber", status: "$status", roomNumber: "$roomNumber" } } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  findings.C = currentByTenant.map((r) => ({ tenantId: id(r._id), count: r.count, contracts: r.contracts.map((c) => ({ ...c, id: id(c.id) })) }));

  // ── D + E: room disagreement across Contract / Stay / Reservation ─────────
  const activeStays = await Stay.find({ status: "active" })
    .select("_id tenantId reservationId roomId bedId").lean();
  for (const stay of activeStays) {
    const [contract, reservation] = await Promise.all([
      Contract.findOne({ tenantId: stay.tenantId, isCurrent: true }).select("_id contractNumber roomId roomNumber status").lean(),
      Reservation.findById(stay.reservationId).select("_id roomId status").lean(),
    ]);
    if (contract && contract.roomId && !same(contract.roomId, stay.roomId)) {
      findings.D.push({
        tenantId: id(stay.tenantId),
        stayId: id(stay._id),
        stayRoomId: id(stay.roomId),
        currentContractId: id(contract._id),
        currentContractNumber: contract.contractNumber,
        contractRoomId: id(contract.roomId),
        contractStatus: contract.status,
      });
    }
    if (reservation && reservation.roomId && !same(reservation.roomId, stay.roomId)) {
      findings.E.push({
        tenantId: id(stay.tenantId),
        stayId: id(stay._id),
        stayRoomId: id(stay.roomId),
        reservationId: id(reservation._id),
        reservationRoomId: id(reservation.roomId),
      });
    }
  }

  // ── G: active BedHistory bedId not on the room ───────────────────────────
  const activeBedHistories = await BedHistory.find({ status: "active" })
    .select("_id tenantId roomId bedId reservationId").lean();
  const roomIds = [...new Set(activeBedHistories.map((b) => id(b.roomId)).filter(Boolean))];
  const rooms = await Room.find({ _id: { $in: roomIds } }).select("_id roomNumber type beds").lean();
  const roomMap = new Map(rooms.map((r) => [id(r._id), r]));
  for (const bh of activeBedHistories) {
    const room = roomMap.get(id(bh.roomId));
    if (!room) continue;
    if (bh.bedId === `room-${id(bh.roomId)}`) continue; // private-room sentinel
    if (room.type === "private") continue;
    const exists = (room.beds || []).some(
      (b) => id(b.id) === id(bh.bedId) || id(b._id) === id(bh.bedId),
    );
    if (!exists) {
      findings.G.push({
        bedHistoryId: id(bh._id),
        tenantId: id(bh.tenantId),
        roomId: id(bh.roomId),
        roomNumber: room.roomNumber,
        roomType: room.type,
        bedId: bh.bedId,
      });
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────
  const labels = {
    A: "Multiple live replacement successors for one predecessor",
    B: '"replaced" predecessor with no current successor (stuck cutover)',
    C: ">1 current Contract for one tenant",
    D: "Current Contract room != active Stay room",
    E: "Active Stay room != Reservation room",
    F: "Predecessor AND successor both isCurrent (both-current ambiguity)",
    G: "Active BedHistory bedId not present on its room",
  };
  console.log("\n=== ROOM TRANSFER STATE DIAGNOSTIC (read-only) ===\n");
  let total = 0;
  for (const key of Object.keys(findings)) {
    const rows = findings[key];
    total += rows.length;
    console.log(`[${key}] ${labels[key]}: ${rows.length}`);
    for (const row of rows) console.log("   ", JSON.stringify(row));
  }
  console.log(`\nTOTAL affected records: ${total}`);
  console.log(
    total === 0
      ? "\nNo transfer-lifecycle inconsistencies found.\n"
      : "\nClassify each before any repair. B/D are usually deterministic " +
        "(activate the single live successor / point Contract at the Stay's room); " +
        "A/C/F need admin review; G may be a legitimate bed rename.\n",
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
