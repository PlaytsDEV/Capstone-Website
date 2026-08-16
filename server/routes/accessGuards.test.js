import { describe, expect, jest, test } from "@jest/globals";

const noop = (_req, _res, next) => next?.();

const verifyToken = jest.fn(noop);
const verifyOnboardingToken = jest.fn(noop);
const verifyAdmin = jest.fn(noop);
const verifyOwner = jest.fn(noop);
const verifyApplicant = jest.fn(noop);
const filterByBranch = jest.fn(noop);
const validate = jest.fn(() => noop);
const createValidationMiddleware = jest.fn(() => noop);

const requirePermission = jest.fn((permission) => {
  const middleware = (_req, _res, next) => next?.();
  middleware.requiredPermission = permission;
  return middleware;
});

const requireAnyPermission = jest.fn((permissions) => {
  const middleware = (_req, _res, next) => next?.();
  middleware.requiredPermissions = permissions;
  return middleware;
});

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  verifyToken,
  verifyOnboardingToken,
  verifyAdmin,
  verifyOwner,
  verifyApplicant,
}));
await jest.unstable_mockModule("../middleware/branchAccess.js", () => ({
  filterByBranch,
}));
await jest.unstable_mockModule("../middleware/permissions.js", () => ({
  requirePermission,
  requireAnyPermission,
}));
await jest.unstable_mockModule("../middleware/validation.js", () => ({
  validateRegisterInput: jest.fn(),
  validateProfileUpdateInput: jest.fn(),
  createValidationMiddleware,
  sanitizeEmail: jest.fn((v) => v),
}));
await jest.unstable_mockModule("../validation/validate.js", () => ({
  validate,
}));
await jest.unstable_mockModule("../validation/schemas.js", () => ({
  setRoleSchema: {},
  updateBranchSchema: {},
  createAnnouncementSchema: {},
  updateAnnouncementSchema: {},
}));
await jest.unstable_mockModule("../middleware/rateLimiter.js", () => ({
  publicLimiter: noop,
  authLimiter: noop,
  reservationLimiter: noop,
  apiLimiter: noop,
}));
await jest.unstable_mockModule("../config/firebase.js", () => ({
  default: { storage: jest.fn() },
  getAuth: jest.fn(),
  getFirebaseStorage: jest.fn(() => ({ file: jest.fn() })),
}));
await jest.unstable_mockModule("../services/attachmentUploadService.js", () => ({
  ATTACHMENT_TYPE_ERROR_MESSAGE: "Unsupported attachment type",
  isAllowedAttachmentFile: jest.fn(() => true),
}));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({
  default: { log: jest.fn() },
}));
await jest.unstable_mockModule("../controllers/authController.js", () => ({
  register: noop,
  login: noop,
  verifyLoginOtp: noop,
  resendLoginOtp: noop,
  logout: noop,
  getProfile: noop,
  updateProfile: noop,
  updateBranch: noop,
  setRole: noop,
  logPasswordReset: noop,
  notifyPasswordChanged: noop,
}));
await jest.unstable_mockModule("../controllers/reservationsController.js", () => ({
  getReservations: noop,
  getCurrentResidents: noop,
  getTenantWorkspace: noop,
  getTenantWorkspaceById: noop,
  getTenantActionContext: noop,
  getVisitAvailability: noop,
  getVisitAvailabilityRules: noop,
  getVisitAvailabilityHistory: noop,
  getReservationById: noop,
  manageReservationVisit: noop,
  precheckReservationDocument: noop,
  createReservation: noop,
  updateVisitAvailabilityRules: noop,
  updateReservation: noop,
  updateReservationByUser: noop,
  cancelReservationByUser: noop,
  requestCancellationByUser: noop,
  approveCancellationRequest: noop,
  rejectCancellationRequest: noop,
  deleteReservation: noop,
  extendReservation: noop,
  releaseSlot: noop,
  archiveReservation: noop,
  restoreReservation: noop,
  renewContract: noop,
  createRenewalOffer: noop,
  cancelRenewalOffer: noop,
  respondToRenewalOffer: noop,
  getMyRenewalOffers: noop,
  moveOutReservation: noop,
  transferTenant: noop,
  getMyContract: noop,
}));
await jest.unstable_mockModule("../controllers/occupancyController.js", () => ({
  getRoomOccupancy: noop,
  getBranchOccupancyStatistics: noop,
  getVacancyForecast: noop,
}));
await jest.unstable_mockModule("../controllers/roomsController.js", () => ({
  getRooms: noop,
  getRoomById: noop,
  getOccupancyConsistency: noop,
  getOccupancyHealth: noop,
  reconcileAllOccupancy: noop,
  createRoom: noop,
  updateRoom: noop,
  deleteRoom: noop,
  addBed: noop,
  updateBed: noop,
  reorderBeds: noop,
  deleteBed: noop,
  updateBedStatus: noop,
  repairRoomOccupancy: noop,
  releaseBed: noop,
}));
await jest.unstable_mockModule("../controllers/billingController.js", () => ({
  getCurrentBilling: noop,
  getBillingHistory: noop,
  getMyBills: noop,
  downloadBillPdf: noop,
  getMyUtilityBreakdownByBillId: noop,
  submitPaymentProof: noop,
  getBillingStats: noop,
  getBillsByBranch: noop,
  getRoomsWithTenants: noop,
  getPendingVerifications: noop,
  getBillingReport: noop,
  getRentBills: noop,
  getRentBillableTenants: noop,
  getRentBillPreview: noop,
  generateRentBill: noop,
  generateAllRentBills: noop,
  sendRentBill: noop,
  sendBillReminder: noop,
  verifyPayment: noop,
  markBillAsPaid: noop,
  deleteBill: noop,
  applyPenalties: noop,
  getRoomReadiness: noop,
  publishRoomBills: noop,
  getBillingPriorityQueueAction: noop,
  createMilestoneArrangementAction: noop,
  runLatePenaltyJobAction: noop,
  getConsolidatedBillingMonitorAction: noop,
  getViolations: noop,
  getActiveTenantsForViolations: noop,
  getViolationById: noop,
  createViolation: noop,
  updateViolationDecision: noop,
  getTerminationCases: noop,
  createTerminationCase: noop,
  getOverdueNoticesAction: noop,
  sendOverdueNoticeAction: noop,
  updateTerminationDecisionAction: noop,
}));

await jest.unstable_mockModule("../controllers/announcementsController.js", () => ({
  getAnnouncements: noop,
  getAdminAnnouncements: noop,
  getUnacknowledged: noop,
  markAsRead: noop,
  acknowledgeAnnouncement: noop,
  getUserEngagementStats: noop,
  createAnnouncement: noop,
  updateAnnouncement: noop,
  deleteAnnouncement: noop,
}));
await jest.unstable_mockModule("../controllers/auditController.js", () => ({
  getAuditLogs: noop,
  getAuditStats: noop,
  getAuditLogById: noop,
  createAuditLog: noop,
  exportAuditLogs: noop,
  getFailedLogins: noop,
  cleanupAuditLogs: noop,
}));
await jest.unstable_mockModule("../controllers/maintenanceController.js", () => ({
  getMyRequests: noop,
  getAdminAll: noop,
  getAdminMaintenanceAnalytics: noop,
  getAdminMaintenanceBranchReport: noop,
  getAdminMaintenanceProviderReport: noop,
  getByBranch: noop,
  createRequest: noop,
  createRequestCompat: noop,
  getRequest: noop,
  getRequestById: noop,
  updateMyRequest: noop,
  cancelMyRequest: noop,
  reopenMyRequest: noop,
  updateRequest: noop,
  updateAdminRequestStatus: noop,
  updateAdminRequestStatusCompat: noop,
  updateAdminMaintenanceCost: noop,
  getAdminMaintenanceDuplicates: noop,
  assignAdminMaintenanceProvider: noop,
  assignAdminMaintenanceBranch: noop,
  generateAdminMaintenanceUpdate: noop,
  generateAdminMaintenanceReport: noop,
  sendAdminTenantSummary: noop,
  suggestAdminMaintenanceProvider: noop,
  rateAdminMaintenanceProvider: noop,
  uploadAdminMaintenanceAttachment: noop,
  saveAdminMaintenanceProof: noop,
  removeAdminMaintenanceAttachment: noop,
  archiveAdminMaintenanceRequest: noop,
  restoreAdminMaintenanceRequest: noop,
  sendAdminReply: noop,
  sendTenantReply: noop,
  updateAdminBulkRequests: noop,
  getCompletionStats: noop,
  getIssueFrequency: noop,
}));
await jest.unstable_mockModule("../controllers/serviceProviderController.js", () => ({
  listServiceProviders: noop,
  createServiceProvider: noop,
  updateServiceProvider: noop,
}));
await jest.unstable_mockModule("../controllers/branchSummaryController.js", () => ({
  getOwnerBranchSummaries: noop,
}));

const authRoutes = (await import("./authRoutes.js")).default;
const reservationsRoutes = (await import("./reservationsRoutes.js")).default;
const roomsRoutes = (await import("./roomsRoutes.js")).default;
const billingRoutes = (await import("./billingRoutes.js")).default;
const announcementRoutes = (await import("./announcementRoutes.js")).default;
const auditRoutes = (await import("./auditRoutes.js")).default;
const branchSummaryRoutes = (await import("./branchSummaryRoutes.js")).default;
const maintenanceRoutes = (await import("./maintenanceContractRoutes.js")).default;
const serviceProviderRoutes = (await import("./serviceProviderRoutes.js")).default;

function getRouteHandlers(router, path, method) {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method],
  );
  return layer?.route?.stack?.map((entry) => entry.handle) || [];
}

function getRouteIndex(router, path, method) {
  return router.stack.findIndex(
    (entry) => entry.route?.path === path && entry.route.methods?.[method],
  );
}

describe("route access guards", () => {
  test("auth set-role is owner-only", () => {
    const handlers = getRouteHandlers(authRoutes, "/set-role", "post");
    expect(handlers).toContain(verifyOwner);
    expect(handlers).not.toContain(verifyAdmin);
  });

  test("billing routes do not expose force-rent and enforce manageBilling", () => {
    const forceRent = billingRoutes.stack.find(
      (entry) => entry.route?.path === "/force-rent",
    );
    const handlers = getRouteHandlers(billingRoutes, "/stats", "get");

    expect(forceRent).toBeUndefined();
    expect(
      handlers.some((handler) => handler.requiredPermission === "manageBilling"),
    ).toBe(true);
  });

  test("reservation admin routes enforce reservation permissions", () => {
    const updateHandlers = getRouteHandlers(
      reservationsRoutes,
      "/:reservationId",
      "put",
    );
    const visitManagementHandlers = getRouteHandlers(
      reservationsRoutes,
      "/:reservationId/visit-management",
      "post",
    );
    const currentResidentsHandlers = getRouteHandlers(
      reservationsRoutes,
      "/current-residents",
      "get",
    );

    expect(
      updateHandlers.some(
        (handler) => handler.requiredPermission === "manageReservations",
      ),
    ).toBe(true);
    expect(
      visitManagementHandlers.some(
        (handler) => handler.requiredPermission === "manageReservations",
      ),
    ).toBe(true);
    expect(
      currentResidentsHandlers.some(
        (handler) =>
          Array.isArray(handler.requiredPermissions) &&
          handler.requiredPermissions.includes("manageReservations") &&
          handler.requiredPermissions.includes("manageTenants"),
      ),
    ).toBe(true);
  });

  test("reservation static utility routes are registered before dynamic id route", () => {
    const detailIndex = getRouteIndex(reservationsRoutes, "/:reservationId", "get");

    expect(getRouteIndex(reservationsRoutes, "/occupancy/:roomId", "get")).toBeLessThan(detailIndex);
    expect(getRouteIndex(reservationsRoutes, "/stats/occupancy", "get")).toBeLessThan(detailIndex);
    expect(getRouteIndex(reservationsRoutes, "/vacancy-forecast", "get")).toBeLessThan(detailIndex);
    expect(getRouteIndex(reservationsRoutes, "/visit-availability/settings", "get")).toBeLessThan(detailIndex);
    expect(getRouteIndex(reservationsRoutes, "/visit-availability/settings", "patch")).toBeLessThan(detailIndex);
    expect(getRouteIndex(reservationsRoutes, "/visit-availability/settings", "put")).toBeLessThan(detailIndex);
  });

  test("visit availability settings updates enforce reservation permissions", () => {
    const patchHandlers = getRouteHandlers(
      reservationsRoutes,
      "/visit-availability/settings",
      "patch",
    );
    const putHandlers = getRouteHandlers(
      reservationsRoutes,
      "/visit-availability/settings",
      "put",
    );

    for (const handlers of [patchHandlers, putHandlers]) {
      expect(handlers).toContain(verifyToken);
      expect(handlers).toContain(verifyAdmin);
      expect(handlers).toContain(filterByBranch);
      expect(
        handlers.some(
          (handler) => handler.requiredPermission === "manageReservations",
        ),
      ).toBe(true);
    }
  });

  test("room, announcement, and audit routes use module permissions", () => {
    const roomHandlers = getRouteHandlers(roomsRoutes, "/:roomId", "delete");
    const announcementHandlers = getRouteHandlers(announcementRoutes, "/", "post");
    const auditHandlers = getRouteHandlers(auditRoutes, "/", "get");

    expect(
      roomHandlers.some((handler) => handler.requiredPermission === "manageRooms"),
    ).toBe(true);
    expect(
      announcementHandlers.some(
        (handler) => handler.requiredPermission === "manageAnnouncements",
      ),
    ).toBe(true);
    expect(
      auditHandlers.some((handler) => handler.requiredPermission === "viewReports"),
    ).toBe(true);
  });

  test("audit security signals stay owner-only", () => {
    const failedLoginHandlers = getRouteHandlers(
      auditRoutes,
      "/security/failed-logins",
      "get",
    );

    expect(failedLoginHandlers).toContain(verifyToken);
    expect(failedLoginHandlers).toContain(verifyOwner);
    expect(failedLoginHandlers).not.toContain(verifyAdmin);
    expect(
      failedLoginHandlers.some(
        (handler) => handler.requiredPermission === "viewReports",
      ),
    ).toBe(false);
  });

  test("branch summary route stays owner-only", () => {
    const handlers = getRouteHandlers(branchSummaryRoutes, "/summary", "get");

    expect(handlers).toContain(verifyToken);
    expect(handlers).toContain(verifyOwner);
    expect(handlers).not.toContain(verifyAdmin);
    expect(
      handlers.some((handler) => handler.requiredPermission),
    ).toBe(false);
  });

  test("maintenance admin routes enforce manageMaintenance", () => {
    const adminListHandlers = getRouteHandlers(maintenanceRoutes, "/admin/all", "get");
    const adminUpdateHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/:requestId/status",
      "patch",
    );
    const adminAnalyticsHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/analytics",
      "get",
    );
    const adminBranchReportHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/reports/branch",
      "get",
    );
    const adminProviderReportHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/reports/providers",
      "get",
    );
    const adminReplyHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/:requestId/reply",
      "post",
    );
    const adminAssignProviderHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/:requestId/assign-provider",
      "post",
    );
    const adminAssignBranchHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/:requestId/branch",
      "patch",
    );
    const adminGenerateUpdateHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/:requestId/generate-update",
      "post",
    );
    const adminGenerateReportHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/:requestId/generate-report",
      "post",
    );
    const adminSendTenantSummaryHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/:requestId/send-tenant-summary",
      "post",
    );
    const adminCostHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/:requestId/cost",
      "patch",
    );
    const adminDuplicatesHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/:requestId/duplicates",
      "get",
    );
    const adminSuggestProviderHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/:requestId/suggest-provider",
      "post",
    );
    const adminAttachmentHandlers = getRouteHandlers(
      maintenanceRoutes,
      "/admin/:requestId/attachments",
      "post",
    );
    const legacyBranchHandlers = getRouteHandlers(maintenanceRoutes, "/branch", "get");

    expect(adminListHandlers).toContain(verifyAdmin);
    expect(adminListHandlers).toContain(filterByBranch);
    expect(
      adminListHandlers.some(
        (handler) => handler.requiredPermission === "manageMaintenance",
      ),
    ).toBe(true);

    expect(adminUpdateHandlers).toContain(verifyAdmin);
    expect(adminUpdateHandlers).toContain(filterByBranch);
    expect(
      adminUpdateHandlers.some(
        (handler) => handler.requiredPermission === "manageMaintenance",
      ),
    ).toBe(true);

    expect(adminReplyHandlers).toContain(verifyAdmin);
    expect(adminReplyHandlers).toContain(filterByBranch);
    expect(
      adminReplyHandlers.some(
        (handler) => handler.requiredPermission === "manageMaintenance",
      ),
    ).toBe(true);

    expect(adminAttachmentHandlers).toContain(verifyAdmin);
    expect(adminAttachmentHandlers).toContain(filterByBranch);
    expect(
      adminAttachmentHandlers.some(
        (handler) => handler.requiredPermission === "manageMaintenance",
      ),
    ).toBe(true);

    [adminAnalyticsHandlers, adminBranchReportHandlers, adminProviderReportHandlers, adminAssignProviderHandlers, adminAssignBranchHandlers, adminGenerateUpdateHandlers, adminGenerateReportHandlers, adminSendTenantSummaryHandlers, adminCostHandlers, adminDuplicatesHandlers, adminSuggestProviderHandlers].forEach(
      (handlers) => {
        expect(handlers).toContain(verifyAdmin);
        expect(handlers).toContain(filterByBranch);
        expect(
          handlers.some(
            (handler) => handler.requiredPermission === "manageMaintenance",
          ),
        ).toBe(true);
      },
    );

    expect(
      legacyBranchHandlers.some(
        (handler) => handler.requiredPermission === "manageMaintenance",
      ),
    ).toBe(true);
  });

  test("service provider routes enforce manageMaintenance", () => {
    const listHandlers = getRouteHandlers(serviceProviderRoutes, "/", "get");
    const createHandlers = getRouteHandlers(serviceProviderRoutes, "/", "post");
    const updateHandlers = getRouteHandlers(serviceProviderRoutes, "/:id", "patch");

    [listHandlers, createHandlers, updateHandlers].forEach((handlers) => {
      expect(handlers).toContain(verifyToken);
      expect(handlers).toContain(verifyAdmin);
      expect(handlers).toContain(filterByBranch);
      expect(
        handlers.some(
          (handler) => handler.requiredPermission === "manageMaintenance",
        ),
      ).toBe(true);
    });
  });
});
