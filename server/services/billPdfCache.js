import { BILL_STATEMENT_TEMPLATE_VERSION } from "./billingStatementTemplate.js";

function toTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * A statement PDF is a projection of the bill at bill.updatedAt through one
 * specific template version. A cached file with no generation provenance,
 * an older template, or a generation time before that source revision must
 * not be served.
 */
export function isBillPdfStale(bill) {
  if (!bill?.pdfPath) return false;
  if (Number(bill.pdfTemplateVersion) !== BILL_STATEMENT_TEMPLATE_VERSION) return true;
  const generatedAt = toTime(bill.pdfGeneratedAt);
  if (generatedAt === null) return true;
  const sourceUpdatedAt = toTime(bill.updatedAt);
  return sourceUpdatedAt !== null && sourceUpdatedAt > generatedAt;
}

/**
 * Persist PDF cache metadata without advancing bill.updatedAt. Updating the
 * cache must not create a new source revision and immediately invalidate the
 * file that was just generated.
 */
export async function recordBillPdfGeneration(bill, pdfPath, now = new Date()) {
  const sourceUpdatedAt = toTime(bill?.updatedAt);
  const requestedGeneratedAt = toTime(now) ?? Date.now();
  const generatedAt = new Date(Math.max(requestedGeneratedAt, sourceUpdatedAt ?? requestedGeneratedAt));

  bill.pdfPath = pdfPath;
  bill.pdfGeneratedAt = generatedAt;
  bill.pdfTemplateVersion = BILL_STATEMENT_TEMPLATE_VERSION;
  await bill.save({ timestamps: false });
  return generatedAt;
}
