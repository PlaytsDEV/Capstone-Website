import { useMemo, useState } from "react";
import { CreditCard, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { useAdminPayments } from "../../../../shared/hooks/queries/useBilling";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { fmtCurrency, formatBranch } from "../../utils/formatters";
import { TableSkeleton } from "../../../../shared/components/LoadingSkeletons";

const OWNER_ROLES = new Set(["owner", "superadmin" /* legacy */]);

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

const BRANCH_OPTIONS = [
  { value: "", label: "All branches" },
  { value: "gil-puyat", label: "Gil-Puyat" },
  { value: "guadalupe", label: "Guadalupe" },
];

const statusClasses = {
  paid: "bg-success-light text-success-dark",
  approved: "bg-success-light text-success-dark",
  pending: "bg-warning-light text-warning-dark",
  rejected: "bg-danger-light text-danger-dark",
};

const normalizePaymentStatus = (status) =>
  status === "approved" ? "paid" : status || "";

const formatDateTime = (value) => {
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

export default function AdminPaymentsTab({ isActive }) {
  const { user } = useAuth();
  const isOwner = OWNER_ROLES.has(user?.role);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [branch, setBranch] = useState(isOwner ? "" : user?.branch || "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const params = useMemo(
    () => ({
      search: search.trim(),
      status,
      branch: isOwner ? branch : "",
      dateFrom,
      dateTo,
      limit: 200,
    }),
    [branch, dateFrom, dateTo, isOwner, search, status],
  );

  const { data, isLoading, isFetching, refetch, error } = useAdminPayments(params, {
    enabled: isActive,
  });

  const payments = data?.data || [];

  const totals = useMemo(() => {
    const paidCount = payments.filter(
      (payment) => normalizePaymentStatus(payment.status) === "paid",
    ).length;
    const paidAmount = payments
      .filter((payment) => normalizePaymentStatus(payment.status) === "paid")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return {
      total: payments.length,
      paidCount,
      paidAmount,
    };
  }, [payments]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent,#D4AF37)]">
              Payment Ledger
            </p>
            <h3 className="mt-1 text-base font-semibold text-card-foreground">
              Tenant Payment Monitoring
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Review successful PayMongo transactions and other recorded billing payments.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="flex min-w-[210px] items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              <Search size={15} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenant, bill, payment ID..."
                className="w-full bg-transparent text-card-foreground outline-none"
              />
            </label>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {isOwner ? (
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
              >
                {BRANCH_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
            />

            <div className="flex gap-2">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
              />
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
                disabled={isFetching}
              >
                {isFetching ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Transactions</p>
            <p className="mt-1 text-lg font-semibold text-card-foreground">{totals.total}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Successful</p>
            <p className="mt-1 text-lg font-semibold text-card-foreground">{totals.paidCount}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Recorded Amount</p>
            <p className="mt-1 text-lg font-semibold text-card-foreground">{fmtCurrency(totals.paidAmount)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-card-foreground">Payments / Transactions</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Includes PayMongo ledger entries from the tenant mobile flow and web billing flow.
            </p>
          </div>
          {isFetching && !isLoading ? (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle size={13} className="animate-spin" />
              Updating
            </span>
          ) : null}
        </div>

        {isLoading ? (
          <TableSkeleton rows={7} columns={10} style={{ marginTop: 16 }} />
        ) : error ? (
          <div className="mt-4 rounded-lg border border-danger bg-danger-light px-4 py-4 text-sm text-danger">
            {error.message || "Failed to load payment ledger."}
          </div>
        ) : payments.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <CreditCard size={20} />
            </div>
            No payment transactions found for the selected filters.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Tenant", "Bill", "Amount", "Method", "Status", "Source", "External ID", "Branch", "Created", "Processed"].map((label) => (
                    <th key={label} className="py-2 pr-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {payments.map((payment) => {
                  const normalizedStatus = normalizePaymentStatus(payment.status);
                  return (
                  <tr key={payment.id}>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-card-foreground">
                        {payment.tenant?.name || "Unknown tenant"}
                      </p>
                      <p className="text-muted-foreground">{payment.tenant?.email || "No email"}</p>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      <p className="font-medium text-card-foreground">
                        {payment.billNumber ? String(payment.billNumber).slice(-8).toUpperCase() : "Missing bill"}
                      </p>
                      <p>{payment.billId || "No bill reference"}</p>
                    </td>
                    <td className="py-3 pr-4 font-semibold text-card-foreground">
                      {fmtCurrency(payment.amount || 0)}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{payment.paymentMethod || "—"}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          statusClasses[normalizedStatus] || "bg-muted text-muted-foreground"
                        }`}
                      >
                        {normalizedStatus || "unknown"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{payment.source || "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      <div className="max-w-[170px] truncate" title={payment.externalPaymentId || payment.referenceNumber || ""}>
                        {payment.externalPaymentId || payment.referenceNumber || "—"}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {payment.branch ? formatBranch(payment.branch) : "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatDateTime(payment.createdAt)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatDateTime(payment.processedAt)}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
