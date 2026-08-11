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
