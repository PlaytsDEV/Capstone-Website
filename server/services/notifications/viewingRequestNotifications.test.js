import { describe, expect, jest, test, beforeEach } from "@jest/globals";

const saveMock = jest.fn().mockResolvedValue(true);
const NotificationMock = jest.fn().mockImplementation((data) => ({
  ...data,
  save: saveMock,
}));

await jest.unstable_mockModule("../../models/Notification.js", () => ({
  default: NotificationMock,
}));

const emitToUserMock = jest.fn();
await jest.unstable_mockModule("../../utils/socket.js", () => ({
  emitToUser: emitToUserMock,
  emitToAdmins: jest.fn(),
}));

await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

await jest.unstable_mockModule("./mobilePushService.js", () => ({
  sendMobilePushBill: jest.fn().mockResolvedValue(true),
  sendMobilePushToRecipients: jest.fn().mockResolvedValue(true),
}));

const { notify } = await import("./notificationService.js");
const {
  isNotificationVisibleForRole,
  getNotificationVisibilityFilterForRole,
  ADMIN_NOTIFICATION_TYPES,
} = await import("./notificationVisibility.js");

describe("Viewing Request Admin Notifications (TDD Suite)", () => {
  beforeEach(() => {
    NotificationMock.mockClear();
    saveMock.mockClear();
    emitToUserMock.mockClear();
  });

  describe("notify.visitScheduledAlert - Notification payload and formatting", () => {
    test("creates physical visit alert with deep-link actionUrl and reservation entityId", async () => {
      await notify.visitScheduledAlert("admin-1", {
        tenantName: "VinceGamer Guest",
        roomName: "GP - Room 201",
        branch: "gil-puyat",
        visitDate: "2026-08-27T00:00:00.000Z",
        visitTime: "08:00 AM",
        reservationId: "res-12345",
        viewingPreference: "physical_visit",
      });

      expect(NotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-1",
          type: expect.stringMatching(/^(visit_requested|visit_scheduled)$/),
          title: "New Visit Schedule",
          message: expect.stringContaining("VinceGamer Guest scheduled a visit for GP - Room 201 on Aug 27, 2026 at 08:00 AM"),
          entityType: "reservation",
          entityId: "res-12345",
          actionUrl: "/admin/reservations?reservationId=res-12345&tab=visits",
        }),
      );
    });

    test("creates 2D remote viewing request alert with proper title and deep-link actionUrl", async () => {
      await notify.visitScheduledAlert("admin-1", {
        tenantName: "VinceGamer Guest",
        roomName: "GP - Room 201",
        branch: "gil-puyat",
        reservationId: "res-12345",
        viewingPreference: "remote_2d_viewing",
      });

      expect(NotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-1",
          type: expect.stringMatching(/^(visit_requested|visit_scheduled)$/),
          title: "2D Remote Viewing Request",
          message: "VinceGamer Guest requested photo-based remote viewing for GP - Room 201.",
          entityType: "reservation",
          entityId: "res-12345",
          actionUrl: "/admin/reservations?reservationId=res-12345&tab=visits",
        }),
      );
    });

    test("creates urgent move-in review request alert with proper title and deep-link actionUrl", async () => {
      await notify.visitScheduledAlert("admin-1", {
        tenantName: "VinceGamer Guest",
        roomName: "GP - Room 201",
        branch: "gil-puyat",
        reservationId: "res-12345",
        viewingPreference: "urgent_move_in_review",
      });

      expect(NotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-1",
          type: expect.stringMatching(/^(visit_requested|visit_scheduled)$/),
          title: "Priority Viewing Review Request",
          message: "VinceGamer Guest requested priority viewing review for GP - Room 201.",
          entityType: "reservation",
          entityId: "res-12345",
          actionUrl: "/admin/reservations?reservationId=res-12345&tab=visits",
        }),
      );
    });

    test("creates rescheduled visit alert when isReschedule flag is true", async () => {
      await notify.visitScheduledAlert("admin-1", {
        tenantName: "VinceGamer Guest",
        roomName: "GP - Room 201",
        branch: "gil-puyat",
        visitDate: "2026-08-28T00:00:00.000Z",
        visitTime: "10:00 AM",
        reservationId: "res-12345",
        viewingPreference: "physical_visit",
        isReschedule: true,
      });

      expect(NotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-1",
          type: expect.stringMatching(/^(visit_requested|visit_scheduled)$/),
          title: "Visit Rescheduled",
          message: expect.stringContaining("VinceGamer Guest rescheduled a visit for GP - Room 201 on Aug 28, 2026 at 10:00 AM"),
          entityType: "reservation",
          entityId: "res-12345",
          actionUrl: "/admin/reservations?reservationId=res-12345&tab=visits",
        }),
      );
    });
  });

  describe("Role Visibility — ADMIN_NOTIFICATION_TYPES whitelist", () => {
    test("Dorm Owner and Branch Admin can see visit_requested and visit_scheduled", () => {
      expect(isNotificationVisibleForRole({ type: "visit_requested" }, "owner")).toBe(true);
      expect(isNotificationVisibleForRole({ type: "visit_requested" }, "branch_admin")).toBe(true);
      expect(isNotificationVisibleForRole({ type: "visit_scheduled" }, "owner")).toBe(true);
      expect(isNotificationVisibleForRole({ type: "visit_scheduled" }, "branch_admin")).toBe(true);
    });

    test("Mongo visibility filter for owner and branch_admin includes visit_requested and visit_scheduled", () => {
      const ownerFilter = getNotificationVisibilityFilterForRole("owner");
      const branchAdminFilter = getNotificationVisibilityFilterForRole("branch_admin");

      expect(ownerFilter.type.$in).toContain("visit_requested");
      expect(ownerFilter.type.$in).toContain("visit_scheduled");
      expect(branchAdminFilter.type.$in).toContain("visit_requested");
      expect(branchAdminFilter.type.$in).toContain("visit_scheduled");
    });
  });
});
