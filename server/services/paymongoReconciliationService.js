/**
 * ============================================================================
 * PAYMONGO PROVIDER RECONCILIATION SERVICE
 * ============================================================================
 *
 * Durable safety net for PayMongo checkout sessions that were paid at the
 * gateway but never confirmed internally — a missed/misrouted webhook
 * delivery, or a tenant who closed the checkout tab before the browser
 * completed its return redirect (both of which leave the Bill/Reservation
 * ledger unaware the payment succeeded).
 *
 * This does NOT reimplement settlement. It re-uses the same webhook
 * handlers (handleDepositPayment / handleBillPayment / handleMultiBillPayment)
 * that a live PayMongo webhook delivery calls, so every path that can settle
 * a session goes through the same idempotent ledger writes
 * (settlePaymongoBill / settleReservationDeposit). Whichever path — webhook,
 * client redirect polling, or this scheduled sweep — reaches a session
 * first "wins"; the others are safe no-ops.
 * ============================================================================
 */

import { Bill, Reservation } from "../models/index.js";
import { getCheckoutSession } from "../config/paymongo.js";
import { readPaidPayments } from "../utils/paymongoPaymentMethod.js";
import logger from "../middleware/logger.js";

// Lazily imported: webhookController.js pulls in the full settlement/email/
// notification dependency graph. Loading it only when a session actually
// needs settling keeps this service (and the scheduler module that wires it
// up) cheap to import, and avoids widening scheduler.js's static import
// graph for anything that merely imports the scheduler without running it.
let webhookHandlersPromise = null;
function getWebhookHandlers() {
  if (!webhookHandlersPromise) {
    webhookHandlersPromise = import("../controllers/webhookController.js");
  }
  return webhookHandlersPromise;
}

const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_BATCH_LIMIT = 200;

function collectCandidateSessionIds(bills, reservations) {
  const sessionIds = new Set();
  for (const bill of bills) {
    if (bill.paymongoSessionId) sessionIds.add(bill.paymongoSessionId);
  }
  for (const reservation of reservations) {
    if (reservation.paymongoSessionId) sessionIds.add(reservation.paymongoSessionId);
  }
  return [...sessionIds];
}

export async function reconcilePendingPaymongoSessions({
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
  limit = DEFAULT_BATCH_LIMIT,
} = {}) {
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const [unsettledBills, unsettledReservations] = await Promise.all([
    Bill.find({
      paymongoSessionId: { $type: "string" },
      status: { $nin: ["paid", "voided", "waived"] },
      isArchived: { $ne: true },
      updatedAt: { $gte: cutoff },
    })
      .select("paymongoSessionId")
      .limit(limit)
      .lean(),
    Reservation.find({
      paymongoSessionId: { $type: "string" },
      paymentStatus: { $ne: "paid" },
      isArchived: { $ne: true },
      updatedAt: { $gte: cutoff },
    })
      .select("paymongoSessionId")
      .limit(limit)
      .lean(),
  ]);

  const sessionIds = collectCandidateSessionIds(unsettledBills, unsettledReservations);

  let checked = 0;
  let reconciled = 0;
  let failed = 0;

  for (const sessionId of sessionIds) {
    checked += 1;
    try {
      const session = await getCheckoutSession(sessionId);
      const paidPayments = readPaidPayments(session);
      if (paidPayments.length === 0) continue;

      const metadata = session?.attributes?.metadata || {};
      const context = { eventId: `reconcile:${sessionId}`, sessionId };

      if (metadata.type === "deposit" && metadata.reservationId) {
        const { handleDepositPayment } = await getWebhookHandlers();
        await handleDepositPayment(metadata, session, context);
        reconciled += 1;
      } else if (metadata.type === "bill" && metadata.billId) {
        const { handleBillPayment } = await getWebhookHandlers();
        await handleBillPayment(metadata, session, context);
        reconciled += 1;
      } else if (metadata.type === "multi_bill") {
        const { handleMultiBillPayment } = await getWebhookHandlers();
        await handleMultiBillPayment(metadata, session, context);
        reconciled += 1;
      } else {
        logger.warn(
          { sessionId, metadataType: metadata.type },
          "PayMongo reconciliation: paid session has unrecognized metadata, skipping",
        );
      }
    } catch (err) {
      failed += 1;
      logger.error({ err, sessionId }, "PayMongo reconciliation: failed to reconcile session");
    }
  }

  if (checked > 0) {
    logger.info(
      { checked, reconciled, failed },
      "PayMongo reconciliation sweep complete",
    );
  }

  return { checked, reconciled, failed };
}

export default { reconcilePendingPaymongoSessions };
