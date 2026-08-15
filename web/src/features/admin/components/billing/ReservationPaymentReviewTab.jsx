import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Search,
  CreditCard,
  X,
  FileCheck2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  Building2,
  BedDouble,
  Hash,
  CheckCircle2,
} from "lucide-react";
import { reservationApi } from "../../../../shared/api/reservationApi";
import ProfileAvatar, { getProfileInitials } from "../../../../shared/components/ProfileAvatar";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value || 0));

const errorMessage = (error) => {
  if (!error) return "We were unable to load reservation payment records. Please try again.";
  const raw = error?.data?.message || error?.message || (typeof error === "string" ? error : "");

  if (raw.includes("not found") || raw.includes("NOT_FOUND")) {
    return "The requested payment record could not be found. Please refresh and try again.";
  }
  if (raw.includes("Unauthorized") || raw.includes("Forbidden") || raw.includes("403") || raw.includes("401")) {
    return "You do not have administrative permission to view payment records.";
  }
  if (raw.includes("is not a function") || raw.includes("NetworkError") || raw.includes("Failed to fetch")) {
    return "Unable to connect to the payment service. Please refresh and try again.";
  }

  if (
    raw &&
    !raw.includes("TypeError") &&
    !raw.includes("ReferenceError") &&
    !raw.includes("function") &&
    !raw.includes("Cannot read")
  ) {
    return raw.replace(/^[A-Z0-9_]+:\s*/, "");
  }

  return "We were unable to load reservation payment records. Please refresh the page or try again in a moment.";
};

const getInitials = (name) => {
  if (!name) return "AP";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const formatBranch = (slug) => {
  if (!slug) return "All Branches";
  if (slug === "gil-puyat") return "Gil Puyat";
  if (slug === "guadalupe") return "Guadalupe";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
};

export default function ReservationPaymentReviewTab({ isActive, branch = "" }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await reservationApi.listPaymentProofReviews();
      const rawList = Array.isArray(response?.payments)
        ? response.payments
        : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
        ? response
        : [];
      setPayments(rawList);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) load();
  }, [isActive, load]);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterTab, branch]);

  const normalizedPayments = useMemo(() => {
    return payments.map((p) => {
      const tenantName =
        p.tenant?.name ||
        [p.tenant?.firstName || p.tenantId?.firstName, p.tenant?.lastName || p.tenantId?.lastName]
          .filter(Boolean)
          .join(" ") ||
        p.tenantName ||
        "Applicant";

      const tenantEmail = p.tenant?.email || p.tenantId?.email || "";

      const reservationCode =
        p.reservation?.reservationCode ||
        p.reservationId?.reservationCode ||
        (typeof p.reservationId === "string" ? p.reservationId : "") ||
        p.paymentId ||
        "RES-PENDING";

      const roomName =
        p.reservation?.room ||
        p.reservation?.roomId?.name ||
        p.reservation?.roomId?.roomNumber ||
        p.reservationId?.roomId?.name ||
        p.reservationId?.roomId?.roomNumber ||
        p.roomName ||
        "—";

      const bedLabel =
        p.reservation?.bed ||
        p.reservation?.selectedBed?.label ||
        p.reservationId?.selectedBed?.label ||
        "";

      const tenantProfileImage =
        p.tenant?.profileImage ||
        p.tenant?.avatar ||
        p.tenant?.photoUrl ||
        p.tenantId?.profileImage ||
        p.tenantId?.avatar ||
        p.tenantId?.photoUrl ||
        p.profileImage ||
        p.photoUrl ||
        "";

      const paymentBranch = p.branch || p.reservation?.branch || p.reservationId?.branch || "";
      const rawAmount = p.paidAmount ?? p.amount ?? 0;
      const rawExpected = p.expectedAmount ?? p.totalPrice ?? p.reservation?.totalPrice ?? rawAmount;
      const status = String(p.status || "confirmed").toLowerCase();
      const source = p.source || "paymongo";

      return {
        ...p,
        _id: p._id || p.id || p.paymentId,
        tenantFullName: tenantName,
        tenantEmail,
        tenantProfileImage,
        tenantUser: p.tenant || p.tenantId || null,
        reservationCode,
        roomName,
        bedLabel,
        branch: paymentBranch,
        amount: Number(rawAmount),
        paidAmount: Number(rawAmount),
        expectedAmount: Number(rawExpected),
        status,
        source,
        paymentMethod: p.paymentMethod || p.method || "PayMongo",
        referenceNumber:
          p.referenceNumber || p.paymentReference || p.externalPaymentId || p.paymentId || "—",
        submittedAt: p.submittedAt || p.createdAt || null,
      };
    });
  }, [payments]);

  const branchFilteredPayments = useMemo(() => {
    if (!branch) return normalizedPayments;
    return normalizedPayments.filter(
      (p) => String(p.branch).toLowerCase() === String(branch).toLowerCase(),
    );
  }, [normalizedPayments, branch]);

  const confirmedCount = useMemo(
    () =>
      branchFilteredPayments.filter(
        (payment) =>
          payment.status === "confirmed" ||
          payment.status === "approved" ||
          payment.status === "paid" ||
          payment.status === "completed",
      ).length,
    [branchFilteredPayments],
  );

  const pendingCount = useMemo(
    () =>
      branchFilteredPayments.filter(
        (payment) => payment.status === "pending" || payment.status === "under_review",
      ).length,
    [branchFilteredPayments],
  );

  const failedCount = useMemo(
    () =>
      branchFilteredPayments.filter(
        (payment) =>
          payment.status === "failed" ||
          payment.status === "rejected" ||
          payment.status === "cancelled",
      ).length,
    [branchFilteredPayments],
  );

  const filteredPayments = useMemo(() => {
    let list = branchFilteredPayments;
    if (filterTab === "confirmed") {
      list = list.filter(
        (p) =>
          p.status === "confirmed" ||
          p.status === "approved" ||
          p.status === "paid" ||
          p.status === "completed",
      );
    } else if (filterTab === "pending") {
      list = list.filter((p) => p.status === "pending" || p.status === "under_review");
    } else if (filterTab === "failed") {
      list = list.filter(
        (p) =>
          p.status === "failed" ||
          p.status === "rejected" ||
          p.status === "cancelled",
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => {
        const name = String(p.tenantFullName || "").toLowerCase();
        const code = String(p.reservationCode || "").toLowerCase();
        const branchStr = String(p.branch || "").toLowerCase();
        const roomStr = String(p.roomName || "").toLowerCase();
        const refStr = String(p.referenceNumber || "").toLowerCase();
        const payId = String(p.paymentId || "").toLowerCase();
        return (
          name.includes(q) ||
          code.includes(q) ||
          branchStr.includes(q) ||
          roomStr.includes(q) ||
          refStr.includes(q) ||
          payId.includes(q)
        );
      });
    }
    return list;
  }, [branchFilteredPayments, filterTab, searchQuery]);

  // Total pages and sliced page items
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / itemsPerPage));
  const paginatedPayments = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredPayments.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredPayments, currentPage, itemsPerPage]);

  const startRecord = filteredPayments.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endRecord = Math.min(currentPage * itemsPerPage, filteredPayments.length);

  const getStatusBadgeStyles = (status) => {
    switch (status) {
      case "confirmed":
      case "approved":
      case "paid":
      case "completed":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "pending":
      case "under_review":
        return "bg-amber-50 text-amber-900 border-amber-200";
      case "rejected":
      case "failed":
      case "cancelled":
        return "bg-red-50 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & KPI Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-card-foreground">
            <CreditCard size={18} className="text-slate-600 dark:text-slate-400" />
            Reservation Payments
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            View applicant reservation fee transactions, deposit records, and automated PayMongo settlement logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-900 text-xs font-bold border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-700" /> {confirmedCount} Confirmed Payments
          </span>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground shadow-xs transition hover:bg-muted active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            title="Refresh reservation payment transactions"
          >
            <RefreshCw
              size={13}
              className={loading ? "animate-spin text-muted-foreground" : "text-muted-foreground"}
            />{" "}
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-700 hover:text-red-900 transition cursor-pointer"
            aria-label="Dismiss error notice"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Split-screen Master / Detail */}
      <div className="flex min-h-[580px] overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {/* LEFT — Master list (42%) */}
        <div className="w-full md:w-[42%] shrink-0 overflow-hidden border-r border-border flex flex-col bg-card">
          {/* Search & Filter Toolbar */}
          <div className="border-b border-border bg-muted/20 p-3 space-y-2.5">
            <div className="relative flex items-center w-full">
              <Search size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code, applicant, or reference..."
                className="w-full h-8.5 rounded-lg border border-border bg-card pl-9 pr-7 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 p-0.5 rounded-full text-muted-foreground hover:text-card-foreground transition cursor-pointer"
                  aria-label="Clear search query"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter Buttons: Solid standalone cards with visible borders and backgrounds */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {[
                { id: "all", label: "All", count: branchFilteredPayments.length },
                { id: "confirmed", label: "Confirmed", count: confirmedCount },
                { id: "pending", label: "Pending", count: pendingCount },
                { id: "failed", label: "Failed", count: failedCount },
              ].map((t) => {
                const isActiveTab = filterTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFilterTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 border shadow-xs cursor-pointer ${
                      isActiveTab
                        ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-100 font-bold"
                        : "bg-card text-card-foreground border-border hover:bg-muted/80 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <span>{t.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                        isActiveTab
                          ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                          : "bg-muted text-muted-foreground border border-border/50"
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!loading && paginatedPayments.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <FileCheck2 size={32} className="text-slate-400 mb-2.5" />
                <p className="font-bold text-card-foreground text-sm">No payment records found</p>
                <p className="mt-1 text-[11px] max-w-xs">
                  {searchQuery
                    ? `No results matching "${searchQuery}". Try clearing your search.`
                    : "No reservation payment records match the current tab filter."}
                </p>
              </div>
            ) : (
              paginatedPayments.map((payment) => {
                const isSelected = selectedPayment?._id === payment._id;
                const fullName = payment.tenantFullName;

                return (
                  <button
                    key={payment._id}
                    type="button"
                    onClick={() =>
                      setSelectedPayment(isSelected ? null : payment)
                    }
                    className={`w-full rounded-xl border p-3 text-left transition-all flex flex-col gap-2.5 shadow-xs cursor-pointer ${
                      isSelected
                        ? "border-slate-900 bg-slate-50 dark:bg-slate-800 dark:border-slate-100 ring-1 ring-slate-900/10 dark:ring-slate-100/10"
                        : "border-border bg-card hover:bg-muted/40 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {/* Top row: Avatar, Name, and Status Badge */}
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ProfileAvatar
                          src={payment.tenantProfileImage}
                          user={payment.tenantUser || { name: fullName }}
                          initials={getProfileInitials({ name: fullName })}
                          alt={`${fullName} profile photo`}
                          size={32}
                        />
                        <p className="truncate text-xs font-bold text-card-foreground leading-none">{fullName}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeStyles(
                          payment.status,
                        )}`}
                      >
                        {payment.status?.replace(/_/g, " ")}
                      </span>
                    </div>

                    {/* Middle row: Reservation Code & Branch */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground w-full">
                      <span className="flex items-center gap-1 font-mono font-medium truncate">
                        <Hash size={11} className="text-slate-400 shrink-0" />
                        {payment.reservationCode}
                      </span>
                      <span className="flex items-center gap-1 font-medium shrink-0">
                        <Building2 size={11} className="text-slate-400 shrink-0" />
                        {formatBranch(payment.branch)}
                      </span>
                    </div>

                    {/* Bottom row: Room & Amount */}
                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/50 w-full">
                      <span className="flex items-center gap-1 text-muted-foreground truncate max-w-[170px]">
                        <BedDouble size={11} className="text-slate-400 shrink-0" />
                        <span className="text-card-foreground font-medium truncate">
                          {payment.roomName}
                          {payment.bedLabel ? ` (${payment.bedLabel})` : ""}
                        </span>
                      </span>
                      <span className="font-bold text-xs text-card-foreground shrink-0">
                        {money(payment.amount)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Master List Pagination Footer */}
          <div className="border-t border-border bg-muted/20 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>
                Showing <strong className="text-card-foreground">{startRecord}</strong>–
                <strong className="text-card-foreground">{endRecord}</strong> of{" "}
                <strong className="text-card-foreground">{filteredPayments.length}</strong>
              </span>

              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-6.5 rounded-md border border-border bg-card px-1.5 text-[10px] font-medium text-card-foreground focus:outline-none cursor-pointer"
                title="Number of records per page"
                aria-label="Rows per page"
              >
                {[6, 8, 12, 20].map((num) => (
                  <option key={num} value={num}>
                    {num} / page
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-card-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft size={13} />
              </button>

              <span className="px-2 text-[11px] font-semibold text-card-foreground">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-card-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next page"
                aria-label="Next page"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — Detail panel (58%) */}
        <div className="flex flex-1 flex-col overflow-y-auto bg-card">
          {!selectedPayment ? (
            <div className="flex flex-1 flex-col items-center p-8 pt-12 text-center text-muted-foreground space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 shadow-xs">
                <CreditCard size={32} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-card-foreground">Select a Payment Record</h4>
                <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
                  Click any transaction on the left list to review detailed payment breakdowns, applicant room allocations, and PayMongo transaction logs.
                </p>
              </div>

              {/* Informative Feature Card */}
              <div className="mt-3 max-w-md w-full rounded-xl border border-border bg-muted/20 p-4 text-left space-y-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800">
                    <ShieldCheck size={18} className="text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-card-foreground">Automated Gateway Verification</p>
                    <p className="text-[11px] text-muted-foreground">All reservation deposits are reconciled via PayMongo</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-[11px]">
                  <div className="flex items-center gap-1.5 text-card-foreground font-medium">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Real-time Settlement</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-card-foreground font-medium">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Automated Bed Lock</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-card-foreground font-medium">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Reference Tracking</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-card-foreground font-medium">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Zero Manual Review</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4 p-5">
              {/* Identity Header */}
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3.5">
                <div className="flex items-center gap-3">
                  <ProfileAvatar
                    src={selectedPayment.tenantProfileImage}
                    user={selectedPayment.tenantUser || { name: selectedPayment.tenantFullName }}
                    initials={getProfileInitials({ name: selectedPayment.tenantFullName })}
                    alt={`${selectedPayment.tenantFullName} profile photo`}
                    size={42}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-card-foreground">
                        {selectedPayment.tenantFullName}
                      </h4>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeStyles(
                          selectedPayment.status,
                        )}`}
                      >
                        {selectedPayment.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                      {selectedPayment.tenantEmail ? `${selectedPayment.tenantEmail} \u00B7 ` : ""}
                      Reservation:{" "}
                      <strong className="text-card-foreground font-mono">
                        {selectedPayment.reservationCode}
                      </strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground transition cursor-pointer"
                  aria-label="Close detail panel"
                  title="Close payment detail panel"
                >
                  <X size={14} />
                </button>
              </div>

              {/* KPI Mini-Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Expected Deposit
                  </span>
                  <p className="text-sm font-bold text-card-foreground mt-1">
                    {money(selectedPayment.expectedAmount)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Submitted Amount
                  </span>
                  <p className="text-sm font-bold text-card-foreground mt-1">
                    {money(selectedPayment.amount)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Settlement Variance
                  </span>
                  <p
                    className={`text-sm font-bold mt-1 ${
                      Number(selectedPayment.amount) >= Number(selectedPayment.expectedAmount || 0)
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {Number(selectedPayment.amount) >= Number(selectedPayment.expectedAmount || 0)
                      ? "+"
                      : ""}
                    {money(
                      Number(selectedPayment.amount) -
                        Number(selectedPayment.expectedAmount || 0),
                    )}
                  </p>
                </div>
              </div>

              {/* Payment Details Definition Grid */}
              <div className="rounded-xl border border-border bg-muted/10 p-3.5">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Transaction Metadata
                </h5>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <Building2 size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-[10px] font-semibold text-muted-foreground">Target Branch</dt>
                      <dd className="font-semibold text-card-foreground mt-0.5">
                        {formatBranch(selectedPayment.branch)}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <BedDouble size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-[10px] font-semibold text-muted-foreground">Room / Bed Assignment</dt>
                      <dd className="font-semibold text-card-foreground mt-0.5">
                        {selectedPayment.roomName}
                        {selectedPayment.bedLabel ? ` / ${selectedPayment.bedLabel}` : ""}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <CreditCard size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-[10px] font-semibold text-muted-foreground">Payment Method</dt>
                      <dd className="font-semibold text-card-foreground mt-0.5 uppercase">
                        {selectedPayment.paymentMethod}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Hash size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-[10px] font-semibold text-muted-foreground">Reference Number</dt>
                      <dd className="font-mono text-xs font-semibold text-card-foreground mt-0.5">
                        {selectedPayment.referenceNumber}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Calendar size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-[10px] font-semibold text-muted-foreground">Submission Date</dt>
                      <dd className="font-medium text-card-foreground mt-0.5">
                        {selectedPayment.submittedAt
                          ? new Date(selectedPayment.submittedAt).toLocaleString("en-PH")
                          : "—"}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Info size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-[10px] font-semibold text-muted-foreground">Transaction Source</dt>
                      <dd className="font-medium text-card-foreground mt-0.5 capitalize">
                        {String(selectedPayment.source || "paymongo").replace(/_/g, " ")}
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              {/* Status Verification Banner */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 flex items-center gap-2.5">
                <ShieldCheck size={18} className="shrink-0 text-emerald-700 dark:text-emerald-500" />
                <span className="font-medium leading-relaxed">
                  Verified via PayMongo Automated Gateway — this reservation payment was automatically processed and reconciled with the dormitory reservation.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
