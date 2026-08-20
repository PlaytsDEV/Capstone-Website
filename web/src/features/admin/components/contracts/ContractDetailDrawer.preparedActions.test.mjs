import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const drawer = fs.readFileSync(new URL("./ContractDetailDrawer.jsx", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../../../../shared/api/contractApi.js", import.meta.url), "utf8");

test("generated stage exposes one viewer action and separate workflow actions", () => {
  const panel = drawer.slice(drawer.indexOf("<h3>Prepared Contract Actions</h3>"));
  const view = panel.indexOf("View Prepared Copy");
  const marked = panel.indexOf("Mark as Printed");
  const upload = panel.indexOf("Upload Signed and Notarized Copy");
  assert.ok(view > -1 && view < marked && marked < upload);
  assert.doesNotMatch(panel, /Download Prepared Copy/);
  assert.doesNotMatch(panel, /Print Prepared Copy/);
  assert.match(drawer, /Prepared Contract Actions/);
  assert.match(drawer, /Print or download the document using the controls in the PDF viewer/);
  assert.match(drawer, /<h4>After Wet Signing<\/h4>/);
});

test("current prepared copy is newest non-superseded document, not generatedVersion", () => {
  assert.match(drawer, /versions\.find\(\(document\) => document\.superseded !== true\)/);
  assert.match(drawer, /currentPrepared\.version, "preview"/);
  assert.doesNotMatch(drawer, /const currentVersion = contract\?\.generatedVersion/);
});

test("viewer is guarded by current document and does not mark printed", () => {
  assert.match(drawer, /contract\.status === "generated"/);
  assert.match(drawer, /currentPrepared && <button[\s\S]*View Prepared Copy/);
  assert.match(drawer, /openFile\(currentPrepared\.version, "preview"\)/);
  assert.match(drawer, /onSubmit: \(\) => runAction\("mark-printed", \(\) => contractApi\.markPrinted/);
  assert.match(drawer, /CURRENT_PREPARED_DOCUMENT_UNAVAILABLE|Current prepared document unavailable/);
});

test("current document status is metadata-only without repeated file controls", () => {
  const start = drawer.indexOf('<section className="contract-panel contract-documents">');
  const end = drawer.indexOf("<details><summary>Prepared document history", start);
  const currentStatus = drawer.slice(start, end);
  assert.match(currentStatus, /Prepared Version/);
  assert.match(currentStatus, /Generated date/);
  assert.doesNotMatch(currentStatus, /contract-version-actions/);
  assert.doesNotMatch(currentStatus, />Download</);
  assert.doesNotMatch(currentStatus, />Print</);
});

test("prepared history keeps current metadata-only and removes historical print", () => {
  const start = drawer.indexOf("<details><summary>Prepared document history");
  const end = drawer.indexOf("</details>", start);
  const history = drawer.slice(start, end);
  assert.match(history, /Current Version/);
  assert.match(history, /"Superseded"/);
  assert.match(history, /document\.superseded === true && <div className="contract-version-actions">/);
  assert.match(history, /openFile\(document\.version, "preview"\)/);
  assert.match(history, /openFile\(document\.version, "download"\)/);
  assert.doesNotMatch(history, /openFile\(document\.version, "print"\)/);
  assert.doesNotMatch(history, /<Printer size=\{14\}/);
});

test("prepared downloads use authenticated no-store API requests", () => {
  assert.match(api, /\/contracts\/\$\{contractId\}\/documents\/prepared/);
  assert.match(api, /cache: "no-store"/);
});
