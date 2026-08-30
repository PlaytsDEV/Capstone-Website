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
    case "settle_transfer":
      // The transfer settlement Bill is paid from Billing.
      return {
        type: "navigate",
        path: "/admin/billing?tab=reservation-payments",
      };
    case "transfer_scheduled":
    case "complete_transfer":
      // The Scheduled Room Transfer card (Reschedule / Complete Transfer
      // actions) lives on the tenant detail overview tab.
      return {
        type: "detail",
        reservationId: tenant.reservationId || null,
        initialTab: "overview",
      };
    default:
      return {
        type: "detail",
        reservationId: tenant.reservationId || null,
      };
  }
}

export const VIEWED_TENANTS_STORAGE_KEY = "lilycrest_viewed_tenants";
export const VIEWED_TABS_STORAGE_KEY = "lilycrest_viewed_tenant_tabs";

export function getViewedTenantsMap() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const raw = localStorage.getItem(VIEWED_TENANTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function markTenantViewedInStorage(reservationId) {
  if (!reservationId) return;
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const map = getViewedTenantsMap();
    map[String(reservationId)] = Date.now();
    localStorage.setItem(VIEWED_TENANTS_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    // ignore localStorage errors in private mode
  }
}

export function getViewedTabsForTenant(reservationId) {
  if (!reservationId) return new Set();
  try {
    if (typeof window === "undefined" || !window.localStorage) return new Set();
    const raw = localStorage.getItem(`${VIEWED_TABS_STORAGE_KEY}_${reservationId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markTenantTabViewedInStorage(reservationId, tabKey) {
  if (!reservationId || !tabKey) return;
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const set = getViewedTabsForTenant(reservationId);
    set.add(tabKey);
    localStorage.setItem(
      `${VIEWED_TABS_STORAGE_KEY}_${reservationId}`,
      JSON.stringify(Array.from(set)),
    );
  } catch (e) {
    // ignore localStorage errors in private mode
  }
}

export function isTenantAttentionNewForAdmin(tenant) {
  if (!tenant) return false;
  const resId = String(tenant.reservationId || tenant.id || "");

  // 1. Check local persistent storage (instant and permanent across refreshes)
  const localViewedMap = getViewedTenantsMap();
  const localViewedTime = localViewedMap[resId];
  if (localViewedTime) {
    if (!tenant.attentionUpdatedAt) return false; // Already viewed and no new issue timestamp
    const issueTime = new Date(tenant.attentionUpdatedAt).getTime();
    if (Number.isNaN(issueTime) || localViewedTime >= issueTime) {
      return false; // Already viewed!
    }
  }

  // 2. Check backend lastAdminViewedAt
  if (tenant.lastAdminViewedAt) {
    const lastViewed = new Date(tenant.lastAdminViewedAt).getTime();
    if (!Number.isNaN(lastViewed) && lastViewed > 0) {
      if (!tenant.attentionUpdatedAt) return false;
      const issueTime = new Date(tenant.attentionUpdatedAt).getTime();
      if (Number.isNaN(issueTime) || lastViewed >= issueTime) {
        return false;
      }
    }
  }

  // If never viewed or issue is newer than viewed time
  return true;
}

export function getTenantIndicator(tenant, { ignoreViewed = false } = {}) {
  if (!tenant) return null;

  // If viewed tracking is active and admin has already viewed this concern, vanish!
  if (!ignoreViewed && !isTenantAttentionNewForAdmin(tenant)) {
    return null;
  }

  const rawStatus = String(tenant.status || "").toLowerCase();

  // 1. Critical Overdue Account / Payment (Rose / Red)
  const isOverdue =
    tenant.paymentStatus === "overdue" ||
    tenant.nextAction === "review_overdue_account" ||
    Boolean(tenant.paymentFlags?.hasOverdueBalance) ||
    rawStatus.includes("overdue");
  if (isOverdue) {
    const balLabel =
      typeof tenant.currentBalance === "number" && tenant.currentBalance > 0
        ? ` (PHP ${tenant.currentBalance.toLocaleString()})`
        : "";
    return {
      hasIndicator: true,
      type: "overdue",
      label: "Overdue",
      shortLabel: "Overdue",
      tabKey: "financials",
      dotClass: "bg-rose-500",
      pingClass: "bg-rose-400",
      textClass: "text-rose-700 dark:text-rose-400",
      tooltip: `Overdue account balance${balLabel} — requires review`,
    };
  }

  // 2. Expired Occupancy / Continuing Stay (Rose / Red)
  const isExpiredStay =
    tenant.stayStatus === "expired_occupancy_continuing" ||
    Boolean(tenant.isExpiredOccupancy) ||
    (tenant.leaseStatus === "expired" && tenant.stayStatus === "active") ||
    rawStatus.includes("expired");
  if (isExpiredStay) {
    return {
      hasIndicator: true,
      type: "expired_occupancy",
      label: "Expired Occupancy",
      shortLabel: "Expired",
      tabKey: "overview",
      dotClass: "bg-rose-500",
      pingClass: "bg-rose-400",
      textClass: "text-rose-700 dark:text-rose-400",
      tooltip: "Contract expired — continuing stay requires action",
    };
  }

  // 3. Critical Disciplinary Violation (Rose / Red)
  const hasCriticalViolation =
    Array.isArray(tenant.warningFlags) &&
    tenant.warningFlags.some(
      (f) => f && f.category === "violation" && f.severity === "error",
    );
  if (hasCriticalViolation) {
    return {
      hasIndicator: true,
      type: "critical_violation",
      label: "Critical Violation",
      shortLabel: "Violation",
      tabKey: "warnings",
      dotClass: "bg-rose-500",
      pingClass: "bg-rose-400",
      textClass: "text-rose-700 dark:text-rose-400",
      tooltip: "Critical disciplinary violation recorded on account",
    };
  }

  // 4. Pending Payment Verification (Amber / Yellow)
  const isPendingVerification =
    Boolean(tenant.paymentFlags?.pendingVerification) ||
    tenant.nextAction === "verify_payment" ||
    rawStatus.includes("verification");
  if (isPendingVerification) {
    return {
      hasIndicator: true,
      type: "pending_verification",
      label: "Payment Verification",
      shortLabel: "Verify",
      tabKey: "financials",
      dotClass: "bg-amber-500",
      pingClass: "bg-amber-400",
      textClass: "text-amber-700 dark:text-amber-400",
      tooltip: "Payment receipt submitted — awaiting admin verification",
    };
  }

  // 5. Move-Out Clearance In Progress / Scheduled (Amber / Yellow)
  const isMovingOut =
    tenant.stayStatus === "moving_out" ||
    tenant.nextAction === "process_move_out" ||
    rawStatus.includes("moving_out") ||
    rawStatus.includes("moving out");
  if (isMovingOut) {
    return {
      hasIndicator: true,
      type: "moving_out",
      label: "Moving Out",
      shortLabel: "Moving Out",
      tabKey: "overview",
      dotClass: "bg-amber-500",
      pingClass: "bg-amber-400",
      textClass: "text-amber-700 dark:text-amber-400",
      tooltip: "Move-out clearance in progress / scheduled",
    };
  }

  // 6. Lease Expiring Soon / Renewal Needed (Amber / Yellow)
  const isExpiringSoon =
    tenant.leaseStatus === "expiring_soon" ||
    tenant.nextAction === "renew_lease" ||
    (typeof tenant.daysUntilLeaseEnd === "number" &&
      tenant.daysUntilLeaseEnd <= 30 &&
      tenant.daysUntilLeaseEnd >= 0) ||
    rawStatus.includes("expiring");
  if (isExpiringSoon) {
    const days =
      typeof tenant.daysUntilLeaseEnd === "number"
        ? ` (${tenant.daysUntilLeaseEnd}d left)`
        : "";
    return {
      hasIndicator: true,
      type: "expiring_soon",
      label: "Expiring Soon",
      shortLabel: "Expiring",
      tabKey: "overview",
      dotClass: "bg-amber-500",
      pingClass: "bg-amber-400",
      textClass: "text-amber-700 dark:text-amber-400",
      tooltip: `Lease expiring soon${days} — stay extension or renewal needed`,
    };
  }

  // 7. Active House Rule Violation Notice (Amber / Yellow)
  const hasViolation =
    Array.isArray(tenant.warningFlags) &&
    tenant.warningFlags.some((f) => f && f.category === "violation");
  if (hasViolation) {
    return {
      hasIndicator: true,
      type: "violation",
      label: "Violation",
      shortLabel: "Violation",
      tabKey: "warnings",
      dotClass: "bg-amber-500",
      pingClass: "bg-amber-400",
      textClass: "text-amber-700 dark:text-amber-400",
      tooltip: "Active house rule violation notice on record",
    };
  }

  return null;
}

export function getTenantTabIndicators(tenant) {
  if (!tenant) return { financials: null, overview: null, warnings: null };

  const rawStatus = String(tenant.status || "").toLowerCase();

  // Financials tab indicator
  const hasOverdue =
    tenant.paymentStatus === "overdue" ||
    tenant.nextAction === "review_overdue_account" ||
    Boolean(tenant.paymentFlags?.hasOverdueBalance) ||
    rawStatus.includes("overdue");
  const hasPendingVerification =
    Boolean(tenant.paymentFlags?.pendingVerification) ||
    tenant.nextAction === "verify_payment" ||
    rawStatus.includes("verification");

  let financials = null;
  if (hasOverdue) {
    financials = {
      type: "overdue",
      dotClass: "bg-rose-500",
      tooltip: "Overdue payment balance requires attention",
    };
  } else if (hasPendingVerification) {
    financials = {
      type: "pending_verification",
      dotClass: "bg-amber-500",
      tooltip: "Payment receipt awaiting verification",
    };
  }

  // Overview / Contract tab indicator
  const hasExpiredStay =
    tenant.stayStatus === "expired_occupancy_continuing" ||
    Boolean(tenant.isExpiredOccupancy) ||
    (tenant.leaseStatus === "expired" && tenant.stayStatus === "active");
  const hasExpiringSoon =
    tenant.leaseStatus === "expiring_soon" ||
    tenant.nextAction === "renew_lease" ||
    (typeof tenant.daysUntilLeaseEnd === "number" &&
      tenant.daysUntilLeaseEnd <= 30 &&
      tenant.daysUntilLeaseEnd >= 0);

  let overview = null;
  if (hasExpiredStay) {
    overview = {
      type: "expired",
      dotClass: "bg-rose-500",
      tooltip: "Contract expired — renewal required",
    };
  } else if (hasExpiringSoon) {
    overview = {
      type: "expiring_soon",
      dotClass: "bg-amber-500",
      tooltip: "Lease expiring soon",
    };
  }

  // System Warnings tab indicator
  const hasCriticalViolation =
    Array.isArray(tenant.warningFlags) &&
    tenant.warningFlags.some(
      (f) => f && f.category === "violation" && f.severity === "error",
    );
  const hasAnyWarning =
    (Array.isArray(tenant.warnings) && tenant.warnings.length > 0) ||
    (Array.isArray(tenant.warningFlags) && tenant.warningFlags.length > 0);

  let warnings = null;
  if (hasCriticalViolation) {
    warnings = {
      type: "critical_violation",
      dotClass: "bg-rose-500",
      tooltip: "Critical violation notice recorded",
    };
  } else if (hasAnyWarning) {
    warnings = {
      type: "warnings",
      dotClass: "bg-amber-500",
      tooltip: "Active system warnings",
    };
  }

  return { financials, overview, warnings };
}
