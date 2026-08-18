import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../../..");
const read = (relative) => fs.readFileSync(path.join(webRoot, relative), "utf8");

test("tenant web Statement and Receipt use canonical authenticated server endpoints", () => {
  const tab = read("features/tenant/components/profile/BillingTab.jsx");
  const statement = read("shared/utils/pdfUtils.js");
  const receipt = read("shared/utils/pdfReceipt.js");
  const api = read("shared/api/billingApi.js");

  assert.match(tab, /Download Statement \(PDF\)/);
  assert.match(tab, /Download Payment Receipt \(PDF\)/);
  assert.match(statement, /billingApi\.downloadBillPdf/);
  assert.match(receipt, /billingApi\.downloadBillReceipt/);
  assert.match(api, /\/billing\/\$\{billId\}\/pdf/);
  assert.match(api, /\/billing\/\$\{billId\}\/receipt/);
  assert.doesNotMatch(statement, /jspdf|generateBillingReceiptPDF|new Blob/);
  assert.doesNotMatch(receipt, /jspdf|generateReceiptPDF|new Blob/);
});
