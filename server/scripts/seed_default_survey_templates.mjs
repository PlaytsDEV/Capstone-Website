import mongoose from "mongoose";
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { DEFAULT_SURVEY_TEMPLATES } from "../config/defaultSurveyTemplates.js";
import SurveyTemplate from "../models/SurveyTemplate.js";

export async function seedDefaultSurveyTemplates({ TemplateModel = SurveyTemplate, logger = console } = {}) {
  const results = [];
  for (const source of DEFAULT_SURVEY_TEMPLATES) {
    const existing = await TemplateModel.findOne({
      systemTemplateKey: source.systemTemplateKey,
      templateVersion: source.templateVersion,
      isSystemTemplate: true,
    });
    if (existing) {
      results.push({ key: source.systemTemplateKey, action: "preserved", id: existing._id });
      continue;
    }
    const created = await TemplateModel.create(source);
    results.push({ key: source.systemTemplateKey, action: "created", id: created._id });
  }
  logger.info?.("Default survey template seed completed.", {
    created: results.filter((item) => item.action === "created").length,
    preserved: results.filter((item) => item.action === "preserved").length,
    total: results.length,
  });
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mongoUri = String(process.env.MONGODB_URI || "").trim();
  if (!mongoUri) throw new Error("MONGODB_URI is required to seed default survey templates.");
  await mongoose.connect(mongoUri);
  try { await seedDefaultSurveyTemplates(); } finally { await mongoose.disconnect(); }
}
