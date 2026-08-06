import { describe, expect, test } from "@jest/globals";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  drawParagraphFlow,
  drawTextInsideFieldBox,
  fitParagraphFlow,
  fitSingleLineText,
} from "./contractPdfTextService.js";

async function buildFonts() {
  const document = await PDFDocument.create();
  const page = document.addPage([612, 936]);
  const regular = await document.embedFont(StandardFonts.TimesRoman);
  const bold = await document.embedFont(StandardFonts.TimesRomanBold);
  return { document, page, fonts: { regular, bold } };
}

describe("fitSingleLineText — real embedded-font measurement", () => {
  test("a short value fits at the preferred size with no shrink", async () => {
    const { fonts } = await buildFonts();
    const fitted = fitSingleLineText(fonts.regular, "Room 101", {
      width: 100, preferredFontSize: 9, minimumFontSize: 7,
    }, "roomNumber");
    expect(fitted.fontSize).toBe(9);
    expect(fitted.text).toBe("Room 101");
  });

  test("a moderately long value shrinks in 0.25pt steps until it fits", async () => {
    const { fonts } = await buildFonts();
    const fitted = fitSingleLineText(fonts.bold, "A somewhat long field value here", {
      width: 90, preferredFontSize: 9, minimumFontSize: 6,
    }, "field");
    expect(fitted.fontSize).toBeLessThan(9);
    expect(fitted.fontSize).toBeGreaterThanOrEqual(6);
    expect(fitted.width).toBeLessThanOrEqual(90);
  });

  test("never shrinks below the configured minimum readable size — throws instead", async () => {
    const { fonts } = await buildFonts();
    expect(() => fitSingleLineText(fonts.bold, "An extremely long value that cannot possibly fit in this box", {
      width: 40, preferredFontSize: 9, minimumFontSize: 8, overflowCode: "CONTRACT_TEXT_OVERFLOW",
    }, "field")).toThrow(expect.objectContaining({ code: "CONTRACT_TEXT_OVERFLOW", statusCode: 422 }));
  });

  test("overflow error never silently truncates — the original value length is reported, not a shortened one", async () => {
    const { fonts } = await buildFonts();
    const value = "X".repeat(200);
    try {
      fitSingleLineText(fonts.bold, value, { width: 10, preferredFontSize: 9, minimumFontSize: 9 }, "field");
      throw new Error("expected to throw");
    } catch (error) {
      expect(error.details.valueLength).toBe(200);
    }
  });
});

describe("fitParagraphFlow — shared multi-segment wrap/shrink engine", () => {
  const config = (overrides = {}) => ({
    width: 200, preferredFontSize: 9, minimumFontSize: 7, maximumLines: 3, ...overrides,
  });

  test("normal short name fits on the first line at the preferred size", async () => {
    const { fonts } = await buildFonts();
    const result = fitParagraphFlow({
      fonts,
      segments: [{ text: "JUAN CRUZ,", bold: true, field: "tenantLegalName" }],
      config: config(),
      fieldName: "tenantLegalName",
    });
    expect(result.fontSize).toBe(9);
    expect(result.lines).toHaveLength(1);
  });

  test("wraps across multiple lines using real measured width, respecting maximumLines", async () => {
    const { fonts } = await buildFonts();
    const result = fitParagraphFlow({
      fonts,
      segments: [{ text: "one two three four five six seven eight nine ten eleven twelve" }],
      config: config({ width: 200, minimumFontSize: 5 }),
      fieldName: "text",
    });
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines.length).toBeLessThanOrEqual(3);
  });

  test("shrinks the whole paragraph before failing when it doesn't fit at the preferred size", async () => {
    const { fonts } = await buildFonts();
    const result = fitParagraphFlow({
      fonts,
      segments: [{ text: "A somewhat long name that needs a bit more room than usual", bold: true, field: "tenantLegalName" }],
      config: config({ width: 120, maximumLines: 2 }),
      fieldName: "tenantLegalName",
    });
    expect(result.fontSize).toBeLessThan(9);
    expect(result.fontSize).toBeGreaterThanOrEqual(7);
  });

  test("attributes overflow to the specific offending field via fieldOverflowCodes", async () => {
    const { fonts } = await buildFonts();
    expect(() => fitParagraphFlow({
      fonts,
      segments: [
        { text: "of legal age with address at", field: "legalText" },
        { text: "X".repeat(400), field: "tenantResidentialAddress" },
      ],
      config: config({
        width: 200,
        overflowCode: "CONTRACT_TEXT_OVERFLOW",
        fieldOverflowCodes: { tenantResidentialAddress: "TENANT_ADDRESS_TOO_LONG_FOR_TEMPLATE" },
      }),
      fieldName: "tenantIdentity",
    })).toThrow(expect.objectContaining({ code: "TENANT_ADDRESS_TOO_LONG_FOR_TEMPLATE" }));
  });

  test("falls back to the generic overflow code when the whole clause overflows without any single oversized word", async () => {
    const { fonts } = await buildFonts();
    const words = Array.from({ length: 40 }, (_, index) => `word${index}`).join(" ");
    expect(() => fitParagraphFlow({
      fonts,
      segments: [{ text: words, field: "legalText" }],
      config: config({ width: 60, maximumLines: 1, minimumFontSize: 9, overflowCode: "CONTRACT_TEXT_OVERFLOW" }),
      fieldName: "clause",
    })).toThrow(expect.objectContaining({ code: "CONTRACT_TEXT_OVERFLOW" }));
  });

  test("never truncates or drops words — every word from every segment appears in the wrapped lines when it fits", async () => {
    const { fonts } = await buildFonts();
    const result = fitParagraphFlow({
      fonts,
      segments: [
        { text: "MARIA CRISTINA FERNANDEZ-SANTOS", bold: true, field: "tenantLegalName" },
        { text: "of legal age, Filipino", field: "legalText" },
      ],
      config: config({ width: 220 }),
      fieldName: "tenantIdentity",
    });
    const allWords = result.lines.flatMap((line) => line.words.map((word) => word.text));
    expect(allWords).toEqual(
      expect.arrayContaining(["MARIA", "CRISTINA", "FERNANDEZ-SANTOS", "of", "legal", "age,", "Filipino"]),
    );
  });
});

describe("drawParagraphFlow — fit + draw against a real pdf-lib page", () => {
  test("draws every line without throwing and returns position metadata usable for overlap checks", async () => {
    const { page, fonts } = await buildFonts();
    const result = drawParagraphFlow({
      page,
      fonts,
      x: 40,
      firstBaselineY: 800,
      lineHeight: 10,
      fieldName: "tenantIdentity",
      config: { width: 500, preferredFontSize: 9, minimumFontSize: 7, maximumLines: 3 },
      segments: [
        { text: "JOSE MARIA DELA CRUZ JR.,", bold: true, field: "tenantLegalName" },
        { text: "of legal age, Filipino, residing at", field: "legalText" },
        { text: "123 Sample St., Quezon City,", field: "tenantResidentialAddress" },
        { text: "hereinafter the LESSEE;", bold: true, field: "legalText" },
      ],
    });
    expect(result.positions.length).toBeGreaterThan(0);
    for (const position of result.positions) {
      expect(position.x).toBeGreaterThanOrEqual(40);
      expect(position.x + position.width).toBeLessThanOrEqual(40 + 500 + 0.5);
    }
  });

  test("no two words on the same line overlap horizontally", async () => {
    const { page, fonts } = await buildFonts();
    const result = drawParagraphFlow({
      page,
      fonts,
      x: 40,
      firstBaselineY: 800,
      lineHeight: 10,
      fieldName: "field",
      config: { width: 500, preferredFontSize: 9, minimumFontSize: 7, maximumLines: 3 },
      segments: [{ text: "Several distinct words placed one after another on the same line" }],
    });
    for (let lineIndex = 0; lineIndex <= Math.max(...result.positions.map((p) => p.lineIndex)); lineIndex += 1) {
      const line = result.positions.filter((p) => p.lineIndex === lineIndex).sort((a, b) => a.x - b.x);
      for (let i = 1; i < line.length; i += 1) {
        expect(line[i].x).toBeGreaterThanOrEqual(line[i - 1].x + line[i - 1].width - 0.01);
      }
    }
  });
});

describe("drawTextInsideFieldBox — single/multi-line field box with alignment", () => {
  test("centers short text within the box by default", async () => {
    const { page, fonts } = await buildFonts();
    const result = drawTextInsideFieldBox({
      page,
      fonts,
      fieldName: "roomNumber",
      value: "101",
      config: { x: 100, y: 700, width: 60, height: 10, preferredFontSize: 9, minimumFontSize: 8, maximumLines: 1 },
    });
    expect(result.positions[0].x).toBeGreaterThan(100);
    expect(result.positions[0].x + result.positions[0].width).toBeLessThan(160);
  });

  test("respects left/right alignment", async () => {
    const { page, fonts } = await buildFonts();
    const left = drawTextInsideFieldBox({
      page, fonts, fieldName: "f",
      value: "AB",
      config: { x: 100, y: 700, width: 60, height: 10, preferredFontSize: 9, minimumFontSize: 8, maximumLines: 1, alignment: "left" },
    });
    expect(left.positions[0].x).toBe(100);
  });
});
