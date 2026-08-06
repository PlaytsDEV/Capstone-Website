import test from "node:test";
import assert from "node:assert/strict";
import { formatSubmittedAddress } from "./reservationAddressFormat.js";

test("joins present address parts in unitHouseNo, street, barangay, city, province order", () => {
  const address = {
    unitHouseNo: "45B",
    street: "Rizal Ave.",
    barangay: "Poblacion",
    city: "Quezon City",
    province: "Metro Manila",
  };
  assert.equal(
    formatSubmittedAddress(address),
    "45B, Rizal Ave., Poblacion, Quezon City, Metro Manila",
  );
});

test("skips missing/blank parts without leaving stray separators", () => {
  const address = { street: "Rizal Ave.", city: "Quezon City" };
  assert.equal(formatSubmittedAddress(address), "Rizal Ave., Quezon City");
});

test("trims whitespace on each part", () => {
  const address = { unitHouseNo: "  45B  ", city: " Quezon City " };
  assert.equal(formatSubmittedAddress(address), "45B, Quezon City");
});

test("returns an empty string for a missing, null, or non-object address, so the UI can show its placeholder", () => {
  assert.equal(formatSubmittedAddress(undefined), "");
  assert.equal(formatSubmittedAddress(null), "");
  assert.equal(formatSubmittedAddress("123 Main St."), "");
  assert.equal(formatSubmittedAddress({}), "");
});

test("does not mistake whitespace-only parts for present values", () => {
  const address = { unitHouseNo: "   ", street: "Rizal Ave." };
  assert.equal(formatSubmittedAddress(address), "Rizal Ave.");
});
