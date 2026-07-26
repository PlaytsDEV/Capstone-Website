import fs from "fs";
import { describe, expect, test } from "@jest/globals";

const source = fs.readFileSync(new URL("./contractController.js", import.meta.url), "utf8");

describe("secure prepared Contract responses", () => {
  test("admin and tenant streams prevent stale PDF caching", () => {
    expect(source.match(/Cache-Control", "private, no-store"/g)).toHaveLength(5);
    expect(source.match(/Pragma", "no-cache"/g)).toHaveLength(5);
  });

  test("tenant stream delegates current-version selection to the canonical resolver", () => {
    expect(source).toMatch(/selectCurrentPreparedDocument\(contract\)/);
    expect(source).toMatch(/resolveCurrentPreparedDocument\(contract\)/);
    expect(source).toMatch(/PREPARED_DOCUMENT_UNAVAILABLE/);
  });
});
