export function getTenantActionMeta(tenant, actionKey) {
  return tenant?.allowedActions?.[actionKey] || { enabled: false, reason: "" };
}

export function hasEnabledTenantAction(tenant, actionKeys = []) {
  return actionKeys.some((actionKey) => getTenantActionMeta(tenant, actionKey).enabled);
}

export function openTenantAction({
  tenant,
  actionKey,
  actionType,
  notifyBlocked,
  onAction,
}) {
  const actionMeta = getTenantActionMeta(tenant, actionKey);
  if (!actionMeta.enabled) {
    notifyBlocked(actionMeta);
    return false;
  }

  onAction({ type: actionType, tenant });
  return true;
}

export function shouldCloseTenantActionMenu({
  target,
  triggerElement,
  menuElement,
}) {
  if (!target) return true;
  if (triggerElement?.contains?.(target) || menuElement?.contains?.(target)) {
    return false;
  }
  return true;
}

export function resolveTenantNextAction(tenant) {
  if (!tenant) return { type: "none" };

  switch (tenant.nextAction) {
    case "review_overdue_account":
      return {
        type: "detail",
        reservationId: tenant.reservationId || null,
        initialTab: "financials",
      };
    case "verify_payment":
      return {
        type: "navigate",
        path: "/admin/billing?tab=reservation-payments",
      };
    case "renew_lease":
      return {
        type: "modal",
        actionKey: "renew",
        actionType: "renew",
      };
    case "process_move_out":
      return {
        type: "modal",
        actionKey: "moveOut",
        actionType: "moveOut",
      };
    default:
      return {
        type: "detail",
        reservationId: tenant.reservationId || null,
      };
  }
}
