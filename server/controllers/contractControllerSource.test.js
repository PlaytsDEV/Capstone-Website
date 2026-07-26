import fs from "fs";
import { describe, expect, test } from "@jest/globals";

const source = fs.readFileSync(new URL("./contractController.js", import.meta.url), "utf8");

describe("secure prepared Contract responses", () => {
  test("admin and tenant streams prevent stale PDF caching", () => {
    expect(source.match(/Cache-Control", "private, no-store"/g)).toHaveLength(5);
    expect(source.match(/Pragma", "no-cache"/g)).toHaveLength(5);
  });

  test("default streams select the newest non-superseded prepared document", () => {
    expect(source.match(/filter\(\(entry\) => entry\.superseded !== true\)/g))
      .toHaveLength(2);
    expect(source.match(/sort\(\(a, b\) => Number\(b\.version\) - Number\(a\.version\)\)/g))
      .toHaveLength(4);
  });
});
