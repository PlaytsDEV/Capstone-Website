import { jest } from "@jest/globals";
import {
  buildStandardMessages,
  convertToGeminiContents,
} from "./aiProviderService.js";

describe("aiProviderService", () => {
  describe("buildStandardMessages", () => {
    it("should build standard OpenAI message list with system prompt and history", () => {
      const systemPrompt = "You are a helpful assistant.";
      const userMessage = "What are the dorm rules?";
      const history = [
        { role: "user", text: "Hello" },
        { role: "assistant", text: "Hi! How can I help?" },
      ];

      const messages = buildStandardMessages(systemPrompt, userMessage, history);
      expect(messages).toHaveLength(4);
      expect(messages[0]).toEqual({ role: "system", content: "You are a helpful assistant." });
      expect(messages[1]).toEqual({ role: "user", content: "Hello" });
      expect(messages[2]).toEqual({ role: "assistant", content: "Hi! How can I help?" });
      expect(messages[3]).toEqual({ role: "user", content: "What are the dorm rules?" });
    });

    it("should handle missing system prompt or history gracefully", () => {
      const messages = buildStandardMessages(null, "Test message", null);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: "user", content: "Test message" });
    });
  });

  describe("convertToGeminiContents", () => {
    it("should extract system prompt and format user/model contents", () => {
      const messages = [
        { role: "system", content: "System rule" },
        { role: "user", content: "User prompt" },
        { role: "assistant", content: "Model reply" },
      ];

      const { contents, systemInstruction } = convertToGeminiContents(messages);
      expect(systemInstruction).toBe("System rule");
      expect(contents).toHaveLength(2);
      expect(contents[0]).toEqual({ role: "user", parts: [{ text: "User prompt" }] });
      expect(contents[1]).toEqual({ role: "model", parts: [{ text: "Model reply" }] });
    });
  });
});
