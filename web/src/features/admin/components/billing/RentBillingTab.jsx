import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  RefreshCw,
  Send,
  Users,
  CheckCircle,
  Home,
  Settings
} from "lucide-react";
import { billingApi } from "../../../../shared/api/apiClient";
import { useAdminPayments } from "../../../../shared/hooks/queries/useBilling";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { showConfirmation, showNotification } from "../../../../shared/utils/notification";
import { fmtCurrency, fmtDate, fmtMonth, formatBranch } from "../../utils/formatters";
import {
  buildPaymentLedgerByBillId as buildSharedPaymentLedgerByBillId,
  formatAdminPaymentMode,
  getNormalizedBillSnapshot as getSharedNormalizedBillSnapshot,
  getNormalizedPaidState as getSharedNormalizedPaidState,
  resolvePaymentDetails as resolveSharedPaymentDetails,
} from "./paymentDisplay";

const OWNER_ROLES = new Set(["owner", "superadmin" /* legacy */]);

const BRANCH_OPTIONS = [
  { value: "", label: "All Branches" },
  { value: "gil-puyat", label: "Gil-Puyat" },
  { value: "guadalupe", label: "Guadalupe" },
];

const TENANT_STATUS_LABELS = {
  ready: "Upcoming",
  generated: "Generated",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  partially_paid: "Partially paid",
  missing_data: "Action Required",
  already_billed: "Duplicate bill",
};

const getCurrentMonthInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

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

const formatPaymentMethodLabel = (value) => {
  if (!value) return "—";
  return formatAdminPaymentMode({ paymentMethod: value });
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

const getStatusStyles = (status) => {
  switch (status) {
    case "paid": return "bg-emerald-50 text-emerald-700 border-emerald-200/50";
    case "sent": return "bg-blue-50 text-blue-700 border-blue-200/50";
    case "generated": return "bg-amber-50 text-amber-700 border-amber-200/50";
    case "ready": return "bg-slate-50 text-slate-700 border-slate-200/50";
    case "overdue": return "bg-red-50 text-red-700 border-red-200/50";
    case "missing_data": return "bg-red-50 text-red-700 border-red-200/50";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  preview,
  isGenerating,
  onClose,
  onGenerate,
}) {
  if (!preview) return null;

  const duplicateBill = preview.duplicateBill;
  const generateDisabled = isGenerating || Boolean(duplicateBill);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
      <section className="w-full max-w-xl overflow-hidden rounded-[20px] border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--color-accent,#D4AF37)]">
              Manual Override
            </p>
            <h3 className="mt-1 text-lg font-semibold text-card-foreground">Force Rent Bill Generation</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-background p-2 text-muted-foreground shadow-sm hover:bg-muted"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 px-6 py-5">
          <div className="rounded-xl border border-border/50 bg-background px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Tenant</p>
            <p className="mt-1 text-sm font-semibold text-card-foreground">{preview.tenant?.name}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Room / Bed</p>
            <p className="mt-1 text-sm font-semibold text-card-foreground">{preview.room?.name}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Billing Period</p>
            <p className="mt-1 text-sm font-semibold text-card-foreground">
              {formatCycle(preview.billingPeriod?.start, preview.billingPeriod?.end)}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Due Date</p>
            <p className="mt-1 text-sm font-semibold text-card-foreground">{fmtDate(preview.dueDate)}</p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border bg-muted/10 px-6 py-5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Monthly rent</span>
            <span className="font-medium text-card-foreground">{fmtCurrency(preview.charges?.rent || 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Appliance fee</span>
            <span className="font-medium text-card-foreground">{fmtCurrency(preview.charges?.applianceFees || 0)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-4 text-base">
            <span className="font-semibold text-card-foreground">Total amount due</span>
            <span className="text-xl font-bold text-[color:var(--color-accent,#D4AF37)]">
              {fmtCurrency(preview.totalAmount || 0)}
            </span>
          </div>
        </div>

        {duplicateBill && (
          <div className="mx-6 mb-4 flex items-center gap-3 rounded-xl border border-warning/20 bg-warning-light p-4 text-sm text-warning-dark">
            <AlertCircle size={18} className="shrink-0" /> 
            <div>
              <p className="font-semibold">Duplicate Bill Detected</p>
              <p className="text-xs">A bill for this cycle has already been generated.</p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-border bg-background px-6 py-4">
          <button
            onClick={onGenerate}
            disabled={generateDisabled}
            className="flex items-center gap-2 rounded-xl bg-[color:var(--color-accent,#D4AF37)] px-5 py-2.5 text-sm font-bold text-black shadow-md transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {isGenerating ? <LoaderCircle className="animate-spin" size={16} /> : <Send size={16} />}
            Generate & Send Now
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
  
  const [tenants, setTenants] = useState([]);
  const [bills, setBills] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all, upcoming, overdue, exceptions

  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [activeNoticeKey, setActiveNoticeKey] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewTenant, setPreviewTenant] = useState(null);

  const branchParam = branch || undefined;
  const canLoad = isOwner || Boolean(branch);

  const loadData = useCallback(async () => {
    if (!canLoad || !isActive) return;
    setLoading(true);
    try {
      const [tenantData, billData] = await Promise.all([
        billingApi.getRentBillableTenants({ branch: branchParam, month }),
        billingApi.getRentBills({ branch: branchParam, month, limit: 1000 }),
      ]);
      const nextTenants = tenantData?.tenants || [];
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

  const paymentParams = useMemo(() => ({ branch: branchParam, limit: 1000 }), [branchParam]);
  const { data: paymentLedgerData } = useAdminPayments(paymentParams, { enabled: Boolean(isActive && canLoad) });
  const paymentsByBillId = useMemo(
    () => buildPaymentLedgerByBillId(paymentLedgerData?.data || []),
    [paymentLedgerData?.data],
  );

  const billsById = useMemo(() => new Map(bills.map((b) => [getId(b.id || b._id), b])), [bills]);

  // Derived state for the table
  const tableRows = useMemo(() => {
    return tenants.map((tenant) => {
      const bill = getTenantBill(tenant, billsById);
      const billId = getId(bill?.id || bill?._id);
      const paymentRecord = billId ? paymentsByBillId.get(billId) : null;
      const normalizedBill = getNormalizedBillSnapshot(bill, paymentRecord);
      const status = bill ? normalizedBill.status : getTenantStatus(tenant, bill, paymentRecord);
      
      const isMissingData = status === "missing_data" || normalizeAmount(amounts[getId(tenant.reservationId)] ?? tenant.monthlyRent) <= 0;
      const computedStatus = isMissingData ? "missing_data" : status;

      return {
        ...tenant,
        bill,
        paymentRecord,
        normalizedBill,
        computedStatus,
        daysOverdue: normalizedBill.daysOverdue
      };
    }).sort((a, b) => {
      // Sort by status priority: exceptions -> overdue -> upcoming -> generated -> paid
      const order = { missing_data: 1, overdue: 2, ready: 3, generated: 4, sent: 5, partially_paid: 6, paid: 7 };
      return (order[a.computedStatus] || 99) - (order[b.computedStatus] || 99);
    });
  }, [tenants, billsById, paymentsByBillId, amounts]);

  const filteredRows = useMemo(() => {
    if (activeTab === 'all') return tableRows;
    if (activeTab === 'upcoming') return tableRows.filter(r => r.computedStatus === 'ready');
    if (activeTab === 'overdue') return tableRows.filter(r => r.computedStatus === 'overdue');
    if (activeTab === 'exceptions') return tableRows.filter(r => r.computedStatus === 'missing_data');
    return tableRows;
  }, [tableRows, activeTab]);

  const kpis = useMemo(() => {
    let expected = 0;
    let collected = 0;
    let outstanding = 0;
    let exceptions = 0;
    let upcoming = 0;

    tableRows.forEach(row => {
      const amount = normalizeAmount(amounts[getId(row.reservationId)] ?? row.monthlyRent);
      expected += amount;

      if (row.computedStatus === 'missing_data') exceptions++;
      if (row.computedStatus === 'ready') upcoming++;

      if (row.bill) {
        collected += row.normalizedBill.paidAmount;
        outstanding += row.normalizedBill.balance;
      }
    });

    return { expected, collected, outstanding, exceptions, upcoming };
  }, [tableRows, amounts]);

  const handlePreview = async (tenant) => {
    const reservationId = getId(tenant.reservationId);
    setPreviewLoadingId(reservationId);
    try {
      const payload = {
        reservationId,
        branch: tenant.branch || branch,
        billingMonth: month,
        rentAmount: normalizeAmount(amounts[reservationId] ?? tenant.monthlyRent),
      };
      const result = await billingApi.previewRentBill(payload);
      setPreview(result?.preview || null);
      setPreviewTenant(tenant);
    } catch (error) {
      showNotification(error?.message || "Preview failed.", "error");
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleGenerate = async (tenant, { skipConfirm = false } = {}) => {
    const payload = {
      reservationId: getId(tenant.reservationId),
      branch: tenant.branch || branch,
      billingMonth: month,
      rentAmount: normalizeAmount(amounts[getId(tenant.reservationId)] ?? tenant.monthlyRent),
    };
    setGeneratingId(payload.reservationId);
    try {
      await billingApi.generateRentBill(payload);
      showNotification("Rent bill forced successfully.", "success");
      setPreview(null);
      setPreviewTenant(null);
      await loadData();
    } catch (error) {
      showNotification(error?.message || "Generation failed.", "error");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleAction = async (action, bill, noticeType = "reminder", paymentRecord = null) => {
    const billId = getId(bill?.id || bill?._id);
    if (!billId) return;

    if (action === "send_bill") {
      setSendingId(billId);
      try {
        await billingApi.sendRentBill(billId);
        showNotification("Bill sent successfully.", "success");
        await loadData();
      } catch (e) { showNotification(e.message, "error"); }
      finally { setSendingId(null); }
    } else if (action === "reminder") {
      setActiveNoticeKey(`${billId}:${noticeType}`);
      try {
        await billingApi.sendBillReminder(billId, { noticeType });
        showNotification("Notice sent.", "success");
        await loadData();
      } catch (e) { showNotification(e.message, "error"); }
      finally { setActiveNoticeKey(null); }
    } else if (action === "download") {
      setDownloadingId(billId);
      try {
        await billingApi.downloadBillPdf(billId, buildPdfFilename(bill));
        showNotification("PDF downloaded.", "success");
      } catch (e) { showNotification(e.message, "error"); }
      finally { setDownloadingId(null); }
    }
  };

  return (
    <section className="space-y-6" aria-label="Rent Billing Observability">
      {/* ── Dashboard Header & KPIs ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-card-foreground">
            <Settings className="text-[color:var(--color-accent,#D4AF37)]" size={22} />
            Automated Rent Lifecycle
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor auto-generated rent bills. Bills generate automatically 5 days before their due date.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isOwner && (
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            >
              {BRANCH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
          <button
            onClick={loadData}
            disabled={loading}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-border bg-card shadow-sm transition-colors hover:bg-muted"
          >
            <RefreshCw size={18} className={loading ? "animate-spin text-muted-foreground" : "text-muted-foreground"} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group relative overflow-hidden rounded-[20px] border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="absolute right-0 top-0 h-full w-1 bg-muted/50 transition-colors group-hover:bg-slate-300" />
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Expected Revenue</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-card-foreground">{fmtCurrency(kpis.expected)}</p>
        </div>
        <div className="group relative overflow-hidden rounded-[20px] border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="absolute right-0 top-0 h-full w-1 bg-emerald-100 transition-colors group-hover:bg-emerald-400" />
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Collected</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-emerald-600">{fmtCurrency(kpis.collected)}</p>
        </div>
        <div className="group relative overflow-hidden rounded-[20px] border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="absolute right-0 top-0 h-full w-1 bg-[color:var(--color-accent,#D4AF37)]/30 transition-colors group-hover:bg-[color:var(--color-accent,#D4AF37)]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Outstanding</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-card-foreground">{fmtCurrency(kpis.outstanding)}</p>
        </div>
        <div className="relative overflow-hidden rounded-[20px] border border-border bg-gradient-to-br from-muted/30 to-muted/10 p-6 shadow-inner">
          <div className="flex h-full flex-col justify-center">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-card-foreground">
              <Clock3 size={18} className="text-muted-foreground" />
              Cron Job Active
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              Next Run: 12:00 AM
            </div>
          </div>
        </div>
      </div>

      {/* ── Lifecycle Data Table ────────────────────────────────────────────── */}
      <div className="rounded-[20px] border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-border bg-muted/10 px-2 pt-2 scrollbar-none">
          {[
            { id: 'all', label: 'Lifecycle Overview', count: tableRows.length },
            { id: 'upcoming', label: 'Upcoming Auto-Gen', count: kpis.upcoming },
            { id: 'overdue', label: 'Overdue Rent', count: tableRows.filter(r => r.computedStatus === 'overdue').length },
            { id: 'exceptions', label: 'Action Required', count: kpis.exceptions, isAlert: true },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative whitespace-nowrap px-6 py-4 text-sm font-bold transition-colors ${
                activeTab === tab.id ? "text-card-foreground" : "text-muted-foreground hover:text-card-foreground hover:bg-muted/30 rounded-t-xl"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-black tracking-wide ${
                  tab.isAlert && tab.count > 0 
                    ? "bg-red-100 text-red-700" 
                    : activeTab === tab.id ? "bg-card text-card-foreground shadow-sm border border-border/50" : "bg-muted/50 text-muted-foreground"
                }`}>
                  {tab.count}
                </span>
              </div>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-[color:var(--color-accent,#D4AF37)]" />
              )}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Tenant / Room</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">System Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Cycle & Due Date</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Amount Tracker</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Override Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 bg-card">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="mx-auto flex max-w-[200px] flex-col items-center justify-center text-muted-foreground">
                      <CheckCircle size={32} strokeWidth={1.5} className="mb-4 text-emerald-500/50" />
                      <p className="text-sm font-semibold">All clear</p>
                      <p className="text-xs">No records found for this view right now.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const reservationId = getId(row.reservationId);
                  const isBusy = previewLoadingId === reservationId || generatingId === reservationId;
                  
                  return (
                    <tr key={reservationId} className="group transition-colors hover:bg-muted/20">
                      <td className="px-6 py-4">
                        <p className="font-bold text-card-foreground">{row.tenantName}</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                          {row.roomName} • <span className="uppercase tracking-wider opacity-75">{formatBranch(row.branch)}</span>
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${getStatusStyles(row.computedStatus)}`}>
                            {row.computedStatus === 'missing_data' && <AlertCircle size={12} />}
                            {TENANT_STATUS_LABELS[row.computedStatus] || row.computedStatus}
                          </span>
                          {row.daysOverdue > 0 && (
                            <p className="text-[11px] font-bold text-danger">
                              {row.daysOverdue} DAYS OVERDUE
                            </p>
                          )}
                          {row.computedStatus === 'ready' && (
                            <p className="text-[11px] font-medium text-muted-foreground">
                              Generates {fmtDate(row.nextBillingDate || row.billingCycle?.generationDate)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-card-foreground">
                          {formatCycle(row.billingCycleStart, row.billingCycleEnd)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                          Due: <span className="font-bold text-card-foreground">{fmtDate(row.dueDate || row.billingCycle?.dueDate)}</span>
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {row.bill ? (
                          <>
                            <p className="text-sm font-bold text-card-foreground">{fmtCurrency(row.normalizedBill.balance)}</p>
                            <p className="mt-1 text-xs font-medium text-muted-foreground">of {fmtCurrency(row.bill.totalAmount)} total</p>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className={`w-24 rounded-lg border bg-background px-2.5 py-1.5 text-sm font-semibold shadow-sm transition-colors ${
                                row.computedStatus === 'missing_data' ? "border-danger focus:ring-danger" : "border-border focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                              }`}
                              value={amounts[reservationId] ?? row.monthlyRent ?? ""}
                              onChange={(e) => setAmounts(cur => ({ ...cur, [reservationId]: e.target.value }))}
                              placeholder="0.00"
                            />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expected</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          {!row.bill && (
                            <button
                              onClick={() => handlePreview(row)}
                              disabled={isBusy || row.computedStatus === 'missing_data'}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-card-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
                              title="Manually force generation before the scheduled date"
                            >
                              <Settings size={14} className="text-muted-foreground" /> Force
                            </button>
                          )}
                          
                          {row.bill && (
                            <>
                              <button
                                onClick={() => handleAction('download', row.bill)}
                                className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-card-foreground"
                                title="Download PDF"
                              >
                                <Download size={14} />
                              </button>
                              
                              {!row.normalizedBill.isPaid && (
                                <button
                                  onClick={() => handleAction('reminder', row.bill, canSendPenaltyNotice(row.bill, row.paymentRecord) ? 'penalty' : row.daysOverdue > 0 ? 'overdue' : 'reminder')}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold shadow-sm transition-colors ${
                                    row.daysOverdue > 0 
                                      ? "border-danger bg-danger-light text-danger-dark hover:bg-danger/20" 
                                      : "border-border bg-background text-card-foreground hover:bg-muted"
                                  }`}
                                >
                                  <Send size={14} className={row.daysOverdue > 0 ? "text-danger" : "text-muted-foreground"} /> 
                                  {row.daysOverdue > 0 ? "Notice" : "Remind"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      <PreviewModal
        preview={preview}
        isGenerating={Boolean(generatingId && previewTenant)}
        onClose={() => { if (!generatingId) { setPreview(null); setPreviewTenant(null); } }}
        onGenerate={() => previewTenant && handleGenerate(previewTenant, { skipConfirm: true })}
      />
    </section>
  );
}
