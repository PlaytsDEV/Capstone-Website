import { jest } from "@jest/globals";
import {
  extractLeadHeuristics,
  parseLeadFromConversation,
} from "./leadParserService.js";

describe("leadParserService", () => {
  describe("extractLeadHeuristics (Offline / Regex Rule Engine)", () => {
    it("should extract Philippine mobile number from text", () => {
      const text = "Hi, you can text me at 09171234567 regarding the room.";
      const lead = extractLeadHeuristics(text);
      expect(lead.phone).toBe("09171234567");
      expect(lead.hasContactInfo).toBe(true);
    });

    it("should extract formatted mobile number and email", () => {
      const text = "Contact me at juan.delacruz@gmail.com or +63 918 999 8888.";
      const lead = extractLeadHeuristics(text);
      expect(lead.email).toBe("juan.delacruz@gmail.com");
      expect(lead.phone).toContain("9189998888");
      expect(lead.hasContactInfo).toBe(true);
    });

    it("should detect Guadalupe and Double Sharing room intent", () => {
      const text = "Looking for a 2-person room near Guadalupe MRT.";
      const lead = extractLeadHeuristics(text);
      expect(lead.preferredBranch).toBe("guadalupe");
      expect(lead.preferredRoomType).toBe("double_sharing");
    });

    it("should detect Gil Puyat and Quadruple Sharing room intent", () => {
      const text = "May available pa ba na quadruple sharing sa Gil Puyat Pasay?";
      const lead = extractLeadHeuristics(text);
      expect(lead.preferredBranch).toBe("gil_puyat");
      expect(lead.preferredRoomType).toBe("quadruple_sharing");
    });

    it("should detect viewing intent", () => {
      const text = "Pwede po ba mag-schedule ng ocular visit this weekend?";
      const lead = extractLeadHeuristics(text);
      expect(lead.viewingRequested).toBe(true);
    });
  });

  describe("parseLeadFromConversation (AI & Heuristic Pipeline)", () => {
    it("should handle empty or whitespace input gracefully", async () => {
      const result = await parseLeadFromConversation([]);
      expect(result).toBeDefined();
      expect(result.hasContactInfo).toBe(false);
      expect(result.preferredBranch).toBe("all");
    });

    it("should parse structured lead data from Taglish conversation history", async () => {
      const conversationHistory = [
        { role: "user", text: "Magkano po sa Guadalupe?" },
        { role: "assistant", text: "Ang double sharing po sa Guadalupe ay starting ₱5,500/mo." },
        {
          role: "user",
          text: "Gusto ko po mag-inquire. Ako po si Bianca Cruz, email is bianca.cruz@yahoo.com, 09281234567. 1 semester po sana.",
        },
      ];

      const lead = await parseLeadFromConversation(conversationHistory, "guadalupe");
      expect(lead).toBeDefined();
      expect(lead.hasContactInfo).toBe(true);
      expect(lead.email).toBe("bianca.cruz@yahoo.com");
      expect(lead.preferredBranch).toBe("guadalupe");
    });
  });
});
