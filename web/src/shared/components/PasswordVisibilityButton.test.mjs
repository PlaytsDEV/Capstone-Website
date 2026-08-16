import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");
const harnessPlugin = {
  name: "password-visibility-test-harness",
  configureServer(server) {
    server.middlewares.use("/__password-visibility-test__", async (req, res) => {
      res.setHeader("Content-Type", "text/html");
      const html = '<div id="root"></div><script type="module" src="/src/test-fixtures/PasswordVisibilityHarness.jsx"></script>';
      res.end(await server.transformIndexHtml(req.originalUrl, html));
    });
  },
};

test("password visibility control stays synchronized and accessible", async (t) => {
  const vite = await createServer({
    root: webRoot,
    configFile: path.resolve(webRoot, "vite.config.js"),
    logLevel: "error",
    plugins: [harnessPlugin],
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  t.after(() => vite.close());

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  const address = vite.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/__password-visibility-test__`);
  await page.getByTestId("password").waitFor({ state: "visible", timeout: 30_000 }).catch(() => {
    assert.fail(`password harness did not render: ${browserErrors.join(" | ")}`);
  });

  const password = page.getByTestId("password");
  const confirmation = page.getByTestId("confirmation");
  const passwordInput = password.getByLabel("password", { exact: true });
  const confirmationInput = confirmation.getByLabel("confirmation", { exact: true });
  const passwordToggle = password.getByRole("button", { name: "Show password" });
  const confirmationToggle = confirmation.getByRole("button", { name: "Show password" });

  assert.equal(await passwordInput.getAttribute("type"), "password");
  assert.equal(await passwordToggle.getAttribute("title"), "Show password");
  assert.equal(await passwordToggle.getAttribute("aria-pressed"), "false");
  assert.equal(await password.locator('[data-password-visibility-icon="hidden"]').count(), 1);
  assert.equal(await page.getByTestId("form").getAttribute("data-submits"), "0");

  await passwordToggle.click();
  assert.equal(await passwordInput.getAttribute("type"), "text");
  assert.equal(await passwordInput.inputValue(), "Secret-123!");
  const hideToggle = password.getByRole("button", { name: "Hide password" });
  assert.equal(await hideToggle.getAttribute("title"), "Hide password");
  assert.equal(await hideToggle.getAttribute("aria-pressed"), "true");
  assert.equal(await password.locator('[data-password-visibility-icon="visible"]').count(), 1);
  assert.equal(await confirmationInput.getAttribute("type"), "password");
  assert.equal(await page.getByTestId("form").getAttribute("data-submits"), "0");

  await page.getByTestId("validation").click();
  assert.equal(await page.getByTestId("errors").textContent(), "1");
  assert.equal(await passwordInput.getAttribute("type"), "text");
  assert.equal(await passwordInput.inputValue(), "Secret-123!");

  await hideToggle.press("Enter");
  assert.equal(await passwordInput.getAttribute("type"), "password");
  assert.equal(await passwordInput.inputValue(), "Secret-123!");
  assert.equal(await page.getByTestId("form").getAttribute("data-submits"), "0");

  await confirmationToggle.press("Space");
  assert.equal(await confirmationInput.getAttribute("type"), "text");
  assert.equal(await passwordInput.getAttribute("type"), "password");
  assert.equal(await confirmationInput.inputValue(), "Secret-123!");
});

test("every password surface uses the standardized current-state convention", () => {
  const read = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), "utf8");
  const integrations = [
    ["src/features/tenant/pages/SignIn.jsx", 1],
    ["src/features/public/pages/SignUp.jsx", 2],
    ["src/features/tenant/pages/ResetPassword.jsx", 1],
    ["src/features/tenant/components/profile/SettingsTab.jsx", 3],
    ["src/features/admin/components/users/AddUserModal.jsx", 1],
  ];

  for (const [file, expectedControls] of integrations) {
    const source = read(file);
    assert.match(source, /PasswordVisibilityButton/);
    assert.equal((source.match(/<PasswordVisibilityButton/g) || []).length, expectedControls);
    assert.doesNotMatch(source, /tabIndex=\{-1\}/);
    assert.doesNotMatch(source, /show\w*\s*\?\s*\(\s*<EyeOff/);
  }

  const serverReset = fs.readFileSync(
    path.resolve(webRoot, "../server/mobile/controllers/auth.controller.js"),
    "utf8",
  );
  assert.match(serverReset, /id="eye1" aria-label="Show password" title="Show password" aria-pressed="false"><svg class="eye-open"/);
  assert.match(serverReset, /id="eye2" aria-label="Show password" title="Show password" aria-pressed="false"><svg class="eye-open"/);
  assert.match(serverReset, /btn\.querySelector\('\.eye-open'\)\.hidden = !visible/);
});
