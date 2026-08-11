import {
  buildTenantProfileSyncUpdates,
  resolveTenantFinancialSummary,
  resolveTenantPersonalDetails,
} from "./tenantProfileService.js";

describe("tenantProfileService", () => {
  const reservation = {
    firstName: "Ana",
    middleName: "Marie",
    lastName: "Cruz",
    mobileNumber: "09171234567",
    birthday: new Date("2000-01-15"),
    maritalStatus: "single",
    nationality: "Filipino",
    address: {
      unitHouseNo: "12",
      street: "Rizal Street",
      barangay: "Poblacion",
      city: "Makati",
      province: "Metro Manila",
    },
    emergencyContact: {
      name: "Maria Cruz",
      relationship: "Mother",
      contactNumber: "09181234567",
    },
    employment: { occupation: "Student" },
    monthlyRent: 6500,
    totalPrice: 7000,
    reservationFeeAmount: 2000,
    paymentStatus: "paid",
  };

  test("returns application emergency details when User fields are empty", () => {
    const details = resolveTenantPersonalDetails({
      user: { firstName: "Ana", lastName: "Cruz", email: "ana@example.com" },
      reservation,
    });

    expect(details.fullName).toBe("Ana Marie Cruz");
    expect(details.emergencyContact).toEqual({
      name: "Maria Cruz",
      relationship: "Mother",
      phone: "09181234567",
      address: null,
    });
    expect(details.currentAddress).toContain("Rizal Street");
  });

  test("populated User fields win over older application values", () => {
    const details = resolveTenantPersonalDetails({
      user: {
        phone: "09999999999",
        emergencyContact: "Current Contact",
        emergencyPhone: "09888888888",
      },
      reservation,
    });

    expect(details.phone).toBe("09999999999");
    expect(details.emergencyContact.name).toBe("Current Contact");
    expect(details.emergencyContact.phone).toBe("09888888888");
  });

  test("sync updates fill blanks without overwriting populated User data", () => {
    const updates = buildTenantProfileSyncUpdates({
      user: {
        firstName: "Verified Ana",
        lastName: "Cruz",
        phone: "",
        emergencyContact: "",
      },
      reservation,
    });

    expect(updates.firstName).toBeUndefined();
    expect(updates.phone).toBe("09171234567");
    expect(updates.emergencyContact).toBe("Maria Cruz");
    expect(updates.emergencyPhone).toBe("09181234567");
  });

  test("missing emergency data resolves to null without throwing", () => {
    const details = resolveTenantPersonalDetails({
      user: {},
      reservation: {},
    });
    expect(details.emergencyContact.name).toBeNull();
    expect(details.emergencyContact.phone).toBeNull();
  });

  test("does not pollute user profileImage with reservation.selfiePhotoUrl", () => {
    const details = resolveTenantPersonalDetails({
      user: { profileImage: null },
      reservation: { selfiePhotoUrl: "https://example.com/selfie.jpg" },
    });
    expect(details.profileImage).toBeNull();

    const populatedUser = resolveTenantPersonalDetails({
      user: { profileImage: "https://example.com/user-avatar.jpg" },
      reservation: { selfiePhotoUrl: "https://example.com/selfie.jpg" },
    });
    expect(populatedUser.profileImage).toBe("https://example.com/user-avatar.jpg");
  });

  test("financial summary uses approved reservation rate and separates charges", () => {
    const summary = resolveTenantFinancialSummary({
      reservation,
      currentBalance: 500,
    });

    expect(summary.monthlyRate).toBe(6500);
    expect(summary.advanceRent).toBe(6500);
    expect(summary.securityDeposit).toBe(6500);
    expect(summary.reservationFee).toBe(2000);
    expect(summary.currentBalance).toBe(500);
  });
});
