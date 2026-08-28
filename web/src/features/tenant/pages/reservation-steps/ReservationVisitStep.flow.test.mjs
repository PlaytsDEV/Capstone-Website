import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "ReservationVisitStep.jsx"), "utf8");

test("viewing preference step does not auto-select physical visit", () => {
  assert.match(source, /draftViewingPreference/);
  assert.doesNotMatch(source, /\|\|\s*"physical_visit"/);
  assert.doesNotMatch(source, /useState\("physical_visit"\)/);
  assert.doesNotMatch(source, /setViewingType\(option\.value\)/);
});

test("viewing preference step separates selection from detail forms", () => {
  assert.match(source, /disabled=\{!draftViewingPreference\}/);
  assert.match(source, /Continue/);
  assert.match(source, /activePreferenceView/);
  assert.match(source, /handleBackToSelection/);
});

test("locked viewing preference state is read-only with controlled actions", () => {
  assert.match(source, /showReadOnlyPreference/);
  assert.match(source, /Your viewing preference has already been submitted and is being reviewed\./);
  assert.match(source, /View Reservation Status/);
  assert.match(source, /Back to Dashboard/);
  assert.doesNotMatch(source, /Save and Return to Dashboard/);
});

test("change preference requires confirmation and latest reservation validation", () => {
  assert.match(source, /Change Viewing Preference/);
  assert.match(source, /Changing your viewing preference may reset your current viewing request/);
  assert.match(source, /onValidatePreferenceChange/);
});

test("formats visit slot label safely without undefined references", () => {
  assert.match(source, /formatVisitSlotLabel/);
  assert.match(source, /import\s*\{[^}]*formatVisitSlotLabel[^}]*\}\s*from/);
});

test("confirmation modal uses dynamic icons, next-step guidance, and contextual buttons", () => {
  assert.match(source, /getVisitConfirmButtonLabel/);
  assert.match(source, /getViewingNextStepGuidance/);
  assert.match(source, /getViewingConfirmationSubtitle/);
  assert.match(source, /ConfirmIcon/);
  assert.match(source, /formatRoomType/);
  assert.match(source, /chosenBedCode/);
});

