import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../../..");

test("ReservationFilterDrawer does not contain duplicate Reservation Status dropdown", () => {
  const drawerJsx = fs.readFileSync(
    path.join(
      webRoot,
      "src/features/admin/components/ReservationFilterDrawer.jsx",
    ),
    "utf8",
  );

  // Must not render duplicate Reservation Status section or select
  assert.doesNotMatch(
    drawerJsx,
    /Reservation Status/i,
    "ReservationFilterDrawer should not contain duplicate 'Reservation Status' label",
  );
  assert.doesNotMatch(
    drawerJsx,
    /onStatusFilterChange/,
    "ReservationFilterDrawer should not have onStatusFilterChange prop",
  );
  assert.doesNotMatch(
    drawerJsx,
    /onCategoryFilterChange/,
    "ReservationFilterDrawer should not have onCategoryFilterChange prop",
  );

  // Must retain secondary filter sections
  assert.match(
    drawerJsx,
    /Move-In Date Timeframe/i,
    "ReservationFilterDrawer should retain Move-In Date Timeframe",
  );
  assert.match(
    drawerJsx,
    /Application Submitted/i,
    "ReservationFilterDrawer should retain Application Submitted section",
  );
  assert.match(
    drawerJsx,
    /Room Category \/ Type/i,
    "ReservationFilterDrawer should retain Room Category / Type section",
  );
});

test("ReservationsPage includes Needs Revision under Active Workflow in toolbar status dropdown", () => {
  const pageJsx = fs.readFileSync(
    path.join(webRoot, "src/features/admin/pages/ReservationsPage.jsx"),
    "utf8",
  );

  // Must include Needs Revision option with live count under Active Workflow
  assert.match(
    pageJsx,
    /<option\s+value="needs_revision">\s*Needs Revision\s*\(\{counts\.needsRevision\}\)\s*<\/option>/,
    "ReservationsPage status dropdown must include 'Needs Revision ({counts.needsRevision})'",
  );
});
