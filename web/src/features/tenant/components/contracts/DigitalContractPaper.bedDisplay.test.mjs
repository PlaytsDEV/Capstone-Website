import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DigitalContractPaper.jsx", import.meta.url), "utf8");

test("bed slot display is normalized through normalizeBedDisplay, not the raw compact code", () => {
  assert.match(source, /normalizeBedDisplay\(stayData\?\.bedLabel \|\| contract\?\.bedLabel \|\| "upper"\)/);
});

test("compact bed-code suffixes map to the same Upper/Lower wording as the canonical PDF", () => {
  const suffixMap = source.match(
    /const BED_CODE_POSITION_LABELS = Object\.freeze\(\{ U: "Upper", L: "Lower", S: "" \}\);/,
  );
  assert.ok(suffixMap, "expected the -U/-L/-S -> Upper/Lower/blank mapping to be present");
});

test("private rooms still display Entire Room, unaffected by bed normalization", () => {
  assert.match(source, /const bedSlot = isPrivate \? "Entire Room" : normalizeBedDisplay/);
});
