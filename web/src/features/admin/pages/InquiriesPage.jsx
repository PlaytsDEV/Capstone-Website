import { useState, useMemo } from "react";
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
  X as XIcon,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import PageShell from "../components/shared/PageShell";
import { reservationApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import { useInquiries } from "../../../shared/hooks/queries/useInquiries";
import { ListSkeleton } from "../../../shared/components/LoadingSkeletons";
import InquiryDetailsModal from "../components/InquiryDetailsModal";

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

const SUMMARY_FILTERS = ["", "pending", "resolved"];

function InquiriesPage({ isEmbedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const showBackToDashboard = !isEmbedded && Boolean(
    location.state?.fromDashboard || window.history.state?.idx > 0
  );
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
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

  const inquiries = Array.isArray(data) ? data : (data?.inquiries || []);
  const total = data?.pagination?.totalItems ?? data?.total ?? inquiries.length;
  const totalPages = data?.pagination?.totalPages ?? (Math.ceil(total / limit) || 1);
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/admin/dashboard");
    }
  };

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
                Recent Inquiries
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review, filter, and respond to applicant & tenant inquiries.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 mb-6">

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-2">
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
                className="px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Branches</option>
                <option value="gil-puyat">Gil Puyat</option>
                <option value="guadalupe">Guadalupe</option>
              </select>

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
                className="px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                className="px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest First</option>
                <option value="name-az">Name A-Z</option>
                <option value="name-za">Name Z-A</option>
              </select>
            </div>
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
                        <div className="flex items-center gap-3">
                          {(inquiry.subject || inquiry.inquiryType) && (
                            <span className="text-xs px-3 py-1 bg-muted text-foreground rounded-md">
                              {inquiry.subject || inquiry.inquiryType}
                            </span>
                          )}
                          <span
                            style={{
                              backgroundColor: status === "resolved" 
                                ? "var(--status-success-bg)" 
                                : "var(--status-warning-bg)",
                              color: status === "resolved" 
                                ? "var(--status-success)" 
                                : "var(--status-warning)",
                            }}
                            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                          >
                            {status === "resolved" ? "Responded" : "Pending"}
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
          {(total > 0 || inquiries.length > 0) && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-border">
              <div className="flex flex-wrap items-center gap-4">
                <p className="text-xs text-muted-foreground">
                  Showing <strong>{startItem}</strong> - <strong>{endItem}</strong> of <strong>{total}</strong> inquiries
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Rows per page:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    style={{
                      backgroundColor: "var(--input-background)",
                      borderColor: "var(--border-light)",
                    }}
                    className="px-2 py-1 text-xs border rounded-md text-foreground cursor-pointer focus:outline-none"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-light)",
                  }}
                  className="inline-flex items-center justify-center h-8 px-2.5 text-xs font-medium border rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-foreground cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Prev
                </button>

                {getPageNumbers().map((pNum) => (
                  <button
                    key={pNum}
                    onClick={() => setPage(pNum)}
                    className={`h-8 w-8 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                      page === pNum
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {pNum}
                  </button>
                ))}

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-light)",
                  }}
                  className="inline-flex items-center justify-center h-8 px-2.5 text-xs font-medium border rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-foreground cursor-pointer"
                  title="Next Page"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
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
