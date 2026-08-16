import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./PersonalDetailsTab.jsx", import.meta.url), "utf8");

test("profile details and profile image have editing affordances enabled", () => {
  assert.match(source, /handleStartEditing/);
  assert.match(source, /Edit Profile/);
  assert.match(source, /handleFileSelect/);
});

test("profile image upload is always accessible via avatar click and camera badge", () => {
  assert.match(source, /fileInputRef\.current\?\.click\(\)/);
  assert.match(source, /accept="image\/\*"/);
});

