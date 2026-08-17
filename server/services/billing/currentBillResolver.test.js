import { describe, expect, test } from "@jest/globals";
import {
  NON_DRAFT_BILL_FILTER,
  CURRENT_BILL_SORT,
  selectCurrentBillFromList,
} from "./currentBillResolver.js";

// Root cause this guards: rent bills are pre-generated ~7 days ahead of
// their own billingCycleStart (services/billing/rentGenerator.js
// RENT_GENERATION_LEAD_DAYS), so during that window a tenant can have both
// an already-released current-cycle bill and a just-created next-cycle
// bill (later billingCycleStart, utilityDispatch still "draft") at once.
// Naively taking bills[0] off a billingCycleStart-descending sort picks the
// future bill — this module's job is to make that impossible, in exactly
// one place, for every consumer (web, mobile Billing, mobile Home).
describe("selectCurrentBillFromList", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");

  test("prefers the bill whose cycle window contains now, even if it sorts second (not billingCycleStart order)", () => {
    const futureBill = {
      _id: "future",
      billingCycleStart: new Date("2026-09-01"),
      billingCycleEnd: new Date("2026-10-01"),
    };
    const currentBill = {
      _id: "current",
      billingCycleStart: new Date("2026-08-01"),
      billingCycleEnd: new Date("2026-09-01"),
    };
    // Sorted by CURRENT_BILL_SORT (billingCycleStart desc) — future first.
    const result = selectCurrentBillFromList([futureBill, currentBill], now);
    expect(result._id).toBe("current");
  });

  test("falls back to bills[0] (most recent by CURRENT_BILL_SORT) when no bill's window contains now", () => {
    const olderBill = { _id: "older", billingCycleStart: new Date("2026-06-01"), billingCycleEnd: new Date("2026-07-01") };
    const newerBill = { _id: "newer", billingCycleStart: new Date("2026-07-01"), billingCycleEnd: new Date("2026-08-01") };
    const result = selectCurrentBillFromList([newerBill, olderBill], now);
    expect(result._id).toBe("newer");
  });

  test("falls back to bills[0] when a bill is missing billingCycleStart/billingCycleEnd (legacy record)", () => {
    const legacyBill = { _id: "legacy", billingCycleStart: null, billingCycleEnd: null };
    const result = selectCurrentBillFromList([legacyBill], now);
    expect(result._id).toBe("legacy");
  });

  test("a historical/settled bill whose cycle window has already closed is not selected over the genuinely current cycle", () => {
    const settledBill = { _id: "settled", billingCycleStart: new Date("2026-06-01"), billingCycleEnd: new Date("2026-07-01"), status: "paid" };
    const currentBill = { _id: "current", billingCycleStart: new Date("2026-08-01"), billingCycleEnd: new Date("2026-09-01") };
    const result = selectCurrentBillFromList([currentBill, settledBill], now);
    expect(result._id).toBe("current");
  });

  test("returns null for an empty or non-array input", () => {
    expect(selectCurrentBillFromList([], now)).toBeNull();
    expect(selectCurrentBillFromList(null, now)).toBeNull();
    expect(selectCurrentBillFromList(undefined, now)).toBeNull();
  });
});

// NON_DRAFT_BILL_FILTER / CURRENT_BILL_SORT are the query fragments every
// consumer (billingQueryController.js, mobileBillingRoutes.js,
// dashboard.controller.js) must apply BEFORE calling
// selectCurrentBillFromList. Locking their exact shape here means a future
// edit to either constant is a single, deliberate, reviewed change — not a
// silent divergence in just one consumer.
describe("NON_DRAFT_BILL_FILTER / CURRENT_BILL_SORT", () => {
  test("excludes draft and archived bills", () => {
    expect(NON_DRAFT_BILL_FILTER).toEqual({ status: { $ne: "draft" }, isArchived: false });
  });

  test("orders by billingCycleStart first, never dueDate", () => {
    expect(CURRENT_BILL_SORT).toEqual({ billingCycleStart: -1, billingMonth: -1, createdAt: -1 });
    expect(CURRENT_BILL_SORT).not.toHaveProperty("dueDate");
  });
});

// Cross-consumer parity: applying the exact filter + sort + selector every
// consumer is wired to (billingQueryController.getCurrentBilling,
// mobileBillingRoutes /billing/me/latest, dashboard.controller latest_bill)
// against the same raw dataset must resolve the identical bill. This
// doesn't invoke the three consumers directly (they have their own
// integration/unit tests) — it proves the shared primitives they all now
// call are internally consistent for the exact scenario class the original
// bug came from.
describe("cross-consumer parity dataset", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");

  function applyCanonicalSelection(allBills, extraFilter = {}) {
    const eligible = allBills.filter((b) => {
      if (b.status === NON_DRAFT_BILL_FILTER.status.$ne) return false;
      if (b.isArchived !== NON_DRAFT_BILL_FILTER.isArchived) return false;
      return Object.entries(extraFilter).every(([key, value]) => b[key] === value);
    });
    const sorted = [...eligible].sort((a, b) => {
      for (const key of Object.keys(CURRENT_BILL_SORT)) {
        const av = a[key] ? new Date(a[key]).getTime() : 0;
        const bv = b[key] ? new Date(b[key]).getTime() : 0;
        if (av !== bv) return CURRENT_BILL_SORT[key] === -1 ? bv - av : av - bv;
      }
      return 0;
    });
    return selectCurrentBillFromList(sorted, now);
  }

  test("current cycle wins over a future pre-generated cycle for every consumer", () => {
    const currentBill = {
      _id: "current", userId: "tenant-1", reservationId: "res-1",
      status: "pending", isArchived: false,
      billingCycleStart: new Date("2026-08-01"), billingCycleEnd: new Date("2026-09-01"),
      billingMonth: new Date("2026-08-01"), dueDate: new Date("2026-08-01"), createdAt: new Date("2026-07-25"),
      releasedAt: new Date("2026-08-01"),
      utilityDispatch: { electricity: { state: "sent" } },
    };
    const futureBill = {
      _id: "future", userId: "tenant-1", reservationId: "res-1",
      status: "pending", isArchived: false,
      billingCycleStart: new Date("2026-09-01"), billingCycleEnd: new Date("2026-10-01"),
      billingMonth: new Date("2026-09-01"), dueDate: new Date("2026-09-01"), createdAt: new Date("2026-08-25"),
      releasedAt: null,
      utilityDispatch: { electricity: { state: "draft" } },
    };
    const dataset = [currentBill, futureBill];

    // Web resolver scopes by reservationId; mobile resolvers scope by userId.
    const webResult = applyCanonicalSelection(dataset, { reservationId: "res-1" });
    const mobileBillingResult = applyCanonicalSelection(dataset, { userId: "tenant-1" });
    const dashboardResult = applyCanonicalSelection(dataset, { userId: "tenant-1" });

    expect(webResult._id).toBe("current");
    expect(mobileBillingResult._id).toBe("current");
    expect(dashboardResult._id).toBe("current");
  });

  test("a genuinely unreleased current cycle is reported as current everywhere, not skipped", () => {
    const currentUnreleased = {
      _id: "current-unreleased", userId: "tenant-1", reservationId: "res-1",
      status: "pending", isArchived: false,
      billingCycleStart: new Date("2026-08-01"), billingCycleEnd: new Date("2026-09-01"),
      billingMonth: new Date("2026-08-01"), dueDate: new Date("2026-08-01"), createdAt: new Date("2026-07-25"),
      releasedAt: new Date("2026-08-01"),
      utilityDispatch: { electricity: { state: "draft" } },
    };
    const dataset = [currentUnreleased];

    expect(applyCanonicalSelection(dataset, { reservationId: "res-1" })._id).toBe("current-unreleased");
    expect(applyCanonicalSelection(dataset, { userId: "tenant-1" })._id).toBe("current-unreleased");
  });

  test("archived records and draft placeholders never override the current bill for any consumer", () => {
    const currentBill = {
      _id: "current", userId: "tenant-1", reservationId: "res-1",
      status: "pending", isArchived: false,
      billingCycleStart: new Date("2026-08-01"), billingCycleEnd: new Date("2026-09-01"),
      billingMonth: new Date("2026-08-01"), dueDate: new Date("2026-08-01"), createdAt: new Date("2026-07-25"),
    };
    const archivedBill = {
      _id: "archived", userId: "tenant-1", reservationId: "res-1",
      status: "pending", isArchived: true,
      billingCycleStart: new Date("2026-09-01"), billingCycleEnd: new Date("2026-10-01"),
      billingMonth: new Date("2026-09-01"), dueDate: new Date("2026-09-01"), createdAt: new Date("2026-08-30"),
    };
    const draftBill = {
      _id: "draft", userId: "tenant-1", reservationId: "res-1",
      status: "draft", isArchived: false,
      billingCycleStart: new Date("2026-09-01"), billingCycleEnd: new Date("2026-10-01"),
      billingMonth: new Date("2026-09-01"), dueDate: new Date("2026-09-01"), createdAt: new Date("2026-08-30"),
    };
    const dataset = [currentBill, archivedBill, draftBill];

    expect(applyCanonicalSelection(dataset, { reservationId: "res-1" })._id).toBe("current");
    expect(applyCanonicalSelection(dataset, { userId: "tenant-1" })._id).toBe("current");
  });

  test("a legacy bill without billingCycleEnd and historical settled records don't confuse any consumer", () => {
    const legacyBill = {
      _id: "legacy", userId: "tenant-1", reservationId: "res-1",
      status: "paid", isArchived: false,
      billingCycleStart: new Date("2026-05-01"), billingCycleEnd: null,
      billingMonth: new Date("2026-05-01"), dueDate: new Date("2026-05-01"), createdAt: new Date("2026-04-25"),
    };
    const settledBill = {
      _id: "settled", userId: "tenant-1", reservationId: "res-1",
      status: "paid", isArchived: false,
      billingCycleStart: new Date("2026-07-01"), billingCycleEnd: new Date("2026-08-01"),
      billingMonth: new Date("2026-07-01"), dueDate: new Date("2026-07-01"), createdAt: new Date("2026-06-25"),
    };
    const currentBill = {
      _id: "current", userId: "tenant-1", reservationId: "res-1",
      status: "pending", isArchived: false,
      billingCycleStart: new Date("2026-08-01"), billingCycleEnd: new Date("2026-09-01"),
      billingMonth: new Date("2026-08-01"), dueDate: new Date("2026-08-01"), createdAt: new Date("2026-07-25"),
    };
    const dataset = [legacyBill, settledBill, currentBill];

    expect(applyCanonicalSelection(dataset, { reservationId: "res-1" })._id).toBe("current");
    expect(applyCanonicalSelection(dataset, { userId: "tenant-1" })._id).toBe("current");
  });
});
