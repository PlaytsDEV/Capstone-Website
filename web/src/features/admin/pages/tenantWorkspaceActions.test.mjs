import test from "node:test";
import assert from "node:assert/strict";
import {
  getTenantActionMeta,
  hasEnabledTenantAction,
  openTenantAction,
  shouldCloseTenantActionMenu,
  resolveTenantNextAction,
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
