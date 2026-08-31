import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chatConstantsSource = fs.readFileSync(
  new URL("./chatConstants.js", import.meta.url),
  "utf8",
);
const conversationListSource = fs.readFileSync(
  new URL("./AdminChatConversationList.jsx", import.meta.url),
  "utf8",
);

import {
  CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  getCategoryLabel,
  getPriorityLabel,
} from "./chatConstants.js";

test("CATEGORY_OPTIONS removes 'urgent_issue' to avoid category vs priority confusion", () => {
  const values = CATEGORY_OPTIONS.map((c) => c.value);
  assert.ok(
    !values.includes("urgent_issue"),
    "urgent_issue should not be in CATEGORY_OPTIONS because urgency is a priority, not a category",
  );
  assert.ok(values.includes("billing_concern"));
  assert.ok(values.includes("maintenance_concern"));
  assert.ok(values.includes("reservation_concern"));
  assert.ok(values.includes("payment_concern"));
  assert.ok(values.includes("general_inquiry"));
});

test("getCategoryLabel handles active categories and legacy fallback values", () => {
  assert.equal(getCategoryLabel("billing_concern"), "Billing Concern");
  assert.equal(getCategoryLabel("maintenance_concern"), "Maintenance Concern");
  assert.equal(getCategoryLabel("urgent_issue"), "Urgent Issue");
  assert.equal(getCategoryLabel("unknown_cat"), "General Inquiry");
});

test("conversation list item displays a dedicated category chip alongside priority", () => {
  // Must render getCategoryLabel on the conversation card
  assert.match(
    conversationListSource,
    /getCategoryLabel\(conversation\.category\)/,
    "conversation card must display the Category label/chip",
  );
});

test("filter drawer includes a dedicated Priority dropdown", () => {
  // Advanced filters must include a Priority select dropdown
  assert.match(
    conversationListSource,
    /<label[^>]*>\s*Priority\s*<\/label>[\s\S]*?<select[^>]*value=\{priorityFilter\}/i,
    "advanced filters must render a Priority select dropdown",
  );
  assert.match(
    conversationListSource,
    /PRIORITY_OPTIONS\.map/,
    "Priority select must map over PRIORITY_OPTIONS",
  );
});

test("activeFiltersCount accurately tracks priorityFilter", () => {
  assert.match(
    conversationListSource,
    /if\s*\(\s*priorityFilter\s*!==\s*["']all["']\s*\)\s*count\s*\+=\s*1/,
    "activeFiltersCount must increment when priorityFilter is active",
  );
});
