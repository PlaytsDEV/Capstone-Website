import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

// Regression coverage for notify.supportReply() — the push-capable
// replacement for chatController.js's prior notify.general() call on admin
// support replies. notify.general() resolves to plain createNotification(),
// which never sends an OS push — a tenant who wasn't actively looking at
// the app had no way to learn an admin had responded. This mirrors
// contractDocumentReady's createNotificationWithPush + dedupeKey pattern.

let seenKeys;
const saveMock = jest.fn(function save() {
  if (this.dedupeKey) {
    const scopedKey = `${String(this.userId)}:${this.dedupeKey}`;
    if (seenKeys.has(scopedKey)) {
      const err = new Error("E11000 duplicate key error collection");
      err.code = 11000;
      return Promise.reject(err);
    }
    seenKeys.add(scopedKey);
  }
  return Promise.resolve(this);
});
const NotificationMock = jest.fn().mockImplementation(function Notification(data) {
  return { ...data, save: saveMock };
});

await jest.unstable_mockModule("../../models/Notification.js", () => ({
  default: NotificationMock,
}));

await jest.unstable_mockModule("../../utils/socket.js", () => ({
  emitToUser: jest.fn(),
}));

await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const sendMobilePushToRecipientsMock = jest.fn().mockResolvedValue(true);
await jest.unstable_mockModule("./mobilePushService.js", () => ({
  sendMobilePushBill: jest.fn(),
  sendMobilePushToRecipients: sendMobilePushToRecipientsMock,
}));

const { notify } = await import("./notificationService.js");

describe("notify.supportReply", () => {
  beforeEach(() => {
    seenKeys = new Set();
    saveMock.mockClear();
    NotificationMock.mockClear();
    sendMobilePushToRecipientsMock.mockClear();
  });
  afterEach(() => jest.clearAllMocks());

  test("an admin reply creates exactly one notification and attempts exactly one push", async () => {
    await notify.supportReply("tenant-1", "conversation-1", "message-1");
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(sendMobilePushToRecipientsMock).toHaveBeenCalledTimes(1);
    expect(NotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "tenant-1",
      type: "support_reply",
      entityType: "chat",
      entityId: "conversation-1",
      dedupeKey: "support_reply:conversation-1:message-1",
    }));
  });

  test("the push payload identifies the exact conversation without requiring the client to parse message text", async () => {
    await notify.supportReply("tenant-1", "conversation-1", "message-1");
    expect(sendMobilePushToRecipientsMock).toHaveBeenCalledWith(
      ["tenant-1"],
      expect.objectContaining({
        data: expect.objectContaining({
          type: "support_reply",
          conversation_id: "conversation-1",
          screen: "chat",
        }),
      }),
    );
  });

  test("a retried/duplicated call for the SAME message never produces a second push", async () => {
    await notify.supportReply("tenant-1", "conversation-1", "message-1");
    sendMobilePushToRecipientsMock.mockClear();
    await notify.supportReply("tenant-1", "conversation-1", "message-1");
    expect(sendMobilePushToRecipientsMock).not.toHaveBeenCalled();
  });

  test("a genuinely new admin reply (new messageId) is an independent event", async () => {
    await notify.supportReply("tenant-1", "conversation-1", "message-1");
    sendMobilePushToRecipientsMock.mockClear();
    await notify.supportReply("tenant-1", "conversation-1", "message-2");
    expect(sendMobilePushToRecipientsMock).toHaveBeenCalledTimes(1);
  });

  test("concurrent duplicate sends for the same message converge to exactly one delivered notification/push", async () => {
    const [a, b] = await Promise.all([
      notify.supportReply("tenant-1", "conversation-2", "message-1"),
      notify.supportReply("tenant-1", "conversation-2", "message-1"),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(sendMobilePushToRecipientsMock).toHaveBeenCalledTimes(1);
  });

  test("a push-provider failure still leaves the in-app notification row as the durable record", async () => {
    sendMobilePushToRecipientsMock.mockRejectedValueOnce(new Error("push provider unavailable"));
    await expect(notify.supportReply("tenant-1", "conversation-3", "message-1")).resolves.toBeTruthy();
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});
