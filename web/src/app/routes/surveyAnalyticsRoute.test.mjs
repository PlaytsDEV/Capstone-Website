import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routesSource = readFileSync(
  new URL("./adminRoutes.jsx", import.meta.url),
  "utf8",
);
const layoutSource = readFileSync(
  new URL("../../features/admin/components/AdminLayout.jsx", import.meta.url),
  "utf8",
);

test("feedback survey analytics route redirects to analytics tab", () => {
  assert.match(routesSource, /path="analytics\/feedback-surveys"/);
  assert.match(
    routesSource,
    /<Navigate to="\/admin\/analytics\?tab=surveys" replace \/>/,
  );
});
