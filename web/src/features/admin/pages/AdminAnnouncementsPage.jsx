import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Megaphone,
  Pencil,
  Pin,
  Receipt,
  RotateCcw,
  ScrollText,
  Search,
  Send,
  ShieldAlert,
  Siren,
  Trash2,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "../../../shared/hooks/useAuth";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import { showNotification } from "../../../shared/utils/notification";
import { BRANCH_OPTIONS } from "../../../shared/utils/constants.js";
import {
  ANNOUNCEMENT_CATEGORY_OPTIONS,
  formatAnnouncementBranch,
  getAnnouncementCategoryMeta,
} from "../../../shared/utils/announcementConfig.js";
import {
  useAdminAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from "../../../shared/hooks/queries/useAnnouncements";
import {
  handleExportAnnouncementsCSV,
  handleExportAnnouncementsPDF,
} from "../utils/announcementExportUtils.js";
import AdminAnnouncementModal from "../components/AdminAnnouncementModal";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import Pagination from "../../../shared/components/Pagination";
import AdminPageHeader from "../../../shared/components/AdminPageHeader";
import { AdminTablePageSkeleton } from "../components/AdminContentSkeletons";

const INITIAL_FORM = {
  title: "",
  content: "",
  contentType: "announcement",
  category: "general",
  targetBranch: "both",
  requiresAcknowledgment: false,
  publicationStatus: "published",
  startsAt: "",
  endsAt: "",
  policyKey: "",
  version: 1,
  effectiveDate: "",
  isPinned: false,
};

const formatDateTime = (value) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const toDateTimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000)
    .toISOString()
    .slice(0, 16);
};

const CATEGORY_ICON_MAP = {
  Megaphone,
  Bell,
  Wrench,
  Siren,
  ScrollText,
  CalendarDays,
  Receipt,
  TriangleAlert,
};

const ringFocus = {
  onFocus: (e) => {
    e.currentTarget.style.borderColor = "var(--ring)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.outline = "none";
  },
  onBlur: (e) => {
    e.currentTarget.style.borderColor = "";
    e.currentTarget.style.boxShadow = "";
    e.currentTarget.style.outline = "";
  },
};

/**
 * Standard Export Dropdown Component (CSV & PDF)
 */
function ExportDropdown({ onExportCSV, onExportPDF, disabled, loading }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (action) => {
    setIsOpen(false);
    if (action) action();
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground shadow-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {loading ? (
          <LoaderCircle size={14} className="animate-spin text-primary" />
        ) : (
          <Download size={14} />
        )}
        <span>{loading ? "Exporting..." : "Export"}</span>
        <ChevronDown
          size={13}
          className={`text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && !disabled && !loading && (
        <div
          className="absolute right-0 z-50 mt-1.5 w-44 rounded-xl border border-border bg-card p-1 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100"
          role="menu"
        >
          <button
            type="button"
            onClick={() => handleAction(onExportCSV)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-card-foreground transition-colors hover:bg-muted"
            role="menuitem"
          >
            <FileSpreadsheet size={15} className="text-muted-foreground" />
            <span>Export as CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction(onExportPDF)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-card-foreground transition-colors hover:bg-muted"
            role="menuitem"
          >
            <FileText size={15} className="text-muted-foreground" />
            <span>Export as PDF</span>
          </button>
        </div>
      )}
    </div>
  );
}

const CATEGORY_BADGE_STYLES = {
  general: {
    background: "color-mix(in srgb, var(--primary) 12%, var(--card))",
    color: "var(--primary)",
    borderColor: "color-mix(in srgb, var(--primary) 28%, var(--border))",
  },
  reminder: {
    background: "color-mix(in srgb, var(--chart-2) 14%, var(--card))",
    color: "var(--chart-2)",
    borderColor: "color-mix(in srgb, var(--chart-2) 30%, var(--border))",
  },
  maintenance: {
    background: "color-mix(in srgb, var(--warning) 14%, var(--card))",
    color: "var(--warning-dark)",
    borderColor: "color-mix(in srgb, var(--warning) 30%, var(--border))",
  },
  policy: {
    background: "color-mix(in srgb, var(--info) 14%, var(--card))",
    color: "var(--info-dark)",
    borderColor: "color-mix(in srgb, var(--info) 30%, var(--border))",
  },
  event: {
    background: "color-mix(in srgb, var(--chart-4) 14%, var(--card))",
    color: "var(--chart-4)",
    borderColor: "color-mix(in srgb, var(--chart-4) 30%, var(--border))",
  },
  alert: {
    background: "color-mix(in srgb, var(--danger) 14%, var(--card))",
    color: "var(--danger-dark)",
    borderColor: "color-mix(in srgb, var(--danger) 30%, var(--border))",
  },
  emergency: {
    background: "color-mix(in srgb, var(--danger) 16%, var(--card))",
    color: "var(--danger-dark)",
    borderColor: "color-mix(in srgb, var(--danger) 35%, var(--border))",
  },
  billing: {
    background: "color-mix(in srgb, var(--success) 14%, var(--card))",
    color: "var(--success-dark)",
    borderColor: "color-mix(in srgb, var(--success) 30%, var(--border))",
  },
};

const getCategoryBadgeStyle = (category) =>
  CATEGORY_BADGE_STYLES[category] || {
    background: "var(--muted)",
    color: "var(--card-foreground)",
    borderColor: "var(--border)",
  };

/** Acknowledgement counter badge — Clean tinted pill with micro meter */
function AckBadge({ announcement }) {
  if (!announcement.requiresAcknowledgment) return null;
  const acked = announcement.acknowledgmentCount ?? 0;
  const total = announcement.recipientCount ?? 0;
  const percent = total > 0 ? Math.round((acked / total) * 100) : (announcement.acknowledgmentCompletionPercent ?? 0);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium"
      style={{
        borderColor: "color-mix(in srgb, var(--chart-4) 30%, var(--border))",
        background: "color-mix(in srgb, var(--chart-4) 10%, var(--card))",
        color: "var(--chart-4)",
      }}
    >
      <ShieldAlert size={12} />
      <span>Ack Required</span>
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
        style={{
          background: "var(--chart-4)",
          color: "var(--card)",
        }}
      >
        {acked}/{total}
      </span>
      <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-border sm:block">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(100, Math.max(0, percent))}%`,
            background: "var(--chart-4)",
          }}
        />
      </div>
    </div>
  );
}

/** Shared announcement row with clean, distinct, attractive category tags */
function AnnouncementCard({
  announcement,
  onEdit,
  onDelete,
  onTogglePin,
  onDuplicate,
  isPendingDelete,
  isPinning,
}) {
  const categoryMeta = getAnnouncementCategoryMeta(announcement.category);
  const CategoryIcon = CATEGORY_ICON_MAP[categoryMeta.icon] ?? Megaphone;
  const catStyle = getCategoryBadgeStyle(announcement.category);

  const pubStatusStyle =
    announcement.publicationStatus === "published"
      ? "border-success/30 bg-success/10 text-success-dark"
      : announcement.publicationStatus === "scheduled"
        ? "border-info/30 bg-info/10 text-info-dark"
        : "border-border bg-muted text-muted-foreground";

  const pubStatusLabel =
    announcement.publicationStatus === "published"
      ? "Published"
      : announcement.publicationStatus === "scheduled"
        ? "Scheduled"
        : "Draft";

  return (
    <article className="group px-6 py-4 transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-medium leading-5 text-card-foreground">
              {announcement.title}
            </h3>
            {announcement.isPinned && (
              <span
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold"
                style={{
                  borderColor: "color-mix(in srgb, var(--primary) 30%, var(--border))",
                  background: "color-mix(in srgb, var(--primary) 12%, var(--card))",
                  color: "var(--primary)",
                }}
              >
                <Pin size={10} className="fill-primary" />
                PINNED
              </span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-muted-foreground">
            {announcement.content}
          </p>
          {announcement.contentType === "policy" && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Policy key: <span className="font-mono text-card-foreground">{announcement.policyKey || "auto"}</span> · Version{" "}
              <span className="font-medium text-card-foreground">{announcement.version || 1}</span>
            </p>
          )}

          {/* Attractive, Clear Tag Row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Category — Attractive semantic color tint */}
            <span
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold"
              style={catStyle}
            >
              <CategoryIcon size={12} />
              {categoryMeta.label}
            </span>

            {/* If Policy, show distinct official policy badge */}
            {announcement.contentType === "policy" && (
              <span
                className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold"
                style={{
                  borderColor: "color-mix(in srgb, var(--info) 30%, var(--border))",
                  background: "color-mix(in srgb, var(--info) 10%, var(--card))",
                  color: "var(--info-dark)",
                }}
              >
                Official Policy
              </span>
            )}

            {/* Semantic Status Badge */}
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${pubStatusStyle}`}>
              {pubStatusLabel}
            </span>

            {/* Acknowledgement badge */}
            <AckBadge announcement={announcement} />
          </div>

          {/* Meta line */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              {announcement.startsAt
                ? formatDateTime(announcement.startsAt)
                : "No start date"}
            </span>
            <span>·</span>
            <span className="font-medium">{formatAnnouncementBranch(announcement.targetBranch)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          {/* Pin/Unpin Toggle */}
          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(announcement)}
              disabled={isPinning || isPendingDelete}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                announcement.isPinned
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-card-foreground"
              } disabled:opacity-40`}
              aria-label={announcement.isPinned ? "Unpin notice from top" : "Pin notice to top"}
              title={announcement.isPinned ? "Unpin notice from top" : "Pin notice to top"}
            >
              <Pin size={14} className={announcement.isPinned ? "fill-primary" : ""} />
            </button>
          )}

          {/* Duplicate to Composer */}
          {onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(announcement)}
              disabled={isPendingDelete}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-card-foreground disabled:opacity-40"
              aria-label="Duplicate notice to composer"
              title="Duplicate notice to composer"
            >
              <Copy size={14} />
            </button>
          )}

          {/* Edit */}
          <button
            type="button"
            onClick={() => onEdit(announcement)}
            disabled={isPendingDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-card-foreground disabled:opacity-40"
            aria-label="Edit announcement"
            title="Edit announcement"
          >
            <Pencil size={14} />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => onDelete(announcement.id)}
            disabled={isPendingDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-danger/30 hover:bg-danger/10 hover:text-danger disabled:opacity-40"
            aria-label="Delete announcement"
            title="Delete announcement"
          >
            {isPendingDelete ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

const validateAnnouncementForm = (values) => {
  const errors = {};
  const trimmedTitle = (values.title || "").trim();
  const trimmedContent = (values.content || "").trim();

  if (!trimmedTitle) {
    errors.title = "Title is required.";
  } else if (trimmedTitle.length < 3) {
    errors.title = "Title must be at least 3 characters.";
  } else if (trimmedTitle.length > 120) {
    errors.title = "Title must not exceed 120 characters.";
  }

  if (!trimmedContent) {
    errors.content = "Message content is required.";
  } else if (trimmedContent.length < 5) {
    errors.content = "Message content must be at least 5 characters.";
  } else if (trimmedContent.length > 2000) {
    errors.content = "Message content must not exceed 2000 characters.";
  }

  if (values.publicationStatus === "scheduled") {
    if (!values.startsAt) {
      errors.startsAt = "Start date and time are required for scheduled notices.";
    }
    if (values.startsAt && values.endsAt) {
      const startMs = new Date(values.startsAt).getTime();
      const endMs = new Date(values.endsAt).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs <= startMs) {
        errors.endsAt = "End date must be strictly after the start date.";
      }
    }
  }

  if (values.contentType === "policy") {
    const versionNum = Number(values.version);
    if (!versionNum || versionNum < 1 || !Number.isInteger(versionNum)) {
      errors.version = "Version must be a positive whole number.";
    }
    if (values.policyKey && !/^[a-z0-9-_]+$/i.test(values.policyKey.trim())) {
      errors.policyKey = "Policy key may only contain letters, numbers, hyphens, and underscores.";
    }
  }

  return errors;
};

const generatePolicySlug = (title) =>
  String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/* ═══════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════ */
export default function AdminAnnouncementsPage() {
  const { user } = useAuth();
  const { can, isOwner } = usePermissions();
  const [form, setForm] = useState(INITIAL_FORM);
  const [touched, setTouched] = useState({});
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);

  // Direct filters (brought outside the modal)
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const [pinningId, setPinningId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
  const { data, isLoading, isFetching } = useAdminAnnouncements(100);

  const announcements = data?.announcements || [];
  const defaultBranch = user?.branch || "both";

  const targetDeletingNotice = useMemo(
    () => announcements.find((a) => a.id === announcementToDelete),
    [announcements, announcementToDelete],
  );

  const errors = useMemo(() => validateAnnouncementForm(form), [form]);
  const isFormValid = Object.keys(errors).length === 0;

  const generalCategoryOptions = useMemo(
    () => ANNOUNCEMENT_CATEGORY_OPTIONS.filter((opt) => opt.value !== "policy"),
    [],
  );

  const stats = useMemo(
    () => ({
      drafts: announcements.filter((a) => a.publicationStatus === "draft").length,
      active: announcements.filter((a) => a.publicationStatus === "published").length,
      scheduled: announcements.filter((a) => a.publicationStatus === "scheduled").length,
      sent: announcements.filter((a) => a.publicationStatus === "published").length,
    }),
    [announcements],
  );

  // Master Filter Logic for the main list
  const filteredAnnouncements = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return announcements.filter((a) => {
      const matchesStatus = statusFilter === "all" || a.publicationStatus === statusFilter;
      const matchesCategory = categoryFilter === "all" || a.category === categoryFilter;
      const matchesType = typeFilter === "all" || a.contentType === typeFilter;
      const matchesBranch = branchFilter === "all" || a.targetBranch === branchFilter;
      const matchesQuery =
        !query ||
        [a.title, a.content, a.policyKey, a.category, a.targetBranch]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query));

      return matchesStatus && matchesCategory && matchesType && matchesBranch && matchesQuery;
    });
  }, [announcements, branchFilter, categoryFilter, searchTerm, statusFilter, typeFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, typeFilter, branchFilter, searchTerm]);

  // Paginated slice
  const paginatedAnnouncements = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAnnouncements.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAnnouncements, currentPage, itemsPerPage]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
    (isOwner && branchFilter !== "all") ||
    searchTerm.trim() !== "";

  const handleResetFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setTypeFilter("all");
    if (isOwner) setBranchFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  if (!can("manageAnnouncements")) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleChange = (field, value) => {
    setForm((prev) => {
      let updated = { ...prev, [field]: value };
      if (field === "contentType") {
        if (value === "policy") {
          updated = {
            ...updated,
            contentType: "policy",
            category: "policy",
            requiresAcknowledgment: true,
            policyKey: prev.policyKey || generatePolicySlug(prev.title),
          };
        } else {
          updated = {
            ...updated,
            contentType: "announcement",
            category: prev.category === "policy" ? "general" : prev.category,
          };
        }
      }
      if (field === "title" && prev.contentType === "policy" && (!prev.policyKey || prev.policyKey === generatePolicySlug(prev.title))) {
        updated.policyKey = generatePolicySlug(value);
      }
      if (field === "publicationStatus" && value === "scheduled" && !prev.startsAt) {
        updated = {
          ...updated,
          publicationStatus: value,
          startsAt: toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
        };
      }
      return updated;
    });
  };

  const handleExportCSV = () => {
    try {
      setIsExporting(true);
      handleExportAnnouncementsCSV({
        announcements: filteredAnnouncements,
        branchFilter: isOwner ? branchFilter : defaultBranch,
      });
      showNotification("Announcements exported as CSV successfully.", "success", 3000);
    } catch (error) {
      showNotification(error.message || "Failed to export CSV.", "error", 4000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      await handleExportAnnouncementsPDF({
        announcements: filteredAnnouncements,
        stats,
        branchFilter: isOwner ? branchFilter : defaultBranch,
        statusFilter,
        searchTerm,
      });
      showNotification("Announcements report generated as PDF successfully.", "success", 3000);
    } catch (error) {
      showNotification(error.message || "Failed to generate PDF report.", "error", 4000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleTogglePin = async (announcement) => {
    setPinningId(announcement.id);
    try {
      const nextPinned = !announcement.isPinned;
      await updateAnnouncement.mutateAsync({
        id: announcement.id,
        data: { isPinned: nextPinned },
      });
      showNotification(
        nextPinned ? "Notice pinned to top of feed." : "Notice unpinned from top.",
        "success",
        3000,
      );
    } catch (error) {
      showNotification(error.message || "Failed to update pinned status.", "error", 4000);
    } finally {
      setPinningId(null);
    }
  };

  const handleDuplicate = (announcement) => {
    setForm({
      title: `${announcement.title} (Copy)`,
      content: announcement.content || "",
      contentType: announcement.contentType || "announcement",
      category: announcement.category || "general",
      targetBranch: announcement.targetBranch || "both",
      requiresAcknowledgment: Boolean(announcement.requiresAcknowledgment),
      publicationStatus: "draft",
      startsAt: "",
      endsAt: "",
      policyKey: announcement.contentType === "policy" ? `${announcement.policyKey || ""}-copy` : "",
      version: announcement.version ? Number(announcement.version) + 1 : 1,
      effectiveDate: "",
      isPinned: Boolean(announcement.isPinned),
    });
    setTouched({});
    showNotification("Notice pre-filled in composer as a draft.", "info", 3500);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({
      title: true,
      content: true,
      startsAt: true,
      endsAt: true,
      policyKey: true,
      version: true,
    });

    const validationErrors = validateAnnouncementForm(form);
    if (Object.keys(validationErrors).length > 0) {
      showNotification("Please resolve highlighted form errors before submitting.", "error", 4000);
      return;
    }

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      contentType: form.contentType,
      category: form.category,
      requiresAcknowledgment: Boolean(form.requiresAcknowledgment),
      publicationStatus: form.publicationStatus,
      startsAt: form.publicationStatus === "scheduled" ? form.startsAt || undefined : undefined,
      endsAt: form.publicationStatus === "scheduled" ? form.endsAt || undefined : undefined,
      isPinned: Boolean(form.isPinned),
    };
    if (form.contentType === "policy") {
      payload.policyKey = form.policyKey ? form.policyKey.trim() : generatePolicySlug(form.title);
      payload.version = Number(form.version) || 1;
      payload.effectiveDate = form.effectiveDate || form.startsAt || undefined;
    }
    if (isOwner) payload.targetBranch = form.targetBranch;

    try {
      await createAnnouncement.mutateAsync(payload);
      const label = form.contentType === "policy" ? "Policy" : "Announcement";
      let successMessage = `${label} published successfully.`;
      if (form.publicationStatus === "scheduled") {
        successMessage = `${label} scheduled successfully.`;
      } else if (form.publicationStatus === "draft") {
        successMessage = `${label} draft saved successfully.`;
      }
      showNotification(successMessage, "success", 3500);
      setForm({ ...INITIAL_FORM, targetBranch: isOwner ? "both" : defaultBranch });
      setTouched({});
    } catch (error) {
      const label = form.contentType === "policy" ? "policy" : "announcement";
      showNotification(error.message || `Failed to publish ${label}.`, "error", 4000);
    }
  };

  const handleEditSubmit = async (payload) => {
    const isPolicy =
      editingAnnouncement?.contentType === "policy" || payload.contentType === "policy";
    const label = isPolicy ? "Policy" : "Announcement";
    try {
      await updateAnnouncement.mutateAsync({ id: editingAnnouncement.id, data: payload });
      showNotification(`${label} updated successfully.`, "success", 3500);
      setIsEditingModalOpen(false);
      setEditingAnnouncement(null);
    } catch (error) {
      showNotification(error.message || `Failed to update ${label.toLowerCase()}.`, "error", 4000);
    }
  };

  const handleEdit = (a) => { setEditingAnnouncement(a); setIsEditingModalOpen(true); };
  const handleCancelEdit = () => { setEditingAnnouncement(null); setIsEditingModalOpen(false); };
  const handleDeleteClick = (id) => setAnnouncementToDelete(id);
  const cancelDelete = () => { if (!deleteAnnouncement.isPending) setAnnouncementToDelete(null); };
  const confirmDelete = async () => {
    if (!announcementToDelete) return;
    const target = announcements.find((a) => a.id === announcementToDelete);
    const label = target?.contentType === "policy" ? "Policy" : "Announcement";
    try {
      await deleteAnnouncement.mutateAsync(announcementToDelete);
      showNotification(`${label} deleted successfully.`, "success", 3500);
      setAnnouncementToDelete(null);
    } catch (error) {
      setAnnouncementToDelete(null);
      showNotification(error.message || `Failed to delete ${label.toLowerCase()}.`, "error", 4000);
    }
  };

  if (isLoading && !data) {
    return <AdminTablePageSkeleton />;
  }

  const nowLocalDateTime = toDateTimeLocal(new Date());

  return (
    <div className="space-y-6">
      {/* Pattern 1 Sticky Sub-Header */}
      <AdminPageHeader
        title="Announcements"
        subtitle="Compose and broadcast branch announcements, reminders, and official policies."
        actions={
          <div className="flex items-center gap-2">
            <ExportDropdown
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              disabled={filteredAnnouncements.length === 0}
              loading={isExporting}
            />
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "TOTAL DRAFTS",
            value: stats.drafts,
            icon: ScrollText,
            iconColor: "text-slate-500 dark:text-slate-400",
          },
          {
            label: "ACTIVE NOTICES",
            value: stats.active,
            icon: Megaphone,
            iconColor: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "SCHEDULED",
            value: stats.scheduled,
            icon: CalendarDays,
            iconColor: "text-amber-600 dark:text-amber-400",
          },
          {
            label: "TOTAL PUBLISHED",
            value: stats.sent,
            icon: Send,
            iconColor: "text-sky-600 dark:text-sky-400",
          },
        ].map(({ label, value, icon: Icon, iconColor }) => (
          <div
            key={label}
            className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                {label}
              </span>
              <div className={`flex shrink-0 items-center justify-center ${iconColor}`}>
                <Icon size={18} />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 items-stretch gap-6">
        {/* ── Compose panel with Fixed Footer Ergonomics ── */}
        <section className="col-span-12 flex h-[820px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs xl:col-span-5">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex shrink-0 items-center justify-center text-sky-600 dark:text-sky-400">
                <Megaphone size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-none text-card-foreground">
                  Publish Announcement
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Compose notice or official policy for tenants
                </p>
              </div>
            </div>
          </div>

          <form className="flex flex-1 flex-col overflow-hidden" onSubmit={handleSubmit} noValidate>
            {/* Scrollable form content */}
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {/* Record type segmented pill toggle */}
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Record Type
                </span>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/50 p-1">
                  <button
                    type="button"
                    onClick={() => handleChange("contentType", "announcement")}
                    className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
                      form.contentType === "announcement"
                        ? "border border-border bg-card text-card-foreground shadow-xs"
                        : "text-muted-foreground hover:text-card-foreground"
                    }`}
                  >
                    <Megaphone size={13} />
                    General Notice
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange("contentType", "policy")}
                    className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
                      form.contentType === "policy"
                        ? "border border-border bg-card text-card-foreground shadow-xs"
                        : "text-muted-foreground hover:text-card-foreground"
                    }`}
                  >
                    <ScrollText size={13} />
                    Official Policy
                  </button>
                </div>
              </div>

              {/* Title */}
              <label className="block">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-card-foreground">
                    Title <span className="text-danger">*</span>
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {form.title.length}/120
                  </span>
                </div>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  onBlur={() => handleBlur("title")}
                  placeholder="e.g., Scheduled Water Maintenance"
                  maxLength={120}
                  aria-invalid={touched.title && Boolean(errors.title)}
                  className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none"
                  style={{
                    borderColor:
                      touched.title && errors.title ? "var(--danger)" : "var(--border)",
                  }}
                  {...ringFocus}
                />
                {touched.title && errors.title && (
                  <p className="mt-1 text-xs text-danger" role="alert">
                    {errors.title}
                  </p>
                )}
              </label>

              {/* Message */}
              <label className="block">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-card-foreground">
                    Message <span className="text-danger">*</span>
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {form.content.length}/2000
                  </span>
                </div>
                <textarea
                  value={form.content}
                  onChange={(e) => handleChange("content", e.target.value)}
                  onBlur={() => handleBlur("content")}
                  placeholder="Write notice details, instructions, or policy statements..."
                  rows={4}
                  maxLength={2000}
                  aria-invalid={touched.content && Boolean(errors.content)}
                  className="mt-1.5 min-h-[110px] w-full rounded-md border bg-card px-3 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none"
                  style={{
                    borderColor:
                      touched.content && errors.content ? "var(--danger)" : "var(--border)",
                  }}
                  {...ringFocus}
                />
                {touched.content && errors.content && (
                  <p className="mt-1 text-xs text-danger" role="alert">
                    {errors.content}
                  </p>
                )}
              </label>

              {/* Category & Publish mode */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Category</span>
                  {form.contentType === "policy" ? (
                    <input
                      type="text"
                      value="Policy"
                      readOnly
                      className="mt-1.5 h-10 w-full rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground"
                    />
                  ) : (
                    <select
                      value={form.category}
                      onChange={(e) => handleChange("category", e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                      {...ringFocus}
                    >
                      {generalCategoryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Publish Mode</span>
                  <select
                    value={form.publicationStatus}
                    onChange={(e) => handleChange("publicationStatus", e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                    {...ringFocus}
                  >
                    <option value="published">Publish immediately</option>
                    <option value="scheduled">Schedule for later</option>
                    <option value="draft">Save as draft</option>
                  </select>
                </label>
              </div>

              {/* Target branch */}
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Target Audience / Branch</span>
                {isOwner ? (
                  <select
                    value={form.targetBranch}
                    onChange={(e) => handleChange("targetBranch", e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                    {...ringFocus}
                  >
                    <option value="both">All Branches (Global)</option>
                    {BRANCH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formatAnnouncementBranch(defaultBranch)}
                    readOnly
                    className="mt-1.5 h-10 w-full rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground"
                  />
                )}
              </label>

              {/* Scheduling dates with Smart min bounds */}
              {form.publicationStatus === "scheduled" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-muted-foreground">
                      Starts At <span className="text-danger">*</span>
                    </span>
                    <input
                      type="datetime-local"
                      min={nowLocalDateTime}
                      value={form.startsAt || ""}
                      onChange={(e) => handleChange("startsAt", e.target.value)}
                      onBlur={() => handleBlur("startsAt")}
                      aria-invalid={touched.startsAt && Boolean(errors.startsAt)}
                      className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                      style={{
                        borderColor:
                          touched.startsAt && errors.startsAt ? "var(--danger)" : "var(--border)",
                      }}
                      {...ringFocus}
                    />
                    {touched.startsAt && errors.startsAt && (
                      <p className="mt-1 text-xs text-danger" role="alert">
                        {errors.startsAt}
                      </p>
                    )}
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-muted-foreground">Ends At</span>
                    <input
                      type="datetime-local"
                      min={form.startsAt || nowLocalDateTime}
                      value={form.endsAt || ""}
                      onChange={(e) => handleChange("endsAt", e.target.value)}
                      onBlur={() => handleBlur("endsAt")}
                      aria-invalid={touched.endsAt && Boolean(errors.endsAt)}
                      className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                      style={{
                        borderColor:
                          touched.endsAt && errors.endsAt ? "var(--danger)" : "var(--border)",
                      }}
                      {...ringFocus}
                    />
                    {touched.endsAt && errors.endsAt && (
                      <p className="mt-1 text-xs text-danger" role="alert">
                        {errors.endsAt}
                      </p>
                    )}
                  </label>
                </div>
              )}

              {/* Policy fields */}
              {form.contentType === "policy" && (
                <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3.5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">Policy Key</span>
                      <input
                        type="text"
                        value={form.policyKey}
                        onChange={(e) => handleChange("policyKey", e.target.value)}
                        onBlur={() => handleBlur("policyKey")}
                        placeholder="house-rules"
                        aria-invalid={touched.policyKey && Boolean(errors.policyKey)}
                        className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                        style={{
                          borderColor:
                            touched.policyKey && errors.policyKey ? "var(--danger)" : "var(--border)",
                        }}
                        {...ringFocus}
                      />
                      {touched.policyKey && errors.policyKey && (
                        <p className="mt-1 text-xs text-danger" role="alert">
                          {errors.policyKey}
                        </p>
                      )}
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">
                        Version <span className="text-danger">*</span>
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={form.version}
                        onChange={(e) => handleChange("version", e.target.value)}
                        onBlur={() => handleBlur("version")}
                        aria-invalid={touched.version && Boolean(errors.version)}
                        className="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                        style={{
                          borderColor:
                            touched.version && errors.version ? "var(--danger)" : "var(--border)",
                        }}
                        {...ringFocus}
                      />
                      {touched.version && errors.version && (
                        <p className="mt-1 text-xs text-danger" role="alert">
                          {errors.version}
                        </p>
                      )}
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">Effective Date</span>
                      <input
                        type="datetime-local"
                        value={form.effectiveDate}
                        onChange={(e) => handleChange("effectiveDate", e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none"
                        {...ringFocus}
                      />
                    </label>
                  </div>
                  {form.policyKey && (
                    <p className="text-[11px] text-muted-foreground">
                      Unique URI Identifier: <span className="font-mono text-card-foreground">/policies/{form.policyKey}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Clean Checkbox Cards */}
              <div className="grid grid-cols-1 gap-2.5 pt-1">
                {[
                  {
                    field: "requiresAcknowledgment",
                    checked: form.requiresAcknowledgment,
                    title: "Require Acknowledgment",
                    desc: "Track tenant confirmations and view completion analytics in real-time.",
                    icon: ShieldAlert,
                  },
                  {
                    field: "isPinned",
                    checked: form.isPinned,
                    title: "Pin this Notice",
                    desc: "Keep this notice prominently positioned near the top of the tenant feed.",
                    icon: Bell,
                  },
                ].map(({ field, checked, title, desc, icon: Icon }) => (
                  <label
                    key={field}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-all ${
                      checked
                        ? "border-border bg-muted/40"
                        : "border-border/70 bg-card hover:bg-muted/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => handleChange(field, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
                        <Icon size={14} className="text-muted-foreground" />
                        {title}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Fixed Action Footer */}
            <div className="shrink-0 border-t border-border bg-card px-6 py-4">
              <button
                type="submit"
                disabled={createAnnouncement.isPending || (Object.keys(touched).length > 0 && !isFormValid)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {createAnnouncement.isPending ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                <span>
                  {createAnnouncement.isPending
                    ? form.publicationStatus === "draft"
                      ? "Saving Draft..."
                      : form.publicationStatus === "scheduled"
                        ? "Scheduling Notice..."
                        : form.contentType === "policy"
                          ? "Publishing Policy..."
                          : "Publishing Announcement..."
                    : form.publicationStatus === "draft"
                      ? "Save Draft"
                      : form.publicationStatus === "scheduled"
                        ? "Schedule Notice"
                        : form.contentType === "policy"
                          ? "Publish Policy"
                          : "Publish Announcement"}
                </span>
              </button>
              {Object.keys(touched).length > 0 && !isFormValid && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Please resolve highlighted form errors before submitting.
                </p>
              )}
            </div>
          </form>
        </section>

        {/* ── Recent Announcements Panel with Direct Filters & Inline Pagination ── */}
        <section className="col-span-12 flex h-[820px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs xl:col-span-7">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex shrink-0 items-center justify-center text-amber-600 dark:text-amber-400">
                <Clock size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-none text-card-foreground">
                  Recent Announcements
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Manage broadcasts, review engagement, and filter by branch or category
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {filteredAnnouncements.length} of {announcements.length} total
              </span>
              {isFetching && (
                <LoaderCircle size={16} className="animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Row 1: Status Filter Tabs & Search */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-6 py-2">
            <div className="flex items-center gap-1">
              {[
                { id: "all", label: "All", count: announcements.length },
                { id: "published", label: "Published", count: stats.active },
                { id: "scheduled", label: "Scheduled", count: stats.scheduled },
                { id: "draft", label: "Drafts", count: stats.drafts },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    statusFilter === tab.id
                      ? "border border-border bg-card text-card-foreground shadow-xs"
                      : "text-muted-foreground hover:text-card-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-semibold tabular-nums">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative min-w-[140px] flex-1 sm:max-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search notices..."
                className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-7 text-xs text-card-foreground placeholder:text-muted-foreground focus:outline-none"
                {...ringFocus}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-card-foreground"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Category, Type & Branch Filters (Brought outside the modal) */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-6 py-2.5">
            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-card-foreground focus:outline-none"
              {...ringFocus}
            >
              <option value="all">All Categories</option>
              {ANNOUNCEMENT_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Type Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-card-foreground focus:outline-none"
              {...ringFocus}
            >
              <option value="all">All Types</option>
              <option value="announcement">Notices</option>
              <option value="policy">Policies</option>
            </select>

            {/* Branch Dropdown (for Owner) */}
            {isOwner && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-card-foreground focus:outline-none"
                {...ringFocus}
              >
                <option value="all">All Branches</option>
                {BRANCH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border/80 bg-muted px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-card-foreground"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* List Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {isLoading ? (
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-muted" />
                ))}
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                  <Megaphone size={24} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-card-foreground">No announcements found</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? "No broadcasts match your active filter criteria."
                    : "Published notices and drafts will appear here."}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-muted"
                  >
                    <RotateCcw size={12} />
                    <span>Clear all filters</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 divide-y divide-border overflow-y-auto">
                {paginatedAnnouncements.map((a) => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onTogglePin={handleTogglePin}
                    onDuplicate={handleDuplicate}
                    isPendingDelete={deleteAnnouncement.isPending}
                    isPinning={pinningId === a.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Fixed Footer: Clean Pagination */}
          <div className="shrink-0 border-t border-border bg-card px-6 py-3">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredAnnouncements.length / itemsPerPage)}
              totalItems={filteredAnnouncements.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onLimitChange={setItemsPerPage}
              pageSizeOptions={[5, 10, 15, 20]}
              itemLabel="notices"
              variant="numbered"
            />
          </div>
        </section>
      </div>

      {/* Edit Announcement Modal */}
      <AdminAnnouncementModal
        isOpen={isEditingModalOpen}
        onClose={handleCancelEdit}
        onSubmit={handleEditSubmit}
        isPending={updateAnnouncement.isPending}
        initialData={editingAnnouncement}
        isOwner={isOwner}
        defaultBranch={defaultBranch}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!announcementToDelete}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title={`Delete ${targetDeletingNotice?.contentType === "policy" ? "Policy" : "Announcement"}`}
        message={`Are you sure you want to delete this ${targetDeletingNotice?.contentType === "policy" ? "policy" : "announcement"}? This action cannot be undone.`}
        confirmText={`Delete ${targetDeletingNotice?.contentType === "policy" ? "Policy" : "Announcement"}`}
        variant="danger"
        loading={deleteAnnouncement.isPending}
      />
    </div>
  );
}