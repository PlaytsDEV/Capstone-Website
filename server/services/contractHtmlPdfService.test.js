import { describe, expect, test } from "@jest/globals";
import { buildContractHtml } from "./contractHtmlPdfService.js";

const fixture = (overrides = {}) => ({
  template: {
    roomType: "quadruple-sharing",
    leaseType: "short-term",
    ...overrides.template,
  },
  property: {
    propertyName: "LILYCREST GIL PUYAT",
    propertyAddress: "#7 Gil Puyat Ave., Makati City",
  },
  fields: {
    leaseDurationNumber: 3,
    leaseDurationWords: "Three",
    tenantLegalName: "ALEXANDRA SAMPLE TENANT",
    tenantResidentialAddress: "Makati City",
    contractExecutionDay: "27th",
    contractExecutionMonth: "July",
    contractExecutionYear: "2026",
    roomNumber: "TEST-305",
    bedOrSlotNumber: "Upper",
    leaseStartDate: "May 26, 2026",
    leaseEndDate: "August 26, 2026",
    regularMonthlyRate: "7,000.00",
    discountPercentage: "10",
    approvedMonthlyRate: "6,300.00",
    advanceRentAmount: "6,300.00",
    advanceCoverageStart: "May 26, 2026",
    advanceCoverageEnd: "June 26, 2026",
    securityDepositAmount: "6,300.00",
    ...overrides.fields,
  },
});

describe("flow-based Contract HTML", () => {
  test("uses exact long-bond margins and the full printable width", () => {
    const html = buildContractHtml(fixture());
    expect(html).toContain("@page{size:8.5in 13in;margin:.25in .35in}");
    expect(html).toContain(".contract-page{width:100%;max-width:none;margin:0;padding:0");
  });

  test("normalizes canonical and legacy room types without undefined labels", () => {
    const html = buildContractHtml(fixture({
      template: { roomType: "quadruple_sharing", leaseType: "short-term" },
    }));
    expect(html).toContain("QUADRUPLE SHARING");
    expect(html).not.toContain("undefined");
  });

  test("renders private room amenities with private toilet & bath and kitchenette", () => {
    const html = buildContractHtml(fixture({
      template: { roomType: "private", leaseType: "short-term" },
      fields: { leaseDurationNumber: 3, leaseDurationWords: "Three" },
    }));
    expect(html).toContain("PRIVATE ROOM — SHORT TERM LEASE");
    expect(html).toContain("lease of the private room shall run for a period");
    expect(html).toContain("room’s own private toilet and bath and kitchenette");
  });

  test("renders sharing room amenities with common floor facilities", () => {
    const html = buildContractHtml(fixture({
      template: { roomType: "double-sharing", leaseType: "long-term" },
      fields: { leaseDurationNumber: 6, leaseDurationWords: "Six" },
    }));
    expect(html).toContain("DOUBLE SHARING — LONG TERM LEASE");
    expect(html).toContain("lease of the bed space shall run for a period");
    expect(html).toContain("common facilities provided on the same floor of the unit");
    expect(html).toContain("not less than six (6) months");
  });

  test("rejects a three-month lease paired with the long-term template", () => {
    expect(() => buildContractHtml(fixture({
      template: { roomType: "quadruple-sharing", leaseType: "long-term" },
    }))).toThrow(expect.objectContaining({
      code: "CONTRACT_TEMPLATE_DURATION_MISMATCH",
    }));
  });

  test("a long but realistic name (multiple middle names, hyphenated surname) renders normally", () => {
    const html = buildContractHtml(fixture({
      fields: { tenantLegalName: "MARIA FERNANDA ESPERANZA CASTELLANOS-VILLAREAL" },
    }));
    expect(html).toContain("MARIA FERNANDA ESPERANZA CASTELLANOS-VILLAREAL");
  });

  test("supported accented characters are preserved, not stripped or replaced", () => {
    const html = buildContractHtml(fixture({
      fields: { tenantLegalName: "JOSÉ MARÍA NIÑO PEÑA" },
    }));
    expect(html).toContain("JOSÉ MARÍA NIÑO PEÑA");
  });

  test("missing tenant legal name is rejected with a controlled error, not rendered blank", () => {
    expect(() => buildContractHtml(fixture({ fields: { tenantLegalName: "" } })))
      .toThrow(expect.objectContaining({ code: "CONTRACT_REQUIRED_FIELD_MISSING", statusCode: 422 }));
  });

  test("missing tenant address is rejected with a controlled error, not rendered blank", () => {
    expect(() => buildContractHtml(fixture({ fields: { tenantResidentialAddress: "" } })))
      .toThrow(expect.objectContaining({ code: "CONTRACT_REQUIRED_FIELD_MISSING", statusCode: 422 }));
  });

  test("an extremely long unbroken name token is rejected with a controlled error instead of rendering a malformed page", () => {
    expect(() => buildContractHtml(fixture({ fields: { tenantLegalName: "A".repeat(400) } })))
      .toThrow(expect.objectContaining({ code: "TENANT_NAME_TOO_LONG_FOR_TEMPLATE", statusCode: 422 }));
  });

  test("an extremely long unbroken address token is rejected with a controlled error instead of rendering a malformed page", () => {
    expect(() => buildContractHtml(fixture({ fields: { tenantResidentialAddress: "B".repeat(400) } })))
      .toThrow(expect.objectContaining({ code: "TENANT_ADDRESS_TOO_LONG_FOR_TEMPLATE", statusCode: 422 }));
  });

  test("a normal multi-word name/address of any total length is not blocked by the oversized-token guard", () => {
    const html = buildContractHtml(fixture({
      fields: {
        tenantLegalName: "JUAN CARLOS MIGUEL ANTONIO DELA CRUZ SANTOS JR.",
        tenantResidentialAddress:
          "Unit 45B, Sunrise Residences Tower 2, 789 Extended Boulevard Avenue, Barangay San Isidro, City of Makati",
      },
    }));
    expect(html).toContain("JUAN CARLOS MIGUEL ANTONIO DELA CRUZ SANTOS JR.");
  });
});
