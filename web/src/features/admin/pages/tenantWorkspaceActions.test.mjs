import test from "node:test";
import assert from "node:assert/strict";
import {
  getTenantActionMeta,
  hasEnabledTenantAction,
  openTenantAction,
  shouldCloseTenantActionMenu,
  resolveTenantNextAction,
  getTenantIndicator,
  getTenantTabIndicators,
  isTenantAttentionNewForAdmin,
} from "./tenantWorkspaceActions.mjs";

test("getTenantActionMeta returns fallback metadata when the action is missing", () => {
  assert.deepEqual(getTenantActionMeta({}, "renew"), {
    enabled: false,
    reason: "",
  });
});

test("hasEnabledTenantAction detects when at least one tenant action is available", () => {
  const tenant = {
    allowedActions: {
      renew: { enabled: false, reason: "blocked" },
      transfer: { enabled: true, reason: "" },
    },
  };

  assert.equal(hasEnabledTenantAction(tenant, ["renew", "transfer", "moveOut"]), true);
  assert.equal(hasEnabledTenantAction(tenant, ["renew", "moveOut"]), false);
});

test("openTenantAction dispatches enabled actions", () => {
  const tenant = {
    id: "tenant-1",
    allowedActions: {
      renew: { enabled: true, reason: "" },
    },
  };
  const calls = [];

  const opened = openTenantAction({
    tenant,
    actionKey: "renew",
    actionType: "renew",
    notifyBlocked: () => calls.push("blocked"),
    onAction: (payload) => calls.push(payload),
  });

  assert.equal(opened, true);
  assert.deepEqual(calls, [{ type: "renew", tenant }]);
});

test("openTenantAction reports blocked actions instead of silently failing", () => {
  const tenant = {
    allowedActions: {
      moveOut: { enabled: false, reason: "Only active moved-in stays can be moved out." },
    },
  };
  const blocked = [];
  const actions = [];

  const opened = openTenantAction({
    tenant,
    actionKey: "moveOut",
    actionType: "moveOut",
    notifyBlocked: (meta) => blocked.push(meta.reason),
    onAction: (payload) => actions.push(payload),
  });

  assert.equal(opened, false);
  assert.deepEqual(blocked, ["Only active moved-in stays can be moved out."]);
  assert.deepEqual(actions, []);
});

test("shouldCloseTenantActionMenu stays open for clicks inside the trigger or menu", () => {
  const triggerTarget = { id: "trigger-target" };
  const menuTarget = { id: "menu-target" };
  const outsideTarget = { id: "outside-target" };
  const triggerElement = {
    contains: (target) => target === triggerTarget,
  };
  const menuElement = {
    contains: (target) => target === menuTarget,
  };

  assert.equal(
    shouldCloseTenantActionMenu({ target: triggerTarget, triggerElement, menuElement }),
    false,
  );
  assert.equal(
    shouldCloseTenantActionMenu({ target: menuTarget, triggerElement, menuElement }),
    false,
  );
  assert.equal(
    shouldCloseTenantActionMenu({ target: outsideTarget, triggerElement, menuElement }),
    true,
  );
});

test("resolveTenantNextAction correctly resolves overdue accounts to tenant detail modal on financials tab", () => {
  const target = resolveTenantNextAction({
    reservationId: "res-123",
    nextAction: "review_overdue_account",
  });
  assert.deepEqual(target, {
    type: "detail",
    reservationId: "res-123",
    initialTab: "financials",
  });
});

test("resolveTenantNextAction correctly resolves verify payment to billing reservation-payments tab", () => {
  const target = resolveTenantNextAction({
    reservationId: "res-456",
    nextAction: "verify_payment",
  });
  assert.deepEqual(target, {
    type: "navigate",
    path: "/admin/billing?tab=reservation-payments",
  });
});

test("resolveTenantNextAction correctly routes lease renewal to modal action", () => {
  const target = resolveTenantNextAction({
    reservationId: "res-789",
    nextAction: "renew_lease",
  });
  assert.deepEqual(target, {
    type: "modal",
    actionKey: "renew",
    actionType: "renew",
  });
});

test("resolveTenantNextAction correctly routes move out to modal action", () => {
  const target = resolveTenantNextAction({
    reservationId: "res-101",
    nextAction: "process_move_out",
  });
  assert.deepEqual(target, {
    type: "modal",
    actionKey: "moveOut",
    actionType: "moveOut",
  });
});

test("resolveTenantNextAction falls back to tenant detail modal for unhandled or null actions", () => {
  assert.deepEqual(resolveTenantNextAction(null), { type: "none" });
  assert.deepEqual(
    resolveTenantNextAction({ reservationId: "res-999", nextAction: "none" }),
    { type: "detail", reservationId: "res-999" },
  );
});

test("getTenantIndicator returns rose dot for overdue payments", () => {
  const indicator = getTenantIndicator({
    paymentStatus: "overdue",
    currentBalance: 3500,
  });
  assert.notEqual(indicator, null);
  assert.equal(indicator.type, "overdue");
  assert.equal(indicator.dotClass, "bg-rose-500");
  assert.equal(indicator.pingClass, "bg-rose-400");
  assert.match(indicator.tooltip, /3,500/);
});

test("getTenantIndicator returns rose dot for expired occupancy", () => {
  const indicator = getTenantIndicator({
    stayStatus: "expired_occupancy_continuing",
  });
  assert.notEqual(indicator, null);
  assert.equal(indicator.type, "expired_occupancy");
  assert.equal(indicator.dotClass, "bg-rose-500");
});

test("getTenantIndicator returns amber dot for pending payment verification", () => {
  const indicator = getTenantIndicator({
    nextAction: "verify_payment",
    paymentFlags: { pendingVerification: true },
  });
  assert.notEqual(indicator, null);
  assert.equal(indicator.type, "pending_verification");
  assert.equal(indicator.dotClass, "bg-amber-500");
});

test("getTenantIndicator returns amber dot for moving out tenants", () => {
  const indicator = getTenantIndicator({
    stayStatus: "moving_out",
  });
  assert.notEqual(indicator, null);
  assert.equal(indicator.type, "moving_out");
  assert.equal(indicator.dotClass, "bg-amber-500");
});

test("getTenantIndicator returns amber dot for expiring soon leases", () => {
  const indicator = getTenantIndicator({
    leaseStatus: "expiring_soon",
    daysUntilLeaseEnd: 15,
  });
  assert.notEqual(indicator, null);
  assert.equal(indicator.type, "expiring_soon");
  assert.equal(indicator.dotClass, "bg-amber-500");
  assert.match(indicator.tooltip, /15d left/);
});

test("getTenantIndicator returns null for healthy up-to-date active tenants", () => {
  const indicator = getTenantIndicator({
    stayStatus: "active",
    leaseStatus: "active",
    paymentStatus: "paid",
    nextAction: "none",
    daysUntilLeaseEnd: 120,
    warningFlags: [],
  });
  assert.equal(indicator, null);
  assert.equal(getTenantIndicator(null), null);
});

test("getTenantIndicator vanishes when tenant attention has already been viewed by admin", () => {
  const viewedTenant = {
    paymentStatus: "overdue",
    currentBalance: 3500,
    lastAdminViewedAt: "2026-08-19T20:00:00.000Z",
    attentionUpdatedAt: "2026-08-19T18:00:00.000Z",
  };
  // Default: vanishes because lastAdminViewedAt > attentionUpdatedAt
  assert.equal(getTenantIndicator(viewedTenant), null);

  // ignoreViewed: true returns indicator metadata for inside modal
  const modalIndicator = getTenantIndicator(viewedTenant, { ignoreViewed: true });
  assert.notEqual(modalIndicator, null);
  assert.equal(modalIndicator.type, "overdue");

  // If a new issue occurs after lastAdminViewedAt, indicator reappears
  const newIssueTenant = {
    paymentStatus: "overdue",
    currentBalance: 5000,
    lastAdminViewedAt: "2026-08-19T20:00:00.000Z",
    attentionUpdatedAt: "2026-08-19T21:00:00.000Z",
  };
  assert.notEqual(getTenantIndicator(newIssueTenant), null);
});

test("getTenantTabIndicators resolves tab-level indicators correctly", () => {
  const tabIndicators = getTenantTabIndicators({
    paymentStatus: "overdue",
    leaseStatus: "expiring_soon",
    warningFlags: [{ category: "violation", severity: "error" }],
  });
  assert.equal(tabIndicators.financials?.type, "overdue");
  assert.equal(tabIndicators.overview?.type, "expiring_soon");
  assert.equal(tabIndicators.warnings?.type, "critical_violation");
});
