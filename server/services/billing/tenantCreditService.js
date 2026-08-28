/**
 * ============================================================================
 * TENANT CREDIT SERVICE
 * ============================================================================
 * Create and consume TenantCredit records (models/TenantCredit.js).
 *
 * Producers (currently only room-transfer settlement) call
 * `recordRoomTransferRentCredit` with an idempotencyKey; consumers (regular
 * rent Bill generation) call `applyRentCreditToBill` which consumes the
 * oldest active rent credit first, appends an idempotent applications[]
 * entry, and returns the amount applied so the caller can add a matching
 * `charges.discount` line and reduce the Bill total.
 *
 * All writes participate in the caller's Mongo session when one is given.
 * Rent credit is ONLY ever applied to a Bill's RENT component — never
 * utilities / penalties / deposit / reservation fee.
 * ============================================================================
 */
import { TenantCredit } from "../../models/index.js";
import { roundMoney } from "./billingPolicy.js";

/**
 * Idempotently record an excess-prepaid-RENT credit produced by a room
 * transfer. A retried transfer (same predecessor Contract) resolves the
 * existing credit instead of creating a second one.
 *
 * @returns {Promise<import("mongoose").Document>} the TenantCredit doc
 */
export async function recordRoomTransferRentCredit({
  userId,
  reservationId,
  branch = "",
  amount,
  transferReference, // predecessor Contract id — the canonical transfer id
  sourceBillId = null, // the transfer_settlement Bill
  idempotencyKey,
  reason = "",
  createdBy = null,
  session = null,
} = {}) {
  const value = roundMoney(amount);
  if (!(value > 0)) return null;
  if (!idempotencyKey) {
    throw Object.assign(new Error("recordRoomTransferRentCredit requires an idempotencyKey."), {
      code: "CREDIT_IDEMPOTENCY_KEY_REQUIRED",
    });
  }

  const existing = await TenantCredit.findOne({ idempotencyKey }).session(session || null);
  if (existing) return existing;

  try {
    const [doc] = await TenantCredit.create(
      [
        {
          userId,
          reservationId: reservationId || null,
          branch,
          sourceType: "room_transfer",
          sourceRef: { kind: sourceBillId ? "bill" : "contract", id: sourceBillId || transferReference || null },
          transferReference: transferReference || null,
          category: "rent",
          originalAmount: value,
          consumedAmount: 0,
          remainingBalance: value,
          status: "active",
          idempotencyKey,
          reason: reason || "Excess prepaid rent from room transfer",
          createdBy,
        },
      ],
      session ? { session } : undefined,
    );
    return doc;
  } catch (err) {
    // Unique-index race: another concurrent producer created it first.
    if (err?.code === 11000) {
      return TenantCredit.findOne({ idempotencyKey }).session(session || null);
    }
    throw err;
  }
}

/**
 * Total spendable RENT credit for a tenant right now.
 */
export async function getAvailableRentCredit(userId, { session = null } = {}) {
  if (!userId) return 0;
  const rows = await TenantCredit.find({
    userId,
    category: "rent",
    status: "active",
    isArchived: { $ne: true },
  })
    .session(session || null)
    .lean();
  return roundMoney(rows.reduce((sum, r) => sum + Math.max(0, Number(r.remainingBalance) || 0), 0));
}

/**
 * Consume available RENT credit against a Bill's RENT amount.
 *
 *   creditApplied = min(eligibleRentAmount, availableRentCredit)
 *
 * Consumes oldest-active-first. Appends an applications[] entry per credit,
 * keyed by billId — a given Bill consumes from a given credit at most once
 * (so a retried Bill generation for the same billingCycleStart is safe as
 * long as the caller passes the same Bill _id, or reuses the existing Bill).
 *
 * Does NOT mutate the Bill — returns the amount applied and the per-credit
 * breakdown; the caller records a `charges.discount` line and re-syncs the
 * Bill total via the canonical helper.
 *
 * @param {Object} params
 * @param {import("mongoose").Types.ObjectId|string} params.billId
 * @param {import("mongoose").Types.ObjectId|string} params.userId
 * @param {number} params.eligibleRentAmount - the Bill's RENT charge (never the whole total)
 * @param {import("mongoose").ClientSession} [params.session]
 * @param {import("mongoose").Types.ObjectId} [params.appliedBy]
 * @returns {Promise<{applied: number, breakdown: Array<{creditId: string, amount: number}>}>}
 */
export async function applyRentCreditToBill({
  billId,
  userId,
  eligibleRentAmount,
  session = null,
  appliedBy = null,
} = {}) {
  const eligible = roundMoney(eligibleRentAmount);
  if (!billId || !userId || !(eligible > 0)) return { applied: 0, breakdown: [] };

  // Idempotency FIRST: if this Bill already consumed from any credit (of any
  // status — a fully-consumed credit is no longer "active"), report the same
  // total without re-consuming.
  const priorlyApplied = await TenantCredit.find({
    userId,
    category: "rent",
    "applications.billId": billId,
    isArchived: { $ne: true },
  }).session(session || null);
  if (priorlyApplied.length) {
    let total = 0;
    const breakdown = [];
    for (const credit of priorlyApplied) {
      const entry = (credit.applications || []).find((a) => String(a.billId) === String(billId));
      const amt = roundMoney(Number(entry?.amount || 0));
      total = roundMoney(total + amt);
      breakdown.push({ creditId: String(credit._id), amount: amt });
    }
    return { applied: total, breakdown };
  }

  const credits = await TenantCredit.find({
    userId,
    category: "rent",
    status: "active",
    isArchived: { $ne: true },
  })
    .sort({ createdAt: 1, _id: 1 })
    .session(session || null);

  let remainingToCover = eligible;
  let totalApplied = 0;
  const breakdown = [];

  for (const credit of credits) {
    if (remainingToCover <= 0) break;

    const take = roundMoney(Math.min(credit.remainingBalance, remainingToCover));
    if (take <= 0) continue;

    credit.applications.push({ billId, amount: take, appliedAt: new Date(), appliedBy });
    credit.consumedAmount = roundMoney(Number(credit.consumedAmount || 0) + take);
    credit.recomputeBalance();
    await credit.save(session ? { session } : undefined);

    totalApplied = roundMoney(totalApplied + take);
    remainingToCover = roundMoney(remainingToCover - take);
    breakdown.push({ creditId: String(credit._id), amount: take });
  }

  return { applied: totalApplied, breakdown };
}

/**
 * Reverse a prior application of rent credit to a Bill (used if Bill
 * generation rolls back OUTSIDE the same session — normally the session
 * abort handles it). Idempotent: removing an application that is not there
 * is a no-op.
 */
export async function reverseRentCreditForBill({ billId, userId, session = null } = {}) {
  if (!billId || !userId) return { reversed: 0 };
  const credits = await TenantCredit.find({
    userId,
    category: "rent",
    "applications.billId": billId,
    isArchived: { $ne: true },
  }).session(session || null);

  let reversed = 0;
  for (const credit of credits) {
    const entry = (credit.applications || []).find((a) => String(a.billId) === String(billId));
    if (!entry) continue;
    credit.applications = credit.applications.filter((a) => String(a.billId) !== String(billId));
    credit.consumedAmount = roundMoney(Math.max(0, Number(credit.consumedAmount || 0) - Number(entry.amount || 0)));
    credit.recomputeBalance();
    await credit.save(session ? { session } : undefined);
    reversed = roundMoney(reversed + Number(entry.amount || 0));
  }
  return { reversed };
}

export default {
  recordRoomTransferRentCredit,
  getAvailableRentCredit,
  applyRentCreditToBill,
  reverseRentCreditForBill,
};
