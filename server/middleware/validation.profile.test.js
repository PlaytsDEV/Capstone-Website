import { describe, it, expect } from "@jest/globals";
import { validateProfileUpdateInput } from "./validation.js";

describe("validateProfileUpdateInput Middleware", () => {
  it("validates valid profile inputs successfully", () => {
    const result = validateProfileUpdateInput({
      firstName: "VinceGamer",
      lastName: "Guest",
      nationality: "Filipino",
      occupation: "Software Developer",
      gender: "male",
      civilStatus: "single",
      dateOfBirth: "2000-05-15",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data.firstName).toBe("VinceGamer");
    expect(result.data.lastName).toBe("Guest");
    expect(result.data.nationality).toBe("Filipino");
    expect(result.data.occupation).toBe("Software Developer");
    expect(result.data.gender).toBe("male");
    expect(result.data.civilStatus).toBe("single");
  });

  it("rejects invalid first name and last name", () => {
    const emptyFirst = validateProfileUpdateInput({ firstName: "" });
    expect(emptyFirst.valid).toBe(false);
    expect(emptyFirst.errors).toContain("First name cannot be empty");

    const shortFirst = validateProfileUpdateInput({ firstName: "A" });
    expect(shortFirst.valid).toBe(false);

    const invalidSymbols = validateProfileUpdateInput({ firstName: "John123" });
    expect(invalidSymbols.valid).toBe(false);

    const longLast = validateProfileUpdateInput({ lastName: "L".repeat(51) });
    expect(longLast.valid).toBe(false);
  });

  it("enforces nationality constraints", () => {
    const invalidNat = validateProfileUpdateInput({ nationality: "Filipino123" });
    expect(invalidNat.valid).toBe(false);
    expect(invalidNat.errors[0]).toMatch(/letters, spaces, hyphens, and apostrophes/i);

    const longNat = validateProfileUpdateInput({ nationality: "F".repeat(51) });
    expect(longNat.valid).toBe(false);
    expect(longNat.errors[0]).toMatch(/50 characters or less/i);
  });

  it("enforces occupation constraints", () => {
    const longOcc = validateProfileUpdateInput({ occupation: "Developer ".repeat(8) });
    expect(longOcc.valid).toBe(false);
    expect(longOcc.errors[0]).toMatch(/60 characters or less/i);
  });

  it("enforces date of birth constraints (minimum 18 years old, max 100 years)", () => {
    const currentYear = new Date().getFullYear();

    const futureDate = validateProfileUpdateInput({ dateOfBirth: `${currentYear + 2}-01-01` });
    expect(futureDate.valid).toBe(false);
    expect(futureDate.errors[0]).toMatch(/cannot be in the future/i);

    const under18 = validateProfileUpdateInput({ dateOfBirth: `${currentYear - 10}-01-01` });
    expect(under18.valid).toBe(false);
    expect(under18.errors[0]).toMatch(/at least 18 years old/i);

    const over100 = validateProfileUpdateInput({ dateOfBirth: `${currentYear - 110}-01-01` });
    expect(over100.valid).toBe(false);
    expect(over100.errors[0]).toMatch(/within the last 100 years/i);

    const validDob = validateProfileUpdateInput({ dateOfBirth: `${currentYear - 22}-01-01` });
    expect(validDob.valid).toBe(true);
    expect(validDob.errors).toHaveLength(0);
  });

  it("enforces gender and civilStatus enums", () => {
    const invalidGender = validateProfileUpdateInput({ gender: "invalid" });
    expect(invalidGender.valid).toBe(false);

    const invalidCivil = validateProfileUpdateInput({ civilStatus: "unknown" });
    expect(invalidCivil.valid).toBe(false);
  });
});
