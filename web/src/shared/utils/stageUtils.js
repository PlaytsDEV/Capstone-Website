/**
 * stageUtils.js — Unified Lifecycle Stage & Fractional Formatter for Lilycrest DMS.
 *
 * Provides standardized stage ratios [X/Y] across all sequential workflows
 * (Maintenance, Reservations, Contracts, Visits, Clearance, Billing)
 * while preserving clean unnumbered labels for terminal / exceptional states.
 */

export const LIFECYCLE_STAGE_MODULES = Object.freeze({
  MAINTENANCE: "maintenance",
  RESERVATION: "reservation",
  CONTRACT: "contract",
  VISIT: "visit",
  CLEARANCE: "clearance",
  BILLING: "billing",
});

export const STAGE_CONFIGURATIONS = Object.freeze({
  maintenance: {
    totalStages: 5,
    stages: [
      {
        stageNum: 1,
        label: "Pending Review",
        statuses: ["pending", "pending_review", "submitted"],
      },
      {
        stageNum: 2,
        label: "Under Review",
        statuses: ["viewed", "reviewed", "under_review"],
      },
      {
        stageNum: 3,
        label: "In Progress",
        statuses: [
          "provider_assigned",
          "scheduled",
          "in_progress",
          "waiting_tenant",
          "reopened",
        ],
        statusLabels: {
          provider_assigned: "Provider Assigned",
          scheduled: "Scheduled",
          in_progress: "In Progress",
          waiting_tenant: "In Progress",
          reopened: "In Progress (Reopened)",
        },
      },
      {
        stageNum: 4,
        label: "Resolved",
        statuses: ["resolved"],
      },
      {
        stageNum: 5,
        label: "Completed",
        statuses: ["completed", "closed"],
      },
    ],
    terminalStatuses: ["rejected", "cancelled"],
  },

  reservation: {
    totalStages: 5,
    stages: [
      {
        stageNum: 1,
        label: "Room Selected",
        statuses: ["pending"],
        statusLabels: {
          pending: "Room Selected",
        },
      },
      {
        stageNum: 2,
        label: "Viewing Preference",
        statuses: [
          "viewing_preference_selected",
          "visit_pending",
          "visit_approved",
        ],
        statusLabels: {
          viewing_preference_selected: "Viewing Preference Selected",
          visit_pending: "Visit Pending",
          visit_approved: "Visit Confirmed",
        },
      },
      {
        stageNum: 3,
        label: "Tenant Application",
        statuses: ["pending_application_review", "needs_revision"],
        statusLabels: {
          pending_application_review: "Pending Application Review",
          needs_revision: "Needs Revision",
        },
      },
      {
        stageNum: 4,
        label: "Payment",
        statuses: [
          "approved_for_payment",
          "payment_pending",
          "partial",
          "proof_submitted",
        ],
        statusLabels: {
          approved_for_payment: "Approved for Payment",
          payment_pending: "Payment Pending",
          partial: "Proof Submitted",
          proof_submitted: "Proof Submitted",
        },
      },
      {
        stageNum: 5,
        label: "Reserved",
        statuses: [
          "reserved",
          "confirmed",
          "movein",
          "move_in",
          "moved_in",
          "occupied",
        ],
        statusLabels: {
          reserved: "Reserved",
          confirmed: "Confirmed",
          movein: "Move In",
          move_in: "Move In",
          moved_in: "Moved In",
          occupied: "Occupied",
        },
      },
    ],
    terminalStatuses: [
      "rejected",
      "cancelled",
      "archived",
      "moveout",
      "move_out",
      "moved_out",
      "overdue",
    ],
  },

  contract: {
    totalStages: 5,
    stages: [
      {
        stageNum: 1,
        label: "Needs Attention",
        statuses: ["draft", "incomplete", "needs_attention", "transfer_review_required"],
        statusLabels: {
          draft: "Draft",
          incomplete: "Incomplete",
          needs_attention: "Needs Attention",
          transfer_review_required: "Transfer Review Required",
        },
      },
      {
        stageNum: 2,
        label: "Prepared",
        statuses: ["ready_for_generation", "ready_to_generate", "generated", "prepared"],
        statusLabels: {
          ready_for_generation: "Ready for Generation",
          ready_to_generate: "Ready to Generate",
          generated: "Prepared",
          prepared: "Prepared",
        },
      },
      {
        stageNum: 3,
        label: "Pending Completion",
        statuses: ["awaiting_signatures", "partially_signed", "pending_signing"],
        statusLabels: {
          awaiting_signatures: "Awaiting Signatures",
          partially_signed: "Partially Signed",
          pending_signing: "Pending Completion",
        },
      },
      {
        stageNum: 4,
        label: "Ready to Publish",
        statuses: [
          "signed",
          "awaiting_notarization",
          "notarized",
          "ready_for_publication",
          "ready_to_publish",
          "pending_notarization",
        ],
        statusLabels: {
          signed: "Signed",
          awaiting_notarization: "Awaiting Notarization",
          notarized: "Notarized",
          ready_for_publication: "Ready for Publication",
          ready_to_publish: "Ready to Publish",
          pending_notarization: "Pending Notarization",
        },
      },
      {
        stageNum: 5,
        label: "Active",
        statuses: ["published", "active"],
        statusLabels: {
          published: "Published",
          active: "Active",
        },
      },
    ],
    terminalStatuses: [
      "expiring_soon",
      "expired",
      "terminated",
      "cancelled",
      "replaced",
      "archived",
      "renewed",
    ],
  },

  visit: {
    totalStages: 3,
    stages: [
      {
        stageNum: 1,
        label: "Visit Requested",
        statuses: ["pending", "visit_pending", "requested"],
        statusLabels: {
          pending: "Visit Requested",
          visit_pending: "Visit Pending",
          requested: "Visit Requested",
        },
      },
      {
        stageNum: 2,
        label: "Visit Confirmed",
        statuses: ["confirmed", "visit_approved", "approved", "scheduled"],
        statusLabels: {
          confirmed: "Visit Confirmed",
          visit_approved: "Visit Confirmed",
          approved: "Visit Confirmed",
          scheduled: "Visit Scheduled",
        },
      },
      {
        stageNum: 3,
        label: "Completed",
        statuses: ["completed", "attended", "responded"],
        statusLabels: {
          completed: "Completed",
          attended: "Attended",
          responded: "Responded",
        },
      },
    ],
    terminalStatuses: [
      "no-show",
      "no_show",
      "noshow",
      "cancelled",
      "rejected",
      "missed",
    ],
  },

  clearance: {
    totalStages: 5,
    stages: [
      {
        stageNum: 1,
        label: "Notice Submitted",
        statuses: ["pending_clearance", "notice_1", "submitted"],
        statusLabels: {
          pending_clearance: "Pending Clearance",
          notice_1: "Notice 1",
          submitted: "Notice Submitted",
        },
      },
      {
        stageNum: 2,
        label: "Inspection Scheduled",
        statuses: ["scheduled", "notice_2", "inspection_scheduled"],
        statusLabels: {
          scheduled: "Inspection Scheduled",
          notice_2: "Notice 2",
          inspection_scheduled: "Inspection Scheduled",
        },
      },
      {
        stageNum: 3,
        label: "Clearance Review",
        statuses: ["review_required", "disputed", "assessment"],
        statusLabels: {
          review_required: "Review Required",
          disputed: "Disputed",
          assessment: "Clearance Review",
        },
      },
      {
        stageNum: 4,
        label: "Refund Processed",
        statuses: ["refund_pending", "notice_3", "final_settlement"],
        statusLabels: {
          refund_pending: "Refund Pending",
          notice_3: "Final Settlement",
          final_settlement: "Final Settlement",
        },
      },
      {
        stageNum: 5,
        label: "Cleared",
        statuses: ["cleared", "former_tenant", "moved_out", "completed"],
        statusLabels: {
          cleared: "Cleared",
          former_tenant: "Former Tenant",
          moved_out: "Moved Out",
          completed: "Completed",
        },
      },
    ],
    terminalStatuses: ["cancelled", "withdrawn"],
  },

  billing: {
    totalStages: 4,
    omitFraction: true,
    stages: [
      {
        stageNum: 1,
        label: "Reading Logged",
        statuses: ["draft", "meter_logged", "reading_logged"],
        statusLabels: {
          draft: "Draft",
          meter_logged: "Reading Logged",
          reading_logged: "Reading Logged",
        },
      },
      {
        stageNum: 2,
        label: "Billing Issued",
        statuses: ["generated", "issued", "unpaid"],
        statusLabels: {
          generated: "Billing Generated",
          issued: "Billing Issued",
          unpaid: "Billing Issued",
        },
      },
      {
        stageNum: 3,
        label: "Payment Pending",
        statuses: ["pending", "partial", "payment_pending", "manual_review_required"],
        statusLabels: {
          pending: "Payment Pending",
          partial: "Proof Submitted",
          payment_pending: "Payment Pending",
          manual_review_required: "Manual Review Required",
        },
      },
      {
        stageNum: 4,
        label: "Settled",
        statuses: ["paid", "settled", "cleared"],
        statusLabels: {
          paid: "Paid in Full",
          settled: "Settled",
          cleared: "Settled",
        },
      },
    ],
    terminalStatuses: ["disputed", "overdue", "cancelled", "voided"],
  },
});

/**
 * Normalizes a status key string.
 */
function normalizeKey(str) {
  return String(str || "")
    .trim()
    .toLowerCase();
}

function formatFallbackLabel(status, customLabel) {
  if (customLabel) return customLabel;
  const norm = normalizeKey(status);
  if (norm === "no-show" || norm === "no_show" || norm === "noshow") return "No Show";
  if (norm === "movein" || norm === "move_in") return "Move In";
  if (norm === "moveout" || norm === "move_out") return "Moved Out";
  return String(status || "Unknown")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Retrieves the full stage metadata and formatted fractional label for a given module and status.
 *
 * @param {string} module - One of 'maintenance', 'reservation', 'contract', 'visit', 'clearance', 'billing'
 * @param {string} status - Database status string (e.g. 'provider_assigned', 'approved_for_payment')
 * @param {string} [customLabel] - Optional custom label to override base label
 * @returns {{
 *   stageNum: number | null,
 *   totalStages: number | null,
 *   stageFraction: string | null,
 *   baseLabel: string,
 *   formattedLabel: string,
 *   isTerminal: boolean,
 *   isStage: boolean
 * }}
 */
export function getStageFractionInfo(module, status, customLabel) {
  const normModule = normalizeKey(module);
  const normStatus = normalizeKey(status);
  const config = STAGE_CONFIGURATIONS[normModule];

  // Default fallback if no module config is found
  if (!config) {
    const rawLabel = formatFallbackLabel(status, customLabel);
    return {
      stageNum: null,
      totalStages: null,
      stageFraction: null,
      baseLabel: rawLabel,
      formattedLabel: rawLabel,
      isTerminal: false,
      isStage: false,
    };
  }

  // Check if terminal status
  if (config.terminalStatuses.includes(normStatus)) {
    const rawLabel = formatFallbackLabel(status, customLabel);
    return {
      stageNum: null,
      totalStages: config.totalStages,
      stageFraction: null,
      baseLabel: rawLabel,
      formattedLabel: rawLabel,
      isTerminal: true,
      isStage: false,
    };
  }

  // Find matching stage
  for (const stage of config.stages) {
    if (stage.statuses.includes(normStatus)) {
      const baseLabel =
        customLabel ||
        stage.statusLabels?.[normStatus] ||
        stage.label ||
        formatFallbackLabel(status);

      const stageFraction = config.omitFraction
        ? null
        : `[${stage.stageNum}/${config.totalStages}]`;
      const formattedLabel = stageFraction
        ? `${baseLabel} ${stageFraction}`
        : baseLabel;

      return {
        stageNum: stage.stageNum,
        totalStages: config.totalStages,
        stageFraction,
        baseLabel,
        formattedLabel,
        isTerminal: false,
        isStage: true,
      };
    }
  }

  // If status is not explicitly in stages or terminal list
  const fallbackLabel = formatFallbackLabel(status, customLabel);

  return {
    stageNum: null,
    totalStages: config.totalStages,
    stageFraction: null,
    baseLabel: fallbackLabel,
    formattedLabel: fallbackLabel,
    isTerminal: false,
    isStage: false,
  };
}

/**
 * Returns the formatted status label with fractional stage numbers if applicable.
 */
export function formatStageStatus(module, status, customLabel) {
  return getStageFractionInfo(module, status, customLabel).formattedLabel;
}

/**
 * Returns structured billing lifecycle steps metadata for steppers / progress indicators.
 *
 * @param {string} currentStatus - Current tenant billing/payment status
 * @returns {Array<{ stageNum: number, label: string, isCompleted: boolean, isCurrent: boolean, isUpcoming: boolean }>}
 */
export function getBillingLifecycleSteps(currentStatus) {
  const normStatus = normalizeKey(currentStatus);
  const config = STAGE_CONFIGURATIONS.billing;
  let activeStageNum = 1;
  const isTerminal = config.terminalStatuses.includes(normStatus);

  if (!isTerminal) {
    for (const stage of config.stages) {
      if (stage.statuses.includes(normStatus)) {
        activeStageNum = stage.stageNum;
        break;
      }
    }
  }

  return config.stages.map((stage) => ({
    stageNum: stage.stageNum,
    label: stage.label,
    isCompleted: !isTerminal && activeStageNum > stage.stageNum,
    isCurrent: !isTerminal && activeStageNum === stage.stageNum,
    isUpcoming: isTerminal || activeStageNum < stage.stageNum,
  }));
}
