import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  Plus,
  Check,
  Search,
  Clock3,
  History,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Pencil,
  Save,
  Download,
  Send,
  Calendar,
  FileX,
  ClipboardX,
  LoaderCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Info,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { useAuth } from "../../../../shared/hooks/useAuth";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import NewBillingPeriodModal from "./NewBillingPeriodModal";
import {
  useUtilityRooms,
  useUtilityReadings,
  useUtilityLatestReading,
  useUtilityPeriods,
  useUtilityResult,
  useUpdateUtilityPeriod,
  useSendUtilityPeriod,
  useDeleteUtilityReading,
  useUpdateUtilityReading,
  useDeleteUtilityPeriod,
  useRoomHistory,
  utilityKeys,
} from "../../../../shared/hooks/queries/useUtility";
import {
  useAdminPayments,
  useBillsByBranch,
} from "../../../../shared/hooks/queries/useBilling";
import { utilityApi } from "../../../../shared/api/utilityApi.js";
import { billingApi } from "../../../../shared/api/billingApi.js";
import { useBusinessSettings } from "../../../../shared/hooks/queries/useSettings";
import { exportToCSV } from "../../../../shared/utils/exportUtils.js";
import {
  isUtilityEventType,
  normalizeUtilityEventType,
  readMoveInDate,
  readMoveOutDate,
} from "../../../../shared/utils/lifecycleNaming";
import { getRoomLabel } from "../../../../shared/utils/roomLabel.js";
import { fmtDate } from "../../utils/formatters";
import { ExportButtons } from "../../pages/analyticsTabShared";
import useBillingNotifier from "./shared/useBillingNotifier";
import "./shared/BillingDelta.css";
import BillingCycleDetailModal from "./BillingCycleDetailModal";
import {
  buildPaymentLedgerByBillId as buildSharedPaymentLedgerByBillId,
  formatAdminPaymentMode,
  getNormalizedBillSnapshot as getSharedNormalizedBillSnapshot,
  getNormalizedPaidState as getSharedNormalizedPaidState,
  resolvePaymentDetails as resolveSharedPaymentDetails,
} from "./paymentDisplay";

const EMPTY_VALUE = "-";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = String(name).trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(name).slice(0, 2).toUpperCase();
};

const getRoomFloor = (r) => {
  if (!r) return "1";
  if (r.floor != null && r.floor !== "") return String(r.floor);
  const identifier = String(r.roomNumber || r.name || r.id || "");
  const match = identifier.match(/\b([1-9])\d{2}\b/) || identifier.match(/(\d{3,4})/);
  if (match) {
    const digits = match[1] || match[0];
    if (digits.length === 3) return digits[0];
    if (digits.length === 4) return digits.substring(0, 2);
  }
  const leadingDigit = identifier.match(/([1-9])/);
  if (leadingDigit) return leadingDigit[1];
  return "1";
};
const WATER_BILLABLE_ROOM_TYPES = new Set(["private", "double-sharing"]);
const fmtCurrency = (val) =>
  val != null
    ? `PHP ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : EMPTY_VALUE;
const fmtNumber = (val, digits = 2) =>
  val != null
    ? Number(val).toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : EMPTY_VALUE;
const fmtMonthYear = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : "";
const fmtShortDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "";
const getPeriodLabel = (period) => {
  if (!period) return "Billing Cycle";
  if (period.status === "open") return "Current Cycle";
  if (period.revised) return "Revised Cycle";
  return `${fmtMonthYear(period.startDate)} Cycle`;
};
const getDisplayStatus = (period) =>
  period?.billingState || period?.displayStatus || period?.status || "closed";
const getDisplayStatusLabel = (period) => {
  const status = getDisplayStatus(period);
  if (status === "ready_to_send" || status === "ready") return "Ready to Send";
  if (status === "sent" || status === "finalized") return "Sent";
  if (status === "no_active_cycle") return "No Active Bill";
  if (status === "open") return "Active";
  return status;
};
const getDisplayStatusIcon = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "sent" || s === "finalized") {
    return <CheckCheck size={11} className="shrink-0 text-slate-500" />;
  }
  if (s === "ready_to_send" || s === "ready") {
    return <Send size={11} className="shrink-0 text-blue-600" />;
  }
  if (s === "paid") {
    return <CheckCircle2 size={11} className="shrink-0 text-emerald-600" />;
  }
  if (s === "overdue") {
    return <AlertTriangle size={11} className="shrink-0 text-red-600" />;
  }
  if (s === "partially-paid" || s === "partially_paid") {
    return <Clock3 size={11} className="shrink-0 text-amber-600" />;
  }
  if (s === "open") {
    return <Zap size={11} className="shrink-0 text-emerald-600" />;
  }
  return <Info size={11} className="shrink-0 text-slate-400" />;
};
const getRoomBadgeLabel = (room) => {
  if (!room) return "No Active Bill";
  return room.billingLabel || "No Active Bill";
};
const canEditPeriod = (period) =>
  Boolean(period) && (period.canEdit ?? getDisplayStatus(period) !== "sent");
const canDeletePeriod = (period) => Boolean(period);
const getCycleLabel = (period) =>
  period
    ? `${fmtShortDate(period.startDate)} - ${fmtShortDate(period.endDate || period.targetCloseDate) || "Ongoing"}`
    : EMPTY_VALUE;
const getMeterRangeLabel = (period, utilityType) =>
  period
    ? utilityType === "water"
      ? `${fmtCurrency(period.ratePerUnit)} total water charge`
      : `${fmtNumber(period.startReading, 0)} ${utilityType === "electricity" ? "kWh" : "cu.m."} to ${period.endReading != null ? `${fmtNumber(period.endReading, 0)} ${utilityType === "electricity" ? "kWh" : "cu.m."}` : EMPTY_VALUE}`
    : EMPTY_VALUE;
const getExpectedPeriodEndDate = (period) =>
  period?.endDate || period?.targetCloseDate || null;
const getPeriodRangeText = (period) => {
  if (!period) return EMPTY_VALUE;
  const endLabel = fmtShortDate(getExpectedPeriodEndDate(period));
  return `${fmtShortDate(period.startDate)} - ${endLabel || "Ongoing"}`;
};
const getSegmentPeriodLabel = (segment) => {
  if (!segment) return EMPTY_VALUE;
  if (segment.startDate && segment.endDate) {
    return `${fmtShortDate(segment.startDate)} - ${fmtShortDate(segment.endDate)}`;
  }
  return segment.periodLabel || EMPTY_VALUE;
};
const getEventDayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const EVENT_TYPE_LABELS = {
  moveIn: "Tenant Move In",
  moveOut: "Tenant Move Out",
  regularBilling: "Mid-Cycle Reading",
  periodStart: "Opening Meter Reading",
  periodEnd: "Closing Meter Reading",
  manualAdjustment: "Meter Correction",
  roomTransfer: "Room Transfer",
};
const EVENT_TYPE_ORDER = {
  moveOut: 0,
  roomTransfer: 0,
  regularBilling: 1,
  periodStart: 1,
  periodEnd: 1,
  manualAdjustment: 1,
  moveIn: 2,
};
const getEventTypeLabel = (eventType) =>
  EVENT_TYPE_LABELS[normalizeUtilityEventType(eventType)] ||
  eventType ||
  EMPTY_VALUE;
const getEventTypeOrder = (eventType) =>
  EVENT_TYPE_ORDER[normalizeUtilityEventType(eventType)] ?? 1;
const isMoveLifecycleEvent = (eventType) =>
  isUtilityEventType(eventType, "moveIn") ||
  isUtilityEventType(eventType, "moveOut") ||
  eventType === "roomTransfer";
const isSystemBoundaryEvent = (eventType) =>
  isUtilityEventType(eventType, "periodStart") ||
  isUtilityEventType(eventType, "periodEnd");
const getReadingStatusLabel = (reading) => {
  if (!reading) return "Recorded";
  if (reading.readingStatus === "voided") return "Canceled";
  if (reading.readingStatus === "corrected") return "Revised";
  if (reading.readingStatus === "locked" || reading.isLocked) return "Finalized";
  return "Editable Draft";
};
const getTimelineRecordLabel = (row) => {
  if (!row) return EMPTY_VALUE;
  if (row.source === "transfer") return "Room Change";
  if (row.source === "merged") return "System Linked";
  if (row.source === "occupancy") return "Tenant Activity";
  if (row.source === "meter") return "Submeter Log";
  return row.source || EMPTY_VALUE;
};
const getTimelineStatusLabel = (row) => {
  if (!row) return EMPTY_VALUE;
  if (row.source === "transfer") {
    const m = row.transferMeta;
    return m?.billStatus ? m.billStatus.charAt(0).toUpperCase() + m.billStatus.slice(1) : "Settled";
  }
  if (row.source === "occupancy") {
    if (isUtilityEventType(row.eventType, "moveIn")) {
      return row.isActive ? "Active Tenant" : "Vacated";
    }
    if (isUtilityEventType(row.eventType, "moveOut")) return "Vacated";
  }
  if (row.rawReading) return getReadingStatusLabel(row.rawReading);
  return EMPTY_VALUE;
};
const getHistoryStatusClasses = (status) => {
  switch (status) {
    case "sent":
    case "finalized":
      return "bg-slate-100 text-slate-600 border border-slate-200/80 font-medium dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    case "ready_to_send":
    case "ready":
      return "bg-blue-50 text-blue-800 border border-blue-200 font-semibold dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    case "open":
      return "bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    case "revised":
      return "bg-amber-50 text-amber-900 border border-amber-200 font-semibold dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    case "no_active_cycle":
    default:
      return "bg-slate-100 text-slate-500 border border-slate-200/60 font-normal dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
  }
};
const getTimelineDotClasses = (eventType) => {
  const normalized = normalizeUtilityEventType(eventType);
  if (normalized === "moveIn") return "bg-amber-500";
  if (normalized === "moveOut") return "bg-rose-500";
  if (normalized === "periodStart") return "bg-emerald-500";
  if (normalized === "periodEnd") return "bg-red-600";
  if (eventType === "roomTransfer") return "bg-blue-500";
  return "bg-slate-300";
};
const toInputDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getTodayInput = () => new Date().toISOString().slice(0, 10);

const getBillDaysOverdue = (bill) => {
  if (!bill?.dueDate || bill?.status === "paid") return 0;
  const dueDate = new Date(bill.dueDate);
  if (Number.isNaN(dueDate.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
  return diffDays > 0 ? diffDays : 0;
};

const canSendBillReminder = (bill) =>
  Boolean(
    bill &&
      !getSharedNormalizedPaidState(bill).isPaid &&
      ["pending", "partially-paid", "overdue"].includes(bill.status),
  );
const LEGACY_PAID_FALLBACK_LABEL = "Paid — legacy/no ledger record";
const PAYMENT_STATUS_PRIORITY = {
  paid: 3,
  approved: 3,
  pending: 2,
  rejected: 1,
};
const formatPaymentMethodLabel = (value) => {
  if (!value) return EMPTY_VALUE;
  return formatAdminPaymentMode({ paymentMethod: value });
};
const formatDateTime = (value) => {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
const getPaymentReference = (payment) =>
  payment?.externalPaymentId || payment?.referenceNumber || null;
const getPaymentSortTime = (payment) => {
  const raw = payment?.processedAt || payment?.createdAt || null;
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
};
const pickLatestPaymentRecord = (records = []) =>
  [...records].sort((left, right) => {
    const priorityDelta =
      (PAYMENT_STATUS_PRIORITY[right?.status] || 0) -
      (PAYMENT_STATUS_PRIORITY[left?.status] || 0);
    if (priorityDelta !== 0) return priorityDelta;
    return getPaymentSortTime(right) - getPaymentSortTime(left);
  })[0] || null;
const buildPaymentLedgerByBillId = (payments = []) => {
  return buildSharedPaymentLedgerByBillId(payments);
};
const getBillPenaltyAmount = (bill) => Number(bill?.charges?.penalty || 0);
const canSendPenaltyNotice = (bill) =>
  Boolean(bill && !getSharedNormalizedPaidState(bill).isPaid && getBillPenaltyAmount(bill) > 0);
const getPenaltyReason = (bill) => {
  if (!canSendPenaltyNotice(bill)) return "";
  const daysLate = Number(bill?.penaltyDetails?.daysLate || 0);
  const ratePerDay = Number(bill?.penaltyDetails?.ratePerDay || 0);
  if (daysLate > 0 && ratePerDay > 0) {
    return `Late payment penalty for ${daysLate} day${daysLate === 1 ? "" : "s"} at PHP ${ratePerDay.toFixed(2)}/day`;
  }
  if (daysLate > 0) {
    return `Late payment penalty for ${daysLate} day${daysLate === 1 ? "" : "s"} overdue`;
  }
  return "Late payment penalty applied";
};
const resolvePaymentDetails = (bill, paymentRecord) => {
  const details = resolveSharedPaymentDetails(bill, paymentRecord);
  return {
    paymentMethod: details.paymentMethodLabel,
    paymentRecordedAt: details.paymentRecordedAt,
    paymentFallbackLabel: details.paymentFallbackLabel,
    paymentSource: null,
  };
};
const getPrimaryNoticeLabel = (bill) =>
  getSharedNormalizedBillSnapshot(bill, null, {
    getDaysOverdue: getBillDaysOverdue,
  }).daysOverdue > 0 || bill?.status === "overdue"
    ? "Send Overdue Notice"
    : "Send Payment Reminder";

const ELECTRICITY_EXPORT_COLUMNS = [
  { key: "roomName", label: "Room" },
  { key: "branch", label: "Branch" },
  {
    key: "periodStart",
    label: "Period Start",
    formatter: (value) => (value ? fmtDate(value) : ""),
  },
  {
    key: "periodEnd",
    label: "Period End",
    formatter: (value) => (value ? fmtDate(value) : ""),
  },
  { key: "periodStatus", label: "Period Status" },
  {
    key: "ratePerUnit",
    label: "Rate / Unit",
    formatter: (value) =>
      value !== "" && value != null ? Number(value).toFixed(2) : "",
  },
  { key: "tenantName", label: "Tenant" },
  {
    key: "totalUsage",
    label: "Total Usage",
    formatter: (value) =>
      value !== "" && value != null ? Number(value).toFixed(2) : "",
  },
  {
    key: "billAmount",
    label: "Utility Charge",
    formatter: (value) =>
      value !== "" && value != null ? Number(value).toFixed(2) : "",
  },
  { key: "billStatus", label: "Bill Status" },
  {
    key: "dueDate",
    label: "Due Date",
    formatter: (value) => (value ? fmtDate(value) : ""),
  },
  {
    key: "sentAt",
    label: "Sent At",
    formatter: (value) => (value ? fmtDate(value) : ""),
  },
];

const TIMELINE_EXPORT_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "event", label: "Event" },
  { key: "recordType", label: "Record Type" },
  { key: "status", label: "Status" },
  { key: "tenant", label: "Tenant" },
  { key: "tenantEmail", label: "Tenant Email" },
  { key: "bed", label: "Bed" },
  { key: "reading", label: "Reading" },
];

const PERIOD_HISTORY_EXPORT_COLUMNS = [
  { key: "cycle", label: "Cycle" },
  { key: "basis", label: "Basis" },
  { key: "rate", label: "Rate" },
  { key: "status", label: "Status" },
];

const TENANT_SUMMARY_EXPORT_COLUMNS = [
  { key: "tenantName", label: "Tenant Name" },
  { key: "tenantEmail", label: "Tenant Email" },
  { key: "durationRange", label: "Duration Range" },
  { key: "totalUsage", label: "Total Usage" },
  { key: "billAmount", label: "Bill Amount" },
];

/**
 * DeltaChip — shows the kWh / cu.m. difference between start and end readings.
 * Variants: success (positive), error (rollback), warning (very high), muted (zero).
 */
const DeltaChip = ({ start, end, unit }) => {
  if (start == null || end == null) return null;
  const delta = Number(end) - Number(start);
  if (Number.isNaN(delta)) return null;
  if (delta < 0)
    return (
      <span className="delta-chip delta-chip--error" title="Meter rollback detected">
        ⚠ Rollback
      </span>
    );
  if (delta === 0)
    return (
      <span className="delta-chip delta-chip--muted">No change</span>
    );
  return (
    <span className="delta-chip delta-chip--success">
      +{delta.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
    </span>
  );
};

const UtilityBillingTab = ({
  utilityType,
  isActive = true,
  ownerBranchFilter,
  onOwnerBranchChange,
}) => {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const notify = useBillingNotifier();

  /** Mask tenant email for privacy: "kurochan.suson0838@gmail.com" -> "ku••••••••@gmail.com" */
  const maskEmail = (email) => {
    if (!email) return EMPTY_VALUE;
    const str = String(email).trim();
    const atIdx = str.indexOf("@");
    if (atIdx <= 0) return `${str.slice(0, 2)}••••••••`;
    const local = str.slice(0, atIdx);
    const domain = str.slice(atIdx);
    const prefix = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
    return `${prefix}••••••••${domain}`;
  };

  // Selection
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [unmaskedRows, setUnmaskedRows] = useState({});

  const toggleUnmaskRow = (id) => {
    setUnmaskedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // For Owner: branchFilter is controlled by the parent page so both
  // electricity and water tabs always share the same branch selection.
  // For Branch Admin: local state locked to their assigned branch.
  const [localBranchFilter, setLocalBranchFilter] = useState(
    isOwner ? "" : user?.branch || "",
  );
  const branchFilter = isOwner
    ? (ownerBranchFilter ?? "")
    : localBranchFilter;
  const setBranchFilter = isOwner
    ? (onOwnerBranchChange ?? (() => {}))
    : setLocalBranchFilter;

  // Sidebar search & filters
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [floorFilter, setFloorFilter] = useState("all");
  const [roomStatusFilter, setRoomStatusFilter] = useState("all");

  // Panel / section state
  const [activePanel, setActivePanel] = useState(null);
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyModalPeriodId, setHistoryModalPeriodId] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [editingRateValue, setEditingRateValue] = useState("");

  const [editPeriodModal, setEditPeriodModal] = useState({
    open: false,
    periodId: null,
  });
  const [editPeriodForm, setEditPeriodForm] = useState({
    startDate: "",
    endDate: "",
    startReading: "",
    endReading: "",
    ratePerUnit: "",
  });

  // Edit reading modal
  const [editReadingModal, setEditReadingModal] = useState({
    open: false,
    reading: null,
  });
  const [editReadingForm, setEditReadingForm] = useState({
    reading: "",
    date: "",
    eventType: "moveIn",
  });

  // Pagination
  const PERIODS_PER_PAGE = 5;
  const TIMELINE_PER_PAGE = 8;
  const ROOMS_PER_PAGE = 10;
  const [periodsPage, setPeriodsPage] = useState(1);
  const [timelinePage, setTimelinePage] = useState(1);
  const [roomsPage, setRoomsPage] = useState(1);
  const hasAutoSelectedPeriodRef = useRef(false);
  const queryClient = useQueryClient();

  // Form state - billing periods default to 15th-to-15th cycle

  const utilityQueryOptions = useMemo(
    () => ({
      enabled: isActive,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 5000,
    }),
    [isActive],
  );

  // Queries
  const { data: businessSettings } = useBusinessSettings(Boolean(user));
  const { data: roomsData, isLoading: roomsLoading } = useUtilityRooms(
    utilityType,
    branchFilter,
    utilityQueryOptions,
  );
  const {
    data: roomHistoryData,
    isFetching: isHistoryFetching,
    refetch: refetchRoomHistory,
  } = useRoomHistory(
    utilityType,
    selectedRoomId,
    utilityQueryOptions,
  );
  const { data: readingsData, refetch: refetchReadings } = useUtilityReadings(
    utilityType,
    selectedRoomId,
    utilityQueryOptions,
  );
  const { data: latestData } = useUtilityLatestReading(
    utilityType,
    selectedRoomId,
    utilityQueryOptions,
  );
  const { data: periodsData } = useUtilityPeriods(
    utilityType,
    selectedRoomId,
    utilityQueryOptions,
  );
  const periodList = periodsData?.periods || [];
  const selectedPeriodFromList = periodList.find(
    (period) => period.id === selectedPeriodId,
  );
  const historyModalPeriod = periodList.find(
    (period) => period.id === historyModalPeriodId,
  );
  const selectedResultPeriodId =
    selectedPeriodFromList && selectedPeriodFromList.status !== "open"
      ? selectedPeriodFromList.id
      : null;
  const { data: resultData } = useUtilityResult(
    utilityType,
    selectedResultPeriodId,
    utilityQueryOptions,
  );

  // Mutations
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleTimelineRefresh = useCallback(async () => {
    if (!selectedRoomId || !utilityType) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: [...utilityKeys.all(utilityType), "roomHistory", selectedRoomId],
          type: "all",
        }),
        queryClient.refetchQueries({
          queryKey: utilityKeys.readings(utilityType, selectedRoomId),
          type: "all",
        }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient, selectedRoomId, utilityType]);

  const updatePeriod = useUpdateUtilityPeriod(utilityType);
  const sendPeriod = useSendUtilityPeriod(utilityType);
  const deleteReading = useDeleteUtilityReading(utilityType);
  const updateReading = useUpdateUtilityReading(utilityType);
  const deletePeriod = useDeleteUtilityPeriod(utilityType);
  const [sendingByPeriodId, setSendingByPeriodId] = useState({});
  const [isSendingAllReady, setIsSendingAllReady] = useState(false);
  const [activeNoticeKey, setActiveNoticeKey] = useState(null);
  const [periodStatusFilter, setPeriodStatusFilter] = useState("");
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [periodSearch, setPeriodSearch] = useState("");

  const rooms = useMemo(() => {
    const list = (roomsData?.rooms || []).filter((room) => room.branch !== "guadalupe");
    if (utilityType !== "water") return list;
    return list.filter((room) => WATER_BILLABLE_ROOM_TYPES.has(room.type));
  }, [roomsData?.rooms, utilityType]);
  const readings = readingsData?.readings || [];
  const meterTimelineEvents = useMemo(
    () =>
      [...readings].sort((left, right) => {
        const leftDate = new Date(left.date).getTime();
        const rightDate = new Date(right.date).getTime();
        if (leftDate !== rightDate) return leftDate - rightDate;
        const leftPriority = getEventTypeOrder(left.eventType);
        const rightPriority = getEventTypeOrder(right.eventType);
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return (
          new Date(left.createdAt || 0).getTime() -
          new Date(right.createdAt || 0).getTime()
        );
      }),
    [readings],
  );
  const periods = periodList;
  const result = resultData?.result || null;
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const selectedBillingBranch = isOwner
    ? selectedRoom?.branch || branchFilter || undefined
    : user?.branch || selectedRoom?.branch || undefined;
  const { data: roomBillsData } = useBillsByBranch(
    {
      branch: selectedBillingBranch,
      roomId: selectedRoomId || undefined,
      limit: 500,
    },
    {
      enabled: Boolean(isActive && selectedRoomId && selectedBillingBranch),
    },
  );
  const roomBills = roomBillsData?.bills || [];
  const utilityPaymentParams = useMemo(
    () => ({
      branch: selectedBillingBranch,
      limit: 500,
    }),
    [selectedBillingBranch],
  );
  const { data: utilityPaymentsData } = useAdminPayments(utilityPaymentParams, {
    enabled: Boolean(isActive && selectedBillingBranch),
  });
  const utilityPaymentsByBillId = useMemo(
    () => buildPaymentLedgerByBillId(utilityPaymentsData?.data || []),
    [utilityPaymentsData?.data],
  );
  const utilityBillsById = useMemo(
    () =>
      new Map(
        roomBills
          .filter((bill) => Number(bill?.charges?.[utilityType] || 0) > 0)
          .map((bill) => [String(bill.id || bill._id || ""), bill]),
      ),
    [roomBills, utilityType],
  );
  const resultWithBilling = useMemo(() => {
    if (!result) return null;
    return {
      ...result,
      tenantSummaries: (result.tenantSummaries || []).map((tenant) => {
        const bill = tenant?.billId
          ? utilityBillsById.get(String(tenant.billId))
          : null;
        const paymentRecord = bill
          ? utilityPaymentsByBillId.get(String(bill.id || bill._id || ""))
          : null;
        const normalizedBill = getSharedNormalizedBillSnapshot(bill, paymentRecord, {
          getDaysOverdue: getBillDaysOverdue,
        });
        const paymentDetails = resolvePaymentDetails(bill, paymentRecord);
        return {
          ...tenant,
          billId: bill?.id || bill?._id || tenant.billId || null,
          billStatus: normalizedBill.status || "",
          dueDate: bill?.dueDate || null,
          remainingAmount: bill ? normalizedBill.balance : Number(tenant.billAmount ?? 0),
          daysOverdue: normalizedBill.daysOverdue,
          canSendReminder: canSendBillReminder(bill, paymentRecord),
          canSendPenaltyNotice: canSendPenaltyNotice(bill, paymentRecord),
          penaltyAmount: getBillPenaltyAmount(bill),
          penaltyReason: getPenaltyReason(bill),
          paymentMethod: paymentDetails.paymentMethod,
          paymentRecordedAt: paymentDetails.paymentRecordedAt,
          paymentFallbackLabel: paymentDetails.paymentFallbackLabel,
        };
      }),
    };
  }, [result, utilityBillsById, utilityPaymentsByBillId]);
  const selectedMonitoringResult =
    selectedPeriodFromList &&
    (selectedPeriodFromList.status === "closed" ||
      selectedPeriodFromList.status === "revised")
      ? resultWithBilling
      : null;
  const roomHistory = roomHistoryData?.history || [];
  const billingTimelineRows = useMemo(() => {
    const mergeRow = (current, next) => {
      const merged = { ...current, ...next };
      const hasOccupancySource =
        current.source === "occupancy" || next.source === "occupancy";
      const hasMeterSource =
        current.source === "meter" || next.source === "meter";
      const hasTransferSource =
        current.source === "transfer" || next.source === "transfer";

      if (hasTransferSource) {
        merged.source = "transfer";
        merged.eventType = "roomTransfer";
        merged.transferMeta = current.transferMeta || next.transferMeta || null;
      } else {
        merged.source =
          hasOccupancySource && hasMeterSource ? "merged" : next.source;
      }
      merged.hasMeterRecord = Boolean(
        current.hasMeterRecord || next.hasMeterRecord,
      );
      merged.rawReading = next.rawReading || current.rawReading || null;
      merged.reading = next.reading ?? current.reading ?? null;

      if (
        (merged.tenantName === EMPTY_VALUE || merged.tenantName == null) &&
        current.tenantName &&
        current.tenantName !== EMPTY_VALUE
      ) {
        merged.tenantName = current.tenantName;
      }

      if (
        (merged.tenantEmail === EMPTY_VALUE || merged.tenantEmail == null) &&
        current.tenantEmail &&
        current.tenantEmail !== EMPTY_VALUE
      ) {
        merged.tenantEmail = current.tenantEmail;
      }

      return merged;
    };

    const timelineByKey = new Map();
    const upsertRow = (row) => {
      const existing = timelineByKey.get(row.mergeKey);
      if (!existing) {
        timelineByKey.set(row.mergeKey, row);
        return;
      }
      timelineByKey.set(row.mergeKey, mergeRow(existing, row));
    };

    // Helper: check if a transfer bill exists for a given tenant ID/email on a date key
    const findTransferBill = (tenantId, tenantEmail, dateKey) =>
      roomBills.find((b) => {
        if (b.billType !== "transfer_settlement") return false;
        const bTenantId = String(b.userId?._id || b.userId || "");
        const bEmail = b.userId?.email || "";
        const matchesTenant =
          (tenantId && bTenantId === String(tenantId)) ||
          (tenantEmail && bEmail === tenantEmail);
        const bDateKey = getEventDayKey(
          b.transferSnapshot?.effectiveTransferDate || b.billingCycleEnd || b.billingMonth,
        );
        return matchesTenant && bDateKey === dateKey;
      });

    // 1. Process transfer_settlement bills first so transfer rows are anchored
    for (const bill of roomBills) {
      if (bill.billType !== "transfer_settlement") continue;
      const snap = bill.transferSnapshot || {};
      const eventDate = snap.effectiveTransferDate || bill.billingCycleEnd || bill.billingMonth;
      if (!eventDate) continue;

      const fromName = snap.fromRoomName || "?";
      const toName   = snap.toRoomName   || "?";
      const tenantName =
        bill.userId?.firstName && bill.userId?.lastName
          ? `${bill.userId.firstName} ${bill.userId.lastName}`
          : EMPTY_VALUE;
      const tenantId = String(bill.userId?._id || bill.userId || "");
      const tenantEmail = bill.userId?.email || null;
      const dateKey = getEventDayKey(eventDate);

      const transferKey = `transfer-${tenantId || tenantEmail || bill._id}-${dateKey}`;
      upsertRow({
        id: `transfer-${bill._id || bill.id}`,
        mergeKey: transferKey,
        source: "transfer",
        date: eventDate,
        eventType: "roomTransfer",
        tenantName,
        tenantEmail,
        bedName: EMPTY_VALUE,
        reading: null,
        hasMeterRecord: Boolean(snap.estimatedElectricityKwh != null),
        rawReading: null,
        transferMeta: {
          fromRoomName: fromName,
          toRoomName:   toName,
          proRataDays:  snap.proRataDays ?? null,
          proRataRent:  snap.proRataRent ?? null,
          electricityKwh:    snap.estimatedElectricityKwh ?? null,
          electricityCharge: snap.estimatedElectricityCharge ?? null,
          totalAmount:  bill.totalAmount ?? null,
          billId:       bill._id || bill.id,
          billStatus:   bill.status,
        },
      });
    }

    // 2. Process room history (occupancy moveIn / moveOut)
    for (const entry of roomHistory) {
      const moveInDate = entry.moveInDate || entry.moveInReading?.date || null;
      if (moveInDate) {
        const tenantId = entry.tenantId || entry.id;
        const dateKey = getEventDayKey(moveInDate);
        const tBill = findTransferBill(tenantId, entry.tenantEmail, dateKey);
        const moveInKey = tBill
          ? `transfer-${String(tBill.userId?._id || tBill.userId || entry.tenantEmail || tenantId)}-${dateKey}`
          : `${tenantId || entry.tenantName}-moveIn-${dateKey}`;

        upsertRow({
          id: `occ-in-${entry.id || tenantId}-${moveInDate}`,
          mergeKey: moveInKey,
          source: "occupancy",
          date: moveInDate,
          eventType: "moveIn",
          tenantName: entry.tenantName || EMPTY_VALUE,
          tenantEmail: entry.tenantEmail || null,
          bedName: entry.bedName || EMPTY_VALUE,
          reading: entry.moveInReading?.reading ?? null,
          isActive: entry.isActive,
          hasMeterRecord: Boolean(entry.moveInReading),
          rawReading: entry.moveInReading || null,
        });
      }

      if (entry.moveOutDate) {
        const tenantId = entry.tenantId || entry.id;
        const dateKey = getEventDayKey(entry.moveOutDate);
        const tBill = findTransferBill(tenantId, entry.tenantEmail, dateKey);
        const moveOutKey = tBill
          ? `transfer-${String(tBill.userId?._id || tBill.userId || entry.tenantEmail || tenantId)}-${dateKey}`
          : `${tenantId || entry.tenantName}-moveOut-${dateKey}`;

        upsertRow({
          id: `occ-out-${entry.id || tenantId}-${entry.moveOutDate}`,
          mergeKey: moveOutKey,
          source: "occupancy",
          date: entry.moveOutDate,
          eventType: "moveOut",
          tenantName: entry.tenantName || EMPTY_VALUE,
          tenantEmail: entry.tenantEmail || null,
          bedName: entry.bedName || EMPTY_VALUE,
          reading: entry.moveOutReading?.reading ?? null,
          hasMeterRecord: Boolean(entry.moveOutReading),
          rawReading: entry.moveOutReading || null,
        });
      }
    }

    // 3. Process meter timeline events
    for (const reading of meterTimelineEvents) {
      const eventType = normalizeUtilityEventType(reading.eventType);
      if (eventType === "regularBilling") continue;

      const dateKey = getEventDayKey(reading.date);
      const tenantId = reading.tenantId || reading.tenant;
      const tBill = findTransferBill(tenantId, reading.tenantEmail, dateKey);

      const meterKey = isMoveLifecycleEvent(eventType)
        ? (tBill
            ? `transfer-${String(tBill.userId?._id || tBill.userId || reading.tenantEmail || tenantId)}-${dateKey}`
            : `${tenantId || "unassigned"}-${eventType}-${dateKey}`)
        : `${eventType}-${dateKey}-${reading.reading}`;

      upsertRow({
        id: `meter-${reading.id}`,
        mergeKey: meterKey,
        source: "meter",
        date: reading.date,
        eventType,
        tenantName: reading.tenant || EMPTY_VALUE,
        tenantEmail: reading.tenantEmail || null,
        bedName: EMPTY_VALUE,
        reading: reading.reading,
        hasMeterRecord: true,
        rawReading: reading,
      });
    }

    const combined = [...timelineByKey.values()];
    combined.sort((left, right) => {
      const leftDate = new Date(left.date).getTime();
      const rightDate = new Date(right.date).getTime();
      if (leftDate !== rightDate) return rightDate - leftDate;

      const leftPriority = getEventTypeOrder(left.eventType);
      const rightPriority = getEventTypeOrder(right.eventType);
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;

      return String(right.id).localeCompare(String(left.id));
    });

    return combined;
  }, [roomHistory, meterTimelineEvents, roomBills]);
  const currentPeriod = periods[0] || null;
  const openPeriodForRoom = periods.find((p) => p.status === "open");
  const lastClosedPeriod = periods.find(
    (p) => p.status === "closed" || p.status === "revised"
  );
  const defaultRatePerUnit =
    utilityType === "electricity"
      ? (businessSettings?.defaultElectricityRatePerKwh ?? "")
      : (businessSettings?.defaultWaterRatePerUnit ?? "");

  const availableFloors = useMemo(() => {
    const floorsSet = new Set();
    rooms.forEach((r) => {
      floorsSet.add(getRoomFloor(r));
    });
    return Array.from(floorsSet).sort((a, b) => Number(a) - Number(b));
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    let list = branchFilter
      ? rooms.filter((r) => r.branch === branchFilter)
      : rooms;

    if (floorFilter !== "all") {
      list = list.filter((r) => getRoomFloor(r) === String(floorFilter));
    }

    if (roomStatusFilter === "occupied") {
      list = list.filter(
        (r) =>
          Boolean(
            r.hasActiveTenants ||
              (r.activeTenantCount != null && r.activeTenantCount > 0),
          ),
      );
    } else if (roomStatusFilter === "vacant") {
      list = list.filter(
        (r) =>
          !r.hasActiveTenants &&
          (!r.activeTenantCount || r.activeTenantCount === 0),
      );
    }

    if (sidebarSearch.trim()) {
      const q = sidebarSearch.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.roomNumber?.toString().toLowerCase().includes(q) ||
          r.tenantName?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rooms, branchFilter, floorFilter, roomStatusFilter, sidebarSearch]);

  const readyRooms = useMemo(
    () =>
      filteredRooms.filter(
        (room) => room.billingState === "ready_to_send" && room.latestPeriodId,
      ),
    [filteredRooms],
  );
  const selectedReadyPeriod =
    selectedPeriodFromList &&
    getDisplayStatus(selectedPeriodFromList) === "ready_to_send"
      ? selectedPeriodFromList
      : null;
  const currentPeriodUsage =
    currentPeriod &&
    currentPeriod.endReading != null &&
    currentPeriod.startReading != null
      ? currentPeriod.endReading - currentPeriod.startReading
      : null;
  const currentPeriodCost =
    currentPeriod?.computedTotalCost != null
      ? currentPeriod.computedTotalCost
      : currentPeriodUsage != null && currentPeriod?.ratePerUnit != null
        ? currentPeriodUsage * currentPeriod.ratePerUnit
        : null;
  const isCurrentCycleLocked = Boolean(
    currentPeriod?.status === "locked" ||
      currentPeriod?.isLocked ||
      currentPeriod?.locked,
  );

  // Paginated slices
  const totalRoomPages = Math.max(
    1,
    Math.ceil(filteredRooms.length / ROOMS_PER_PAGE),
  );
  const pagedRooms = filteredRooms.slice(
    (roomsPage - 1) * ROOMS_PER_PAGE,
    roomsPage * ROOMS_PER_PAGE,
  );

  const filteredPeriods = useMemo(() => {
    let list = [...periods];

    if (periodStatusFilter) {
      list = list.filter((p) => {
        const s = getDisplayStatus(p);
        if (periodStatusFilter === "sent")
          return s === "sent" || s === "finalized";
        if (periodStatusFilter === "pending")
          return s === "ready_to_send" || s === "ready";
        if (periodStatusFilter === "draft") return s === "open";
        if (periodStatusFilter === "paid") return s === "paid";
        return true;
      });
    }

    if (periodStartDate) {
      list = list.filter((p) => p.startDate && p.startDate >= periodStartDate);
    }

    if (periodEndDate) {
      list = list.filter((p) => {
        const end = p.endDate || p.targetCloseDate;
        return end && end <= periodEndDate;
      });
    }

    if (periodSearch.trim()) {
      const q = periodSearch.trim().toLowerCase();
      list = list.filter((p) => getCycleLabel(p).toLowerCase().includes(q));
    }

    return list;
  }, [
    periods,
    periodStatusFilter,
    periodStartDate,
    periodEndDate,
    periodSearch,
  ]);

  const totalPeriodPages = Math.max(
    1,
    Math.ceil(filteredPeriods.length / PERIODS_PER_PAGE),
  );
  const pagedPeriods = filteredPeriods.slice(
    (periodsPage - 1) * PERIODS_PER_PAGE,
    periodsPage * PERIODS_PER_PAGE,
  );

  const totalTimelinePages = Math.max(
    1,
    Math.ceil(billingTimelineRows.length / TIMELINE_PER_PAGE),
  );
  const pagedTimelineRows = billingTimelineRows.slice(
    (timelinePage - 1) * TIMELINE_PER_PAGE,
    timelinePage * TIMELINE_PER_PAGE,
  );

  useEffect(() => {
    if (filteredRooms.length === 0) {
      setSelectedRoomId(null);
      setSelectedPeriodId(null);
      return;
    }
    if (
      !selectedRoomId ||
      !filteredRooms.some((r) => r.id === selectedRoomId)
    ) {
      setSelectedRoomId(filteredRooms[0].id);
    }
  }, [filteredRooms, selectedRoomId]);

  useEffect(() => {
    if (periods.length === 0) {
      setSelectedPeriodId(null);
      hasAutoSelectedPeriodRef.current = false;
      return;
    }

    const hasSelectedPeriod = periods.some((p) => p.id === selectedPeriodId);
    if (hasSelectedPeriod) {
      hasAutoSelectedPeriodRef.current = true;
      return;
    }

    if (!selectedPeriodId && hasAutoSelectedPeriodRef.current) {
      return;
    }

    const mostRecent =
      periods.find((p) => p.status === "closed" || p.status === "revised") ||
      periods[0];
    if (mostRecent) {
      setSelectedPeriodId(mostRecent.id);
      hasAutoSelectedPeriodRef.current = true;
    }
  }, [periods, selectedPeriodId]);

  const Pagination = ({ page, total, onChange, countLabel }) => {
    if (total === 0) return null;

    const getPageNumbers = () => {
      if (total <= 5) {
        return Array.from({ length: total }, (_, i) => i + 1);
      }
      if (page <= 3) {
        return [1, 2, 3, "...", total];
      }
      if (page >= total - 2) {
        return [1, "...", total - 2, total - 1, total];
      }
      return [1, "...", page, "...", total];
    };

    const pages = getPageNumbers();

    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{countLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            &lt;
          </button>
          {pages.map((p, idx) =>
            p === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                  page === p
                    ? "border-amber-400 bg-amber-400/20 text-warning-dark dark:text-amber-300"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onChange(page + 1)}
            disabled={page >= total}
            aria-label="Next page"
          >
            &gt;
          </button>
        </div>
      </div>
    );
  };

  // ---------------- Handlers ----------------

  const selectAndFocusPeriod = (periodId) => {
    setSelectedPeriodId(periodId);
  };

  const openHistoryModal = (periodId) => {
    setSelectedPeriodId(periodId);
    setHistoryModalPeriodId(periodId);
    setIsHistoryModalOpen(true);
  };

  const closeHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setHistoryModalPeriodId(null);
  };

  const openPanel = (panel) => {
    setActivePanel(panel);
  };
  const closePanel = () => setActivePanel(null);

  const buildGenerationBlocker = (error) => {
    const payload = error?.response?.data?.error || null;
    const message =
      payload?.message ||
      payload?.error ||
      error?.response?.data?.message ||
      error?.message ||
      "Unable to finalize billing cycle.";
    const details = payload?.details || null;
    const lines = [];

    const overlaps = details?.overlaps || [];
    if (Array.isArray(overlaps) && overlaps.length > 0) {
      for (const overlap of overlaps.slice(0, 5)) {
        lines.push(
          `Bed ${overlap.bedKey}: ${overlap.firstTenantName || "Tenant A"} overlaps ${overlap.secondTenantName || "Tenant B"}`,
        );
      }
    }

    const missingMoveIns = details?.missingMoveInReadings || [];
    const missingMoveOuts = details?.missingMoveOutReadings || [];
    if (Array.isArray(missingMoveIns) && missingMoveIns.length > 0) {
      for (const entry of missingMoveIns.slice(0, 5)) {
        lines.push(
          `Missing move-in reading: ${entry.tenantName || "Tenant"} (${fmtDate(readMoveInDate(entry)) || "date required"})`,
        );
      }
    }
    if (Array.isArray(missingMoveOuts) && missingMoveOuts.length > 0) {
      for (const entry of missingMoveOuts.slice(0, 5)) {
        lines.push(
          `Missing move-out reading: ${entry.tenantName || "Tenant"} (${fmtDate(readMoveOutDate(entry)) || "date required"})`,
        );
      }
    }

    return {
      message,
      lines,
    };
  };

  useEffect(() => {
    if (activePanel === "closePeriod" && openPeriodForRoom) {
      setPeriodForm((f) => ({
        ...f,
        endDate:
          toInputDate(getExpectedPeriodEndDate(openPeriodForRoom)) || f.endDate,
      }));
    }
  }, [activePanel, openPeriodForRoom]);

  const handleEditReading = (r) => {
    setEditReadingForm({
      reading: String(r.reading),
      date: r.date ? new Date(r.date).toISOString().slice(0, 10) : "",
      eventType: normalizeUtilityEventType(r.eventType) || "regularBilling",
    });
    setEditReadingModal({ open: true, reading: r });
  };

  const handleSaveEditReading = async () => {
    const { reading } = editReadingModal;
    if (!editReadingForm.reading || !editReadingForm.date) {
      return notify.warn("Reading value and date are required.");
    }
    try {
      await updateReading.mutateAsync({
        readingId: reading.id,
        reading: Number(editReadingForm.reading),
        date: editReadingForm.date,
        eventType: editReadingForm.eventType,
      });
      notify.success("Reading updated.");
      setEditReadingModal({ open: false, reading: null });
    } catch (err) {
      notify.error(err, "Failed to update reading.");
    }
  };

  const handleSaveRate = async () => {
    if (!editingRateValue || Number(editingRateValue) <= 0) {
      return notify.warn("Rate must be a positive number.");
    }
    try {
      await updatePeriod.mutateAsync({
        periodId: currentPeriod?.id,
        ratePerUnit: Number(editingRateValue),
      });
      notify.success("Rate updated successfully.");
      setEditingRate(false);
      setEditingRateValue("");
    } catch (err) {
      notify.error(err, "Failed to update rate.");
    }
  };

  const handleDeleteReading = (readingId) => {
    setConfirmModal({
      open: true,
      title: "Delete Meter Reading",
      message:
        "This reading will be permanently removed. If it belongs to a closed period, click 'Re-run' afterward to update the billing result.",
      variant: "danger",
      confirmText: "Delete Reading",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        try {
          await deleteReading.mutateAsync(readingId);
          notify.success("Reading permanently deleted.");
        } catch (err) {
          notify.error(err, "Failed to delete reading.");
        }
      },
    });
  };

  const handleDeletePeriod = (periodId) => {
    const targetPeriod = periods.find((p) => p.id === periodId);
    const isOpenPeriod = targetPeriod?.status === "open";
    const message = isOpenPeriod
      ? "This will delete the current open billing period (auto-created after the last close). You can re-create it with '+ New Billing Period' — the form will pre-fill from the last closed period."
      : "This will permanently delete the billing period AND all its meter readings and generated tenant bills. This cannot be undone.";
    setConfirmModal({
      open: true,
      title: "Delete Billing Period",
      message,
      variant: "danger",
      confirmText: "Delete Period",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        try {
          await deletePeriod.mutateAsync(periodId);
          if (selectedPeriodId === periodId) {
            setSelectedPeriodId(null);
          }
          notify.success("Billing period permanently deleted.");
        } catch (err) {
          notify.error(err, "Failed to delete period.");
        }
      },
    });
  };

  const handleGenerateCycle = async () => {
    const requiresReadings = utilityType === "electricity";
    if (
      !periodForm.startDate ||
      !periodForm.endDate ||
      !periodForm.ratePerUnit ||
      (requiresReadings && (!periodForm.startReading || !periodForm.endReading))
    ) {
      return notify.warn(
        "All fields (dates, readings, and rate) are required.",
      );
    }
    let newlyOpenedPeriodId = null;
    try {
      setGenerationBlocker(null);
      // Auto-clean any leftover open period before creating a new cycle
      if (openPeriodForRoom) {
        if (selectedPeriodId === openPeriodForRoom.id) {
          setSelectedPeriodId(null);
        }
        await deletePeriod.mutateAsync(openPeriodForRoom.id);
      }

      const openedData = await openPeriod.mutateAsync({
        roomId: selectedRoomId,
        startDate: periodForm.startDate,
        startReading:
          utilityType === "water" ? 0 : Number(periodForm.startReading),
        ratePerUnit: Number(periodForm.ratePerUnit),
      });

      const newPeriodId =
        openedData?.period?._id || openedData?.period?.id || openedData?.id;

      if (newPeriodId) {
        newlyOpenedPeriodId = newPeriodId;
        setSelectedPeriodId(newPeriodId);
        await closePeriod.mutateAsync({
          periodId: newPeriodId,
          endReading:
            utilityType === "water" ? 0 : Number(periodForm.endReading),
          endDate: periodForm.endDate,
        });
        notify.success("Billing cycle generated successfully.");
        setGenerationBlocker(null);
        closePanel();
        selectAndFocusPeriod(newPeriodId);
      } else {
        notify.success(
          "Billing period opened, but could not finalize automatically.",
        );
        closePanel();
      }
    } catch (err) {
      if (newlyOpenedPeriodId) {
        try {
          await deletePeriod.mutateAsync(newlyOpenedPeriodId);
          if (selectedPeriodId === newlyOpenedPeriodId) {
            setSelectedPeriodId(null);
          }
          notify.warn(
            "Cycle finalize failed, so the temporary open period was rolled back.",
          );
        } catch {
          // Keep the original finalize error as primary context for the user.
        }
      }
      setGenerationBlocker(buildGenerationBlocker(err));
      notify.error(err, "Failed to generate billing cycle.");
    }
  };

  // ---------------- Draft bills handlers (expand-on-edit) ----------------

  const handleOpenEditPeriod = (period) => {
    if (!period?.id) return;
    setEditPeriodForm({
      startDate: toInputDate(period.startDate) || "",
      endDate: toInputDate(period.endDate) || "",
      startReading:
        period.startReading !== undefined && period.startReading !== null
          ? String(period.startReading)
          : "",
      endReading:
        period.endReading !== undefined && period.endReading !== null
          ? String(period.endReading)
          : "",
      ratePerUnit:
        period.ratePerUnit !== undefined && period.ratePerUnit !== null
          ? String(period.ratePerUnit)
          : "",
    });
    setEditPeriodModal({ open: true, periodId: period.id });
  };

  const handleSaveEditPeriod = async () => {
    const { periodId } = editPeriodModal;
    if (!periodId) return;
    if (!editPeriodForm.startDate || !editPeriodForm.ratePerUnit) {
      return notify.warn("Start date and rate are required.");
    }
    if (
      editPeriodForm.endDate &&
      editPeriodForm.endDate < editPeriodForm.startDate
    ) {
      return notify.warn("End date must be on or after the start date.");
    }
    if (utilityType === "electricity") {
      if (!editPeriodForm.endDate) {
        return notify.warn("End date is required.");
      }
      if (
        editPeriodForm.startReading === "" ||
        editPeriodForm.endReading === ""
      ) {
        return notify.warn("Start and end meter readings are required.");
      }
      if (
        Number(editPeriodForm.endReading) < Number(editPeriodForm.startReading)
      ) {
        return notify.warn(
          "End meter reading must be greater than or equal to start meter reading.",
        );
      }
    }

    try {
      const response = await updatePeriod.mutateAsync({
        periodId,
        startDate: editPeriodForm.startDate,
        endDate: editPeriodForm.endDate || null,
        ratePerUnit: Number(editPeriodForm.ratePerUnit),
        ...(utilityType === "electricity"
          ? {
              startReading: Number(editPeriodForm.startReading),
              endReading: Number(editPeriodForm.endReading),
            }
          : {}),
      });

      const updatedPeriodId = response?.period?.id || periodId;
      setSelectedPeriodId(updatedPeriodId);

      if (response?.result) {
        queryClient.setQueryData(
          utilityKeys.result(utilityType, updatedPeriodId),
          { result: response.result },
        );
      }

      const refreshTasks = [];
      if (selectedRoomId) {
        refreshTasks.push(
          queryClient.refetchQueries({
            queryKey: utilityKeys.periods(utilityType, selectedRoomId),
            exact: true,
          }),
        );
        refreshTasks.push(
          queryClient.refetchQueries({
            queryKey: utilityKeys.readings(utilityType, selectedRoomId),
            exact: true,
          }),
        );
      }
      refreshTasks.push(
        queryClient.refetchQueries({
          queryKey: utilityKeys.rooms(utilityType, branchFilter),
          exact: true,
        }),
      );

      if (refreshTasks.length > 0) {
        await Promise.all(refreshTasks);
      }

      notify.success("Billing period updated.");
      setEditPeriodModal({ open: false, periodId: null });
    } catch (err) {
      notify.error(err, "Failed to update billing period.");
    }
  };

  const sendSinglePeriod = async ({ periodId, roomName, cycleText }) => {
    setSendingByPeriodId((prev) => ({ ...prev, [periodId]: true }));
    try {
      const response = await sendPeriod.mutateAsync({ periodId });
      if (response?.published > 0) {
        notify.success(
          `${utilityType === "water" ? "Water" : "Electricity"} charge sent to ${response.published} tenant${response.published === 1 ? "" : "s"} for ${roomName}.`,
        );
      } else {
        notify.warn(`No tenant charges were sent for ${roomName}.`);
      }
      if (response?.emailFailedCount > 0) {
        notify.warn(
          `Email delivery skipped or failed for ${response.emailFailedCount} tenant(s). Check server email configuration.`,
        );
      } else if (response?.emailSuccessCount > 0) {
        notify.info(`Email notifications dispatched successfully.`);
      }
      if (response?.partialFailures?.length > 0) {
        notify.warn(
          `${response.partialFailures.length} delivery issue${response.partialFailures.length === 1 ? "" : "s"} occurred while sending ${cycleText}.`,
        );
      }
      return response;
    } catch (err) {
      notify.error(
        err,
        `Unable to send ${utilityType === "water" ? "water" : "electricity"} charges for ${roomName}. Please try again.`,
      );
      throw err;
    } finally {
      setSendingByPeriodId((prev) => ({ ...prev, [periodId]: false }));
    }
  };

  const handleSendPeriod = (
    period,
    roomName = getRoomLabel(selectedRoom || {}, "Room"),
  ) => {
    if (!period) return;
    const cycleText = getCycleLabel(period);
    setConfirmModal({
      open: true,
      title: `Send ${utilityType === "water" ? "Water" : "Electricity"} To Tenant`,
      message: `Send the ${utilityType} charge for ${roomName} (${cycleText}) to the tenant side now? This will make the charge visible in the tenant billing view and payment total.`,
      variant: "primary",
      confirmText: "Send Now",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        await sendSinglePeriod({
          periodId: period.id,
          roomName,
          cycleText,
        });
      },
    });
  };

  const handleSendAllReady = () => {
    if (readyRooms.length === 0) return;
    setConfirmModal({
      open: true,
      title: `Send All Ready ${utilityType === "water" ? "Water" : "Electricity"} Charges`,
      message: `Send ${utilityType} charges for ${readyRooms.length} ready room${readyRooms.length === 1 ? "" : "s"} to the tenant side? Each room will be processed one at a time.`,
      variant: "primary",
      confirmText: `Send ${readyRooms.length} Room${readyRooms.length === 1 ? "" : "s"}`,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        setIsSendingAllReady(true);
        let successCount = 0;
        try {
          for (const room of readyRooms) {
            try {
              await sendSinglePeriod({
                periodId: room.latestPeriodId,
                roomName: getRoomLabel(room),
                cycleText: room.billingLabel || "ready cycle",
              });
              successCount += 1;
            } catch {
              // Per-room errors are already surfaced.
            }
          }
          if (successCount > 0) {
            notify.success(
              `Sent ${utilityType} charges for ${successCount} room${successCount === 1 ? "" : "s"}.`,
            );
          }
        } finally {
          setIsSendingAllReady(false);
        }
      },
    });
  };

  const handleSendReminder = async (billId, noticeType = "reminder") => {
    if (!billId) {
      notify.error(new Error("Bill not found."), "Bill not found.");
      return;
    }

    const noticeKey = `${billId}:${noticeType}`;
    setActiveNoticeKey(noticeKey);
    try {
      await billingApi.sendBillReminder(billId, { noticeType });
      notify.success(
        noticeType === "penalty"
          ? "Penalty notice sent successfully."
          : "Reminder sent successfully.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: utilityKeys.all(utilityType) }),
        queryClient.invalidateQueries({ queryKey: ["billing", "branch"] }),
      ]);
    } catch (error) {
      notify.error(
        error,
        noticeType === "penalty"
          ? "Failed to send penalty notice."
          : "Failed to send reminder.",
      );
    } finally {
      setActiveNoticeKey(null);
    }
  };

  const getExportColumns = (type, isSingleRoom = false) => {
    const unit = type === "electricity" ? "kWh" : "cu.m.";
    const formatDateLabel = (dateStr) => {
      if (!dateStr) return "—";
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    const baseColumns = [
      { key: "tenantName", label: "Tenant Name", formatter: (v) => v || "Unassigned" },
      {
        key: "startDate",
        label: "Billing Cycle",
        formatter: (v, r) => {
          if (r.startDate && r.endDate) {
            return `${formatDateLabel(r.startDate)} - ${formatDateLabel(r.endDate)}`;
          }
          return r.durationRange || formatDateLabel(v);
        },
      },
      {
        key: "totalUsage",
        label: `Total Usage (${unit})`,
        formatter: (v, r) => {
          const val = v ?? r.usage;
          return val != null && val !== "" ? `${Number(val).toFixed(2)} ${unit}` : `0.00 ${unit}`;
        },
      },
      {
        key: "billAmount",
        label: "Charge Amount",
        formatter: (v, r) => {
          const val = v ?? r.amount ?? 0;
          return `PHP ${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        },
      },
      {
        key: "billStatus",
        label: "Billing Status",
        formatter: (v, r) => String(v || r.periodStatus || "Draft").toUpperCase(),
      },
    ];

    if (isSingleRoom) {
      return baseColumns;
    }

    return [
      { key: "roomName", label: "Room" },
      { key: "branch", label: "Branch", formatter: (v) => (v ? String(v).toUpperCase() : "—") },
      ...baseColumns,
    ];
  };

  const handleExportRows = async () => {
    try {
      setIsExporting(true);
      const targetRoomId = selectedRoom?._id || selectedRoom?.id || selectedRoomId || undefined;
      const params = { branch: branchFilter || undefined };
      if (targetRoomId) {
        params.roomId = targetRoomId;
      }
      const response = await utilityApi.exportRows(utilityType, params);
      let rows = response?.rows || [];
      if (targetRoomId) {
        rows = rows.filter(
          (r) =>
            String(r.roomId || r.room?._id || r.room?.id || "") === String(targetRoomId),
        );
      }
      if (!rows.length) {
        notify.warn(
          selectedRoom
            ? `No ${utilityType} billing rows found for ${getRoomLabel(selectedRoom)}.`
            : `No ${utilityType} billing rows available for export.`,
        );
        return;
      }

      exportToCSV(
        rows,
        getExportColumns(utilityType, Boolean(selectedRoom)),
        `${utilityType}_billing_${selectedRoom ? (selectedRoom.name || selectedRoom.roomNumber).replace(/\s+/g, "_") : branchFilter || "all"}_${getTodayInput()}`,
      );
      notify.success(
        `Exported ${rows.length} ${utilityType} billing row${rows.length === 1 ? "" : "s"}${selectedRoom ? ` for ${getRoomLabel(selectedRoom)}` : ""}.`,
      );
    } catch (error) {
      notify.error(error, `Failed to export ${utilityType} billing.`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      const targetRoomId = selectedRoom?._id || selectedRoom?.id || selectedRoomId || undefined;
      const params = { branch: branchFilter || undefined };
      if (targetRoomId) {
        params.roomId = targetRoomId;
      }
      const response = await utilityApi.exportRows(utilityType, params);
      let rows = response?.rows || [];
      if (targetRoomId) {
        rows = rows.filter(
          (r) =>
            String(r.roomId || r.room?._id || r.room?.id || "") === String(targetRoomId),
        );
      }
      if (!rows.length) {
        notify.warn(
          selectedRoom
            ? `No ${utilityType} billing rows found for ${getRoomLabel(selectedRoom)}.`
            : `No ${utilityType} billing rows available for PDF export.`,
        );
        return;
      }

      const { exportReportPdf } = await import("../../../../shared/utils/reportPdf.js");

      const totalUsage = rows.reduce(
        (sum, r) => sum + (Number(r.totalUsage ?? r.usage) || 0),
        0,
      );
      const totalCharge = rows.reduce(
        (sum, r) => sum + (Number(r.billAmount ?? r.amount) || 0),
        0,
      );
      const unit = utilityType === "electricity" ? "kWh" : "cu.m.";

      const isSingleRoom = Boolean(selectedRoom);
      const headers = isSingleRoom
        ? ["Cycle / Period", "Tenant", "Usage", "Charge", "Status"]
        : ["Room", "Branch", "Tenant", "Usage", "Charge", "Status"];

      const colWidths = isSingleRoom
        ? [45, 45, 30, 35, 19]
        : [28, 25, 42, 25, 30, 24];

      const tableRows = rows.map((r) => {
        const usageVal = r.totalUsage ?? r.usage;
        const chargeVal = r.billAmount ?? r.amount ?? 0;
        const periodText = r.startDate && r.endDate
          ? `${fmtShortDate(r.startDate)} - ${fmtShortDate(r.endDate)}`
          : r.durationRange || "Cycle";

        if (isSingleRoom) {
          return {
            "Cycle / Period": periodText,
            Tenant: r.tenantName || "Unassigned",
            Usage: `${usageVal != null ? Number(usageVal).toFixed(2) : "0.00"} ${unit}`,
            Charge: `PHP ${Number(chargeVal || 0).toFixed(2)}`,
            Status: String(r.billStatus || r.periodStatus || "Draft").toUpperCase(),
          };
        }

        return {
          Room: r.roomName || getRoomLabel(selectedRoom) || "Room",
          Branch: r.branch ? String(r.branch).toUpperCase() : "—",
          Tenant: r.tenantName || "Unassigned",
          Usage: `${usageVal != null ? Number(usageVal).toFixed(2) : "0.00"} ${unit}`,
          Charge: `PHP ${Number(chargeVal || 0).toFixed(2)}`,
          Status: String(r.billStatus || r.periodStatus || "Draft").toUpperCase(),
        };
      });

      await exportReportPdf({
        title: `${utilityType === "electricity" ? "Electricity" : "Water"} Utility Billing Report`,
        subtitle: selectedRoom
          ? `Room: ${getRoomLabel(selectedRoom)} (${selectedRoom.branch ? selectedRoom.branch.toUpperCase() : ""}) • ${rows.length} Record${rows.length === 1 ? "" : "s"}`
          : `Branch: ${branchFilter ? branchFilter.toUpperCase() : "All Branches"} • ${rows.length} Record${rows.length === 1 ? "" : "s"}`,
        reportType: `${utilityType.toUpperCase()} Billing`,
        filename: `${utilityType}_billing_${selectedRoom ? (selectedRoom.name || selectedRoom.roomNumber).replace(/\s+/g, "_") : branchFilter || "all"}_${getTodayInput()}.pdf`,
        kpis: [
          { label: "Billing Records", value: rows.length },
          {
            label: `Total Usage (${unit})`,
            value: `${totalUsage.toFixed(2)} ${unit}`,
          },
          {
            label: "Total Charges",
            value: `PHP ${totalCharge.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          },
        ],
        sections: [
          {
            title: selectedRoom
              ? `Billing Cycles for ${getRoomLabel(selectedRoom)}`
              : "Billing Cycle Breakdown",
            type: "table",
            headers,
            colWidths,
            rows: tableRows,
          },
        ],
      });

      notify.success(
        `Exported PDF report with ${rows.length} ${utilityType} billing row${rows.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      notify.error(error, `Failed to export ${utilityType} billing PDF.`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTenantBillingCsv = () => {
    const tenantSummaries = selectedMonitoringResult?.tenantSummaries || [];
    if (!tenantSummaries.length) {
      notify.warn("No tenant billing & payment records available to export.");
      return;
    }

    const columns = [
      { key: "tenantName", label: "Tenant Name" },
      { key: "tenantEmail", label: "Tenant Email" },
      {
        key: "totalUsage",
        label: `Usage (${utilityType === "electricity" ? "kWh" : "cu.m."})`,
        formatter: (v) => (v != null ? Number(v).toFixed(2) : "0.00"),
      },
      {
        key: "billAmount",
        label: "Bill Amount (PHP)",
        formatter: (v) => (v != null ? Number(v).toFixed(2) : "0.00"),
      },
      {
        key: "balance",
        label: "Balance (PHP)",
        formatter: (v) => (v != null ? Number(v).toFixed(2) : "0.00"),
      },
      { key: "billStatus", label: "Status" },
      {
        key: "dueDate",
        label: "Due Date",
        formatter: (v) => (v ? fmtDate(v) : "—"),
      },
      {
        key: "paymentMethod",
        label: "Payment Method",
        formatter: (v, r) =>
          resolvePaymentDetails(r.bill, r.latestPayment).paymentMethod,
      },
      {
        key: "paymentRecordedAt",
        label: "Paid / Processed Date",
        formatter: (v, r) =>
          resolvePaymentDetails(r.bill, r.latestPayment).paymentRecordedAt || "—",
      },
    ];

    exportToCSV(
      tenantSummaries,
      columns,
      `tenant_billing_payments_${selectedRoom ? (selectedRoom.name || selectedRoom.roomNumber).replace(/\s+/g, "_") : "room"}_${getTodayInput()}`,
    );
    notify.success(
      `Exported ${tenantSummaries.length} tenant payment record${tenantSummaries.length === 1 ? "" : "s"}.`,
    );
  };

  const handleExportTenantBillingPdf = async () => {
    const tenantSummaries = selectedMonitoringResult?.tenantSummaries || [];
    if (!tenantSummaries.length) {
      notify.warn("No tenant billing & payment records available to export.");
      return;
    }

    try {
      const { exportReportPdf } = await import("../../../../shared/utils/reportPdf.js");

      const totalBill = tenantSummaries.reduce(
        (s, t) => s + Number(t.billAmount || 0),
        0,
      );
      const totalBalance = tenantSummaries.reduce(
        (s, t) => s + Number(t.balance || 0),
        0,
      );
      const unit = utilityType === "electricity" ? "kWh" : "cu.m.";

      const headers = ["Tenant", "Usage", "Bill Amount", "Balance", "Status", "Method"];
      const tableRows = tenantSummaries.map((t) => {
        const paymentDetails = resolvePaymentDetails(t.bill, t.latestPayment);
        return {
          Tenant: t.tenantName || "Unassigned",
          Usage: `${Number(t.totalUsage || 0).toFixed(2)} ${unit}`,
          "Bill Amount": `PHP ${Number(t.billAmount || 0).toFixed(2)}`,
          Balance: `PHP ${Number(t.balance || 0).toFixed(2)}`,
          Status: String(t.billStatus || "Pending").toUpperCase(),
          Method: paymentDetails.paymentMethod || "—",
        };
      });

      await exportReportPdf({
        title: "Tenant Billing & Payment Monitoring Report",
        subtitle: `Room: ${getRoomLabel(selectedRoom)} • Cycle: ${selectedPeriodFromList ? getCycleLabel(selectedPeriodFromList) : "Active Period"}`,
        reportType: "Billing & Payments",
        filename: `tenant_payments_${selectedRoom ? (selectedRoom.name || selectedRoom.roomNumber).replace(/\s+/g, "_") : "room"}_${getTodayInput()}.pdf`,
        kpis: [
          { label: "Covered Tenants", value: tenantSummaries.length },
          { label: "Total Billed", value: `PHP ${totalBill.toFixed(2)}` },
          { label: "Total Outstanding Balance", value: `PHP ${totalBalance.toFixed(2)}` },
        ],
        sections: [
          {
            title: "Tenant Payments Breakdown",
            type: "table",
            headers,
            colWidths: [45, 25, 30, 30, 24, 20],
            rows: tableRows,
          },
        ],
      });

      notify.success(
        `Exported PDF for ${tenantSummaries.length} tenant payment record${tenantSummaries.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      notify.error(err, "Failed to export tenant billing PDF.");
    }
  };

  const handleExportTimelineCsv = () => {
    if (!billingTimelineRows.length) {
      notify.warn("No timeline events to export.");
      return;
    }
    handleExportTimeline();
  };

  const handleExportTimelinePdf = async () => {
    if (!billingTimelineRows.length) {
      notify.warn("No timeline events to export.");
      return;
    }

    try {
      const { exportReportPdf } = await import("../../../../shared/utils/reportPdf.js");

      const headers = ["Date", "Event", "Type", "Status", "Tenant / Subject"];
      const tableRows = billingTimelineRows.map((row) => ({
        Date: fmtDate(row.date),
        Event: getEventTypeLabel(row.eventType),
        Type: getTimelineRecordLabel(row),
        Status: getTimelineStatusLabel(row),
        "Tenant / Subject": isMoveLifecycleEvent(row.eventType)
          ? row.tenantName || EMPTY_VALUE
          : "Entire Room",
      }));

      await exportReportPdf({
        title: "Utility Billing Timeline Report",
        subtitle: `Room: ${getRoomLabel(selectedRoom)} • ${billingTimelineRows.length} Events Logged`,
        reportType: "Billing Timeline",
        filename: `billing_timeline_${selectedRoom ? (selectedRoom.name || selectedRoom.roomNumber).replace(/\s+/g, "_") : "room"}_${getTodayInput()}.pdf`,
        kpis: [
          { label: "Total Events", value: billingTimelineRows.length },
          { label: "Target Room", value: getRoomLabel(selectedRoom) || "—" },
          { label: "Active Utility", value: utilityType.toUpperCase() },
        ],
        sections: [
          {
            title: "Timeline Activity Log",
            type: "table",
            headers,
            colWidths: [30, 45, 30, 30, 39],
            rows: tableRows,
          },
        ],
      });

      notify.success(
        `Exported PDF for ${billingTimelineRows.length} timeline event${billingTimelineRows.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      notify.error(err, "Failed to export timeline PDF.");
    }
  };

  const exportLocalRows = ({ rows, columns, filename, emptyMessage }) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      notify.warn(emptyMessage);
      return;
    }

    exportToCSV(rows, columns, filename);
  };

  const handleExportTimeline = () => {
    const rows = billingTimelineRows.map((row) => ({
      date: fmtDate(row.date),
      event: getEventTypeLabel(row.eventType),
      recordType: getTimelineRecordLabel(row),
      status: getTimelineStatusLabel(row),
      tenant: isMoveLifecycleEvent(row.eventType)
        ? row.tenantName || EMPTY_VALUE
        : "Entire Room",
      tenantEmail: isMoveLifecycleEvent(row.eventType)
        ? row.tenantEmail || EMPTY_VALUE
        : EMPTY_VALUE,
      bed: isMoveLifecycleEvent(row.eventType)
        ? row.bedName || EMPTY_VALUE
        : "Entire Room",
      reading:
        row.reading != null
          ? `${fmtNumber(row.reading, 2)} ${utilityType === "electricity" ? "kWh" : "cu.m."}`
          : EMPTY_VALUE,
    }));

    exportLocalRows({
      rows,
      columns: TIMELINE_EXPORT_COLUMNS,
      filename: `${utilityType}-billing-timeline-${selectedRoom ? getRoomLabel(selectedRoom).replace(/\s+/g, "-").toLowerCase() : "room"}`,
      emptyMessage: `No ${utilityType} timeline rows available for export.`,
    });
  };

  const handleExportPeriodHistory = () => {
    const rows = periods.map((period) => ({
      cycle: getCycleLabel(period),
      basis: getMeterRangeLabel(period, utilityType),
      rate: fmtCurrency(period.ratePerUnit),
      status: getDisplayStatusLabel(period),
    }));

    exportLocalRows({
      rows,
      columns: PERIOD_HISTORY_EXPORT_COLUMNS,
      filename: `${utilityType}-billing-history-${selectedRoom ? getRoomLabel(selectedRoom).replace(/\s+/g, "-").toLowerCase() : "room"}`,
      emptyMessage: `No ${utilityType} billing history rows available for export.`,
    });
  };

  const handleExportTenantSummary = (period, currentResult) => {
    const rows = (currentResult?.tenantSummaries || []).map((tenant) => ({
      tenantName: tenant.tenantName || EMPTY_VALUE,
      tenantEmail: tenant.tenantEmail || EMPTY_VALUE,
      durationRange: tenant.durationRange || "Ongoing",
      totalUsage: fmtNumber(tenant.totalUsage, 4),
      billAmount: fmtCurrency(tenant.billAmount),
    }));

    exportLocalRows({
      rows,
      columns: TENANT_SUMMARY_EXPORT_COLUMNS,
      filename: `${utilityType}-tenant-summary-${period?.id || "period"}`,
      emptyMessage: `No ${utilityType} tenant summary rows available for export.`,
    });
  };

  const handleExportUtilityStatementPDF = async (period, currentResult) => {
    try {
      const { generateUtilityStatementPDF } = await import("../../../../shared/utils/receiptGenerator.js");
      await generateUtilityStatementPDF({
        utilityType,
        branch: selectedRoom?.branch || branchFilter || user?.branch || "",
        roomName: selectedRoom ? getRoomLabel(selectedRoom) : "Room",
        startDate: period?.startDate,
        endDate: period?.endDate,
        startReading: period?.startReading ?? 0,
        endReading: period?.endReading ?? 0,
        kwhUsage: (period?.endReading ?? 0) - (period?.startReading ?? 0),
        ratePerUnit: period?.ratePerUnit ?? 0,
        totalCost: currentResult?.totalRoomCharge || currentResult?.computedTotalCost || 0,
        tenantSplits: (currentResult?.tenantSummaries || []).map((t) => ({
          name: t.tenantName,
          bed: t.bedName || "Bed",
          shareAmount: t.billAmount,
          isProRata: Boolean(t.isProRata),
          daysInCycle: t.daysInCycle,
        })),
      });
      notify.success("Utility statement PDF exported.");
    } catch (err) {
      console.error("PDF Export failed:", err);
      notify.error(err, "Failed to export PDF statement.");
    }
  };

  const effectiveBranch = isOwner ? branchFilter : (user?.branch || "");
  const isGuadaUtility =
    (utilityType === "electricity" || utilityType === "water") &&
    effectiveBranch === "guadalupe";

  if (isGuadaUtility) {
    return null;
  }

  return (
    <section
      className="space-y-4"
      aria-label={`${utilityType} billing workspace`}
    >
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] items-start">
        <aside className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-black dark:text-white">
              <Search size={13} className="shrink-0 text-black dark:text-white" />
              Room Selection
            </span>
            <span className="text-xs text-muted-foreground">
              {filteredRooms.length} rooms
            </span>
          </div>

          <div>
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none"
              style={{ outlineColor: "var(--ring)" }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--ring)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.boxShadow = "";
              }}
              placeholder="Search by room name or number..."
              value={sidebarSearch}
              onChange={(e) => {
                setSidebarSearch(e.target.value);
                setRoomsPage(1);
              }}
              aria-label="Search rooms"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Filter by floor level"
              className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground focus:border-amber-400 focus:outline-none dark:bg-muted"
              value={floorFilter}
              onChange={(e) => {
                setFloorFilter(e.target.value);
                setRoomsPage(1);
              }}
            >
              <option value="all">All Floors</option>
              {availableFloors.map((fl) => (
                <option key={fl} value={fl}>
                  Floor {fl}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by occupancy status"
              className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground focus:border-amber-400 focus:outline-none dark:bg-muted"
              value={roomStatusFilter}
              onChange={(e) => {
                setRoomStatusFilter(e.target.value);
                setRoomsPage(1);
              }}
            >
              <option value="all">All Status</option>
              <option value="occupied">Occupied</option>
              <option value="vacant">Vacant</option>
            </select>
          </div>

          <div className="h-[570px] min-h-[570px] max-h-[570px] space-y-2 pt-1 overflow-y-auto pr-1">
            {roomsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div
                    key={i}
                    className="h-[50px] w-full animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                {sidebarSearch
                  ? "No rooms match your search"
                  : "No rooms found"}
              </div>
            ) : (
              pagedRooms.map((room) => {
                const statusTone = getHistoryStatusClasses(
                  room.billingState || "no_active_cycle",
                );
                const isSelected = selectedRoomId === room.id;
                return (
                  <button
                    key={room.id}
                    className="w-full rounded-lg border px-3 py-2 text-left transition shrink-0 focus:outline-none focus-visible:outline-none"
                    style={
                      isSelected
                        ? {
                            borderColor: "var(--primary)",
                            background:
                              "color-mix(in srgb, var(--primary) 10%, var(--card))",
                            boxShadow: "none",
                            outline: "none",
                          }
                        : {
                            borderColor: "var(--border)",
                            boxShadow: "none",
                            outline: "none",
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "var(--muted)";
                        e.currentTarget.style.borderColor = "var(--border)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "";
                        e.currentTarget.style.borderColor = "";
                      }
                    }}
                    aria-pressed={isSelected}
                    aria-label={`Select ${getRoomLabel(room)} room`}
                    onClick={() => {
                      setSelectedRoomId(room.id);
                      setPeriodsPage(1);
                      setTimelinePage(1);
                      closePanel();
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-card-foreground">
                        {getRoomLabel(room)}
                      </span>
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background: room.hasActiveTenants
                            ? "var(--success)"
                            : "var(--neutral)",
                        }}
                        title={
                          room.hasActiveTenants
                            ? "Has active tenants"
                            : "No tenants"
                        }
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone}`}
                      >
                        {getRoomBadgeLabel(room)}
                      </span>
                      {room.latestReading != null && (
                        <span className="text-[11px] text-muted-foreground">
                          {room.latestReading}{" "}
                          {utilityType === "electricity" ? "kWh" : "cu.m."}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-border/40">
            <Pagination
              page={roomsPage}
              total={totalRoomPages}
              onChange={setRoomsPage}
              countLabel={`${filteredRooms.length} room${filteredRooms.length !== 1 ? "s" : ""}`}
            />
          </div>
        </aside>

        <div className="flex flex-col h-full space-y-4">
          {!selectedRoomId ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-8 text-center">
              <Zap size={36} strokeWidth={1.5} className="text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-card-foreground">
                Select a room to continue
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a room on the left to manage{" "}
                {utilityType === "water" ? "water" : "electricity"} cycles,
                readings, and sending.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-[14px] border border-border bg-card px-5 py-4 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary
"
                  >
                    <Calendar size={16} strokeWidth={2} />
                  </span>
                  <h3
                    className="text-[15px] font-semibold leading-none text-card-foreground
"
                  >
                    {getRoomLabel(selectedRoom)}
                  </h3>
                </div>

                {currentPeriod ? (
                  <>
                    <div className="mt-7 grid gap-10 md:grid-cols-2">
                      <div>
                        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Current Cycle
                        </p>
                        <p
                          className="mt-2 text-[28px] font-medium leading-none tracking-[-0.04em] text-card-foreground
"
                        >
                          {getCycleLabel(currentPeriod)}
                        </p>
                        <p className="mt-2 text-[14px] font-normal text-muted-foreground">
                          {fmtDate(currentPeriod.startDate)} -{" "}
                          {fmtDate(
                            currentPeriod.endDate ||
                              currentPeriod.targetCloseDate,
                          ) || "Ongoing"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Rate
                        </p>
                        <p
                          className="mt-2 text-[28px] font-medium leading-none tracking-[-0.04em] text-card-foreground
"
                        >
                          {currentPeriodCost != null
                            ? fmtCurrency(currentPeriodCost)
                            : EMPTY_VALUE}
                        </p>
                        <p className="mt-2 text-[14px] font-normal text-muted-foreground">
                          Rate: {fmtCurrency(currentPeriod.ratePerUnit)} /
                          {utilityType === "electricity" ? "kWh" : "cu.m."} |{" "}
                          {currentPeriodUsage != null
                            ? `${fmtNumber(currentPeriodUsage, 2)} ${utilityType === "electricity" ? "kWh" : "cu.m."}`
                            : EMPTY_VALUE}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-border pt-6">
                      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Consumption
                      </p>
                      <p
                        className="mt-3 text-[30px] font-medium leading-none tracking-[-0.04em] text-primary
"
                      >
                        {currentPeriodUsage != null
                          ? fmtNumber(currentPeriodUsage, 2)
                          : EMPTY_VALUE}{" "}
                        {utilityType === "electricity" ? "kWh" : "cu.m."}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 flex flex-col items-center justify-center gap-1.5 px-4 py-6 text-center">
                    <FileX size={28} style={{ color: "var(--neutral)" }} />
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--neutral)" }}
                    >
                      No billing cycle yet.
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--neutral-dark)" }}
                    >
                      Use New Billing Period to create your first cycle.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          <section className="rounded-xl border border-border bg-card p-4 flex-1 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-black dark:text-white">
                  <History size={13} className="shrink-0 text-black dark:text-white" />
                  Billing Cycle History
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Closed and revised periods remain available for review, sending,
                  and revision actions.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                    }}
                    onClick={() => setIsNewPeriodModalOpen(true)}
                  >
                    <Plus size={12} /> New Billing Period
                  </button>
                <ExportButtons
                  onCsv={handleExportRows}
                  onPdf={handleExportPdf}
                  loading={isExporting}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
              {/* Status filter */}
              <select
                value={periodStatusFilter}
                onChange={(e) => {
                  setPeriodStatusFilter(e.target.value);
                  setPeriodsPage(1);
                }}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground focus:outline-none appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' width%3D'16' height%3D'16' viewBox%3D'0 0 24 24' fill%3D'none' stroke%3D'%231e293b' stroke-width%3D'2' stroke-linecap%3D'round' stroke-linejoin%3D'round'%3E%3Cpolyline points%3D'6 9 12 15 18 9'%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 10px center",
                  backgroundSize: "14px 14px",
                  paddingRight: "32px",
                }}
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
              </select>

              {/* Start date */}
              <input
                type="date"
                value={periodStartDate}
                onChange={(e) => {
                  setPeriodStartDate(e.target.value);
                  setPeriodsPage(1);
                }}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground focus:outline-none"
                style={{ outlineColor: "var(--ring)" }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--ring)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "";
                  e.currentTarget.style.boxShadow = "";
                }}
              />

              {/* End date */}
              <input
                type="date"
                value={periodEndDate}
                onChange={(e) => {
                  setPeriodEndDate(e.target.value);
                  setPeriodsPage(1);
                }}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground focus:outline-none"
                style={{ outlineColor: "var(--ring)" }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--ring)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "";
                  e.currentTarget.style.boxShadow = "";
                }}
              />

              {/* Cycle search */}
              <input
                type="text"
                value={periodSearch}
                onChange={(e) => {
                  setPeriodSearch(e.target.value);
                  setPeriodsPage(1);
                }}
                placeholder="Search by cycle..."
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none"
                style={{ outlineColor: "var(--ring)" }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--ring)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "";
                  e.currentTarget.style.boxShadow = "";
                }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {filteredPeriods.length} of {periods.length} billing cycles
              </p>
              {(periodStatusFilter ||
                periodStartDate ||
                periodEndDate ||
                periodSearch) && (
                <button
                  type="button"
                  className="text-xs font-medium transition-colors"
                  style={{ color: "var(--neutral)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--foreground)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--neutral)")
                  }
                  onClick={() => {
                    setPeriodStatusFilter("");
                    setPeriodStartDate("");
                    setPeriodEndDate("");
                    setPeriodSearch("");
                    setPeriodsPage(1);
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="mt-3 flex-1 flex flex-col space-y-2">
              {filteredPeriods.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center min-h-[220px]">
                  <ClipboardX size={28} style={{ color: "var(--neutral)" }} />
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--neutral)" }}
                  >
                    {periods.length === 0
                      ? "No billing history yet."
                      : "No cycles match your filters."}
                  </p>
                  <p className="text-xs" style={{ color: "var(--neutral-dark)" }}>
                    {periods.length === 0
                      ? "Closed and revised periods will appear here once created."
                      : "Try adjusting your filters or clearing them."}
                  </p>
                </div>
              ) : (
                pagedPeriods.map((p) => {
                  const status = getDisplayStatus(p);
                  const canOpenHistory =
                    p.status === "closed" || p.status === "revised";
                  const isSelectedPeriod = selectedPeriodId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                        isSelectedPeriod
                          ? "border-amber-300 bg-amber-50/40"
                          : "border-border bg-card"
                      }`}
                      onClick={() => selectAndFocusPeriod(p.id)}
                      title="Click to monitor this billing cycle"
                    >
                      <div>
                        <p className="text-sm font-semibold text-card-foreground">
                          {getCycleLabel(p)}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {getMeterRangeLabel(p, utilityType)}
                          {utilityType !== "water" && (
                            <DeltaChip
                              start={p.startReading}
                              end={p.endReading}
                              unit={utilityType === "electricity" ? "kWh" : "cu.m."}
                            />
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {fmtCurrency(p.ratePerUnit)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${getHistoryStatusClasses(status)}`}
                        >
                          {getDisplayStatusIcon(status)}
                          {getDisplayStatusLabel(p)}
                        </span>
                        {p.revised ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              background:
                                "color-mix(in srgb, var(--warning) 12%, var(--card))",
                              color: "var(--warning-dark)",
                            }}
                          >
                            Edited
                          </span>
                        ) : null}
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {getDisplayStatus(p) === "ready_to_send" && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                              style={{
                                background: "var(--primary)",
                                color: "var(--primary-foreground)",
                              }}
                              onClick={() =>
                                handleSendPeriod(
                                  p,
                                  getRoomLabel(selectedRoom || {}, "Room"),
                                )
                              }
                              disabled={
                                Boolean(sendingByPeriodId[p.id]) ||
                                sendPeriod.isPending
                              }
                            >
                              <Send size={11} />
                              {sendingByPeriodId[p.id] ? "Sending..." : "Send"}
                            </button>
                          )}
                          {canEditPeriod(p) && (
                            <button
                              type="button"
                              className="rounded-md border border-border p-1 text-muted-foreground hover:bg-muted"
                              onClick={() => handleOpenEditPeriod(p)}
                              aria-label="Edit period"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {canDeletePeriod(p) && (
                            <button
                              type="button"
                              className="rounded-md border border-border p-1 hover:bg-muted"
                              style={{ color: "var(--danger)" }}
                              onClick={() => handleDeletePeriod(p.id)}
                              aria-label="Delete period"
                              disabled={deletePeriod.isPending}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          {canOpenHistory && (
                            <button
                              type="button"
                              className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
                              onClick={() => openHistoryModal(p.id)}
                            >
                              View
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-auto pt-2 border-t border-border/40">
              <Pagination
                page={periodsPage}
                total={totalPeriodPages}
                onChange={setPeriodsPage}
                countLabel={`${filteredPeriods.length} of ${periods.length} period${periods.length !== 1 ? "s" : ""}`}
              />
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-900 dark:text-slate-100">
              <Check size={13} className="shrink-0 text-slate-900 dark:text-slate-100" />
              Tenant Billing & Payments
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Payment monitoring stays attached to the selected room and billing cycle.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {selectedPeriodFromList && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-card-foreground shadow-xs">
                  <Calendar size={13} className="text-slate-500 shrink-0" />
                  {getCycleLabel(selectedPeriodFromList)}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getHistoryStatusClasses(getDisplayStatus(selectedPeriodFromList))}`}>
                  {getDisplayStatusIcon(getDisplayStatus(selectedPeriodFromList))}
                  {getDisplayStatusLabel(selectedPeriodFromList)}
                </span>
              </div>
            )}
            <ExportButtons
              onCsv={handleExportTenantBillingCsv}
              onPdf={handleExportTenantBillingPdf}
              disabled={!selectedMonitoringResult || (selectedMonitoringResult.tenantSummaries || []).length === 0}
            />
          </div>
        </div>

        {!selectedPeriodFromList ? (
          <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Select a billing cycle to review tenant bill and payment details.
          </div>
        ) : !selectedMonitoringResult ? (
          <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Tenant bill and payment details appear after this cycle is closed or revised.
          </div>
        ) : (selectedMonitoringResult.tenantSummaries || []).length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No covered tenants were found for this billing cycle.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto pb-1">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">
                  <th className="w-[22%] py-3 pr-4">Tenant</th>
                  <th className="w-[11%] py-3 pr-4">Usage</th>
                  <th className="w-[12%] py-3 pr-4">Bill Amount</th>
                  <th className="w-[12%] py-3 pr-4">Balance</th>
                  <th className="w-[11%] py-3 pr-4">Status</th>
                  <th className="w-[10%] py-3 pr-4">Due Date</th>
                  <th className="w-[11%] py-3 pr-4">Payment Method</th>
                  <th className="w-[11%] py-3 pr-4">Paid / Processed</th>
                  <th className="w-[10%] py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(selectedMonitoringResult.tenantSummaries || []).map((tenant, index) => (
                  <tr key={`${selectedPeriodFromList.id}-monitor-${index}`} className="group transition-colors hover:bg-muted/30">
                    <td className="w-[22%] py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold shadow-xs dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                          {getInitials(tenant.tenantName)}
                        </div>
                        <div>
                          <p className="font-bold text-card-foreground text-xs">
                            {tenant.tenantName || EMPTY_VALUE}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {tenant.tenantEmail || EMPTY_VALUE}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="w-[11%] py-3 pr-4 text-xs font-semibold text-card-foreground">
                      {fmtNumber(tenant.totalUsage, 2)} <span className="text-[10px] font-bold text-muted-foreground uppercase">{utilityType === "electricity" ? "kWh" : "cu.m."}</span>
                    </td>
                    <td className="w-[12%] py-3 pr-4 font-bold text-card-foreground text-xs">
                      <span className="inline-flex items-center gap-1">
                        {fmtCurrency(tenant.billAmount)}
                        {(tenant.isProRata || tenant.daysInCycle != null) && (
                          <span className="prorata-tooltip-anchor" aria-label="Pro-rata breakdown">
                            ⓘ
                            <span className="prorata-tooltip">
                              <p className="prorata-tooltip__title">Pro-Rata Breakdown</p>
                              <div className="prorata-tooltip__row">
                                <span className="prorata-tooltip__label">Active Days</span>
                                <span className="prorata-tooltip__value">
                                  {tenant.daysInCycle ?? "–"} days
                                </span>
                              </div>
                              {tenant.durationRange && (
                                <div className="prorata-tooltip__row">
                                  <span className="prorata-tooltip__label">Period</span>
                                  <span className="prorata-tooltip__value">{tenant.durationRange}</span>
                                </div>
                              )}
                              <div className="prorata-tooltip__row">
                                <span className="prorata-tooltip__label">Usage Share</span>
                                <span className="prorata-tooltip__value">
                                  {fmtNumber(tenant.totalUsage, 2)}{" "}
                                  {utilityType === "electricity" ? "kWh" : "cu.m."}
                                </span>
                              </div>
                              <div className="prorata-tooltip__row">
                                <span className="prorata-tooltip__label">Charge</span>
                                <span className="prorata-tooltip__value">{fmtCurrency(tenant.billAmount)}</span>
                              </div>
                            </span>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="w-[12%] py-3 pr-4 font-bold text-xs text-card-foreground">
                      {fmtCurrency(tenant.remainingAmount)}
                    </td>
                    <td className="w-[11%] py-3 pr-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            tenant.billStatus === "paid"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : tenant.daysOverdue > 0 || tenant.billStatus === "overdue"
                                ? "bg-red-50 text-red-800 border-red-200"
                                : tenant.billStatus === "partially-paid"
                                  ? "bg-amber-50 text-amber-900 border-amber-200"
                                  : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          {getDisplayStatusIcon(tenant.billStatus)}
                          {tenant.billStatus
                            ? String(tenant.billStatus).replace(/-/g, " ")
                            : "ready"}
                        </span>
                        {tenant.daysOverdue > 0 ? (
                          <div className="text-[10px] font-bold text-red-600">
                            {tenant.daysOverdue} day{tenant.daysOverdue === 1 ? "" : "s"} overdue
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="w-[10%] py-3 pr-4 text-xs font-medium text-muted-foreground">
                      {tenant.dueDate ? fmtShortDate(tenant.dueDate) : EMPTY_VALUE}
                    </td>
                    <td className="w-[11%] py-3 pr-4 text-xs font-medium text-muted-foreground">
                      {tenant.paymentFallbackLabel || formatPaymentMethodLabel(tenant.paymentMethod)}
                    </td>
                    <td className="w-[11%] py-3 pr-4 text-xs font-medium text-muted-foreground">
                      {formatDateTime(tenant.paymentRecordedAt)}
                    </td>
                    <td className="w-[10%] py-3 text-right">
                      {tenant.billId && (tenant.canSendPenaltyNotice || tenant.canSendReminder) ? (
                        <button
                          type="button"
                          className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold shadow-xs transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
                            tenant.canSendPenaltyNotice
                              ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                              : "border-border bg-card text-card-foreground hover:bg-muted"
                          }`}
                          onClick={() => handleSendReminder(tenant.billId, tenant.canSendPenaltyNotice ? "penalty" : tenant.daysOverdue > 0 ? "overdue" : "reminder")}
                          disabled={activeNoticeKey?.startsWith(`${tenant.billId}:`)}
                          title={tenant.canSendPenaltyNotice ? (tenant.penaltyReason || "Send penalty notice") : "Send payment reminder to tenant"}
                        >
                          {activeNoticeKey?.startsWith(`${tenant.billId}:`) ? (
                            <LoaderCircle size={12} className="animate-spin" />
                          ) : (
                            <Send size={12} className={tenant.canSendPenaltyNotice ? "text-red-600" : "text-slate-600 dark:text-slate-400"} />
                          )}
                          {tenant.canSendPenaltyNotice
                            ? "Penalty Notice"
                            : tenant.daysOverdue > 0
                              ? "Overdue Notice"
                              : "Remind"}
                        </button>
                      ) : (
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          tenant.billStatus === "paid" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-blue-50 text-blue-800 border border-blue-200"
                        }`} title={tenant.billStatus === "paid" ? "Statement fully settled" : "Bill statement ready for tenant review"}>
                          {tenant.billStatus === "paid" ? "Paid" : "Statement Ready"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* Edit Reading Modal */}
      {editReadingModal.open && (() => {
        const baselineReading = editReadingModal.reading?.previousReading ?? currentPeriod?.startReading ?? null;
        const inputVal = Number(editReadingForm.reading);
        const hasInput = editReadingForm.reading !== "" && !isNaN(inputVal);
        const delta = baselineReading !== null && hasInput ? inputVal - baselineReading : null;
        const isBelowBaseline = delta !== null && delta < 0;

        return (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
            style={{
              background:
                "color-mix(in srgb, var(--background) 60%, transparent)",
            }}
            onClick={() => setEditReadingModal({ open: false, reading: null })}
          >
            <div
              className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <span className="text-sm font-semibold text-foreground">
                  Manage Meter Reading
                </span>
                <button
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-card-foreground"
                  onClick={() =>
                    setEditReadingModal({ open: false, reading: null })
                  }
                >
                  <X size={15} />
                </button>
              </div>
              <div className="px-5 py-4">
                {baselineReading !== null && (
                  <div
                    className="mb-3 rounded-lg border p-3 text-xs"
                    style={{
                      borderColor: isBelowBaseline ? "var(--danger-border, #fca5a5)" : "var(--border)",
                      background: isBelowBaseline ? "color-mix(in srgb, var(--danger, #ef4444) 8%, var(--card))" : "var(--muted)",
                    }}
                  >
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Baseline Reading: <strong className="text-foreground">{fmtNumber(baselineReading, 2)} {utilityType === "electricity" ? "kWh" : "cu.m."}</strong></span>
                      {delta !== null && (
                        <span className={`font-bold ${isBelowBaseline ? "text-danger-dark" : "text-success-dark"}`}>
                          {isBelowBaseline ? `Invalid: ${delta.toFixed(2)}` : `Usage Delta: +${delta.toFixed(2)} ${utilityType === "electricity" ? "kWh" : "cu.m."}`}
                        </span>
                      )}
                    </div>
                    {isBelowBaseline && (
                      <p className="mt-1 font-semibold text-danger-dark">
                        ⚠ New reading cannot be lower than the baseline reading ({fmtNumber(baselineReading, 2)}).
                      </p>
                    )}
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Reading ({utilityType === "electricity" ? "kWh" : "cu.m."})
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm text-card-foreground focus:outline-none"
                      style={{ outlineColor: "var(--ring)" }}
                      value={editReadingForm.reading}
                      onChange={(e) =>
                        setEditReadingForm({
                          ...editReadingForm,
                          reading: e.target.value,
                        })
                      }
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Date
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm text-card-foreground focus:outline-none"
                      style={{ outlineColor: "var(--ring)" }}
                      value={editReadingForm.date}
                      onChange={(e) =>
                        setEditReadingForm({
                          ...editReadingForm,
                          date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Event
                    </label>
                    <select
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm text-card-foreground focus:outline-none"
                      style={{ outlineColor: "var(--ring)" }}
                      value={editReadingForm.eventType}
                      onChange={(e) =>
                        setEditReadingForm({
                          ...editReadingForm,
                          eventType: e.target.value,
                        })
                      }
                    >
                      <option value="regularBilling">Regular Reading</option>
                      <option value="moveIn">Move-In</option>
                      <option value="moveOut">Move-Out</option>
                      <option value="manualAdjustment">Manual Adjustment</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
                <button
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                  onClick={handleSaveEditReading}
                  disabled={updateReading.isPending || isBelowBaseline}
                >
                  <Check size={13} />{" "}
                  {updateReading.isPending ? "Saving..." : "Save Changes"}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
                  style={{
                    borderColor: "var(--danger)",
                    color: "var(--danger-dark)",
                  }}
                  onClick={() => {
                    if (!editReadingModal.reading?.id) return;
                    setEditReadingModal({ open: false, reading: null });
                    handleDeleteReading(editReadingModal.reading.id);
                  }}
                  disabled={updateReading.isPending}
                >
                  <Trash2 size={13} /> Delete Reading
                </button>
                <button
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
                  onClick={() =>
                    setEditReadingModal({ open: false, reading: null })
                  }
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {editPeriodModal.open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{
            background:
              "color-mix(in srgb, var(--background) 60%, transparent)",
          }}
          onClick={() => setEditPeriodModal({ open: false, periodId: null })}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="text-sm font-semibold text-foreground">
                Edit Billing Period
              </span>
              <button
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-card-foreground"
                onClick={() =>
                  setEditPeriodModal({ open: false, periodId: null })
                }
              >
                <X size={15} />
              </button>
            </div>
            <div className="grid gap-3 px-5 py-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Cycle Start
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-card-foreground focus:outline-none"
                  style={{ outlineColor: "var(--ring)" }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--ring)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "";
                    e.currentTarget.style.boxShadow = "";
                  }}
                  value={editPeriodForm.startDate}
                  onChange={(e) =>
                    setEditPeriodForm((current) => ({
                      ...current,
                      startDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Cycle End
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-card-foreground focus:outline-none"
                  style={{ outlineColor: "var(--ring)" }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--ring)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "";
                    e.currentTarget.style.boxShadow = "";
                  }}
                  value={editPeriodForm.endDate}
                  onChange={(e) =>
                    setEditPeriodForm((current) => ({
                      ...current,
                      endDate: e.target.value,
                    }))
                  }
                />
              </div>
              {utilityType === "electricity" && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Start Meter Reading
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm text-card-foreground focus:outline-none"
                      style={{ outlineColor: "var(--ring)" }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "var(--ring)";
                        e.currentTarget.style.boxShadow =
                          "0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "";
                        e.currentTarget.style.boxShadow = "";
                      }}
                      value={editPeriodForm.startReading}
                      onChange={(e) =>
                        setEditPeriodForm((current) => ({
                          ...current,
                          startReading: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      End Meter Reading
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm text-card-foreground focus:outline-none"
                      style={{ outlineColor: "var(--ring)" }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "var(--ring)";
                        e.currentTarget.style.boxShadow =
                          "0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "";
                        e.currentTarget.style.boxShadow = "";
                      }}
                      value={editPeriodForm.endReading}
                      onChange={(e) =>
                        setEditPeriodForm((current) => ({
                          ...current,
                          endReading: e.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              )}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-card-foreground focus:outline-none"
                  style={{ outlineColor: "var(--ring)" }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--ring)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "";
                    e.currentTarget.style.boxShadow = "";
                  }}
                  value={editPeriodForm.ratePerUnit}
                  onChange={(e) =>
                    setEditPeriodForm((current) => ({
                      ...current,
                      ratePerUnit: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
              <button
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
                onClick={handleSaveEditPeriod}
                disabled={updatePeriod.isPending}
              >
                <Save size={13} />{" "}
                {updatePeriod.isPending ? "Saving..." : "Save Changes"}
              </button>
              <button
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
                onClick={() =>
                  setEditPeriodModal({ open: false, periodId: null })
                }
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="lg:col-span-2 flex max-h-[600px] flex-col rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-black dark:text-white">
              <Clock3 size={12} className="shrink-0" />
              Billing Timeline
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest meter and occupancy events for the active/latest billing
              period.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {billingTimelineRows.length} events
            </span>
            <ExportButtons
              onCsv={handleExportTimelineCsv}
              onPdf={handleExportTimelinePdf}
              disabled={billingTimelineRows.length === 0}
            />
          </div>
        </div>

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {pagedTimelineRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              No timeline events found for this billing period.
            </div>
          ) : (
            pagedTimelineRows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border/60 px-3 py-3"
              >
                <div className="flex min-w-[220px] flex-1 gap-3">
                  <span
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${getTimelineDotClasses(
                      row.eventType,
                    )}`}
                  />
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      {getEventTypeLabel(row.eventType)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {row.source !== "meter" && (
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {getTimelineRecordLabel(row)}
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        {getTimelineStatusLabel(row)}
                      </span>
                      <span className="text-muted-foreground">
                        {!isMoveLifecycleEvent(row.eventType) ? (
                          "Entire Room"
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                            <button
                              type="button"
                              onClick={() => toggleUnmaskRow(row.id)}
                              className="inline-flex shrink-0 items-center text-muted-foreground transition-colors hover:text-card-foreground"
                              title={unmaskedRows[row.id] ? "Hide email (mask)" : "Unhide email (reveal)"}
                            >
                              {unmaskedRows[row.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                            <span>
                              {unmaskedRows[row.id]
                                ? (row.tenantEmail || row.tenantName || EMPTY_VALUE)
                                : maskEmail(row.tenantEmail || row.tenantName)}
                            </span>
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.reading != null
                        ? `${fmtNumber(row.reading, 2)} ${
                            utilityType === "electricity" ? "kWh" : "cu.m."
                          }`
                        : EMPTY_VALUE}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(row.date)}
                  </span>
                  {row.hasMeterRecord && row.rawReading ? (
                    <button
                      className={`inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 ${
                        isCurrentCycleLocked
                          ? "cursor-not-allowed opacity-40"
                          : ""
                      }`}
                      onClick={() => handleEditReading(row.rawReading)}
                      disabled={
                        isSystemBoundaryEvent(row.eventType) ||
                        isCurrentCycleLocked
                      }
                      title={
                        isCurrentCycleLocked
                          ? "This billing cycle is locked."
                          : isSystemBoundaryEvent(row.eventType)
                            ? "Boundary events are locked to preserve billing integrity."
                            : "Manage reading"
                      }
                    >
                      <Pencil size={12} /> Manage
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <Pagination
          page={timelinePage}
          total={totalTimelinePages}
          onChange={setTimelinePage}
          countLabel={`${billingTimelineRows.length} timeline entr${
            billingTimelineRows.length === 1 ? "y" : "ies"
          }`}
        />
      </section>

      <BillingCycleDetailModal
        isOpen={isHistoryModalOpen}
        onClose={closeHistoryModal}
        period={historyModalPeriod}
        result={resultWithBilling}
        utilityType={utilityType}
        statusLabel={
          historyModalPeriod ? getDisplayStatusLabel(historyModalPeriod) : ""
        }
        isReadOnly={
          historyModalPeriod ? !canEditPeriod(historyModalPeriod) : true
        }
        formatters={{
          fmtCurrency,
          fmtNumber,
          fmtShortDate,
          getSegmentPeriodLabel,
        }}
        eventTypeLabels={EVENT_TYPE_LABELS}
        onSendReminder={handleSendReminder}
        activeNoticeKey={activeNoticeKey}
      />

      {/* New Billing Period Modal */}
      <NewBillingPeriodModal
        isOpen={isNewPeriodModalOpen}
        onClose={() => setIsNewPeriodModalOpen(false)}
        utilityType={utilityType}
        selectedRoomId={selectedRoomId}
        selectedPeriodId={selectedPeriodId}
        openPeriodForRoom={openPeriodForRoom}
        lastClosedPeriod={lastClosedPeriod}
        latestReading={latestData?.reading}
        defaultRatePerUnit={defaultRatePerUnit}
        roomBranch={selectedRoom?.branch}
        onSuccess={(newPeriodId) => {
          if (newPeriodId) {
            selectAndFocusPeriod(newPeriodId);
          } else {
            setSelectedPeriodId(null);
          }
        }}
      />

      {/* Standard confirm modal */}

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant || "danger"}
        confirmText={confirmModal.confirmText || "Confirm"}
      />
    </section>
  );
};

export default UtilityBillingTab;
