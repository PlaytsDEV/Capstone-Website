import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tenantRoot = resolve(__dirname, "../..");

const readTenantSource = (relativePath) =>
  fs.readFileSync(resolve(tenantRoot, relativePath), "utf8");

test("PersonalDetailsTab supports isProfileLocked and edit mode photo upload with save/discard", () => {
  const source = readTenantSource("components/profile/PersonalDetailsTab.jsx");

  // Gating & Props
  assert.match(source, /isProfileLocked\s*=\s*false/, "Component should accept isProfileLocked prop");
  assert.match(source, /isEditingProfile\s*&&/, "Avatar clicks and camera badge should be gated to edit mode");

  // UI elements
  assert.match(source, /Profile Locked/, "Locked status indicator badge should be present");
  assert.match(source, /Edit2 size=\{14\}\s*\/>\s*Edit Profile/, "Edit Profile button with pen icon should be present");
  assert.match(source, /Discard/, "Discard button should be present in edit mode");
  assert.match(source, /Save Changes/, "Save Changes button should be present in edit mode");

  // Dynamic copywriting
  assert.match(source, /help pre-fill your dormitory application form/, "Pre-submission helper copy should be present");
  assert.match(source, /personal identity details are locked following application submission/, "Post-submission helper copy should be present");
});

test("ProfilePage computes isProfileLocked and passes it to PersonalDetailsTab", () => {
  const source = readTenantSource("pages/ProfilePage.jsx");

  assert.match(source, /const isProfileLocked\s*=\s*useMemo/, "ProfilePage should compute isProfileLocked via useMemo");
  assert.match(source, /applicationSubmittedAt/, "isProfileLocked should check applicationSubmittedAt on reservations");
  assert.match(source, /isProfileLocked=\{isProfileLocked\}/, "ProfilePage should pass isProfileLocked prop to PersonalDetailsTab");
});

test("useReservationFlow pre-fills Stage 3 personal and identity fields from saved user profile", () => {
  const source = readTenantSource("hooks/useReservationFlow.js");

  assert.match(source, /profileNameInitializedRef/, "Profile initialization ref guard should exist");
  assert.match(source, /user\?\.middleName/, "Should pre-fill middleName from user profile");
  assert.match(source, /user\?\.dateOfBirth/, "Should pre-fill birthday from user profile dateOfBirth");
  assert.match(source, /user\?\.gender/, "Should pre-fill gender from user profile");
  assert.match(source, /user\?\.civilStatus/, "Should pre-fill maritalStatus from user profile civilStatus");
  assert.match(source, /user\?\.nationality/, "Should pre-fill nationality from user profile");
  assert.match(source, /user\?\.occupation/, "Should pre-fill occupation from user profile");
  assert.match(source, /user\?\.profileImage/, "Should pre-fill selfiePhoto from user profile image");
});

test("PersonalDetailsTab passes locked state to gender and civil status SelectFields and PersonalInfoSection supports both", () => {
  const tabSource = readTenantSource("components/profile/PersonalDetailsTab.jsx");
  assert.match(tabSource, /field="gender"[\s\S]*?\{\.\.\.fp\}/, "Gender field must inherit {...fp} locked state");
  assert.match(tabSource, /field="civilStatus"[\s\S]*?\{\.\.\.fp\}/, "Civil Status field must inherit {...fp} locked state");

  const formSource = readTenantSource("pages/reservation-steps/components/PersonalInfoSection.jsx");
  assert.match(formSource, /id="genderSelect"/, "Application form must have gender select");
  assert.match(formSource, /id="maritalStatusSelect"/, "Application form must have marital status select");
  assert.match(formSource, /value="divorced"/, "Application form must support divorced civil status option");
});

test("PersonalDetailsTab connects Contact Information and Emergency Contact to {...fp} while keeping Email explicitly locked", () => {
  const tabSource = readTenantSource("components/profile/PersonalDetailsTab.jsx");

  // Contact Info
  assert.match(tabSource, /field="phone"[\s\S]*?\{\.\.\.fp\}/, "Phone field must inherit {...fp}");
  assert.match(tabSource, /field="email"[\s\S]*?locked/, "Email field must remain explicitly locked");
  assert.match(tabSource, /field="address"[\s\S]*?\{\.\.\.fp\}/, "Address field must inherit {...fp}");

  // Emergency Contact
  assert.match(tabSource, /field="emergencyContact"[\s\S]*?\{\.\.\.fp\}/, "Emergency contact person must inherit {...fp}");
  assert.match(tabSource, /field="emergencyRelationship"[\s\S]*?\{\.\.\.fp\}/, "Emergency relationship must inherit {...fp}");
  assert.match(tabSource, /field="emergencyPhone"[\s\S]*?\{\.\.\.fp\}/, "Emergency phone must inherit {...fp}");

  // Relationship options and phone input integration
  assert.match(tabSource, /RELATIONSHIP_OPTIONS/, "Must use RELATIONSHIP_OPTIONS in PersonalDetailsTab");
  assert.match(tabSource, /PhoneInputField|PhoneInput/, "Must integrate phone input in PersonalDetailsTab");
});

