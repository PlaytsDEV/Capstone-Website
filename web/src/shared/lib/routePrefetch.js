/**
 * =============================================================================
 * ROUTE PREFETCH & PRE-WARMING ENGINE
 * =============================================================================
 *
 * Provides proactive pre-fetching of both JavaScript chunks and React Query data
 * on sidebar link hover/focus and during browser idle periods.
 *
 * Features:
 * - In-memory deduplication of in-flight chunk and query fetches
 * - Safe fallback for environments without requestIdleCallback
 * - Graceful error handling (prefetch failures never throw or block UI)
 * =============================================================================
 */

import { queryKeys } from "./queryKeys";
import {
  analyticsApi,
  announcementApi,
  billingApi,
  contractApi,
  inquiryApi,
  maintenanceApi,
  notificationApi,
  reservationApi,
  roomApi,
  userApi,
  utilityApi,
} from "../api/apiClient";
import { USER_ROLES } from "../utils/constants";

// Cache of already prefetched chunk promises to prevent duplicate imports
const prefetchedChunks = new Set();
// Cache of already prefetched data keys with timestamp
const prefetchedQueries = new Map();
const QUERY_PREFETCH_TTL = 30 * 1000; // 30 seconds

/**
 * Registry of dynamic chunk loaders per route path
 */
const ROUTE_CHUNK_LOADERS = {
  // Admin Routes
  "/admin/dashboard": () => import("../../features/admin/pages/Dashboard.jsx"),
  "/admin/reservations": () => import("../../features/admin/pages/ReservationsPage.jsx"),
  "/admin/room-availability": () => import("../../features/admin/pages/RoomAvailabilityPage.jsx"),
  "/admin/tenants": () => import("../../features/admin/pages/TenantsWorkspacePage.jsx"),
  "/admin/billing": () => import("../../features/admin/pages/AdminBillingPage.jsx"),
  "/admin/announcements": () => import("../../features/admin/pages/AdminAnnouncementsPage.jsx"),
  "/admin/chat": () => import("../../features/admin/pages/AdminChatPage.jsx"),
  "/admin/maintenance": () => import("../../features/admin/pages/AdminMaintenancePage.jsx"),
  "/admin/analytics": () => import("../../features/admin/pages/AnalyticsPage.jsx"),
  "/admin/analytics/details": () => import("../../features/admin/pages/AnalyticsDetailsPage.jsx"),
  "/admin/inquiries": () => import("../../features/admin/pages/InquiriesPage.jsx"),
  "/admin/users": () => import("../../features/admin/pages/UserManagementPage.jsx"),
  "/admin/notifications": () => import("../../features/admin/pages/AdminNotificationsPage.jsx"),
  "/admin/audit-logs": () => import("../../features/admin/pages/AuditLogsPage.jsx"),
  "/admin/branches": () => import("../../features/owner/pages/BranchManagementPage.jsx"),
  "/admin/settings": () => import("../../features/owner/pages/SystemSettingsPage.jsx"),
  "/admin/roles": () => import("../../features/owner/pages/RolePermissionsPage.jsx"),
  "/admin/backups": () => import("../../features/admin/pages/SystemBackupPage.jsx"),

  // Tenant Routes
  "/applicant/profile": () => import("../../features/tenant/pages/ProfilePage.jsx"),
  "/applicant/reservation": () => import("../../features/tenant/pages/ReservationFlowPage.jsx"),
  "/applicant/check-availability": () => import("../../features/tenant/pages/CheckAvailabilityPage.jsx"),
  "/applicant/contracts": () => import("../../features/tenant/pages/ContractsPage.jsx"),
  "/applicant/billing": () => import("../../features/tenant/pages/BillingPage.jsx"),
  "/applicant/maintenance": () => import("../../features/tenant/pages/MaintenanceWorkspacePage.jsx"),
  "/applicant/announcements": () => import("../../features/tenant/pages/AnnouncementsPage.jsx"),
};

/**
 * Registry of data prefetchers per route path
 */
const ROUTE_DATA_PREFETCHERS = {
  "/admin/dashboard": (queryClient, user) => {
    const isOwner = user?.role === "super_admin" || user?.role === USER_ROLES.OWNER;
    const params = { range: "30d", ...(isOwner ? { branch: "all" } : {}) };
    return queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard.admin(params),
      queryFn: () => analyticsApi.getDashboard(params),
      staleTime: 30 * 1000,
    });
  },

  "/admin/tenants": (queryClient, user) => {
    const isOwner = user?.role === "owner";
    const branch = isOwner ? "all" : user?.branch || "all";
    const params = branch && branch !== "all" ? { branch } : {};
    return queryClient.prefetchQuery({
      queryKey: queryKeys.reservations.tenantWorkspace(params),
      queryFn: () => reservationApi.getTenantWorkspace(params),
      staleTime: 60 * 1000,
    });
  },

  "/admin/reservations": (queryClient) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.reservations.all({}),
      queryFn: () => reservationApi.getAll({}),
      staleTime: 30 * 1000,
    });
  },

  "/admin/room-availability": (queryClient, user) => {
    const defaultBranch = user?.branch && user?.role !== "owner" ? user.branch : "all";
    const filters = defaultBranch === "all" ? {} : { branch: defaultBranch };
    return queryClient.prefetchQuery({
      queryKey: queryKeys.rooms.all(filters),
      queryFn: () => roomApi.getAll(filters),
      staleTime: 60 * 1000,
    });
  },

  "/admin/billing": (queryClient, user) => {
    const branch = user?.role === "owner" ? "all" : user?.branch || "all";
    const params = branch && branch !== "all" ? { branch } : {};
    return Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.billing.byBranch(params),
        queryFn: () => billingApi.getBillsByBranch(params),
        staleTime: 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ["utilities", "electricity", "rooms", branch],
        queryFn: () => utilityApi.getRooms("electricity", branch),
        staleTime: 60 * 1000,
      }),
    ]);
  },

  "/admin/maintenance": (queryClient) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.maintenance.admin({}),
      queryFn: () => maintenanceApi.getAdminAll({}),
      staleTime: 60 * 1000,
    });
  },

  "/admin/inquiries": (queryClient) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.inquiries.all({}),
      queryFn: () => inquiryApi.getAll({}),
      staleTime: 30 * 1000,
    });
  },

  "/admin/announcements": (queryClient) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.announcements.all,
      queryFn: () => announcementApi.getAll(),
      staleTime: 60 * 1000,
    });
  },

  "/admin/notifications": (queryClient) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.notifications.all({}),
      queryFn: () => notificationApi.getAll({}),
      staleTime: 30 * 1000,
    });
  },

  "/admin/users": (queryClient) => {
    return queryClient.prefetchQuery({
      queryKey: [...queryKeys.users.all, {}],
      queryFn: () => userApi.getAll({}),
      staleTime: 60 * 1000,
    });
  },

  // Tenant Portal Prefetchers
  "/applicant/contracts": (queryClient) => {
    return queryClient.prefetchQuery({
      queryKey: ["contracts", "myContracts"],
      queryFn: () => contractApi.getMyContracts(),
      staleTime: 60 * 1000,
    });
  },

  "/applicant/billing": (queryClient) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.billing.myBills,
      queryFn: () => billingApi.getMyBills(),
      staleTime: 60 * 1000,
    });
  },

  "/applicant/maintenance": (queryClient) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.maintenance.mine({}),
      queryFn: () => maintenanceApi.getMyRequests({}),
      staleTime: 60 * 1000,
    });
  },

  "/applicant/announcements": (queryClient) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.announcements.all,
      queryFn: () => announcementApi.getAll(),
      staleTime: 60 * 1000,
    });
  },
};

/**
 * Prefetches the code chunk and data query for a specific route.
 * Call this on link hover / focus or during idle preloading.
 *
 * @param {string} routePath - The path (e.g. "/admin/tenants")
 * @param {object} queryClient - The TanStack Query client instance
 * @param {object} user - The currently authenticated user object
 */
export function prefetchRoute(routePath, queryClient = null, user = null) {
  if (!routePath) return;

  const normalizedPath = routePath.split("?")[0].replace(/\/$/, "");

  // 1. Prefetch Code Chunk
  if (!prefetchedChunks.has(normalizedPath) && ROUTE_CHUNK_LOADERS[normalizedPath]) {
    prefetchedChunks.add(normalizedPath);
    ROUTE_CHUNK_LOADERS[normalizedPath]().catch(() => {
      // Allow retry if failed
      prefetchedChunks.delete(normalizedPath);
    });
  }

  // 2. Prefetch Query Data
  if (queryClient && ROUTE_DATA_PREFETCHERS[normalizedPath]) {
    const lastPrefetch = prefetchedQueries.get(normalizedPath) || 0;
    const now = Date.now();
    if (now - lastPrefetch > QUERY_PREFETCH_TTL) {
      prefetchedQueries.set(normalizedPath, now);
      try {
        ROUTE_DATA_PREFETCHERS[normalizedPath](queryClient, user).catch(() => {});
      } catch (_) {}
    }
  }
}

/**
 * Pre-warms the most common workspace routes in the background during browser idle time.
 *
 * @param {object} queryClient - The TanStack Query client instance
 * @param {object} user - The currently authenticated user object
 */
export function prewarmIdleWorkspaceRoutes(queryClient, user) {
  if (!user) return;

  const isAdmin =
    user.role === USER_ROLES.BRANCH_ADMIN ||
    user.role === USER_ROLES.OWNER ||
    user.role === "super_admin";

  const isTenant = user.role === USER_ROLES.TENANT;

  const routesToPrewarm = isAdmin
    ? [
        "/admin/tenants",
        "/admin/reservations",
        "/admin/room-availability",
        "/admin/billing",
        "/admin/maintenance",
        "/admin/inquiries",
      ]
    : isTenant
      ? [
          "/applicant/profile",
          "/applicant/contracts",
          "/applicant/billing",
          "/applicant/maintenance",
          "/applicant/announcements",
        ]
      : ["/applicant/profile", "/applicant/reservation"];

  const runIdlePrewarm = () => {
    let index = 0;
    const prewarmNext = (deadline) => {
      while (
        index < routesToPrewarm.length &&
        (!deadline || deadline.timeRemaining() > 5 || deadline.didTimeout)
      ) {
        const route = routesToPrewarm[index];
        prefetchRoute(route, queryClient, user);
        index++;
      }

      if (index < routesToPrewarm.length) {
        scheduleNext();
      }
    };

    const scheduleNext = () => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        window.requestIdleCallback(prewarmNext, { timeout: 3000 });
      } else {
        setTimeout(prewarmNext, 250);
      }
    };

    scheduleNext();
  };

  // Give initial page mount 500ms before starting background pre-warm
  if (typeof window !== "undefined") {
    setTimeout(runIdlePrewarm, 500);
  }
}
