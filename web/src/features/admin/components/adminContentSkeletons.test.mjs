import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("AdminContentSkeletons exports bespoke skeletons for Branches, Settings, and Backups", () => {
  const skeletonsFile = fs.readFileSync(
    path.join(__dirname, "AdminContentSkeletons.jsx"),
    "utf8"
  );

  assert.match(skeletonsFile, /export function AdminBranchesSkeleton/);
  assert.match(skeletonsFile, /export function AdminPoliciesSettingsSkeleton/);
  assert.match(skeletonsFile, /export function AdminSystemBackupSkeleton/);
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
});
