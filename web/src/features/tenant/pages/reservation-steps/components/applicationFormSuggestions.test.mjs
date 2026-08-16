import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tenantRoot = resolve(__dirname, "../../..");

const readTenantSource = (relativePath) =>
  readFileSync(resolve(tenantRoot, relativePath), "utf8");

test("PhotoEmailSection provides unlocked editable email with account suggestion chip and autocomplete", () => {
  const source = readTenantSource("pages/reservation-steps/components/PhotoEmailSection.jsx");

  // Verify email input is NOT disabled
  assert.ok(!source.includes('disabled'), "Email input in PhotoEmailSection should not be disabled");
  assert.match(source, /autoComplete="email"/, "Email input should have autoComplete='email'");
  assert.match(source, /inputMode="email"/, "Email input should have inputMode='email'");
  assert.match(source, /setBillingEmail/, "Email input should connect to setBillingEmail");
  assert.match(source, /rf-suggestion-chip/, "Suggestion chip should be rendered for account email");
  assert.match(source, /accountEmail/, "Component should accept and use accountEmail");
});

test("PersonalInfoSection provides autocomplete attributes, suggestion chips, and character counters", () => {
  const source = readTenantSource("pages/reservation-steps/components/PersonalInfoSection.jsx");

  assert.match(source, /autoComplete="family-name"/, "Last Name should have family-name autocomplete");
  assert.match(source, /autoComplete="given-name"/, "First Name should have given-name autocomplete");
  assert.match(source, /autoComplete="additional-name"/, "Middle Name should have additional-name autocomplete");
  assert.match(source, /autoComplete="nickname"/, "Nickname should have nickname autocomplete");
  assert.match(source, /autoComplete="tel"/, "Mobile number should have tel autocomplete");
  assert.match(source, /rf-suggestion-chip/, "NameField should support suggestion chips");
  assert.match(source, /rf-char-counter/, "Personal notes and NBI reason should have character counters");
});

test("EmploymentSection provides occupation datalist, suggestion chips, and autocomplete attributes", () => {
  const source = readTenantSource("pages/reservation-steps/components/EmploymentSection.jsx");

  assert.match(source, /<datalist id="occupation-suggestions"/, "Occupation datalist should exist");
  assert.match(source, /list="occupation-suggestions"/, "Occupation input should connect to datalist");
  assert.match(source, /autoComplete="organization"/, "Employer school input should have organization autocomplete");
  assert.match(source, /autoComplete="street-address"/, "Employer address input should have street-address autocomplete");
  assert.match(source, /autoComplete="tel"/, "Employer contact input should have tel autocomplete");
  assert.match(source, /rf-suggestion-chip/, "Quick occupation suggestion chips should be provided");
  assert.match(source, /rf-char-counter/, "Employment inputs should have character counters");
});

test("EmergencyContactSection provides autocomplete attributes and N/A quick chip", () => {
  const source = readTenantSource("pages/reservation-steps/components/EmergencyContactSection.jsx");

  assert.match(source, /autoComplete="name"/, "Emergency contact name should have name autocomplete");
  assert.match(source, /autoComplete="tel"/, "Emergency contact phone should have tel autocomplete");
  assert.match(source, /rf-suggestion-chip/, "Health concerns should have a quick N/A suggestion chip");
  assert.match(source, /rf-char-counter/, "Health concerns should have character counter");
});

test("AddressCascadeFields provides autocomplete attributes on unit and street inputs", () => {
  const source = readTenantSource("pages/reservation-steps/components/AddressCascadeFields.jsx");

  assert.match(source, /autoComplete="address-line2"/, "Unit/House No should have address-line2 autocomplete");
  assert.match(source, /autoComplete="address-line1"/, "Street should have address-line1 autocomplete");
});

test("useReservationFlow guards profile name initialization and manages billingEmail across lifecycle", () => {
  const source = readTenantSource("hooks/useReservationFlow.js");

  assert.match(source, /profileNameInitializedRef/, "Profile name initialization should be guarded by ref");
  assert.match(source, /billingEmail,/, "billingEmail should be in buildDraftPayload and applicationPayload");
  assert.match(source, /key:\s*"billingEmail"/, "billingEmail should be validated upon submission");
  assert.match(source, /userAccountEmail/, "userAccountEmail should be exported from useReservationFlow");
});

test("ReservationApplicationStep calculates section completion and renders badges", () => {
  const source = readTenantSource("pages/reservation-steps/ReservationApplicationStep.jsx");

  assert.match(source, /sectionCompletionMap/, "Section completion map should be computed");
  assert.match(source, /rf-section-badge--done/, "Completed sections should show completion badges");
  assert.match(source, /setBillingEmail/, "setBillingEmail should be passed to PhotoEmailSection");
});
