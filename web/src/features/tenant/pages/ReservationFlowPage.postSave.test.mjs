import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "ReservationFlowPage.jsx"), "utf8");

test("onVisitSaved branches between physical visit and auto-advancing non-physical preferences", () => {
  const onVisitSavedMatch = source.match(/onVisitSaved=\{async[\s\S]*?\n\s*\}\}/);
  assert.ok(onVisitSavedMatch, "onVisitSaved handler must exist");
  const onVisitSavedCode = onVisitSavedMatch[0];
  assert.match(onVisitSavedCode, /flow\.handleNextStage\(\)/);
  assert.match(onVisitSavedCode, /showNotification\(/);
});
