import { describe, expect, test } from "@jest/globals";
import path from "path";
import { isPathInsideRoot } from "./billingDocumentPath.js";

describe("billing document cache path boundary", () => {
  const root = path.resolve("server", "uploads", "bills");

  test("accepts a document below the configured billing root", () => {
    expect(isPathInsideRoot(root, path.join(root, "bill-1.pdf"))).toBe(true);
  });

  test("rejects traversal and sibling-prefix paths", () => {
    expect(isPathInsideRoot(root, path.resolve(root, "..", "private.pdf"))).toBe(false);
    expect(isPathInsideRoot(root, `${root}-evil${path.sep}bill-1.pdf`)).toBe(false);
    expect(isPathInsideRoot(root, root)).toBe(false);
  });
});
