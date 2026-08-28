import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readModalSource() {
  return readFile(path.join(__dirname, "ReservationDetailsModal.jsx"), "utf8");
}

test("ReservationDetailsModal calculates cancellationPending accurately", async () => {
  const source = await readModalSource();

  assert.match(
    source,
    /const cancellationPending = Boolean\(\s*reservation\?\.cancellationRequested\s*&&\s*reservation\?\.cancellationStatus === ["']pending["'],?\s*\);/,
    "cancellationPending should check cancellationRequested and cancellationStatus === 'pending'",
  );
});

test("ReservationDetailsModal disables Record Move In when cancellationPending is true with dedicated tooltip", async () => {
  const source = await readModalSource();

  // Disabled condition
  assert.match(
    source,
    /disabled=\{isSubmitting \|\| !isMoveInPaymentSettled \|\| cancellationPending\}/,
    "Record Move In button must be disabled when cancellationPending is true",
  );

  // Title / Tooltip
  assert.match(
    source,
    /title=\{\s*cancellationPending\s*\?\s*["']Move-in locked: A cancellation request is pending admin review\. Approve or reject the request first\.["']/,
    "Record Move In button must have specific cancellation lock tooltip",
  );
});

test("ReservationDetailsModal guards Record Move In onClick against cancellationPending", async () => {
  const source = await readModalSource();

  assert.match(
    source,
    /if\s*\(\s*cancellationPending\s*\)\s*\{\s*showNotification\(\s*["']Cannot move in tenant: A cancellation request is pending review\. Please approve or reject the request first\.["'],\s*["']warning["'],?\s*\);\s*return;\s*\}/,
    "onClick handler must check cancellationPending and show a warning notification",
  );
});

test("ReservationDetailsModal displays clean neutral guidance alert when cancellationPending is true", async () => {
  const source = await readModalSource();

  // Alert box rendering
  assert.match(
    source,
    /\{cancellationPending && \([\s\S]*?Move-In Locked:[\s\S]*?A tenant cancellation request is pending review\. Review and resolve \(Approve or Reject\) the cancellation request above before moving in the tenant\.[\s\S]*?\)\}/,
    "Alert callout box must render with clear guidance when cancellationPending is true",
  );

  // Strict Design Token Invariant: neutral 1px borders, no colored border outlines
  assert.match(
    source,
    /border-slate-200\s+dark:border-slate-700/,
    "Alert must use neutral 1px border tokens (border-slate-200 dark:border-slate-700)",
  );
  assert.doesNotMatch(
    source,
    /1px solid #FDE68A/,
    "Alert must not use colored border outlines (#FDE68A)",
  );
  assert.doesNotMatch(
    source,
    /1px solid #FECACA/,
    "Alert must not use colored border outlines (#FECACA)",
  );
});

test("ReservationDetailsModal does not show redundant payment settlement warning when cancellation is pending", async () => {
  const source = await readModalSource();

  assert.match(
    source,
    /\{!cancellationPending && !isMoveInPaymentSettled && \(/,
    "Payment unsettled alert must be suppressed when cancellationPending is true to avoid confusing duplicate alerts",
  );
});

test("ReservationDetailsModal locks Reschedule Move-in when cancellationPending is true", async () => {
  const source = await readModalSource();

  // Disabled and Title
  assert.match(
    source,
    /disabled=\{isSubmitting \|\| cancellationPending\}/,
    "Reschedule move-in button must be disabled when cancellationPending is true",
  );
  assert.match(
    source,
    /title=\{\s*cancellationPending\s*\?\s*["']Reschedule locked: A cancellation request is pending admin review\.["']\s*:\s*undefined\s*\}/,
    "Reschedule move-in button must have specific cancellation lock tooltip",
  );

  // OnClick Guard
  assert.match(
    source,
    /if\s*\(\s*cancellationPending\s*\)\s*\{\s*showNotification\(\s*["']Cannot reschedule move-in while a cancellation request is pending review\.["'],\s*["']warning["'],?\s*\);\s*return;\s*\}/,
    "Reschedule onClick handler must prevent action and warn when cancellation is pending",
  );
});

test("ReservationDetailsModal guards showMeterPrompt confirm button against cancellationPending", async () => {
  const source = await readModalSource();

  assert.match(
    source,
    /disabled=\{isSubmitting \|\| cancellationPending\}/,
    "Move-in meter confirmation button must be disabled when cancellation is pending",
  );
});
