import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const writePattern = /(?:\.save\s*\(|\.create\s*\(|insert(?:One|Many)\s*\(|update(?:One|Many)\s*\(|delete(?:One|Many)\s*\(|findOneAnd(?:Update|Delete|Replace)\s*\(|replaceOne\s*\(|bulkWrite\s*\(|dropDatabase\s*\(|createUser\s*\(|deleteUser\s*\(|setCustomUserClaims\s*\()/i;

describe("direct write-tool safety", () => {
  test("every database/Firebase write script imports the fail-closed staging guard", () => {
    const unsafe = fs.readdirSync(__dirname)
      .filter((name) => /\.(?:c?js|mjs)$/.test(name) && !/\.test\./.test(name))
      .filter((name) => {
        const source = fs.readFileSync(path.join(__dirname, name), "utf8");
        return writePattern.test(source) && !source.includes("assertStagingWriteTarget");
      });
    expect(unsafe).toEqual([]);
  });
});
