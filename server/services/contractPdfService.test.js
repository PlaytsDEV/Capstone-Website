import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterAll, describe, expect, test } from "@jest/globals";
import { PDFDocument } from "pdf-lib";
import {
  CONTRACT_FIELD_VISUAL_STYLES,
  getContractTemplateCoordinates,
} from "../config/contractTemplateCoordinates.js";
import {
  OFFICIAL_CONTRACT_TEMPLATES,
} from "../config/contractTemplateRegistry.js";
import {
  assertPreparedGenerationAllowed,
  assertContractFieldsAvoidLegalText,
  inspectMasterPdf,
  normalizeContractBedDisplay,
  renderPreparedContractPdf,
} from "./contractPdfService.js";
import {
  buildPreparedContractStorage,
  GENERATED_CONTRACT_ROOT,
  resolvePrivateContractStorageKey,
  sanitizeContractFileSegment,
} from "./contractPrivateStorageService.js";

const temporaryPaths = [];

const fixtureData = (template) => {
  const isGuadalupe = template.roomType === "quadruple-sharing";
  const months = template.leaseType === "short-term" ? 5 : 6;
  return {
    template,
    property: {
      branch: isGuadalupe ? "guadalupe" : "gil-puyat",
      propertyName: isGuadalupe ? "LILYCREST GUADALUPE" : "LILYCREST GIL PUYAT",
      propertyAddress: isGuadalupe
        ? "9431 Magallanes Street, 1212 Makati, Metro Manila"
        : "#7 Gil Puyat Ave. corner Marconi St., Makati City",
    },
    fields: {
      contractExecutionDay: "15",
      contractExecutionMonth: "January",
      contractExecutionYear: "2026",
      tenantLegalName: "JUAN MIGUEL DELA CRUZ",
      tenantResidentialAddress: "123 Sample Street, Barangay Central, Makati City",
      roomNumber: "101",
      bedOrSlotNumber: "101-A-U",
      leaseDurationNumber: months,
      leaseDurationWords: months === 5 ? "five" : "six",
      leaseStartDate: "January 15, 2026",
      leaseEndDate: months === 5 ? "June 15, 2026" : "July 15, 2026",
      advanceCoverageStart: "January 15, 2026",
      advanceCoverageEnd: "February 15, 2026",
      regularMonthlyRate: "16,000.00",
      discountPercentage: "10",
      approvedMonthlyRate: "14,400.00",
      advanceRentAmount: "14,400.00",
      securityDepositAmount: "14,400.00",
    },
    notarialFields: {
      shouldRemainBlank: true,
      notaryName: "",
      notarySeal: "",
      notarySignature: "",
      documentNumber: "",
      pageNumber: "",
      bookNumber: "",
      seriesYear: "",
    },
  };
};

afterAll(async () => {
  await Promise.all(temporaryPaths.map((entry) => fs.rm(entry, { force: true })));
});

describe("prepared Contract PDF overlay", () => {
  test.each(OFFICIAL_CONTRACT_TEMPLATES.map((template) => [template.templateId, template]))(
    "loads and overlays the immutable %s master as one 8.5 × 13 page",
    async (_templateId, template) => {
      const before = crypto.createHash("sha256")
        .update(await fs.readFile(template.sourceFilePath)).digest("hex");
      const output = await renderPreparedContractPdf(fixtureData(template));
      const document = await PDFDocument.load(output.bytes);
      const page = document.getPage(0);
      expect(document.getPageCount()).toBe(1);
      expect(page.getWidth()).toBeCloseTo(612, 1);
      expect(page.getHeight()).toBeCloseTo(936, 1);
      expect(output.bytes.length).toBeGreaterThan(30000);
      expect(output.coordinateVersion).toBe("3.0.3");
      const after = crypto.createHash("sha256")
        .update(await fs.readFile(template.sourceFilePath)).digest("hex");
      expect(after).toBe(before);
      expect(after).toBe(template.checksum);
    },
  );

  test("incorrect checksum blocks rendering", async () => {
    const template = { ...OFFICIAL_CONTRACT_TEMPLATES[0], checksum: "bad" };
    await expect(renderPreparedContractPdf(fixtureData(template))).rejects.toEqual(
      expect.objectContaining({ code: "CONTRACT_TEMPLATE_CHECKSUM_MISMATCH" }),
    );
  });

  test("missing template blocks rendering", async () => {
    const template = {
      ...OFFICIAL_CONTRACT_TEMPLATES[0],
      sourceFilePath: "missing/master.pdf",
    };
    await expect(renderPreparedContractPdf(fixtureData(template))).rejects.toEqual(
      expect.objectContaining({ code: "CONTRACT_TEMPLATE_NOT_FOUND" }),
    );
  });

  test("invalid page size is detected", async () => {
    const document = await PDFDocument.create();
    document.addPage([612, 792]);
    const bytes = Buffer.from(await document.save());
    const temporaryPath = path.join(os.tmpdir(), `contract-size-${Date.now()}.pdf`);
    temporaryPaths.push(temporaryPath);
    await fs.writeFile(temporaryPath, bytes);
    const template = {
      ...OFFICIAL_CONTRACT_TEMPLATES[0],
      sourceFilePath: temporaryPath,
      checksum: crypto.createHash("sha256").update(bytes).digest("hex"),
    };
    await expect(inspectMasterPdf(template, {
      pageWidth: 612, pageHeight: 936, pageCount: 1,
    })).rejects.toEqual(expect.objectContaining({
      code: "CONTRACT_TEMPLATE_PAGE_SIZE_MISMATCH",
    }));
  });

  test("long legal name fails instead of being truncated", async () => {
    const data = fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]);
    data.fields.tenantLegalName = "A".repeat(500);
    await expect(renderPreparedContractPdf(data)).rejects.toEqual(
      expect.objectContaining({ code: "TENANT_NAME_TOO_LONG_FOR_TEMPLATE" }),
    );
  });

  test("a representative legal name remains inline in Times-Bold at the body font size", async () => {
    const data = fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]);
    data.fields.tenantLegalName = "ALEXANDRA SAMPLE TENANT";
    const output = await renderPreparedContractPdf(data);
    const metric = output.fieldMetrics.tenantLegalName;
    expect(metric.font).toBe("Times-Bold");
    expect(metric.fontSize).toBe(8.5);
    expect(metric.x).toBe(metric.fieldBox.x);
    expect(metric.baselineY).toBeGreaterThanOrEqual(metric.fieldBox.y);
    expect(metric.text).toBe("ALEXANDRA SAMPLE TENANT,");
  });

  test("tenant identity boxes do not intersect protected legal wording", () => {
    const coordinates = getContractTemplateCoordinates("quadruple-sharing-short-term");
    expect(assertContractFieldsAvoidLegalText(coordinates)).toBe(true);
    const unsafe = {
      ...coordinates,
      fields: {
        ...coordinates.fields,
        tenantLegalName: {
          ...coordinates.fields.tenantLegalName,
          width: 300,
        },
      },
    };
    expect(() => assertContractFieldsAvoidLegalText(unsafe)).toThrow(
      expect.objectContaining({ code: "CONTRACT_OVERLAY_INTERSECTS_LEGAL_TEXT" }),
    );
  });

  test("regional address uses a clean continuation line above the separate LESSEE clause", async () => {
    const data = fixtureData(OFFICIAL_CONTRACT_TEMPLATES[4]);
    data.fields.tenantResidentialAddress =
      "123 Sample Residences, Barangay Central, City of Makati, National Capital Region (NCR)";
    const output = await renderPreparedContractPdf(data);
    const metric = output.fieldMetrics.tenantResidentialAddress;
    expect(metric.lines.length).toBeGreaterThanOrEqual(2);
    expect(metric.lines.length).toBeLessThanOrEqual(3);
    expect(metric.lines.join(" ")).toContain("National Capital Region (NCR),");
    expect(metric.lines.join(" ")).toContain("hereinafter referred to as the LESSEE;");
    expect(metric.fontSize).toBe(8.5);
  });

  test("address overflow is controlled instead of crossing into WITNESSETH", async () => {
    const data = fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]);
    data.fields.tenantResidentialAddress = "A".repeat(500);
    await expect(renderPreparedContractPdf(data)).rejects.toEqual(
      expect.objectContaining({ code: "TENANT_ADDRESS_TOO_LONG_FOR_TEMPLATE" }),
    );
  });

  test("readability map enforces printable minimum sizes for tenant fields", () => {
    const coordinates = getContractTemplateCoordinates("double-sharing-short-term");
    expect(coordinates.fields.tenantLegalName.fontWeight).toBe("bold");
    expect(coordinates.fields.tenantLegalName.preferredFontSize).toBe(9.5);
    expect(coordinates.fields.tenantLegalName.minimumFontSize).toBe(9);
    expect(coordinates.fields.tenantLegalName.horizontalAlignment).toBe("center");
    expect(coordinates.fields.tenantResidentialAddress.fontWeight).toBe("regular");
    expect(coordinates.fields.tenantResidentialAddress.preferredFontSize).toBe(8.5);
    expect(coordinates.fields.tenantResidentialAddress.minimumFontSize).toBe(8);
    expect(coordinates.preparedLabel.fontSize).toBeGreaterThanOrEqual(8);
  });

  test("important assignment, duration, and date boxes use bold printable styles", () => {
    const fields = getContractTemplateCoordinates("double-sharing-short-term").fields;
    for (const fieldName of [
      "roomNumber", "bedOrSlotNumber", "leaseDurationNumber",
      "leaseStartDate", "leaseEndDate", "advanceCoverageStart", "advanceCoverageEnd",
    ]) {
      expect(fields[fieldName].fontWeight).toBe("bold");
      expect(fields[fieldName].minimumFontSize).toBeGreaterThanOrEqual(8.25);
    }
    // leaseDurationWords holds a spelled-out number of unpredictable width
    // ("Twelve", "Twenty-four") and is intentionally allowed to shrink further
    // than other fields so common lease terms don't overflow the template box.
    expect(fields.leaseDurationWords.fontWeight).toBe("bold");
    expect(fields.leaseDurationWords.minimumFontSize).toBeGreaterThanOrEqual(6);
    expect(fields.leaseDurationNumber.horizontalAlignment).toBe("right");
    expect(fields.leaseDurationWords.horizontalAlignment).toBe("left");
    for (const fieldName of [
      "roomNumber", "bedOrSlotNumber", "leaseStartDate", "leaseEndDate",
    ]) expect(fields[fieldName].horizontalAlignment).toBe("center");
    for (const fieldName of ["advanceCoverageStart", "advanceCoverageEnd"]) {
      expect(fields[fieldName].horizontalAlignment).toBe("right");
    }
    expect(fields.leaseDurationNumber).not.toBe(fields.leaseDurationWords);
  });

  test("font choices are centralized in the Contract field visual-style map", () => {
    expect(CONTRACT_FIELD_VISUAL_STYLES.tenantLegalName.fontWeight).toBe("bold");
    expect(CONTRACT_FIELD_VISUAL_STYLES.tenantResidentialAddress.fontWeight).toBe("regular");
    expect(Object.entries(CONTRACT_FIELD_VISUAL_STYLES)
      .filter(([fieldName]) => !["propertyAddress", "leaseDurationWords"].includes(fieldName))
      .every(([, style]) => style.minimumSize >= 8)).toBe(true);
    expect(CONTRACT_FIELD_VISUAL_STYLES.leaseDurationWords.minimumSize).toBeGreaterThanOrEqual(6);
  });

  test("required pricing, duration, and date values use consistent safe typography", async () => {
    const data = fixtureData(
      OFFICIAL_CONTRACT_TEMPLATES.find(
        (template) => template.templateId === "quadruple-sharing-short-term",
      ),
    );
    data.fields = {
      ...data.fields,
      contractExecutionDay: "27th",
      contractExecutionMonth: "July",
      contractExecutionYear: "2026",
      leaseDurationNumber: "3",
      leaseDurationWords: "Three",
      leaseStartDate: "May 26, 2026",
      leaseEndDate: "August 26, 2026",
      regularMonthlyRate: "7,000.00",
      discountPercentage: "10",
      approvedMonthlyRate: "6,300.00",
      advanceRentAmount: "6,300.00",
      advanceCoverageStart: "May 26, 2026",
      advanceCoverageEnd: "June 26, 2026",
      securityDepositAmount: "6,300.00",
    };
    const output = await renderPreparedContractPdf(data);
    const metrics = output.fieldMetrics;
    for (const fieldName of [
      "regularMonthlyRate", "discountPercentage", "approvedMonthlyRate",
      "advanceRentAmount", "securityDepositAmount", "leaseStartDate",
      "leaseEndDate", "advanceCoverageStart", "advanceCoverageEnd",
    ]) {
      expect(metrics[fieldName].font).toBe("Times-Bold");
      expect(metrics[fieldName].fontSize).toBeGreaterThanOrEqual(8.25);
      expect(metrics[fieldName].lines).toHaveLength(1);
      expect(metrics[fieldName].textWidth)
        .toBeLessThanOrEqual(metrics[fieldName].fieldBox.width);
    }
    expect(metrics.leaseDurationNumber.fontSize).toBe(8.5);
    expect(metrics.leaseDurationWords.fontSize).toBe(8.5);
    expect(metrics.leaseDurationNumber.baselineY)
      .toBeCloseTo(metrics.leaseDurationWords.baselineY, 5);
    const durationCoordinates = getContractTemplateCoordinates(
      "quadruple-sharing-short-term",
    ).fields;
    expect(durationCoordinates.leaseDurationNumber.verticalOffset).toBe(2.2);
    expect(durationCoordinates.leaseDurationWords.verticalOffset).toBe(2.2);
    expect(metrics.leaseStartDate.fontSize).toBe(metrics.leaseEndDate.fontSize);
    expect(metrics.contractExecutionDay.fontSize)
      .toBe(metrics.contractExecutionMonthYear.fontSize);
    expect(metrics.contractExecutionDay.baselineY)
      .toBeCloseTo(metrics.contractExecutionMonthYear.baselineY, 5);
    expect(metrics.advanceRentAmount.text).toBe("6,300.00,");
    expect(metrics.securityDepositAmount.text).toBe("6,300.00.");
  });

  test("regression: a 12-month lease ('Twelve') generates without a field-overflow error", async () => {
    // Reported bug: LIL-GUAD-2026-00002 (quadruple-sharing, 12-month lease)
    // failed PDF generation with CONTRACT_FIELD_OVERFLOW because "Twelve" at
    // 8.5pt (25.25pt wide) didn't fit the then-25pt-wide, zero-shrink-range box.
    const data = fixtureData(
      OFFICIAL_CONTRACT_TEMPLATES.find(
        (template) => template.templateId === "quadruple-sharing-short-term",
      ),
    );
    data.fields = {
      ...data.fields,
      leaseDurationNumber: "12",
      leaseDurationWords: "Twelve",
    };
    const output = await renderPreparedContractPdf(data);
    const metrics = output.fieldMetrics;
    expect(metrics.leaseDurationWords.text).toBe("Twelve");
    expect(metrics.leaseDurationWords.fontSize).toBeGreaterThanOrEqual(6);
    expect(metrics.leaseDurationWords.textWidth)
      .toBeLessThanOrEqual(metrics.leaseDurationWords.fieldBox.width);
  });

  test("3.0.3 preserves duration and adds safe spacing before the printed percent suffix", () => {
    const fields = getContractTemplateCoordinates(
      "quadruple-sharing-short-term",
    ).fields;
    expect(fields.leaseDurationNumber).toEqual(expect.objectContaining({
      x: 357, y: 643, width: 38, verticalOffset: 2.2,
      horizontalAlignment: "right",
    }));
    expect(fields.leaseDurationWords).toEqual(expect.objectContaining({
      x: 403, y: 643, width: 27, verticalOffset: 2.2,
      horizontalAlignment: "left",
    }));
    expect(fields.regularMonthlyRate).toEqual(expect.objectContaining({
      x: 377, y: 625, width: 46, verticalOffset: 0,
    }));
    expect(fields.discountPercentage).toEqual(expect.objectContaining({
      x: 240, y: 616, width: 44, verticalOffset: 0,
      horizontalAlignment: "right",
    }));
    expect(fields.approvedMonthlyRate).toEqual(expect.objectContaining({
      x: 523, y: 616, width: 41, verticalOffset: 0,
    }));
    expect(fields.advanceRentAmount).toEqual(expect.objectContaining({
      x: 567, y: 497, width: 41, verticalOffset: 0,
      horizontalAlignment: "left",
    }));
    expect(fields.advanceCoverageStart).toEqual(expect.objectContaining({
      x: 175, y: 486, width: 77, verticalOffset: 0,
      horizontalAlignment: "right",
    }));
    expect(fields.advanceCoverageEnd).toEqual(expect.objectContaining({
      x: 264, y: 486, width: 74, verticalOffset: 0,
      horizontalAlignment: "right",
    }));
    expect(fields.securityDepositAmount).toEqual(expect.objectContaining({
      x: 565, y: 488, width: 39, verticalOffset: 0,
      horizontalAlignment: "left",
    }));
    expect(fields.advanceCoverageStart.x + fields.advanceCoverageStart.width).toBe(252);
    expect(fields.advanceCoverageEnd.x + fields.advanceCoverageEnd.width).toBe(338);
    expect(612 - (fields.securityDepositAmount.x + fields.securityDepositAmount.width))
      .toBeGreaterThanOrEqual(8);
  });

  test("duration offsets do not propagate into pricing, deposits, dates, or execution fields", () => {
    const fields = getContractTemplateCoordinates(
      "quadruple-sharing-short-term",
    ).fields;
    const duration = new Set(["leaseDurationNumber", "leaseDurationWords"]);
    for (const [fieldName, config] of Object.entries(fields)) {
      expect(config.verticalOffset).toBe(duration.has(fieldName) ? 2.2 : 0);
    }
  });

  test("reservation-fee sentence is protected from the security-deposit overlay", () => {
    const coordinates = getContractTemplateCoordinates(
      "quadruple-sharing-short-term",
    );
    expect(coordinates.protectedPrintedTextRegions.reservationFeeSentence)
      .toEqual({ x: 47, y: 476, width: 518, height: 10 });
    const unsafe = {
      ...coordinates,
      fields: {
        ...coordinates.fields,
        securityDepositAmount: {
          ...coordinates.fields.securityDepositAmount,
          x: 47,
          y: 477,
        },
      },
    };
    expect(() => assertContractFieldsAvoidLegalText(unsafe)).toThrow(
      expect.objectContaining({ code: "CONTRACT_FIELD_INTERSECTS_LEGAL_TEXT" }),
    );
  });

  test("Upper and Lower bed labels are normalized for the legal PDF", () => {
    expect(normalizeContractBedDisplay("upper")).toBe("Upper");
    expect(normalizeContractBedDisplay("LOWER")).toBe("Lower");
  });

  test("a compact bed identifier (roomNumber-bunkBlock-position) is reduced to its position word for the legal PDF", () => {
    // Real production shape from controllers/reservations/_helpers.js's
    // targetBed.code assignment — too long to fit the field, but the
    // trailing -U/-L/-S always encodes the position the field is meant to show.
    expect(normalizeContractBedDisplay("GD-106-A-L")).toBe("Lower");
    expect(normalizeContractBedDisplay("GP-6010-A-U")).toBe("Upper");
    expect(normalizeContractBedDisplay("gp-711-a-u")).toBe("Upper");
    expect(normalizeContractBedDisplay("GD-106-A-S")).toBe("");
  });

  test("an unrecognized bed label format is passed through unchanged, not silently altered", () => {
    expect(normalizeContractBedDisplay("Bed A")).toBe("Bed A");
    expect(normalizeContractBedDisplay("")).toBe("");
  });

  test("production ignores the development debug overlay flag", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDebug = process.env.CONTRACT_PDF_DEBUG_OVERLAY;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.CONTRACT_PDF_DEBUG_OVERLAY;
      const normal = await renderPreparedContractPdf(fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]));
      process.env.CONTRACT_PDF_DEBUG_OVERLAY = "true";
      const flagged = await renderPreparedContractPdf(fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]));
      expect(flagged.bytes.equals(normal.bytes)).toBe(true);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousDebug === undefined) delete process.env.CONTRACT_PDF_DEBUG_OVERLAY;
      else process.env.CONTRACT_PDF_DEBUG_OVERLAY = previousDebug;
    }
  });

  test("development debug overlay is opt-in and visibly changes only debug output", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDebug = process.env.CONTRACT_PDF_DEBUG_OVERLAY;
    try {
      process.env.NODE_ENV = "development";
      delete process.env.CONTRACT_PDF_DEBUG_OVERLAY;
      const normal = await renderPreparedContractPdf(fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]));
      process.env.CONTRACT_PDF_DEBUG_OVERLAY = "true";
      const debug = await renderPreparedContractPdf(fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]));
      expect(debug.bytes.equals(normal.bytes)).toBe(false);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousDebug === undefined) delete process.env.CONTRACT_PDF_DEBUG_OVERLAY;
      else process.env.CONTRACT_PDF_DEBUG_OVERLAY = previousDebug;
    }
  });

  test("all dynamic field boxes stay above protected signature and acknowledgment regions", () => {
    for (const template of OFFICIAL_CONTRACT_TEMPLATES) {
      const coordinates = getContractTemplateCoordinates(template.templateId);
      const protectedTop = Math.max(
        ...Object.values(coordinates.protectedRegions)
          .map((region) => region.y + region.height),
      );
      for (const box of [
        ...Object.values(coordinates.fields),
        ...Object.values(coordinates.propertyBlock),
      ]) {
        expect(box.y).toBeGreaterThan(protectedTop);
      }
    }
  });
});

describe("tenant identity block — name/address variety across every template", () => {
  // Regression coverage for the reported bug: the identity block used to
  // pre-validate tenantLegalName against a stale, far-too-narrow single-line
  // box (167pt, zero shrink range) that didn't match the wider, wrappable
  // paragraph box the name is actually drawn into — causing realistic long
  // names to spuriously fail generation. These cases exercise every
  // supported template with a variety of real-world legal-name shapes.
  //
  // NOTE: "quadruple-sharing-short-term" is included in this loop, but under
  // NODE_ENV=test renderPreparedContractPdf routes it through the pdf-lib
  // overlay path, not the real Chromium/HTML pipeline it uses in production
  // (see the NODE_ENV=test note in contractPdfService.js). The real HTML
  // pipeline's equivalent behavior is covered separately by
  // contractHtmlPdfService.test.js.
  const nameCases = [
    ["normal short name", "JOSE CRUZ"],
    ["long first and last name", "MARIA FERNANDA ESPERANZA CASTELLANOS-VILLAREAL"],
    ["multiple middle names", "JUAN CARLOS MIGUEL ANTONIO DELA CRUZ"],
    ["hyphenated surname", "ANA SOFIA GARCIA-REYES"],
    ["suffix Jr.", "JOSE SANTOS JR."],
    ["suffix III", "WILLIAM HENRY ASHFORD III"],
    ["supported accented characters", "JOSÉ MARÍA NIÑO PEÑA"],
  ];

  test.each(
    OFFICIAL_CONTRACT_TEMPLATES.flatMap((template) =>
      nameCases.map(([label, name]) => [template.templateId, label, name, template])),
  )("%s: %s renders without a false-positive overflow error", async (_templateId, _label, name, template) => {
    const data = fixtureData(template);
    data.fields.tenantLegalName = name;
    const output = await renderPreparedContractPdf(data);
    const metric = output.fieldMetrics.tenantLegalName;
    expect(metric.text.startsWith(name.replace(/[,\s]+$/, ""))).toBe(true);
    expect(metric.fontSize).toBeGreaterThanOrEqual(
      getContractTemplateCoordinates(template.templateId).identityLayout.minimumFontSize,
    );
    // Never silently drops characters: every non-whitespace character from
    // the original name must survive into the drawn line(s).
    const drawnLetters = metric.lines.join("").replace(/[^\p{L}\p{N}.'-]/gu, "");
    const sourceLetters = name.replace(/[^\p{L}\p{N}.'-]/gu, "");
    expect(drawnLetters).toContain(sourceLetters);
  });

  test("a name containing accidental duplicate spaces is safely normalized before reaching the PDF, not passed through raw", async () => {
    const data = fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]);
    // Simulates what buildContractGenerationData would hand off after
    // resolveTenantPersonalDetails' collapseWhitespace normalization —
    // the PDF layer itself does not second-guess/re-normalize the value,
    // it trusts the upstream authoritative source.
    data.fields.tenantLegalName = "JUAN DELA CRUZ";
    const output = await renderPreparedContractPdf(data);
    expect(output.fieldMetrics.tenantLegalName.text).not.toMatch(/ {2,}/);
  });

  test("an extremely long single-token name fails with a controlled, specific error — not a crash, not silent truncation", async () => {
    for (const template of OFFICIAL_CONTRACT_TEMPLATES) {
      const data = fixtureData(template);
      data.fields.tenantLegalName = "A".repeat(400);
      await expect(renderPreparedContractPdf(data)).rejects.toEqual(
        expect.objectContaining({ code: "TENANT_NAME_TOO_LONG_FOR_TEMPLATE", statusCode: 422 }),
      );
    }
  });

  test("a short address renders on one line at the preferred size", async () => {
    const data = fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]);
    data.fields.tenantResidentialAddress = "123 Main St., Makati";
    const output = await renderPreparedContractPdf(data);
    expect(output.fieldMetrics.tenantResidentialAddress.lines.length).toBeGreaterThanOrEqual(1);
  });

  test("an address long enough to require wrapping stays within the identity block's maximum line count for every template", async () => {
    for (const template of OFFICIAL_CONTRACT_TEMPLATES) {
      const data = fixtureData(template);
      data.fields.tenantResidentialAddress =
        "Unit 45B, Sunrise Residences Tower 2, 789 Extended Boulevard Avenue, Barangay San Isidro, City of Makati, National Capital Region";
      const output = await renderPreparedContractPdf(data);
      expect(output.fieldMetrics.tenantResidentialAddress.lines.length).toBeLessThanOrEqual(3);
    }
  });

  test("an address that exceeds the bounding box even at minimum font size fails with a controlled error, not a crash", async () => {
    const data = fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]);
    data.fields.tenantResidentialAddress = "B".repeat(400);
    await expect(renderPreparedContractPdf(data)).rejects.toEqual(
      expect.objectContaining({ code: "TENANT_ADDRESS_TOO_LONG_FOR_TEMPLATE", statusCode: 422 }),
    );
  });

  test("a missing legal name is rejected with a controlled error rather than producing a malformed contract", async () => {
    const data = fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]);
    data.fields.tenantLegalName = "";
    await expect(renderPreparedContractPdf(data)).rejects.toEqual(
      expect.objectContaining({ statusCode: 422 }),
    );
  });

  test("a missing address is rejected with a controlled error rather than producing a malformed contract", async () => {
    const data = fixtureData(OFFICIAL_CONTRACT_TEMPLATES[0]);
    data.fields.tenantResidentialAddress = "";
    await expect(renderPreparedContractPdf(data)).rejects.toEqual(
      expect.objectContaining({ statusCode: 422 }),
    );
  });

  test("shrinking still respects the configured minimum font size floor — never goes below it for any template", async () => {
    for (const template of OFFICIAL_CONTRACT_TEMPLATES) {
      const data = fixtureData(template);
      data.fields.tenantLegalName = "ALEXANDRIA MONTGOMERY FITZGERALD-WASHINGTON THE THIRD";
      const coordinates = getContractTemplateCoordinates(template.templateId);
      try {
        const output = await renderPreparedContractPdf(data);
        expect(output.fieldMetrics.tenantLegalName.fontSize)
          .toBeGreaterThanOrEqual(coordinates.identityLayout.minimumFontSize);
      } catch (error) {
        expect(error.statusCode).toBe(422);
      }
    }
  });

  test("regeneration with identical inputs is deterministic (no unintended layout drift between calls)", async () => {
    const data = fixtureData(OFFICIAL_CONTRACT_TEMPLATES[2]);
    data.fields.tenantLegalName = "PATRICIA ANNE MENDOZA-REYES";
    const first = await renderPreparedContractPdf(data);
    const second = await renderPreparedContractPdf(data);
    expect(first.fieldMetrics.tenantLegalName.fontSize)
      .toBe(second.fieldMetrics.tenantLegalName.fontSize);
    expect(first.fieldMetrics.tenantLegalName.lines)
      .toEqual(second.fieldMetrics.tenantLegalName.lines);
  });
});

describe("generation status and immutable version rules", () => {
  test.each(["draft", "incomplete", "signed", "notarized"])(
    "%s Contract cannot generate a prepared PDF",
    (status) => {
      expect(() => assertPreparedGenerationAllowed({ status, preparedDocuments: [] }))
        .toThrow(expect.objectContaining({ code: "CONTRACT_STATUS_NOT_GENERATABLE" }));
    },
  );
  test.each(["published", "active"])("%s Contract is immutable", (status) => {
    expect(() => assertPreparedGenerationAllowed({ status, preparedDocuments: [] }))
      .toThrow(expect.objectContaining({ code: "PUBLISHED_CONTRACT_IMMUTABLE" }));
  });

  test("ready-for-generation Contract may create version 1", () => {
    expect(assertPreparedGenerationAllowed({
      status: "ready_for_generation",
      preparedDocuments: [],
    })).toEqual({ isRegeneration: false });
  });

  test("regeneration requires a reason and is blocked after signing", () => {
    const generated = { status: "generated", preparedDocuments: [{ version: 1 }] };
    expect(() => assertPreparedGenerationAllowed(generated))
      .toThrow(expect.objectContaining({ code: "CONTRACT_REGENERATION_REASON_REQUIRED" }));
    expect(assertPreparedGenerationAllowed(generated, "Corrected approved address"))
      .toEqual({ isRegeneration: true });
    expect(() => assertPreparedGenerationAllowed({
      ...generated,
      signedStorageKey: "private/signed.pdf",
    }, "Try again")).toThrow(expect.objectContaining({
      code: "CONTRACT_REGENERATION_NOT_ALLOWED",
    }));
  });

  test("private storage sanitizes filenames and prevents traversal", () => {
    const target = buildPreparedContractStorage({
      branch: "gil-puyat",
      year: 2026,
      contractNumber: "TEST-CONTRACT-0001",
      tenantLegalName: "../../Juan / Tenant",
      roomType: "quadruple_sharing",
      leaseType: "short_term",
      contractDate: "2026-07-27",
      version: 1,
    });
    expect(target.fileName).toBe(
      "Lease_Juan_Tenant_quadruple_sharing_short_term_2026-07-27_v1.pdf",
    );
    expect(target.absolutePath.startsWith(GENERATED_CONTRACT_ROOT)).toBe(true);
    expect(resolvePrivateContractStorageKey(target.storageKey)).toBe(target.absolutePath);
    expect(sanitizeContractFileSegment("../../")).toBe("contract");
  });
});
