import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(join(__dirname, "ReservationConfirmationStep.jsx"), "utf8");
const cssSource = readFileSync(join(__dirname, "../../styles/reservation-flow.css"), "utf8");

test("ReservationConfirmationStep uses natural top-aligned layout without justify-between on columns", () => {
  // Left column should not have justify-between
  assert.doesNotMatch(
    componentSource,
    /col-span-7[^"'>]*justify-between/,
    "Left column must not use justify-between to prevent floating gaps"
  );
  assert.match(
    componentSource,
    /col-span-7[^"'>]*justify-start/,
    "Left column must use justify-start for natural top-aligned stacking"
  );

  // Right column should not have justify-between
  assert.doesNotMatch(
    componentSource,
    /col-span-5[^"'>]*justify-between/,
    "Right column must not use justify-between to prevent vertical stretching"
  );
  assert.match(
    componentSource,
    /col-span-5[^"'>]*justify-start/,
    "Right column must use justify-start for natural top-aligned stacking"
  );
});

test("ReservationConfirmationStep applies generous border breathing room and header framing", () => {
  // Wrapper should have responsive padding p-6 sm:p-8 lg:p-10 and space-y-7
  assert.match(
    componentSource,
    /p-6\s+sm:p-8\s+lg:p-10[^"'>]*rf-confirmation-wrapper|rf-confirmation-wrapper[^"'>]*p-6\s+sm:p-8\s+lg:p-10/,
    "Wrapper must include generous p-6 sm:p-8 lg:p-10 padding for border breathing room"
  );
  assert.match(
    componentSource,
    /space-y-7/,
    "Wrapper must use space-y-7 to cleanly separate header from bento cards"
  );

  // Header should have top framing and pb-6 bottom padding
  assert.match(
    componentSource,
    /pt-1\s+sm:pt-2/,
    "Header must have pt-1 sm:pt-2 top breathing space"
  );
  assert.match(
    componentSource,
    /pb-6/,
    "Header must have pb-6 bottom padding before divider"
  );
});

test("ReservationConfirmationStep next steps list does not stretch children with justify-around", () => {
  assert.doesNotMatch(
    componentSource,
    /rf-steps-list[^"'>]*justify-around/,
    "Next steps list must not use justify-around to prevent unnatural step distribution"
  );
});

test("reservation-flow.css defines clean spacing tokens for confirmation step", () => {
  // Celebration banner should have refined padding
  assert.match(
    cssSource,
    /\.rf-celebration-banner\s*\{[\s\S]*?padding:\s*24px\s+20px\s+20px/
  );

  // Summary card padding and layout
  assert.match(
    cssSource,
    /\.rf-summary-card\s*\{[\s\S]*?padding:\s*16px\s+14px/
  );

  // Steps list natural spacing
  assert.match(
    cssSource,
    /\.rf-steps-list\s*\{[\s\S]*?gap:\s*16px/
  );
});
