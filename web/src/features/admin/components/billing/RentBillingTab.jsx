import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileText,
  Home,
  LoaderCircle,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/apiClient";
import { useAdminPayments } from "../../../../shared/hooks/queries/useBilling";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { showConfirmation, showNotification } from "../../../../shared/utils/notification";
import { fmtCurrency, fmtDate, fmtMonth, formatBranch, formatRoomType } from "../../utils/formatters";
import {
  buildPaymentLedgerByBillId as buildSharedPaymentLedgerByBillId,
  formatAdminPaymentMode,
  getNormalizedBillSnapshot as getSharedNormalizedBillSnapshot,
  getNormalizedPaidState as getSharedNormalizedPaidState,
  resolvePaymentDetails as resolveSharedPaymentDetails,
} from "./paymentDisplay";

const OWNER_ROLES = new Set(["owner", "superadmin"]);
const ROOMS_PER_PAGE = 10;

const BRANCH_OPTIONS = [
  { value: "", label: "All" },
  { value: "gil-puyat", label: "Gil-Puyat" },
  { value: "guadalupe", label: "Guadalupe" },
];

const ROOM_STATUS_LABELS = {
  no_active: "No Active Rent Bill",
  ready: "Ready to Generate",
  generated: "Generated",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

const TENANT_STATUS_LABELS = {
  ready: "Ready",
  generated: "Generated",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  partially_paid: "Partially paid",
  missing_data: "Missing data",
  already_billed: "Duplicate bill",
};

const getCurrentMonthInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const getBillingMonthDate = (month) => (month ? `${month}-01` : new Date());

const getId = (value) => String(value?._id || value?.id || value || "");

const normalizeAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const formatCycle = (start, end) => {
  if (!start || !end) return "Missing cycle";
  return `${fmtDate(start)} - ${fmtDate(end)}`;
};

const buildPdfFilename = (bill) =>
  `${bill?.billReference || bill?.id || "rent-bill"}.pdf`;

const getRoomName = (room) =>
  room?.name || room?.roomName || room?.roomNumber || "Room";

const getBillDeliveryStatus = (bill) =>
  bill?.delivery?.email?.status ||
  bill?.delivery?.notification?.status ||
  (bill?.sentAt ? "sent" : "not_attempted");

const isBillSent = (bill) =>
  Boolean(
    bill?.sentAt ||
      bill?.delivery?.email?.status === "sent" ||
      bill?.delivery?.notification?.status === "sent",
  );

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

const canSendReminder = (bill, paymentRecord = null) => {
  const normalized = getSharedNormalizedBillSnapshot(bill, paymentRecord, {
    isSent: isBillSent,
    getDaysOverdue: getBillDaysOverdue,
  });
  return Boolean(
    bill &&
      !normalized.isPaid &&
      ["pending", "partially-paid", "overdue"].includes(normalized.rawStatus),
  );
};
const LEGACY_PAID_FALLBACK_LABEL = "Paid — legacy/no ledger record";
const PAYMENT_STATUS_PRIORITY = {
  paid: 3,
  approved: 3,
  pending: 2,
  rejected: 1,
};
const formatPaymentMethodLabel = (value) => {
  if (!value) return "—";
  return formatAdminPaymentMode({ paymentMethod: value });
};
const formatPaymentDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
const buildPaymentLedgerByBillId = (payments = []) => {
  return buildSharedPaymentLedgerByBillId(payments);
};
const getBillPenaltyAmount = (bill) => Number(bill?.charges?.penalty || 0);
const getNormalizedPaidState = (bill, paymentRecord = null) => {
  return getSharedNormalizedPaidState(bill, paymentRecord);
};
const getNormalizedBillSnapshot = (bill, paymentRecord = null) => {
  return getSharedNormalizedBillSnapshot(bill, paymentRecord, {
    isSent: isBillSent,
    getDaysOverdue: getBillDaysOverdue,
  });
};
const canSendPenaltyNotice = (bill, paymentRecord = null) =>
  Boolean(bill && !getNormalizedPaidState(bill, paymentRecord).isPaid && getBillPenaltyAmount(bill) > 0);
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
  };
};
const getPrimaryNoticeLabel = (bill, paymentRecord = null) =>
  getNormalizedBillSnapshot(bill, paymentRecord).daysOverdue > 0 ||
  String(bill?.status || "").trim().toLowerCase() === "overdue"
    ? "Send Overdue Notice"
    : "Send Payment Reminder";

const getTenantBill = (tenant, billsById) => {
  const billId = getId(tenant?.currentMonthBill?.id || tenant?.currentMonthBill?._id);
  return billId ? billsById.get(billId) || tenant.currentMonthBill : null;
};

const getTenantStatus = (tenant, bill, paymentRecord = null) => {
  if (!tenant?.currentMonthBill) {
    return tenant?.billStatus === "missing_data" ? "missing_data" : "ready";
  }

  return getNormalizedBillSnapshot(bill, paymentRecord).status;
};

const pickSharedDateLabel = (tenants, picker) => {
  const values = [
    ...new Set(
      tenants
        .map(picker)
        .map((value) => {
          if (!value) return "";
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
        })
        .filter(Boolean),
    ),
  ];
  if (values.length === 0) return "Missing";
  if (values.length > 1) return "Multiple cycles";
  return fmtDate(values[0]);
};

// ─── Status helpers ──────────────────────────────────────────────────────────

const getRoomStatusClasses = (status) => {
  switch (status) {
    case "paid":
      return "bg-success-light text-success-dark";
    case "sent":
      return "bg-info-light text-info-dark";
    case "generated":
      return "bg-warning-light text-warning-dark";
    case "ready":
      return "bg-success-light text-success-dark";
    case "overdue":
      return "bg-danger-light text-danger-dark";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getTenantStatusClasses = (status) => {
  switch (status) {
    case "paid":
      return "bg-success-light text-success-dark";
    case "sent":
      return "bg-info-light text-info-dark";
    case "generated":
      return "bg-warning-light text-warning-dark";
    case "ready":
      return "bg-success-light text-success-dark";
    case "overdue":
    case "missing_data":
      return "bg-danger-light text-danger-dark";
    default:
      return "bg-muted text-muted-foreground";
  }
};

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  preview,
  isGenerating,
  isDownloading,
  onClose,
  onGenerate,
  onDownload,
}) {
  if (!preview) return null;

  const duplicateBill = preview.duplicateBill;
  const generateDisabled = isGenerating || Boolean(duplicateBill);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <section
        className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rent-preview-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent,#D4AF37)]">
              Bill Preview
            </p>
            <h3 id="rent-preview-title" className="mt-0.5 text-sm font-semibold text-card-foreground">
              Monthly Rent
            </h3>
          </div>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
            onClick={onClose}
            disabled={isGenerating}
          >
            Close
          </button>
        </div>

        {/* Grid info */}
        <div className="grid grid-cols-2 gap-4 px-5 py-4">
          {[
            {
              label: "Tenant",
              primary: preview.tenant?.name || "Tenant",
              secondary: preview.tenant?.email || "",
            },
            {
              label: "Room / Bed",
              primary: preview.room?.name || "Room",
              secondary: preview.room?.bed || "No bed label",
            },
            {
              label: "Billing Period",
              primary: formatCycle(preview.billingPeriod?.start, preview.billingPeriod?.end),
              secondary: formatBranch(preview.branch),
            },
            {
              label: "Due Date",
              primary: fmtDate(preview.dueDate),
              secondary: preview.billReference,
            },
          ].map(({ label, primary, secondary }) => (
            <div key={label} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-semibold text-card-foreground">{primary}</p>
              {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
            </div>
          ))}
        </div>

        {/* Breakdown */}
        <div className="space-y-2 border-t border-border px-5 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Monthly rent</span>
            <span className="font-medium text-card-foreground">{fmtCurrency(preview.charges?.rent || 0)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Appliance fee</span>
            <span className="font-medium text-card-foreground">{fmtCurrency(preview.charges?.applianceFees || 0)}</span>
          </div>
          {Number(preview.creditApplied || 0) > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reservation deposit applied</span>
              <span className="font-medium text-card-foreground">−{fmtCurrency(preview.creditApplied)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
            <span className="font-semibold text-card-foreground">Total amount due</span>
            <span className="text-base font-bold text-[color:var(--color-accent,#D4AF37)]">
              {fmtCurrency(preview.totalAmount || 0)}
            </span>
          </div>
        </div>

        <p className="px-5 pb-2 text-xs text-muted-foreground">
          Payment instructions are included in the tenant bill and billing history after generation.
        </p>

        {duplicateBill && (
          <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-warning bg-warning-light px-3 py-2 text-xs font-medium text-warning-dark">
            <AlertCircle size={13} />
            Duplicate bill already exists.
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
          {duplicateBill && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
              onClick={() => onDownload(duplicateBill)}
              disabled={isDownloading === String(duplicateBill.id)}
            >
              {isDownloading === String(duplicateBill.id) ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              Download PDF
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-4 py-1.5 text-xs font-semibold text-[#000000] hover:bg-[#FFE9A3] disabled:opacity-50"
            onClick={onGenerate}
            disabled={generateDisabled}
          >
            {isGenerating ? (
              <LoaderCircle size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
            {isGenerating ? "Generating..." : "Generate & Send Bill"}
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RentBillingTab({ isActive }) {
  const { user } = useAuth();
  const isOwner = OWNER_ROLES.has(user?.role);
  const [branch, setBranch] = useState(isOwner ? "" : user?.branch || "");
  const [month, setMonth] = useState(getCurrentMonthInput());
  const [dueDate, setDueDate] = useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [roomsPage, setRoomsPage] = useState(1);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [bills, setBills] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [activeNoticeKey, setActiveNoticeKey] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [batchAction, setBatchAction] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewTenant, setPreviewTenant] = useState(null);

  const branchParam = branch || undefined;
  const canLoad = isOwner || Boolean(branch);

  const loadData = useCallback(async () => {
    if (!canLoad || !isActive) return;

    setLoading(true);
    try {
      const [roomData, tenantData, billData] = await Promise.all([
        billingApi.getRoomsWithTenants(branchParam),
        billingApi.getRentBillableTenants({ branch: branchParam, month }),
        billingApi.getRentBills({ branch: branchParam, month, limit: 500 }),
      ]);
      const nextTenants = tenantData?.tenants || [];

      setRooms(roomData?.rooms || []);
      setTenants(nextTenants);
      setBills(billData?.bills || []);
      setAmounts((current) => {
        const next = { ...current };
        nextTenants.forEach((tenant) => {
          const key = getId(tenant.reservationId);
          if (next[key] == null) next[key] = tenant.monthlyRent || "";
        });
        return next;
      });
    } catch (error) {
      showNotification(error?.message || "Failed to load rent billing.", "error");
    } finally {
      setLoading(false);
    }
  }, [branchParam, canLoad, isActive, month]);

  useEffect(() => {
    if (isActive) loadData();
  }, [isActive, loadData]);

  const paymentParams = useMemo(
    () => ({
      branch: branchParam,
      limit: 500,
    }),
    [branchParam],
  );
  const { data: paymentLedgerData } = useAdminPayments(paymentParams, {
    enabled: Boolean(isActive && canLoad),
  });
  const paymentsByBillId = useMemo(
    () => buildPaymentLedgerByBillId(paymentLedgerData?.data || []),
    [paymentLedgerData?.data],
  );

  const billsById = useMemo(
    () => new Map(bills.map((bill) => [getId(bill.id || bill._id), bill])),
    [bills],
  );

  const roomRows = useMemo(() => {
    const roomMap = new Map();
    rooms.forEach((room) => {
      const roomId = getId(room.id || room._id);
      roomMap.set(roomId, { ...room, id: roomId, rentTenants: [] });
    });

    tenants.forEach((tenant) => {
      const roomId = getId(tenant.roomId);
      if (!roomId) return;
      if (!roomMap.has(roomId)) {
        roomMap.set(roomId, {
          id: roomId,
          name: tenant.roomName,
          roomName: tenant.roomName,
          roomNumber: tenant.roomNumber || tenant.roomName,
          branch: tenant.branch,
          type: tenant.roomType,
          capacity: tenant.roomCapacity,
          tenantCount: 0,
          rentTenants: [],
        });
      }
      const row = roomMap.get(roomId);
      row.rentTenants.push({ ...tenant, currentBill: getTenantBill(tenant, billsById) });
    });

    return [...roomMap.values()]
      .map((room) => {
        const activeTenants = room.rentTenants || [];
        const generated = activeTenants.filter((t) => t.currentMonthBill);
        const ready = activeTenants.filter(
          (t) =>
            !t.currentMonthBill &&
            t.billStatus === "ready" &&
            normalizeAmount(amounts[getId(t.reservationId)] ?? t.monthlyRent) > 0,
        );
        const hasOverdue = generated.some((t) => {
          const bill = t.currentBill;
          const paymentRecord = bill ? paymentsByBillId.get(getId(bill.id || bill._id)) : null;
          return getNormalizedBillSnapshot(bill, paymentRecord).status === "overdue";
        });
        const allGenerated = activeTenants.length > 0 && generated.length === activeTenants.length;
        const allPaid =
          allGenerated &&
          generated.every((t) => {
            const bill = t.currentBill;
            const paymentRecord = bill ? paymentsByBillId.get(getId(bill.id || bill._id)) : null;
            return getNormalizedBillSnapshot(bill, paymentRecord).isPaid;
          });
        const allSent = allGenerated && generated.every((t) => isBillSent(t.currentBill));

        let rentStatus = "no_active";
        if (hasOverdue) rentStatus = "overdue";
        else if (allPaid) rentStatus = "paid";
        else if (allSent) rentStatus = "sent";
        else if (allGenerated) rentStatus = "generated";
        else if (ready.length > 0 || activeTenants.length > 0) rentStatus = "ready";

        return {
          ...room,
          activeTenantCount: activeTenants.length,
          rentStatus,
          rentStatusLabel: ROOM_STATUS_LABELS[rentStatus],
        };
      })
      .sort((l, r) => {
        const bc = String(l.branch || "").localeCompare(String(r.branch || ""));
        if (bc) return bc;
        return getRoomName(l).localeCompare(getRoomName(r), undefined, { numeric: true });
      });
  }, [amounts, billsById, paymentsByBillId, rooms, tenants]);

  const filteredRooms = useMemo(() => {
    const search = sidebarSearch.trim().toLowerCase();
    if (!search) return roomRows;
    return roomRows.filter((room) => {
      const tenantText = (room.rentTenants || [])
        .map((t) => `${t.tenantName} ${t.email} ${t.bedPosition}`)
        .join(" ");
      return [getRoomName(room), room.roomNumber, room.branch, room.type, room.rentStatusLabel, tenantText]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [roomRows, sidebarSearch]);

  const totalRoomPages = Math.max(1, Math.ceil(filteredRooms.length / ROOMS_PER_PAGE));
  const pagedRooms = filteredRooms.slice((roomsPage - 1) * ROOMS_PER_PAGE, roomsPage * ROOMS_PER_PAGE);

  useEffect(() => {
    if (roomsPage > totalRoomPages) setRoomsPage(totalRoomPages);
  }, [roomsPage, totalRoomPages]);

  useEffect(() => {
    if (loading || roomRows.length === 0) return;
    if (!selectedRoomId || !roomRows.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(roomRows[0].id);
    }
  }, [loading, roomRows, selectedRoomId]);

  const selectedRoom = roomRows.find((r) => r.id === selectedRoomId) || null;
  const selectedTenants = selectedRoom?.rentTenants || [];

  const selectedSummary = useMemo(() => {
    const alreadyBilled = selectedTenants.filter((t) => t.currentMonthBill);
    const generatedBills = alreadyBilled.map((t) => getTenantBill(t, billsById)).filter(Boolean);
    const readyTenants = selectedTenants.filter((t) => {
      const amount = normalizeAmount(amounts[getId(t.reservationId)] ?? t.monthlyRent);
      return (
        !t.currentMonthBill &&
        t.billStatus === "ready" &&
        amount > 0 &&
        (dueDate || t.dueDate || t.billingCycle?.dueDate)
      );
    });
    const missingData = selectedTenants.filter((t) => {
      const amount = normalizeAmount(amounts[getId(t.reservationId)] ?? t.monthlyRent);
      return (
        !t.currentMonthBill &&
        (t.billStatus !== "ready" || amount <= 0 || !(dueDate || t.dueDate || t.billingCycle?.dueDate))
      );
    });
    const totalExpectedAmount = readyTenants.reduce(
      (sum, t) => sum + normalizeAmount(amounts[getId(t.reservationId)] ?? t.monthlyRent),
      0,
    );
    const outstandingBalance = generatedBills.reduce(
      (sum, bill) => {
        const paymentRecord = paymentsByBillId.get(getId(bill.id || bill._id)) || null;
        return sum + getNormalizedBillSnapshot(bill, paymentRecord).balance;
      },
      0,
    );

    return {
      totalTenants: selectedTenants.length,
      alreadyBilled: alreadyBilled.length,
      generatedBills,
      readyTenants,
      readyToGenerate: readyTenants.length,
      missingData: missingData.length,
      totalExpectedAmount,
      outstandingBalance,
      unsentBills: generatedBills.filter((bill) => !isBillSent(bill)),
      downloadableBills: generatedBills,
    };
  }, [amounts, billsById, dueDate, paymentsByBillId, selectedTenants]);

  const formError = useMemo(() => {
    if (!canLoad) return "Branch is required.";
    if (!month) return "Billing month is required.";
    return "";
  }, [canLoad, month]);

  const buildPayload = (tenant) => {
    const reservationId = getId(tenant.reservationId);
    return {
      reservationId,
      branch: tenant.branch || selectedRoom?.branch || branch,
      billingMonth: month,
      rentAmount: normalizeAmount(amounts[reservationId] ?? tenant.monthlyRent),
      ...(dueDate ? { dueDate } : {}),
    };
  };

  const validateTenantAction = (tenant, { allowExisting = false } = {}) => {
    if (formError) return formError;
    if (!tenant) return "No active tenant found.";
    if (!month) return "Billing month is required.";
    if (!dueDate && !tenant.dueDate && !tenant.billingCycle?.dueDate) return "Due date required.";
    if (!allowExisting && tenant.currentMonthBill) return "Duplicate bill already exists.";
    if (tenant.billStatus === "missing_data") {
      const message = tenant.validationErrors?.[0] || "Missing tenant billing data.";
      if (message.toLowerCase().includes("rent")) return "Missing rent amount.";
      if (message.toLowerCase().includes("active")) return "No active tenant found.";
      return message;
    }
    if (normalizeAmount(amounts[getId(tenant.reservationId)] ?? tenant.monthlyRent) <= 0)
      return "Missing rent amount.";
    return "";
  };

  const handlePreview = async (tenant) => {
    const validationError = validateTenantAction(tenant, { allowExisting: true });
    if (validationError) { showNotification(validationError, "error"); return; }

    const reservationId = getId(tenant.reservationId);
    setPreviewLoadingId(reservationId);
    try {
      const result = await billingApi.previewRentBill(buildPayload(tenant));
      setPreview(result?.preview || null);
      setPreviewTenant(tenant);
      if (result?.preview?.duplicateBill) showNotification("Duplicate bill already exists.", "warning");
    } catch (error) {
      showNotification(error?.message || "Failed to preview rent bill.", "error");
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleGenerate = async (tenant, { skipConfirm = false } = {}) => {
    const validationError = validateTenantAction(tenant);
    if (validationError) {
      showNotification(validationError, validationError.includes("Duplicate") ? "warning" : "error");
      return;
    }

    if (!skipConfirm) {
      const confirmed = await showConfirmation(
        `Generate and send a Monthly Rent bill for ${tenant.tenantName} in ${getRoomName(selectedRoom)} for ${fmtMonth(getBillingMonthDate(month))}?`,
        "Generate", "Cancel",
      );
      if (!confirmed) return;
    }

    const reservationId = getId(tenant.reservationId);
    setGeneratingId(reservationId);
    try {
      const result = await billingApi.generateRentBill(buildPayload(tenant));
      if (result?.warning) showNotification("Bill created, but email failed.", "warning");
      else showNotification("Rent bill generated successfully.", "success");
      setPreview(null);
      setPreviewTenant(null);
      await loadData();
    } catch (error) {
      const message = error?.message || "Failed to generate rent bill.";
      showNotification(
        message.toLowerCase().includes("duplicate") ? "Duplicate bill already exists." : message,
        message.toLowerCase().includes("duplicate") ? "warning" : "error",
      );
    } finally {
      setGeneratingId(null);
    }
  };

  const handleSendBill = async (bill) => {
    const billId = getId(bill?.id || bill?._id);
    if (!billId) { showNotification("No generated rent bill found.", "error"); return; }

    setSendingId(billId);
    try {
      const result = await billingApi.sendRentBill(billId);
      if (result?.warning) showNotification("Bill created, but email failed.", "warning");
      else showNotification("Bill sent successfully.", "success");
      await loadData();
    } catch (error) {
      showNotification(error?.message || "Failed to send rent bill.", "error");
    } finally {
      setSendingId(null);
    }
  };

  const handleSendReminder = async (bill, noticeType = "reminder", paymentRecord = null) => {
    const billId = getId(bill?.id || bill?._id);
    if (!billId) {
      showNotification("Bill not found.", "error");
      return;
    }
    if (noticeType === "penalty") {
      if (!canSendPenaltyNotice(bill, paymentRecord)) {
        showNotification("Penalty notice is only available when a penalty exists.", "error");
        return;
      }
    } else if (!canSendReminder(bill, paymentRecord)) {
      showNotification("Reminder is only available for unpaid bills.", "error");
      return;
    }

    setActiveNoticeKey(`${billId}:${noticeType}`);
    try {
      await billingApi.sendBillReminder(billId, { noticeType });
      showNotification(
        noticeType === "penalty"
          ? "Penalty notice sent successfully."
          : noticeType === "overdue"
            ? "Overdue notice sent successfully."
            : "Reminder sent successfully.",
        "success",
      );
      await loadData();
    } catch (error) {
      showNotification(
        error?.message ||
          (noticeType === "penalty"
            ? "Failed to send penalty notice."
            : noticeType === "overdue"
              ? "Failed to send overdue notice."
              : "Failed to send reminder."),
        "error",
      );
    } finally {
      setActiveNoticeKey(null);
    }
  };

  const handleDownloadPdf = async (bill) => {
    const billId = getId(bill?.id || bill?._id);
    if (!billId) { showNotification("No generated rent bill found.", "error"); return; }

    setDownloadingId(billId);
    try {
      await billingApi.downloadBillPdf(billId, buildPdfFilename(bill));
      showNotification("PDF downloaded successfully.", "success");
      await loadData();
    } catch (error) {
      showNotification(error?.message || "Failed to download PDF.", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleBatchGenerate = async () => {
    if (!selectedRoom) { showNotification("Select a room first.", "error"); return; }
    if (formError) { showNotification(formError, "error"); return; }
    if (selectedSummary.totalTenants === 0) { showNotification("No active tenant found.", "error"); return; }
    if (selectedSummary.readyToGenerate <= 0) {
      showNotification(
        selectedSummary.alreadyBilled > 0 ? "Some tenants already have bills for this cycle." : "Missing rent amount.",
        selectedSummary.alreadyBilled > 0 ? "warning" : "error",
      );
      return;
    }

    const confirmed = await showConfirmation(
      `Generate rent bills for ${getRoomName(selectedRoom)}? Tenants: ${selectedSummary.totalTenants}. Already billed: ${selectedSummary.alreadyBilled}. Ready to generate: ${selectedSummary.readyToGenerate}. Missing data: ${selectedSummary.missingData}. Total expected amount: ${fmtCurrency(selectedSummary.totalExpectedAmount)}.`,
      "Generate All", "Cancel",
    );
    if (!confirmed) return;

    setBatchAction("generate");
    let generated = 0, duplicates = 0, warnings = 0, failures = 0;

    try {
      for (const tenant of selectedSummary.readyTenants) {
        try {
          const result = await billingApi.generateRentBill(buildPayload(tenant));
          generated += 1;
          if (result?.warning) warnings += 1;
        } catch (error) {
          if ((error?.message || "").toLowerCase().includes("duplicate")) duplicates += 1;
          else failures += 1;
        }
      }
      if (generated > 0) showNotification("Rent bills generated for this room.", "success");
      if (duplicates > 0 || selectedSummary.alreadyBilled > 0)
        showNotification("Some tenants already have bills for this cycle.", "warning");
      if (warnings > 0) showNotification("Bill created, but email failed.", "warning");
      if (failures > 0) showNotification("Some rent bills could not be generated.", "error");
      await loadData();
    } finally {
      setBatchAction("");
    }
  };

  const handleBatchSend = async () => {
    if (!selectedRoom) { showNotification("Select a room first.", "error"); return; }
    if (selectedSummary.generatedBills.length === 0) { showNotification("No generated rent bill found.", "error"); return; }

    const confirmed = await showConfirmation(
      `Send generated rent bills for ${getRoomName(selectedRoom)}? Generated bills: ${selectedSummary.generatedBills.length}. Already sent: ${selectedSummary.generatedBills.length - selectedSummary.unsentBills.length}.`,
      "Send All", "Cancel",
    );
    if (!confirmed) return;

    setBatchAction("send");
    let sent = 0, warnings = 0, failures = 0;

    try {
      for (const bill of selectedSummary.generatedBills) {
        try {
          const result = await billingApi.sendRentBill(getId(bill.id || bill._id));
          sent += 1;
          if (result?.warning) warnings += 1;
        } catch { failures += 1; }
      }
      if (sent > 0) showNotification("Bill sent successfully.", "success");
      if (warnings > 0) showNotification("Bill created, but email failed.", "warning");
      if (failures > 0) showNotification("Some rent bills could not be sent.", "error");
      await loadData();
    } finally {
      setBatchAction("");
    }
  };

  const handleBatchDownload = async () => {
    if (selectedSummary.downloadableBills.length === 0) {
      showNotification("No generated rent bill found.", "error");
      return;
    }

    const confirmed = await showConfirmation(
      `Download generated rent bill PDFs for ${getRoomName(selectedRoom)}? PDFs available: ${selectedSummary.downloadableBills.length}.`,
      "Download PDFs", "Cancel",
    );
    if (!confirmed) return;

    setBatchAction("download");
    let downloaded = 0, failed = 0;

    try {
      for (const bill of selectedSummary.downloadableBills) {
        try {
          await billingApi.downloadBillPdf(getId(bill.id || bill._id), buildPdfFilename(bill));
          downloaded += 1;
        } catch { failed += 1; }
      }
      if (downloaded > 0) showNotification("PDF downloaded successfully.", "success");
      if (failed > 0) showNotification("Some PDFs could not be downloaded.", "error");
      await loadData();
    } finally {
      setBatchAction("");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4" aria-label="Rent billing workspace">

      {/* Form error notice */}
      {formError && (
        <div className="flex items-center gap-2 rounded-lg border border-warning bg-warning-light px-4 py-2.5 text-xs font-medium text-warning-dark">
          <AlertCircle size={13} />
          {formError}
        </div>
      )}

      {/* ── Two-column shell ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:auto-rows-auto">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent,#D4AF37)]">
              <Home size={12} className="shrink-0" />
              Rooms
            </span>
            <span className="text-xs text-muted-foreground">{filteredRooms.length} rooms</span>
          </div>

          {/* Search */}
          <div className="mt-3">
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground placeholder:text-muted-foreground focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
              placeholder="Search rooms..."
              value={sidebarSearch}
              onChange={(e) => { setSidebarSearch(e.target.value); setRoomsPage(1); }}
              aria-label="Search rooms"
            />
          </div>

          {/* Branch filter (owners only) */}
          {isOwner && (
            <div className="mt-2">
              <select
                value={branch}
                onChange={(e) => { setBranch(e.target.value); setSelectedRoomId(null); setRoomsPage(1); }}
                className="w-full rounded-lg border border-border bg-card px-2 py-2 text-xs text-muted-foreground focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
              >
                {BRANCH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Room list */}
          <div className="mt-4 space-y-2">
            {loading && roomRows.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                {sidebarSearch ? "No rooms match your search" : "No rooms found"}
              </div>
            ) : (
              pagedRooms.map((room) => (
                <button
                  key={room.id}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    selectedRoomId === room.id
                      ? "border-amber-400 bg-amber-50/70"
                      : "border-border/70 hover:border-border hover:bg-muted"
                  }`}
                  aria-pressed={selectedRoomId === room.id}
                  aria-label={`Select ${getRoomName(room)}`}
                  onClick={() => setSelectedRoomId(room.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-card-foreground">{getRoomName(room)}</span>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${room.activeTenantCount > 0 ? "bg-emerald-500" : "bg-slate-300"}`}
                      title={`${room.activeTenantCount} active tenant${room.activeTenantCount === 1 ? "" : "s"}`}
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getRoomStatusClasses(room.rentStatus)}`}>
                      {room.rentStatusLabel}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatBranch(room.branch)} · {room.activeTenantCount} active
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            Use filters to quickly find and select rooms. Manage rent bills for the selected room.
          </div>

          {/* Pagination */}
          {filteredRooms.length > ROOMS_PER_PAGE && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{filteredRooms.length} rooms</span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
                  disabled={roomsPage <= 1}
                  onClick={() => setRoomsPage((p) => p - 1)}
                  aria-label="Previous room page"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>{roomsPage}/{totalRoomPages}</span>
                <button
                  className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
                  disabled={roomsPage >= totalRoomPages}
                  onClick={() => setRoomsPage((p) => p + 1)}
                  aria-label="Next room page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* ── Main panel ───────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {!selectedRoom ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <Home size={36} strokeWidth={1.5} className="text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-card-foreground">Select a room to continue</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a room to manage monthly rent bills by tenant and bed.
              </p>
            </div>
          ) : (
            <>
              {/* Room header card */}
              <div className="rounded-[14px] border border-border bg-card px-5 py-4 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary">
                      <Home size={16} strokeWidth={2} />
                    </span>
                    <div>
                      <h2 className="text-[15px] font-semibold leading-none text-card-foreground">
                        {getRoomName(selectedRoom)}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Manage rent previews, generation, sending, and PDFs for this room.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {formatBranch(selectedRoom.branch)}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {formatRoomType(selectedRoom.type)}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${getRoomStatusClasses(selectedRoom.rentStatus)}`}>
                      {selectedRoom.rentStatusLabel}
                    </span>
                  </div>
                </div>

                {/* Occupancy metrics */}
                <div className="mt-6 grid gap-10 md:grid-cols-3">
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Ready</p>
                    <p className="mt-2 text-[28px] font-medium leading-none tracking-[-0.04em] text-card-foreground">
                      {selectedSummary.readyToGenerate}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Already Billed</p>
                    <p className="mt-2 text-[28px] font-medium leading-none tracking-[-0.04em] text-card-foreground">
                      {selectedSummary.alreadyBilled}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Outstanding</p>
                    <p className="mt-2 text-[28px] font-medium leading-none tracking-[-0.04em] text-primary">
                      {fmtCurrency(selectedSummary.outstandingBalance)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Billing cycle controls card */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent,#D4AF37)]">
                      <CalendarDays size={12} className="shrink-0" />
                      Rent Billing Cycle
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Review the selected month and tenant cycle dates before generation.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                    onClick={loadData}
                    disabled={loading}
                  >
                    <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                    Refresh
                  </button>
                </div>

                {/* Controls */}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Billing Month</label>
                    <input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Due Date Override</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    />
                  </div>
                </div>

                {/* Cycle grid */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {[
                    { label: "Billing month", value: fmtMonth(getBillingMonthDate(month)) },
                    { label: "Cycle start", value: pickSharedDateLabel(selectedTenants, (t) => t.billingCycleStart) },
                    { label: "Cycle end", value: pickSharedDateLabel(selectedTenants, (t) => t.billingCycleEnd) },
                    {
                      label: "Due date",
                      value: dueDate
                        ? `${fmtDate(dueDate)} (override)`
                        : pickSharedDateLabel(selectedTenants, (t) => t.dueDate || t.billingCycle?.dueDate),
                    },
                    {
                      label: "Generation date",
                      value: pickSharedDateLabel(selectedTenants, (t) => t.nextBillingDate || t.billingCycle?.generationDate),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-card-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                {selectedSummary.alreadyBilled > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning bg-warning-light px-3 py-2 text-xs font-medium text-warning-dark">
                    <AlertCircle size={13} />
                    Some tenants already have bills for this cycle.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Batch action bar ─────────────────────────────────────────────────── */}
      {selectedRoom && (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Selected room</p>
                <p className="mt-0.5 text-sm font-semibold text-card-foreground">{getRoomName(selectedRoom)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Missing data</p>
                <p className="mt-0.5 text-sm font-semibold text-card-foreground">{selectedSummary.missingData}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Total expected</p>
                <p className="mt-0.5 text-sm font-semibold text-card-foreground">{fmtCurrency(selectedSummary.totalExpectedAmount)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-xs font-semibold text-[#000000] hover:bg-[#FFE9A3] disabled:opacity-50"
                onClick={handleBatchGenerate}
                disabled={Boolean(batchAction) || selectedSummary.readyToGenerate <= 0}
              >
                {batchAction === "generate" ? <LoaderCircle size={13} className="animate-spin" /> : <FileText size={13} />}
                Generate Room Bills
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                onClick={handleBatchSend}
                disabled={Boolean(batchAction) || selectedSummary.generatedBills.length === 0}
              >
                {batchAction === "send" ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}
                Send Generated
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                onClick={handleBatchDownload}
                disabled={Boolean(batchAction) || selectedSummary.downloadableBills.length === 0}
              >
                {batchAction === "download" ? <LoaderCircle size={13} className="animate-spin" /> : <Download size={13} />}
                Download PDFs
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Tenant rent billing table ────────────────────────────────────────── */}
      {selectedRoom && (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent,#D4AF37)]">
                <Users size={12} className="shrink-0" />
                Tenant Rent Billing
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Active tenants and bed assignments for the selected room.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {selectedTenants.length} tenant{selectedTenants.length === 1 ? "" : "s"}
            </span>
          </div>

          {selectedTenants.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              No active tenant found.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto pb-1">
              <table className="min-w-[1180px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Tenant",
                      "Bed / Room",
                      "Move-in",
                      "Monthly Rent",
                      "Billing Cycle",
                      "Next Due",
                      "Status",
                      "Balance",
                      "Payment Method",
                      "Paid / Processed",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="whitespace-nowrap py-2 pr-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {selectedTenants.map((tenant) => {
                    const reservationId = getId(tenant.reservationId);
                    const amount = amounts[reservationId] ?? tenant.monthlyRent ?? "";
                    const amountInvalid = normalizeAmount(amount) <= 0;
                    const bill = getTenantBill(tenant, billsById);
                    const billId = getId(bill?.id || bill?._id);
                    const paymentRecord = billId ? paymentsByBillId.get(billId) : null;
                    const normalizedBill = getNormalizedBillSnapshot(bill, paymentRecord);
                    const paymentDetails = resolvePaymentDetails(bill, paymentRecord);
                    const daysOverdue = normalizedBill.daysOverdue;
                    const tenantStatus = bill ? normalizedBill.status : getTenantStatus(tenant, bill, paymentRecord);
                    const rowBusy =
                      previewLoadingId === reservationId ||
                      generatingId === reservationId ||
                      sendingId === billId ||
                      activeNoticeKey === `${billId}:reminder` ||
                      activeNoticeKey === `${billId}:overdue` ||
                      activeNoticeKey === `${billId}:penalty` ||
                      downloadingId === billId ||
                      Boolean(batchAction);

                    return (
                      <tr key={reservationId} className="group">
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-card-foreground">{tenant.tenantName}</p>
                          <p className="text-muted-foreground">{tenant.email}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-card-foreground">{tenant.bedPosition || "No bed label"}</p>
                          <p className="text-muted-foreground">{tenant.roomName || getRoomName(selectedRoom)}</p>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {tenant.moveInDate ? fmtDate(tenant.moveInDate) : "Missing"}
                        </td>
                        <td className="py-3 pr-4">
                          {bill ? (
                            <span className="text-xs font-semibold text-card-foreground">
                              {fmtCurrency(bill.totalAmount || normalizeAmount(amount))}
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={(e) =>
                                  setAmounts((cur) => ({ ...cur, [reservationId]: e.target.value }))
                                }
                                aria-invalid={amountInvalid}
                                className={`w-24 rounded-lg border px-2 py-1 text-xs text-card-foreground focus:outline-none focus:ring-2 focus:ring-amber-100 ${
                                  amountInvalid ? "border-danger bg-danger-light" : "border-border bg-card focus:border-amber-400"
                                }`}
                              />
                              {amountInvalid && (
                                <p className="text-[10px] text-danger">Missing rent amount.</p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {formatCycle(tenant.billingCycleStart, tenant.billingCycleEnd)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {fmtDate(dueDate || tenant.dueDate || tenant.billingCycle?.dueDate)}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="space-y-1">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getTenantStatusClasses(tenantStatus)}`}>
                              {TENANT_STATUS_LABELS[tenantStatus] || tenantStatus}
                            </span>
                            {daysOverdue > 0 && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-danger-light px-2 py-0.5 text-[10px] font-semibold text-danger-dark">
                                <Clock3 size={10} />
                                {daysOverdue} day{daysOverdue === 1 ? "" : "s"} overdue
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="hidden py-3 pr-4 text-muted-foreground">
                          {bill
                            ? fmtCurrency(normalizedBill.balance)
                            : fmtCurrency(0)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {paymentDetails.paymentFallbackLabel || formatPaymentMethodLabel(paymentDetails.paymentMethod)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          <div className="hidden max-w-[170px] truncate" title="">
                            {paymentDetails.paymentReference || "—"}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {formatPaymentDateTime(paymentDetails.paymentRecordedAt)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                              onClick={() => handlePreview(tenant)}
                              disabled={rowBusy || amountInvalid}
                            >
                              {previewLoadingId === reservationId ? (
                                <LoaderCircle size={11} className="animate-spin" />
                              ) : (
                                <Eye size={11} />
                              )}
                              Preview
                            </button>
                            {!bill && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-md bg-[#D4AF37] px-2 py-1 text-[11px] font-semibold text-[#000000] hover:bg-[#FFE9A3] disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => handleGenerate(tenant)}
                                disabled={rowBusy || amountInvalid || tenant.billStatus === "missing_data" || Boolean(formError)}
                              >
                                {generatingId === reservationId ? (
                                  <LoaderCircle size={11} className="animate-spin" />
                                ) : (
                                  <FileText size={11} />
                                )}
                                Generate
                              </button>
                            )}
                            {bill && !normalizedBill.isPaid && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => handleSendBill(bill)}
                                disabled={rowBusy}
                              >
                                {sendingId === billId ? (
                                  <LoaderCircle size={11} className="animate-spin" />
                                ) : (
                                  <Send size={11} />
                                )}
                                Send
                              </button>
                            )}
                            {bill && (canSendPenaltyNotice(bill, paymentRecord) || canSendReminder(bill, paymentRecord)) && (
                              <button
                                type="button"
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                                  canSendPenaltyNotice(bill, paymentRecord)
                                    ? "border-danger text-danger-dark hover:bg-danger-light"
                                    : "border-border text-muted-foreground hover:bg-muted"
                                }`}
                                onClick={() =>
                                  handleSendReminder(
                                    bill,
                                    canSendPenaltyNotice(bill, paymentRecord) ? "penalty" : daysOverdue > 0 ? "overdue" : "reminder",
                                    paymentRecord,
                                  )
                                }
                                disabled={rowBusy}
                                title={canSendPenaltyNotice(bill, paymentRecord) ? getPenaltyReason(bill) : undefined}
                              >
                                {activeNoticeKey?.startsWith(`${billId}:`) ? (
                                  <LoaderCircle size={11} className="animate-spin" />
                                ) : canSendPenaltyNotice(bill, paymentRecord) ? (
                                  <AlertCircle size={11} />
                                ) : (
                                  <Send size={11} />
                                )}
                                {canSendPenaltyNotice(bill, paymentRecord)
                                  ? "Send Penalty Notice"
                                  : daysOverdue > 0
                                    ? "Send Overdue Notice"
                                    : "Send Payment Reminder"}
                              </button>
                            )}
                            {bill && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => handleDownloadPdf(bill)}
                                disabled={rowBusy}
                              >
                                {downloadingId === billId ? (
                                  <LoaderCircle size={11} className="animate-spin" />
                                ) : (
                                  <Download size={11} />
                                )}
                                PDF
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Rent bill history ────────────────────────────────────────────────── */}
      {selectedRoom && (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent,#D4AF37)]">
                <CalendarDays size={12} className="shrink-0" />
                Rent Bill History
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Archive view only. Use Tenant Rent Billing above for sending, reminders, and PDFs.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {selectedSummary.generatedBills.length} archive entr{selectedSummary.generatedBills.length === 1 ? "y" : "ies"}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {selectedSummary.generatedBills.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                No archived rent bills for this room yet.
              </div>
            ) : (
              selectedSummary.generatedBills.map((bill) => {
                const deliveryStatus = getBillDeliveryStatus(bill);
                const sent = isBillSent(bill);
                const billId = getId(bill.id || bill._id);
                const paymentRecord = paymentsByBillId.get(billId) || null;
                const normalizedBill = getNormalizedBillSnapshot(bill, paymentRecord);
                const paymentDetails = resolvePaymentDetails(bill, paymentRecord);
                const daysOverdue = normalizedBill.daysOverdue;
                return (
                  <div
                    key={getId(bill.id || bill._id)}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">{bill.tenant?.name || "Tenant"}</p>
                      <p className="text-xs text-muted-foreground">
                        {bill.billReference || `Bill ${billId.slice(-6).toUpperCase()}`} • {formatCycle(bill.billingCycleStart, bill.billingCycleEnd)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Due {fmtDate(bill.dueDate)} • Balance {fmtCurrency(normalizedBill.balance)} • Total {fmtCurrency(bill.totalAmount || 0)}
                      </p>
                      {Number(bill.creditApplied || 0) > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Reservation deposit applied: −{fmtCurrency(bill.creditApplied)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Method {paymentDetails.paymentFallbackLabel || formatPaymentMethodLabel(paymentDetails.paymentMethod)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Paid / processed {formatPaymentDateTime(paymentDetails.paymentRecordedAt)}
                      </p>
                      {daysOverdue > 0 && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-danger-light px-2 py-0.5 text-[10px] font-semibold text-danger-dark">
                          <Clock3 size={10} />
                          {daysOverdue} day{daysOverdue === 1 ? "" : "s"} overdue
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          normalizedBill.isPaid
                            ? "bg-success-light text-success-dark"
                            : normalizedBill.status === "overdue"
                              ? "bg-danger-light text-danger-dark"
                              : normalizedBill.status === "partially_paid"
                                ? "bg-warning-light text-warning-dark"
                                : sent
                                  ? "bg-info-light text-info-dark"
                                  : deliveryStatus === "failed"
                                    ? "bg-danger-light text-danger-dark"
                                    : "bg-warning-light text-warning-dark"
                        }`}
                      >
                        {TENANT_STATUS_LABELS[normalizedBill.status] ||
                          (normalizedBill.status ? normalizedBill.status.replace(/_/g, " ") : "Generated")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {sent ? "Delivery sent" : deliveryStatus === "failed" ? "Delivery failed" : "Generated only"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* ── Preview Modal ────────────────────────────────────────────────────── */}
      <PreviewModal
        preview={preview}
        isGenerating={Boolean(generatingId && previewTenant)}
        isDownloading={downloadingId}
        onClose={() => {
          if (!generatingId) { setPreview(null); setPreviewTenant(null); }
        }}
        onGenerate={() => previewTenant && handleGenerate(previewTenant, { skipConfirm: true })}
        onDownload={handleDownloadPdf}
      />
    </section>
  );
}
