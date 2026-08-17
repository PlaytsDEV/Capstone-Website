import { describe, it, expect } from "@jest/globals";
import {
  buildDigitalStayProofHtml,
  renderDigitalStayProofPdf,
  mapStayDataToContractPayload,
} from "./digitalStayProofService.js";

describe("digitalStayProofService", () => {
  const sampleData = {
    referenceNumber: "LIL-GUAD-2026-00008",
    tenantName: "Juan Dela Cruz",
    tenantEmail: "juan.delacruz@example.com",
    tenantPhone: "+63 912 345 6789",
    tenantAddress: "Makati City, Metro Manila",
    branchName: "Guadalupe Branch",
    branchAddress: "9431 Magallanes St., Guadalupe Nuevo, Makati City",
    roomNumber: "305",
    bedLabel: "Upper Bed",
    roomType: "Quadruple Sharing",
    leaseStartDate: new Date("2026-06-01"),
    leaseEndDate: new Date("2026-12-09"),
    leaseDurationMonths: 6,
    monthlyRent: 4500,
    securityDeposit: 4500,
    advanceRent: 4500,
    status: "ACTIVE",
    verificationStatus: "VERIFIED ACTIVE STAY",
    verificationUrl: "https://lilycrest.ph/verify-stay/LIL-GUAD-2026-00008",
    qrCodeSvg: "<svg></svg>",
    issuedAt: new Date("2026-08-14"),
  };

  it("builds clean 2-page print-ready HTML with proper verification and rule sections", () => {
    const html = buildDigitalStayProofHtml(sampleData);

    expect(html).toContain("Official Certificate of Stay");
    expect(html).toContain("VERIFIED ACTIVE STAY");
    expect(html).toContain("Juan Dela Cruz");
    expect(html).toContain("LIL-GUAD-2026-00008");
    expect(html).toContain("Guadalupe Branch");
    expect(html).toContain("Room Number:");
    expect(html).toContain("305");
    expect(html).toContain("Upper Bed");
    expect(html).toContain("Dormitory Rules &amp; Residency Agreement");
    expect(html).toContain("1. Monthly Rental &amp; Billing Policy");
    expect(html).toContain("Resident Digital Acknowledgment &amp; Consent");
  });

  it("maps stay data into official contract payload with correct templateId and fields", () => {
    const payload = mapStayDataToContractPayload(sampleData);
    expect(payload.template.templateId).toBe("quadruple-sharing-long-term");
    expect(payload.template.roomType).toBe("quadruple_sharing");
    expect(payload.template.leaseType).toBe("long-term");
    expect(payload.fields.tenantLegalName).toBe("Juan Dela Cruz");
    expect(payload.fields.roomNumber).toBe("305");
    expect(payload.fields.bedOrSlotNumber).toBe("Upper Bed");
    expect(payload.fields.leaseDurationNumber).toBe(6);
  });

  it("escapes special characters to prevent HTML injection", () => {
    const maliciousData = {
      ...sampleData,
      tenantName: "<script>alert(1)</script>",
    };
    const html = buildDigitalStayProofHtml(maliciousData);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("renders an authentic PDF buffer with valid PDF headers and structure", async () => {
    const pdfBuffer = await renderDigitalStayProofPdf(sampleData);
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF Magic Bytes: %PDF-
    const header = pdfBuffer.subarray(0, 5).toString("utf8");
    expect(header).toBe("%PDF-");
  }, 60_000);
});
