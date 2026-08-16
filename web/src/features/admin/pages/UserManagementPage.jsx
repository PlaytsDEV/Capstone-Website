import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  UserPlus,
  Search,
  Key,
  Shield,
  Edit2,
  Lock,
  Unlock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  LogIn,
  Download,
  CheckCircle2,
  ShieldCheck,
  Ban,
  Archive,
  RotateCcw,
  X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import { useAppNavigation } from "../../../shared/hooks/useAppNavigation";
import { useApiClient } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import { useQueryClient } from "@tanstack/react-query";
import { useUsers, useUserStats } from "../../../shared/hooks/queries/useUsers";
import EditUserModal from "../components/users/EditUserModal";
import AddUserModal from "../components/users/AddUserModal";
import ArchiveUserModal from "../components/users/ArchiveUserModal";
import HardDeleteUserModal from "../components/users/HardDeleteUserModal";
import RestoreUserModal from "../components/users/RestoreUserModal";
import AccountActionModal from "../components/users/AccountActionModal";
import AccountRowActions from "../components/users/AccountRowActions";
import AccountAccessDrawer from "../components/users/AccountAccessDrawer";
import ToggleSwitch from "../../../shared/components/ToggleSwitch";
import PhoneInput, { isValidPhoneNumber } from "../../../shared/components/PhoneInput";
import {
  PageShell,
  SummaryBar,
  ActionBar,
  DataTable,
  StatusBadge,
} from "../components/shared";
import { AdminTablePageSkeleton } from "../components/AdminContentSkeletons";
import RolePermissionsPage from "../../owner/pages/RolePermissionsPage";
import AdminTabs from "../../../shared/components/AdminTabs";
import { ExportButtons } from "./analyticsTabShared.js";
import {
  handleExportUsersCSV,
  handleExportUsersPDF,
} from "../utils/userExportUtils.js";
import {
  normalizeBranchFilterValue,
  syncBranchSearchParam,
} from "../../../shared/utils/branchFilterQuery.mjs";
import "../styles/design-tokens.css";
import "../styles/admin-users.css";

function renderRoleBadge(role) {
  switch (role) {
    case "owner":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/50">
          Owner
        </span>
      );
    case "branch_admin":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-info-light text-info-dark border border-info/30 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/50">
          Branch Admin
        </span>
      );
    case "tenant":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-light text-success-dark border border-success/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50">
          Tenant
        </span>
      );
    case "applicant":
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700">
          Applicant
        </span>
      );
  }
}

function formatBranch(branch) {
  if (!branch) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted/60 text-muted-foreground border border-border/50">
        Unassigned
      </span>
    );
  }
  if (branch === "gil-puyat") return "Gil Puyat";
  if (branch === "guadalupe") return "Guadalupe";
  return branch.charAt(0).toUpperCase() + branch.slice(1);
}

function UserActionMenu({
  u,
  user,
  setAccessDrawerUser,
  handleOpenPermissions,
  handleEditClick,
  setSelectedUser,
  setAccountAction,
  handleArchiveClick,
  handleHardDeleteClick,
  canManageUsers,
  isOwner,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const calculatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < 240 && rect.top > 240;

    setMenuStyle({
      position: "fixed",
      top: placeAbove ? "auto" : `${rect.bottom + 6}px`,
      bottom: placeAbove ? `${window.innerHeight - rect.top + 6}px` : "auto",
      right: `${window.innerWidth - rect.right}px`,
      zIndex: 9999,
    });
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  const currentUserId = user?._id || user?.uid || user?.id;
  const isCurrentUser = String(u._id || u.id) === String(currentUserId || "");
  const isArchived = u.isArchived === true;
  const isPrivilegedAccount = ["branch_admin", "owner"].includes(u.role);
  const canEditAccount =
    canManageUsers && !isArchived && (isOwner || !isPrivilegedAccount);
  const status = u.accountStatus || (u.isActive ? "active" : "suspended");
  const canRestoreAccount =
    canManageUsers &&
    !isCurrentUser &&
    isArchived &&
    (isOwner || !isPrivilegedAccount);
  const canDeleteAccount =
    canManageUsers && !isCurrentUser && !isArchived && (isOwner || !isPrivilegedAccount);
  const canForceDeleteAccount =
    canManageUsers && isOwner && !isCurrentUser && (!isPrivilegedAccount || isOwner);

  const canManagePermissions = isOwner && u.role === "branch_admin";
  const hasAnyMenuItem =
    canManagePermissions ||
    canEditAccount ||
    canRestoreAccount ||
    canDeleteAccount ||
    canForceDeleteAccount;

  return (
    <div
      ref={triggerRef}
      className="relative flex items-center justify-start gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {canEditAccount ? (
        <button
          onClick={() => handleEditClick(u)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Edit User Details"
        >
          <Edit2 className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={() => setAccessDrawerUser(u)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/5 text-primary transition-colors hover:bg-primary/10"
          title="View Access & Permissions"
        >
          <Shield className="h-4 w-4" />
        </button>
      )}

      {hasAnyMenuItem && (
        <button
          onClick={handleToggle}
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
          title="More actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}

      {isOpen &&
        hasAnyMenuItem &&
        createPortal(
          <div
            ref={dropdownRef}
            style={menuStyle}
            className="min-w-[180px] rounded-lg border border-border bg-card p-1 shadow-lg animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {canManagePermissions && (
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                onClick={() => {
                  setIsOpen(false);
                  handleOpenPermissions(u);
                }}
              >
                <Key className="h-4 w-4" /> Permissions
              </button>
            )}
            
            {canEditAccount && (
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                onClick={() => {
                  setIsOpen(false);
                  setAccessDrawerUser(u);
                }}
              >
                <Shield className="h-4 w-4" /> View Access
              </button>
            )}

            {canRestoreAccount && (
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
                onClick={() => {
                  setIsOpen(false);
                  setSelectedUser(u);
                  setAccountAction({ type: "restore", user: u });
                }}
              >
                <Unlock className="h-4 w-4" /> Restore Account
              </button>
            )}

            {canDeleteAccount && (
              <button
                className="mt-1 flex w-full items-center gap-2 border-t border-border pt-1.5 px-2 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
                onClick={() => {
                  setIsOpen(false);
                  handleArchiveClick(u);
                }}
              >
                <Trash2 className="h-4 w-4" /> Archive Account
              </button>
            )}

            {canForceDeleteAccount && (
              <button
                className="mt-1 flex w-full items-center gap-2 border-t border-danger/20 pt-1.5 px-2 py-1.5 text-sm font-bold text-danger hover:bg-danger-light"
                onClick={() => {
                  setIsOpen(false);
                  handleHardDeleteClick(u);
                }}
              >
                <Trash2 className="h-4 w-4" /> Force Delete
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

function UserManagementPage() {
  const { user, refreshUser } = useAuth();
  const { can, isOwner: permissionOwner } = usePermissions();
  const isOwner = permissionOwner || user?.role === "owner";
  const canManageUsers = isOwner || user?.role === "branch_admin" || can("manageUsers");
  const canViewReports = isOwner || can("viewReports");
  const appNavigate = useAppNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { authFetch } = useApiClient();
  const queryClient = useQueryClient();

  const rawTab = searchParams.get("tab") || "users";
  const activeTab = isOwner && rawTab === "roles" ? "roles" : "users";

  const userManagementTabs = useMemo(
    () => [
      {
        id: "users",
        label: "User Accounts",
        icon: Users,
      },
      {
        id: "roles",
        label: "Roles & Access Matrix",
        icon: Shield,
      },
    ],
    [],
  );

  const handleTabChange = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tabKey === "users") {
      nextParams.delete("tab");
      nextParams.delete("userId");
    } else {
      nextParams.set("tab", tabKey);
    }
    setSearchParams(nextParams, { replace: true });
  };
  const [selectedUser, setSelectedUser] = useState(null);
  const [accessDrawerUser, setAccessDrawerUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isHardDeleteModalOpen, setIsHardDeleteModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [accountAction, setAccountAction] = useState({
    type: null,
    user: null,
  });
  const [optimisticStatuses, setOptimisticStatuses] = useState({});
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get("search") || "",
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    () => (searchParams.get("search") || "").trim(),
  );
  const [roleFilter, setRoleFilter] = useState("all");
  const requestedBranch = searchParams.get("branch");
  const [branchFilter, setBranchFilter] = useState(() =>
    normalizeBranchFilterValue({
      requestedBranch: isOwner ? requestedBranch : null,
      fallbackBranch: isOwner ? null : user?.branch,
      allValue: "all",
    }),
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch !== null && urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const nextBranch = normalizeBranchFilterValue({
      requestedBranch: isOwner ? requestedBranch : null,
      fallbackBranch: isOwner ? null : user?.branch,
      allValue: "all",
    });

    setBranchFilter((current) =>
      current === nextBranch ? current : nextBranch,
    );
  }, [isOwner, requestedBranch, user?.branch]);

  useEffect(() => {
    if (!user?.role && !permissionOwner) return;

    const nextParams = syncBranchSearchParam(searchParams, branchFilter, {
      enabled: isOwner,
      allValue: "all",
    });

    if (nextParams.toString() === searchParams.toString()) return;
    setSearchParams(nextParams, { replace: true });
  }, [
    branchFilter,
    isOwner,
    permissionOwner,
    searchParams,
    setSearchParams,
    user?.role,
  ]);

  const AVATAR_COLORS = [
    "#e11d48", // rose
    "#d97706", // amber
    "#16a34a", // green
    "#2563eb", // blue
    "#7c3aed", // violet
    "#db2777", // pink
    "#0891b2", // cyan
    "#ea580c", // orange
  ];

  function getAvatarColor(userData) {
    const seed = userData._id || userData.id || userData.email || userData.username || "x";
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  const [editFormErrors, setEditFormErrors] = useState({});
  const [editForm, setEditForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "applicant",
    branch: "",
    isActive: true,
    gender: "",
    dateOfBirth: "",
    address: "",
    city: "",
    emergencyContact: "",
    emergencyPhone: "",
    studentId: "",
    school: "",
    yearLevel: "",
    tenantStatus: "applicant",
    hasActiveStay: false,
    hasLifecycleReservation: false,
    lifecycleManaged: false,
  });

  const [addForm, setAddForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "applicant",
    branch: "",
    password: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [addFormErrors, setAddFormErrors] = useState({});

  const validatePHPhoneNumber = (value) => {
    if (!value || !value.trim()) return "";
    const raw = value.trim();
    const digits = raw.replace(/\D/g, "");

    if (raw.startsWith("+")) {
      if (!/^\+639\d{9}$/.test(raw)) {
        return "Must be in +639XXXXXXXXX format";
      }
      return "";
    }

    if (raw.startsWith("0")) {
      if (!/^09\d{9}$/.test(digits)) {
        return "Must be 11 digits starting with 09 (e.g. 09171234567)";
      }
      return "";
    }

    if (raw.startsWith("9") || digits.length > 0) {
      if (!/^9\d{9}$/.test(digits)) {
        return "Must be 10 digits starting with 9 (e.g. 9171234567)";
      }
      return "";
    }

    return "Must start with 09 or 9 (e.g. 09171234567 or 9171234567)";
  };

  const validateAddField = (name, value, currentRole = addForm.role) => {
    switch (name) {
      case "username":
        if (!value) return "Username is required";
        if (value.length < 3) return "Min 3 characters";
        if (value.length > 30) return "Max 30 characters";
        if (!/^[a-zA-Z0-9_.-]+$/.test(value)) return "Only letters, numbers, underscores, hyphens, and dots";
        return "";
      case "email":
        if (!value) return "Email is required";
        if (value.length > 100) return "Max 100 characters";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email address";
        return "";
      case "firstName":
        if (!value?.trim()) return "First name is required";
        if (value.length > 50) return "Max 50 characters";
        return "";
      case "lastName":
        if (!value?.trim()) return "Last name is required";
        if (value.length > 50) return "Max 50 characters";
        return "";
      case "phone":
        return validatePHPhoneNumber(value);
      case "password":
        if (!value) return "Password is required";
        if (value.length < 6) return "Min 6 characters";
        if (value.length > 100) return "Max 100 characters";
        return "";
      case "branch":
        if (currentRole === "branch_admin" && !value) {
          return "Branch is required for branch admin";
        }
        return "";
      default:
        return "";
    }
  };

  const handleAddFormChange = (field, value) => {
    setAddForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "role" && value !== "branch_admin") {
        setAddFormErrors((errs) => ({ ...errs, branch: "" }));
      }
      return updated;
    });
    setAddFormErrors((prev) => ({
      ...prev,
      [field]: validateAddField(field, value, field === "role" ? value : addForm.role),
    }));
  };

  const validateEditField = (name, value) => {
    switch (name) {
      case "username":
        if (!value) return "Username is required";
        if (value.length < 3) return "Min 3 characters";
        if (value.length > 30) return "Max 30 characters";
        if (!/^[a-zA-Z0-9_.-]+$/.test(value)) return "Only letters, numbers, underscores, hyphens, and dots";
        return "";
      case "email":
        if (!value) return "Email is required";
        if (value.length > 100) return "Max 100 characters";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email address";
        return "";
      case "firstName":
        if (!value?.trim()) return "First name is required";
        if (value.length > 50) return "Max 50 characters";
        return "";
      case "lastName":
        if (!value?.trim()) return "Last name is required";
        if (value.length > 50) return "Max 50 characters";
        return "";
      case "phone":
        return validatePHPhoneNumber(value);
      case "emergencyPhone":
        return validatePHPhoneNumber(value);
      default:
        return "";
    }
  };

  const handleEditFormChange = (updatedForm, fieldName, fieldValue) => {
    setEditForm(updatedForm);
    if (fieldName) {
      setEditFormErrors((prev) => ({
        ...prev,
        [fieldName]: validateEditField(fieldName, fieldValue),
      }));
    }
  };

  const userFilters = useMemo(() => {
    const params = { page: currentPage, limit: ITEMS_PER_PAGE };
    if (debouncedSearchQuery) params.search = debouncedSearchQuery;
    if (roleFilter !== "all") params.role = roleFilter;
    if (branchFilter !== "all") {
      params.branch = branchFilter;
      params.includeUnbranched = "false";
    }
    if (statusFilter !== "all") {
      if (statusFilter === "restricted") {
        params.accountStatus = "suspended,banned";
      } else if (statusFilter === "archived") {
        params.accountStatus = "archived";
      } else if (
        ["active", "suspended", "banned", "pending_verification"].includes(
          statusFilter,
        )
      ) {
        params.accountStatus = statusFilter;
      }
    }
    return params;
  }, [
    currentPage,
    debouncedSearchQuery,
    roleFilter,
    branchFilter,
    statusFilter,
  ]);

  const { data: usersData, isLoading: loading } = useUsers(userFilters);
  const { data: stats } = useUserStats(branchFilter);
  const users = usersData?.users || [];
  const totalUsers =
    usersData?.pagination?.totalItems ||
    usersData?.pagination?.total ||
    users.length;

  const refetchAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["users"] }),
      queryClient.invalidateQueries({
        queryKey: ["reservations", "currentResidents"],
      }),
      queryClient.invalidateQueries({ queryKey: ["reservations"] }),
    ]);
  };

  const formatUserLabel = (userData) => {
    if (!userData) return "User";
    const fullName =
      `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
    return fullName || userData.username || userData.email || "User";
  };

  const handleOpenPermissions = (userData) => {
    if (!userData?._id) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", "roles");
    nextParams.set("userId", userData._id);
    setSearchParams(nextParams, { replace: true });
  };

  const handleEditClick = (userData) => {
    setSelectedUser(userData);
    setEditForm({
      username: userData.username || "",
      firstName: userData.firstName || "",
      lastName: userData.lastName || "",
      email: userData.email || "",
      phone: userData.phone || "",
      role: userData.role || "applicant",
      branch: userData.branch || "",
      isActive: userData.isActive !== false,
      gender: userData.gender || "",
      dateOfBirth: userData.dateOfBirth
        ? new Date(userData.dateOfBirth).toISOString().split("T")[0]
        : "",
      address: userData.address || "",
      city: userData.city || "",
      emergencyContact: userData.emergencyContact || "",
      emergencyPhone: userData.emergencyPhone || "",
      studentId: userData.studentId || "",
      school: userData.school || "",
      yearLevel: userData.yearLevel || "",
      tenantStatus: userData.tenantStatus || "applicant",
      hasActiveStay: Boolean(userData.hasActiveStay),
      hasLifecycleReservation: Boolean(userData.hasLifecycleReservation),
      lifecycleManaged:
        userData.lifecycleManaged ??
        ["applicant", "tenant"].includes(userData.role),
    });
    setEditFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    const errors = {};
    ["username", "email", "firstName", "lastName", "phone", "emergencyPhone"].forEach((f) => {
      const err = validateEditField(f, editForm[f]);
      if (err) errors[f] = err;
    });
    setEditFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showNotification("Please fix the highlighted fields", "error", 3000);
      return;
    }

    setIsUpdatingUser(true);
    try {
      await authFetch(`/users/${selectedUser._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (
        selectedUser?._id &&
        String(selectedUser._id) === String(user?.id || user?._id || "")
      ) {
        await refreshUser();
      }
      showNotification("User updated successfully", "success", 3000);
      setIsEditModalOpen(false);
      await refetchAll();
    } catch (error) {
      const msg = error.message || "";
      const code = error.code || "";
      if (msg.includes("Email already") || code === "EMAIL_TAKEN") {
        setEditFormErrors((prev) => ({ ...prev, email: "This email address is already in use" }));
        showNotification("Email is already in use.", "error", 4000);
      } else if (msg.includes("Username already") || code === "USERNAME_TAKEN") {
        setAddFormErrors((prev) => ({ ...prev, username: "This username is already taken" }));
        setEditFormErrors((prev) => ({ ...prev, username: "This username is already taken" }));
        showNotification("Username is taken.", "error", 4000);
      } else if (code === "INVALID_BRANCH" || msg.includes("Invalid branch")) {
        setEditFormErrors((prev) => ({ ...prev, branch: "Invalid branch selection" }));
        showNotification("Invalid branch selected.", "error", 4000);
      } else {
        showNotification(msg || "Failed to update user", "error", 4000);
      }
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleHardDeleteClick = (userData) => {
    setSelectedUser(userData);
    setIsHardDeleteModalOpen(true);
  };

  const handleArchiveClick = (userData) => {
    setSelectedUser(userData);
    setIsArchiveModalOpen(true);
  };

  const handleDeleteUser = async ({
    hardDelete = false,
    forceDelete = false,
    confirmationText = "",
  } = {}) => {
    try {
      const response = hardDelete
        ? await (async () => {
            const queryParams = new URLSearchParams();
            queryParams.set("hardDelete", "true");
            if (forceDelete) queryParams.set("force", "true");
            const query = `?${queryParams.toString()}`;
            return authFetch(`/users/${selectedUser._id}${query}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ confirmationText }),
            });
          })()
        : await authFetch(`/users/${selectedUser._id}/archive`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
          });

      const userLabel = formatUserLabel(selectedUser);
      if (response?.blocked) {
        showNotification(
          `${userLabel} was blocked successfully.`,
          "success",
          3000,
        );
      } else if (response?.archived) {
        showNotification(
          `${userLabel} was archived successfully.`,
          "success",
          3000,
        );
      } else if (response?.forceDeleted) {
        showNotification(
          `${userLabel} was force deleted successfully.`,
          "success",
          3000,
        );
      } else {
        showNotification(
          `${userLabel} was permanently deleted.`,
          "success",
          3000,
        );
      }

      setIsArchiveModalOpen(false);
      setIsHardDeleteModalOpen(false);
      refetchAll();
    } catch (error) {
      if (error?.code === "HARD_DELETE_BLOCKED") {
        const safeguards = error?.safeguards || {};
        const summary = [
          ["reservation(s)", safeguards.reservations],
          ["utility reading(s)", safeguards.utilityReadings],
          [
            "bill(s)",
            Number(safeguards.issuedBills || 0) +
              Number(safeguards.draftBills || 0),
          ],
          ["maintenance record(s)", safeguards.maintenanceRequests],
        ]
          .filter(([, count]) => Number(count || 0) > 0)
          .map(([label, count]) => `${count} ${label}`)
          .join(", ");
        showNotification(
          `Hard delete blocked: ${summary || "significant history found"}. Block the account instead, or use owner force delete.`,
          "error",
          5500,
        );
      } else if (error?.code === "FORCE_DELETE_CONFIRMATION_REQUIRED") {
        showNotification(
          "Type DELETE exactly to force delete this account.",
          "error",
          3500,
        );
      } else {
        showNotification(
          error.message || "Failed to delete user",
          "error",
          3000,
        );
      }
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const errors = {};
    ["username", "email", "firstName", "lastName", "phone", "password", "branch"].forEach((f) => {
      const err = validateAddField(f, addForm[f]);
      if (err) errors[f] = err;
    });
    setAddFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showNotification("Please fix the highlighted fields", "error", 3000);
      return;
    }

    setIsCreating(true);
    try {
      const createdUserLabel = formatUserLabel(addForm);
      await authFetch("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: addForm.username,
          firstName: addForm.firstName,
          lastName: addForm.lastName,
          email: addForm.email,
          phone: addForm.phone || undefined,
          role: addForm.role,
          branch: addForm.branch || undefined,
          password: addForm.password,
        }),
      });
      showNotification(
        `${createdUserLabel} was added successfully. Welcome notification sent.`,
        "success",
        4000,
      );
      setIsAddModalOpen(false);
      refetchAll();
    } catch (error) {
      const msg = error.message || "";
      const code = error.code || "";

      if (msg.includes("Email already") || code === "EMAIL_TAKEN") {
        setAddFormErrors((prev) => ({ ...prev, email: "This email address is already registered" }));
        showNotification("Email is already in use.", "error", 4000);
      } else if (msg.includes("Username already") || code === "USERNAME_TAKEN") {
        setAddFormErrors((prev) => ({ ...prev, username: "This username is already taken" }));
        showNotification("Username is taken.", "error", 4000);
      } else if (code === "BRANCH_REQUIRED" || msg.includes("Branch is required")) {
        setAddFormErrors((prev) => ({ ...prev, branch: "Branch is required for branch admin" }));
        showNotification("Branch is required.", "error", 4000);
      } else if (code === "WEAK_PASSWORD" || msg.includes("6 characters")) {
        setAddFormErrors((prev) => ({ ...prev, password: "Password must be at least 6 characters" }));
        showNotification("Password is too weak.", "error", 4000);
      } else if (msg.toLowerCase().includes("owner") || code === "ROLE_FORBIDDEN") {
        showNotification(
          "You don't have permission for this role.",
          "error",
          4000,
        );
      } else {
        showNotification(msg || "Something went wrong.", "error", 4000);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleAccountAction = async (action, userId, reason) => {
    try {
      const actionUser =
        users.find((userData) => userData._id === userId) ||
        accountAction.user ||
        selectedUser;
      const actionUserLabel = formatUserLabel(actionUser);

      if (action === "suspend") {
        await authFetch(`/users/${userId}/suspend`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        showNotification(
          `${actionUserLabel} was suspended successfully.`,
          "success",
          3000,
        );
      } else if (action === "ban") {
        await authFetch(`/users/${userId}/ban`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        showNotification(
          `${actionUserLabel} was restricted successfully.`,
          "success",
          3000,
        );
      } else if (action === "reactivate") {
        await authFetch(`/users/${userId}/reactivate`, { method: "PATCH" });
        showNotification(
          `${actionUserLabel} was reactivated successfully.`,
          "success",
          3000,
        );
      } else if (action === "restore") {
        await authFetch(`/users/${userId}/restore`, { method: "PATCH" });
        showNotification(
          `${actionUserLabel} was restored successfully.`,
          "success",
          3000,
        );
      }
      refetchAll();
    } catch (error) {
      showNotification(
        error.message || `Failed to ${action} user`,
        "error",
        3000,
      );
      throw error;
    }
  };

  const { activeDelta, suspendedDelta } = useMemo(() => {
    let activeD = 0;
    let suspendedD = 0;
    Object.entries(optimisticStatuses).forEach(([id, newStatus]) => {
      const u = users.find((item) => String(item._id || item.id) === String(id));
      if (!u) return;
      const oldStatus = u.accountStatus || (u.isActive ? "active" : "suspended");
      const wasActive = u.isActive !== false && oldStatus === "active";
      const isNowActive = newStatus === "active";
      if (wasActive && !isNowActive) {
        activeD -= 1;
        suspendedD += 1;
      } else if (!wasActive && isNowActive) {
        activeD += 1;
        suspendedD -= 1;
      }
    });
    return { activeDelta: activeD, suspendedDelta: suspendedD };
  }, [optimisticStatuses, users]);

  const summaryItems = useMemo(
    () => [
      {
        id: "total",
        label: "Total Accounts",
        value: stats?.total || totalUsers,
        icon: Users,
        color: "var(--foreground)",
      },
      {
        id: "active",
        label: "Active Accounts",
        value: Math.max(0, (stats?.activeCount || 0) + activeDelta),
        icon: CheckCircle2,
        color: "var(--color-success, #059669)",
      },
      {
        id: "admin",
        label: "Admin Accounts",
        value: (stats?.byRole?.branch_admin || 0) + (stats?.byRole?.owner || 0),
        icon: ShieldCheck,
        color: "var(--info-dark, #0284c7)",
      },
      {
        id: "blocked",
        label: "Suspended / Blocked",
        value: Math.max(
          0,
          (stats?.byAccountStatus?.suspended || 0) +
            (stats?.byAccountStatus?.banned || 0) +
            suspendedDelta,
        ),
        icon: Ban,
        color: "var(--color-warning, #d97706)",
      },
      {
        id: "archived",
        label: "Archived Accounts",
        value: stats?.archivedCount || 0,
        icon: Archive,
        color: "var(--color-danger, #e11d48)",
      },
    ],
    [stats, totalUsers, activeDelta, suspendedDelta],
  );

  const handleExportCSV = () => {
    handleExportUsersCSV({
      users,
      branchFilter: isOwner ? branchFilter : (user?.branch || "all"),
    });
  };

  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      await handleExportUsersPDF({
        users,
        stats: stats || {},
        branchFilter: isOwner ? branchFilter : (user?.branch || "all"),
        roleFilter,
        statusFilter,
        searchTerm: searchQuery,
      });
    } catch (error) {
      console.error("[UserManagement] PDF export failed:", error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const hasActiveFilters = Boolean(
    searchQuery ||
      roleFilter !== "all" ||
      statusFilter !== "all" ||
      (isOwner && branchFilter !== "all")
  );

  const handleResetFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    if (isOwner) setBranchFilter("all");
    setCurrentPage(1);
  };

  const filters = [
    {
      key: "role",
      options: [
        { value: "all", label: "All Roles" },
        { value: "applicant", label: "Applicant" },
        { value: "tenant", label: "Tenant" },
        { value: "branch_admin", label: "Branch Admin" },
        ...(isOwner ? [{ value: "owner", label: "Owner" }] : []),
      ],
      value: roleFilter,
      onChange: (v) => {
        setRoleFilter(v);
        setCurrentPage(1);
      },
    },
    ...(isOwner
      ? [
          {
            key: "branch",
            options: [
              { value: "all", label: "All Branches" },
              { value: "gil-puyat", label: "Gil Puyat" },
              { value: "guadalupe", label: "Guadalupe" },
            ],
            value: branchFilter,
            onChange: (v) => {
              setBranchFilter(v);
              setCurrentPage(1);
            },
          },
        ]
      : []),
    {
      key: "status",
      options: [
        { value: "all", label: "All Statuses" },
        { value: "active", label: "Active" },
        { value: "restricted", label: "Suspended / Blocked" },
        { value: "suspended", label: "Inactive" },
        { value: "banned", label: "Blocked account" },
        { value: "pending_verification", label: "Pending Verification" },
        { value: "archived", label: "Archived" },
      ],
      value: statusFilter,
      onChange: (v) => {
        setStatusFilter(v);
        setCurrentPage(1);
      },
    },
  ];

  if (loading && !usersData && activeTab === "users") {
    return <AdminTablePageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="mb-1 text-2xl font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Accounts & Access
          </h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Manage access credentials, verify account states, and configure role access permissions.
          </p>
        </div>

        {activeTab === "users" && (
          <div className="flex items-center gap-2.5">
            <ExportButtons
              onCsv={handleExportCSV}
              onPdf={handleExportPDF}
              loading={isExportingPdf}
              disabled={loading}
            />

            {isOwner && (
              <button
                id="btn-add-user"
                onClick={() => {
                  setAddForm({
                    username: "",
                    firstName: "",
                    lastName: "",
                    email: "",
                    phone: "",
                    role: "applicant",
                    branch: "",
                    password: "",
                  });
                  setAddFormErrors({});
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                <UserPlus className="h-4 w-4" />
                <span>Add User</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Owner Navigation Tabs */}
      {isOwner && (
        <AdminTabs
          tabs={userManagementTabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          ariaLabel="User accounts and roles management tabs"
        />
      )}

      {activeTab === "roles" && isOwner ? (
        <RolePermissionsPage isEmbedded={true} />
      ) : (
        <>
          {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {summaryItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <div
              key={item.id}
              className="rounded-lg p-4 text-left relative overflow-hidden bg-card transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm hover:-translate-y-0.5"
              style={{
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {item.label}
                </span>
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--muted)",
                    color: item.color,
                  }}
                >
                  <IconComponent className="h-4 w-4" />
                </div>
              </div>

              <div
                className="text-3xl font-bold tracking-tight"
                style={{ color: "var(--foreground)" }}
              >
                {item.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters and Search Toolbar */}
      <div
        className="rounded-lg p-4 space-y-3"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md w-full">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: "var(--muted-foreground)" }}
            />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, email, or username..."
              className="w-full pl-9 pr-8 py-2 rounded-lg text-sm focus:outline-none transition-colors"
              style={{
                backgroundColor: "var(--input-background, var(--card))",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {filters.map((f) => (
              <div key={f.key}>
                {f.component || (
                  <select
                    value={f.value || "all"}
                    onChange={(e) => f.onChange(e.target.value)}
                    className="px-3 py-2 rounded-lg text-xs font-medium focus:outline-none"
                    style={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors"
                title="Clear all active search and filter criteria"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: "30%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: "var(--muted)",
                }}
              >
                <th
                  className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  User Account
                </th>
                <th
                  className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Role
                </th>
                <th
                  className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Branch
                </th>
                <th
                  className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Account Status
                </th>
                <th
                  className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        No user accounts found
                      </p>
                      <p className="text-xs max-w-sm mx-auto" style={{ color: "var(--muted-foreground)" }}>
                        {hasActiveFilters
                          ? "No user accounts match your active search or filters. Click 'Reset' to clear your criteria."
                          : "There are currently no user accounts registered in this section."}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 text-xs font-medium text-primary hover:underline"
                        >
                          Reset all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u._id || u.id}
                    className="hover:bg-muted/30 transition-colors"
                    onClick={() => setAccessDrawerUser(u)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 flex-none rounded-full flex items-center justify-center text-white text-xs font-bold leading-none shadow-sm"
                          style={{ backgroundColor: getAvatarColor(u) }}
                        >
                          {(u.firstName && u.lastName
                            ? `${u.firstName[0]}${u.lastName[0]}`
                            : u.initials || "NA"
                          ).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-sm font-semibold truncate"
                            style={{ color: "var(--foreground)" }}
                          >
                            {u.fullName ||
                              `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                              u.username}
                          </div>
                          <div
                            className="text-xs truncate"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {renderRoleBadge(u.role)}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {formatBranch(u.branch)}
                    </td>
                    <td className="px-5 py-3.5">
                      {(() => {
                        const userId = String(u._id || u.id);
                        const isCurrentUser = u._id === (user?._id || user?.uid);
                        const isArchived = u.isArchived === true;
                        const isPrivilegedAccount = ["branch_admin", "owner"].includes(u.role);
                        const optStatus = optimisticStatuses[userId];
                        const status =
                          isArchived
                            ? "archived"
                            : optStatus ||
                              u.accountStatus ||
                              (u.isActive ? "active" : "suspended");
                        const isActive = optStatus
                          ? optStatus === "active"
                          : u.isActive !== false && status === "active";
                        const canToggle =
                          canManageUsers &&
                          !isCurrentUser &&
                          !isArchived &&
                          (isOwner || !isPrivilegedAccount);

                        const statusMeta = {
                          active: {
                            label: "Active",
                            color: "var(--color-success, #059669)",
                          },
                          pending_verification: {
                            label: "Pending",
                            color: "var(--color-warning, #d97706)",
                          },
                          suspended: {
                            label: "Inactive",
                            color: "var(--color-warning, #d97706)",
                          },
                          banned: {
                            label: "Blocked",
                            color: "var(--color-danger, #e11d48)",
                          },
                          archived: {
                            label: "Archived",
                            color: "var(--color-danger, #e11d48)",
                          },
                        }[status] || {
                          label: isActive ? "Active" : "Inactive",
                          color: isActive
                            ? "var(--color-success, #059669)"
                            : "var(--color-warning, #d97706)",
                        };

                        return (
                          <div
                            className="inline-flex items-center gap-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ToggleSwitch
                              checked={isActive}
                              disabled={!canToggle}
                              size="sm"
                              ariaLabel={`Toggle status for ${u.firstName || u.username}`}
                              onChange={async (nextActive) => {
                                const userLabel = formatUserLabel(u);
                                if (nextActive) {
                                  // Instant reactivation
                                  setOptimisticStatuses((prev) => ({
                                    ...prev,
                                    [userId]: "active",
                                  }));
                                  try {
                                    await authFetch(`/users/${userId}/reactivate`, { method: "PATCH" });
                                    showNotification(`${userLabel} was reactivated successfully.`, "success", 2500);
                                    await refetchAll();
                                  } catch (err) {
                                    setOptimisticStatuses((prev) => {
                                      const copy = { ...prev };
                                      delete copy[userId];
                                      return copy;
                                    });
                                    showNotification(err.message || "Failed to reactivate user", "error", 3000);
                                  }
                                } else {
                                  // Deactivation confirmation guard with reason chips
                                  setSelectedUser(u);
                                  setAccountAction({ type: "suspend", user: u });
                                }
                              }}
                            />
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                              <span
                                className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                                style={{ backgroundColor: statusMeta.color }}
                              />
                              <span style={{ color: statusMeta.color }}>
                                {statusMeta.label}
                              </span>
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end">
                        <UserActionMenu
                          u={u}
                          user={user}
                          setAccessDrawerUser={setAccessDrawerUser}
                          handleOpenPermissions={handleOpenPermissions}
                          handleEditClick={handleEditClick}
                          setSelectedUser={setSelectedUser}
                          setAccountAction={setAccountAction}
                          handleArchiveClick={handleArchiveClick}
                          handleHardDeleteClick={handleHardDeleteClick}
                          canManageUsers={canManageUsers}
                          isOwner={isOwner}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div
            className="text-xs font-medium"
            style={{ color: "var(--muted-foreground)" }}
          >
            Showing {users.length} of {totalUsers || users.length} accounts
          </div>
          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-foreground"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span
              className="text-xs font-semibold px-2.5"
              style={{ color: "var(--foreground)" }}
            >
              Page {currentPage} of{" "}
              {Math.max(
                1,
                Math.ceil((totalUsers || users.length) / ITEMS_PER_PAGE),
              )}
            </span>
            <button
              disabled={
                currentPage >=
                Math.ceil((totalUsers || users.length) / ITEMS_PER_PAGE)
              }
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-foreground"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals & drawers */}
      {isEditModalOpen && (
        <EditUserModal
          editForm={editForm}
          editFormErrors={editFormErrors}
          isOwner={isOwner}
          onFormChange={handleEditFormChange}
          onSubmit={handleUpdateUser}
          onClose={() => setIsEditModalOpen(false)}
          isUpdating={isUpdatingUser}
        />
      )}
      {isAddModalOpen && (
        <AddUserModal
          addForm={addForm}
          addFormErrors={addFormErrors}
          isCreating={isCreating}
          isOwner={isOwner}
          onFormChange={handleAddFormChange}
          onSubmit={handleCreateUser}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}
      {isArchiveModalOpen && (
        <ArchiveUserModal
          user={selectedUser}
          isOwner={isOwner}
          onDelete={handleDeleteUser}
          onClose={() => setIsArchiveModalOpen(false)}
        />
      )}
      {isHardDeleteModalOpen && (
        <HardDeleteUserModal
          user={selectedUser}
          isOwner={isOwner}
          onDelete={handleDeleteUser}
          onClose={() => setIsHardDeleteModalOpen(false)}
        />
      )}
      {accountAction.type === "restore" && (
        <RestoreUserModal
          user={accountAction.user}
          onConfirm={async () => {
            try {
              await handleAccountAction("restore", accountAction.user?._id, "");
            } finally {
              setAccountAction({ type: null, user: null });
            }
          }}
          onClose={() => setAccountAction({ type: null, user: null })}
        />
      )}
      {accountAction.type && accountAction.type !== "restore" && (
        <AccountActionModal
          action={accountAction.type}
          user={accountAction.user}
          onConfirm={handleAccountAction}
          onClose={() => setAccountAction({ type: null, user: null })}
        />
      )}
      <AccountAccessDrawer
        open={Boolean(accessDrawerUser)}
        userSummary={accessDrawerUser}
        onClose={() => setAccessDrawerUser(null)}
        canViewReports={canViewReports}
        canManagePermissions={isOwner}
        onOpenPermissions={handleOpenPermissions}
      />
        </>
      )}
    </div>
  );
}

export default UserManagementPage;
