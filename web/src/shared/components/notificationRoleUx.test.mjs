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
