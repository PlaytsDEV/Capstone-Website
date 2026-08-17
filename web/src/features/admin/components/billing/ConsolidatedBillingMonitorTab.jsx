import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  FileText,
  Search,
  RefreshCw,
  Filter,
  DollarSign,
  TrendingUp,
  User,
  Home,
  X,
  CreditCard,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/billingApi";
import { showNotification } from "../../../../shared/utils/notification";
import { fmtCurrency, fmtDate } from "../../utils/formatters";

const getCurrentMonthInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export default function ConsolidatedBillingMonitorTab({
  isActive,
  ownerBranchFilter,
}) {
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthInput());
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ kpis: null, records: [] });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [sendingReminderId, setSendingReminderId] = useState(null);

  const fetchConsolidatedData = useCallback(async () => {
    if (!isActive) return;
    setLoading(true);
    try {
      const res = await billingApi.getConsolidatedBillingMonitor({
        month: monthFilter,
        status: statusFilter,
        branch: ownerBranchFilter || "",
        search: searchTerm,
      });

      if (res && res.success) {
        setData({
          kpis: res.kpis,
          records: res.records || [],
        });
      } else {
        const records = Array.isArray(res) ? res : res?.records || res?.data || [];
        setData({
          kpis: null,
          records,
        });
      }
    } catch (err) {
      console.error("[ConsolidatedMonitor] Failed to fetch data:", err);
      showNotification("Failed to load consolidated billing statements.", "error");
    } finally {
      setLoading(false);
    }
  }, [isActive, monthFilter, statusFilter, ownerBranchFilter, searchTerm]);

  useEffect(() => {
    fetchConsolidatedData();
  }, [fetchConsolidatedData]);

  const handleSendReminder = async (record) => {
    if (sendingReminderId) return;
    setSendingReminderId(record.id);
    try {
      await billingApi.sendOverdueNotice(record.id, "1st_notice");
      showNotification(`Payment reminder sent successfully to ${record.tenantName}!`, "success");
      fetchConsolidatedData();
    } catch (err) {
      console.error("[ConsolidatedMonitor] Send reminder failed:", err);
      showNotification(err.message || "Failed to send payment reminder.", "error");
    } finally {
      setSendingReminderId(null);
    }
  };

  if (!isActive) return null;

  const kpis = data.kpis || {
    totalRecords: data.records.length,
    totalBilled: data.records.reduce((s, r) => s + (r.totalAmount || 0), 0),
    totalCollected: data.records.reduce((s, r) => s + (r.paidAmount || 0), 0),
    totalOutstanding: data.records.reduce((s, r) => s + (r.remainingBalance || 0), 0),
    paidCount: data.records.filter((r) => r.status === "paid").length,
    collectionRate: data.records.length
      ? Math.round((data.records.filter((r) => r.status === "paid").length / data.records.length) * 100)
      : 0,
  };

  return (
    <div className="space-y-5">
      {/* KPI Overview Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Billed
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <DollarSign size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
            {fmtCurrency(kpis.totalBilled)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
            {kpis.totalRecords} statement(s) for selected month
          </p>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Collected
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2">
            {fmtCurrency(kpis.totalCollected)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
            {kpis.paidCount} tenant(s) fully settled
          </p>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Outstanding Balance
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2">
            {fmtCurrency(kpis.totalOutstanding)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
            {kpis.overdueCount || 0} overdue account(s)
          </p>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Collection Rate
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
            {kpis.collectionRate}%
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, kpis.collectionRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Billing Month:</span>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={15} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:border-slate-400 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="sent">Sent / Pending</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tenant or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-48 rounded-lg border border-border bg-background pl-8 pr-3 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:border-slate-400 focus:outline-none sm:w-60"
            />
          </div>

          <button
            type="button"
            onClick={fetchConsolidatedData}
            disabled={loading}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            title="Refresh monitor data"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Consolidated Statement Matrix Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Tenant & Room</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Tenant Rent Cycle</th>
                <th className="px-4 py-3">Utility Cycle</th>
                <th className="px-4 py-3 text-right">Rent</th>
                <th className="px-4 py-3 text-right">Electricity</th>
                <th className="px-4 py-3 text-right">Water</th>
                <th className="px-4 py-3 text-right">Total Billed</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance Due</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="12" className="py-12 text-center text-muted-foreground">
                    <RefreshCw size={18} className="mx-auto mb-2 animate-spin text-slate-500" />
                    Loading consolidated statements...
                  </td>
                </tr>
              ) : data.records.length === 0 ? (
                <tr>
                  <td colSpan="12" className="py-12 text-center text-muted-foreground">
                    No billing statements found matching the selected month and filters.
                  </td>
                </tr>
              ) : (
                data.records.map((row) => {
                  const isPaid = row.status === "paid";
                  const isPartial = row.status === "partially_paid";
                  const isOverdue = row.status === "overdue";

                  return (
                    <tr key={row.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {row.tenantName ? row.tenantName.slice(0, 2).toUpperCase() : "TN"}
                          </span>
                          <div>
                            <p className="font-semibold text-foreground">{row.tenantName}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Home size={11} /> {row.roomName}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 capitalize text-muted-foreground">
                        {row.branch === "gil-puyat" ? "Gil Puyat" : row.branch === "guadalupe" ? "Guadalupe" : row.branch || "-"}
                      </td>

                      <td className="px-4 py-3 font-medium text-foreground">
                        <div>
                          <p className="font-semibold">{row.rentCycleRange}</p>
                          {row.dueDate && (
                            <p className="text-[10px] text-muted-foreground">Due: {fmtDate(row.dueDate)}</p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {row.utilityCycleRange || "-"}
                      </td>


                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {fmtCurrency(row.rent)}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {fmtCurrency(row.electricity)}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {fmtCurrency(row.water)}
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        {fmtCurrency(row.totalAmount)}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {fmtCurrency(row.paidAmount)}
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">
                        {fmtCurrency(row.remainingBalance)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 uppercase dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 size={11} /> Paid
                          </span>
                        ) : isPartial ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 uppercase dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Clock size={11} /> Partial
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 uppercase dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            <AlertTriangle size={11} /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-800 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            Unpaid
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
                          >
                            <FileText size={12} /> Ledger
                          </button>

                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => handleSendReminder(row)}
                              disabled={sendingReminderId === row.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                              title="Send payment reminder to tenant"
                            >
                              <Send size={11} className={sendingReminderId === row.id ? "animate-spin" : ""} />
                              Remind
                            </button>
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

      {/* Itemized Ledger Drawer / Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity"
          style={{ background: "color-mix(in srgb, var(--background) 70%, transparent)" }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Statement Ledger Details</h3>
                <p className="text-xs text-muted-foreground">
                  Ref: {selectedRecord.billReference} · {selectedRecord.tenantName} ({selectedRecord.roomName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-5 text-xs">
              <div className="rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Tenant Rent Cycle:</span>
                  <span className="font-bold text-foreground">{selectedRecord.rentCycleRange}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Utility Meter Cycle:</span>
                  <span className="font-semibold text-foreground">{selectedRecord.utilityCycleRange || "-"}</span>
                </div>
                {selectedRecord.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">Payment Due Date:</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">{fmtDate(selectedRecord.dueDate)}</span>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">

                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Monthly Rent:</span>
                  <span className="font-semibold text-foreground">{fmtCurrency(selectedRecord.rent)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Electricity Share:</span>
                  <span className="font-semibold text-foreground">{fmtCurrency(selectedRecord.electricity)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Water Share:</span>
                  <span className="font-semibold text-foreground">{fmtCurrency(selectedRecord.water)}</span>
                </div>
                {selectedRecord.penalty > 0 && (
                  <div className="flex justify-between font-medium text-rose-600 dark:text-rose-400">
                    <span>Late Penalty:</span>
                    <span className="font-bold">{fmtCurrency(selectedRecord.penalty)}</span>
                  </div>
                )}
                {selectedRecord.additionalCharges > 0 && (
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Additional Fees:</span>
                    <span className="font-semibold text-foreground">{fmtCurrency(selectedRecord.additionalCharges)}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between font-bold text-sm text-foreground">
                  <span>Total Billed Amount:</span>
                  <span>{fmtCurrency(selectedRecord.totalAmount)}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid to Date:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(selectedRecord.paidAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining Balance Due:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{fmtCurrency(selectedRecord.remainingBalance)}</span>
                </div>
                {selectedRecord.dueDate && (
                  <div className="flex justify-between text-muted-foreground pt-1 border-t border-border">
                    <span>Due Date:</span>
                    <span className="font-medium text-foreground">{fmtDate(selectedRecord.dueDate)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg border border-border bg-muted px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
