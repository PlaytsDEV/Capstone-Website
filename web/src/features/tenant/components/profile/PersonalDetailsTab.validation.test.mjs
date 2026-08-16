import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validateField,
  parseDateParts,
  getDaysInMonth,
  composeDate,
  buildYearOptions,
  toTitleCase,
} from "./personalDetailsValidation.js";

const source = fs.readFileSync(new URL("./PersonalDetailsTab.jsx", import.meta.url), "utf8");

test("toTitleCase formats names and words correctly", () => {
  assert.equal(toTitleCase("vince gamer"), "Vince Gamer");
  assert.equal(toTitleCase("JOHN DOE"), "John Doe");
  assert.equal(toTitleCase("filipino-chinese"), "Filipino Chinese");
});

test("validateField enforces first name and last name constraints", () => {
  // Required
  assert.equal(validateField("firstName", ""), "First name is required");
  assert.equal(validateField("lastName", "   "), "Last name is required");

  // Min length
  assert.equal(validateField("firstName", "A"), "At least 2 characters required");
  assert.equal(validateField("lastName", "B"), "At least 2 characters required");

  // Max length (50 chars)
  const longName = "A".repeat(51);
  assert.equal(validateField("firstName", longName), "50 characters maximum");
  assert.equal(validateField("lastName", longName), "50 characters maximum");

  // Format (letters, hyphens, apostrophes only)
  assert.equal(validateField("firstName", "John123"), "Letters, hyphens, and apostrophes only");
  assert.equal(validateField("lastName", "Smith@Home"), "Letters, hyphens, and apostrophes only");

  // Valid
  assert.equal(validateField("firstName", "John"), null);
  assert.equal(validateField("firstName", "Mary-Jane"), null);
  assert.equal(validateField("lastName", "O'Connor"), null);
  assert.equal(validateField("lastName", "Dela Cruz"), null);
});

test("validateField enforces nationality constraints", () => {
  // Empty is allowed (optional)
  assert.equal(validateField("nationality", ""), null);
  assert.equal(validateField("nationality", null), null);

  // Max length (50 chars)
  const longNat = "F".repeat(51);
  assert.equal(validateField("nationality", longNat), "50 characters maximum");

  // Invalid characters
  assert.equal(validateField("nationality", "Filipino123"), "Letters, hyphens, and apostrophes only");
  assert.equal(validateField("nationality", "PH#1"), "Letters, hyphens, and apostrophes only");

  // Valid
  assert.equal(validateField("nationality", "Filipino"), null);
  assert.equal(validateField("nationality", "Filipino-American"), null);
});

test("validateField enforces occupation constraints", () => {
  // Empty is allowed (optional)
  assert.equal(validateField("occupation", ""), null);
  assert.equal(validateField("occupation", null), null);

  // Max length (60 chars)
  const longOcc = "Engineer ".repeat(8);
  assert.equal(validateField("occupation", longOcc), "60 characters maximum");

  // Invalid characters
  assert.equal(validateField("occupation", "<script>alert(1)</script>"), "Invalid characters in occupation");

  // Valid
  assert.equal(validateField("occupation", "Software Engineer"), null);
  assert.equal(validateField("occupation", "Nurse / Health Worker"), null);
  assert.equal(validateField("occupation", "Sales & Marketing Lead"), null);
});

test("validateField enforces date of birth constraints (minimum 18 years old)", () => {
  const currentYear = new Date().getFullYear();

  // Incomplete / Invalid
  assert.equal(validateField("dateOfBirth", "2000-01"), "Complete date required (Month, Day, Year)");
  assert.equal(validateField("dateOfBirth", "invalid-date-string"), "Complete date required (Month, Day, Year)");

  // Future date
  const futureYear = currentYear + 1;
  assert.equal(validateField("dateOfBirth", `${futureYear}-01-01`), "Birth date cannot be in the future");

  // Under 18 years old (e.g. born 5 years ago)
  const minorYear = currentYear - 5;
  assert.equal(validateField("dateOfBirth", `${minorYear}-05-15`), "Must be at least 18 years old");

  // Over 100 years old
  const ancientYear = currentYear - 105;
  assert.equal(validateField("dateOfBirth", `${ancientYear}-01-01`), "Birth date must be within the last 100 years");

  // Exactly or over 18 years old
  const adultYear = currentYear - 20;
  assert.equal(validateField("dateOfBirth", `${adultYear}-01-15`), null);
});

test("validateField validates gender and civil status enums", () => {
  assert.equal(validateField("gender", "male"), null);
  assert.equal(validateField("gender", "female"), null);
  assert.equal(validateField("gender", "invalid_gender"), "Invalid gender option selected");

  assert.equal(validateField("civilStatus", "single"), null);
  assert.equal(validateField("civilStatus", "married"), null);
  assert.equal(validateField("civilStatus", "invalid_status"), "Invalid civil status option selected");
});

test("parseDateParts, getDaysInMonth, and composeDate operate correctly", () => {
  // Parsing ISO and standard strings
  assert.deepEqual(parseDateParts("1998-10-15"), { year: "1998", month: "10", day: "15" });
  assert.deepEqual(parseDateParts("1998-10-15T00:00:00.000Z"), { year: "1998", month: "10", day: "15" });
  assert.deepEqual(parseDateParts(""), { year: "", month: "", day: "" });

  // Dynamic days per month
  assert.equal(getDaysInMonth("2024", "02"), 29); // Leap year
  assert.equal(getDaysInMonth("2023", "02"), 28); // Non-leap year
  assert.equal(getDaysInMonth("2024", "04"), 30); // April
  assert.equal(getDaysInMonth("2024", "01"), 31); // January

  // Compose
  assert.equal(composeDate({ year: "1995", month: "3", day: "7" }), "1995-03-07");

  // Year options for 18+
  const years = buildYearOptions(18, 100);
  const currentYear = new Date().getFullYear();
  assert.equal(years[0], String(currentYear - 18));
  assert.equal(years[years.length - 1], String(currentYear - 100));
});

test("PersonalDetailsTab component enforces visual limits, counters, and birthday dropdown selector", () => {
  assert.match(source, /BirthdayField/);
  assert.match(source, /MONTH_OPTIONS/);
  assert.match(source, /maxLength=\{50\}/);
  assert.match(source, /maxLength=\{60\}/);
  assert.match(source, /charCounter/);
  assert.match(source, /Must be at least 18 years old/);
});
