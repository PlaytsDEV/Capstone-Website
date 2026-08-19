import { describe, expect, test } from "@jest/globals";
import {
  getTenantRuleBasedFallback,
  detectTenantWidgetIntent,
  determineTenantSuggestedActions,
} from "./tenantChatbotService.js";

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

describe("tenant chatbot widget intent detection and gating", () => {
  test("applicant context always suppresses monthly billing, lease timeline, and maintenance widgets", () => {
    const applicantContext = {
      isApplicant: true,
      tenantName: "Jane Applicant",
      reservation: { status: "pending" },
    };

    expect(detectTenantWidgetIntent("What is my bill?", applicantContext)).toBeNull();
    expect(detectTenantWidgetIntent("Show my current bill breakdown", applicantContext)).toBeNull();
    expect(detectTenantWidgetIntent("Check my active maintenance ticket", applicantContext)).toBeNull();
    expect(detectTenantWidgetIntent("When does my lease contract expire?", applicantContext)).toBeNull();
  });

  test("generic messages and general policy questions do not trigger billing or maintenance widgets", () => {
    const tenantContext = {
      isApplicant: false,
      tenantName: "John Resident",
      roomNumber: "101",
    };

    expect(detectTenantWidgetIntent("Hello, how are you?", tenantContext)).toBeNull();
    expect(detectTenantWidgetIntent("What time does the main gate close at night?", tenantContext)).toBeNull();
    expect(detectTenantWidgetIntent("Is high-speed wifi available on the second floor?", tenantContext)).toBeNull();
    expect(detectTenantWidgetIntent("Tell me about the onboarding process.", tenantContext)).toBeNull();
  });

  test("explicit billing queries from active tenants trigger billing_breakdown", () => {
    const tenantContext = {
      isApplicant: false,
      tenantName: "John Resident",
      roomNumber: "101",
      currentBill: { totalAmount: 5000 },
    };

    expect(detectTenantWidgetIntent("Can you show my current monthly bill breakdown?", tenantContext)).toBe("billing_breakdown");
    expect(detectTenantWidgetIntent("What is my electricity share this month?", tenantContext)).toBe("billing_breakdown");
    expect(detectTenantWidgetIntent("When is my payment due date?", tenantContext)).toBe("billing_breakdown");
    expect(detectTenantWidgetIntent("What is my unpaid bill balance?", tenantContext)).toBe("billing_breakdown");
  });

  test("determineTenantSuggestedActions returns applicant actions for applicant context", () => {
    const applicantContext = {
      isApplicant: true,
      tenantName: "Jane Applicant",
    };

    const actions = determineTenantSuggestedActions("Tell me about my stay", "", applicantContext);
    expect(actions).toEqual([
      { label: "Reservation Status", prompt: "What is my current reservation status?" },
      { label: "Deposit Payment Steps", prompt: "How do I settle the advance rent and security deposit?" },
      { label: "Browse Rooms", url: "/applicant/check-availability" },
      { label: "Chat with Admin", action: "open_escalate_modal" },
    ]);
  });
});
