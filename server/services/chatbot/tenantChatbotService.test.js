import { describe, expect, test } from "@jest/globals";
import { getTenantRuleBasedFallback } from "./tenantChatbotService.js";

describe("tenant chatbot canonical fallback responses", () => {
  test("billing response reports the canonical status, remaining balance, and utility release state", () => {
    const response = getTenantRuleBasedFallback("What is my current bill?", {
      tenantName: "Ava Guest",
      branch: "Gil Puyat",
      roomNumber: "GP-202",
      currentBill: {
        status: "unpaid",
        statusLabel: "Unpaid",
        rentAmount: 5400,
        electricityAmount: 1800,
        waterAmount: 0,
        applianceAmount: 0,
        penaltyAmount: 0,
        totalAmount: 7200,
        remainingAmount: 7200,
        dueDate: new Date("2026-08-23T00:00:00Z"),
        utilityReleased: true,
      },
    });

    expect(response).toMatch(/Status.*Unpaid/is);
    expect(response).toMatch(/Remaining Balance.*7,200/is);
    expect(response).toMatch(/Utility Schedule.*Released/is);
  });

  test("missing context never fabricates room 304, Bed 1, a due date, or an active contract", () => {
    const billing = getTenantRuleBasedFallback("bill", {
      branch: "Lilycrest Residence",
      roomNumber: null,
      currentBill: null,
    });
    const contract = getTenantRuleBasedFallback("contract", {
      branch: "Lilycrest Residence",
      roomNumber: null,
      contract: null,
      tenancy: { isCurrentResident: false },
    });

    expect(billing).toMatch(/No canonical current-cycle statement/i);
    expect(contract).toMatch(/No tenant-visible canonical Contract/i);
    expect(`${billing}\n${contract}`).not.toMatch(/Room 304|Bed 1|15th of the month|active resident status/i);
  });
});
