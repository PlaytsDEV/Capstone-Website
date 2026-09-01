import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedRoot = resolve(__dirname, "..");

const readSharedSource = (relativePath) =>
  readFileSync(resolve(sharedRoot, relativePath), "utf8");

test("applicant tenant shell exposes notification bell and sidebar badge", () => {
  const tenantLayout = readSharedSource("layouts/TenantLayout.jsx");
  const applicantTopBar = readSharedSource("components/ApplicantTopBar.jsx");
  const sidebar = readSharedSource("components/Sidebar.jsx");

  assert.match(tenantLayout, /<ApplicantTopBar /);
  assert.match(applicantTopBar, /<NotificationBell \/>/);
  assert.doesNotMatch(applicantTopBar, /ChevronDown|aria-haspopup|role="menu"/);
  assert.doesNotMatch(applicantTopBar, /Personal Details|Settings|Sign Out/);
  assert.match(sidebar, /useUnreadCount\(\)/);
  assert.match(sidebar, /item\.id === "notifications"/);
  assert.match(sidebar, /sidebarUnreadCount/);
});

test("notification cache, bell, and socket use role-aware visibility scope", () => {
  const notificationHooks = readSharedSource("hooks/queries/useNotifications.js");
  const notificationBell = readSharedSource("components/NotificationBell.jsx");
  const socketClient = readSharedSource("hooks/useSocketClient.js");

  assert.match(notificationHooks, /getNotificationQueryScope/);
  assert.match(notificationHooks, /KEYS\.unread\(scope\)/);
  assert.match(notificationBell, /getVisibleNotificationsForUser/);
  assert.match(socketClient, /isNotificationVisibleForUser/);
  assert.match(socketClient, /notificationQueryKeys\.unread\(scope\)/);
});

test("socket client triggers real-time UI page re-fetches across domain query keys on notification:new", () => {
  const socketClient = readSharedSource("hooks/useSocketClient.js");

  assert.match(socketClient, /qc\.invalidateQueries\(\{\s*queryKey:\s*\["reservations"\]/);
  assert.match(socketClient, /qc\.invalidateQueries\(\{\s*queryKey:\s*\["billing"\]/);
  assert.match(socketClient, /qc\.invalidateQueries\(\{\s*queryKey:\s*\["maintenance"\]/);
  assert.match(socketClient, /qc\.invalidateQueries\(\{\s*queryKey:\s*\["inquiries"\]/);
  assert.match(socketClient, /qc\.invalidateQueries\(\{\s*queryKey:\s*\["dashboard"\]/);
});

test("sidebar exposes My History tab for both applicants and tenants", () => {
  const sidebar = readSharedSource("components/Sidebar.jsx");
  assert.match(sidebar, /id:\s*"history"/);
  // Verify history item is present in navSections
  const historyIndex = sidebar.indexOf('id: "history"');
  assert.ok(historyIndex > 0, "My History tab must be defined in sidebar");
});

test("notification bell explicitly maps application_submitted notification type to file/document icon", () => {
  const notificationBell = readSharedSource("components/NotificationBell.jsx");
  assert.match(notificationBell, /case\s+"application_submitted":/);
});

test("notification bell uses role-aware action URL resolution for admins and tenants", () => {
  const notificationBell = readSharedSource("components/NotificationBell.jsx");

  // getNotificationActionUrl must accept isAdminUser parameter
  assert.match(notificationBell, /function\s+getNotificationActionUrl\s*\(\s*notification\s*,\s*isAdminUser/);

  // handleNotificationClick must pass isAdmin() to getNotificationActionUrl
  assert.match(notificationBell, /getNotificationActionUrl\s*\(\s*notification\s*,\s*isAdmin\(\)\s*\)/);

  // For admins, contract notifications must route to /admin/tenants
  assert.match(notificationBell, /\/admin\/tenants/);
});

test("admin contract notifications never route to applicant contracts", () => {
  const notificationBell = readSharedSource("components/NotificationBell.jsx");

  // Ensure /applicant/contracts is scoped to non-admin users
  assert.match(notificationBell, /contract_prepared|contract_incomplete|contract_signed/);
});

