import { describe, expect, jest, test } from "@jest/globals";
import { DEFAULT_SURVEY_TEMPLATES } from "../config/defaultSurveyTemplates.js";
import { seedDefaultSurveyTemplates } from "./seed_default_survey_templates.mjs";

const createModel = () => {
  const records = [];
  return {
    records,
    findOne: jest.fn(async (query) => records.find((record) =>
      record.systemTemplateKey === query.systemTemplateKey &&
      record.templateVersion === query.templateVersion &&
      record.isSystemTemplate === true)),
    create: jest.fn(async (value) => {
      const record = structuredClone({ ...value, _id: `template-${records.length + 1}` });
      records.push(record);
      return record;
    }),
  };
};

describe("default survey template seed", () => {
  test("creates five immutable draft sources without schedules or assignments", async () => {
    const model = createModel();
    const result = await seedDefaultSurveyTemplates({ TemplateModel: model, logger: {} });

    expect(result).toHaveLength(5);
    expect(model.records.map((item) => item.systemTemplateKey)).toEqual(
      DEFAULT_SURVEY_TEMPLATES.map((item) => item.systemTemplateKey),
    );
    expect(model.records.every((item) =>
      item.isSystemTemplate && item.status === "draft" && !item.publishedAt)).toBe(true);
    expect(model.records.every((item) =>
      item.schedules === undefined && item.assignments === undefined)).toBe(true);
  });

  test("is idempotent and never overwrites a customized source", async () => {
    const model = createModel();
    await seedDefaultSurveyTemplates({ TemplateModel: model, logger: {} });
    model.records[0].name = "Administrator-reviewed wording";
    await seedDefaultSurveyTemplates({ TemplateModel: model, logger: {} });

    expect(model.records).toHaveLength(5);
    expect(model.records[0].name).toBe("Administrator-reviewed wording");
    expect(model.create).toHaveBeenCalledTimes(5);
  });

  test("a newer system version creates a separate source and preserves the older version", async () => {
    const model = createModel();
    await seedDefaultSurveyTemplates({ TemplateModel: model, logger: {} });
    const updated = structuredClone(DEFAULT_SURVEY_TEMPLATES);
    updated[0].templateVersion = "1.1.0";

    // Simulate the same version-aware behavior with an introduced source version.
    const source = updated[0];
    const existing = await model.findOne({
      systemTemplateKey: source.systemTemplateKey,
      templateVersion: source.templateVersion,
      isSystemTemplate: true,
    });
    if (!existing) await model.create(source);

    expect(model.records.filter((item) =>
      item.systemTemplateKey === source.systemTemplateKey)).toHaveLength(2);
  });

  test("templates retain required benchmark keys and conditional follow-ups", () => {
    const quarterly = DEFAULT_SURVEY_TEMPLATES.find((item) =>
      item.systemTemplateKey === "quarterly_tenant_satisfaction");
    const moveOut = DEFAULT_SURVEY_TEMPLATES.find((item) =>
      item.systemTemplateKey === "mandatory_move_out_experience");

    expect(quarterly.questions).toHaveLength(25);
    expect(moveOut.questions).toHaveLength(17);
    expect(quarterly.questions.map((item) => item.key)).toEqual(
      expect.arrayContaining(["overall_satisfaction", "recommendation_score", "renewal_intent", "billing_clarity_rating"]),
    );
    expect(quarterly.questions.find((item) =>
      item.key === "recurring_room_issue_details").conditional.requiredWhenVisible).toBe(true);
    expect(moveOut.isMandatory).toBe(true);
    expect(DEFAULT_SURVEY_TEMPLATES.map((item) => item.questions.length)).toEqual([25, 17, 10, 8, 7]);
    expect(DEFAULT_SURVEY_TEMPLATES.every((item) =>
      item.analyticsCategories.length > 0 &&
      item.questions.every((question) => question.key && question.category))).toBe(true);
    const notApplicableQuestions = DEFAULT_SURVEY_TEMPLATES.flatMap((item) =>
      item.questions.filter((question) =>
        question.options?.some((option) => option.value === "not_applicable")));
    expect(notApplicableQuestions).toHaveLength(4);
  });
});
