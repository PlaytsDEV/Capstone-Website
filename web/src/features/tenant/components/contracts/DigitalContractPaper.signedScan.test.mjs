/**
 * F5 — DigitalContractPaper canonical Signed Scan resolution.
 *
 * The Signed Scan tab must be driven by the backend-resolved `signedScan`
 * identity ({ contractId, version, inherited, ... }) — NEVER inferred from
 * `contract.signedDocuments.length` on the current contract alone — and must
 * fetch Preview / Download from that SAME identity via the injected
 * `fetchSignedDoc` (admin vs tenant route), with an "inherited from original
 * lease" label for the Room Transfer Addendum case.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DigitalContractPaper.jsx", import.meta.url), "utf8");
const contractsPage = readFileSync(
  new URL("../../pages/ContractsPage.jsx", import.meta.url),
  "utf8",
);
const adminModal = readFileSync(
  new URL("../../../admin/components/TenantDetailModal.jsx", import.meta.url),
  "utf8",
);

test("component accepts a fetchSignedDoc prop (route-aware signed-file fetcher)", () => {
  assert.match(source, /^\s*fetchSignedDoc,\s*$/m);
});

test("signed-scan availability is derived from the canonical `signedScan`, not signedDocuments.length alone", () => {
  assert.match(source, /const signedScan = stayData\?\.signedScan \|\| contract\?\.signedScan \|\| null;/);
  assert.match(source, /const hasSignedDoc = Boolean\(signedScan\) \|\| activeSignedDocs\.length > 0;/);
  // The old gate `activeSignedDocs.length > 0` alone must be gone.
  assert.doesNotMatch(source, /const hasSignedDoc = activeSignedDocs\.length > 0;/);
});

test("the fetch identity is the scan-owning contract (may be an ancestor), never blindly contract.id", () => {
  assert.match(source, /const scanContractId =\s*\n?\s*signedScan\?\.contractId \|\| contract\?\.id \|\| contract\?\._id \|\| null;/);
  assert.match(source, /const signedFetchContractId = scanContractId;/);
  // The fetch effect uses the injected fetcher with { contractId, version, download }.
  assert.match(source, /fetchSignedDoc\(\{\s*\n?\s*contractId: signedFetchContractId,\s*\n?\s*version: signedFetchVersion,\s*\n?\s*download: false,/s);
  // Back-compat fallback to the tenant route uses the SAME resolved id, not contract.id.
  assert.match(source, /tenantContractApi\.getMySignedContractFile\(\s*\n?\s*signedFetchContractId,/s);
});

test("Preview and Download resolve from the same { contractId, version } identity", () => {
  assert.match(source, /const handleDownloadSignedScan = useCallback\(async \(\) => \{/);
  assert.match(source, /fetchSignedDoc\(\{\s*\n?\s*contractId: signedFetchContractId,\s*\n?\s*version: signedFetchVersion,\s*\n?\s*download: true,/s);
});

test("inherited scan is clearly labelled as belonging to the original lease, not the Addendum", () => {
  assert.match(source, /signedScan\?\.inherited &&/);
  assert.match(source, /Signed copy from original lease/);
  assert.match(source, /signedScan\.inheritedFromContractNumber/);
  assert.match(source, /acknowledged, not wet-signed/i);
});

test("the multi-version switcher only shows when the CURRENT contract owns its signedDocuments (not inherited)", () => {
  assert.match(source, /const ownsScanDocs =\s*\n?\s*!!signedScan &&\s*\n?\s*!signedScan\.inherited &&/s);
  assert.match(source, /\{ownsScanDocs && activeSignedDocs\.length > 1 &&/);
});

test("Admin viewer injects the ADMIN signed-file route", () => {
  assert.match(adminModal, /fetchSignedDoc=\{\(\{ contractId, version, download \}\) =>\s*\n?\s*contractApi\.getSignedContractFile\(contractId, version, Boolean\(download\)\)\}/s);
});

test("Tenant Web viewer injects the TENANT signed-file route", () => {
  assert.match(contractsPage, /fetchSignedDoc=\{\(\{ contractId, version, download \}\) =>\s*\n?\s*tenantContractApi\.getMySignedContractFile\(contractId, version, Boolean\(download\)\)\}/s);
});
