import React, { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  X,
  CheckCircle2,
  ShieldAlert,
  DollarSign,
  FileText,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  Trash2,
  Loader2,
} from "lucide-react";
import { billingApi } from "../../../shared/api/billingApi.js";
import { showNotification } from "../../../shared/utils/notification.js";
import RecordViolationModal from "./billing/RecordViolationModal.jsx";
import ViolationDetailModal from "./billing/ViolationDetailModal.jsx";
import ProfileAvatar from "../../../shared/components/ProfileAvatar.jsx";
import ConfirmModal from "../../../shared/components/ConfirmModal.jsx";

const STATUS_FILTERS = [
  { id: "all", label: "All Infractions" },
  { id: "reported", label: "Reported" },
  { id: "under_review", label: "Under Review" },
  { id: "confirmed", label: "Confirmed" },
  { id: "warning_issued", label: "Warnings Issued" },
  { id: "penalty_issued", label: "Penalties Imposed" },
  { id: "escalated", label: "Escalated to Board" },
  { id: "dismissed", label: "Dismissed" },
  { id: "resolved", label: "Resolved" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "smoking_inside", label: "Smoking / Vaping" },
  { value: "cooking_in_room", label: "Cooking in Room" },
  { value: "unauthorized_appliance", label: "Heavy Appliance" },
  { value: "unauthorized_visitors", label: "Unauthorized Guests" },
  { value: "rfid_misuse", label: "RFID Card Misuse" },
  { value: "unauthorized_bed_transfer", label: "Bed Transfer" },
  { value: "unauthorized_room_transfer", label: "Room Transfer" },
  { value: "property_damage", label: "Property Damage" },
  { value: "cleanliness_issues", label: "Sanitation / Cleanliness" },
  { value: "persistent_unpaid_bills", label: "Persistent Dues" },
  { value: "custom", label: "Custom Infraction" },
];

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

function TenantAvatar({ avatarUrl, name, className = "h-8 w-8 text-[11px]" }) {
  const [imgError, setImgError] = useState(false);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name || "Tenant"}
        onError={() => setImgError(true)}
        className={`${className} rounded-full object-cover border border-border shrink-0`}
      />
    );
  }

  return (
    <div
      className={`flex ${className} shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[#0A1628] font-bold shadow-xs`}
    >
      {getInitials(name || "")}
    </div>
  );
}

const getStatusBadgeConfig = (status) => {
  switch (status) {
    case "confirmed":
    case "resolved":
      return { text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" };
    case "warning_issued":
    case "under_review":
    case "awaiting_response":
      return { text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" };
    case "penalty_issued":
      return { text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" };
    case "escalated":
      return { text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" };
    case "dismissed":
    default:
      return { text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-400" };
  }
};

export default function TenantViolationManager({ branch }) {
  const [violations, setViolations] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    activeWarnings: 0,
    totalPenalties: 0,
    escalatedCases: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const fetchIdRef = React.useRef(0);

  // Modals
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [violationToDelete, setViolationToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteViolation = async () => {
    if (!violationToDelete) return;
    try {
      setDeleting(true);
      await billingApi.deleteViolation(violationToDelete._id);
      showNotification("Violation record deleted successfully.", "success");
      setViolationToDelete(null);
      fetchViolations();
    } catch (err) {
      setViolationToDelete(null);
      console.error("Delete violation error:", err);
      const errText = err.message || "Failed to delete violation record.";
      showNotification(errText, "error");
    } finally {
      setDeleting(false);
    }
  };

  const fetchViolations = React.useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    try {
      setLoading(true);
      const params = {};
      if (branch && branch !== "all") params.branch = branch;
      if (statusFilter !== "all") params.status = statusFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;

      const res = await billingApi.getViolations(params);
      if (currentFetchId !== fetchIdRef.current) return;

      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setViolations(list);
      if (res?.stats) {
        setStats(res.stats);
      } else if (Array.isArray(list)) {
        setStats({
          total: list.length,
          activeWarnings: list.filter((v) => ["confirmed", "warning_issued"].includes(v.status)).length,
          totalPenalties: list.reduce((sum, v) => sum + (Number(v.penaltyApplied) || 0), 0),
          escalatedCases: list.filter((v) => v.status === "escalated").length,
        });
      }
    } catch (err) {
      if (currentFetchId === fetchIdRef.current) {
        console.error("Violations fetch error:", err);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [branch, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  const filteredViolations = useMemo(() => {
    if (!searchQuery.trim()) return violations;
    const q = searchQuery.toLowerCase();
    return violations.filter((v) => {
      const name = String(v.tenantName || v.tenantId || "").toLowerCase();
      const room = String(v.roomName || "").toLowerCase();
      const type = String(v.violationType || "").toLowerCase();
      const notes = String(v.evidenceNotes || v.description || "").toLowerCase();
      const custom = String(v.customViolationDescription || "").toLowerCase();
      return (
        name.includes(q) ||
        room.includes(q) ||
        type.includes(q) ||
        notes.includes(q) ||
        custom.includes(q)
      );
    });
  }, [violations, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-card-foreground">
            <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400" />
            Tenant Violation & Warning Log
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track dormitory rule infractions, warning counts, penalty fees, and photo evidence.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchViolations}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground shadow-xs transition hover:bg-muted active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            title="Refresh tenant violation logs"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-muted-foreground" : "text-muted-foreground"} /> Refresh
          </button>

          <button
            type="button"
            onClick={() => setRecordModalOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0A1628] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#13243D] focus-visible:ring-2 focus-visible:ring-[#D4AF37] active:scale-[0.98] dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white cursor-pointer"
            title="Log new tenant rule infraction"
          >
            <Plus size={14} /> Log Violation
          </button>
        </div>
      </div>

      {/* Top KPI Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
        <div className="group relative flex flex-col justify-between min-h-[104px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Infractions
            </span>
            <FileText size={18} className="text-slate-500 dark:text-slate-400 shrink-0" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-card-foreground mt-2">
            {stats.total}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
            Cumulative logged rule events
          </p>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[104px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Active Warnings
            </span>
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-2">
            {stats.activeWarnings}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
            Confirmed active warning notices
          </p>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[104px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Assessed Penalties
            </span>
            <DollarSign size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2">
            ₱{Number(stats.totalPenalties || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
            Monetary fines & restoration fees
          </p>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[104px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Escalated Cases
            </span>
            <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2">
            {stats.escalatedCases}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
            Sent to Termination Review Board
          </p>
        </div>
      </div>

      {/* Violations Data Card (Single Container, No Nested Boxes) */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {/* Filter Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-3.5 py-2.5">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {STATUS_FILTERS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-[#0A1628] text-white shadow-xs dark:bg-slate-100 dark:text-slate-950 font-bold"
                    : "text-muted-foreground hover:bg-card hover:text-card-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Controls: Category & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none cursor-pointer"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex items-center w-full sm:w-56">
              <Search size={14} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search violation or tenant..."
                className="w-full h-8 rounded-lg border border-border bg-card pl-8 pr-7 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 p-0.5 rounded-full text-muted-foreground hover:text-card-foreground transition cursor-pointer"
                  aria-label="Clear search query"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Violations Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">
                  Logged Date
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">
                  Tenant & Room
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">
                  Category
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">
                  Warning #
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">
                  Status
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">
                  Evidence
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">
                  Penalty Fee
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 bg-card">
              {loading ? (
                // Skeleton State
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5">
                      <div className="h-3 w-20 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-muted"></div>
                        <div className="space-y-1.5">
                          <div className="h-3 w-28 rounded bg-muted"></div>
                          <div className="h-2.5 w-16 rounded bg-muted"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-5 w-24 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-12 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-5 w-20 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-3 w-16 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="h-3 w-14 rounded bg-muted ml-auto"></div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="h-6 w-16 rounded bg-muted ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : filteredViolations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-muted-foreground">
                      <CheckCircle2 size={28} className="text-emerald-600 mb-2" />
                      <p className="font-bold text-card-foreground">No violations found</p>
                      <p className="mt-0.5 text-xs">
                        {searchQuery
                          ? `No infraction records match "${searchQuery}"`
                          : "Zero tenant rule infractions currently recorded for this selection."}
                      </p>
                      <button
                        type="button"
                        onClick={() => setRecordModalOpen(true)}
                        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground shadow-xs hover:bg-muted"
                      >
                        <Plus size={13} /> Log New Violation
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredViolations.map((v) => {
                  const primaryPhoto = v.evidenceUrls?.[0] || v.evidenceUrl;
                  return (
                    <tr
                      key={v._id}
                      onClick={() => setSelectedViolation(v)}
                      className="group cursor-pointer transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">
                        {new Date(v.createdAt).toLocaleDateString("en-PH")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <ProfileAvatar
                            user={{ name: v.tenantName }}
                            initials={getInitials(v.tenantName)}
                            size={32}
                            defaultOnly
                          />
                          <div>
                            <p className="font-bold text-card-foreground">{v.tenantName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {v.roomName} {v.branch ? `· ${v.branch}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                          {v.violationType?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {v.warningNumber ? (
                          <span className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-800 dark:text-slate-200">
                            #{v.warningNumber}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const badgeCfg = getStatusBadgeConfig(v.status);
                          return (
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${badgeCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badgeCfg.dot}`} />
                              <span>{v.status?.replace(/_/g, " ")}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {primaryPhoto ? (
                          <a
                            href={primaryPhoto}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                            title="View photo evidence in new tab"
                          >
                            <ExternalLink size={12} /> View Photo
                          </a>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600 whitespace-nowrap">
                        ₱{Number(v.penaltyApplied || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedViolation(v)}
                            aria-label={`View details for infraction #${String(v._id).slice(-6).toUpperCase()}`}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-[11px] font-semibold text-card-foreground shadow-xs hover:bg-muted transition cursor-pointer"
                          >
                            <Eye size={12} /> Details
                          </button>
                          <button
                            type="button"
                            onClick={() => setViolationToDelete(v)}
                            aria-label={`Delete infraction #${String(v._id).slice(-6).toUpperCase()}`}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-card px-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400 shadow-xs hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                            title="Delete violation record"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
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

      {/* Standardized Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(violationToDelete)}
        onClose={() => setViolationToDelete(null)}
        onConfirm={handleDeleteViolation}
        title="Delete Violation Record"
        message={
          violationToDelete
            ? `Are you sure you want to permanently delete this rule infraction record for ${violationToDelete.tenantName}?`
            : ""
        }
        variant="danger"
        confirmText="Delete Record"
        cancelText="Cancel"
        loading={deleting}
        loadingText="Deleting..."
      >
        {violationToDelete && Number(violationToDelete.penaltyApplied) > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3 text-xs text-slate-600 dark:text-slate-300">
            Associated penalty fee of{" "}
            <strong className="text-rose-600 dark:text-rose-400 font-bold">
              ₱{Number(violationToDelete.penaltyApplied).toFixed(2)}
            </strong>{" "}
            will be removed from the tenant's bill.
          </div>
        )}
      </ConfirmModal>

      {/* Record Violation Modal */}
      <RecordViolationModal
        isOpen={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        onSuccess={fetchViolations}
        branch={branch}
      />

      {/* Violation Detail & Adjudication Modal */}
      <ViolationDetailModal
        isOpen={Boolean(selectedViolation)}
        violation={selectedViolation}
        onClose={() => setSelectedViolation(null)}
        onRefresh={fetchViolations}
      />
    </div>
  );
}
