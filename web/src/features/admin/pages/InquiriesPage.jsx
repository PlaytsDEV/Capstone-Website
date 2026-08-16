import { useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MessageSquare,
  Search,
  User,
  Mail,
  MapPin,
  Phone,
  FileText,
  Calendar,
  ChevronDown,
  MoreVertical,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  X as XIcon,
  ArrowLeft,
} from "lucide-react";
import PageShell from "../components/shared/PageShell";
import { reservationApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import { useInquiries, useInquiryStats } from "../../../shared/hooks/queries/useInquiries";
import { useAuth } from "../../../shared/hooks/useAuth";
import { ListSkeleton, StatGridSkeleton } from "../../../shared/components/LoadingSkeletons";
import { AdminTablePageSkeleton } from "../components/AdminContentSkeletons";
import Pagination from "../../../shared/components/Pagination";
import InquiryDetailsModal from "../components/InquiryDetailsModal";
import { ExportButtons } from "./analyticsTabShared";
import {
  handleExportInquiriesCSV,
  handleExportInquiriesPDF,
} from "../utils/inquiryExportUtils";

const getAvatarColor = (initials = "") => {
  const colors = [
    "bg-[color:var(--chart-5)] text-white",
    "bg-[color:var(--chart-1)] text-white",
    "bg-[color:var(--chart-4)] text-white",
    "bg-[color:var(--danger)] text-white",
    "bg-[color:var(--chart-2)] text-white",
    "bg-[color:var(--warning)] text-white",
  ];
  const charCode = initials.length > 0 ? initials.charCodeAt(0) : 0;
  const index = charCode % colors.length;
  return colors[index];
};

function initial(name = "") {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : (parts[0]?.[0] || "?").toUpperCase();
}

function fmtDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function InquiriesPage({ isEmbedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const showBackToDashboard = !isEmbedded && Boolean(
    location.state?.fromDashboard || window.history.state?.idx > 0
  );
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // Branch admins are scoped to their branch — owners can filter across all branches
  const [branchFilter, setBranchFilter] = useState(isOwner ? "" : (user?.branch || ""));
  const activeBranchDisplay = isOwner ? branchFilter : null;
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const {
    data,
    isLoading: loading,
    refetch,
  } = useInquiries({
    page,
    limit,
    search: searchTerm,
    status: statusFilter,
    branch: branchFilter,
    sortBy,
  });

  const {
    data: statsData,
    isLoading: statsLoading,
  } = useInquiryStats(
    branchFilter ? { branch: branchFilter } : {},
    { refetchInterval: 5000, refetchOnWindowFocus: true }
  );

  const inquiries = Array.isArray(data) ? data : (data?.inquiries || []);
  const total = data?.pagination?.totalItems ?? data?.total ?? inquiries.length;
  const totalPages = data?.pagination?.totalPages ?? (Math.ceil(total / limit) || 1);

  const pendingCount = (statsData?.byStatus?.pending || 0) + (statsData?.byStatus?.new || 0);
  const resolvedCount = (statsData?.byStatus?.resolved || 0) + (statsData?.byStatus?.["in-progress"] || 0);
  const totalCount = statsData?.total ?? total;
  const recentCount = statsData?.recentCount ?? 0;

  const kpiItems = useMemo(
    () => [
      {
        key: "all",
        statusKey: "",
        label: "Total Inquiries",
        value: totalCount,
        icon: MessageSquare,
        color: "blue",
        subtext: "Total lead volume",
      },
      {
        key: "pending",
        statusKey: "pending",
        label: "New / Pending",
        value: pendingCount,
        icon: Clock,
        color: "orange",
        subtext: "Awaiting staff response",
      },
      {
        key: "resolved",
        statusKey: "resolved",
        label: "Responded",
        value: resolvedCount,
        icon: CheckCircle2,
        color: "teal",
        subtext: "Answered & resolved",
      },
      {
        key: "recent",
        statusKey: null,
        label: "Recent (7 Days)",
        value: recentCount,
        icon: Sparkles,
        color: "emerald",
        subtext: "Received this week",
      },
    ],
    [totalCount, pendingCount, resolvedCount, recentCount],
  );

  const handleExportCSV = useCallback(() => {
    handleExportInquiriesCSV({
      inquiries,
      branchFilter: branchFilter || "all",
    });
  }, [inquiries, branchFilter]);

  const handleExportPDF = useCallback(async () => {
    try {
      await handleExportInquiriesPDF({
        inquiries,
        counts: {
          total: totalCount,
          pending: pendingCount,
          resolved: resolvedCount,
          recent: recentCount,
        },
        branchFilter: branchFilter || "all",
        statusFilter,
        searchTerm,
      });
    } catch (error) {
      console.error("[InquiriesExport] PDF generation failed:", error);
    }
  }, [inquiries, totalCount, pendingCount, resolvedCount, recentCount, branchFilter, statusFilter, searchTerm]);

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/admin/dashboard");
    }
  };

  if (!isEmbedded && loading && (!inquiries || inquiries.length === 0)) {
    return <AdminTablePageSkeleton />;
  }

  return (
    <PageShell>
      <PageShell.Content>
        {!isEmbedded && (
          <div className="flex flex-col gap-2 mb-4">
            {showBackToDashboard && (
              <div>
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-card-foreground shadow-sm transition-all hover:bg-muted hover:text-foreground cursor-pointer"
                  title="Back to Dashboard"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Dashboard</span>
                </button>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Inquiries & Lead Acquisition
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review, filter, and respond to applicant & tenant inquiries across acquisition channels.
              </p>
            </div>
          </div>
        )}

        {/* KPI Summary Cards Grid */}
        {statsLoading && !statsData ? (
          <StatGridSkeleton count={4} className="mb-4" />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4" role="list" aria-label="Inquiry Statistics">
            {kpiItems.map((item) => {
              const Icon = item.icon;
              const isClickable = item.statusKey !== null;
              const isActive =
                item.key === "all"
                  ? statusFilter === ""
                  : item.statusKey
                  ? statusFilter === item.statusKey
                  : false;

              const getIconStyle = () => {
                if (item.color === "blue") return "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400";
                if (item.color === "orange") return "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400";
                if (item.color === "teal") return "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400";
                return "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400";
              };

              const getActiveStyle = () => {
                if (!isActive) return "";
                if (item.color === "blue") return "border-blue-500 ring-2 ring-inset ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20";
                if (item.color === "orange") return "border-amber-500 ring-2 ring-inset ring-amber-500/20 bg-amber-50/30 dark:bg-amber-950/20";
                if (item.color === "teal") return "border-teal-500 ring-2 ring-inset ring-teal-500/20 bg-teal-50/30 dark:bg-teal-950/20";
                return "border-emerald-500 ring-2 ring-inset ring-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20";
              };

              const handleClick = () => {
                if (!isClickable) return;
                if (item.key === "all") {
                  setStatusFilter("");
                } else if (statusFilter === item.statusKey) {
                  setStatusFilter("");
                } else {
                  setStatusFilter(item.statusKey);
                }
                setPage(1);
              };

              return (
                <div
                  key={item.key}
                  onClick={handleClick}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      handleClick();
                    }
                  }}
                  role={isClickable ? "button" : "listitem"}
                  tabIndex={isClickable ? 0 : undefined}
                  aria-pressed={isClickable ? isActive : undefined}
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: isActive ? undefined : "var(--border-light)",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
                  }}
                  className={`group relative flex flex-col justify-between min-h-[108px] rounded-xl border p-4 transition-all duration-150 ${
                    isClickable
                      ? "cursor-pointer select-none hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      : ""
                  } ${getActiveStyle()}`}
                  title={
                    isClickable
                      ? isActive
                        ? `Active filter: ${item.label}. Click to clear filter.`
                        : `Click to filter by ${item.label}`
                      : item.subtext
                  }
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                      {item.label}
                    </span>
                    <div className={`p-2 rounded-lg ${getIconStyle()}`}>
                      <Icon className="w-4 h-4" strokeWidth={2} />
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold tracking-tight text-foreground leading-none tabular-nums">
                      {item.value}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-medium truncate ml-2">
                      {item.subtext}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div
          className="border rounded-lg p-5 mb-6 overflow-visible"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-light)",
          }}
        >
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                placeholder="Search inquiries..."
                style={{
                  backgroundColor: "var(--input-background)",
                  borderColor: "var(--border-light)",
                }}
                className="w-full pl-10 pr-4 h-9 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:justify-start lg:justify-end">
              {isOwner && (
                <select
                  value={branchFilter}
                  onChange={(event) => {
                    setBranchFilter(event.target.value);
                    setPage(1);
                  }}
                  style={{
                    backgroundColor: "var(--input-background)",
                    borderColor: "var(--border-light)",
                  }}
                  className="h-9 px-3 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer hover:bg-muted transition-colors"
                >
                  <option value="">All Branches</option>
                  <option value="gil-puyat">Gil Puyat</option>
                  <option value="guadalupe">Guadalupe</option>
                </select>
              )}

              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                style={{
                  backgroundColor: "var(--input-background)",
                  borderColor: "var(--border-light)",
                }}
                className="h-9 px-3 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer hover:bg-muted transition-colors"
              >
                <option value="">All Status</option>
                <option value="pending">New / Pending</option>
                <option value="resolved">Responded / Resolved</option>
              </select>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                style={{
                  backgroundColor: "var(--input-background)",
                  borderColor: "var(--border-light)",
                }}
                className="h-9 px-3 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer hover:bg-muted transition-colors"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest First</option>
                <option value="name-az">Name A-Z</option>
                <option value="name-za">Name Z-A</option>
              </select>

              <ExportButtons
                onCsv={handleExportCSV}
                onPdf={handleExportPDF}
                disabled={inquiries.length === 0}
              />
            </div>
          </div>

          {(activeBranchDisplay || statusFilter || searchTerm) && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[var(--border-light)] text-xs">
              <span className="text-muted-foreground font-medium">Active Filters:</span>
              {activeBranchDisplay && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  Branch: {activeBranchDisplay === "gil-puyat" ? "Gil Puyat" : activeBranchDisplay === "guadalupe" ? "Guadalupe" : activeBranchDisplay}
                  <button
                    type="button"
                    onClick={() => {
                      setBranchFilter("");
                      setPage(1);
                    }}
                    className="hover:opacity-75 focus:outline-none"
                    aria-label="Clear branch filter"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  Status: {statusFilter === "pending" ? "New / Pending" : statusFilter === "resolved" ? "Responded / Resolved" : statusFilter}
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("");
                      setPage(1);
                    }}
                    className="hover:opacity-75 focus:outline-none"
                    aria-label="Clear status filter"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  Search: "{searchTerm}"
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setPage(1);
                    }}
                    className="hover:opacity-75 focus:outline-none"
                    aria-label="Clear search query"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (isOwner) {
                    setBranchFilter("");
                  }
                  setStatusFilter("");
                  setSearchTerm("");
                  setPage(1);
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

          <div className="space-y-4">
            {loading ? (
              <ListSkeleton rows={6} avatar />
            ) : inquiries.length === 0 ? (
              <div className="p-12 text-center">
                <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                <p className="text-base font-medium text-foreground">
                  No inquiries found
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your filters.
                </p>
              </div>
            ) : (
              inquiries.map((inquiry) => {
                const name =
                  inquiry.name ||
                  inquiry.fullName ||
                  `${inquiry.firstName || ""} ${inquiry.lastName || ""}`.trim() ||
                  "Unknown";
                const status = inquiry.status || "pending";
                const isNew = status === "pending";

                return (
                  <div
                    key={inquiry._id}
                    onClick={() => setSelectedInquiry(inquiry)}
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border-light, rgba(0, 0, 0, 0.05))",
                    }}
                    className="flex items-start justify-between p-5 border border-border/40 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 cursor-pointer hover:bg-muted/40 hover:border-border/70"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-medium ${getAvatarColor(initial(name))}`}
                      >
                        {initial(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">
                                {name}
                              </h3>
                              {isNew && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  NEW
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {inquiry.email || "-"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {fmtDate(inquiry.createdAt)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInquiry(inquiry);
                              }}
                              className="p-1 hover:bg-muted rounded-md transition-colors"
                            >
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                        {inquiry.message && (
                          <p className="text-sm text-foreground mb-2 line-clamp-2">
                            {inquiry.message}
                          </p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          {(inquiry.subject || inquiry.inquiryType) && (
                            <span className="text-xs px-3 py-1 bg-muted text-foreground rounded-md">
                              {inquiry.subject || inquiry.inquiryType}
                            </span>
                          )}
                          <span
                            style={{
                              backgroundColor:
                                status === "resolved"
                                  ? inquiry.emailDeliveryStatus === "failed"
                                    ? "#fffbeb"
                                    : "var(--status-success-bg)"
                                  : "var(--status-warning-bg)",
                              color:
                                status === "resolved"
                                  ? inquiry.emailDeliveryStatus === "failed"
                                    ? "#b45309"
                                    : "var(--status-success)"
                                  : "var(--status-warning)",
                              border:
                                inquiry.emailDeliveryStatus === "failed"
                                  ? "1px solid #fde68a"
                                  : "none",
                            }}
                            className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"
                          >
                            {status === "resolved"
                              ? inquiry.emailDeliveryStatus === "failed"
                                ? "Email Undelivered"
                                : "Responded"
                              : "Pending"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Pagination Control Bar */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={limit}
            onPageChange={setPage}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            pageSizeOptions={[5, 10, 20, 50]}
            itemLabel="inquiries"
            variant="numbered"
            className="mt-6 pt-4 border-t border-border"
          />
        </PageShell.Content>

      {selectedInquiry && (
        <InquiryDetailsModal
          inquiry={selectedInquiry}
          onClose={() => setSelectedInquiry(null)}
          onUpdate={refetch}
        />
      )}
    </PageShell>
  );
}

export default InquiriesPage;
