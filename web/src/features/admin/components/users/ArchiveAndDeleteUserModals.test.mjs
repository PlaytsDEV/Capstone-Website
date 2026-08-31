import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const archiveModalSource = fs.readFileSync(
  new URL("./ArchiveUserModal.jsx", import.meta.url),
  "utf8"
);
const hardDeleteModalSource = fs.readFileSync(
  new URL("./HardDeleteUserModal.jsx", import.meta.url),
  "utf8"
);
const userPageSource = fs.readFileSync(
  new URL("../../pages/UserManagementPage.jsx", import.meta.url),
  "utf8"
);

test("ArchiveUserModal is completely decoupled from permanent/hard delete", () => {
  // Must NOT contain hardDelete state or checkbox
  assert.doesNotMatch(
    archiveModalSource,
    /setHardDelete/,
    "ArchiveUserModal must not have setHardDelete state"
  );
  assert.doesNotMatch(
    archiveModalSource,
    /Permanently delete instead/,
    "ArchiveUserModal must not contain hard delete checkbox"
  );
  assert.doesNotMatch(
    archiveModalSource,
    /variant=\{hardDelete \? "danger" : "warning"\}/,
    "ArchiveUserModal should not dynamically switch to danger"
  );

  // Must strictly use warning variant and pure archive confirm text
  assert.match(
    archiveModalSource,
    /variant="warning"/,
    "ArchiveUserModal must use warning variant"
  );
  assert.match(
    archiveModalSource,
    /confirmText="Archive User"/,
    "ArchiveUserModal confirm button must say 'Archive User'"
  );

  // Must clearly explain reversibility and data retention
  assert.match(
    archiveModalSource,
    /financial and reservation records stay intact/i,
    "ArchiveUserModal must explain records stay intact"
  );
  assert.match(
    archiveModalSource,
    /Archived accounts can be restored later/i,
    "ArchiveUserModal must explain account can be restored"
  );
});

test("HardDeleteUserModal enforces danger variant and typed DELETE confirmation", () => {
  assert.match(
    hardDeleteModalSource,
    /title="Permanently Delete User"/,
    "HardDeleteUserModal title must be 'Permanently Delete User'"
  );
  assert.match(
    hardDeleteModalSource,
    /variant="danger"/,
    "HardDeleteUserModal must use danger variant"
  );
  assert.match(
    hardDeleteModalSource,
    /confirmationText !== "DELETE"/,
    "HardDeleteUserModal must check for confirmationText !== 'DELETE'"
  );
  assert.match(
    hardDeleteModalSource,
    /placeholder="DELETE"/,
    "HardDeleteUserModal must have DELETE placeholder"
  );
  assert.match(
    hardDeleteModalSource,
    /Historical records will display/,
    "HardDeleteUserModal must inform about historical record label"
  );
});

test("UserManagementPage clearly differentiates Archive and Permanently Delete menu actions", () => {
  // Archive action must use Archive icon, not Trash2
  assert.match(
    userPageSource,
    /<Archive[^>]*\/>\s*Archive Account/s,
    "UserManagementPage Archive action must use Archive icon"
  );

  // Permanently Delete action must be labeled Permanently Delete and use Trash2 icon
  assert.match(
    userPageSource,
    /<Trash2[^>]*\/>\s*Permanently Delete/s,
    "UserManagementPage Delete action must use Trash2 icon with 'Permanently Delete' label"
  );

  // canArchiveAccount permission naming should be clean
  assert.match(
    userPageSource,
    /canArchiveAccount/,
    "UserManagementPage should define canArchiveAccount"
  );
});
