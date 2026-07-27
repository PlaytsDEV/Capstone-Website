import { describe, expect, test } from "@jest/globals";
import { validateSurveyAnswers, validateSurveyTemplateDefinition } from "./surveyValidationService.js";

const template = {
  questions: [
    { _id: "507f1f77bcf86cd799439011", key: "rating", text: "Rating", type: "rating_5", required: true, active: true },
    { _id: "507f1f77bcf86cd799439012", key: "problem", text: "Problem?", type: "yes_no", required: true, active: true },
    {
      _id: "507f1f77bcf86cd799439013", key: "details", text: "Details", type: "long_text",
      active: true, characterLimit: 100,
      conditional: { questionKey: "problem", operator: "equals", value: "yes", requiredWhenVisible: true },
    },
    {
      _id: "507f1f77bcf86cd799439014", key: "priority", text: "Priority",
      type: "multiple_choice", active: true,
      options: [{ value: "Internet" }, { value: "Cleanliness" }],
    },
  ],
};

describe("validateSurveyAnswers", () => {
  test("accepts a complete response and calculates completion", () => {
    const result = validateSurveyAnswers(template, [
      { questionKey: "rating", value: 4 },
      { questionKey: "problem", value: "no" },
      { questionKey: "priority", value: ["Internet"] },
    ], { submission: true });
    expect(result.valid).toBe(true);
    expect(result.completionPercentage).toBe(100);
  });

  test("requires a visible conditional answer", () => {
    const result = validateSurveyAnswers(template, [
      { questionKey: "rating", value: 4 },
      { questionKey: "problem", value: "yes" },
    ], { submission: true });
    expect(result.errors).toContainEqual({ field: "details", code: "REQUIRED" });
  });

  test.each([
    [[{ questionKey: "rating", value: 6 }], "RATING_OUT_OF_RANGE"],
    [[{ questionKey: "priority", value: ["Unknown"] }], "INVALID_CHOICE"],
    [[{ questionKey: "unknown", value: "x" }], "UNKNOWN_QUESTION"],
  ])("rejects invalid values", (answers, code) => {
    const result = validateSurveyAnswers(template, answers);
    expect(result.errors.map((item) => item.code)).toContain(code);
  });

  test("draft saving does not require unanswered mandatory questions", () => {
    expect(validateSurveyAnswers(template, [], { submission: false }).valid).toBe(true);
  });
});

describe("validateSurveyTemplateDefinition", () => {
  test("accepts a structurally valid publishable template", () => {
    expect(validateSurveyTemplateDefinition({
      name: "Tenant Experience",
      surveyType: "quarterly_satisfaction",
      questions: [
        { key: "overall_satisfaction", text: "How satisfied are you?", type: "rating_5", includeInAnalytics: true },
        { key: "comment", text: "Tell us more", type: "long_text", includeInAnalytics: false },
      ],
    }, { publishing: true }).valid).toBe(true);
  });

  test("rejects duplicate keys, invalid choices, and forward conditions", () => {
    const result = validateSurveyTemplateDefinition({
      name: "Invalid",
      surveyType: "custom",
      questions: [
        { key: "duplicate", text: "Choose", type: "single_choice", options: [{ value: "yes", label: "Yes" }] },
        { key: "duplicate", text: "Follow up", type: "short_text", conditional: { questionKey: "later" } },
        { key: "later", text: "Later", type: "yes_no" },
      ],
    });
    expect(result.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      "MIN_OPTIONS", "DUPLICATE", "INVALID_ORDER",
    ]));
  });

  test("protects benchmark comparability during publishing", () => {
    const result = validateSurveyTemplateDefinition({
      name: "Broken benchmark",
      surveyType: "quarterly_satisfaction",
      questions: [{ key: "overall_satisfaction", text: "Comment", type: "long_text", includeInAnalytics: true }],
    }, { publishing: true });
    expect(result.errors.map((item) => item.code)).toContain("INCOMPATIBLE_BENCHMARK_TYPE");
  });
});
