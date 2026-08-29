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

test("ReservationDetailsModal closes confirmModal on error in doAction catch block", async () => {
  const source = await readModalSource();

  // Verifies that doAction closes the confirmation modal immediately in the catch block
  assert.match(
    source,
    /catch\s*\(\s*error\s*\)\s*\{\s*setConfirmModal\(\s*\(previous\)\s*=>\s*\(\{\s*\.\.\.previous,\s*open:\s*false\s*\}\)\s*\);/,
    "doAction catch block must close confirmModal so errors/toasts are not obscured by the confirmation modal",
  );
});

test("ReservationDetailsModal performs client-side continuity validation on initial meter reading", async () => {
  const source = await readModalSource();

  // Verifies that move-in client validation checks reading < previousMeterReading
  assert.match(
    source,
    /branchUsesSubmeter\s*&&\s*reading\s*!==\s*null\s*&&\s*previousMeterReading\s*!=\s*null[\s\S]*?reading\s*<\s*Number\(previousMeterReading\)/,
    "Move-in handler must validate that starting meter reading is not lower than previous reading before opening modal",
  );
});

test("ReservationDetailsModal closes revisionReasonModal on error in onSubmit catch block", async () => {
  const source = await readModalSource();

  // Verifies that RevisionReasonModal closes on error
  assert.match(
    source,
    /<RevisionReasonModal[\s\S]*?catch\s*\(\s*error\s*\)\s*\{\s*setRevisionModal\(\s*\{\s*open:\s*false\s*\}\s*\);/,
    "RevisionReasonModal catch block must close the modal so error notification is visible",
  );
});
