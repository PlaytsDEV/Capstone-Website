import { jest } from "@jest/globals";
import {
  detectWidgetIntent,
  determineSuggestedActions,
  getRuleBasedFallback,
  streamGeminiChatbot,
  queryGeminiChatbot,
} from "./chatbotService.js";
import {
  BRANCH_PROFILES,
  ROOM_RATES,
  APPLIANCE_FEES,
  ACCEPTED_KYC_IDS,
  APPLICATION_STAGES,
} from "./knowledgeBase.js";

describe("chatbotService", () => {
  describe("Knowledge Base exports", () => {
    it("should export well-structured branch profiles", () => {
      expect(BRANCH_PROFILES.gil_puyat.name).toBe("Gil Puyat Branch");
      expect(BRANCH_PROFILES.guadalupe.name).toBe("Guadalupe Branch");
      expect(BRANCH_PROFILES.gil_puyat.landmarks).toContain("LRT-1");
      expect(BRANCH_PROFILES.guadalupe.landmarks).toContain("MRT-3");
    });

    it("should export room rates with correct price ranges", () => {
      expect(ROOM_RATES).toHaveLength(3);
      const quad = ROOM_RATES.find((r) => r.type === "quadruple_sharing");
      const dbl = ROOM_RATES.find((r) => r.type === "double_sharing");
      const priv = ROOM_RATES.find((r) => r.type === "private_room");

      expect(quad.minRate).toBe(3500);
      expect(quad.maxRate).toBe(4200);
      expect(dbl.minRate).toBe(5500);
      expect(dbl.maxRate).toBe(6500);
      expect(priv.minRate).toBe(9000);
      expect(priv.maxRate).toBe(11000);
    });

    it("should export appliance fees schedule", () => {
      expect(APPLIANCE_FEES.laptopsPhones.fee).toBe(0);
      expect(APPLIANCE_FEES.miniRefrigerator.fee).toBe(200);
      expect(APPLIANCE_FEES.riceCooker.fee).toBe(150);
      expect(APPLIANCE_FEES.electricFan.fee).toBe(100);
    });

    it("should export accepted KYC IDs list", () => {
      expect(ACCEPTED_KYC_IDS).toContain("Philippine Passport");
      expect(ACCEPTED_KYC_IDS).toContain("UMID (Unified Multi-Purpose ID)");
      expect(ACCEPTED_KYC_IDS).toContain("Driver's License");
      expect(ACCEPTED_KYC_IDS).toContain("PhilSys National ID (Philippine Identification Card / ePhilID)");
      expect(ACCEPTED_KYC_IDS.some((id) => id.includes("Student ID"))).toBe(true);
    });

    it("should export 5 application stages", () => {
      expect(APPLICATION_STAGES).toHaveLength(5);
      expect(APPLICATION_STAGES[0].title).toBe("Room Selection");
      expect(APPLICATION_STAGES[4].title).toBe("Confirmation & Admin Approval");
    });
  });

  describe("detectWidgetIntent", () => {
    it("should detect room_showcase widget for pricing and rate queries", () => {
      const widget = detectWidgetIntent("How much is a room in Guadalupe?", "guadalupe");
      expect(widget).not.toBeNull();
      expect(widget.type).toBe("room_showcase");
      expect(widget.data.branch).toBe("guadalupe");
      expect(widget.data.rooms).toHaveLength(3);
    });

    it("should detect viewing_booking widget for tour and visit queries", () => {
      const widget = detectWidgetIntent("Can I schedule an ocular visit next week?", "gil_puyat");
      expect(widget).not.toBeNull();
      expect(widget.type).toBe("viewing_booking");
      expect(widget.data.defaultBranch).toBe("gil_puyat");
      expect(widget.data.branches).toHaveLength(2);
    });

    it("should detect budget_estimator widget for total cost calculations", () => {
      const widget = detectWidgetIntent("What is the total budget estimate with mini fridge?");
      expect(widget).not.toBeNull();
      expect(widget.type).toBe("budget_estimator");
      expect(widget.data.baseRates.quadruple_sharing).toBe(3500);
      expect(widget.data.applianceFees.miniRefrigerator).toBe(200);
    });

    it("should detect kyc_checklist widget for ID and document inquiries", () => {
      const widget = detectWidgetIntent("What valid IDs do you accept for reservation?");
      expect(widget).not.toBeNull();
      expect(widget.type).toBe("kyc_checklist");
      expect(widget.data.acceptedIds).toEqual(ACCEPTED_KYC_IDS);
    });

    it("should return null for generic greeting queries", () => {
      const widget = detectWidgetIntent("Hello good morning");
      expect(widget).toBeNull();
    });
  });

  describe("determineSuggestedActions", () => {
    it("should generate branch-specific browsing links", () => {
      const actions = determineSuggestedActions("Where is Guadalupe branch?", "It is near MRT-3", "guadalupe");
      expect(actions.some((a) => a.url && a.url.includes("branch=Guadalupe"))).toBe(true);
    });

    it("should generate room-specific browsing links", () => {
      const actions = determineSuggestedActions("Tell me about quadruple rooms", "We offer 4 beds per room.");
      expect(actions.some((a) => a.url && a.url.includes("roomType=Quadruple"))).toBe(true);
    });

    it("should always include a viewing/escalation fallback action", () => {
      const actions = determineSuggestedActions("Random query", "Random reply");
      expect(actions.some((a) => a.action === "open_escalation_form")).toBe(true);
    });
  });

  describe("getRuleBasedFallback", () => {
    it("should return Filipino grounded answers guiding to check room availability for quadruple rooms", () => {
      const reply = getRuleBasedFallback("Magkano po ang quadruple room?");
      expect(reply).toContain("Quadruple Sharing");
      expect(reply).toContain("Check Room Availability");
    });

    it("should provide curfew policy details with night-shift exception", () => {
      const reply = getRuleBasedFallback("May curfew po ba?");
      expect(reply).toContain("11:00 PM");
      expect(reply).toContain("5:00 AM");
      expect(reply).toContain("night-shift");
    });

    it("should provide utilities billing information", () => {
      const reply = getRuleBasedFallback("Paano po ang bayad sa kuryente at tubig?");
      expect(reply).toContain("Libre po ang konsumo sa tubig");
      expect(reply).toContain("ika-15 ng buwan");
    });

    it("should provide KYC IDs requirements", () => {
      const reply = getRuleBasedFallback("Anong valid IDs po ang kailangan?");
      expect(reply).toContain("Passport");
      expect(reply).toContain("UMID");
      expect(reply).toContain("Student ID");
    });

    it("should provide English breakdown and availability link when asked in English for room types and rates for Gil Puyat and Guadalupe", () => {
      const reply = getRuleBasedFallback("What are your room types and monthly rental rates for Gil Puyat and Guadalupe?");
      expect(reply).toContain("Gil Puyat");
      expect(reply).toContain("Guadalupe");
      expect(reply).toContain("Quadruple Sharing");
      expect(reply).toContain("Double Sharing");
      expect(reply).toContain("Private Room");
      expect(reply).toContain("Check Room Availability");
    });
  });

  describe("streamGeminiChatbot (fallback mode)", () => {
    it("should stream tokens, widget, actions, and done callback when offline", async () => {
      const tokens = [];
      let emittedWidget = null;
      let emittedActions = null;
      let doneResult = null;

      await streamGeminiChatbot({
        message: "How much are room rates?",
        conversationHistory: [],
        branchFocus: "guadalupe",
        onToken: (t) => tokens.push(t),
        onWidget: (w) => {
          emittedWidget = w;
        },
        onActions: (a) => {
          emittedActions = a;
        },
        onDone: (d) => {
          doneResult = d;
        },
      });

      expect(tokens.length).toBeGreaterThan(0);
      expect(emittedWidget).not.toBeNull();
      expect(emittedWidget.type).toBe("room_showcase");
      expect(emittedActions).toBeInstanceOf(Array);
      expect(doneResult).not.toBeNull();
      expect(doneResult.fullReply).toBe(tokens.join(""));
      expect(doneResult.canEscalate).toBe(true);
    });
  });

  describe("queryGeminiChatbot", () => {
    it("should return standard reply structure in fallback mode", async () => {
      const result = await queryGeminiChatbot("What are your branch locations?");
      expect(result).toHaveProperty("reply");
      expect(result).toHaveProperty("suggestedActions");
      expect(result).toHaveProperty("widget");
      expect(result.canEscalate).toBe(true);
    });

    it("should accept object signature", async () => {
      const result = await queryGeminiChatbot({
        message: "Tell me about Guadalupe branch",
        conversationHistory: [],
        branchFocus: "guadalupe",
      });
      expect(result.reply).toContain("Guadalupe");
    });
  });
});
