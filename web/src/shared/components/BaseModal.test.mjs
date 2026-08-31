import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const baseModalSource = fs.readFileSync(
  new URL("./BaseModal.jsx", import.meta.url),
  "utf8"
);

test("BaseModal intelligently derives close button visibility to prevent redundant X and Cancel", () => {
  // Must check for footer cancel button to avoid redundant X
  assert.match(
    baseModalSource,
    /hasFooterCancel|shouldShowCloseButton|hasCancelButton/i,
    "BaseModal must calculate close button visibility based on footer cancel presence"
  );

  // Must not hardcode showCloseButton = true unconditionally
  assert.doesNotMatch(
    baseModalSource,
    /showCloseButton\s*=\s*true\s*,/,
    "BaseModal parameter showCloseButton should not default unconditionally to true"
  );
});
