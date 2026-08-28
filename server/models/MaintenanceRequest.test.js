import { describe, expect, test } from "@jest/globals";

import MaintenanceRequest from "./MaintenanceRequest.js";

const buildRequest = (overrides = {}) =>
  new MaintenanceRequest({
    request_id: "maint_modeltest1",
    user_id: "user_modeltest1",
    request_type: "plumbing",
    description: "Faucet leaking in bathroom.",
    urgency: "normal",
    status: "pending",
    branch: "gil-puyat",
    ...overrides,
  });

describe("MaintenanceRequest attachment compatibility", () => {
  test("allows legacy unavailable attachments so admin progress updates can still be saved", async () => {
    const request = buildRequest({
      attachments: [
        {
          name: "Attachment 1",
          type: "image/jpeg",
        },
      ],
      work_log: [
        {
          note: "Progress attachment added.",
          attachments: [
            {
              name: "old-device-photo.jpg",
              type: "image/jpeg",
            },
          ],
          logged_at: new Date("2026-05-17T00:00:00.000Z"),
        },
      ],
    });

    await expect(request.validate()).resolves.toBeUndefined();
  });

  test("preserves remote URL aliases from legacy upload clients", async () => {
    const request = buildRequest({
      attachments: [
        {
          fileName: "leak-photo.jpg",
          downloadUrl: "https://storage.example.com/maintenance/leak-photo.jpg",
          contentType: "image/jpeg",
        },
      ],
    });

    await expect(request.validate()).resolves.toBeUndefined();
    expect(request.attachments[0].downloadUrl).toBe(
      "https://storage.example.com/maintenance/leak-photo.jpg",
    );
  });
});

describe("MaintenanceRequest tenant resolution rating", () => {
  test.each([1, 2, 3, 4, 5])("accepts integer rating %i", async (rating) => {
    const request = buildRequest({ resolutionConfirmation: { rating } });

    await expect(request.validate()).resolves.toBeUndefined();
  });

  test.each([0, 6, -1, 2.5])("rejects out-of-contract rating %s", async (rating) => {
    const request = buildRequest({ resolutionConfirmation: { rating } });

    await expect(request.validate()).rejects.toThrow();
  });

  test("allows an unrated request before tenant confirmation", async () => {
    await expect(buildRequest().validate()).resolves.toBeUndefined();
  });
});
