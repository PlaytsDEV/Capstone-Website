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

test("feedback survey analytics route uses the centralized permission guard", () => {
  assert.match(routesSource, /path="analytics\/feedback-surveys"/);
  assert.match(
    routesSource,
    /<RequirePermission permission="viewSurveyAnalytics">[\s\S]*?<SurveyAnalyticsPage \/>/,
  );
});

test("feedback survey analytics route has nested Analytics breadcrumbs", () => {
  assert.match(
    layoutSource,
    /location\.pathname === "\/admin\/analytics\/feedback-surveys"/,
  );
  assert.match(layoutSource, /\["Admin", "Analytics", pageMeta\.title\]/);
});
