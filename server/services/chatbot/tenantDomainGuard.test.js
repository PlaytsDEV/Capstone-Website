import { describe, expect, test } from "@jest/globals";
import {
  classifyLilyRequest,
  lilyDomainReply,
  LILY_DOMAIN_RESPONSE,
} from "./tenantDomainGuard.js";

describe("Lily server-side domain guard", () => {
  test.each([
    ["How much is my current bill?", "billing", ["billing"]],
    ["What is my contract number?", "contract", ["contract"]],
    ["Which branch and room am I assigned to?", "tenancy", []],
    ["Check my maintenance request", "maintenance", ["maintenance"]],
    ["Show the latest dorm announcement", "announcements", ["announcements"]],
    ["What are the Lilycrest visitor policies?", "policy", ["announcements"]],
    ["Do I have an open admin inquiry?", "support", ["support"]],
  ])("allows Lilycrest request: %s", (message, intent, domains) => {
    expect(classifyLilyRequest(message)).toEqual({ allowed: true, intent, domains });
  });

  test.each([
    ["magkano babayaran ko this month", "billing"],
    ["may balance pa ba ako", "billing"],
    ["kelan due ko", "billing"],
    ["bakit wala pa contract ko", "contract"],
    ["pwede makita draft contract ko", "contract"],
    ["final na ba contract ko", "contract"],
    ["ano na status nung maintenance ko", "maintenance"],
    ["sira pa rin cr", "maintenance"],
    ["nagreply na ba admin", "support"],
    ["nakamove in na ko bakit pending pa rin", "tenancy"],
    ["may announcement ba sa GP", "announcements"],
    ["bakit mataas kuryente namin", "billing"],
    ["pwede ba bisita", "policy"],
  ])("recognizes natural Taglish Lilycrest request: %s", (message, intent) => {
    expect(classifyLilyRequest(message)).toMatchObject({ allowed: true, intent });
  });

  test.each([
    "Write a Python web scraper for me",
    "Who won the basketball game?",
    "Give me a chicken adobo recipe",
    "Solve this calculus equation",
  ])("rejects unrelated request without model classification: %s", (message) => {
    expect(classifyLilyRequest(message)).toEqual({
      allowed: false,
      intent: "general",
      domains: [],
    });
  });

  test("allows a scoped follow-up only with server-owned Lilycrest history", () => {
    const trustedHistory = [
      { role: "user", content: "Show my current bill." },
      { role: "assistant", content: "Your Lilycrest bill is due next week." },
    ];

    expect(classifyLilyRequest("When is it?", trustedHistory)).toMatchObject({
      allowed: true,
      intent: "billing",
      domains: ["billing"],
    });
    expect(classifyLilyRequest("When is it?", [])).toMatchObject({ allowed: false });
  });

  test("returns a short tenant-facing redirect without classifier details", () => {
    const response = lilyDomainReply();
    expect(response.reply).toBe(LILY_DOMAIN_RESPONSE);
    expect(response.suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Check my bill" }),
      expect.objectContaining({ label: "Contract status" }),
    ]));
    expect(response).not.toHaveProperty("classifier");
    expect(response).not.toHaveProperty("systemPrompt");
  });

  test("a rejection reply cannot unlock an unrelated follow-up", () => {
    const rejectedExchange = [
      { role: "user", content: "Write a Python web scraper." },
      { role: "assistant", content: LILY_DOMAIN_RESPONSE },
    ];

    expect(classifyLilyRequest("How do I build it?", rejectedExchange)).toMatchObject({
      allowed: false,
    });
  });
});
