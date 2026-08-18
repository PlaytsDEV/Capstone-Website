import test from "node:test";
import assert from "node:assert/strict";

import { formatBranch, formatRoomType, formatDisplayName, capitalizeWords, toTitleCase } from "./formatDate.js";

test("branch and room type formatters handle populated objects safely", () => {
  assert.equal(
    formatBranch({ slug: "gil-puyat", name: "Gil Puyat" }),
    "Gil Puyat",
  );
  assert.equal(formatBranch({ name: "Custom Branch" }), "Custom Branch");
  assert.equal(
    formatRoomType({ value: "quadruple-sharing", label: "Quadruple Sharing" }),
    "Quadruple Sharing",
  );
  assert.equal(formatRoomType({ label: "Executive Suite" }), "Executive Suite");
});

test("formatDisplayName properly capitalizes first letter of each word", () => {
  assert.equal(formatDisplayName("vince palicpic"), "Vince Palicpic");
  assert.equal(formatDisplayName("VINCE PALICPIC"), "Vince Palicpic");
  assert.equal(formatDisplayName("vince"), "Vince");
  assert.equal(formatDisplayName("juan dela cruz"), "Juan Dela Cruz");
  assert.equal(formatDisplayName("mary-jane"), "Mary-Jane");
  assert.equal(formatDisplayName("o'connor"), "O'Connor");
  assert.equal(formatDisplayName(""), "");
  assert.equal(formatDisplayName(null), "");
  assert.equal(formatDisplayName(undefined), "");
  assert.equal(capitalizeWords("vince palicpic"), "Vince Palicpic");
  assert.equal(toTitleCase("vince palicpic"), "Vince Palicpic");
});

