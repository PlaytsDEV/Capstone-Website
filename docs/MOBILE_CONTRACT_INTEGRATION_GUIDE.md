# Lilycrest DMS — Mobile Contract Integration Guide

This guide describes the current (post `fix/contract-wet-signed-finality-canonical`, PR #110) contract lifecycle and how the mobile app integrates with the backend to display, preview, and download tenant lease contracts as PDFs. It reflects the code as of `server/services/tenantContractDocumentResolver.js`, `server/services/tenantContractViewService.js`, `server/routes/mobileContractRoutes.js`, `server/services/contractSigningService.js`, and `server/services/notifications/notificationService.js`.

---

## 1. The Contract Lifecycle (Backend Process)

A tenant's contract moves through exactly two document stages. Mobile never needs to know about the underlying Contract `status` machine in detail — only which of the two stages is currently active, which is exposed pre-computed via `tenantDocument` (see §3).

```
Admin/Web generates the Draft
        ↓
Backend persists it to preparedDocuments[] (contractPdfService.js)
        ↓
Draft is immediately tenant-visible — "Generated Draft — For Signing"
        ↓
Tenant reviews and physically signs the printed draft
        ↓
Admin uploads the wet-signed scan (PDF/JPG/JPEG/PNG, ≤10MB)
        ↓
contractSigningService.uploadSignedContract validates + stores it durably
        ↓
The upload itself is the finalization event — no separate verify/publish
step, no notarization requirement, for this (standard) path
        ↓
contract.finalDocument is set (sourceType: "admin_scan"), tenantVisible = true,
status advances to "published"
        ↓
Final Contract is immediately tenant-visible — "Final Contract"
        ↓
Mobile automatically upgrades the Draft view to the Final view on next fetch
```

**Core business rule** (see `contractSigningService.js`, `uploadSignedContract`'s "CORE BUSINESS RULE" comment): an authorized admin's wet-signed upload **is** the final contract the moment it lands. There is no manual "mark ready" or "publish" button in this path, and it never sets `notarizationVerifiedAt` — that field belongs only to a separate, optional internal notarization pipeline (`sourceType: "notarized"`) that a minority of contracts use instead. Both source types are equally final and equally tenant-visible; mobile does not need to distinguish them (the label text differs slightly — see §3 — but `type`, `isFinal`, and the endpoint used are identical).

There is a **single canonical resolver** (`tenantContractDocumentResolver.js`) that both Web and Mobile consume for "which document does the tenant see right now." Do not attempt to infer document availability from `status` strings on the client — always read `tenantDocument.available` / `tenantDocument.type` / `tenantDocument.isFinal`.

---

## 2. API Endpoints

All mobile requests must include the session bearer token in the `Authorization` header:
```http
Authorization: Bearer <session_token>
```

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/m/contracts/current` | Retrieves the tenant's current contract details, document URLs, and availability status. **Primary endpoint — call this first.** |
| `GET` | `/api/m/contracts/:contractId/documents/prepared` | Streams the Generated Draft PDF for in-app preview or download (`?download=1`). |
| `GET` | `/api/m/contracts/:contractId/documents/final` | Streams the Final Contract PDF once published (`?download=1`). Works for both `admin_scan` and `notarized` source types. |
| `GET` | `/api/m/documents/contract` | **Backward-compatible single streaming URL**: delivers the Final Contract PDF if `contract.finalDocument` exists, otherwise streams the current Prepared Draft PDF. Prefer the explicit `tenantDocument.viewUrl` from `/contracts/current` over this route for new code. |

Mobile's `/contracts/current` intentionally includes early-stage contracts (`draft`, `incomplete`, etc.) that Web's equivalent endpoint excludes — so a tenant may see "Contract is being prepared" on mobile before Web shows anything at all. This is deliberate, not a bug.

---

## 3. Metadata Endpoint (`GET /api/m/contracts/current`)

### Request
```http
GET /api/m/contracts/current HTTP/1.1
Host: api.lilycrest.com
Authorization: Bearer <session_token>
```

### Response shape

```jsonc
{
  "contract": {
    "id": "64b000000000000000000002",
    "contractId": "64b000000000000000000002",
    "contractNumber": "LIL-MNL-2026-00001",
    "status": "generated",                // raw lifecycle status — do not branch UI on this directly
    "displayStatus": "Prepared Contract Available", // human-readable status string, safe to show as-is
    "branch": "manila",
    "propertyName": "Lilycrest Dormitory Manila",
    "roomNumber": "301",
    "bedLabel": "Bed A",
    "roomType": "quadruple-sharing",
    "leaseStartDate": "2026-09-01T00:00:00.000Z",
    "leaseEndDate": "2027-08-31T00:00:00.000Z",
    "leaseDurationMonths": 12,
    "daysRemaining": 365,
    "approvedMonthlyRate": 4500,
    "regularMonthlyRate": 4500,
    "advanceRentAmount": 4500,
    "securityDepositAmount": 4500,

    // ── PRIMARY SOURCE OF TRUTH — use this to decide what to render ──
    "tenantDocument": {
      "available": true,
      "type": "generated_draft",           // "generated_draft" | "final_notarized" | null
      "label": "Generated Draft — For Signing", // pre-formatted, safe to display directly
      "isFinal": false,
      "version": 1,
      "fileName": "LIL-MNL-2026-00001_prepared_v1.pdf",
      "fileSize": 1048576,
      "pageCount": 4,
      "generatedAt": "2026-08-18T00:00:00.000Z",
      "publishedAt": null,
      "viewUrl": "/api/m/contracts/64b000000000000000000002/documents/prepared",
      "downloadUrl": "/api/m/contracts/64b000000000000000000002/documents/prepared?download=1"
    },

    // Secondary/legacy fields — still populated, kept for backward compatibility.
    // Prefer tenantDocument for new UI logic.
    "preparedDocument": {
      "available": true,
      "issue": null,
      "currentVersion": 1,
      "generatedAt": "2026-08-18T00:00:00.000Z",
      "fileName": "LIL-MNL-2026-00001_prepared_v1.pdf",
      "fileSize": 1048576,
      "pageCount": 4,
      "viewUrl": "/api/m/contracts/64b000000000000000000002/documents/prepared",
      "downloadUrl": "/api/m/contracts/64b000000000000000000002/documents/prepared?download=1"
    },
    "finalDocument": {
      "available": false,
      "publishedAt": null,
      "fileName": null,
      "fileSize": null,
      "pageCount": null,
      "viewUrl": null,
      "downloadUrl": null
    }
  },
  "state": "CONTRACT_AVAILABLE",   // "CONTRACT_AVAILABLE" | "NO_PUBLISHED_CONTRACT"
  "emptyState": null,              // string message when state is NO_PUBLISHED_CONTRACT, else null
  "upcoming": null                 // a full tenant-contract-view object for a pending renewal/transfer, else null
}
```

### Response Example: Final Contract published (wet-signed, `admin_scan`)

```jsonc
{
  "contract": {
    "id": "64b000000000000000000002",
    "contractNumber": "LIL-MNL-2026-00001",
    "status": "active",
    "displayStatus": "Final Signed and Notarized Contract Available",
    "tenantDocument": {
      "available": true,
      "type": "final_notarized",
      "label": "Final Contract",   // "Final Contract" for admin_scan, "Final Notarized Contract" for the notarized pipeline
      "isFinal": true,
      "version": 1,
      "fileName": "LIL-MNL-2026-00001_signed_v1.pdf",
      "fileSize": 2097152,
      "pageCount": 4,
      "generatedAt": null,
      "publishedAt": "2026-08-18T01:00:00.000Z",
      "viewUrl": "/api/m/contracts/64b000000000000000000002/documents/final",
      "downloadUrl": "/api/m/contracts/64b000000000000000000002/documents/final?download=1"
    },
    "finalDocument": {
      "available": true,
      "publishedAt": "2026-08-18T01:00:00.000Z",
      "fileName": "LIL-MNL-2026-00001_signed_v1.pdf",
      "fileSize": 2097152,
      "pageCount": 4,
      "viewUrl": "/api/m/contracts/64b000000000000000000002/documents/final",
      "downloadUrl": "/api/m/contracts/64b000000000000000000002/documents/final?download=1"
    }
  },
  "state": "CONTRACT_AVAILABLE"
}
```

> `tenantDocument.type` is `"final_notarized"` for **both** `admin_scan` and internally-notarized contracts — it is a UI-facing category, not a literal source-type flag. Only `tenantDocument.label` differs between the two. Do not gate rendering on any notarization-specific field; `tenantDocument.available` / `isFinal` are already correct for both.

### Response Example: No contract yet

```jsonc
{
  "contract": null,
  "state": "NO_PUBLISHED_CONTRACT",
  "emptyState": "Contract Not Available Yet",
  "upcoming": null
}
```

---

## 4. Mobile Client Implementation Guide

### A. Determining What to Render

Use `contract.tenantDocument` as the single source of truth:

```javascript
const contractData = response.data.contract;
const tenantDoc = contractData?.tenantDocument;

if (!contractData || !tenantDoc || !tenantDoc.available) {
  // State: Contract is being prepared
  return <Text>Contract is being prepared.</Text>;
}

if (tenantDoc.type === 'generated_draft') {
  // State: Generated Draft — For Signing
  return (
    <View>
      <Badge text={tenantDoc.label} color="amber" />
      <Button title="View Contract PDF" onPress={() => openPdfViewer(`${API_BASE_URL}${tenantDoc.viewUrl}`)} />
      <Button title="Download Contract PDF" onPress={() => downloadPdfFile(`${API_BASE_URL}${tenantDoc.downloadUrl}`)} />
    </View>
  );
}

if (tenantDoc.type === 'final_notarized') {
  // State: Final Contract available (covers both admin_scan and notarized sources)
  return (
    <View>
      <Badge text={tenantDoc.label} color="emerald" />
      <Button title="View Final Contract" onPress={() => openPdfViewer(`${API_BASE_URL}${tenantDoc.viewUrl}`)} />
      <Button title="Download Final Contract" onPress={() => downloadPdfFile(`${API_BASE_URL}${tenantDoc.downloadUrl}`)} />
    </View>
  );
}
```

Do not build a separate "is this notarized" check from `finalDocument`/`notarizationVerifiedAt` fields — `tenantDocument` already resolves that. Historically, two other call sites in the backend reimplemented this check incorrectly and required `notarizationVerifiedAt` even for wet-signed contracts that never set it (fixed in PR #110); mobile should avoid repeating that mistake by always deferring to `tenantDocument`.

### B. Streaming / Downloading the PDF Binary

```javascript
import * as FileSystem from 'expo-file-system';

async function downloadContractPdf(relativeUrl, targetFileName) {
  const fileUri = `${FileSystem.documentDirectory}${targetFileName}`;
  const fullUrl = `${API_BASE_URL}${relativeUrl}`;

  const downloadRes = await FileSystem.downloadAsync(
    fullUrl,
    fileUri,
    { headers: { Authorization: `Bearer ${userSessionToken}` } },
  );

  return downloadRes.uri;
}
```

### C. Refresh / Invalidation

The backend does not push document bytes to the client — it only sends a notification when a new document becomes available (§5). The client is responsible for refetching `/api/m/contracts/current` at these points:

- On receiving a `contract_document_ready` push notification (tap should navigate to the contract screen and refetch).
- On app foreground/resume, if the contract screen is active.
- On pull-to-refresh.
- After returning from any admin-triggered action screen, if applicable.

Do not cache `tenantDocument.viewUrl`/`downloadUrl` results indefinitely — a Draft → Final transition changes `type`, `label`, `isFinal`, and the URL path (`/documents/prepared` → `/documents/final`) all at once; stale cached values will keep pointing at the superseded draft.

---

## 5. Notifications

Two logical events exist, both created by `notify.contractDocumentReady(userId, variant, contractId, version)` in `server/services/notifications/notificationService.js`:

| Event | `variant` | Title | Message |
| :--- | :--- | :--- | :--- |
| Draft generated | `"prepared"` | "Contract Ready for Signing" | "Your lease contract has been prepared and is ready for your review and in-person signing." |
| Final contract published | `"final"` | "Final Contract Ready" | "Your final lease contract is now available to view and download." |

Push payload (`data` field):
```json
{
  "type": "contract_document_ready",
  "contract_id": "64b000000000000000000002",
  "screen": "contract",
  "url": "/contract-viewer"
}
```

On tap, navigate to the contract screen (`screen: "contract"`) and refetch `/api/m/contracts/current` — do not rely on any document data embedded in the push payload itself, only `contract_id`.

**Deduplication**: each event is deduplicated server-side on `` `contract_document_ready:${contractId}:${variant}:${version}` `` via a database-level unique constraint. A retried backend operation for the same document version will not produce a duplicate push or in-app notification. Mobile does not need to implement its own dedup for this event type.

---

## 6. Summary of Error Handling & Status Codes

| HTTP Status | Error Code / Cause | Mobile Handling |
| :--- | :--- | :--- |
| `200 OK` | Document available | Render View/Download actions and load PDF binary. |
| `401 Unauthorized` | `TOKEN_EXPIRED` or invalid session | Redirect to mobile login screen. |
| `404 Not Found` | `PREPARED_DOCUMENT_UNAVAILABLE` / `CONTRACT_NOT_FOUND` | Display *"Contract is being prepared."* placeholder with no download button. |
| `410 Gone` | `PREPARED_DOCUMENT_STORAGE_MISSING` | The metadata exists but the file object is missing server-side. Show *"Unable to load document at this time. Please try again later."* — do **not** show a broken/empty PDF viewer. |
| `503 Service Unavailable` | Storage temporarily unreachable | Show friendly retry dialog: *"Unable to load document at this time. Please try again."* |

---

## 7. What Mobile Should NOT Do

- Do not derive final-vs-draft state from raw `status` strings, `notarizationVerifiedAt`, or any field on `finalDocument`/`signedDocuments` directly — always use `tenantDocument`.
- Do not assume a manual admin "publish" step is required after a wet-signed upload before the tenant can see it — for the standard `admin_scan` path, upload **is** publish.
- Do not build a client-side notarization-verification indicator; both final source types are equally authoritative to the tenant.
- Do not poll `/api/m/contracts/current` on a tight interval as a substitute for push-notification-driven refresh — refetch on the trigger points listed in §4C instead.
