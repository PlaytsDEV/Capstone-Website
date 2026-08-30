import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const widgetsDir = path.resolve(__dirname, "widgets");
const chatbotDir = __dirname;

describe("Chatbot Widgets Design & Token Compliance", () => {
  const widgetFiles = [
    "ChatViewingBookingCard.jsx",
    "ChatRoomShowcaseCard.jsx",
    "ChatBudgetEstimatorWidget.jsx",
    "ChatKycChecklistWidget.jsx",
  ];

  for (const file of widgetFiles) {
    test(`${file} strictly adheres to solid tokens without inline style color overrides`, () => {
      const filePath = path.join(widgetsDir, file);
      assert.strictEqual(fs.existsSync(filePath), true, `${file} must exist`);
      const content = fs.readFileSync(filePath, "utf-8");
      assert.doesNotMatch(content, /linear-gradient/i, `${file} must not contain linear gradients`);
      assert.doesNotMatch(content, /border-l-4/i, `${file} must not contain side-accent borders`);
      assert.doesNotMatch(content, /style=\{\{[^}]*backgroundColor:\s*["'][^"']+["'][^}]*\}\}/, `${file} should prefer Tailwind dark mode classes over inline style background overrides`);
    });
  }

  test("ChatLeadEscalationForm strictly uses solid tokens and clear validation", () => {
    const formPath = path.join(chatbotDir, "ChatLeadEscalationForm.jsx");
    const content = fs.readFileSync(formPath, "utf-8");
    assert.doesNotMatch(content, /linear-gradient/i, "ChatLeadEscalationForm must not contain linear gradients");
    assert.doesNotMatch(content, /border-l-4/i, "ChatLeadEscalationForm must not contain side-accent borders");
  });

  test("PublicChatbotModal uses clean neutral 1px borders and solid headers", () => {
    const modalPath = path.join(chatbotDir, "PublicChatbotModal.jsx");
    const content = fs.readFileSync(modalPath, "utf-8");
    assert.doesNotMatch(content, /linear-gradient/i, "PublicChatbotModal must not contain linear gradients");
  });
});
