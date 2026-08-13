import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { showNotification } from "../../../shared/utils/notification";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import DeadlineBadge from "../../../shared/components/DeadlineBadge";
import { formatBedPosition, formatCodedRoomAndBed } from "../../../shared/utils/bedIdentifier";
import {
  useTenantWorkspaceDetail,
  useTenantActionContext,
} from "../../../shared/hooks/queries/useReservations";
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

const WARNING_DETAILS_MAP = {
  room_history_incomplete: {
    title: "Incomplete Room History",
    details: "We don't have a complete record of room or bed transfers for this tenant's stay.",
    impact: "Utility bill calculations will automatically use the current room assignment.",
    recommendation: "Check the tenant's room history or log any room changes if they moved rooms.",
  },
  Room_history_incomplete: {
    title: "Incomplete Room History",
    details: "We don't have a complete record of room or bed transfers for this tenant's stay.",
    impact: "Utility bill calculations will automatically use the current room assignment.",
    recommendation: "Check the tenant's room history or log any room changes if they moved rooms.",
  },
  lease_expired: {
    title: "Lease Contract Expired",
    details: "This tenant's rental agreement end date has already passed.",
    impact: "The tenant is still checked in, but their contract status is marked as expired.",
    recommendation: "Renew the lease agreement or prepare to process the tenant's move-out.",
  },
  lease_expiring_soon: {
    title: "Lease Ending Soon",
    details: "This tenant's rental contract will end within the next 30 days.",
    impact: "The tenant may need to decide whether to extend their stay or prepare to move out.",
    recommendation: "Send a lease renewal notice or schedule a move-out check.",
  },
  overdue_balance: {
    title: "Overdue Payment",
    details: "One or more bills have passed their due date without payment.",
    impact: "A daily late payment penalty rate (₱50/day) is accrued on overdue balances until paid in full. Account flagged as overdue.",
    recommendation: "Review payment history, send a payment reminder, or record a received payment.",
  },
  outstanding_balance: {
    title: "Unpaid Balance",
    details: "This tenant has an unpaid balance on their current bill.",
    impact: "The remaining balance needs to be settled before the billing cycle closes.",
    recommendation: "Check payment records or remind the tenant to complete their payment.",
  },
  pending_payment_verification: {
    title: "Payment Receipt Under Review",
    details: "The tenant has submitted an offline payment receipt that is waiting for your approval.",
    impact: "The account balance will update as soon as you verify the payment proof.",
    recommendation: "Go to Billing & Payments to review and verify the submitted receipt.",
  },
  billing_impact_warning: {
    title: "Move-Out Billing Notice",
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

const formatMoney = (amount) => {
  if (!amount && amount !== 0) return "N/A";
  return `₱${Number(amount).toLocaleString()}`;
};

const getInitials = (name) => {
  if (!name) return "--";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
};

const getContractStatusConfig = (status) => {
  switch (status) {
    case "active":
      return {
        color: "text-success dark:text-success-dark",
        dot: "bg-success dark:bg-success-dark",
        label: "Active",
      };
    case "ending-soon":
      return {
        color: "text-warning dark:text-warning-dark",
        dot: "bg-warning dark:bg-warning-dark",
        label: "Ending Soon",
      };
    case "expired":
      return {
        color: "text-error dark:text-error-dark",
        dot: "bg-error dark:bg-error-dark",
        label: "Expired",
      };
    default:
      return {
        color: "text-neutral dark:text-neutral-dark",
        dot: "bg-neutral dark:bg-neutral-dark",
        label: status || "Unknown",
      };
  }
};

const getPaymentStatusConfig = (status) => {
  switch (status) {
    case "paid":
      return {
        color: "text-success dark:text-success-dark",
        dot: "bg-success dark:bg-success-dark",
        label: "Paid",
      };
    case "partial":
      return {
        color: "text-warning dark:text-warning-dark",
        dot: "bg-warning dark:bg-warning-dark",
        label: "Partial",
      };
    case "overdue":
      return {
        color: "text-error dark:text-error-dark",
        dot: "bg-error dark:bg-error-dark",
        label: "Overdue",
      };
    default:
      return {
        color: "text-neutral dark:text-neutral-dark",
        dot: "bg-neutral dark:bg-neutral-dark",
        label: status || "Unknown",
      };
  }
};

const getOccupancyStatusConfig = (status) => {
  switch (status) {
    case "active":
      return {
        color: "text-success dark:text-success-dark",
        dot: "bg-success dark:bg-success-dark",
        label: "Active",
      };
    case "inactive":
      return {
        color: "text-neutral dark:text-neutral-dark",
        dot: "bg-neutral dark:bg-neutral-dark",
        label: "Inactive",
      };
    default:
      return {
        color: "text-neutral dark:text-neutral-dark",
        dot: "bg-neutral dark:bg-neutral-dark",
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
        color: "text-success dark:text-success-dark",
        bg: "bg-success-light dark:bg-success-light",
        label: "Completed",
      };
    case "pending":
      return {
        color: "text-warning dark:text-warning-dark",
        bg: "bg-warning-light dark:bg-warning-light",
        label: "Pending",
      };
    case "failed":
      return {
        color: "text-error dark:text-error-dark",
        bg: "bg-error-light dark:bg-error-light",
        label: "Failed",
      };
    default:
      return {
        color: "text-neutral dark:text-neutral-dark",
        bg: "bg-neutral-light dark:bg-neutral-light",
        label: record.status || "Unknown",
      };
  }
};

const getWarningSeverityConfig = (severity) => {
  switch (severity) {
    case "high":
      return {
        color: "text-error dark:text-error-dark",
        bg: "bg-error-light dark:bg-error-light",
        border: "border-error dark:border-error",
      };
    case "medium":
      return {
        color: "text-warning dark:text-warning-dark",
        bg: "bg-warning-light dark:bg-warning-light",
        border: "border-warning dark:border-warning",
      };
    case "low":
      return {
        color: "text-info dark:text-info-dark",
        bg: "bg-info-light dark:bg-info-light",
        border: "border-info dark:border-info",
      };
    default:
      return {
        color: "text-neutral dark:text-neutral-dark",
        bg: "bg-neutral-light dark:bg-neutral-light",
        border: "border-neutral dark:border-neutral",
      };
  }
};

function WarningCard({ warning, isExpanded, toggleWarningDetails, tenant }) {
  const warningConfig = getWarningSeverityConfig(warning.severity);
  const meta = WARNING_DETAILS_MAP[warning.type] || {};
  const warningDetails = warning.details || meta.details || "No additional system details available for this warning flag.";
  const warningImpact = warning.impact || meta.impact || "Standard system behavior applies.";
  const warningRecommendation = warning.recommendation || meta.recommendation || "Review tenant status and records.";
  const hasValidDate = warning.date && warning.date !== "-" && warning.date !== "N/A";
  const isOverdueType = warning.type === "overdue_balance" || warning.code === "overdue_balance" || warning.type === "overdue_payment";

  return (
    <div className={`p-2.5 border-l-2 ${warningConfig.border} ${warningConfig.bg} rounded text-xs transition-all`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-semibold capitalize ${warningConfig.color} truncate`}>
            {meta.title || warning.type}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasValidDate && (
            <span className="text-[11px] text-muted-foreground">{warning.date}</span>
          )}
          <button
            type="button"
            onClick={() => toggleWarningDetails(warning.id)}
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors bg-card/60 hover:bg-card px-2 py-0.5 rounded border border-border/50"
            title={isExpanded ? "Hide details" : "View details"}
          >
            <span>{isExpanded ? "Hide Details" : "View Details"}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <div className="text-foreground">{warning.message}</div>
      {isOverdueType && (
        <div className="mt-2">
          <DeadlineBadge
            dueDate={warning.dueDate || warning.date || tenant.dueDate || tenant.lastDueDate}
            status="overdue"
            type="bill"
            showConsequenceNote={false}
            penaltyRate={50}
          />
        </div>
      )}

      {isExpanded && (
        <div className="mt-2.5 pt-2.5 border-t border-border/40 space-y-2 bg-card/40 p-2.5 rounded text-[11px]">
          <div>
            <span className="font-semibold text-foreground flex items-center gap-1 mb-0.5">
              <Info className="w-3 h-3 text-info" /> Explanation
            </span>
            <p className="text-muted-foreground leading-relaxed">{warningDetails}</p>
          </div>
          <div>
            <span className="font-semibold text-foreground flex items-center gap-1 mb-0.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" /> System Impact
            </span>
            <p className="text-muted-foreground leading-relaxed">{warningImpact}</p>
          </div>
          <div>
            <span className="font-semibold text-foreground flex items-center gap-1 mb-0.5">
              <CheckCircle className="w-3.5 h-3.5 text-success" /> Recommended Action
            </span>
            <p className="text-muted-foreground leading-relaxed">{warningRecommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TenantDetailModal({ tenant, onClose }) {
  useEscapeClose(!!tenant, onClose);

  const queryClient = useQueryClient();
const navigate = useNavigate();
  const [dialogState, setDialogState] = useState({ type: null, loading: false, error: null });
  const [safeguardsData, setSafeguardsData] = useState(null);
  const [dedicatedContract, setDedicatedContract] = useState(null);
  const [contractLookupDone, setContractLookupDone] = useState(false);
  const [expandedWarnings, setExpandedWarnings] = useState({});
  const [activeTab, setActiveTab] = useState("overview");
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isHistoryFolded, setIsHistoryFolded] = useState(false);
  const [isDocsPanelOpen, setIsDocsPanelOpen] = useState(true);
  const [downloadingProof, setDownloadingProof] = useState(false);
  const [showDigitalContractModal, setShowDigitalContractModal] = useState(false);
  const [digitalContractData, setDigitalContractData] = useState(null);
  const [loadingDigitalContract, setLoadingDigitalContract] = useState(false);

  const handleDownloadStayProof = async () => {
    setDownloadingProof(true);
    try {
      const targetId = dedicatedContract?._id || dedicatedContract?.contractNumber || tenant?.reservationId || tenant?.reservationCode || tenant?._id || tenant?.id;
      const blob = await contractApi.getStayProofFile(targetId, true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Lilycrest-Lease-Contract-${dedicatedContract?.contractNumber || tenant?.reservationCode || "Tenant"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showNotification("Failed to generate Lease Contract PDF", "error");
    } finally {
      setDownloadingProof(false);
    }
  };

  const handleOpenDigitalContract = async () => {
    setLoadingDigitalContract(true);
    setShowDigitalContractModal(true);
    try {
      const targetId = dedicatedContract?._id || dedicatedContract?.contractNumber || tenant?.reservationId || tenant?.reservationCode || tenant?._id || tenant?.id;
      const res = await contractApi.getStayProofData(targetId);
      if (res?.stayProof) {
        setDigitalContractData(res.stayProof);
      }
    } catch {
      // fallback to tenant local fields if error
    } finally {
      setLoadingDigitalContract(false);
    }
  };

  const toggleWarningDetails = (id) => {
    setExpandedWarnings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const reservationId = tenant?.reservationId || tenant?._id || tenant?.id;

  const { data: fetchedDetail } = useTenantWorkspaceDetail(reservationId);
  const { data: actionContext } = useTenantActionContext(reservationId);

  // Derive a stable Tenant ID from the user's _id (not the reservation).
  // tenantId stays consistent across renewals, transfers, and stays.
  const tenantDisplayCode = useMemo(() => {
    const rawTenantId =
      fetchedDetail?.tenantId ||
      tenant?.tenantId?._id ||
      tenant?.tenantId ||
      tenant?.userId?._id ||
      tenant?.userId ||
      "";
    const raw = String(rawTenantId);
    if (!raw) return "N/A";
    // TEN- prefix + last 8 hex chars of the MongoDB ObjectId, uppercased
    return `TEN-${raw.slice(-8).toUpperCase()}`;
  }, [fetchedDetail, tenant]);

  const attachedDocs = useMemo(() => {
    // Prefer fetchedDetail (which now carries the URL fields from the backend)
    // Fall back to the tenant list-row prop
    const source = fetchedDetail || tenant || {};
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
  }, [fetchedDetail, tenant]);

  useEffect(() => {
    if (!tenant) return;
    let active = true;
    setContractLookupDone(false);
    contractApi.listContracts({ limit: 100 })
      .then(({ contracts = [] }) => {
        if (!active) return;
        const tenantId = tenant.tenantId?._id || tenant.tenantId || tenant.userId?._id || tenant.userId;
        setDedicatedContract(contracts.find((item) =>
          String(item.reservationId) === String(reservationId) ||
          (tenantId && String(item.tenantId) === String(tenantId)),
        ) || null);
      })
      .catch(() => { if (active) setDedicatedContract(null); })
      .finally(() => { if (active) setContractLookupDone(true); });
    return () => { active = false; };
  }, [tenant, reservationId]);

  const normalizedTenant = useMemo(() => {
    if (!tenant) return null;
    return {
      ...tenant,
      tenantName: tenant.name || tenant.tenantName || "Tenant",
      monthlyRent: tenant.monthlyRate ?? tenant.monthlyRent ?? 0,
      leaseEndDate: tenant.contractEnd || tenant.moveOut || tenant.leaseEndDate,
      currentBalance: tenant.balance ?? tenant.currentBalance ?? 0,
      roomId: tenant.roomId?._id || tenant.roomId || tenant.roomObjId,
      branch: tenant.branch,
      room: tenant.room,
      bed: tenant.bed,
      reservationId: reservationId,
    };
  }, [tenant, reservationId]);

  const normalizedDetail = useMemo(() => {
    if (fetchedDetail) return fetchedDetail;
    if (!tenant) return null;
    return {
      basicInfo: {
        tenantName: tenant.name || tenant.tenantName,
        branch: tenant.branch,
        roomName: tenant.room,
        bedPosition: tenant.bed,
        monthlyRent: tenant.monthlyRate ?? tenant.monthlyRent ?? 0,
      },
      leaseInfo: {
        leaseEndDate: tenant.contractEnd || tenant.moveOut || tenant.leaseEndDate,
        extensionHistory: tenant.extensionHistory || [],
      },
      paymentInfo: {
        currentBalance: tenant.balance ?? tenant.currentBalance ?? 0,
      },
    };
  }, [fetchedDetail, tenant]);

  const closeDialog = () => {
    setDialogState({ type: null, loading: false, error: null });
  };

  const invalidateTenantQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reservations"] }),
      queryClient.invalidateQueries({ queryKey: ["rooms"] }),
    ]);

  const roomHistory = tenant?.roomHistory || [];

  if (!tenant) return null;

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

  const overdueWarningItem = warnings.find((w) => w.type === "overdue_balance" || w.code === "overdue_balance");
  const calculatedDueDate = tenant.dueDate || tenant.lastDueDate || tenant.overdueDueDate || overdueWarningItem?.dueDate || overdueWarningItem?.date || null;

  return (
    <div>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* HEADER */}
          <div className="px-6 py-4 border-b border-border bg-card flex-shrink-0 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-primary-foreground font-bold text-base bg-primary flex-shrink-0 shadow-sm">
                {tenant.initials || getInitials(tenant.name)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base text-foreground truncate">{tenant.name}</h3>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${occupancyConfig.color} bg-muted/60`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${occupancyConfig.dot}`} />
                    {occupancyConfig.label}
                  </span>
                  {paymentStatus === "overdue" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-error bg-error-light">
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
          <div className="p-6 flex-1 overflow-y-auto bg-card grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT SIDEBAR (lg:col-span-4) - Fixed Context */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Financial Standing Hero Card */}
              <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Financial Standing</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Current Balance</span>
                  <span className={"text-xl font-bold " + ((tenant.balance || 0) > 0 ? "text-error dark:text-error-dark" : "text-success dark:text-success-dark")}>
                    {formatMoney(tenant.balance || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-border/40">
                  <span className="text-muted-foreground">Monthly Rate</span>
                  <span className="font-semibold text-foreground">{formatMoney(tenant.monthlyRate)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Payment Status</span>
                  <div className={`flex items-center gap-1 font-medium ${paymentConfig.color}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${paymentConfig.dot}`} />
                    <span>{paymentConfig.label}</span>
                  </div>
                </div>
                {(calculatedDueDate || paymentStatus === "overdue") && (
                  <div className="pt-2 border-t border-border/40">
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
                  <Users className="w-3.5 h-3.5 text-primary" />
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
                      onClick={() => setActiveTab("overview")}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-xs font-medium transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-primary" />
                        Application & Docs
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                        {attachedDocs.length} Docs
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Operations Panel */}
              {tenant.reservationId && (
                <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    Quick Operations
                  </h4>
                  <div className="space-y-2">
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                      onClick={() => setDialogState({ type: "renew", loading: false, error: null })}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Extend Stay
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card text-foreground px-3 py-2 text-xs font-semibold hover:bg-muted transition-colors"
                      onClick={() => setDialogState({ type: "transfer", loading: false, error: null })}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                      Transfer Room
                    </button>

                    {/* Guarded Actions Dropdown Accordion */}
                    <div className="pt-2 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => setShowMoreActions(!showMoreActions)}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <span>Danger & Account Actions</span>
                        {showMoreActions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {showMoreActions && (
                        <div className="mt-2 space-y-1.5 pt-1">
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 rounded-md border border-error/30 bg-error-light/50 text-error-dark dark:text-error-dark px-3 py-1.5 text-xs font-medium hover:bg-error-light transition-colors"
                            onClick={() => setDialogState({ type: "moveOut", loading: false, error: null })}
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Move Out Tenant
                          </button>
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 rounded-md border border-error/40 bg-error-light text-error-dark dark:text-error-dark px-3 py-1.5 text-xs font-medium hover:bg-error/10 transition-colors"
                            onClick={() => setDialogState({ type: "deleteTenant", loading: false, error: null })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Tenant Record
                          </button>
                          {tenant.isOwnerViewing && (
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 rounded-md bg-error text-white px-3 py-1.5 text-xs font-semibold hover:bg-error/90 transition-colors"
                              onClick={() => {
                                setSafeguardsData(null);
                                setDialogState({ type: "forceDelete", loading: false, error: null });
                              }}
                            >
                              <Skull className="w-3.5 h-3.5" />
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
                  onClick={() => setActiveTab("overview")}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
                    activeTab === "overview"
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Overview & Contract
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("financials")}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
                    activeTab === "financials"
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Financials & Billing
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
                    activeTab === "history"
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Room & History
                  {roomHistory.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-muted text-muted-foreground font-semibold inline-block">
                      {roomHistory.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("warnings")}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex-shrink-0 ${
                    activeTab === "warnings"
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  System Warnings
                  {warnings.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-warning-light text-warning-dark font-bold inline-block">
                      {warnings.length}
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
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          Digital Stay Record &amp; Proof
                        </span>
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs text-success font-bold bg-success-light">
                          <div className="w-1.5 h-1.5 rounded-full bg-success" />
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
                          <ClipboardList className="w-3.5 h-3.5 text-primary" />
                          Submitted Tenant Application Form
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground bg-card px-2 py-0.5 rounded border border-border/50">
                          {fetchedDetail?.reservationCode || tenant.reservationCode || tenant.reservationId || "RES-APP"}
                        </span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        {/* Demographics */}
                        <div className="p-3 bg-card border border-border rounded-xl space-y-2.5 shadow-sm">
                          <span className="text-[11px] font-bold text-primary block uppercase tracking-wider border-b border-border/40 pb-1.5">
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
                          <span className="text-[11px] font-bold text-primary block uppercase tracking-wider border-b border-border/40 pb-1.5">
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
                          <span className="text-[11px] font-bold text-primary block uppercase tracking-wider border-b border-border/40 pb-1.5">
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
                          <span className="text-[11px] font-bold text-primary block uppercase tracking-wider border-b border-border/40 pb-1.5">
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
                    <div className="bg-muted/30 border border-border/60 rounded-xl overflow-hidden">
                      {/* Collapsible Header */}
                      <button
                        type="button"
                        onClick={() => setIsDocsPanelOpen((v) => !v)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wide">
                          <FileCheck className="w-3.5 h-3.5 text-primary" />
                          Attached Verification Documents &amp; Media ({attachedDocs.length})
                        </span>
                        <span className="flex items-center gap-2">
                          {attachedDocs.length > 0 ? (
                            <span className="text-[11px] font-semibold text-success bg-success-light px-2.5 py-0.5 rounded-full">
                              Documents Uploaded
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground bg-card px-2 py-0.5 rounded border border-border/50">
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
                                  className="bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
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
                                      <FileText className="w-6 h-6 text-primary" />
                                      <span className="text-[11px] font-medium">Document File</span>
                                    </div>
                                  )}
                                  {/* Label row */}
                                  <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-t border-border/40">
                                    <span className="font-semibold text-foreground text-[11px] truncate">{doc.label}</span>
                                    <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0">
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
                      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          <History className="w-3.5 h-3.5 text-primary" />
                          Lease Extension History ({extensionHistory.length})
                        </h4>
                        <div className="space-y-2">
                          {extensionHistory.map((extension) => (
                            <div key={extension.id} className="p-2.5 bg-card border border-border rounded-lg text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-foreground">{extension.duration}</span>
                                <span className="text-muted-foreground">{extension.date}</span>
                              </div>
                              <div className="text-muted-foreground">{extension.previousEnd} → {extension.newEnd}</div>
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
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        <DollarSign className="w-3.5 h-3.5 text-primary" />
                        Financial Ledger Summary
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 bg-card border border-border rounded-lg">
                          <span className="text-muted-foreground text-[11px] block">Monthly Rent Rate</span>
                          <span className="font-bold text-foreground text-sm">{formatMoney(tenant.monthlyRate)}</span>
                        </div>
                        <div className="p-2.5 bg-card border border-border rounded-lg">
                          <span className="text-muted-foreground text-[11px] block">Current Balance</span>
                          <span className={"font-bold text-sm " + ((tenant.balance || 0) > 0 ? "text-error dark:text-error-dark" : "text-success dark:text-success-dark")}>
                            {formatMoney(tenant.balance || 0)}
                          </span>
                        </div>
                        <div className="p-2 bg-card/60 border border-border/60 rounded">
                          <span className="text-muted-foreground text-[11px] block">Advance Rent Paid</span>
                          <span className="font-semibold text-foreground">{formatMoney(tenant.advanceRent)}</span>
                        </div>
                        <div className="p-2 bg-card/60 border border-border/60 rounded">
                          <span className="text-muted-foreground text-[11px] block">Security Deposit Held</span>
                          <span className="font-semibold text-foreground">{formatMoney(tenant.securityDeposit)}</span>
                        </div>
                        <div className="p-2 bg-card/60 border border-border/60 rounded col-span-2 flex justify-between items-center">
                          <span className="text-muted-foreground text-[11px]">Reservation Fee</span>
                          <span className="font-semibold text-foreground">{formatMoney(tenant.reservationFee)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment History */}
                    {paymentHistory.length > 0 && (
                      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          <DollarSign className="w-3.5 h-3.5 text-primary" />
                          Recent Payments ({paymentHistory.length})
                        </h4>
                        <div className="space-y-2">
                          {paymentHistory.map((payment) => {
                            const paymentStatusConfig = getPaymentStatusLabel(payment);
                            return (
                              <div key={payment.id} className="p-2.5 bg-card border border-border rounded-lg flex items-center justify-between text-xs">
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

                {/* TAB 3: ROOM & HISTORY */}
                {activeTab === "history" && (
                  <div className="space-y-4">
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        Current Room Assignment
                      </h4>
                      <div className="p-3 bg-card border border-border rounded-lg text-xs space-y-2">
                        <div className="flex justify-between font-semibold text-foreground">
                          <span>{tenant.branch} — {tenant.room}</span>
                          <span className="text-success font-medium">Current</span>
                        </div>
                        <div className="text-muted-foreground">
                          Bed: <span className="text-foreground capitalize font-medium">{tenant.bed || "N/A"}</span> • Move-in Date: {tenant.moveInDate || tenant.moveIn || "N/A"}
                        </div>
                        {dedicatedContract && (
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <FileText className="w-3.5 h-3.5 text-primary" />
                              <span>Current Lease Contract: <strong className="text-foreground">{dedicatedContract.contractNumber || "Pending"}</strong></span>
                            </div>
                            <button
                              type="button"
                              className="text-primary hover:underline font-semibold flex items-center gap-1 text-xs"
                              onClick={() => {
                                onClose();
                                navigate(`/admin/contracts/${dedicatedContract._id}`);
                              }}
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              View Contract Proof
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {roomHistory.length > 0 && (
                      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 transition-all duration-300">
                        <div
                          onClick={() => setIsHistoryFolded((prev) => !prev)}
                          className="flex items-center justify-between cursor-pointer select-none group"
                        >
                          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                            <History className="w-3.5 h-3.5 text-primary" />
                            Room Stay Timeline ({roomHistory.length})
                          </h4>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground group-hover:text-foreground flex items-center gap-1.5 transition-colors"
                          >
                            <span className="font-medium">{isHistoryFolded ? "Show" : "Hide"}</span>
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-300 ease-in-out ${
                                isHistoryFolded ? "rotate-0 text-muted-foreground" : "rotate-180 text-primary"
                              }`}
                            />
                          </button>
                        </div>

                        <div
                          className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${
                            isHistoryFolded
                              ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                              : "grid-rows-[1fr] opacity-100 mt-3"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="stay-timeline">
                              {roomHistory.map((room, idx) => {
                                const isCurrent = room.status === "current";
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
                                          {room.room || room.roomName || "Unknown Room"}
                                          {room.bed ? ` \u2014 ${room.bed}` : ""}
                                        </span>
                                        <span className={`stay-timeline__badge ${isCurrent ? "stay-timeline__badge--current" : "stay-timeline__badge--past"}`}>
                                          {isCurrent ? "Current" : "Past Stay"}
                                        </span>
                                      </div>
                                      <div className="stay-timeline__meta">
                                        {room.branch && <span>{room.branch}</span>}
                                        {(moveIn || moveOut) && (
                                          <span>
                                            {room.branch ? " \u00b7 " : ""}
                                            {moveIn ?? "?"}
                                            {moveOut ? ` \u2013 ${moveOut}` : isCurrent ? " \u2013 Active" : ""}
                                          </span>
                                        )}
                                      </div>

                                      {/* Contract Proof for this Stay */}
                                      {stayContract && (
                                        <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap text-xs bg-muted/20 p-2 rounded-lg">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                            <span className="text-muted-foreground truncate">
                                              Contract: <strong className="text-foreground">{stayContract.contractNumber}</strong>
                                            </span>
                                            {stayContract.purpose === "replacement" && (
                                              <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                                                Transfer Replacement
                                              </span>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            className="text-primary hover:underline font-semibold flex items-center gap-1 text-xs ml-auto flex-shrink-0"
                                            onClick={() => {
                                              onClose();
                                              navigate(`/admin/contracts/${stayContract.id || stayContract._id}`);
                                            }}
                                          >
                                            <FileCheck className="w-3.5 h-3.5" />
                                            View Contract Proof
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: SYSTEM WARNINGS */}
                {activeTab === "warnings" && (
                  <div className="space-y-4">
                    {warnings.length > 0 ? (
                      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                          Active System Warnings ({warnings.length})
                        </h4>
                        <div className="space-y-2">
                          {warnings.map((warning) => (
                            <WarningCard
                              key={warning.id}
                              warning={warning}
                              isExpanded={!!expandedWarnings[warning.id]}
                              toggleWarningDetails={toggleWarningDetails}
                              tenant={tenant}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-success-light/40 border border-success/30 rounded-xl p-6 text-center">
                        <CheckCircle className="w-10 h-10 text-success mx-auto mb-2" />
                        <p className="text-sm text-success-dark font-bold">No Active Warnings</p>
                        <p className="text-xs text-muted-foreground mt-1">All account metrics and contract safeguards are clear.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 5: SUBMITTED APPLICATION FORM DETAILS */}
                {activeTab === "application" && (
                  <div className="space-y-4">
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-foreground flex items-center justify-between uppercase tracking-wide">
                        <span className="flex items-center gap-1.5">
                          <ClipboardList className="w-3.5 h-3.5 text-primary" />
                          Submitted Tenant Application Form
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground bg-card px-2 py-0.5 rounded border border-border/50">
                          {tenant.reservationCode || tenant.reservationId || "RES-APP"}
                        </span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        {/* Demographics */}
                        <div className="p-3 bg-card border border-border rounded-lg space-y-2">
                          <span className="text-[11px] font-semibold text-primary block uppercase tracking-wider">Personal Demographics</span>
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
                          <span className="text-[11px] font-semibold text-primary block uppercase tracking-wider">Permanent Residential Address</span>
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
                          <span className="text-[11px] font-semibold text-primary block uppercase tracking-wider">Emergency Contact Person</span>
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
                          <span className="text-[11px] font-semibold text-primary block uppercase tracking-wider">Application & Move-in Details</span>
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
                          <FileCheck className="w-3.5 h-3.5 text-primary" />
                          Attached Verification Documents & Media ({attachedDocs.length})
                        </span>
                        {attachedDocs.length > 0 ? (
                          <span className="text-[11px] font-semibold text-success bg-success-light px-2.5 py-0.5 rounded-full">
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
                            <div key={doc.id} className="p-3 bg-card border border-border rounded-lg space-y-2.5 flex flex-col justify-between shadow-sm hover:border-primary/50 transition-colors">
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className="font-semibold text-foreground truncate">{doc.label}</span>
                                  <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
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
                                    <FileText className="w-6 h-6 text-primary" />
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
                                  <Eye className="w-3.5 h-3.5 text-primary" />
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
                        <div className="p-4 bg-card border border-border rounded-lg text-center space-y-1">
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
      tenant={normalizedTenant}
      detail={normalizedDetail}
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
            monthlyRent: payload.monthlyRent ?? normalizedTenant?.monthlyRent ?? 0,
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
      tenant={normalizedTenant}
      detail={normalizedDetail}
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
      tenant={normalizedTenant}
      detail={normalizedDetail}
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
            outstandingBalanceSnapshot: normalizedTenant?.currentBalance || 0,
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
              <FileText className="w-12 h-12 text-primary mx-auto" />
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
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Official First JRAC Lease Contract</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowDigitalContractModal(false)}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadingDigitalContract && !digitalContractData ? (
          <div className="py-16 text-center text-muted-foreground text-xs animate-pulse">
            Loading contract data and legal clauses…
          </div>
        ) : (
          <DigitalContractPaper
            stayData={digitalContractData || {
              tenantName: tenant?.fullName || tenant?.name,
              roomNumber: tenant?.roomNumber || tenant?.roomName,
              bedLabel: tenant?.bedNumber || tenant?.bedLabel,
              roomType: tenant?.roomType,
              branchName: tenant?.branchName || tenant?.branch,
              leaseStartDate: tenant?.startDate || tenant?.leaseStart,
              leaseEndDate: tenant?.endDate || tenant?.leaseEnd,
              monthlyRent: tenant?.monthlyRent || tenant?.rentAmount,
              securityDeposit: tenant?.securityDeposit,
              referenceNumber: dedicatedContract?.contractNumber || tenant?.reservationCode || "LIL-CONTRACT",
            }}
            contract={dedicatedContract}
            onDownloadPdf={handleDownloadStayProof}
            isDownloading={downloadingProof}
          />
        )}
      </div>
    </div>
  )}
</div>
 );
}
