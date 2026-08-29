import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { destinationRoomNeedsBed } from "./transferDestinationBed.js";

// The Transfer Tenant wizard used to gate "New Bed" on an enumerated list
// (=== "double-sharing" || === "quadruple-sharing"). That diverged from the
// backend authority `roomRequiresIndividualBed`
// (server/services/reservationContractEligibilityService.js), which exempts
// ONLY "private". A non-private destination whose type was not one of those
// two strings sailed past the client gate with no bed and the backend then
// rejected the auto-built Room Transfer Addendum Contract with
// ROOM_TRANSFER_CONTRACT_INCOMPLETE (missing bedId). This predicate must now
// mirror the backend: private -> no bed, everything else -> bed required.

test("private destination needs NO bed", () => {
  assert.equal(destinationRoomNeedsBed("private"), false);
  assert.equal(destinationRoomNeedsBed("Private"), false);
  assert.equal(destinationRoomNeedsBed("  PRIVATE  "), false);
});

test("known shared destinations need a bed", () => {
  assert.equal(destinationRoomNeedsBed("double-sharing"), true);
  assert.equal(destinationRoomNeedsBed("quadruple-sharing"), true);
});

test("any other non-private room type also needs a bed (fail-safe, not fail-open)", () => {
  for (const t of [
    "triple-sharing",
    "bunk",
    "dormitory",
    "six-sharing",
    "shared",
    "unknown-future-type",
  ]) {
    assert.equal(destinationRoomNeedsBed(t), true, `${t} must require a bed`);
  }
});

test("no room type known yet -> no bed requirement (nothing selected)", () => {
  assert.equal(destinationRoomNeedsBed(""), false);
  assert.equal(destinationRoomNeedsBed(null), false);
  assert.equal(destinationRoomNeedsBed(undefined), false);
});

test("exactly mirrors the backend roomRequiresIndividualBed predicate", () => {
  // Backend: value !== "private" (after trim+lowercase) => true.
  const backendRule = (roomType) =>
    String(roomType || "").trim().toLowerCase() !== "private";
  for (const t of [
    "private", "Private", " private ",
    "double-sharing", "quadruple-sharing", "triple-sharing",
    "bunk", "", null, undefined, "  ",
  ]) {
    // The one intentional difference: an empty/whitespace/nullish type means
    // "no destination chosen yet" on the client, so the wizard does not yet
    // demand a bed. The backend only ever sees a real saved room type.
    const clientExpectsBed = destinationRoomNeedsBed(t);
    const hasRealType = !!t && String(t).trim() !== "";
    if (hasRealType) {
      assert.equal(
        clientExpectsBed,
        backendRule(t),
        `mismatch for room type ${JSON.stringify(t)}`,
      );
    } else {
      assert.equal(clientExpectsBed, false);
    }
  }
});

// ── Guard: the modal must use this shared predicate, not a re-enumerated list ──
const modalSource = fs.readFileSync(
  new URL("../components/TenantWorkspaceModals.jsx", import.meta.url),
  "utf8",
);
const transferModalSource = modalSource.slice(
  modalSource.indexOf("export function TransferTenantModal"),
  modalSource.indexOf("export function MoveOutModal"),
);

test("TransferTenantModal derives destinationNeedsBed from the shared helper", () => {
  assert.match(
    modalSource,
    /import \{ destinationRoomNeedsBed \} from "\.\.\/utils\/transferDestinationBed"/,
  );
  assert.match(
    transferModalSource,
    /const destinationNeedsBed = destinationRoomNeedsBed\(selectedRoomType\)/,
  );
  // The old enumerated check is gone.
  assert.doesNotMatch(
    transferModalSource,
    /selectedRoomType === "double-sharing" \|\| selectedRoomType === "quadruple-sharing"/,
  );
});

test("Confirm Schedule gate (step1Valid) still blocks a non-private destination with no bed", () => {
  // step1Valid requires (!destinationNeedsBed || !!bedId); with the new
  // predicate destinationNeedsBed is true for every non-private type.
  assert.match(
    transferModalSource,
    /const step1Valid =\s*[\s\S]*?\(!destinationNeedsBed \|\| !!bedId\)/,
  );
  // And the payload never sends a bed for a private destination.
  assert.match(
    transferModalSource,
    /targetBedId: destinationNeedsBed \? bedId : undefined/,
  );
});

test("changing the destination room clears the previously selected bed", () => {
  assert.match(
    transferModalSource,
    /onChange=\{\(newRoomId\) => \{\s*setRoomId\(newRoomId\);[\s\S]*?setBedId\(""\);\s*\}\}/,
  );
});
