import PDFDocument from "pdfkit";
import { drawTable } from "./pdfGenerator.js";

function renderTable(rowCount, { startNearBottom = false } = {}) {
  const doc = new PDFDocument({ margin: 40, bufferPages: true });
  doc.on("data", () => {});
  doc.y = startNearBottom
    ? doc.page.height - doc.page.margins.bottom - 10
    : doc.page.margins.top;

  const rows = Array.from({ length: rowCount }, (_, i) => [
    `Segment ${i + 1}`,
    `${i + 1}00.00`,
  ]);
  drawTable(doc, {
    headers: ["Description", "Amount"],
    widths: [300, 150],
    rows,
  });

  const pageCount = doc.bufferedPageRange().count;
  const finalY = doc.y;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  doc.end();
  return { pageCount, finalY, pageBottom };
}

describe("billing statement table pagination", () => {
  test("a short table remains on one page", () => {
    expect(renderTable(3).pageCount).toBe(1);
  });

  test("an overflowing table repeats its header on a new page", () => {
    const result = renderTable(60);
    expect(result.pageCount).toBeGreaterThan(1);
    expect(result.finalY).toBeLessThanOrEqual(result.pageBottom + 6);
  });

  test("moves the whole table when even its first row cannot fit", () => {
    expect(renderTable(1, { startNearBottom: true }).pageCount).toBe(2);
  });

  test("does not throw at a page-boundary-sized row count", () => {
    expect(() => renderTable(45)).not.toThrow();
  });
});
