import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const hookSource = readFileSync(join(__dirname, "useReservationFlow.js"), "utf8");

test("Stage 3 application submission emits 'Tenant application submitted successfully.' flash message", () => {
  const stage3BlockMatch = hookSource.match(
    /pendingStageAction === "submit_application" \|\| pendingStageAction === "stage3"[\s\S]*?appNavigate\("\/applicant\/profile",\s*\{[\s\S]*?\}\);/,
  );
  assert.ok(stage3BlockMatch, "handleStageConfirm stage 3 handler must exist");
  const stage3Code = stage3BlockMatch[0];

  assert.match(
    stage3Code,
    /message:\s*["']Tenant application submitted successfully\.["']/,
    "Stage 3 flash message must be 'Tenant application submitted successfully.'",
  );
  assert.doesNotMatch(
    stage3Code,
    /message:\s*["']Your application is under review/,
    "Stage 3 flash message must not use duplicate under review message",
  );
  assert.doesNotMatch(
    stage3Code,
    /setSuccessOverlay\(\{[\s\S]*?\}\);[\s\n]*appNavigate\("\/applicant\/profile"/,
    "Stage 3 submission must not trigger instantaneous unmounted successOverlay right before appNavigate",
  );
});

test("Stage 4 reservation submission emits 'Reservation submitted successfully.' flash message", () => {
  const stage4BlockMatch = hookSource.match(
    /pendingStageAction === "stage4"[\s\S]*?appNavigate\("\/applicant\/profile",\s*\{[\s\S]*?\}\);/,
  );
  assert.ok(stage4BlockMatch, "handleStageConfirm stage 4 handler must exist");
  const stage4Code = stage4BlockMatch[0];

  assert.match(
    stage4Code,
    /message:\s*["']Reservation submitted successfully\.["']/,
    "Stage 4 flash message must be 'Reservation submitted successfully.'",
  );
  assert.doesNotMatch(
    stage4Code,
    /message:\s*["']Your reservation is being processed by admin\.["']/,
    "Stage 4 flash message must not use legacy processing message",
  );
  assert.doesNotMatch(
    stage4Code,
    /setSuccessOverlay\(\{[\s\S]*?\}\);[\s\n]*appNavigate\("\/applicant\/profile"/,
    "Stage 4 submission must not trigger instantaneous unmounted successOverlay right before appNavigate",
  );
});
