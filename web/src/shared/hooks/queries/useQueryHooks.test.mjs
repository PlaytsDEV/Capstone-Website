import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");

test("useSystemBackup defines BACKUP_QUERY_KEYS and hook exports", async () => {
  const source = await readFile(
    path.join(__dirname, "useSystemBackup.js"),
    "utf8"
  );

  assert.match(source, /export const BACKUP_QUERY_KEYS = {/);
  assert.match(source, /all:\s*\["backups"\]/);
  assert.match(source, /config:/);
  assert.match(source, /history:/);
  assert.match(source, /list:/);
  assert.match(source, /export function useBackupConfig/);
  assert.match(source, /export function useBackupHistory/);
  assert.match(source, /export function useBackupList/);
  assert.match(source, /export function useCreateBackupMutation/);
  assert.match(source, /export function useRestoreBackupMutation/);
  assert.match(source, /export function useUpdateBackupConfigMutation/);
  assert.match(source, /export function useDeleteBackupMutation/);
  assert.match(source, /export function useUploadAndRestoreMutation/);
});

test("useSystemSettingsQuery defines SETTINGS_QUERY_KEYS and hook exports", async () => {
  const source = await readFile(
    path.join(__dirname, "useSystemSettingsQuery.js"),
    "utf8"
  );

  assert.match(source, /export const SETTINGS_QUERY_KEYS = {/);
  assert.match(source, /all:\s*\["settings"\]/);
  assert.match(source, /business:/);
  assert.match(source, /system:/);
  assert.match(source, /export function useSystemSettings/);
  assert.match(source, /export function useUpdateSystemSettingsMutation/);
  assert.match(source, /export function useUpdateBranchSettingsMutation/);
});

test("useOwnerFinancials defines FINANCIAL_QUERY_KEYS and hook exports", async () => {
  const source = await readFile(
    path.join(__dirname, "useOwnerFinancials.js"),
    "utf8"
  );

  assert.match(source, /export const FINANCIAL_QUERY_KEYS = {/);
  assert.match(source, /all:\s*\["financial"\]/);
  assert.match(source, /overview:/);
  assert.match(source, /export function useOwnerFinancialOverview/);
  assert.match(source, /export function useFinancialOverview/);
});



test("SystemBackupPage imports and consumes useSystemBackup hooks", async () => {
  const source = await readFile(
    path.join(rootDir, "features/admin/pages/SystemBackupPage.jsx"),
    "utf8"
  );

  assert.match(source, /useBackupConfig/);
  assert.match(source, /useBackupHistory/);
  assert.match(source, /useUpdateBackupConfigMutation/);
  assert.match(source, /useTriggerBackupMutation/);
  assert.match(source, /useDeleteBackupMutation/);
  assert.match(source, /useRestoreBackupMutation/);
  assert.match(source, /useUploadAndRestoreMutation/);
});

test("SystemSettingsPage imports and consumes useSystemSettingsQuery hooks", async () => {
  const source = await readFile(
    path.join(rootDir, "features/owner/pages/SystemSettingsPage.jsx"),
    "utf8"
  );

  assert.match(source, /useSystemSettings/);
  assert.match(source, /useUpdateSystemSettingsMutation/);
  assert.match(source, /useUpdateBranchSettingsMutation/);
});

test("FinancialOverviewPage imports and consumes useOwnerFinancialOverview hook", async () => {
  const source = await readFile(
    path.join(rootDir, "features/owner/pages/FinancialOverviewPage.jsx"),
    "utf8"
  );

  assert.match(source, /useOwnerFinancialOverview/);
});
