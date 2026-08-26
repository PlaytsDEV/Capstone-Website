import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "legacyRoutes.jsx"), "utf8");

test("legacy contract and document routes redirect to /applicant/contracts", () => {
  assert.match(
    source,
    /<Route\s+path="\/tenant\/documents"\s+element={<LegacyRedirect\s+to="\/applicant\/contracts"\s*\/>}\s*\/>/,
  );
  assert.match(
    source,
    /<Route\s+path="\/tenant\/contracts"\s+element={<LegacyRedirect\s+to="\/applicant\/contracts"\s*\/>}\s*\/>/,
  );
  assert.match(
    source,
    /<Route\s+path="\/documents"\s+element={<LegacyRedirect\s+to="\/applicant\/contracts"\s*\/>}\s*\/>/,
  );
  assert.match(
    source,
    /<Route\s+path="\/contracts"\s+element={<LegacyRedirect\s+to="\/applicant\/contracts"\s*\/>}\s*\/>/,
  );
});

test("legacy tenant subroutes redirect to canonical /applicant counterparts", () => {
  assert.match(
    source,
    /<Route\s+path="\/tenant\/reservation"\s+element={<LegacyRedirect\s+to="\/applicant\/reservation"\s*\/>}\s*\/>/,
  );
  assert.match(
    source,
    /<Route\s+path="\/tenant\/billing"\s+element={<LegacyRedirect\s+to="\/applicant\/billing"\s*\/>}\s*\/>/,
  );
  assert.match(
    source,
    /<Route\s+path="\/tenant\/maintenance"\s+element={<LegacyRedirect\s+to="\/applicant\/maintenance"\s*\/>}\s*\/>/,
  );
  assert.match(
    source,
    /<Route\s+path="\/tenant\/announcements"\s+element={<LegacyRedirect\s+to="\/applicant\/announcements"\s*\/>}\s*\/>/,
  );
  assert.match(
    source,
    /<Route\s+path="\/tenant\/profile"\s+element={<LegacyRedirect\s+to="\/applicant\/profile"\s*\/>}\s*\/>/,
  );
  assert.match(
    source,
    /<Route\s+path="\/tenant\/account"\s+element={<LegacyRedirect\s+to="\/applicant\/profile"\s*\/>}\s*\/>/,
  );
  assert.match(
    source,
    /<Route\s+path="\/bill-details"\s+element={<LegacyRedirect\s+to="\/applicant\/billing"\s*\/>}\s*\/>/,
  );
});
