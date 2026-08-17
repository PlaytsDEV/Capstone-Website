import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  ArrowUpRight,
  Download,
  Copy,
  Check,
  Loader2,
  Coins,
  TrendingUp,
  Clock,
} from "lucide-react";
import { reservationApi } from "../../../../shared/api/reservationApi";
import ProfileAvatar, { getProfileInitials } from "../../../../shared/components/ProfileAvatar";
import { AdminTablePageSkeleton } from "../AdminContentSkeletons";

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

const formatBranch = (slug) => {
  if (!slug) return "All Branches";
  if (slug === "gil-puyat") return "Gil Puyat";
  if (slug === "guadalupe") return "Guadalupe";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
};

export default function ReservationPaymentReviewTab({ isActive, branch = "" }) {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, amount_desc, amount_asc, name_asc

  // Interactive Action States
  const [copiedKey, setCopiedKey] = useState(null);
  const [generatingReceipt, setGeneratingReceipt] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

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
  }, [searchQuery, filterTab, branch, sortBy]);

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
    if (!branch || branch === "all") return normalizedPayments;
    return normalizedPayments.filter(
      (p) => String(p.branch).toLowerCase() === String(branch).toLowerCase(),
    );
  }, [normalizedPayments, branch]);

  // Financial KPI Metrics
  const summaryStats = useMemo(() => {
    let totalCollected = 0;
    let confirmedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    for (const p of branchFilteredPayments) {
      const isConfirmed =
        p.status === "confirmed" ||
        p.status === "approved" ||
        p.status === "paid" ||
        p.status === "completed";

      const isPending = p.status === "pending" || p.status === "under_review";
      const isFailed =
        p.status === "failed" || p.status === "rejected" || p.status === "cancelled";

      if (isConfirmed) {
        confirmedCount++;
        totalCollected += Number(p.amount || 0);
      } else if (isPending) {
        pendingCount++;
      } else if (isFailed) {
        failedCount++;
      }
    }

    const averageDeposit = confirmedCount > 0 ? totalCollected / confirmedCount : 0;

    return {
      totalCollected,
      confirmedCount,
      pendingCount,
      failedCount,
      averageDeposit,
      totalCount: branchFilteredPayments.length,
    };
  }, [branchFilteredPayments]);

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
      const q = searchQuery.trim().toLowerCase();
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

    // Sort list
    const sorted = [...list];
    if (sortBy === "newest") {
      sorted.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    } else if (sortBy === "oldest") {
      sorted.sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));
    } else if (sortBy === "amount_desc") {
      sorted.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    } else if (sortBy === "amount_asc") {
      sorted.sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0));
    } else if (sortBy === "name_asc") {
      sorted.sort((a, b) => String(a.tenantFullName || "").localeCompare(String(b.tenantFullName || "")));
    }

    return sorted;
  }, [branchFilteredPayments, filterTab, searchQuery, sortBy]);

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
        return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
      case "pending":
      case "under_review":
        return "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
      case "rejected":
      case "failed":
      case "cancelled":
        return "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const handleCopyToClipboard = (text, key) => {
    if (!text || text === "—") return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1500);
  };

  const handleNavigateToReservation = (reservationCode) => {
    if (!reservationCode || reservationCode === "RES-PENDING") {
      navigate("/admin/reservations");
    } else {
      navigate(`/admin/reservations?search=${encodeURIComponent(reservationCode)}`);
    }
  };

  const handleDownloadReceipt = async (payment) => {
    if (!payment) return;
    try {
      setGeneratingReceipt(true);
      setActionSuccess("");
      const { generateDepositReceipt } = await import(
        "../../../../shared/utils/receiptGenerator.js"
      );

      const reservationPayload = {
        _id: payment.reservationId?._id || payment.reservationId || payment._id,
        reservationCode: payment.reservationCode,
        roomName: payment.roomName,
        roomId: { name: payment.roomName },
        selectedBed: { label: payment.bedLabel },
        branch: payment.branch,
        totalPrice: payment.amount || payment.paidAmount,
        amount: payment.amount || payment.paidAmount,
        paymentDetails: {
          referenceNumber: payment.referenceNumber,
          paymentMethod: payment.paymentMethod,
          paidAt: payment.submittedAt || new Date(),
        },
      };

      const userPayload = {
        firstName: payment.tenantFullName?.split(" ")[0] || "Applicant",
        lastName: payment.tenantFullName?.split(" ").slice(1).join(" ") || "",
        name: payment.tenantFullName,
        email: payment.tenantEmail,
      };

      await generateDepositReceipt(reservationPayload, userPayload);
      setActionSuccess("Receipt generated and downloaded successfully.");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      console.error("Failed to generate deposit receipt:", err);
      setError("Could not generate PDF receipt. Please try again.");
    } finally {
      setGeneratingReceipt(false);
    }
  };

  if (loading && payments.length === 0) {
    return <AdminTablePageSkeleton />;
  }

  return (
    <div className="space-y-4 text-card-foreground">
      {/* Header & Title */}
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
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground shadow-xs transition hover:bg-muted active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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

      {/* Top Financial KPI Summary Cards */}
      {/* Top Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-4">
        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Deposits Collected
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
              <Coins size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
            {money(summaryStats.totalCollected)}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Confirmed Settlements
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400 mt-2">
            {summaryStats.confirmedCount} Paid
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Pending / In Review
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
              <Clock size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-2">
            {summaryStats.pendingCount} Pending
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Average Deposit Fee
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-muted-foreground">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
            {money(summaryStats.averageDeposit)}
          </div>
        </div>
      </div>


      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800 shadow-xs dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-700 hover:text-red-900 transition cursor-pointer dark:text-red-300 dark:hover:text-red-100"
            aria-label="Dismiss error notice"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {actionSuccess ? (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 shadow-xs dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess("")}
            className="text-emerald-700 hover:text-emerald-900 transition cursor-pointer dark:text-emerald-300"
            aria-label="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Split-screen Master / Detail */}
      <div className="flex min-h-[580px] overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {/* LEFT — Master list (42%) */}
        <div className="w-full md:w-[42%] shrink-0 overflow-hidden border-r border-border flex flex-col bg-card">
          {/* Search, Sort & Filter Toolbar */}
          <div className="border-b border-border bg-muted/20 p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Search size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  maxLength={100}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search code, applicant, or reference..."
                  className="w-full h-9 rounded-lg border border-border bg-card pl-8.5 pr-7 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 p-0.5 rounded-full text-muted-foreground hover:text-card-foreground transition cursor-pointer"
                    aria-label="Clear search query"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none cursor-pointer"
                  title="Sort payment transactions"
                  aria-label="Sort payment transactions"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="amount_desc">Highest Amount</option>
                  <option value="amount_asc">Lowest Amount</option>
                  <option value="name_asc">Name (A–Z)</option>
                </select>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {[
                { id: "all", label: "All", count: summaryStats.totalCount },
                { id: "confirmed", label: "Confirmed", count: summaryStats.confirmedCount },
                { id: "pending", label: "Pending", count: summaryStats.pendingCount },
                { id: "failed", label: "Failed", count: summaryStats.failedCount },
              ].map((t) => {
                const isActiveTab = filterTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFilterTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 border shadow-xs cursor-pointer ${
                      isActiveTab
                        ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-100 font-bold"
                        : "bg-card text-card-foreground border-border hover:bg-muted/80 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <span>{t.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
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
                className="h-7 rounded-md border border-border bg-card px-1.5 text-[11px] font-medium text-card-foreground focus:outline-none cursor-pointer"
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
                className="inline-flex h-7.5 w-7.5 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-card-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft size={13} />
              </button>

              <span className="px-2 text-xs font-semibold text-card-foreground">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex h-7.5 w-7.5 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-card-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                    <p className="text-xs font-bold text-card-foreground">Gateway Verification</p>
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
                    <span>Direct Bed Allocation</span>
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
                    size={40}
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
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mt-0.5">
                      {selectedPayment.tenantEmail ? <span>{selectedPayment.tenantEmail} ·</span> : null}
                      <span>Reservation:</span>
                      <strong className="text-card-foreground font-mono">
                        {selectedPayment.reservationCode}
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard(selectedPayment.reservationCode, "resCode")}
                        className="inline-flex items-center text-muted-foreground hover:text-card-foreground transition cursor-pointer"
                        title="Copy Reservation Code"
                      >
                        {copiedKey === "resCode" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      </button>
                    </div>
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

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleNavigateToReservation(selectedPayment.reservationCode)}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-xs font-semibold text-card-foreground shadow-xs transition hover:bg-muted active:scale-[0.98] cursor-pointer"
                >
                  <ArrowUpRight size={13} /> View Reservation
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadReceipt(selectedPayment)}
                  disabled={generatingReceipt}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 cursor-pointer dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                >
                  {generatingReceipt ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Generating Receipt...
                    </>
                  ) : (
                    <>
                      <Download size={13} /> Download Deposit Receipt
                    </>
                  )}
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
                    <div className="flex-1 min-w-0">
                      <dt className="text-[10px] font-semibold text-muted-foreground">Reference Number</dt>
                      <dd className="font-mono text-xs font-semibold text-card-foreground mt-0.5 flex items-center gap-1.5">
                        <span className="truncate">{selectedPayment.referenceNumber}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyToClipboard(selectedPayment.referenceNumber, "refNum")}
                          className="inline-flex items-center text-muted-foreground hover:text-card-foreground transition cursor-pointer shrink-0"
                          title="Copy reference number"
                        >
                          {copiedKey === "refNum" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        </button>
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
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300 flex items-center gap-2.5">
                <ShieldCheck size={18} className="shrink-0 text-emerald-700 dark:text-emerald-500" />
                <span className="font-medium leading-relaxed">
                  Verified via PayMongo Gateway — this reservation payment was processed and reconciled with the dormitory reservation.
                </span>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
