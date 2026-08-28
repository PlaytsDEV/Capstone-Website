import { describe, expect, test } from "@jest/globals";
import { calculateRoomTransferDepositSettlement } from "./roomTransferDepositSettlement.js";

describe("calculateRoomTransferDepositSettlement", () => {
  test("higher required deposit: only the difference is due, held is unchanged", () => {
    const r = calculateRoomTransferDepositSettlement({
      depositCurrentlyHeld: 5400,
      destinationRequiredDeposit: 13500,
    });
    expect(r.depositDelta).toBe(8100);
    expect(r.additionalDepositDue).toBe(8100);
    expect(r.excessDepositHeld).toBe(0);
    expect(r.depositHeldAfterTransferBeforePayment).toBe(5400);
  });

  test("lower required deposit: nothing due, excess stays held (not refunded here)", () => {
    const r = calculateRoomTransferDepositSettlement({
      depositCurrentlyHeld: 13500,
      destinationRequiredDeposit: 5400,
    });
    expect(r.depositDelta).toBe(-8100);
    expect(r.additionalDepositDue).toBe(0);
    expect(r.excessDepositHeld).toBe(8100);
    expect(r.depositHeldAfterTransferBeforePayment).toBe(13500);
  });

  test("equal deposit: no adjustment", () => {
    const r = calculateRoomTransferDepositSettlement({
      depositCurrentlyHeld: 8100,
      destinationRequiredDeposit: 8100,
    });
    expect(r.depositDelta).toBe(0);
    expect(r.additionalDepositDue).toBe(0);
    expect(r.excessDepositHeld).toBe(0);
  });

  test("nothing held yet: full destination deposit is due", () => {
    const r = calculateRoomTransferDepositSettlement({
      depositCurrentlyHeld: 0,
      destinationRequiredDeposit: 5400,
    });
    expect(r.additionalDepositDue).toBe(5400);
    expect(r.excessDepositHeld).toBe(0);
  });

  test("centavo safety / negative inputs clamp to 0", () => {
    const r = calculateRoomTransferDepositSettlement({
      depositCurrentlyHeld: -100,
      destinationRequiredDeposit: 5400.005,
    });
    expect(r.depositPreviouslyHeld).toBe(0);
    expect(r.destinationRequiredDeposit).toBe(5400.01);
    expect(r.additionalDepositDue).toBe(5400.01);
  });

  test("rent and deposit are NOT combined here — deposit math is standalone", () => {
    // Same held/required pair regardless of any rent figure.
    const a = calculateRoomTransferDepositSettlement({ depositCurrentlyHeld: 6000, destinationRequiredDeposit: 9000 });
    expect(a.additionalDepositDue).toBe(3000);
    expect(a.excessDepositHeld).toBe(0);
  });
});
