export const WARNING_DETAILS_MAP = {
  overdue_electricity: {
    title: "Overdue Electricity",
    category: "electricity",
    details: "Electricity billing has passed the payment deadline without settlement.",
    impact: "Overdue electricity balance accrues daily late penalties (₱50/day) until settled in full.",
    recommendation: "Review meter reading breakdown, notify tenant, or record received payment.",
  },
  outstanding_electricity: {
    title: "Electricity",
    category: "electricity",
    details: "Electricity billing is awaiting payment on or before the designated due date.",
    impact: "Please settle on or before the due date to avoid daily late penalties.",
    recommendation: "Check payment breakdown or assist tenant with payment completion.",
  },
  overdue_rent: {
    title: "Overdue Rent Billing",
    category: "rent",
    details: "Monthly rent payment has passed its designated due date without full settlement.",
    impact: "Overdue rent balance is accruing late payment penalties (₱50/day).",
    recommendation: "Review payment history, verify due date, or follow up with the tenant.",
  },
  outstanding_rent: {
    title: "Rent",
    category: "rent",
    details: "Monthly rent invoice is open and due on the scheduled payment date.",
    impact: "The remaining balance needs to be settled on or before the due date.",
    recommendation: "Remind tenant of the upcoming due date to ensure timely payment.",
  },
  overdue_water: {
    title: "Overdue Water Share",
    category: "water",
    details: "Shared room water billing has passed its due date without payment.",
    impact: "Overdue water share is subject to late payment penalties.",
    recommendation: "Review room water billing distribution and request settlement.",
  },
  outstanding_water: {
    title: "Water",
    category: "water",
    details: "Water billing is pending payment before the scheduled due date.",
    impact: "The remaining balance needs to be settled on or before the due date.",
    recommendation: "Confirm payment schedule and verify invoice breakdown.",
  },
  overdue_penalty: {
    title: "Late Payment Penalties",
    category: "penalty",
    details: "Late penalties have accrued at the rate of ₱50/day on overdue balances.",
    impact: "Total balance will increase daily until the overdue invoices are paid.",
    recommendation: "Review penalty calculations and ensure timely settlement.",
  },
  tenant_violation: {
    title: "Active House Rule Violation",
    category: "violation",
    details: "A house rule violation is documented and active for this tenant.",
    impact: "Violations remain on the tenant record and may lead to fines or contract escalation.",
    recommendation: "Review violation report, evidence, and tenant response.",
  },
  room_history_incomplete: {
    title: "Incomplete Room History",
    category: "room",
    details: "We don't have a complete record of room or bed transfers for this tenant's stay.",
    impact: "Utility bill calculations will automatically use the current room assignment.",
    recommendation: "Check the tenant's room history or log any room changes if they moved rooms.",
  },
  Room_history_incomplete: {
    title: "Incomplete Room History",
    category: "room",
    details: "We don't have a complete record of room or bed transfers for this tenant's stay.",
    impact: "Utility bill calculations will automatically use the current room assignment.",
    recommendation: "Check the tenant's room history or log any room changes if they moved rooms.",
  },
  lease_expired: {
    title: "Lease Contract Expired",
    category: "contract",
    details: "This tenant's rental agreement end date has already passed.",
    impact: "The tenant is still checked in, but their contract status is marked as expired.",
    recommendation: "Renew the lease agreement or prepare to process the tenant's move-out.",
  },
  lease_expiring_soon: {
    title: "Lease Ending Soon",
    category: "contract",
    details: "This tenant's rental contract will end within the next 30 days.",
    impact: "The tenant may need to decide whether to extend their stay or prepare to move out.",
    recommendation: "Send a lease renewal notice or schedule a move-out check.",
  },
  overdue_balance: {
    title: "Overdue Payment",
    category: "billing",
    details: "One or more bills have passed their due date without payment.",
    impact: "A daily late payment penalty rate (₱50/day) is accrued on overdue balances until paid in full. Account flagged as overdue.",
    recommendation: "Review payment history, send a payment reminder, or record a received payment.",
  },
  outstanding_balance: {
    title: "Outstanding Balance",
    category: "billing",
    details: "This tenant has an unpaid balance on their current bill.",
    impact: "The remaining balance needs to be settled before the billing cycle closes.",
    recommendation: "Check payment records or remind the tenant to complete their payment.",
  },
  pending_payment_verification: {
    title: "Payment Receipt Under Review",
    category: "payment",
    details: "The tenant has submitted an offline payment receipt that is waiting for your approval.",
    impact: "The account balance will update as soon as you verify the payment proof.",
    recommendation: "Go to Billing & Payments to review and verify the submitted receipt.",
  },
  billing_impact_warning: {
    title: "Move-Out Billing Notice",
    category: "stay",
    details: "A move-out date has been scheduled for this tenant.",
    impact: "Monthly rent and utility bills will be adjusted to cover only the exact days stayed.",
    recommendation: "Make sure final meter readings and room inspection notes are recorded.",
  },
};

export const formatDate = (d) => {
  if (!d || d === "-") return "N/A";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toISOString().split("T")[0];
};

export const formatBillingCycle = (cycle, fallbackDueDate = null) => {
  if (cycle) {
    if (cycle.start && cycle.end) {
      return `${formatDate(cycle.start)} – ${formatDate(cycle.end)}`;
    }
    if (cycle.month) {
      const d = new Date(cycle.month);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString("en-PH", { month: "short", year: "numeric" }) + " Cycle";
      }
      return `${cycle.month} Cycle`;
    }
  }
  if (fallbackDueDate) {
    const d = new Date(fallbackDueDate);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-PH", { month: "short", year: "numeric" }) + " Cycle";
    }
  }
  return "Current Billing Cycle";
};

export const formatMoney = (amount, fallback = "₱0") => {
  if (amount === undefined || amount === null || amount === "") return fallback;
  const num = Number(amount);
  if (Number.isNaN(num)) return fallback;
  return `₱${num.toLocaleString()}`;
};

export const getInitials = (name) => {
  if (!name) return "--";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
};

export const VIOLATION_CATEGORY_LABELS = {
  smoking_inside: "Smoking / Vaping Indoors",
  cooking_in_room: "Cooking / Prohibited Appliances in Room",
  unauthorized_appliance: "Unauthorized High-Wattage Appliance",
  unauthorized_visitors: "Unauthorized Guest / Curfew Breach",
  rfid_misuse: "RFID Card Lending / Misuse",
  unauthorized_bed_transfer: "Unauthorized Bed Transfer",
  unauthorized_room_transfer: "Unauthorized Room Transfer",
  property_damage: "Property / Fixture Damage",
  cleanliness_issues: "Sanitation & Cleanliness Violation",
  persistent_unpaid_bills: "Persistent Unpaid Dues / Non-Compliance",
  custom: "Custom House Rule Infraction",
};

export const getViolationStatusBadge = (status) => {
  switch (status) {
    case "reported":
      return { label: "Reported", color: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" };
    case "under_review":
      return { label: "Under Review", color: "text-sky-700 dark:text-sky-400", dot: "bg-sky-500" };
    case "confirmed":
      return { label: "Confirmed", color: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" };
    case "warning_issued":
      return { label: "Warning Issued", color: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" };
    case "penalty_issued":
      return { label: "Penalty Issued", color: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" };
    case "escalated":
      return { label: "Escalated to Board", color: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" };
    case "resolved":
      return { label: "Resolved", color: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" };
    case "dismissed":
      return { label: "Dismissed", color: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" };
    default:
      return { label: status ? String(status).replace(/_/g, " ") : "Reported", color: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" };
  }
};

export const getContractStatusConfig = (status) => {
  switch (status) {
    case "active":
      return {
        color: "text-emerald-700 dark:text-emerald-400",
        dot: "bg-emerald-500",
        label: "Active",
      };
    case "ending-soon":
      return {
        color: "text-amber-700 dark:text-amber-400",
        dot: "bg-amber-500",
        label: "Ending Soon",
      };
    case "expired":
      return {
        color: "text-rose-700 dark:text-rose-400",
        dot: "bg-rose-500",
        label: "Expired",
      };
    default:
      return {
        color: "text-slate-700 dark:text-slate-300",
        dot: "bg-slate-400",
        label: status || "Unknown",
      };
  }
};

export const getPaymentStatusConfig = (status) => {
  switch (status) {
    case "paid":
      return {
        color: "text-emerald-700 dark:text-emerald-400",
        dot: "bg-emerald-500",
        label: "Paid",
      };
    case "partial":
      return {
        color: "text-amber-700 dark:text-amber-400",
        dot: "bg-amber-500",
        label: "Partial",
      };
    case "overdue":
      return {
        color: "text-rose-700 dark:text-rose-400",
        dot: "bg-rose-500",
        label: "Overdue",
      };
    default:
      return {
        color: "text-slate-700 dark:text-slate-300",
        dot: "bg-slate-400",
        label: status || "Unknown",
      };
  }
};

export const getOccupancyStatusConfig = (status) => {
  switch (status) {
    case "active":
      return {
        color: "text-emerald-700 dark:text-emerald-400",
        dot: "bg-emerald-500",
        label: "Active",
      };
    case "inactive":
      return {
        color: "text-slate-700 dark:text-slate-300",
        dot: "bg-slate-400",
        label: "Inactive",
      };
    default:
      return {
        color: "text-slate-700 dark:text-slate-300",
        dot: "bg-slate-400",
        label: status || "Unknown",
      };
  }
};

export const getNextActionLabel = (action) => {
  switch (action) {
    case "renew":
      return "Renew";
    case "follow-up":
      return "Follow-up";
    case "none":
      return "No action needed";
    default:
      return action || "No action needed";
  }
};

export const getPaymentStatusLabel = (record) => {
  switch (record.status) {
    case "completed":
      return {
        color: "text-emerald-700 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800",
        label: "Completed",
      };
    case "pending":
      return {
        color: "text-amber-700 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800",
        label: "Pending",
      };
    case "failed":
      return {
        color: "text-rose-700 dark:text-rose-400",
        bg: "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800",
        label: "Failed",
      };
    default:
      return {
        color: "text-slate-700 dark:text-slate-300",
        bg: "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
        label: record.status || "Unknown",
      };
  }
};

export const getWarningSeverityConfig = (severity) => {
  switch (severity) {
    case "high":
      return {
        titleColor: "text-slate-900 dark:text-slate-100",
        container: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800",
        iconColor: "text-rose-600 dark:text-rose-400",
      };
    case "medium":
      return {
        titleColor: "text-slate-900 dark:text-slate-100",
        container: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800",
        iconColor: "text-amber-600 dark:text-amber-400",
      };
    case "low":
      return {
        titleColor: "text-slate-900 dark:text-slate-100",
        container: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800",
        iconColor: "text-sky-600 dark:text-sky-400",
      };
    default:
      return {
        titleColor: "text-slate-900 dark:text-slate-100",
        container: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800",
        iconColor: "text-slate-500 dark:text-slate-400",
      };
  }
};
