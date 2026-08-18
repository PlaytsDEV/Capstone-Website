import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./PersonalDetailsTab.jsx", import.meta.url), "utf8");

test("profile details and profile image have editing affordances enabled", () => {
  assert.match(source, /handleStartEditing/);
  assert.match(source, /Edit Profile/);
  assert.match(source, /handleFileSelect/);
});

test("profile image upload and camera badge are gated to edit profile mode", () => {
  assert.match(source, /fileInputRef\.current\?\.click\(\)/);
  assert.match(source, /accept="image\/\*"/);
  assert.match(source, /isEditingProfile/);
});


