import { describe, expect, jest, test } from "@jest/globals";

const saveMock = jest.fn().mockResolvedValue(true);
const NotificationMock = jest.fn().mockImplementation((data) => ({
  ...data,
  save: saveMock,
}));

await jest.unstable_mockModule("../../models/Notification.js", () => ({
  default: NotificationMock,
}));

await jest.unstable_mockModule("../../utils/socket.js", () => ({
  emitToUser: jest.fn(),
}));

await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const sendMobilePushBillMock = jest.fn().mockResolvedValue(true);
const sendMobilePushToRecipientsMock = jest.fn().mockResolvedValue(true);
await jest.unstable_mockModule("./mobilePushService.js", () => ({
  sendMobilePushBill: sendMobilePushBillMock,
  sendMobilePushToRecipients: sendMobilePushToRecipientsMock,
}));

const { notify } = await import("./notificationService.js");

describe("notificationService - reservation code formatting", () => {
  test("formats reservationCancelled without 'N/A' when code is missing or 'N/A'", async () => {
    await notify.reservationCancelled("user-123", "N/A", "Cancelled by applicant");
    expect(NotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Your reservation has been cancelled. Reason: Cancelled by applicant.",
      }),
    );
  });

  test("formats reservationCancelled with code when code is valid", async () => {
    await notify.reservationCancelled("user-123", "RES-998877", "Cancelled by applicant");
    expect(NotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Your reservation RES-998877 has been cancelled. Reason: Cancelled by applicant.",
      }),
    );
  });

  test("formats reservationConfirmed gracefully when code is missing", async () => {
    await notify.reservationConfirmed("user-123", null, "Room 101");
    expect(NotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Your reservation for Room 101 has been confirmed.",
      }),
    );
  });
});

// Regression coverage for the bill-release notification audit.
//
// Root cause #1: utilityChargeAvailable() used createNotification() (DB
// record + realtime socket event only) instead of createNotificationWithPush(),
// and never accepted/attached a billId at all — every electricity/water bill
// release produced a silent, push-less notification with no deep-linkable
// bill reference. This is the actual reason a tenant "does not receive a
// notification on mobile" for utility bills specifically: no OS push ever
// fired for that bill type.
describe("notify.utilityChargeAvailable — push + billId (bill-release notification fix)", () => {
  beforeEach(() => {
    sendMobilePushToRecipientsMock.mockClear();
    NotificationMock.mockClear();
  });

  test("sends a push notification (previously: none at all)", async () => {
    await notify.utilityChargeAvailable(
      "user-123", "electricity", "August 2026", 1760, 1760, "August 23, 2026",
      { billId: "abc123" },
    );
    expect(sendMobilePushToRecipientsMock).toHaveBeenCalledTimes(1);
  });

  test("does not dispatch an orphan push when canonical notification persistence fails", async () => {
    saveMock.mockRejectedValueOnce(new Error("database unavailable"));
    await notify.utilityChargeAvailable(
      "user-123", "electricity", "August 2026", 1760, 1760, "August 23, 2026",
      { billId: "abc123" },
    );
    expect(sendMobilePushToRecipientsMock).not.toHaveBeenCalled();
  });

  test("push payload carries screen: 'billing' and a non-empty billing_id so the mobile app can deep-link to the specific bill", async () => {
    await notify.utilityChargeAvailable(
      "user-123", "water", "August 2026", 450, 2210, "August 23, 2026",
      { billId: "def456" },
    );
    const [, payload] = sendMobilePushToRecipientsMock.mock.calls[0];
    expect(payload.data.screen).toBe("billing");
    expect(payload.data.billing_id).toBe("def456");
  });

  test("the persisted Notification document carries entityId (previously always null)", async () => {
    await notify.utilityChargeAvailable(
      "user-123", "electricity", "August 2026", 1760, 1760, "August 23, 2026",
      { billId: "abc123" },
    );
    expect(NotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "bill", entityId: "abc123" }),
    );
  });

  test("still creates the DB notification even with no billId (no regression — falls back to the tab, not a crash)", async () => {
    await notify.utilityChargeAvailable("user-123", "electricity", "August 2026", 1760, 1760, "August 23, 2026");
    expect(NotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: null, actionUrl: "/tenant/account?tab=billing" }),
    );
  });
});

// Root cause #2: services/billing/rentGenerator.js's automated (cron) rent
// bill path called notify.billGenerated(userId, monthLabel, totalAmount,
// dueDateLabel) with no options object at all, so the push payload's
// billing_id was empty — the mobile app's resolveNotificationRoute() falls
// back to the generic Billing tab instead of the specific bill on tap. This
// is the most common real-world rent case (automated monthly billing).
// Covered end-to-end in services/billing/rentGenerator.test.js /
// utils/rentGenerator.test.js; this file covers billGenerated()'s own
// contract in isolation.
describe("notify.billGenerated — billId propagation (bill-release notification fix)", () => {
  beforeEach(() => {
    sendMobilePushBillMock.mockClear();
  });

  test("passes billId/billType through to the push sender so the tap payload is deep-linkable", async () => {
    await notify.billGenerated("user-123", "August 2026", 5400, "August 23, 2026", {
      billId: "rent-bill-1",
      billType: "rent",
    });
    const [, , pushOptions] = sendMobilePushBillMock.mock.calls[0];
    expect(pushOptions.billId).toBe("rent-bill-1");
    expect(pushOptions.billType).toBe("rent");
  });

  test("with no options (the prior cron-path bug), billId is null rather than throwing — but the fix is to always pass it, not to rely on this fallback", async () => {
    await notify.billGenerated("user-123", "August 2026", 5400, "August 23, 2026");
    const [, , pushOptions] = sendMobilePushBillMock.mock.calls[0];
    expect(pushOptions.billId).toBeNull();
  });
});
