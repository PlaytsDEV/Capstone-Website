import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  X,
  Users,
  MapPin,
  FileText,
  DollarSign,
  History,
  AlertTriangle,
  CheckCircle,
  Check,
  Shield,
  Download,
  RefreshCw,
  ArrowRightLeft,
  LogOut,
  Trash2,
  Skull,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Info,
  ClipboardList,
  Eye,
  FileCheck,
  ExternalLink,
  Zap,
  Home,
  Droplets,
  AlertOctagon,
  ShieldAlert,
  Receipt,
  Calendar,
  Clock,
  ArrowRight,
} from "lucide-react";
import { showNotification } from "../../../shared/utils/notification";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import DeadlineBadge from "../../../shared/components/DeadlineBadge";
import StatusBadge from "./shared/StatusBadge";
import { formatBedPosition, formatCodedRoomAndBed } from "../../../shared/utils/bedIdentifier";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import {
  useTenantWorkspaceDetail,
  useTenantActionContext,
  useMarkTenantAsViewed,
} from "../../../shared/hooks/queries/useReservations";
import {
  getTenantIndicator,
  getTenantTabIndicators,
  markTenantViewedInStorage,
  getViewedTabsForTenant,
  markTenantTabViewedInStorage,
} from "../pages/tenantWorkspaceActions.mjs";
import { reservationApi } from "../../../shared/api/apiClient";
import { contractApi } from "../../../shared/api/contractApi";
import { formatContractStatus, getContractNextAction } from "../utils/contractUi.mjs";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { userApi } from "../../../shared/api/userApi";
import ForceDeleteModal from "./ForceDeleteModal";
import {
  RenewLeaseModal,
  TransferTenantModal,
  MoveOutModal,
} from "./TenantWorkspaceModals";
import DigitalContractPaper from "../../tenant/components/contracts/DigitalContractPaper";
import SignedContractUploadSection from "./SignedContractUploadSection";
import TenantDetailModalSkeleton from "./TenantDetailModalSkeleton";
import { formatBranch, formatRoomType } from "../utils/formatters";
import { resolveReservationFinancials } from "../../../shared/utils/depositUtils";
import { billingApi } from "../../../shared/api/billingApi";
import RecordViolationModal from "./billing/RecordViolationModal";
import ViolationDetailModal from "./billing/ViolationDetailModal";

const WARNING_DETAILS_MAP = {
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

const formatDate = (d) => {
  if (!d || d === "-") return "N/A";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toISOString().split("T")[0];
};

const formatBillingCycle = (cycle, fallbackDueDate = null) => {
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

const formatMoney = (amount, fallback = "₱0") => {
  if (amount === undefined || amount === null || amount === "") return fallback;
  const num = Number(amount);
  if (Number.isNaN(num)) return fallback;
  return `₱${num.toLocaleString()}`;
};

const getInitials = (name) => {
  if (!name) return "--";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
};

const VIOLATION_CATEGORY_LABELS = {
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

const getViolationStatusBadge = (status) => {
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

const getContractStatusConfig = (status) => {
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

const getPaymentStatusConfig = (status) => {
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

const getOccupancyStatusConfig = (status) => {
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

const getNextActionLabel = (action) => {
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

const getPaymentStatusLabel = (record) => {
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

const getWarningSeverityConfig = (severity) => {
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

function WarningCard({ warning, onAction, tenant }) {
  const isOverdue = warning.severity === "high" || String(warning.code || "").startsWith("overdue_") || warning.type === "overdue_balance";
  const isViolation = warning.code === "tenant_violation" || warning.category === "violation";
  const isElectricity = warning.code === "overdue_electricity" || warning.code === "outstanding_electricity" || warning.category === "electricity";
  const isRent = warning.code === "overdue_rent" || warning.code === "outstanding_rent" || warning.category === "rent";
  const isWater = warning.code === "overdue_water" || warning.code === "outstanding_water" || warning.category === "water";
  const isPenalty = warning.code === "overdue_penalty" || warning.category === "penalty";
  const isLease = warning.code === "lease_expired" || warning.code === "lease_expiring_soon" || warning.category === "contract";
  const isProof = warning.code === "pending_payment_verification" || warning.category === "payment";

  // Semantic Icon
  const getIcon = () => {
    if (isElectricity) return <Zap className={`w-4 h-4 shrink-0 ${isOverdue ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`} />;
    if (isRent) return <Home className={`w-4 h-4 shrink-0 ${isOverdue ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`} />;
    if (isWater) return <Droplets className={`w-4 h-4 shrink-0 ${isOverdue ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`} />;
    if (isViolation) return <ShieldAlert className={`w-4 h-4 shrink-0 ${warning.severity === "high" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`} />;
    if (isPenalty) return <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />;
    if (isLease) return <FileText className={`w-4 h-4 shrink-0 ${warning.code === "lease_expired" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`} />;
    if (isProof) return <Receipt className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />;
    return <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />;
  };

  // Badge Status & Dot Config
  const getBadgeConfig = () => {
    if (isOverdue) {
      return {
        text: warning.overdueDays ? `${warning.overdueDays} Days Overdue` : "Overdue",
        color: "text-rose-700 dark:text-rose-400",
        dot: "bg-rose-500",
      };
    }
    if (isViolation) {
      return {
        text: warning.status ? `Violation (${String(warning.status).replace(/_/g, " ")})` : "Active Violation",
        color: warning.severity === "high" ? "text-rose-700 dark:text-rose-400" : "text-amber-700 dark:text-amber-400",
        dot: warning.severity === "high" ? "bg-rose-500" : "bg-amber-500",
      };
    }
    if (warning.code === "lease_expired") {
      return {
        text: "Contract Expired",
        color: "text-rose-700 dark:text-rose-400",
        dot: "bg-rose-500",
      };
    }
    if (warning.code === "lease_expiring_soon") {
      return {
        text: "Ending Soon",
        color: "text-amber-700 dark:text-amber-400",
        dot: "bg-amber-500",
      };
    }
    if (isProof) {
      return {
        text: "Pending Verification",
        color: "text-sky-700 dark:text-sky-400",
        dot: "bg-sky-500",
      };
    }
    return {
      text: "Pending Settlement",
      color: "text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500",
    };
  };

  const badge = getBadgeConfig();
  const meta = WARNING_DETAILS_MAP[warning.type] || WARNING_DETAILS_MAP[warning.code] || {};
  const rawTitle = warning.title || meta.title || warning.type || "System Warning";
  const title = rawTitle
    .replace(/^Unpaid\s+Electricity$/i, "Electricity")
    .replace(/^Unpaid\s+Water(?:\s+Share)?$/i, "Water")
    .replace(/^Unpaid\s+Rent$/i, "Rent")
    .replace(/^Unpaid\s+Balance$/i, "Outstanding Balance")
    .replace(/^Unpaid\s+/i, "");

  return (
    <div className="p-4 rounded-xl transition-all bg-card border border-border shadow-2xs hover:border-slate-300 dark:hover:border-slate-700">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {getIcon()}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-bold text-xs text-foreground truncate">
              {title}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-transparent border border-slate-200 dark:border-slate-700 ${badge.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              <span className="capitalize">{badge.text}</span>
            </span>
          </div>
        </div>

        {warning.amount != null && Number(warning.amount) > 0 && (
          <span className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
            {formatMoney(warning.amount)}
          </span>
        )}
      </div>

      {/* Main Context / Description */}
      <div className="text-xs text-muted-foreground mt-2 leading-relaxed pl-6.5">
        {warning.message || warning.details || meta.details}
      </div>

      {/* Itemized Context Badges & Metadata */}
      <div className="mt-3 pl-6.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
        {(warning.dueDate || warning.date) && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Due Date: <strong className="text-foreground font-medium">{warning.dueDate || warning.date}</strong></span>
          </div>
        )}
        {warning.dateOfIncident && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Incident Date: <strong className="text-foreground font-medium">{formatDate(warning.dateOfIncident)}</strong></span>
          </div>
        )}
        {warning.location && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Location: <strong className="text-foreground font-medium">{warning.location}</strong></span>
          </div>
        )}
        {warning.penaltyAmount != null && Number(warning.penaltyAmount) > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>Violation Fine: <strong className="text-rose-600 dark:text-rose-400 font-bold">{formatMoney(warning.penaltyAmount)}</strong></span>
          </div>
        )}
        {isOverdue && !isViolation && (
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Daily Penalty: ₱50/day</span>
          </div>
        )}
      </div>

      {/* Quick Action Footer */}
      <div className="mt-3.5 pt-3 border-t border-border/40 flex items-center justify-between gap-3 flex-wrap pl-6.5">
        <span className="text-[11px] text-muted-foreground italic truncate">
          {warning.recommendation || meta.recommendation || (isOverdue ? "Review billing breakdown and record payment." : "Review records and assist tenant.")}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          {(isElectricity || isRent || isWater || isPenalty || warning.code === "overdue_balance" || warning.code === "outstanding_balance" || isOverdue) && (
            <button
              type="button"
              onClick={() => onAction && onAction("view_bill")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>View Bill</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isLease && (
            <button
              type="button"
              onClick={() => onAction && onAction("renew_lease")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Renew Lease</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isViolation && (
            <button
              type="button"
              onClick={() => onAction && onAction("view_violations")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Review Violation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isProof && (
            <button
              type="button"
              onClick={() => onAction && onAction("verify_receipt")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Verify Receipt</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TenantDetailModal({
  tenant: initialTenant,
  onClose,
  initialTab = "overview",
}) {
  useEscapeClose(!!initialTenant, onClose);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogState, setDialogState] = useState({ type: null, loading: false, error: null });
  const [safeguardsData, setSafeguardsData] = useState(null);
  const [dedicatedContract, setDedicatedContract] = useState(null);
  const [contractLookupDone, setContractLookupDone] = useState(false);
  const [allTenantContracts, setAllTenantContracts] = useState([]);
  const [expandedWarnings, setExpandedWarnings] = useState({});
  const [expandedBillCards, setExpandedBillCards] = useState({});
  const toggleBillCard = (id) => {
    setExpandedBillCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const [activeTab, setActiveTab] = useState(initialTab || "overview");
  
  const reservationId =
    initialTenant?.reservationId ||
    initialTenant?._id ||
    initialTenant?.id ||
    null;

  const [viewedTabs, setViewedTabs] = useState(() => {
    const saved = getViewedTabsForTenant(reservationId);
    if (initialTab) saved.add(initialTab);
    saved.add("overview");
    return saved;
  });

  const handleTabChange = useCallback((nextTab) => {
    setActiveTab(nextTab);
    if (reservationId && nextTab) {
      markTenantTabViewedInStorage(reservationId, nextTab);
    }
    setViewedTabs((prev) => {
      const next = new Set(prev);
      next.add(nextTab);
      return next;
    });
  }, [reservationId]);

  const [showMoreActions, setShowMoreActions] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isDocsPanelOpen, setIsDocsPanelOpen] = useState(false);
  const docsPanelRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [downloadingProof, setDownloadingProof] = useState(false);
  const [showDigitalContractModal, setShowDigitalContractModal] = useState(false);
  const [digitalContractData, setDigitalContractData] = useState(null);
  const [activeDigitalContract, setActiveDigitalContract] = useState(null);
  const [loadingDigitalContract, setLoadingDigitalContract] = useState(false);
  const [digitalContractError, setDigitalContractError] = useState("");
  // Guards against an earlier tenant's slow/late-resolving stay-proof
  // fetch overwriting a later tenant's freshly-opened preview — this modal
  // instance is reused across different tenants (no per-tenant remount), so
  // without this a stale response can land after the admin has already
  // switched to someone else's record.
  const digitalContractRequestRef = useRef(0);

  // Tenant Rule Violations & Formal Warnings state
  const [tenantViolations, setTenantViolations] = useState([]);
  const [loadingViolations, setLoadingViolations] = useState(false);
  const [recordViolationOpen, setRecordViolationOpen] = useState(false);
  const [selectedViolationForDetail, setSelectedViolationForDetail] = useState(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      if (reservationId) {
        markTenantTabViewedInStorage(reservationId, initialTab);
      }
      setViewedTabs((prev) => {
        const next = new Set(prev);
        next.add(initialTab);
        return next;
      });
    }
  }, [initialTab, reservationId]);

  useEffect(() => {
    if (activeTab && reservationId) {
      markTenantTabViewedInStorage(reservationId, activeTab);
      setViewedTabs((prev) => {
        if (prev.has(activeTab)) return prev;
        const next = new Set(prev);
        next.add(activeTab);
        return next;
      });
    }
  }, [activeTab, reservationId]);

  // Reset scroll container position when switching tabs to prevent jarring jumps
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const {
    data: fetchedDetail,
    isLoading: isDetailLoading,
  } = useTenantWorkspaceDetail(reservationId);
  const { data: actionContext } = useTenantActionContext(reservationId);
  const markTenantViewedMutation = useMarkTenantAsViewed();

  // Mark tenant workspace record as viewed by admin upon modal inspection
  useEffect(() => {
    if (reservationId) {
      markTenantViewedInStorage(reservationId);
      markTenantViewedMutation.mutate(reservationId);
    }
  }, [reservationId]);

  // Sync dedicatedContract and all contracts from fetched detail or contractApi
  useEffect(() => {
    if (!fetchedDetail && !initialTenant) return;
    const tenantId =
      fetchedDetail?.tenantId ||
      initialTenant?.tenantId?._id ||
      initialTenant?.tenantId ||
      initialTenant?.userId?._id ||
      initialTenant?.userId;

    let active = true;
    setContractLookupDone(false);
    contractApi
      .listContracts({
        tenantId: tenantId ? String(tenantId) : undefined,
        archive: "all",
        limit: 100,
      })
      .then(({ contracts = [] }) => {
        if (!active) return;
        const matchingContracts = contracts.filter(
          (item) =>
            String(item.reservationId) === String(reservationId) ||
            (tenantId && String(item.tenantId) === String(tenantId)),
        );
        setAllTenantContracts(matchingContracts);

        const currentContract =
          fetchedDetail?.dedicatedContract ||
          initialTenant?.dedicatedContract ||
          matchingContracts.find((item) => item.isCurrent && !item.archivedAt) ||
          matchingContracts[0] ||
          null;

        setDedicatedContract(currentContract);
      })
      .catch(() => {
        if (active) {
          setDedicatedContract(null);
          setAllTenantContracts([]);
        }
      })
      .finally(() => {
        if (active) setContractLookupDone(true);
      });
    return () => {
      active = false;
    };
  }, [fetchedDetail, initialTenant, reservationId]);

  // This modal instance is reused across different tenants (no per-tenant
  // remount from the parent), so Digital Contract preview state from a
  // previously viewed tenant must never survive a switch to another one.
  useEffect(() => {
    digitalContractRequestRef.current += 1;
    setShowDigitalContractModal(false);
    setDigitalContractData(null);
    setDigitalContractError("");
    setActiveDigitalContract(null);
    setLoadingDigitalContract(false);
  }, [reservationId]);

  const fetchTenantViolations = useCallback(async () => {
    const targetTenantId =
      fetchedDetail?.tenantId ||
      fetchedDetail?.userId?._id ||
      fetchedDetail?.userId ||
      initialTenant?.tenantId?._id ||
      initialTenant?.tenantId ||
      initialTenant?.userId?._id ||
      initialTenant?.userId ||
      initialTenant?._id;

    if (!targetTenantId) return;

    try {
      setLoadingViolations(true);
      const res = await billingApi.getViolations({
        tenantId: String(targetTenantId),
      });
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setTenantViolations(list);
    } catch (err) {
      console.error("Failed to load tenant violations in detail modal:", err);
    } finally {
      setLoadingViolations(false);
    }
  }, [fetchedDetail, initialTenant]);

  useEffect(() => {
    fetchTenantViolations();
  }, [fetchTenantViolations]);

  const handleDownloadStayProof = async (contractOverride = null) => {
    const targetContract = contractOverride || activeDigitalContract || dedicatedContract;
    setDownloadingProof(true);
    try {
      const targetId =
        targetContract?._id ||
        targetContract?.id ||
        targetContract?.contractNumber ||
        reservationId ||
        initialTenant?.reservationCode ||
        initialTenant?._id ||
        initialTenant?.id;
      const blob = await contractApi.getStayProofFile(targetId, true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Lilycrest-Lease-Contract-${targetContract?.contractNumber || initialTenant?.reservationCode || "Tenant"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const code = err?.response?.data?.code;
      const message = code === "MULTIPLE_CANONICAL_CONTRACTS"
        ? "Multiple active contract records were found for this tenant. Please resolve the conflicting contract records before downloading the lease contract."
        : err?.response?.data?.error || "Failed to generate Lease Contract PDF";
      showNotification(message, "error");
    } finally {
      setDownloadingProof(false);
    }
  };

  const handleOpenDigitalContract = async (specificContract = null) => {
    const selectedContract =
      (specificContract && typeof specificContract === "object")
        ? specificContract
        : dedicatedContract;
    const requestId = ++digitalContractRequestRef.current;
    setActiveDigitalContract(selectedContract);
    // Clear the previous tenant/contract's preview data immediately so a
    // slow request can never leave stale values on screen behind the
    // loading state.
    setDigitalContractData(null);
    setDigitalContractError("");
    setLoadingDigitalContract(true);
    setShowDigitalContractModal(true);
    try {
      const targetId =
        (typeof specificContract === "string"
          ? specificContract
          : specificContract?._id ||
            specificContract?.id ||
            specificContract?.contractNumber) ||
        dedicatedContract?._id ||
        dedicatedContract?.id ||
        dedicatedContract?.contractNumber ||
        reservationId ||
        initialTenant?.reservationCode ||
        initialTenant?._id ||
        initialTenant?.id;
      const res = await contractApi.getStayProofData(targetId);
      if (digitalContractRequestRef.current !== requestId) return; // superseded by a newer open
      if (res?.stayProof) {
        setDigitalContractData(res.stayProof);
      } else {
        setDigitalContractError("The current contract details are unavailable for this tenant.");
      }
    } catch (err) {
      if (digitalContractRequestRef.current !== requestId) return; // superseded by a newer open
      setDigitalContractError(
        err?.response?.data?.error || "Unable to load the current contract details. Please try again.",
      );
    } finally {
      if (digitalContractRequestRef.current === requestId) setLoadingDigitalContract(false);
    }
  };

  const handleWarningAction = (actionType) => {
    if (actionType === "view_bill" || actionType === "verify_receipt") {
      setActiveTab("financials");
    } else if (actionType === "renew_lease") {
      setDialogState({ type: "renew", loading: false, error: null });
    } else if (actionType === "view_violations") {
      onClose();
      navigate("/admin/billing?tab=violations");
    }
  };

  const [generatingReceiptId, setGeneratingReceiptId] = useState(null);

  const handleViewBillReceipt = async (item = null) => {
    const cardId = item?.id || "monthly-rent";
    try {
      setGeneratingReceiptId(cardId);
      const { viewBillingReceiptPDF } = await import("../../../shared/utils/receiptGenerator.js");
      const isElec = item?.category === "electricity" || item?.code?.includes("electricity");
      const isWater = item?.category === "water" || item?.code?.includes("water");
      const isPenalty = item?.category === "penalty" || item?.code?.includes("penalty");
      const isViolation = item?.category === "violation" || item?.code?.includes("violation");
      const isOverdue =
        item?.code?.includes("overdue") ||
        item?.severity === "high" ||
        item?.severity === "error";

      const rentAmount =
        !item || item.category === "rent" || item.code?.includes("rent")
          ? Number(item?.amount || tenant.monthlyRate || 0)
          : 0;

      const payload = {
        id: item?.billId || tenant.reservationId || "bill",
        _id: item?.billId || tenant.reservationId || "bill",
        tenantName: tenant.name || tenant.tenantName || "Tenant",
        tenantEmail: tenant.email || "N/A",
        email: tenant.email || "N/A",
        branch: tenant.branch || "Lilycrest",
        room: tenant.room || "Assigned Room",
        bed: tenant.bed || "",
        roomType: tenant.roomType || "Standard",
        billingMonth: item?.cycle?.month || new Date().toISOString(),
        dueDate: item?.dueDate || tenant.leaseEndDate || new Date().toISOString(),
        status: isOverdue ? "overdue" : "pending",
        totalAmount: Number(item?.amount ?? tenant.monthlyRate ?? 0),
        paidAmount:
          tenant.paymentStatus === "paid" && !item
            ? Number(tenant.monthlyRate || 0)
            : 0,
        charges: {
          rent: rentAmount,
          electricity: isElec ? Number(item?.amount || 0) : 0,
          water: isWater ? Number(item?.amount || 0) : 0,
          penalty: isPenalty ? Number(item?.amount || 0) : 0,
          violation: isViolation ? Number(item?.amount || 0) : 0,
        },
        createdAt: item?.date || new Date().toISOString(),
      };

      await viewBillingReceiptPDF(payload);
    } catch (err) {
      console.error("Failed to generate bill receipt/statement PDF:", err);
      showNotification("Could not generate PDF statement. Please try again.", "error");
    } finally {
      setGeneratingReceiptId(null);
    }
  };

  const toggleWarningDetails = (id) => {
    setExpandedWarnings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Derive a stable Tenant ID from the user's _id (not the reservation).
  const tenantDisplayCode = useMemo(() => {
    const rawTenantId =
      fetchedDetail?.tenantId ||
      initialTenant?.tenantId?._id ||
      initialTenant?.tenantId ||
      initialTenant?.userId?._id ||
      initialTenant?.userId ||
      "";
    const raw = String(rawTenantId);
    if (!raw) return "N/A";
    return `TEN-${raw.slice(-8).toUpperCase()}`;
  }, [fetchedDetail, initialTenant]);

  const attachedDocs = useMemo(() => {
    const source = fetchedDetail || initialTenant || {};
    const docs = [];

    if (source.validIDFrontUrl) {
      docs.push({
        id: "id_front",
        label: "Valid ID (Front)",
        type: source.validIDType || source.idType || "Government ID",
        url: source.validIDFrontUrl,
        category: "identity",
      });
    }
    if (source.validIDBackUrl) {
      docs.push({
        id: "id_back",
        label: "Valid ID (Back)",
        type: source.validIDType || source.idType || "Government ID",
        url: source.validIDBackUrl,
        category: "identity",
      });
    }
    if (source.selfiePhotoUrl) {
      docs.push({
        id: "selfie",
        label: "Selfie Verification Photo",
        type: "Face Verification",
        url: source.selfiePhotoUrl,
        category: "photo",
      });
    }
    if (source.nbiClearanceUrl) {
      docs.push({
        id: "nbi",
        label: "NBI / Police Clearance",
        type: "Clearance Document",
        url: source.nbiClearanceUrl,
        category: "clearance",
      });
    }
    if (source.companyIDUrl) {
      docs.push({
        id: "company",
        label: "Company / Student ID",
        type: "Organization ID",
        url: source.companyIDUrl,
        category: "employment",
      });
    }
    return docs;
  }, [fetchedDetail, initialTenant]);

  const tenant = useMemo(() => {
    const detail = fetchedDetail || initialTenant || {};
    const basicInfo = detail.basicInfo || {};
    const leaseInfo = detail.leaseInfo || {};
    const paymentInfo = detail.paymentInfo || {};
    const personalInfo = detail.personalInformation || {};
    const financialSummary = detail.financialSummary || initialTenant?.financialSummary || {};

    const fullName =
      basicInfo.name ||
      detail.name ||
      detail.tenantName ||
      "Tenant";

    const resolvedFinancials = resolveReservationFinancials(detail, detail);
    const monthlyRate =
      paymentInfo.monthlyRent ??
      financialSummary.monthlyRate ??
      detail.monthlyRate ??
      detail.monthlyRent ??
      resolvedFinancials.monthlyRent ??
      0;
    const advanceRent =
      paymentInfo.advanceRent ??
      financialSummary.advanceRent ??
      detail.advanceRent ??
      detail.moveInCashOut?.monthlyAdvance ??
      resolvedFinancials.advanceRent ??
      monthlyRate;
    const securityDeposit =
      paymentInfo.securityDeposit ??
      financialSummary.securityDeposit ??
      detail.securityDeposit ??
      detail.moveInCashOut?.securityDeposit ??
      resolvedFinancials.securityDeposit ??
      monthlyRate;
    const reservationFee =
      paymentInfo.reservationFee ??
      financialSummary.reservationFee ??
      detail.reservationFee ??
      detail.reservationFeeAmount ??
      detail.pricingSnapshot?.reservationFeeAmount ??
      resolvedFinancials.reservationFeeAmount ??
      2000;

    return {
      ...detail,
      reservationId,
      name: fullName,
      tenantName: fullName,
      initials: getInitials(fullName),
      email: basicInfo.email || detail.email || detail.contact?.email || "N/A",
      phone: basicInfo.phone || detail.phone || detail.contact?.phone || "N/A",
      branch: formatBranch(basicInfo.branch || detail.branch || "") || "N/A",
      room: basicInfo.room || detail.room || "N/A",
      bed: basicInfo.bed || detail.bed || "",
      roomType: detail.roomType || basicInfo.roomType || detail.room?.type || detail.assignedRoom?.type || detail.preferredRoomType || detail.type || "",
      moveInDate: formatDate(leaseInfo.moveInDate || detail.moveInDate || detail.moveIn),
      moveIn: formatDate(leaseInfo.moveInDate || detail.moveInDate || detail.moveIn),
      contractEnd: formatDate(leaseInfo.leaseEndDate || detail.contractEnd || detail.moveOut || detail.leaseEndDate),
      moveOut: formatDate(leaseInfo.leaseEndDate || detail.moveOut || detail.leaseEndDate),
      leaseEndDate: leaseInfo.leaseEndDate || detail.leaseEndDate,
      daysRemaining: leaseInfo.daysUntilLeaseEnd ?? detail.daysUntilLeaseEnd ?? null,
      balance: paymentInfo.currentBalance ?? detail.currentBalance ?? detail.balance ?? 0,
      monthlyRate,
      advanceRent,
      securityDeposit,
      reservationFee,
      paymentStatus: paymentInfo.paymentStatus || detail.paymentStatus || "paid",
      occupancyStatus: detail.stayStatus || detail.occupancyStatus || "active",
      stayStatus: detail.stayStatus || detail.occupancyStatus || "active",
      nextAction: detail.nextAction || "none",
      emergencyContact: basicInfo.emergencyContactName || personalInfo.emergencyContact?.name || detail.emergencyContact || "Not provided",
      emergencyPhone: basicInfo.emergencyContactPhone || personalInfo.emergencyContact?.phone || detail.emergencyPhone || "Not provided",
      emergencyRelationship: basicInfo.emergencyContactRelationship || personalInfo.emergencyContact?.relationship || detail.emergencyRelationship || "Not provided",
      warnings: (detail.systemWarnings || detail.warnings || detail.warningFlags || []).map((w, index) => ({
        id: w.id || w.code || `warning-${index}`,
        type: w.code || w.type || "warning",
        code: w.code || w.type || "warning",
        category: w.category || "general",
        title: w.title || null,
        amount: w.amount || null,
        overdueDays: w.overdueDays || null,
        billId: w.billId || null,
        cycle: w.cycle || null,
        location: w.location || null,
        violationType: w.violationType || null,
        penaltyAmount: w.penaltyAmount || null,
        status: w.status || null,
        dateOfIncident: w.dateOfIncident || null,
        message: w.message || "Warning",
        details: w.details || null,
        impact: w.impact || null,
        recommendation: w.recommendation || null,
        date: w.date ? formatDate(w.date) : (w.createdAt ? formatDate(w.createdAt) : null),
        dueDate: w.dueDate ? formatDate(w.dueDate) : null,
        rawDueDate: w.dueDate || null,
        severity: w.severity === "error" || w.severity === "high" ? "high" : (w.severity === "warning" || w.severity === "medium" ? "medium" : "low"),
      })),
      roomHistory: (detail.roomHistory || []).map((entry) => ({
        id: entry.id,
        branch: formatBranch(entry.branch || basicInfo.branch || detail.branch || "") || "N/A",
        room: entry.roomName || entry.room || "N/A",
        bed: entry.bedLabel || entry.bed || "No bed",
        moveInDate: formatDate(entry.moveInDate),
        moveOutDate: entry.moveOutDate ? formatDate(entry.moveOutDate) : null,
        status: entry.moveOutDate ? "past" : "current",
      })),
      extensionHistory: (leaseInfo.extensionHistory || detail.extensionHistory || []).map((entry) => ({
        id: entry.id,
        duration: entry.addedMonths ? `+${entry.addedMonths} month${entry.addedMonths === 1 ? "" : "s"}` : "+0 months",
        date: formatDate(entry.extendedAt),
        previousEnd: `${entry.previousDuration || 0} months`,
        newEnd: `${entry.newDuration || 0} months`,
      })),
      paymentHistory: paymentInfo.recentPayments || detail.paymentHistory || [],
      tenantId: detail.tenantId || "",
      userId: detail.userId || detail.tenantId || "",
      isOwnerViewing: initialTenant?.isOwnerViewing ?? true,
      reservationCode: detail.reservationCode || initialTenant?.reservationCode || "",
    };
  }, [fetchedDetail, initialTenant, reservationId]);

  const rawTabIndicators = useMemo(() => getTenantTabIndicators(tenant), [tenant]);
  const tabIndicators = useMemo(() => {
    return {
      overview: viewedTabs.has("overview") ? null : rawTabIndicators.overview,
      financials: viewedTabs.has("financials") ? null : rawTabIndicators.financials,
      warnings: viewedTabs.has("warnings") ? null : rawTabIndicators.warnings,
    };
  }, [rawTabIndicators, viewedTabs]);

  const headerIndicator = useMemo(
    () => getTenantIndicator(tenant, { ignoreViewed: true }),
    [tenant],
  );

  const closeDialog = () => {
    setDialogState({ type: null, loading: false, error: null });
  };

  const handleOpenDocsPanel = useCallback(() => {
    setActiveTab("overview");
    setIsDocsPanelOpen(true);
    setTimeout(() => {
      if (docsPanelRef.current) {
        docsPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }, []);

  const invalidateTenantQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reservations"] }),
      queryClient.invalidateQueries({ queryKey: ["rooms"] }),
    ]);

  const isGuadalupe = useMemo(() => {
    const branchStr = String(tenant?.branch || "").toLowerCase();
    return branchStr.includes("guadalupe") || branchStr.includes("guada");
  }, [tenant?.branch]);

  const unpaidUtilityWarnings = useMemo(() => {
    const warns = tenant?.warnings || [];
    return warns.filter((w) => {
      if (
        isGuadalupe &&
        (w.category === "electricity" ||
          w.category === "water" ||
          w.code?.includes("electricity") ||
          w.code?.includes("water"))
      ) {
        return false;
      }
      return (
        w.category === "electricity" ||
        w.category === "water" ||
        w.category === "penalty" ||
        w.category === "rent" ||
        (w.category === "violation" && Number(w.penaltyAmount || w.amount || 0) > 0) ||
        w.code?.includes("electricity") ||
        w.code?.includes("water") ||
        w.code?.includes("penalty") ||
        w.code?.includes("rent") ||
        (w.code?.includes("violation") && Number(w.penaltyAmount || w.amount || 0) > 0)
      );
    });
  }, [tenant?.warnings, isGuadalupe]);

  const roomHistory = useMemo(() => {
    const raw = (tenant?.roomHistory && tenant.roomHistory.length > 0)
      ? tenant.roomHistory
      : (tenant?.branch || tenant?.room)
        ? [
            {
              id: "current-assignment",
              branch: tenant.branch || "N/A",
              room: tenant.room || "N/A",
              bed: tenant.bed || "N/A",
              moveInDate: tenant.moveInDate || tenant.moveIn || null,
              moveOutDate: null,
              status: "current",
              contract: dedicatedContract || null,
            },
          ]
        : [];

    return [...raw].sort((a, b) => {
      const aIsCurrent = a.status === "current" || !a.moveOutDate;
      const bIsCurrent = b.status === "current" || !b.moveOutDate;
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;
      return 0;
    });
  }, [tenant, dedicatedContract]);

  const calculatedDueDate = useMemo(() => {
    const warns = tenant?.warnings || [];
    const overdueWarningItem = warns.find((w) => w.type === "overdue_balance" || w.code === "overdue_balance");
    return tenant?.dueDate || tenant?.lastDueDate || tenant?.overdueDueDate || overdueWarningItem?.dueDate || overdueWarningItem?.date || null;
  }, [tenant]);

  const masterLedgerData = useMemo(() => {
    const items = [];
    const warns = tenant?.warnings || [];

    const rentWarn = warns.find((w) => w.category === "rent" || w.code?.includes("rent"));
    const elecWarn = !isGuadalupe ? warns.find((w) => w.category === "electricity" || w.code?.includes("electricity")) : null;
    const waterWarn = !isGuadalupe ? warns.find((w) => w.category === "water" || w.code?.includes("water")) : null;
    const penaltyWarn = warns.find((w) => w.category === "penalty" || w.code?.includes("penalty"));
    const violationWarns = warns.filter((w) => (w.category === "violation" || w.code?.includes("violation")) && Number(w.penaltyAmount || w.amount || 0) > 0);

    const monthlyRate = Number(tenant?.monthlyRate || 0);

    // 1. Rent Line Item
    const rentRemaining = rentWarn ? Number(rentWarn.amount || 0) : 0;
    const rentBilled = monthlyRate > 0 ? monthlyRate : rentRemaining;
    const rentPaid = Math.max(0, rentBilled - rentRemaining);
    const isRentOverdue = rentWarn && (rentWarn.code?.includes("overdue") || rentWarn.severity === "error" || rentWarn.severity === "high");
    const rentStatus = rentRemaining > 0 ? (isRentOverdue ? "overdue" : "pending") : "paid";

    items.push({
      id: "ledger-rent",
      title: isGuadalupe ? "All-Inclusive Room Rent & Utilities" : "Monthly Room Rent",
      subtitle: isGuadalupe ? "Fixed rate (rent & utilities all-inclusive)" : "Contracted room rate / month",
      category: "rent",
      icon: Home,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      cycle: rentWarn?.cycle || { month: new Date().toISOString() },
      dueDate: rentWarn?.dueDate || calculatedDueDate || tenant?.moveInDate || "Monthly Cycle",
      overdueDays: rentWarn?.overdueDays || null,
      billed: rentBilled,
      paid: rentPaid,
      balance: rentRemaining,
      status: rentStatus,
      rawItem: rentWarn || null,
      details: isGuadalupe
        ? "Fixed all-inclusive monthly rate covering dormitory room occupancy and utility consumption without submetering."
        : "Contracted monthly room rent under active lease agreement. Billed per recurring cycle.",
    });

    // 2. Submetered Electricity Line Item (if supported)
    if (!isGuadalupe && elecWarn) {
      const isElecOverdue = elecWarn.code?.includes("overdue") || elecWarn.severity === "error" || elecWarn.severity === "high";
      const elecRemaining = Number(elecWarn.amount || 0);
      const elecBilled = Number(elecWarn.grossAmount || elecWarn.totalAmount || elecRemaining);
      const elecPaid = Math.max(0, elecBilled - elecRemaining);

      items.push({
        id: elecWarn.id || "ledger-elec",
        title: "Submetered Electricity",
        subtitle: `Room ${tenant?.room || "submeter"} reading`,
        category: "electricity",
        icon: Zap,
        iconColor: "text-amber-500 dark:text-amber-400",
        cycle: elecWarn.cycle || null,
        dueDate: elecWarn.dueDate || calculatedDueDate || "Scheduled",
        overdueDays: elecWarn.overdueDays || null,
        billed: elecBilled,
        paid: elecPaid,
        balance: elecRemaining,
        status: isElecOverdue ? "overdue" : "pending",
        rawItem: elecWarn,
        details: "Calculated from room submeter kWh reading and shared equally among verified room occupants.",
      });
    }

    // 3. Room Water Share Line Item (if supported)
    if (!isGuadalupe && waterWarn) {
      const isWaterOverdue = waterWarn.code?.includes("overdue") || waterWarn.severity === "error" || waterWarn.severity === "high";
      const waterRemaining = Number(waterWarn.amount || 0);
      const waterBilled = Number(waterWarn.grossAmount || waterWarn.totalAmount || waterRemaining);
      const waterPaid = Math.max(0, waterBilled - waterRemaining);

      items.push({
        id: waterWarn.id || "ledger-water",
        title: "Room Water Share",
        subtitle: "Equal room occupant allocation",
        category: "water",
        icon: Droplets,
        iconColor: "text-sky-500 dark:text-sky-400",
        cycle: waterWarn.cycle || null,
        dueDate: waterWarn.dueDate || calculatedDueDate || "Scheduled",
        overdueDays: waterWarn.overdueDays || null,
        billed: waterBilled,
        paid: waterPaid,
        balance: waterRemaining,
        status: isWaterOverdue ? "overdue" : "pending",
        rawItem: waterWarn,
        details: "Shared room water consumption divided equally among active registered room occupants.",
      });
    }

    // 4. Late Payment Penalties Line Item
    if (penaltyWarn) {
      const penaltyAmount = Number(penaltyWarn.amount || 0);
      items.push({
        id: penaltyWarn.id || "ledger-penalty",
        title: "Late Payment Penalties",
        subtitle: "Daily overdue fee accrual (₱50/day)",
        category: "penalty",
        icon: AlertOctagon,
        iconColor: "text-rose-500 dark:text-rose-400",
        cycle: penaltyWarn.cycle || null,
        dueDate: penaltyWarn.dueDate || calculatedDueDate || "Immediate",
        overdueDays: penaltyWarn.overdueDays || null,
        billed: penaltyAmount,
        paid: 0,
        balance: penaltyAmount,
        status: "overdue",
        rawItem: penaltyWarn,
        details: "Daily late penalty accrued automatically at ₱50/day on past-due balances until settled in full.",
      });
    }

    // 5. Active Rule Violations / Disciplinary Fines
    violationWarns.forEach((vWarn) => {
      const fineAmount = Number(vWarn.penaltyAmount || vWarn.amount || 0);
      items.push({
        id: vWarn.id || `ledger-violation-${vWarn.violationId}`,
        title: vWarn.title || "House Rule Violation Fine",
        subtitle: `Incident: ${vWarn.dateOfIncident ? new Date(vWarn.dateOfIncident).toLocaleDateString() : "Disciplinary"}`,
        category: "violation",
        icon: ShieldAlert,
        iconColor: "text-rose-500 dark:text-rose-400",
        cycle: null,
        dueDate: vWarn.date || calculatedDueDate || "Immediate",
        overdueDays: null,
        billed: fineAmount,
        paid: 0,
        balance: fineAmount,
        status: "overdue",
        rawItem: vWarn,
        details: vWarn.details || vWarn.message || "Assessed disciplinary penalty fine.",
      });
    });

    // Reconcile item balances if tenant.balance is explicitly provided
    const currentActualBalance = Number(tenant?.balance ?? 0);
    const calculatedSumBalance = items.reduce((acc, it) => acc + (Number(it.balance) || 0), 0);

    if (calculatedSumBalance !== currentActualBalance && currentActualBalance >= 0) {
      let excessBalance = calculatedSumBalance - currentActualBalance;
      for (let i = 0; i < items.length && excessBalance > 0; i++) {
        const it = items[i];
        if (it.balance > 0) {
          const deductible = Math.min(it.balance, excessBalance);
          it.balance -= deductible;
          it.paid += deductible;
          excessBalance -= deductible;
          if (it.balance === 0) {
            it.status = "paid";
          }
        }
      }
    }

    const totalBilled = items.reduce((acc, it) => acc + (Number(it.billed) || 0), 0);
    const totalPaid = items.reduce((acc, it) => acc + (Number(it.paid) || 0), 0);
    const totalBalance = Math.max(0, totalBilled - totalPaid);

    return {
      items,
      totalBilled,
      totalPaid,
      totalBalance: currentActualBalance > 0 ? currentActualBalance : totalBalance,
    };
  }, [tenant, isGuadalupe, calculatedDueDate]);

  if (!initialTenant && !reservationId) return null;

  // Zero-flash guarantee: If full detail is not yet loaded, render high-contrast skeleton
  if (isDetailLoading || (!fetchedDetail && !initialTenant?.basicInfo)) {
    return <TenantDetailModalSkeleton onClose={onClose} />;
  }

  const contractStatus = dedicatedContract?.status || null;
  const paymentStatus = tenant.paymentStatus || "paid";
  const occupancyStatus = tenant.occupancyStatus || "active";
  const nextAction = tenant.nextAction || "none";
  const paymentHistory = tenant.paymentHistory || [];
  const extensionHistory = tenant.extensionHistory || [];
  const warnings = tenant.warnings || [];

  const contractConfig = getContractStatusConfig(contractStatus);
  const paymentConfig = getPaymentStatusConfig(paymentStatus);
  const occupancyConfig = getOccupancyStatusConfig(occupancyStatus);

  return (
    <div>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* HEADER */}
          <div className="px-6 py-4 border-b border-border bg-card flex-shrink-0 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <ProfileAvatar
                  user={{ name: tenant.name, email: tenant.email }}
                  initials={tenant.initials || getInitials(tenant.name)}
                  size={42}
                  defaultOnly
                />
                {headerIndicator && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center pointer-events-none"
                    title={headerIndicator.tooltip}
                  >
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${headerIndicator.pingClass} opacity-75`} />
                    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${headerIndicator.dotClass}`} />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base text-foreground truncate">{tenant.name}</h3>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${occupancyConfig.color} bg-muted/60`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${occupancyConfig.dot}`} />
                    {occupancyConfig.label}
                  </span>
                  {paymentStatus === "overdue" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Overdue
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 truncate flex-wrap">
                  <span>{tenant.email || "N/A"}</span>
                  <span>•</span>
                  <span>{tenant.phone || "N/A"}</span>
                  <span>•</span>
                  <span className="font-medium text-foreground">{tenant.branch || "N/A"} — {tenant.room || "N/A"}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* BODY - SPLIT PANEL LAYOUT (col-12) */}
          <div
            ref={scrollContainerRef}
            className="p-6 flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] bg-card grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            
            {/* LEFT SIDEBAR (lg:col-span-4) - Fixed Context */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Main Financial Ledger Hero Card */}
              <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    Main Financial Ledger
                  </span>
                  <div className={`flex items-center gap-1 text-xs font-semibold ${paymentConfig.color}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${paymentConfig.dot}`} />
                    <span>{paymentConfig.label}</span>
                  </div>
                </div>

                {/* Primary Balance with Minimal Breakdown */}
                <div className="p-3 bg-card border border-border rounded-lg space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Current Balance</span>
                    <span className={`text-xl font-bold font-mono ${
                      masterLedgerData.totalBalance > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {formatMoney(masterLedgerData.totalBalance)}
                    </span>
                  </div>

                  {/* Minimal Breakdown */}
                  {masterLedgerData.totalBalance > 0 ? (
                    <div className="pt-2 border-t border-border/40 space-y-1.5 text-[11px]">
                      {masterLedgerData.items
                        .filter((it) => it.balance > 0)
                        .map((it) => (
                          <div key={it.id} className="flex items-center justify-between text-muted-foreground">
                            <span className="truncate">{it.title}</span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono shrink-0 ml-2">
                              {formatMoney(it.balance)}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-border/40 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle className="w-3 h-3 shrink-0" />
                      <span>All active charges settled in full</span>
                    </div>
                  )}
                </div>

                {/* Due Date & Deadline if applicable */}
                {calculatedDueDate && masterLedgerData.totalBalance > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Payment Due</span>
                    <span className="font-medium text-foreground">{calculatedDueDate}</span>
                  </div>
                )}

                {(calculatedDueDate || paymentStatus === "overdue") && (
                  <div className="pt-1">
                    <DeadlineBadge
                      dueDate={calculatedDueDate}
                      status={paymentStatus}
                      type="bill"
                      showConsequenceNote={false}
                      penaltyRate={50}
                    />
                  </div>
                )}

              </div>

              {/* Basic Tenant & Room Assignment Card */}
              <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  Tenant & Room Details
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Branch</span>
                    <span className="font-medium text-foreground">{tenant.branch || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Room</span>
                    <span className="font-medium text-foreground">{tenant.room || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bed Position</span>
                    <span className="font-medium text-foreground">
                      {String(tenant.roomType || tenant.room || "").toLowerCase().includes("private") ||
                      String(tenant.bed || "").toLowerCase().includes("private") ||
                      String(tenant.bed || "").toLowerCase().includes("entire")
                        ? "Private Room"
                        : formatBedPosition(tenant.bed)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Move-in Date</span>
                    <span className="font-medium text-foreground">{tenant.moveInDate || tenant.moveIn || "N/A"}</span>
                  </div>
                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Emergency Contact</span>
                      <span className="font-medium text-foreground">{tenant.emergencyContact || "Not provided"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Emergency Phone</span>
                      <span className="font-medium text-foreground">{tenant.emergencyPhone || "Not provided"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Relationship</span>
                      <span className="font-medium text-foreground">{tenant.emergencyRelationship || "Not provided"}</span>
                    </div>
                  </div>
                  <div className="pt-2.5 border-t border-border/40">
                    <button
                      type="button"
                      onClick={handleOpenDocsPanel}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted hover:border-border-strong text-xs font-medium transition-colors cursor-pointer"
                      title="Navigate to and expand attached application documents"
                    >
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        Application & Docs
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                        {attachedDocs.length} Docs
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Operations Panel */}
              {tenant.reservationId && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-2xs">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                    <Shield className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    Quick Operations
                  </h4>
                  <div className="space-y-2">
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2.5 text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
                      onClick={() => setDialogState({ type: "renew", loading: false, error: null })}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Extend Stay
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card text-foreground px-3 py-2.5 text-xs font-semibold hover:bg-muted hover:border-border-strong transition-colors cursor-pointer"
                      onClick={() => setDialogState({ type: "transfer", loading: false, error: null })}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                      Transfer Room
                    </button>

                    {/* Guarded Actions Dropdown Accordion */}
                    <div className="pt-2 border-t border-border/50">
                      <button
                        type="button"
                        onClick={() => setShowMoreActions(!showMoreActions)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer select-none"
                      >
                        <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Danger & Account Actions</span>
                        {showMoreActions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {showMoreActions && (
                        <div className="mt-2 space-y-1.5 pt-1">
                          <button
                            type="button"
                            className="group w-full flex items-center gap-2 rounded-lg border border-border bg-card text-foreground px-3 py-2 text-xs font-medium hover:bg-muted hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-colors shadow-2xs cursor-pointer"
                            onClick={() => setDialogState({ type: "moveOut", loading: false, error: null })}
                          >
                            <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            Move Out Tenant
                          </button>
                          <button
                            type="button"
                            className="group w-full flex items-center gap-2 rounded-lg border border-border bg-card text-foreground px-3 py-2 text-xs font-medium hover:bg-muted hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-colors shadow-2xs cursor-pointer"
                            onClick={() => setDialogState({ type: "deleteTenant", loading: false, error: null })}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            Delete Tenant Record
                          </button>
                          {tenant.isOwnerViewing && (
                            <button
                              type="button"
                              className="w-full flex items-center justify-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-xs font-semibold transition-colors shadow-sm cursor-pointer mt-1"
                              onClick={() => {
                                setSafeguardsData(null);
                                setDialogState({ type: "forceDelete", loading: false, error: null });
                              }}
                            >
                              <Skull className="w-3.5 h-3.5 shrink-0" />
                              Force Delete Account
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* RIGHT WORKSPACE PANEL (lg:col-span-8) - Tabbed Focus View */}
            <div className="lg:col-span-8 flex flex-col space-y-4">
              
              {/* Tab Navigation Header */}
              <div className="flex items-center gap-1 border-b border-border pb-1 overflow-x-auto whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleTabChange("overview")}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex-shrink-0 cursor-pointer ${
                    activeTab === "overview"
                      ? "border-foreground text-foreground bg-muted/50"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Overview & Contract</span>
                  {tabIndicators.overview && activeTab !== "overview" && !viewedTabs.has("overview") && (
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${tabIndicators.overview.dotClass}`}
                      title={tabIndicators.overview.tooltip}
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("financials")}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex-shrink-0 cursor-pointer ${
                    activeTab === "financials"
                      ? "border-foreground text-foreground bg-muted/50"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Financials & Billing</span>
                  {tabIndicators.financials && activeTab !== "financials" && !viewedTabs.has("financials") && (
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${tabIndicators.financials.dotClass}`}
                      title={tabIndicators.financials.tooltip}
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("history")}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex-shrink-0 cursor-pointer ${
                    activeTab === "history"
                      ? "border-foreground text-foreground bg-muted/50"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Room & History</span>
                  {roomHistory.length > 0 && activeTab !== "history" && !viewedTabs.has("history") && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-muted text-muted-foreground font-semibold inline-block">
                      {roomHistory.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("warnings")}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex-shrink-0 cursor-pointer ${
                    activeTab === "warnings"
                      ? "border-foreground text-foreground bg-muted/50"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <AlertTriangle className={`w-3.5 h-3.5 ${activeTab === "warnings" ? "text-amber-600 dark:text-amber-400" : "text-amber-500/80"}`} />
                  <span>Warnings &amp; Infractions</span>
                  {(warnings.length > 0 || tenantViolations.filter((v) => !["dismissed", "resolved"].includes(v.status)).length > 0) && activeTab !== "warnings" && !viewedTabs.has("warnings") && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 inline-block border border-slate-200 dark:border-slate-700">
                      {warnings.length + tenantViolations.filter((v) => !["dismissed", "resolved"].includes(v.status)).length}
                    </span>
                  )}
                </button>
              </div>

              {/* TAB CONTENT VIEWS */}
              <div className="flex-1 space-y-4">
                
                {/* TAB 1: OVERVIEW & CONTRACT */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    {/* Digital Stay Record & Tenancy Proof Card */}
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-foreground flex items-center justify-between uppercase tracking-wide">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          Digital Stay Record &amp; Proof
                        </span>
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Verified Active Stay</span>
                        </div>
                      </h4>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Move-in Date</span>
                            <span className="font-semibold text-foreground">{formatDate(dedicatedContract?.leaseStartDate || tenant.moveInDate || tenant.moveIn)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Lease End Date</span>
                            <span className="font-semibold text-foreground">{formatDate(dedicatedContract?.leaseEndDate || tenant.contractEnd || tenant.moveOut || tenant.leaseEndDate)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Stay Reference</span>
                            <span className="font-semibold font-mono text-foreground">{dedicatedContract?.contractNumber || tenant.reservationCode || "LIL-RES-RECORD"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Monthly Rent Rate</span>
                            <span className="font-semibold text-foreground">{formatMoney(tenant.monthlyRate || dedicatedContract?.approvedMonthlyRate)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            onClick={handleOpenDigitalContract}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Digital Contract
                          </button>

                          <button
                            type="button"
                            disabled={downloadingProof}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            onClick={handleDownloadStayProof}
                          >
                            <Download className="w-3.5 h-3.5" />
                            {downloadingProof ? "Generating PDF…" : "Download Lease Contract (PDF)"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Wet-Signed & Scanned Contract Upload Section */}
                    <SignedContractUploadSection
                      tenant={tenant}
                      dedicatedContract={dedicatedContract}
                      onContractUpdated={(updated) => setDedicatedContract(updated)}
                    />

                    {/* Submitted Tenant Application Form Card */}
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-foreground flex items-center justify-between uppercase tracking-wide">
                        <span className="flex items-center gap-1.5">
                          <ClipboardList className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          Submitted Tenant Application Form
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground bg-card px-2 py-0.5 rounded border border-border/50">
                          {fetchedDetail?.reservationCode || tenant.reservationCode || tenant.reservationId || "RES-APP"}
                        </span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        {/* Demographics */}
                        <div className="p-3 bg-card border border-border rounded-xl space-y-2.5 shadow-sm">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider border-b border-border/40 pb-1.5">
                            Personal Demographics
                          </span>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">Full Name</span>
                              <span className="font-semibold text-foreground text-xs">{fetchedDetail?.name || tenant.name || tenant.tenantName}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">Gender</span>
                              <span className="font-semibold text-foreground text-xs capitalize">{fetchedDetail?.gender || tenant.gender || tenant.userId?.gender || "Not specified"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">Date of Birth</span>
                              <span className="font-semibold text-foreground text-xs">{formatDate(fetchedDetail?.birthday || tenant.birthday || tenant.userId?.dateOfBirth)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">Civil / Marital Status</span>
                              <span className="font-semibold text-foreground text-xs capitalize">{fetchedDetail?.civilStatus || tenant.civilStatus || tenant.maritalStatus || tenant.userId?.civilStatus || "Not specified"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">Nationality</span>
                              <span className="font-semibold text-foreground text-xs">{fetchedDetail?.nationality || tenant.nationality || tenant.userId?.nationality || "Not specified"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">Occupation / Status</span>
                              <span className="font-semibold text-foreground text-xs capitalize">{fetchedDetail?.occupation || tenant.occupation || tenant.employment || tenant.userId?.occupation || "Not specified"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Permanent Residential Address */}
                        <div className="p-3 bg-card border border-border rounded-xl space-y-2.5 shadow-sm">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider border-b border-border/40 pb-1.5">
                            Permanent Residential Address
                          </span>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">Street / House No.</span>
                              <span className="font-semibold text-foreground text-xs">{fetchedDetail?.address?.street || tenant.address?.street || tenant.address?.unitHouseNo || tenant.userId?.address?.street || "Not specified"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">Barangay</span>
                              <span className="font-semibold text-foreground text-xs">{fetchedDetail?.address?.barangay || tenant.address?.barangay || tenant.userId?.address?.barangay || "Not specified"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">City / Municipality</span>
                              <span className="font-semibold text-foreground text-xs">{fetchedDetail?.address?.city || tenant.address?.city || tenant.userId?.city || tenant.city || "Not specified"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">Province / Region</span>
                              <span className="font-semibold text-foreground text-xs">{fetchedDetail?.address?.province || tenant.address?.province || tenant.userId?.province || tenant.province || "Not specified"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Emergency Contact */}
                        <div className="p-3 bg-card border border-border rounded-xl space-y-2.5 shadow-sm">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider border-b border-border/40 pb-1.5">
                            Emergency Contact Person
                          </span>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="col-span-2 sm:col-span-1">
                              <span className="text-muted-foreground block text-[11px] font-medium">Contact Name</span>
                              <span className="font-semibold text-foreground text-xs">{fetchedDetail?.emergencyContact || tenant.emergencyContact || tenant.userId?.emergencyContact || "Not specified"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">Contact Phone</span>
                              <span className="font-semibold text-foreground text-xs">{fetchedDetail?.emergencyPhone || tenant.emergencyPhone || tenant.userId?.emergencyPhone || "Not specified"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px] font-medium">Relationship</span>
                              <span className="font-semibold text-foreground text-xs capitalize">{fetchedDetail?.emergencyRelationship || tenant.emergencyRelationship || tenant.userId?.emergencyRelationship || "Not specified"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Application & Move-In Details */}
                        <div className="p-3 bg-card border border-border rounded-xl space-y-2.5 shadow-sm">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider border-b border-border/40 pb-1.5">
                            Application & Move-in Details
                          </span>
                          <div className="space-y-2.5 text-xs">
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <span className="text-muted-foreground block text-[11px] font-medium">Intended Move-in Date</span>
                                <span className="font-semibold text-foreground text-xs">{formatDate(fetchedDetail?.intendedMoveInDate || tenant.moveInDate || tenant.intendedMoveInDate)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[11px] font-medium">Selected Room & Bed</span>
                                <span className="font-semibold text-foreground text-xs leading-snug block">
                                  {formatCodedRoomAndBed(tenant.room, tenant.bed, tenant.branch)}
                                </span>
                              </div>
                            </div>

                            <div className="pt-1.5 border-t border-border/40">
                              <span className="text-muted-foreground block text-[11px] font-medium mb-1">Special Requests / Personal Notes</span>
                              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 text-foreground text-[11px] leading-relaxed">
                                {fetchedDetail?.notes || tenant.notes || tenant.personalNotes || "No special requests or additional notes submitted in the application form."}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Attached Verification Documents & Media Card */}
                    <div
                      ref={docsPanelRef}
                      id="attached-verification-docs-panel"
                      className="bg-muted/30 border border-border/60 rounded-xl overflow-hidden scroll-mt-6"
                    >
                      {/* Collapsible Header */}
                      <button
                        type="button"
                        onClick={() => setIsDocsPanelOpen((v) => !v)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wide">
                          <FileCheck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          Attached Verification Documents &amp; Media ({attachedDocs.length})
                        </span>
                        <span className="flex items-center gap-2">
                          {attachedDocs.length > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Documents Uploaded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              No Files Attached
                            </span>
                          )}
                          {isDocsPanelOpen
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </span>
                      </button>

                      {/* Collapsible Body */}
                      {isDocsPanelOpen && (
                        <div className="px-4 pb-4">
                          {attachedDocs.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1 text-xs">
                              {attachedDocs.map((doc) => (
                                <div
                                  key={doc.id}
                                  onClick={() => setPreviewDoc(doc)}
                                  className="bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-md transition-all cursor-pointer group"
                                  title={`Click to view: ${doc.label}`}
                                >
                                  {/* Thumbnail or File Placeholder */}
                                  {doc.url && (doc.url.match(/\.(jpeg|jpg|png|gif|webp)($|\?)/i) || doc.category === "photo" || doc.category === "identity") ? (
                                    <div className="w-full h-32 bg-muted/40 overflow-hidden relative">
                                      <img
                                        src={doc.url}
                                        alt={doc.label}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-semibold">
                                        <Eye className="w-4 h-4" /> View Full
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="w-full h-20 bg-muted/40 flex flex-col items-center justify-center text-muted-foreground gap-1.5 group-hover:bg-muted/60 transition-colors">
                                      <FileText className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                                      <span className="text-[11px] font-medium">Document File</span>
                                    </div>
                                  )}
                                  {/* Label row */}
                                  <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-t border-border/40">
                                    <span className="font-semibold text-foreground text-[11px] truncate">{doc.label}</span>
                                    <span className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded flex-shrink-0">
                                      {doc.type}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-4 bg-card border border-border rounded-lg text-center space-y-1">
                              <p className="text-xs font-medium text-foreground">No verification documents attached to this application.</p>
                              <p className="text-[11px] text-muted-foreground">The tenant did not upload custom ID photos or clearance files during registration.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Extensions */}
                    {extensionHistory.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-2xs">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          <History className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          Lease Extension History ({extensionHistory.length})
                        </h4>
                        <div className="divide-y divide-border/40 text-xs">
                          {extensionHistory.map((extension) => (
                            <div key={extension.id} className="py-2.5 first:pt-1 last:pb-0 text-xs">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-semibold text-foreground">{extension.duration}</span>
                                <span className="text-muted-foreground text-[11px]">{extension.date}</span>
                              </div>
                              <div className="text-muted-foreground text-[11px]">{extension.previousEnd} → {extension.newEnd}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: FINANCIALS & BILLING */}
                {activeTab === "financials" && (
                  <div className="space-y-4">
                    {/* Consolidated Financial & Billing Ledger Container */}
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-4">
                      {/* Header with Single Action Buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/40">
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                            <Receipt className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                            <span>Itemized Statement of Account</span>
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Detailed breakdown of contracted rent, submetered utilities, and move-in deposits
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleViewBillReceipt(null)}
                            disabled={generatingReceiptId === "monthly-rent"}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium text-xs transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                            title="Download official Statement of Account (SOA) PDF"
                          >
                            {generatingReceiptId === "monthly-rent" ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                <span>Generating SOA...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                <span>Download Statement (SOA)</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              navigate(`/admin/billing?tenant=${tenant.reservationId || ""}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                            title="Open tenant's complete billing records in Admin Billing manager"
                          >
                            <span>Review in Billing</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Section 1: Itemized Billing Dues Cards */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-foreground block uppercase tracking-wider">
                            Itemized Dues &amp; Recurring Charges
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {masterLedgerData.items.length} active ledger {masterLedgerData.items.length === 1 ? "entry" : "entries"}
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {masterLedgerData.items.map((item) => {
                            const Icon = item.icon || Receipt;
                            const isExpanded = !!expandedBillCards[item.id];
                            const isOverdue = item.status === "overdue";
                            const isPaid = item.status === "paid" || item.balance <= 0;
                            const cycleDisplay = formatBillingCycle(item.cycle, item.dueDate);

                            return (
                              <div
                                key={item.id}
                                className="p-3.5 bg-card border border-border rounded-xl shadow-2xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 space-y-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  {/* Left: Icon, Title, Status Dot, Subtitle */}
                                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 ${item.iconColor || "text-muted-foreground"}`} />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-foreground">
                                          {item.title}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                          isPaid
                                            ? "text-emerald-700 dark:text-emerald-400"
                                            : isOverdue
                                            ? "text-rose-700 dark:text-rose-400"
                                            : "text-amber-700 dark:text-amber-400"
                                        }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${
                                            isPaid ? "bg-emerald-500" : isOverdue ? "bg-rose-500" : "bg-amber-500"
                                          }`} />
                                          <span>{isPaid ? "Settled" : isOverdue ? "Overdue" : "Pending"}</span>
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                                        <span>Payment Due: <strong className="font-medium text-foreground">{item.dueDate || "Pending"}</strong></span>
                                        <span className="text-border">•</span>
                                        <span>Cycle: <strong className="font-medium text-foreground">{cycleDisplay}</strong></span>
                                        {isOverdue && item.overdueDays ? (
                                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                                            ({item.overdueDays} days past due)
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: Amount & Actions */}
                                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                                    <div className="text-left sm:text-right">
                                      <div className={`text-base font-bold font-mono ${
                                        isPaid
                                          ? "text-foreground"
                                          : "text-rose-600 dark:text-rose-400"
                                      }`}>
                                        {isPaid ? formatMoney(item.billed) : formatMoney(item.balance)}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground">
                                        {isPaid
                                          ? (item.category === "rent" ? "Monthly Rate (Covered)" : "Settled in Full")
                                          : `Due Now (Assessed: ${formatMoney(item.billed)})`}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleViewBillReceipt(item.rawItem || item)}
                                        disabled={generatingReceiptId === (item.rawItem?.id || item.id)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-semibold text-[11px] transition-all cursor-pointer shadow-xs whitespace-nowrap"
                                        title="View / Download official statement receipt PDF"
                                        aria-label="View official statement receipt"
                                      >
                                        {generatingReceiptId === (item.rawItem?.id || item.id) ? (
                                          <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                            <span>Generating...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span>Receipt / Statement</span>
                                          </>
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => toggleBillCard(item.id)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-[11px] transition-all cursor-pointer shadow-xs whitespace-nowrap"
                                        aria-label={`Toggle breakdown for ${item.title}`}
                                      >
                                        <span>{isExpanded ? "Hide Details" : "Breakdown"}</span>
                                        <ChevronDown
                                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                            isExpanded ? "rotate-180" : ""
                                          }`}
                                        />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Seamless Expanded Breakdown */}
                                {isExpanded && (
                                  <div className="pt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4 text-[11px]">
                                    <div>
                                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Charge Category</span>
                                      <span className="font-medium text-foreground capitalize">
                                        {item.category === "rent" ? "Monthly Contracted Rent" : item.category === "electricity" ? "Submetered Electricity" : item.category === "water" ? "Shared Room Water" : item.category === "penalty" ? "Daily Late Fee (₱50/day)" : "Disciplinary Fine"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Assigned Unit</span>
                                      <span className="font-medium text-foreground">{tenant.room || "Room"}{tenant.bed ? ` (Bed ${tenant.bed})` : ""}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Billing Cycle</span>
                                      <span className="font-medium text-foreground">{cycleDisplay}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Settlement Status</span>
                                      <span className={`font-medium ${isPaid ? "text-emerald-600 dark:text-emerald-400" : isOverdue ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
                                        {isPaid ? `Paid in Full (${formatMoney(item.paid)})` : `Balance Open: ${formatMoney(item.balance)}`}
                                      </span>
                                    </div>
                                    <div className="sm:col-span-2 md:col-span-4 pt-1.5 text-[11px] text-muted-foreground border-t border-border/30">
                                      {item.details}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Section 2: Move-In Requirements & Deposits */}
                      <div className="space-y-3 pt-2 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-foreground block uppercase tracking-wider">
                            Move-in Fees &amp; Security Deposits
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          {/* 1. Advance Rent */}
                          <div className="p-3 bg-card border border-border rounded-xl flex flex-col justify-between gap-2 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground text-[11px] font-medium">Advance Rent</span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>1 Month Applied</span>
                              </span>
                            </div>
                            <div>
                              <div className="text-base font-bold text-foreground font-mono">
                                {formatMoney(tenant.advanceRent)}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Applied toward Month 1 stay
                              </div>
                            </div>
                          </div>

                          {/* 2. Security Deposit */}
                          <div className="p-3 bg-card border border-border rounded-xl flex flex-col justify-between gap-2 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground text-[11px] font-medium">Security Deposit</span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                <span>Held (Refundable)</span>
                              </span>
                            </div>
                            <div>
                              <div className="text-base font-bold text-foreground font-mono">
                                {formatMoney(tenant.securityDeposit)}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Held in escrow for checkout clearance
                              </div>
                            </div>
                          </div>

                          {/* 3. Reservation Fee */}
                          <div className="p-3 bg-card border border-border rounded-xl flex flex-col justify-between gap-2 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground text-[11px] font-medium">Reservation Fee</span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Paid &amp; Credited</span>
                              </span>
                            </div>
                            <div>
                              <div className="text-base font-bold text-foreground font-mono">
                                {formatMoney(tenant.reservationFee)}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Credited at move-in settlement
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Payment History */}
                    {paymentHistory.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-2xs">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          <DollarSign className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          Recent Payments ({paymentHistory.length})
                        </h4>
                        <div className="divide-y divide-border/40 text-xs">
                          {paymentHistory.map((payment) => {
                            const paymentStatusConfig = getPaymentStatusLabel(payment);
                            return (
                              <div key={payment.id} className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-bold text-foreground block">₱{Number(payment.amount || 0).toLocaleString()}</span>
                                  <span className="text-muted-foreground text-[11px]">{payment.date} • {payment.method} ({payment.reference})</span>
                                </div>
                                <div className={`px-2 py-0.5 text-xs font-semibold rounded ${paymentStatusConfig.bg} ${paymentStatusConfig.color}`}>
                                  {paymentStatusConfig.label}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: ROOM & STAY HISTORY */}
                {activeTab === "history" && (
                  <div className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-2xs">
                      <div className="flex justify-between items-center pb-2 border-b border-border/40">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          <History className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          Room Stay Timeline ({roomHistory.length})
                        </h4>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-muted/40 px-2 py-0.5 rounded border border-border/50">
                          {roomHistory.filter((c) => c.status === "current" || !c.moveOutDate).length} Current · {roomHistory.filter((c) => c.status !== "current" && c.moveOutDate).length} Past
                        </span>
                      </div>

                      {roomHistory.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-xs">
                          No room stay records available for this tenant.
                        </div>
                      ) : (
                        <div className="stay-timeline">
                          {roomHistory.map((room, idx) => {
                            const isCurrent = room.status === "current" || !room.moveOutDate;
                            const isLast = idx === roomHistory.length - 1;
                            const moveIn = (() => {
                              if (!room.moveInDate) return null;
                              try { return new Date(room.moveInDate).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }); }
                              catch { return room.moveInDate; }
                            })();
                            const moveOut = (() => {
                              if (!room.moveOutDate) return null;
                              try { return new Date(room.moveOutDate).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }); }
                              catch { return room.moveOutDate; }
                            })();
                            const stayContract = room.contract || (isCurrent ? dedicatedContract : null);

                            return (
                              <div key={room.id || room._id || idx} className="stay-timeline__entry">
                                <div className="stay-timeline__left">
                                  <div className={`stay-timeline__dot ${isCurrent ? "stay-timeline__dot--current" : "stay-timeline__dot--past"}`} />
                                  {!isLast && <div className="stay-timeline__connector" />}
                                </div>
                                <div className="stay-timeline__body">
                                  <div className="stay-timeline__header">
                                    <span className="stay-timeline__room">
                                      {room.branch ? `${room.branch} — ` : ""}{room.room || room.roomName || "Unknown Room"}
                                      {room.bed ? ` — ${room.bed}` : ""}
                                    </span>
                                    {isCurrent ? (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-transparent text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        Current
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-transparent text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                        Past Stay
                                      </span>
                                    )}
                                  </div>

                                  <div className="stay-timeline__meta text-muted-foreground text-xs space-y-0.5 mt-1">
                                    <div>
                                      Bed: <span className="text-foreground capitalize font-medium">{room.bed || tenant.bed || "N/A"}</span> • Move-in Date: {moveIn || tenant.moveInDate || tenant.moveIn || "N/A"}{moveOut ? ` — Move-out Date: ${moveOut}` : isCurrent ? " — Active" : ""}
                                    </div>
                                  </div>

                                  {/* Contract Proof for this Stay */}
                                  {stayContract && (
                                    <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap text-xs bg-muted/20 p-2.5 rounded-lg">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                                        <span className="text-muted-foreground truncate">
                                          {isCurrent ? "Current Lease Contract" : "Contract"}: <strong className="text-foreground font-mono">{stayContract.contractNumber || "Pending"}</strong>
                                        </span>
                                        {stayContract.purpose === "replacement" && (
                                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                                            Transfer Replacement
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                                        <button
                                          type="button"
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-[#0A1628] hover:text-[#13243D] dark:text-sky-400 dark:hover:text-sky-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                          onClick={() => handleOpenDigitalContract(stayContract)}
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          <span>View Digital Contract</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: TENANT RULE INFRACTIONS & SYSTEM WARNINGS */}
                {activeTab === "warnings" && (
                  <div className="space-y-4">
                    {/* Header Action Bar */}
                    <div className="flex items-center justify-between bg-muted/30 border border-border/60 rounded-xl p-3.5 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                            Rule Compliance &amp; Account Safeguards
                          </h4>
                          <p className="text-[11px] text-muted-foreground">
                            {tenantViolations.length} infraction record(s) on file · {warnings.length} system alert(s)
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecordViolationOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer shadow-xs"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>+ Log Rule Infraction</span>
                      </button>
                    </div>

                    {/* Section 1: House Rule Violations & Formal Warnings */}
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          House Rule Violations &amp; Written Warnings ({tenantViolations.length})
                        </h4>
                        <span className="text-[11px] text-muted-foreground">Formal strike tracking</span>
                      </div>

                      {loadingViolations ? (
                        <div className="space-y-2">
                          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                        </div>
                      ) : tenantViolations.length > 0 ? (
                        <div className="space-y-3">
                          {tenantViolations.map((v) => {
                            const badge = getViolationStatusBadge(v.status);
                            const catLabel = VIOLATION_CATEGORY_LABELS[v.violationType] || v.violationType || "Rule Infraction";
                            const hasPhoto = (v.evidenceUrls && v.evidenceUrls.length > 0) || v.evidenceUrl;
                            const primaryPhoto = (v.evidenceUrls && v.evidenceUrls[0]) || v.evidenceUrl;

                            return (
                              <div
                                key={v._id || v.id}
                                className="bg-card border border-border rounded-xl p-3.5 space-y-2.5 transition-all"
                              >
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      Warning #{v.warningNumber || 1}
                                    </span>
                                    <span className="text-xs font-bold text-foreground">
                                      {catLabel}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs font-medium">
                                    <div className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                    <span className={badge.color}>{badge.label}</span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>
                                      {v.dateOfIncident ? formatDate(v.dateOfIncident) : "N/A"}
                                      {v.timeOfIncident ? ` at ${v.timeOfIncident}` : ""}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{v.locationOfIncident || "Assigned Room"}</span>
                                  </div>
                                </div>

                                {v.evidenceNotes && (
                                  <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border border-border/50">
                                    {v.evidenceNotes}
                                  </p>
                                )}

                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {Number(v.penaltyApplied) > 0 && (
                                      <span className="text-rose-600 dark:text-rose-400 font-semibold font-mono">
                                        Penalty: ₱{Number(v.penaltyApplied).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                      </span>
                                    )}
                                    {hasPhoto && (
                                      <button
                                        type="button"
                                        onClick={() => setPreviewDoc({ url: primaryPhoto, label: `Evidence: ${catLabel}`, category: "photo" })}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                                      >
                                        <Eye className="w-3 h-3" />
                                        <span>View Evidence Photo</span>
                                      </button>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setSelectedViolationForDetail(v)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground transition-colors cursor-pointer ml-auto"
                                  >
                                    <span>Review Infraction</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-center rounded-lg bg-card border border-border/50 text-xs text-muted-foreground">
                          Zero house rule infractions on record for this tenant.
                        </div>
                      )}
                    </div>

                    {/* Section 2: Account & Financial System Warnings */}
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          Account &amp; Financial Warnings ({warnings.length})
                        </h4>
                        <span className="text-[11px] text-muted-foreground">Overdue &amp; contract triggers</span>
                      </div>

                      {warnings.length > 0 ? (
                        <div className="space-y-3">
                          {warnings.map((warning) => (
                            <WarningCard
                              key={warning.id}
                              warning={warning}
                              onAction={handleWarningAction}
                              tenant={tenant}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center rounded-lg bg-card border border-border/50 text-xs text-muted-foreground">
                          All account metrics, rent statements, and contract safeguards are clear.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 5: SUBMITTED APPLICATION FORM DETAILS */}
                {activeTab === "application" && (
                  <div className="space-y-4">
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-foreground flex items-center justify-between uppercase tracking-wide">
                        <span className="flex items-center gap-1.5">
                          <ClipboardList className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          Submitted Tenant Application Form
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground bg-card px-2 py-0.5 rounded border border-border/50">
                          {tenant.reservationCode || tenant.reservationId || "RES-APP"}
                        </span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        {/* Demographics */}
                        <div className="p-3 bg-card border border-border rounded-lg space-y-2">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">Personal Demographics</span>
                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Full Name</span>
                              <span className="font-semibold text-foreground">{tenant.name || tenant.tenantName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Gender</span>
                              <span className="font-medium text-foreground capitalize">{tenant.gender || tenant.userId?.gender || "Not specified"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Date of Birth</span>
                              <span className="font-medium text-foreground">{formatDate(tenant.birthday || tenant.userId?.dateOfBirth)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Civil / Marital Status</span>
                              <span className="font-medium text-foreground capitalize">{tenant.civilStatus || tenant.maritalStatus || tenant.userId?.civilStatus || "Single"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Nationality</span>
                              <span className="font-medium text-foreground">{tenant.nationality || tenant.userId?.nationality || "Filipino"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Occupation / Status</span>
                              <span className="font-medium text-foreground capitalize">{tenant.occupation || tenant.employment || tenant.userId?.occupation || "Not specified"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Permanent Residential Address */}
                        <div className="p-3 bg-card border border-border rounded-lg space-y-2">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">Permanent Residential Address</span>
                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Street / House No.</span>
                              <span className="font-medium text-foreground">{tenant.address?.street || tenant.address?.unitHouseNo || tenant.userId?.address?.street || "Not specified"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Barangay</span>
                              <span className="font-medium text-foreground">{tenant.address?.barangay || tenant.userId?.address?.barangay || "Not specified"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">City / Municipality</span>
                              <span className="font-medium text-foreground">{tenant.address?.city || tenant.userId?.city || tenant.city || "Not specified"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Province / Region</span>
                              <span className="font-medium text-foreground">{tenant.address?.province || tenant.userId?.province || tenant.province || "Not specified"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Emergency Contact */}
                        <div className="p-3 bg-card border border-border rounded-lg space-y-2">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">Emergency Contact Person</span>
                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Contact Name</span>
                              <span className="font-semibold text-foreground">{tenant.emergencyContact || tenant.userId?.emergencyContact || "Not specified"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Contact Phone</span>
                              <span className="font-medium text-foreground">{tenant.emergencyPhone || tenant.userId?.emergencyPhone || "Not specified"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Relationship</span>
                              <span className="font-medium text-foreground capitalize">{tenant.emergencyRelationship || tenant.userId?.emergencyRelationship || "Not specified"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Application Preferences */}
                        <div className="p-3 bg-card border border-border rounded-lg space-y-2">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">Application & Move-in Details</span>
                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Intended Move-in Date</span>
                              <span className="font-semibold text-foreground">{tenant.moveInDate || tenant.intendedMoveInDate || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Selected Room & Bed</span>
                              <span className="font-semibold text-foreground">{tenant.branch} - {tenant.room} ({tenant.bed})</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-0.5">Special Requests / Personal Notes</span>
                              <p className="p-2 bg-muted/40 rounded border border-border/50 text-foreground text-[11px]">
                                {tenant.notes || tenant.personalNotes || "No special requests or additional notes submitted in the application form."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Attached Application Documents & Media Card */}
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-foreground flex items-center justify-between uppercase tracking-wide">
                        <span className="flex items-center gap-1.5">
                          <FileCheck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          Attached Verification Documents & Media ({attachedDocs.length})
                        </span>
                        {attachedDocs.length > 0 ? (
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                            Documents Uploaded
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground bg-card px-2 py-0.5 rounded border border-border/50">
                            No Files Attached
                          </span>
                        )}
                      </h4>

                      {attachedDocs.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1 text-xs">
                          {attachedDocs.map((doc) => (
                            <div key={doc.id} className="p-3 bg-card border border-border rounded-lg space-y-2.5 flex flex-col justify-between shadow-sm hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className="font-semibold text-foreground truncate">{doc.label}</span>
                                  <span className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
                                    {doc.type}
                                  </span>
                                </div>
                                {doc.url && (doc.url.match(/\.(jpeg|jpg|png|gif|webp)($|\?)/i) || doc.category === "photo" || doc.category === "identity") ? (
                                  <div
                                    className="w-full h-28 bg-muted/40 rounded border border-border/50 overflow-hidden relative group cursor-pointer"
                                    onClick={() => setPreviewDoc(doc)}
                                  >
                                    <img src={doc.url} alt={doc.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-xs gap-1.5">
                                      <Eye className="w-4 h-4" /> Click to View
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-full h-20 bg-muted/40 rounded border border-border/50 flex flex-col items-center justify-center text-muted-foreground gap-1">
                                    <FileText className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                                    <span className="text-[11px] font-medium">Document File</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc(doc)}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-muted hover:bg-muted/80 text-foreground text-[11px] font-semibold transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                  View File
                                </button>
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center p-1.5 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title="Open file in new tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 bg-card border border-border rounded-lg text-center space-y-1">
                          <p className="text-xs font-medium text-foreground">No verification documents attached to this application.</p>
                          <p className="text-[11px] text-muted-foreground">The tenant did not upload custom ID photos or clearance files during registration.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

            </div>

          </div>

          {/* FOOTER */}
          <div className="px-6 py-3 border-t border-border bg-card flex items-center justify-between rounded-b-xl flex-shrink-0">
            <div className="text-xs text-muted-foreground">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 mr-1">Tenant ID:</span>
              <span className="font-mono text-foreground text-[11px] font-semibold tracking-wide">{tenantDisplayCode}</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-xs font-semibold text-foreground"
            >
              Close
            </button>
          </div>

        </div>
      </div>

  {dialogState.type === "renew" ? (
    <RenewLeaseModal
      open
      tenant={tenant}
      detail={fetchedDetail || initialTenant}
      context={actionContext}
      loading={dialogState.loading}
      onClose={closeDialog}
      onOfferSubmit={async (offerPayload) => {
        setDialogState((s) => ({ ...s, loading: true, error: null }));
        try {
          const res = await reservationApi.createRenewalOffer(reservationId, offerPayload);
          await invalidateTenantQueries();
          showNotification(res?.message || "Renewal offer sent to tenant!", "success");
          closeDialog();
          onClose();
        } catch (err) {
          setDialogState((s) => ({
            ...s,
            loading: false,
            error: err.message || "Failed to create renewal offer",
          }));
          showNotification(err.message || "Failed to create renewal offer", "error");
        }
      }}
      onSubmit={async (payload) => {
        setDialogState((s) => ({ ...s, loading: true, error: null }));
        try {
          const res = await reservationApi.renew(reservationId, {
            newLeaseStartDate: payload.newLeaseStartDate,
            newLeaseEndDate: payload.newLeaseEndDate,
            monthlyRent: payload.monthlyRent ?? tenant?.monthlyRate ?? 0,
            notes: payload.notes,
            confirm: true,
          });
          await invalidateTenantQueries();
          showNotification(res?.message || "Lease renewed successfully!", "success");
          closeDialog();
          onClose();
        } catch (err) {
          setDialogState((s) => ({
            ...s,
            loading: false,
            error: err.message || "Failed to renew contract",
          }));
          showNotification(err.message || "Failed to renew contract", "error");
        }
      }}
    />
  ) : null}

  {dialogState.type === "transfer" ? (
    <TransferTenantModal
      open
      tenant={tenant}
      detail={fetchedDetail || initialTenant}
      loading={dialogState.loading}
      sourceRoomLatestReading={actionContext?.sourceRoomLatestReading ?? null}
      onClose={closeDialog}
      onSubmit={async (payload) => {
        setDialogState((s) => ({ ...s, loading: true, error: null }));
        try {
          const res = await reservationApi.transfer(reservationId, {
            targetRoomId: payload.roomId,
            targetBedId: payload.bedId,
            effectiveTransferDate: payload.effectiveTransferDate || new Date().toISOString().slice(0, 10),
            reason: payload.reason,
            sourceRoomMeterReading: payload.sourceRoomMeterReading,
            targetRoomMeterReading: payload.targetRoomMeterReading,
            forceOverride: payload.forceOverride || false,
            confirm: true,
          });
          await invalidateTenantQueries();
          showNotification(res?.message || "Tenant transferred successfully!", "success");
          closeDialog();
          onClose();
        } catch (err) {
          const isOutstandingBlock = err?.code === "OUTSTANDING_BILLS_BLOCKING_TRANSFER"
            || err?.message?.includes("outstanding balance");
          const errorMsg = isOutstandingBlock
            ? `Transfer blocked: ₱${Number(err.outstandingBalance || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })} outstanding balance. Acknowledge in the form to force-proceed.`
            : err.message || "Failed to transfer tenant";
          setDialogState((s) => ({
            ...s,
            loading: false,
            error: errorMsg,
          }));
          showNotification(errorMsg, "error");
        }
      }}
    />
  ) : null}

  {dialogState.type === "moveOut" ? (
    <MoveOutModal
      open
      tenant={tenant}
      detail={fetchedDetail || initialTenant}
      loading={dialogState.loading}
      onClose={closeDialog}
      onSubmit={async (payload) => {
        setDialogState((s) => ({ ...s, loading: true, error: null }));
        try {
          const res = await reservationApi.moveOut(reservationId, {
            moveOutDate: payload.moveOutDate,
            actualVacateDate: payload.moveOutDate,
            reason: payload.reason || "move_out",
            finalNotes: payload.notes || "",
            damages: payload.damageDeductions || 0,
            deductions: (payload.damageDeductions || 0) + (payload.keyReturned ? 0 : 500),
            outstandingBalanceSnapshot: tenant?.balance || 0,
            finalUtilityReading: payload.meterReading,
            confirm: true,
          });
          await invalidateTenantQueries();
          showNotification(res?.message || "Tenant moved out successfully!", "success");
          closeDialog();
          onClose();
        } catch (err) {
          setDialogState((s) => ({
            ...s,
            loading: false,
            error: err.message || "Failed to move out tenant",
          }));
          showNotification(err.message || "Failed to move out tenant", "error");
        }
      }}
    />
  ) : null}

  <ConfirmModal
    isOpen={dialogState.type === "deleteTenant"}
    onClose={closeDialog}
    onConfirm={async () => {
      const userId =
        tenant?.tenantId?._id ||
        tenant?.tenantId ||
        tenant?.userId?._id ||
        tenant?.userId;
      if (!userId) {
        showNotification("Cannot resolve tenant user ID.", "error");
        return;
      }
      setDialogState((s) => ({ ...s, loading: true }));
      try {
        await userApi.delete(userId, { hardDelete: true });
        await invalidateTenantQueries();
        showNotification("Tenant record deleted successfully.", "success");
        closeDialog();
        onClose();
      } catch (err) {
        setDialogState((s) => ({ ...s, loading: false }));
        // If blocked because force is needed, surface the force delete modal instead
        if (err?.code === "HARD_DELETE_BLOCKED" && err?.requiresForceDelete) {
          closeDialog();
          setSafeguardsData(err?.safeguards ?? null);
          setDialogState({ type: "forceDelete", loading: false, error: null });
          showNotification("This account requires Force Delete (owner only). See Force Delete modal.", "warning");
        } else {
          showNotification(err.message || "Failed to delete tenant record.", "error");
        }
      }
    }}
    title="Delete Tenant Record"
    message={`Permanently delete ${tenant?.name || "this tenant"}? This cannot be undone. All associated reservation and billing data will be purged.`}
    confirmText="Delete Permanently"
    cancelText="Cancel"
    variant="danger"
    loading={dialogState.loading}
  />

  {/* Force Delete Modal — owner-only, 3-step typed confirmation */}
  <ForceDeleteModal
    open={dialogState.type === "forceDelete"}
    tenant={tenant}
    safeguards={safeguardsData ?? tenant?.safeguards ?? {}}
    loading={dialogState.loading}
    onClose={closeDialog}
    onConfirm={async () => {
      const userId =
        tenant?.tenantId?._id ||
        tenant?.tenantId ||
        tenant?.userId?._id ||
        tenant?.userId;
      if (!userId) {
        showNotification("Cannot resolve tenant user ID.", "error");
        return;
      }
      setDialogState((s) => ({ ...s, loading: true }));
      try {
        const result = await userApi.delete(userId, {
          hardDelete: true,
          force: true,
          confirmationText: "DELETE",
        });
        await invalidateTenantQueries();
        const archived = result?.cleanup?.archivedReservations ?? 0;
        showNotification(
          `Account permanently deleted. ${archived} reservation(s) archived, beds released.`,
          "success",
        );
        closeDialog();
        onClose();
      } catch (err) {
        setDialogState((s) => ({ ...s, loading: false }));
        showNotification(err.message || "Force delete failed. Please try again.", "error");
      }
    }}
  />

  {/* Inline Document Preview Lightbox Modal */}
  {previewDoc && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setPreviewDoc(null)}>
      <div className="bg-card border border-border rounded-xl shadow-2xl max-w-3xl w-full p-4 space-y-3 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h4 className="font-bold text-sm text-foreground">{previewDoc.label}</h4>
            <span className="text-xs text-muted-foreground">{previewDoc.type}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={previewDoc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg border border-border hover:bg-muted text-xs text-foreground flex items-center gap-1 font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open Full
            </a>
            <button onClick={() => setPreviewDoc(null)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="max-h-[70vh] flex items-center justify-center overflow-auto bg-black/10 rounded-lg p-2">
          {previewDoc.url && (previewDoc.url.match(/\.(jpeg|jpg|png|gif|webp)($|\?)/i) || previewDoc.category === "photo" || previewDoc.category === "identity") ? (
            <img src={previewDoc.url} alt={previewDoc.label} className="max-h-[65vh] w-auto object-contain rounded shadow-sm" />
          ) : (
            <div className="p-8 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" />
              <p className="text-xs font-semibold text-foreground">Document File Preview</p>
              <a
                href={previewDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Open / Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )}

  {showDigitalContractModal && (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={() => setShowDigitalContractModal(false)}
    >
      <div
        className="bg-card border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl space-y-4 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-bold text-foreground">Official Digital Lease Contract</h3>
          </div>
          <div className="flex items-center gap-2">
            {(activeDigitalContract?.id || activeDigitalContract?._id || dedicatedContract?.id || dedicatedContract?._id) && (
              <button
                type="button"
                onClick={() => {
                  const targetContractId = activeDigitalContract?.id || activeDigitalContract?._id || dedicatedContract?.id || dedicatedContract?._id;
                  setShowDigitalContractModal(false);
                  onClose();
                  navigate(`/admin/contracts/${targetContractId}`);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors cursor-pointer"
                title="Open contract details in Contracts management"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Contracts</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDigitalContractModal(false)}
              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close contract modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loadingDigitalContract ? (
          <div className="py-16 text-center text-muted-foreground text-xs animate-pulse">
            Loading contract data and legal clauses…
          </div>
        ) : digitalContractError && !digitalContractData ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-xs text-red-600 dark:text-red-400 max-w-sm mx-auto">{digitalContractError}</p>
            <button
              type="button"
              onClick={() => handleOpenDigitalContract(activeDigitalContract || dedicatedContract)}
              className="text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : (
          <DigitalContractPaper
            stayData={digitalContractData}
            contract={activeDigitalContract || dedicatedContract}
            onDownloadPdf={() => handleDownloadStayProof(activeDigitalContract || dedicatedContract)}
            isDownloading={downloadingProof}
          />
        )}
      </div>
    </div>
  )}

  {recordViolationOpen && (
    <RecordViolationModal
      isOpen={recordViolationOpen}
      onClose={() => setRecordViolationOpen(false)}
      onSuccess={() => {
        fetchTenantViolations();
        queryClient.invalidateQueries(["tenantWorkspaceDetail", reservationId]);
      }}
      branch={tenant?.branch}
      preselectedTenant={tenant}
    />
  )}

  {selectedViolationForDetail && (
    <ViolationDetailModal
      isOpen={!!selectedViolationForDetail}
      onClose={() => setSelectedViolationForDetail(null)}
      violation={selectedViolationForDetail}
      onUpdate={() => {
        fetchTenantViolations();
        setSelectedViolationForDetail(null);
        queryClient.invalidateQueries(["tenantWorkspaceDetail", reservationId]);
      }}
    />
  )}
</div>
 );
}
