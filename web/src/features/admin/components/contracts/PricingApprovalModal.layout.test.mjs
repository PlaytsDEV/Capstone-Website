import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const modal = fs.readFileSync(new URL("./PricingApprovalModal.jsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../../styles/admin-contracts.css", import.meta.url), "utf8");

test("pricing review is a viewport-level isolated portal", () => {
  assert.match(modal, /createPortal\(content, document\.body\)/);
  assert.match(css, /\.pricing-modal-backdrop[\s\S]*position: fixed/);
  assert.match(css, /z-index: 1100/);
  assert.match(css, /background: rgba\(15, 23, 42, \.65\)/);
});

test("dialog uses fixed header/footer regions and independently scrolling body", () => {
  assert.match(css, /\.pricing-modal \{[\s\S]*width: min\(700px, calc\(100vw - 32px\)\)/);
  assert.match(css, /max-height: calc\(100vh - 64px\)/);
  assert.match(css, /\.pricing-modal__body \{[\s\S]*overflow-y: auto/);
  assert.match(css, /\.pricing-modal header,[\s\S]*flex: 0 0 auto/);
  assert.match(css, /\.pricing-modal footer \{[\s\S]*border-top/);
});

test("focus, escape, drawer isolation, and scroll restoration are implemented", () => {
  assert.match(modal, /noteRef\.current\?\.focus\(\)/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /removeAttribute\("inert"\)/);
  assert.match(modal, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(modal, /restoreFocus\?\.focus\?\.\(\)/);
});

test("responsive grids use three, two, and one columns", () => {
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /max-width: 760px[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /max-width: 520px[\s\S]*grid-template-columns: 1fr/);
  assert.match(css, /white-space: nowrap/);
  assert.match(css, /height: 76px/);
});
