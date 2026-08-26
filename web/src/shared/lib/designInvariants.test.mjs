import test from "node:test";
import assert from "node:assert/strict";
import { scanDesignInvariants } from "../../../scripts/lint-design-invariants.mjs";

test("Design Invariant Suite: All UI components must adhere strictly to solid tokens, neutral borders, and terminology invariants", () => {
  const { filesScanned, violations } = scanDesignInvariants();
  assert.ok(filesScanned > 50, "Scanner must inspect all UI component files");
  
  if (violations.length > 0) {
    const errorDetails = violations.map((v) => `${v.file}: ${v.rule} (${v.matches.join(", ")})`).join("\n");
    assert.fail(`Design invariant violations found:\n${errorDetails}`);
  }
  
  assert.equal(violations.length, 0, "No design token or terminology invariant violations permitted");
});
