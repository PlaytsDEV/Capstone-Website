import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("ContactFooter enforces balanced compact padding and grid spacing", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "ContactFooter.jsx"),
    "utf8"
  );

  // Outer container padding must be py-8 lg:py-10 (not py-12 lg:py-16)
  assert.match(
    rawCode,
    /className="[^"]*py-8 lg:py-10[^"]*"/,
    "Footer outer container must use balanced compact vertical padding py-8 lg:py-10"
  );
  assert.doesNotMatch(
    rawCode,
    /py-12 lg:py-16/,
    "Footer outer container must not use oversized py-12 lg:py-16 padding"
  );

  // Grid column gaps and bottom margin
  assert.match(
    rawCode,
    /gap-8 lg:gap-10\s+mb-6/,
    "Footer grid must use compact gap-8 lg:gap-10 and mb-6 bottom margin"
  );
  assert.doesNotMatch(
    rawCode,
    /gap-10 lg:gap-16\s+mb-10/,
    "Footer grid must not use oversized gap-10 lg:gap-16 or mb-10"
  );
});

test("ContactFooter enforces compact typography margins and list item spacing", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "ContactFooter.jsx"),
    "utf8"
  );

  // Heading bottom margins should be mb-3 (not mb-5)
  const headingMargins = rawCode.match(/tracking-widest uppercase mb-\d+/g) || [];
  for (const headingClass of headingMargins) {
    assert.match(
      headingClass,
      /mb-3/,
      `Section heading must use compact mb-3 margin, found: ${headingClass}`
    );
  }

  // Navigation and Get in Touch list spacing should be space-y-2
  assert.match(
    rawCode,
    /<ul className="space-y-2">/,
    "Navigation and Contact lists must use compact space-y-2 spacing"
  );

  // Locations list spacing should be space-y-2.5
  assert.match(
    rawCode,
    /<ul className="space-y-2\.5">/,
    "Locations list must use compact space-y-2.5 spacing"
  );

  // Social icon size should be 32px
  assert.match(
    rawCode,
    /width:\s*'32px',\s*height:\s*'32px'/,
    "Social media icon buttons must use 32px dimensions"
  );

  // Bottom legal bar padding should be pt-4
  assert.match(
    rawCode,
    /className="pt-4"/,
    "Bottom legal bar must use compact pt-4 padding"
  );
  assert.doesNotMatch(
    rawCode,
    /className="pt-6"/,
    "Bottom legal bar must not use oversized pt-6 padding"
  );
});

test("RoomDetailsPage imports ContactFooter for public page footer consistency", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "RoomDetailsPage.jsx"),
    "utf8"
  );

  assert.match(
    rawCode,
    /import\s+(?:ContactFooter|Footer)\s+from\s+["']\.\/ContactFooter["']/,
    "RoomDetailsPage must import ContactFooter for unified footer styling"
  );
  assert.doesNotMatch(
    rawCode,
    /from\s+["'][^"']*shared\/components\/Footer["']/,
    "RoomDetailsPage must not use legacy shared/components/Footer"
  );
});
