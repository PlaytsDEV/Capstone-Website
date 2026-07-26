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
    expect(html).toContain("@page{size:8.5in 13in;margin:.30in .35in}");
    expect(html).toContain(".contract-page{width:100%;max-width:none;margin:0;padding:0");
  });

  test("normalizes canonical and legacy room types without undefined labels", () => {
    const html = buildContractHtml(fixture({
      template: { roomType: "quadruple_sharing", leaseType: "short-term" },
    }));
    expect(html).toContain("QUADRUPLE SHARING");
    expect(html).not.toContain("undefined");
  });

  test("rejects a three-month lease paired with the long-term template", () => {
    expect(() => buildContractHtml(fixture({
      template: { roomType: "quadruple-sharing", leaseType: "long-term" },
    }))).toThrow(expect.objectContaining({
      code: "CONTRACT_TEMPLATE_DURATION_MISMATCH",
    }));
  });
});
