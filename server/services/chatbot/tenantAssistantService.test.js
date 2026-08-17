import {
  detectTenantWidgetIntent,
  determineTenantSuggestedActions,
  getTenantRuleBasedFallback,
  buildTenantSystemPrompt,
} from "./tenantAssistantService.js";

describe("tenantAssistantService", () => {
  describe("detectTenantWidgetIntent", () => {
    it("should detect billing_breakdown widget with accurate fallback due dates", () => {
      const mockContext = {
        leaseCycleText: "5th of each month",
        bill: {
          status: "paid",
          totalAmount: 0,
          remainingAmount: 0,
          dueDate: "5th of each month",
        },
      };

      const widget = detectTenantWidgetIntent("when will be my next bill", mockContext);
      expect(widget).not.toBeNull();
      expect(widget.type).toBe("billing_breakdown");
      expect(widget.data.bill.dueDate).toBe("5th of each month");
    });

    it("should detect lease_timeline widget", () => {
      const widget = detectTenantWidgetIntent("how many days left on my contract?");
      expect(widget).not.toBeNull();
      expect(widget.type).toBe("lease_timeline");
    });

    it("should detect maintenance_summary widget", () => {
      const widget = detectTenantWidgetIntent("my aircon is leaking");
      expect(widget).not.toBeNull();
      expect(widget.type).toBe("maintenance_summary");
    });
  });

  describe("buildTenantSystemPrompt", () => {
    it("should ground system prompt on individual lease cycle and 15th submeter reading", () => {
      const mockContext = {
        user: { name: "Juan Dela Cruz", branch: "Guadalupe" },
        contract: {
          roomNumber: "304",
          bedLabel: "Bed 1",
          roomType: "Double Sharing",
          monthlyRent: 5500,
          leaseStartDate: "Aug 5, 2026",
          status: "active",
        },
        bill: {
          status: "paid",
          totalAmount: 0,
          remainingAmount: 0,
          dueDate: "5th of each month",
        },
        leaseCycleText: "5th of each month",
      };

      const prompt = buildTenantSystemPrompt(mockContext);
      expect(prompt).toContain("Base monthly rent due dates follow each tenant's individual move-in / lease start date");
      expect(prompt).toContain("Utility/electricity charges follow the monthly 15th submeter reading cycle");
      expect(prompt).not.toContain("due on the 15th of each month");
    });
  });

  describe("getTenantRuleBasedFallback", () => {
    it("should explain next bill accurately when current bill is paid", () => {
      const mockContext = {
        user: { name: "Maria" },
        contract: { leaseStartDate: "Aug 10, 2026" },
        bill: { status: "paid", totalAmount: 0, remainingAmount: 0 },
        leaseCycleText: "10th of each month",
      };

      const reply = getTenantRuleBasedFallback("when will be my next bill", mockContext);
      expect(reply).toContain("already been paid");
      expect(reply).toContain("10th of each month");
      expect(reply).toContain("15th of each month");
    });

    it("should format outstanding amount when bill is unpaid", () => {
      const mockContext = {
        bill: {
          status: "pending",
          totalAmount: 5800,
          remainingAmount: 5800,
          dueDate: "Sep 10, 2026",
        },
      };

      const reply = getTenantRuleBasedFallback("how much is my bill", mockContext);
      expect(reply).toContain("₱5,800.00");
      expect(reply).toContain("Sep 10, 2026");
    });
  });

  describe("determineTenantSuggestedActions", () => {
    it("should provide relevant billing actions", () => {
      const actions = determineTenantSuggestedActions("check my bill", "Here is your statement");
      expect(actions.some((a) => a.url === "/applicant/billing")).toBe(true);
    });
  });
});
