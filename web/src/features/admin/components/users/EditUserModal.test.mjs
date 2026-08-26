import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const modalSource = fs.readFileSync(new URL("./EditUserModal.jsx", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("./edit/index.js", import.meta.url), "utf8");
const credSource = fs.readFileSync(new URL("./edit/UserCredentialsSection.jsx", import.meta.url), "utf8");
const personalSource = fs.readFileSync(new URL("./edit/UserPersonalSection.jsx", import.meta.url), "utf8");
const roleSource = fs.readFileSync(new URL("./edit/UserRoleSection.jsx", import.meta.url), "utf8");
const extendedSource = fs.readFileSync(new URL("./edit/UserExtendedSection.jsx", import.meta.url), "utf8");

test("EditUserModal decomposes form sections into modular components", () => {
  assert.match(modalSource, /UserCredentialsSection/);
  assert.match(modalSource, /UserPersonalSection/);
  assert.match(modalSource, /UserRoleSection/);
  assert.match(modalSource, /UserExtendedSection/);
  assert.match(modalSource, /from "\.\/edit"/);
});

test("edit/index.js cleanly exports all modular user edit sections", () => {
  assert.match(indexSource, /export \{ default as UserCredentialsSection \} from "\.\/UserCredentialsSection\.jsx";/);
  assert.match(indexSource, /export \{ default as UserPersonalSection \} from "\.\/UserPersonalSection\.jsx";/);
  assert.match(indexSource, /export \{ default as UserRoleSection \} from "\.\/UserRoleSection\.jsx";/);
  assert.match(indexSource, /export \{ default as UserExtendedSection \} from "\.\/UserExtendedSection\.jsx";/);
});

test("subcomponents contain respective input groups and sanitizers", () => {
  assert.match(credSource, /username/);
  assert.match(credSource, /email/);
  assert.match(personalSource, /firstName/);
  assert.match(personalSource, /lastName/);
  assert.match(personalSource, /phone/);
  assert.match(roleSource, /dateOfBirth/);
  assert.match(roleSource, /isLifecycleManaged/);
  assert.match(extendedSource, /address/);
  assert.match(extendedSource, /emergencyContact/);
  assert.match(extendedSource, /studentId/);
});
