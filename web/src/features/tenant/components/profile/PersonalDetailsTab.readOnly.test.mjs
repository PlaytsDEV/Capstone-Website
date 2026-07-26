import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./PersonalDetailsTab.jsx", import.meta.url), "utf8");

test("approved tenant application details are presented as read-only", () => {
  assert.match(source, /applicationDetailsLocked = profileData\.role === "tenant"/);
  assert.match(source, /These details came from your approved application form and cannot be edited here/);
  assert.match(source, /If you need to request a correction, please contact the admin/);
});

test("tenant edit and add affordances are suppressed for locked fields", () => {
  assert.match(source, /!applicationDetailsLocked \? \(\s*<button onClick=\{handleStartEditing\}/);
  assert.match(source, /onAdd=\{applicationDetailsLocked \? undefined : handleStartEditing\}/);
});
