function toTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * A statement PDF is a projection of the bill at bill.updatedAt. A cached
 * file with no generation provenance, or one generated before that source
 * revision, must not be served.
 */
export function isBillPdfStale(bill) {
  if (!bill?.pdfPath) return false;
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
  await bill.save({ timestamps: false });
  return generatedAt;
}
