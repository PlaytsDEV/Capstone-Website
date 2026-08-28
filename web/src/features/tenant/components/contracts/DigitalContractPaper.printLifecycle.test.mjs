/**
 * R5 — Contract viewer print lifecycle + responsive layout (source assertions).
 *
 * R5.2/R5.4: the print <iframe> + its blob: URL must stay alive while the
 *   browser's print preview owns the document — released only on viewer
 *   unmount, and replaced (never leaked) on a repeat print. NOT revoked on a
 *   short post-print timer (which killed the preview mid-view).
 * R5.5: a genuinely long contract must paginate, not be clipped to one sheet
 *   (no position:absolute / fixed height on the print target; signature blocks
 *   kept intact across the break).
 * R5.6: the viewer panels size to the viewport on narrow widths.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DigitalContractPaper.jsx", import.meta.url), "utf8");

test("R5.2 — a single print resource ref is held and released on unmount", () => {
  assert.match(source, /printResourceRef\s*=\s*useRef\(null\)/);
  assert.match(source, /const releasePrintResource = useCallback\(/);
  // Released on unmount via an effect returning the cleanup fn.
  assert.match(source, /useEffect\(\(\) => releasePrintResource, \[releasePrintResource\]\)/);
});

test("R5.2 — the blob URL is NOT revoked on a post-print timer", () => {
  // The old bug: setTimeout(cleanup, 2500) after finish(resolve), and
  // setTimeout(() => iframe.remove(), 1500) inside cleanup.
  assert.doesNotMatch(source, /setTimeout\(cleanup,\s*\d+\)/);
  assert.doesNotMatch(source, /setTimeout\(\(\) => iframe\.remove\(\),\s*\d+\)/);
  // On resolve we KEEP the resource; only reject releases it immediately.
  assert.match(source, /if \(fn === reject\) releasePrintResource\(\)/);
});

test("R5.2 — a repeat print replaces the previous resource (no iframe leak)", () => {
  assert.match(source, /Repeat print: drop the previous resource first/);
  assert.match(source, /releasePrintResource\(\);\s*\n\s*const url = URL\.createObjectURL\(blob\)/);
});

test("R5.5 — the print target paginates instead of clipping to one sheet", () => {
  const printCss = source.slice(source.indexOf("@media print"), source.indexOf("`}</style>"));
  assert.match(printCss, /position:\s*static\s*!important/);
  assert.doesNotMatch(printCss, /#digital-contract-paper\s*\{[^}]*position:\s*absolute/s);
  assert.match(printCss, /max-height:\s*none\s*!important/);
  assert.match(printCss, /overflow:\s*visible\s*!important/);
  // Signature / notarial blocks stay intact across a page break.
  assert.match(printCss, /page-break-inside:\s*avoid\s*!important/);
});

test("R5.6 — viewer panels size to the viewport on narrow widths (not a hard 800px)", () => {
  // Both the digital panel and the signed-scan panel.
  const matches = source.match(/h-\[70vh\] min-h-\[380px\] max-h-\[800px\] sm:h-\[800px\]/g) || [];
  assert.ok(matches.length >= 2, `expected >=2 responsive-height panels, found ${matches.length}`);
  assert.doesNotMatch(source, /flex flex-col h-\[800px\]`/);
});

test("R5.6 — the document scroll area uses compact padding on narrow viewports", () => {
  assert.match(source, /px-3 py-4 sm:px-12 sm:py-10 overflow-y-auto overflow-x-auto/);
});
