/**
 * ============================================================================
 * CURRENT BILL RESOLVER (canonical, cross-consumer)
 * ============================================================================
 *
 * The single implementation of "which bill is the tenant's actual current
 * bill" — used identically by the web app
 * (controllers/billing/billingQueryController.js getCurrentBilling), the
 * mobile Billing tab (routes/mobileBillingRoutes.js /billing/me/latest), and
 * the mobile Home/dashboard (mobile/controllers/dashboard.controller.js
 * latest_bill). Deliberately has no web- or mobile-specific ownership: it is
 * pure data selection over an already-fetched, already-filtered/sorted bill
 * list, so any consumer — Mongoose or the raw MongoDB driver — can use it
 * without this module ever touching the database itself.
 *
 * Rule (do not reimplement elsewhere — extend this module instead):
 *   1. From eligible bills (non-draft, non-archived — see
 *      NON_DRAFT_BILL_FILTER), prefer the one whose
 *      [billingCycleStart, billingCycleEnd) window contains `now`.
 *   2. If no bill's cycle window contains `now` (between cycles, or a
 *      legacy record missing billingCycleEnd), fall back to the most
 *      recent bill by CURRENT_BILL_SORT.
 *
 * Why this rule exists at all: rent bills are pre-generated ~7 days ahead
 * of their own billingCycleStart (services/billing/rentGenerator.js
 * RENT_GENERATION_LEAD_DAYS) with a non-draft status, so for that ~7-day
 * window a tenant can have BOTH their still-open current-cycle bill AND the
 * next cycle's freshly generated bill (later billingCycleStart/dueDate,
 * utilityDispatch still "draft") at once. Picking the most-recent bill by
 * billingCycleStart or dueDate alone surfaces the future bill and
 * misreports its undispatched utilities as "not released", contradicting
 * the already-released current bill — the exact class of bug this resolver
 * exists to prevent from being reimplemented differently per consumer.
 */

export const NON_DRAFT_BILL_FILTER = Object.freeze({ status: { $ne: "draft" }, isArchived: false });
export const CURRENT_BILL_SORT = Object.freeze({ billingCycleStart: -1, billingMonth: -1, createdAt: -1 });

/**
 * @param {Array<Object>} bills - NON_DRAFT_BILL_FILTER-filtered bills, sorted by CURRENT_BILL_SORT
 * @param {Date} [now]
 * @returns {Object|null}
 */
export function selectCurrentBillFromList(bills, now = new Date()) {
  if (!Array.isArray(bills) || bills.length === 0) return null;
  const nowTime = (now instanceof Date ? now : new Date(now)).getTime();
  const windowMatch = bills.find((bill) => {
    if (!bill.billingCycleStart || !bill.billingCycleEnd) return false;
    const start = new Date(bill.billingCycleStart).getTime();
    const end = new Date(bill.billingCycleEnd).getTime();
    return start <= nowTime && end > nowTime;
  });
  return windowMatch || bills[0];
}
