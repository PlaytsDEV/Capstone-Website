import dayjs from "dayjs";
import { diffManilaDays, toManilaStartOfDay } from "./dateUtils.js";
import { getVisibleBillSnapshot, roundMoney } from "./billingPolicy.js";
import {
  hasReservationStatus,
  readMoveInDate,
  readMoveOutDate,
} from "./lifecycleNaming.js";
import {
  resolveTenantFinancialSummary,
  resolveTenantPersonalDetails,
} from "../services/tenantProfileService.js";
import { branchSupportsSeparateUtilityBilling } from "../config/branches.js";

export const LEASE_EXPIRING_SOON_DAYS = 30;

const NEXT_ACTION_LABELS = Object.freeze({
  verify_payment: "Verify payment",
  review_overdue_account: "Review overdue account",
  process_move_out: "Process move-out",
  renew_lease: "Renew lease",
  none: "No action needed",
});

const WARNING_SEVERITY = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
});

export function computeLeaseEndDate(reservation) {
  const moveInDate = readMoveInDate(reservation);
  if (!moveInDate) return null;
  const leaseDuration = Number(reservation?.leaseDuration || 0);
  if (!Number.isFinite(leaseDuration) || leaseDuration <= 0) return null;

  const end = dayjs(moveInDate).add(leaseDuration, "month").subtract(1, "day");
  return end.isValid() ? end.toDate() : null;
}

export function computeDaysUntil(dateLike, now = new Date()) {
  if (!dateLike) return null;
  const diff = diffManilaDays(dateLike, now);
  return Number.isNaN(diff) ? null : diff;
}

export function buildBillingSummary(bills = [], now = new Date()) {
  const visibleBills = bills
    .filter((bill) => bill && bill.isArchived !== true && bill.status !== "draft")
    .map((bill) => ({
      bill,
      snapshot: getVisibleBillSnapshot(bill, now),
    }));

  const currentBalance = roundMoney(
    visibleBills.reduce(
      (sum, entry) => sum + Number(entry.snapshot?.remainingAmount || 0),
      0,
    ),
  );
  const hasOverdue = visibleBills.some(
    (entry) => entry.snapshot?.status === "overdue",
  );
  const hasOutstanding = currentBalance > 0;
  const hasPendingVerification = visibleBills.some(
    (entry) =>
      entry.bill?.paymentProof?.verificationStatus === "pending-verification",
  );

  let paymentStatus = "paid";
  if (hasOverdue) paymentStatus = "overdue";
  else if (hasOutstanding) paymentStatus = "partial";

  const overdueEntries = visibleBills.filter(
    (entry) => entry.snapshot?.status === "overdue" && entry.bill?.dueDate,
  );
  const oldestOverdueDueDate = overdueEntries.length > 0
    ? overdueEntries.reduce((oldest, cur) =>
        new Date(cur.bill.dueDate) < new Date(oldest) ? cur.bill.dueDate : oldest,
      overdueEntries[0].bill.dueDate)
    : null;

  const pendingEntries = visibleBills.filter(
    (entry) => entry.snapshot?.status !== "paid" && entry.bill?.dueDate,
  );
  const nextDueDate = pendingEntries.length > 0
    ? pendingEntries.reduce((earliest, cur) =>
        new Date(cur.bill.dueDate) < new Date(earliest) ? cur.bill.dueDate : earliest,
      pendingEntries[0].bill.dueDate)
    : null;

  return {
    currentBalance,
    paymentStatus,
    hasOverdue,
    hasOutstanding,
    hasPendingVerification,
    oldestOverdueDueDate,
    nextDueDate,
    visibleBills,
  };
}

export function buildStayStatus(reservation, now = new Date()) {
  const moveOutDate = readMoveOutDate(reservation);
  if (
    hasReservationStatus(reservation?.status, "moveOut") ||
    (moveOutDate && !dayjs(moveOutDate).isAfter(dayjs(now)))
  ) {
    return "moved_out";
  }

  if (moveOutDate && dayjs(moveOutDate).isAfter(dayjs(now))) {
    return "moving_out";
  }

  return "active";
}

export function normalizeTenantStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "moved_out") return "moved_out";
  if (normalized === "inactive") return "inactive";
  if (normalized === "active") return "active";
  return normalized || "applicant";
}

export function buildLeaseStatus(daysUntilLeaseEnd) {
  if (daysUntilLeaseEnd == null) return "active";
  if (daysUntilLeaseEnd <= 0) return "expired";
  if (daysUntilLeaseEnd <= LEASE_EXPIRING_SOON_DAYS) return "expiring_soon";
  return "active";
}

export function buildWarningFlags({
  leaseStatus,
  billingSummary,
  hasRoomHistory,
  moveOutDate,
  violations = [],
  visibleBills = [],
  branch = null,
  now = new Date(),
}) {
  const flags = [];
  const branchNormalized = String(branch || "").toLowerCase();
  const supportsSeparateElec = branch
    ? branchSupportsSeparateUtilityBilling(branchNormalized, "electricity")
    : !branchNormalized.includes("guada");
  const supportsSeparateWater = branch
    ? branchSupportsSeparateUtilityBilling(branchNormalized, "water")
    : !branchNormalized.includes("guada");

  // 1. Lease contract warnings
  if (leaseStatus === "expired") {
    flags.push({
      id: "lease-expired",
      code: "lease_expired",
      category: "contract",
      severity: WARNING_SEVERITY.error,
      title: "Lease Contract Expired",
      message: "The lease contract for this tenant has expired.",
      details: "This tenant's rental agreement end date has already passed.",
      impact: "The tenant is still checked in, but their contract status is marked as expired.",
      recommendation: "Renew the lease agreement or prepare to process the tenant's move-out.",
    });
  } else if (leaseStatus === "expiring_soon") {
    flags.push({
      id: "lease-expiring-soon",
      code: "lease_expiring_soon",
      category: "contract",
      severity: WARNING_SEVERITY.warning,
      title: "Lease Ending Soon",
      message: "The lease contract is ending soon.",
      details: "This tenant's rental contract will end within the next 30 days.",
      impact: "The tenant may need to decide whether to extend their stay or prepare to move out.",
      recommendation: "Send a lease renewal notice or schedule a move-out check.",
    });
  }

  // 2. Granular Bill / Utility / Rent Warnings
  const candidateBills = (visibleBills && visibleBills.length > 0)
    ? visibleBills
    : (billingSummary?.visibleBills || []);

  const overdueBills = candidateBills.filter(
    (entry) => entry.snapshot?.status === "overdue" || (entry.bill?.status === "overdue" && Number(entry.snapshot?.remainingAmount ?? entry.bill?.remainingAmount ?? 0) > 0)
  );

  const pendingBills = candidateBills.filter(
    (entry) => entry.snapshot?.status !== "paid" && entry.snapshot?.status !== "overdue" && Number(entry.snapshot?.remainingAmount ?? entry.bill?.remainingAmount ?? 0) > 0
  );

  // If there are overdue bills, break down by category:
  if (overdueBills.length > 0) {
    let overdueRentTotal = 0;
    let overdueElecTotal = 0;
    let overdueWaterTotal = 0;
    let overduePenaltyTotal = 0;
    let latestDueDate = null;
    let latestCycle = null;
    let primaryBillId = null;

    overdueBills.forEach(({ bill, snapshot }) => {
      const charges = bill?.charges || {};
      const rentAmt = Number(charges.rent || 0);
      const elecAmt = Number(charges.electricity || 0);
      const waterAmt = Number(charges.water || 0);
      const penaltyAmt = Number(charges.penalty || 0);

      if (rentAmt > 0) overdueRentTotal += rentAmt;
      if (elecAmt > 0 && supportsSeparateElec) overdueElecTotal += elecAmt;
      if (waterAmt > 0 && supportsSeparateWater) overdueWaterTotal += waterAmt;
      if (penaltyAmt > 0) overduePenaltyTotal += penaltyAmt;

      if (!latestDueDate || (bill.dueDate && new Date(bill.dueDate) < new Date(latestDueDate))) {
        latestDueDate = bill.dueDate;
        primaryBillId = bill._id;
      }
      if (!latestCycle) {
        latestCycle = {
          start: bill.billingCycleStart || bill.utilityCycleStart || null,
          end: bill.billingCycleEnd || bill.utilityCycleEnd || null,
          month: bill.billingMonth || null,
        };
      }
    });

    const overdueDays = latestDueDate ? Math.max(1, Math.round((new Date(now).getTime() - new Date(latestDueDate).getTime()) / (1000 * 60 * 60 * 24))) : null;

    // Overdue Electricity Flag
    if (overdueElecTotal > 0 && supportsSeparateElec) {
      flags.push({
        id: `overdue-elec-${primaryBillId || "overdue"}`,
        code: "overdue_electricity",
        category: "electricity",
        severity: WARNING_SEVERITY.error,
        title: "Overdue Electricity",
        amount: overdueElecTotal,
        dueDate: latestDueDate,
        overdueDays,
        cycle: latestCycle,
        billId: primaryBillId,
        message: `Overdue Electricity billing of ₱${overdueElecTotal.toLocaleString()} is ${overdueDays ? `${overdueDays} days overdue` : "past due"}.`,
        details: "Electricity billing has passed the payment deadline without settlement.",
        impact: "Overdue utility charges accrue daily late penalties (₱50/day) until paid in full.",
        recommendation: "Review the electricity meter breakdown, notify tenant, or record payment.",
        date: latestDueDate,
        createdAt: latestDueDate,
      });
    }

    // Overdue Rent Flag
    if (overdueRentTotal > 0) {
      flags.push({
        id: `overdue-rent-${primaryBillId || "overdue"}`,
        code: "overdue_rent",
        category: "rent",
        severity: WARNING_SEVERITY.error,
        title: "Overdue Rent Billing",
        amount: overdueRentTotal,
        dueDate: latestDueDate,
        overdueDays,
        cycle: latestCycle,
        billId: primaryBillId,
        message: `Overdue Rent billing of ₱${overdueRentTotal.toLocaleString()} is ${overdueDays ? `${overdueDays} days overdue` : "past due"}.`,
        details: "Monthly rent payment has passed its designated due date.",
        impact: "Overdue rent balance is accruing late payment penalties (₱50/day).",
        recommendation: "Review payment breakdown, verify original due date, or follow up with the tenant.",
        date: latestDueDate,
        createdAt: latestDueDate,
      });
    }

    // Overdue Water Flag
    if (overdueWaterTotal > 0 && supportsSeparateWater) {
      flags.push({
        id: `overdue-water-${primaryBillId || "overdue"}`,
        code: "overdue_water",
        category: "water",
        severity: WARNING_SEVERITY.error,
        title: "Overdue Water Share",
        amount: overdueWaterTotal,
        dueDate: latestDueDate,
        overdueDays,
        cycle: latestCycle,
        billId: primaryBillId,
        message: `Overdue Water share of ₱${overdueWaterTotal.toLocaleString()} is ${overdueDays ? `${overdueDays} days overdue` : "past due"}.`,
        details: "Shared water billing has passed its due date without payment.",
        impact: "Overdue water share is subject to late payment penalties.",
        recommendation: "Review room water billing distribution and request settlement.",
        date: latestDueDate,
        createdAt: latestDueDate,
      });
    }

    // Accrued Penalty Flag
    if (overduePenaltyTotal > 0) {
      flags.push({
        id: `overdue-penalty-${primaryBillId || "overdue"}`,
        code: "overdue_penalty",
        category: "penalty",
        severity: WARNING_SEVERITY.error,
        title: "Late Payment Penalties",
        amount: overduePenaltyTotal,
        dueDate: latestDueDate,
        billId: primaryBillId,
        message: `Accumulated late payment penalty of ₱${overduePenaltyTotal.toLocaleString()}.`,
        details: "Late penalties have accrued at the rate of ₱50/day on overdue balances.",
        impact: "Total balance will increase daily until the overdue invoices are paid.",
        recommendation: "Review penalty calculations and ensure timely settlement.",
        date: latestDueDate,
      });
    }

    // Fallback if neither rent/elec/water was separated but bill is overdue
    if (overdueElecTotal === 0 && overdueRentTotal === 0 && overdueWaterTotal === 0 && overduePenaltyTotal === 0) {
      flags.push({
        id: "overdue-balance-general",
        code: "overdue_balance",
        category: "billing",
        severity: WARNING_SEVERITY.error,
        title: "Overdue Payment",
        amount: billingSummary?.currentBalance || 0,
        dueDate: billingSummary?.oldestOverdueDueDate || latestDueDate,
        overdueDays,
        message: "This tenant has an overdue bill.",
        details: "One or more payment invoices have passed their due date without payment.",
        impact: "A daily late payment penalty rate (₱50/day) is accruing on overdue balances until paid in full.",
        recommendation: "Review payment history, send an urgent payment reminder, or record payment.",
        date: billingSummary?.oldestOverdueDueDate || latestDueDate,
      });
    }
  } else if (billingSummary?.hasOutstanding) {
    // Unpaid / Outstanding bills that are not yet overdue
    let pendingRentTotal = 0;
    let pendingElecTotal = 0;
    let pendingWaterTotal = 0;
    let nextDueDate = billingSummary?.nextDueDate || null;
    let primaryBillId = null;
    let latestPendingCycle = null;

    pendingBills.forEach(({ bill }) => {
      const charges = bill?.charges || {};
      const rentAmt = Number(charges.rent || 0);
      const elecAmt = Number(charges.electricity || 0);
      const waterAmt = Number(charges.water || 0);

      if (rentAmt > 0) pendingRentTotal += rentAmt;
      if (elecAmt > 0 && supportsSeparateElec) pendingElecTotal += elecAmt;
      if (waterAmt > 0 && supportsSeparateWater) pendingWaterTotal += waterAmt;

      if (!primaryBillId) primaryBillId = bill._id;
      if (!latestPendingCycle) {
        latestPendingCycle = {
          start: bill.billingCycleStart || bill.utilityCycleStart || null,
          end: bill.billingCycleEnd || bill.utilityCycleEnd || null,
          month: bill.billingMonth || null,
        };
      }
    });

    if (pendingElecTotal > 0 && supportsSeparateElec) {
      flags.push({
        id: `outstanding-elec-${primaryBillId || "pending"}`,
        code: "outstanding_electricity",
        category: "electricity",
        severity: WARNING_SEVERITY.warning,
        title: "Electricity",
        amount: pendingElecTotal,
        dueDate: nextDueDate,
        cycle: latestPendingCycle,
        billId: primaryBillId,
        message: `Current electricity balance: ₱${pendingElecTotal.toLocaleString()}.`,
        details: "Electricity billing is awaiting payment on or before the due date.",
        impact: "Please settle on or before the due date to avoid daily late penalties (₱50/day).",
        recommendation: "Assist tenant with payment options before the due date.",
        date: nextDueDate,
      });
    }

    if (pendingRentTotal > 0) {
      flags.push({
        id: `outstanding-rent-${primaryBillId || "pending"}`,
        code: "outstanding_rent",
        category: "rent",
        severity: WARNING_SEVERITY.warning,
        title: "Rent",
        amount: pendingRentTotal,
        dueDate: nextDueDate,
        cycle: latestPendingCycle,
        billId: primaryBillId,
        message: `Current rent balance: ₱${pendingRentTotal.toLocaleString()}.`,
        details: "Monthly rent invoice is open and due on the scheduled payment date.",
        impact: "The remaining balance needs to be settled on or before the due date.",
        recommendation: "Check payment records or remind tenant to complete payment.",
        date: nextDueDate,
      });
    }

    if (pendingWaterTotal > 0 && supportsSeparateWater) {
      flags.push({
        id: `outstanding-water-${primaryBillId || "pending"}`,
        code: "outstanding_water",
        category: "water",
        severity: WARNING_SEVERITY.warning,
        title: "Water",
        amount: pendingWaterTotal,
        dueDate: nextDueDate,
        cycle: latestPendingCycle,
        billId: primaryBillId,
        message: `Current water share: ₱${pendingWaterTotal.toLocaleString()}.`,
        details: "Water billing is pending payment before the scheduled due date.",
        impact: "The remaining balance needs to be settled on or before the due date.",
        recommendation: "Review water bill distribution and confirm payment schedule.",
        date: nextDueDate,
      });
    }

    // General fallback if no specific charge broke down
    if (pendingElecTotal === 0 && pendingRentTotal === 0 && pendingWaterTotal === 0) {
      flags.push({
        id: "outstanding-balance-general",
        code: "outstanding_balance",
        category: "billing",
        severity: WARNING_SEVERITY.warning,
        title: "Outstanding Balance",
        amount: billingSummary?.currentBalance || 0,
        dueDate: nextDueDate,
        message: "This tenant has an unpaid balance.",
        details: "There is still an open balance on the tenant's current bill.",
        impact: "The remaining balance needs to be settled on or before the due date to avoid accruing daily late penalties (₱50/day).",
        recommendation: "Check payment deadlines, review billing breakdown, or assist tenant with payment completion.",
        date: nextDueDate,
      });
    }
  }

  // 3. Active Tenant Violations
  if (Array.isArray(violations) && violations.length > 0) {
    const VIOLATION_TITLES = {
      smoking_inside: "Smoking Inside Dormitory",
      cooking_in_room: "Cooking in Room",
      unauthorized_appliance: "Unauthorized Appliance",
      unauthorized_visitors: "Unauthorized Visitors / Overnight Guest",
      rfid_misuse: "RFID Misuse / Lending Access Card",
      unauthorized_bed_transfer: "Unauthorized Bed Transfer",
      unauthorized_room_transfer: "Unauthorized Room Transfer",
      property_damage: "Property Damage",
      cleanliness_issues: "Cleanliness & Sanitation Issues",
      persistent_unpaid_bills: "Persistent Unpaid Bills",
      custom: "House Rule Violation",
    };

    violations
      .filter((v) => v && v.status !== "dismissed" && v.status !== "resolved")
      .forEach((v) => {
        const title = VIOLATION_TITLES[v.violationType] || "House Rule Violation";
        const isCritical = v.status === "escalated" || Number(v.penaltyAmount || 0) > 0 || v.violationType === "smoking_inside" || v.violationType === "property_damage";

        flags.push({
          id: `violation-${v._id || v.id}`,
          code: "tenant_violation",
          category: "violation",
          severity: isCritical ? WARNING_SEVERITY.error : WARNING_SEVERITY.warning,
          title: `Active Violation: ${title}`,
          violationId: String(v._id || v.id),
          violationType: v.violationType,
          penaltyAmount: Number(v.penaltyAmount || 0),
          status: v.status,
          dateOfIncident: v.dateOfIncident || v.createdAt || null,
          location: v.locationOfIncident || "",
          message: v.customViolationDescription || v.remarks || `Recorded violation for ${title}.`,
          details: `Incident reported at ${v.locationOfIncident || "Dormitory"} on ${v.dateOfIncident ? new Date(v.dateOfIncident).toLocaleDateString() : "recent date"}. Status: ${v.status}.`,
          impact: Number(v.penaltyAmount || 0) > 0
            ? `Assessed violation penalty of ₱${Number(v.penaltyAmount).toLocaleString()} applies to account deposit/billing.`
            : "Recorded as an official disciplinary notice on the tenant's permanent record.",
          recommendation: "Review violation evidence, verify tenant response, or adjudicate decision.",
          date: v.dateOfIncident || v.createdAt || null,
          createdAt: v.dateOfIncident || v.createdAt || null,
        });
      });
  }

  // 4. Pending Payment Verification
  if (billingSummary?.hasPendingVerification) {
    flags.push({
      id: "pending-verification",
      code: "pending_payment_verification",
      category: "payment",
      severity: WARNING_SEVERITY.warning,
      title: "Payment Receipt Under Review",
      message: "Payment proof is waiting for admin review.",
      details: "The tenant uploaded a payment receipt that needs your verification.",
      impact: "The account balance will update as soon as you verify the payment proof.",
      recommendation: "Go to Billing & Payments to review and verify the submitted receipt.",
    });
  }

  // 5. Room History Incomplete
  if (!hasRoomHistory) {
    flags.push({
      id: "room-history-incomplete",
      code: "room_history_incomplete",
      category: "room",
      severity: WARNING_SEVERITY.warning,
      title: "Incomplete Room History",
      message: "Room history is incomplete for this stay.",
      details: "We don't have a complete record of room or bed transfers for this tenant's stay.",
      impact: "Utility bill calculations will automatically use the current room assignment.",
      recommendation: "Check the tenant's room history or log any room changes if they moved rooms.",
    });
  }

  // 6. Move-Out Billing Notice
  if (moveOutDate) {
    flags.push({
      id: "billing-impact-warning",
      code: "billing_impact_warning",
      category: "stay",
      severity: WARNING_SEVERITY.info,
      title: "Move-Out Billing Notice",
      message: "Move-out date affects bill calculation for this stay.",
      details: "A move-out date has been scheduled for this tenant.",
      impact: "Monthly rent and utility bills will be adjusted to cover only the exact days stayed.",
      recommendation: "Make sure final meter readings and room inspection notes are recorded.",
    });
  }

  return flags;
}

export function buildNextAction({
  stayStatus,
  leaseStatus,
  billingSummary,
}) {
  if (billingSummary.hasPendingVerification) return "verify_payment";
  if (billingSummary.hasOverdue) return "review_overdue_account";
  if (stayStatus === "moving_out") return "process_move_out";
  if (stayStatus === "active" && leaseStatus !== "active") return "renew_lease";
  return "none";
}

export function buildAllowedActions({
  reservation,
  currentStay = null,
  stayStatus,
  billingSummary,
  tenantStatus = "",
  hasAvailableBedsInBranch = true,
  hasFutureRenewal = false,
}) {
  const isMovedInReservation = hasReservationStatus(reservation?.status, "moveIn");
  const normalizedTenantStatus = normalizeTenantStatus(tenantStatus);
  const hasActiveStay = currentStay ? currentStay.status === "active" : isMovedInReservation;
  const canManageStay =
    isMovedInReservation &&
    hasActiveStay &&
    stayStatus !== "moved_out" &&
    !["inactive", "moved_out"].includes(normalizedTenantStatus);

  const withReason = (enabled, reason = "", blockingCodes = [], extra = {}) => ({
    enabled,
    reason,
    blockingCodes,
    ...extra,
  });

  return {
    renew: !canManageStay
      ? withReason(false, "Only active moved-in stays can be renewed.", ["NO_ACTIVE_STAY"])
      : hasFutureRenewal
        ? withReason(false, "A future renewal already exists for this tenant.", ["FUTURE_RENEWAL_EXISTS"])
        : withReason(true),
    transfer: !canManageStay
      ? withReason(false, "Only active moved-in stays can be transferred.", ["NO_ACTIVE_STAY"], { hasAvailableBedsInBranch })
      : !hasAvailableBedsInBranch
        ? withReason(false, "No available same-branch bed is available for transfer.", ["NO_AVAILABLE_BED"], { hasAvailableBedsInBranch })
        : withReason(true, "", [], { hasAvailableBedsInBranch }),
    moveOut: !canManageStay
      ? withReason(false, "Only active moved-in stays can be moved out.", ["NO_ACTIVE_STAY"])
      : withReason(
          true,
          billingSummary.hasOutstanding || billingSummary.hasPendingVerification
            ? "Outstanding billing will remain for final settlement after move-out."
            : "",
          [],
        ),
  };
}

function buildRoomHistoryEntries({ reservation, bedHistoryRecords = [], contracts = [] }) {
  if (bedHistoryRecords.length > 0) {
    return bedHistoryRecords.map((record) => {
      const recordRoomId = String(record.roomId?._id || record.roomId || "");
      const recordBedId = String(record.bedId || "");
      const matchedContract =
        contracts.find((c) => (
          (record.stayId && String(c.stayId) === String(record.stayId)) ||
          (recordRoomId && String(c.roomId) === recordRoomId && recordBedId && String(c.bedId) === recordBedId)
        )) ||
        contracts.find((c) => recordRoomId && String(c.roomId) === recordRoomId) ||
        contracts[0] ||
        null;

      return {
        id: String(record._id),
        room: record.roomId?.name || record.roomId?.roomNumber || reservation.roomId?.name || "Unknown room",
        roomName: record.roomId?.name || reservation.roomId?.name || "Unknown room",
        branch: record.roomId?.branch || reservation.roomId?.branch || "",
        bedId: record.bedId || "",
        bed: record.bedId || record.bedId === 0 ? String(record.bedId) : "",
        bedLabel: record.bedId || record.bedId === 0 ? String(record.bedId) : "",
        moveInDate: record.moveInDate || null,
        moveOutDate: record.moveOutDate || null,
        source: "history",
        contract: matchedContract ? {
          id: String(matchedContract._id),
          contractNumber: matchedContract.contractNumber || "Pending",
          status: matchedContract.status,
          purpose: matchedContract.contractPurpose || "initial",
          isCurrent: matchedContract.isCurrent,
          leaseStartDate: matchedContract.leaseStartDate || null,
          leaseEndDate: matchedContract.leaseEndDate || null,
          approvedMonthlyRate: matchedContract.approvedMonthlyRate || null,
        } : null,
      };
    });
  }

  const moveInDate = readMoveInDate(reservation);
  if (!moveInDate) return [];

  const matchedContract = contracts[0] || null;

  return [
    {
      id: `fallback:${reservation?._id || reservation?.id || "stay"}`,
      room: reservation.roomId?.name || reservation.roomId?.roomNumber || "Unknown room",
      roomName: reservation.roomId?.name || "Unknown room",
      branch: reservation.roomId?.branch || "",
      bedId: reservation.selectedBed?.id || "",
      bed: reservation.selectedBed?.position || reservation.selectedBed?.id || "",
      bedLabel: reservation.selectedBed?.position || reservation.selectedBed?.id || "",
      moveInDate,
      moveOutDate: readMoveOutDate(reservation),
      source: "reservation_fallback",
      contract: matchedContract ? {
        id: String(matchedContract._id),
        contractNumber: matchedContract.contractNumber || "Pending",
        status: matchedContract.status,
        purpose: matchedContract.contractPurpose || "initial",
        isCurrent: matchedContract.isCurrent,
        leaseStartDate: matchedContract.leaseStartDate || null,
        leaseEndDate: matchedContract.leaseEndDate || null,
        approvedMonthlyRate: matchedContract.approvedMonthlyRate || null,
      } : null,
    },
  ];
}

export function buildTenantWorkspaceEntry({
  reservation,
  currentStay = null,
  stayHistory = [],
  bills = [],
  bedHistoryRecords = [],
  contracts = [],
  violations = [],
  tenantStatus = "",
  hasAvailableBedsInBranch = true,
  now = new Date(),
}) {
  const leaseEndDate = currentStay?.leaseEndDate || computeLeaseEndDate(reservation);
  const daysUntilLeaseEnd = computeDaysUntil(leaseEndDate, now);
  const billingSummary = buildBillingSummary(bills, now);
  const stayStatus =
    currentStay?.status === "completed" || currentStay?.status === "terminated"
      ? "moved_out"
      : buildStayStatus(reservation, now);
  const leaseStatus = buildLeaseStatus(daysUntilLeaseEnd);
  const roomHistory = buildRoomHistoryEntries({ reservation, bedHistoryRecords, contracts });
  const branch = reservation?.roomId?.branch || reservation?.branch || currentStay?.branch || null;
  const warningFlags = buildWarningFlags({
    leaseStatus,
    billingSummary,
    hasRoomHistory: roomHistory.length > 0,
    moveOutDate: readMoveOutDate(reservation),
    violations,
    visibleBills: billingSummary.visibleBills,
    branch,
    now,
  });
  const nextAction = buildNextAction({
    stayStatus,
    leaseStatus,
    billingSummary,
  });
  const hasFutureRenewal = stayHistory.some((stay) =>
    currentStay?._id &&
    String(stay.previousStayId || "") === String(currentStay._id) &&
    ["active", "ending_soon"].includes(String(stay.status || "")),
  );
  const allowedActions = buildAllowedActions({
    reservation,
    currentStay,
    stayStatus,
    billingSummary,
    tenantStatus,
    hasAvailableBedsInBranch,
    hasFutureRenewal,
  });

  const tenantUser = reservation.userId || {};
  const personalInformation = resolveTenantPersonalDetails({
    user: tenantUser,
    reservation,
  });
  const fullName = personalInformation.fullName || "Unknown tenant";
  const financialSummary = resolveTenantFinancialSummary({
    reservation,
    currentBalance: billingSummary.currentBalance,
    paymentStatus: billingSummary.paymentStatus,
  });

  return {
    id: String(reservation._id || reservation.id),
    reservationId: String(reservation._id || reservation.id),
    tenantId: String(tenantUser._id || reservation.userId || ""),
    reservationCode: reservation.reservationCode || "",
    tenantName: fullName,
    contact: {
      email: tenantUser.email || reservation.email || "",
      phone: tenantUser.phone || reservation.mobileNumber || "",
    },
    // ── Flattened personal detail fields (consumed by admin modal form) ──────
    name: fullName,
    email: personalInformation.email || tenantUser.email || reservation.email || "",
    phone: personalInformation.phone || tenantUser.phone || reservation.mobileNumber || "",
    birthday: personalInformation.birthDate || reservation.birthday || tenantUser.dateOfBirth || null,
    gender: personalInformation.gender || reservation.gender || tenantUser.gender || null,
    nationality: personalInformation.nationality || reservation.nationality || tenantUser.nationality || null,
    civilStatus: personalInformation.civilStatus || reservation.maritalStatus || tenantUser.civilStatus || null,
    occupation: personalInformation.occupation || reservation.employment?.occupation || tenantUser.occupation || null,
    address: {
      street: reservation.address?.street || reservation.address?.unitHouseNo || tenantUser.address?.street || null,
      barangay: reservation.address?.barangay || tenantUser.address?.barangay || null,
      city: reservation.address?.city || personalInformation.city || tenantUser.city || null,
      province: reservation.address?.province || personalInformation.province || tenantUser.province || null,
    },
    emergencyContact: personalInformation.emergencyContact.name || tenantUser.emergencyContact || null,
    emergencyPhone: personalInformation.emergencyContact.phone || tenantUser.emergencyPhone || null,
    emergencyRelationship: personalInformation.emergencyContact.relationship || tenantUser.emergencyRelationship || null,
    notes: reservation.notes || reservation.personalNotes || null,
    intendedMoveInDate: readMoveInDate(reservation) || null,
    // ── Verification document URL fields ─────────────────────────────────────
    validIDFrontUrl: reservation.validIDFrontUrl || null,
    validIDBackUrl: reservation.validIDBackUrl || null,
    validIDType: reservation.validIDType || reservation.idType || null,
    idType: reservation.idType || reservation.validIDType || null,
    selfiePhotoUrl: reservation.selfiePhotoUrl || null,
    nbiClearanceUrl: reservation.nbiClearanceUrl || null,
    companyIDUrl: reservation.companyIDUrl || null,
    branch: reservation.roomId?.branch || "",
    room: reservation.roomId?.name || reservation.roomId?.roomNumber || "",
    roomId: currentStay?.roomId ? String(currentStay.roomId) : reservation.roomId?._id ? String(reservation.roomId._id) : "",
    bed: (String(reservation.roomId?.type || "").toLowerCase().includes("private") || reservation.roomId?.capacity === 1)
      ? "Private Room"
      : (reservation.selectedBed?.position || reservation.selectedBed?.id || ""),
    bedId: (String(reservation.roomId?.type || "").toLowerCase().includes("private") || reservation.roomId?.capacity === 1)
      ? ""
      : (currentStay?.bedId || reservation.selectedBed?.id || ""),
    moveInDate: currentStay?.leaseStartDate || readMoveInDate(reservation),
    moveOutDate: readMoveOutDate(reservation),
    leaseEndDate,
    daysUntilLeaseEnd,
    monthlyRate: financialSummary.monthlyRate,
    advanceRent: financialSummary.advanceRent,
    securityDeposit: financialSummary.securityDeposit,
    reservationFee: financialSummary.reservationFee,
    currentBalance: billingSummary.currentBalance,
    currentStayId: currentStay?._id ? String(currentStay._id) : String(reservation.currentStayId || ""),
    tenantStatus: normalizeTenantStatus(tenantStatus),
    stayStatus,
    leaseStatus,
    paymentStatus: billingSummary.paymentStatus,
    nextAction,
    nextActionLabel: NEXT_ACTION_LABELS[nextAction] || NEXT_ACTION_LABELS.none,
    allowedActions,
    warningFlags,
    paymentFlags: {
      pendingVerification: billingSummary.hasPendingVerification,
      hasOutstandingBalance: billingSummary.hasOutstanding,
      hasOverdueBalance: billingSummary.hasOverdue,
    },
    lastAdminViewedAt: reservation.lastAdminViewedAt
      ? new Date(reservation.lastAdminViewedAt).toISOString()
      : null,
    isViewedByAdmin: Boolean(reservation.isViewedByAdmin),
    attentionUpdatedAt: (() => {
      const timestamps = [];
      if (billingSummary.hasOverdue || billingSummary.hasPendingVerification) {
        for (const b of bills) {
          if (b.updatedAt) timestamps.push(new Date(b.updatedAt).getTime());
          else if (b.createdAt) timestamps.push(new Date(b.createdAt).getTime());
        }
      }
      if (Array.isArray(violations) && violations.length > 0) {
        for (const v of violations) {
          if (v.dateOfIncident) timestamps.push(new Date(v.dateOfIncident).getTime());
          else if (v.createdAt) timestamps.push(new Date(v.createdAt).getTime());
        }
      }
      if (timestamps.length > 0) {
        const valid = timestamps.filter((t) => !Number.isNaN(t) && t > 0);
        if (valid.length > 0) return new Date(Math.max(...valid)).toISOString();
      }
      return null;
    })(),
    basicInfo: {
      name: fullName,
      email: personalInformation.email || "",
      phone: personalInformation.phone || "",
      birthDate: personalInformation.birthDate,
      address: personalInformation.currentAddress,
      emergencyContactName: personalInformation.emergencyContact.name,
      emergencyContactRelationship:
        personalInformation.emergencyContact.relationship,
      emergencyContactPhone: personalInformation.emergencyContact.phone,
      branch: reservation.roomId?.branch || "",
      room: reservation.roomId?.name || reservation.roomId?.roomNumber || "",
      bed: reservation.selectedBed?.position || reservation.selectedBed?.id || "",
    },
    personalInformation,
    leaseInfo: {
      moveInDate: currentStay?.leaseStartDate || readMoveInDate(reservation),
      leaseEndDate,
      daysUntilLeaseEnd,
      extensionHistory:
        stayHistory.length > 0
          ? stayHistory.map((stay) => ({
              id: String(stay._id || stay.id),
              addedMonths: null,
              previousDuration: null,
              newDuration: null,
              extendedAt: stay.createdAt || null,
              notes: stay.renewalNotes || "",
              leaseStartDate: stay.leaseStartDate || null,
              leaseEndDate: stay.leaseEndDate || null,
              status: stay.status || "",
            }))
          : (reservation.leaseExtensions || []).map((entry, index) => ({
              id: `${reservation._id || reservation.id}:extension:${index}`,
              addedMonths: Number(entry.addedMonths || 0),
              previousDuration: Number(entry.previousDuration || 0),
              newDuration: Number(entry.newDuration || 0),
              extendedAt: entry.extendedAt || null,
              notes: entry.notes || "",
            })),
    },
    paymentInfo: {
      currentBalance: billingSummary.currentBalance,
      paymentStatus: billingSummary.paymentStatus,
      pendingVerification: billingSummary.hasPendingVerification,
      billCount: billingSummary.visibleBills.length,
      monthlyRent: financialSummary.monthlyRate,
      advanceRent: financialSummary.advanceRent,
      securityDeposit: financialSummary.securityDeposit,
      reservationFee: financialSummary.reservationFee,
      visibleBills: billingSummary.visibleBills.map(({ bill, snapshot }) => ({
        _id: String(bill._id || bill.id || ""),
        id: String(bill._id || bill.id || ""),
        status: snapshot?.status || bill.status,
        totalAmount: Number(snapshot?.totalAmount ?? bill.totalAmount ?? 0),
        grossAmount: Number(snapshot?.grossAmount ?? bill.grossAmount ?? bill.totalAmount ?? 0),
        paidAmount: Number(snapshot?.paidAmount ?? bill.paidAmount ?? 0),
        remainingAmount: Number(snapshot?.remainingAmount ?? bill.remainingAmount ?? 0),
        dueDate: bill.dueDate || null,
        billingMonth: bill.billingMonth || null,
        billingCycleStart: bill.billingCycleStart || bill.utilityCycleStart || null,
        billingCycleEnd: bill.billingCycleEnd || bill.utilityCycleEnd || null,
        charges: bill.charges || {},
      })),
    },
    financialSummary,
    roomHistory,
    systemWarnings: warningFlags,
    contracts: (contracts || []).map((c) => ({
      _id: String(c._id || c.id),
      id: String(c._id || c.id),
      contractNumber: c.contractNumber || "",
      status: c.status,
      contractPurpose: c.contractPurpose || "initial",
      isCurrent: c.isCurrent,
      version: c.version,
      leaseStartDate: c.leaseStartDate || null,
      leaseEndDate: c.leaseEndDate || null,
      approvedMonthlyRate: c.approvedMonthlyRate || null,
      signedContractUrl: c.signedContractUrl || null,
      contractPdfUrl: c.contractPdfUrl || null,
      stayProof: c.stayProof || null,
    })),
    dedicatedContract: contracts.length > 0 ? {
      _id: String((contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0])._id || (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).id),
      id: String((contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0])._id || (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).id),
      contractNumber: (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).contractNumber || "",
      status: (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).status,
      contractPurpose: (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).contractPurpose || "initial",
      isCurrent: (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).isCurrent,
      version: (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).version,
      leaseStartDate: (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).leaseStartDate || null,
      leaseEndDate: (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).leaseEndDate || null,
      approvedMonthlyRate: (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).approvedMonthlyRate || null,
      signedContractUrl: (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).signedContractUrl || null,
      contractPdfUrl: (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).contractPdfUrl || null,
      stayProof: (contracts.find((c) => ["active", "draft", "for_revision", "pending_signature", "approved"].includes(c.status)) || contracts[0]).stayProof || null,
    } : null,
  };
}

export function buildTenantWorkspaceStats(entries = []) {
  return {
    totalTenants: entries.length,
    totalResidents: entries.length,
    activeTenants: entries.filter((entry) => entry.stayStatus === "active").length,
    expiringSoon: entries.filter((entry) => entry.leaseStatus === "expiring_soon").length,
    overduePayments: entries.filter((entry) => entry.paymentStatus === "overdue").length,
  };
}
