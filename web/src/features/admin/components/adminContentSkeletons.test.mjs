import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("AdminContentSkeletons exports bespoke skeletons for Branches, Settings, Backups, Analytics, and Room Availability", () => {
  const skeletonsFile = fs.readFileSync(
    path.join(__dirname, "AdminContentSkeletons.jsx"),
    "utf8"
  );

  assert.match(skeletonsFile, /export function AdminBranchesSkeleton/);
  assert.match(skeletonsFile, /export function AdminPoliciesSettingsSkeleton/);
  assert.match(skeletonsFile, /export function AdminSystemBackupSkeleton/);
  assert.match(skeletonsFile, /export function AdminAnalyticsSkeleton/);
  assert.match(skeletonsFile, /export function AdminAnalyticsDetailSkeleton/);
  assert.match(skeletonsFile, /export function AdminRoomAvailabilitySkeleton/);
  assert.match(skeletonsFile, /export const AdminRoomManagementSkeleton/);
});

test("AdminRoomAvailabilitySkeleton mirrors Room Management UI architecture with 6 KPI cards, filters, and double-deck layout", () => {
  const skeletonsFile = fs.readFileSync(
    path.join(__dirname, "AdminContentSkeletons.jsx"),
    "utf8"
  );

  // Sticky sub-header
  assert.match(skeletonsFile, /admin-page-header admin-page-header--sticky/);
  // 6 KPI cards grid
  assert.match(skeletonsFile, /grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3\.5/);
  // Preset chips bar & search controls
  assert.match(skeletonsFile, /Quick Preset Filter Chips Bar/);
  // Multi-category status legend bar
  assert.match(skeletonsFile, /Multi-Category Status Legend Bar/);
  // Floor grouped room cards & Double deck layout frame
  assert.match(skeletonsFile, /Floor Section Header/);
  assert.match(skeletonsFile, /Double Deck Bunk Layout Frame/);
  // Bottom summary & pagination controls
  assert.match(skeletonsFile, /Bottom Summary & Fast Page Controls Footer/);
});

test("RoomAvailabilityPage uses AdminRoomAvailabilitySkeleton", () => {
  const roomPageFile = fs.readFileSync(
    path.join(__dirname, "../pages/RoomAvailabilityPage.jsx"),
    "utf8"
  );

  assert.match(roomPageFile, /AdminRoomAvailabilitySkeleton/);
  assert.doesNotMatch(roomPageFile, /AdminCardGridSkeleton/);
});

test("adminRoutes uses bespoke skeletons including AdminRoomAvailabilitySkeleton as route fallbacks", () => {
  const routesFile = fs.readFileSync(
    path.join(__dirname, "../../../app/routes/adminRoutes.jsx"),
    "utf8"
  );

  assert.match(routesFile, /fallback=\{<AdminBranchesSkeleton \/>\}/);
  assert.match(routesFile, /fallback=\{<AdminPoliciesSettingsSkeleton \/>\}/);
  assert.match(routesFile, /fallback=\{<AdminSystemBackupSkeleton \/>\}/);
  assert.match(routesFile, /fallback=\{<AdminAnalyticsSkeleton \/>\}/);
  assert.match(routesFile, /fallback=\{<AdminRoomAvailabilitySkeleton \/>\}/);
});

test("AdminBranchesSkeleton includes required UI sections and aria accessibility", () => {
  const skeletonsFile = fs.readFileSync(
    path.join(__dirname, "AdminContentSkeletons.jsx"),
    "utf8"
  );

  assert.match(skeletonsFile, /sa-branches-overview/);
  assert.match(skeletonsFile, /sa-branches-grid/);
  assert.match(skeletonsFile, /sa-branch-card/);
  assert.match(skeletonsFile, /sa-branch-occupancy/);
  assert.match(skeletonsFile, /sa-branch-stats/);
  assert.match(skeletonsFile, /sa-branch-admins/);
  assert.match(skeletonsFile, /sa-branch-links/);
});

test("AdminPoliciesSettingsSkeleton includes section cards, form grids, and metadata bar", () => {
  const skeletonsFile = fs.readFileSync(
    path.join(__dirname, "AdminContentSkeletons.jsx"),
    "utf8"
  );

  assert.match(skeletonsFile, /sa-settings-meta-bar/);
  assert.match(skeletonsFile, /sa-settings-section/);
  assert.match(skeletonsFile, /sa-settings-form-grid/);
  assert.match(skeletonsFile, /sa-settings-footer/);
});

test("AdminSystemBackupSkeleton includes configuration card and backup history table", () => {
  const skeletonsFile = fs.readFileSync(
    path.join(__dirname, "AdminContentSkeletons.jsx"),
    "utf8"
  );

  assert.match(skeletonsFile, /backup-config-card/);
  assert.match(skeletonsFile, /backup-toggle-row/);
  assert.match(skeletonsFile, /backup-interval-group/);
  assert.match(skeletonsFile, /backup-history-card/);
  assert.match(skeletonsFile, /backup-table/);
  assert.match(skeletonsFile, /backup-pagination/);
});

test("adminRoutes uses bespoke skeletons as route fallbacks", () => {
  const routesFile = fs.readFileSync(
    path.join(__dirname, "../../../app/routes/adminRoutes.jsx"),
    "utf8"
  );

  assert.match(routesFile, /fallback=\{<AdminBranchesSkeleton \/>\}/);
  assert.match(routesFile, /fallback=\{<AdminPoliciesSettingsSkeleton \/>\}/);
  assert.match(routesFile, /fallback=\{<AdminSystemBackupSkeleton \/>\}/);
  assert.match(routesFile, /fallback=\{<AdminAnalyticsSkeleton \/>\}/);
});

test("AdminAnalyticsSkeleton includes topbar, tabs, 4 KPI cards, and charts grid", () => {
  const skeletonsFile = fs.readFileSync(
    path.join(__dirname, "AdminContentSkeletons.jsx"),
    "utf8"
  );

  assert.match(skeletonsFile, /analytics-container/);
  assert.match(skeletonsFile, /analytics-topbar/);
  assert.match(skeletonsFile, /analytics-tabs/);
  assert.match(skeletonsFile, /analytics-kpi-grid/);
  assert.match(skeletonsFile, /analytics-charts-grid/);
  assert.match(skeletonsFile, /analytics-chart-card/);
});

test("AnalyticsPage uses AdminAnalyticsSkeleton instead of AdminDashboardSkeleton", () => {
  const analyticsPageFile = fs.readFileSync(
    path.join(__dirname, "../pages/AnalyticsPage.jsx"),
    "utf8"
  );

  assert.match(analyticsPageFile, /AdminAnalyticsSkeleton/);
  assert.doesNotMatch(analyticsPageFile, /AdminDashboardSkeleton/);
});

test("adminRoutes uses GlobalLoading spinner for root admin reload and layout fallbacks", () => {
  const routesFile = fs.readFileSync(
    path.join(__dirname, "../../../app/routes/adminRoutes.jsx"),
    "utf8"
  );

  assert.match(routesFile, /loadingFallback=\{<GlobalLoading \/>\}/);
  assert.match(routesFile, /RouteShell name="AdminLayout" fallback=\{<GlobalLoading \/>\}/);
});

test("AdminAnalyticsSkeleton and DetailSkeleton avoid colored icon classes and active tab highlights in skeleton loading", () => {
  const skeletonsFile = fs.readFileSync(
    path.join(__dirname, "AdminContentSkeletons.jsx"),
    "utf8"
  );

  // Ensure no colored icon wrapper classes (e.g. analytics-kpi-icon blue/green/amber/purple) are used in skeleton
  assert.doesNotMatch(skeletonsFile, /analytics-kpi-icon (?:blue|green|amber|purple)/);
  assert.doesNotMatch(skeletonsFile, /iconBg:\s*["'](?:blue|green|amber|purple)["']/);

  // Ensure navigation tabs do not have active class highlights or underlines during loading
  assert.doesNotMatch(skeletonsFile, /analytics-tab\s+\$\{isActive/);
});



