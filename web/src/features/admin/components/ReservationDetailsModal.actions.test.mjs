import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modalSource = readFileSync(
  new URL("./ReservationDetailsModal.jsx", import.meta.url),
  "utf8",
);
const apiSource = readFileSync(
  new URL("../../../shared/api/reservationApi.js", import.meta.url),
  "utf8",
);

test("admin lifecycle actions use dedicated reservation commands", () => {
  assert.match(modalSource, /reviewApplication\(reservation\.id,\s*"approve"\)/);
  assert.match(modalSource, /reviewApplication\(\s*reservation\.id,\s*"reject"/);
  assert.match(modalSource, /reviewApplication\(\s*reservation\.id,\s*"request_revision"/);
  assert.match(modalSource, /confirmMoveIn\(reservation\.id/);
  assert.match(modalSource, /release\(reservation\.id/);
  assert.match(apiSource, /\/application-review/);
  assert.match(apiSource, /\/move-in/);
});

test("confirmation is guarded against duplicate submissions", () => {
  assert.match(modalSource, /actionSubmittingRef\.current\) return/);
  assert.match(modalSource, /actionSubmittingRef\.current = true/);
  assert.match(modalSource, /actionSubmittingRef\.current = false/);
  assert.match(modalSource, /loading=\{isSubmitting\}/);
});
