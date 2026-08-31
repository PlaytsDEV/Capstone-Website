import { describe, expect, test } from "@jest/globals";
import { buildNextAction } from "./tenantWorkspace.js";

const base = {
  stayStatus: "active",
  leaseStatus: "active",
  billingSummary: { hasPendingVerification: false, hasOverdue: false },
};

describe("tenant workspace Room Transfer Action Needed precedence", () => {
  test("pending request alone is reviewable", () => {
    expect(buildNextAction({
      ...base,
      tenantTransferRequest: { status: "pending", canReview: true },
    })).toBe("review_transfer_request");
  });

  test.each([
    ["scheduled", "transfer_scheduled"],
    ["ready_for_transfer", "complete_transfer"],
    ["action_required", "complete_transfer"],
    ["awaiting_settlement", "settle_transfer"],
  ])("operational %s wins over a stale pending request", (status, expected) => {
    expect(buildNextAction({
      ...base,
      scheduledRoomTransfer: { status },
      tenantTransferRequest: { status: "pending", canReview: true },
    })).toBe(expected);
  });

  test("an in-flight scheduling claim is not exposed as an Admin review action", () => {
    expect(buildNextAction({
      ...base,
      tenantTransferRequest: { status: "pending", canReview: false },
    })).toBe("none");
  });
});
