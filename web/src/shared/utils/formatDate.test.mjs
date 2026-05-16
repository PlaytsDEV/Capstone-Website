import test from "node:test";
import assert from "node:assert/strict";

import { formatBranch, formatRoomType } from "./formatDate.js";

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
