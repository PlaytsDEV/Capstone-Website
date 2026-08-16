import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");

test("AdminTabs component and CSS exist with unified solid underline standard", () => {
  const tabsJsx = fs.readFileSync(
    path.join(webRoot, "src/shared/components/AdminTabs.jsx"),
    "utf8",
  );
  const tabsCss = fs.readFileSync(
    path.join(webRoot, "src/shared/components/AdminTabs.css"),
    "utf8",
  );

  assert.match(tabsJsx, /role="tablist"/);
  assert.match(tabsJsx, /role="tab"/);
  assert.match(tabsJsx, /aria-selected=/);
  assert.match(tabsJsx, /admin-tab-btn--active/);
  assert.match(tabsJsx, /admin-tab-badge/);

  assert.match(tabsCss, /\.admin-tabs-bar/);
  assert.match(tabsCss, /\.admin-tab-btn/);
  assert.match(tabsCss, /\.admin-tab-btn--active/);
  assert.match(tabsCss, /border-bottom:\s*2px solid var\(--foreground/);
});

test("System category pages integrate AdminTabs component", () => {
  const read = (relativePath) =>
    fs.readFileSync(path.join(webRoot, relativePath), "utf8");

  // SystemSettingsPage
  const systemSettings = read(
    "src/features/super-admin/pages/SystemSettingsPage.jsx",
  );
  assert.match(systemSettings, /import AdminTabs/);
  assert.match(systemSettings, /<AdminTabs/);

  // UserManagementPage
  const userManagement = read(
    "src/features/admin/pages/UserManagementPage.jsx",
  );
  assert.match(userManagement, /import AdminTabs/);
  assert.match(userManagement, /<AdminTabs/);

  // PageShell (used by AuditLogsPage)
  const pageShell = read(
    "src/features/admin/components/shared/PageShell.jsx",
  );
  assert.match(pageShell, /import AdminTabs/);
  assert.match(pageShell, /<AdminTabs/);

  // AuditLogsPage search params synchronization
  const auditLogs = read("src/features/admin/pages/AuditLogsPage.jsx");
  assert.match(auditLogs, /useSearchParams/);
  assert.match(auditLogs, /SECURITY_SIGNALS_TAB/);
});
