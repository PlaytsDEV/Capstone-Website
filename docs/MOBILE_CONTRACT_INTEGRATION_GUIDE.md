# Lilycrest DMS — Mobile Contract Integration Guide

> **Note:** For the full canonical lifecycle (initial/renewal/transfer,
> resolver precedence, notifications, storage architecture) see
> [`docs/CONTRACT_CANONICAL_WEB_MOBILE_WORKFLOW.md`](./CONTRACT_CANONICAL_WEB_MOBILE_WORKFLOW.md).
> This guide remains accurate as a narrower API-endpoint quick reference, but
> §1's "only two document types" framing omits the renewal/transfer/
> notification pieces the canonical doc covers.

This guide describes how the mobile app integrates with the Lilycrest backend to display, preview, and download tenant lease contracts as PDFs.

---

## 1. Overview & Document Types

Under the simplified Lilycrest contract workflow, a tenant only ever interacts with **two document types**:

1. **Generated Draft (`generated_draft`)**:
   - The initial PDF contract generated automatically upon initial payment (Advance Rent & Security Deposit settlement) or by an Admin.
   - Used for tenant review and physical signing.
   - Label: `"Generated Draft — For Signing"` (`isFinal: false`).

2. **Final Notarized Contract (`final_notarized`)**:
   - The official scanned contract after in-person signing and notarization, uploaded by an Admin.
   - Automatically replaces the Generated Draft as the active tenant document.
   - Label: `"Final Notarized Contract"` (`isFinal: true`).

---

## 2. API Endpoints

All mobile requests must include the session bearer token in the `Authorization` header:
```http
Authorization: Bearer <session_token>
```

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/m/contracts/current` | Retrieves the tenant's current contract details, document URLs, and availability status. |
| `GET` | `/api/m/contracts/:contractId/documents/prepared` | Streams the Generated Draft PDF for in-app preview or download (`?download=1`). |
| `GET` | `/api/m/contracts/:contractId/documents/final` | Streams the Final Notarized Contract PDF once published (`?download=1`). |
| `GET` | `/api/m/documents/contract` | **Backward-compatible single streaming URL**: Delivers the Final Notarized PDF if published, otherwise streams the Prepared Draft PDF. |

---

## 3. Metadata Endpoint (`GET /api/m/contracts/current`)

### Request
```http
GET /api/m/contracts/current HTTP/1.1
Host: api.lilycrest.com
Authorization: Bearer <session_token>
```

### Response Example: Generated Draft Available
```json
{
  "contract": {
    "id": "64b000000000000000000002",
    "contractId": "64b000000000000000000002",
    "contractNumber": "LIL-MNL-2026-00001",
    "status": "generated",
    "displayStatus": "Prepared Contract Available",
    "branch": "manila",
    "propertyName": "Lilycrest Dormitory Manila",
    "roomNumber": "301",
    "bedLabel": "Bed A",
    "roomType": "quadruple-sharing",
    "leaseStartDate": "2026-09-01T00:00:00.000Z",
    "leaseEndDate": "2027-08-31T00:00:00.000Z",
    "leaseDurationMonths": 12,
    "approvedMonthlyRate": 4500,
    "regularMonthlyRate": 4500,
    "advanceRentAmount": 4500,
    "securityDepositAmount": 4500,
    "tenantDocument": {
      "available": true,
      "type": "generated_draft",
      "label": "Generated Draft — For Signing",
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
    }
  },
  "state": "CONTRACT_AVAILABLE",
  "emptyState": null
}
```

### Response Example: Final Notarized Contract Published
```json
{
  "contract": {
    "id": "64b000000000000000000002",
    "contractNumber": "LIL-MNL-2026-00001",
    "status": "active",
    "displayStatus": "Final Signed and Notarized Contract Available",
    "tenantDocument": {
      "available": true,
      "type": "final_notarized",
      "label": "Final Notarized Contract",
      "isFinal": true,
      "version": 1,
      "fileName": "LIL-MNL-2026-00001_signed_notarized_v1.pdf",
      "fileSize": 2097152,
      "pageCount": 4,
      "generatedAt": "2026-08-18T01:00:00.000Z",
      "publishedAt": "2026-08-18T01:00:00.000Z",
      "viewUrl": "/api/m/contracts/64b000000000000000000002/documents/final",
      "downloadUrl": "/api/m/contracts/64b000000000000000000002/documents/final?download=1"
    }
  },
  "state": "CONTRACT_AVAILABLE"
}
```

---

## 4. Mobile Client Implementation Guide

### A. Determining What to Render

Use `contract.tenantDocument` as the primary source of truth:

```javascript
// Example React Native / Mobile Logic
const contractData = response.data.contract;
const tenantDoc = contractData?.tenantDocument;

if (!tenantDoc || !tenantDoc.available) {
  // State: Contract is being prepared
  return <Text>Contract is being prepared.</Text>;
}

if (tenantDoc.type === 'generated_draft') {
  // State: Generated Draft — For Signing
  return (
    <View>
      <Badge text="Generated Draft — For Signing" color="amber" />
      <Button 
        title="View Contract PDF" 
        onPress={() => openPdfViewer(`${API_BASE_URL}${tenantDoc.viewUrl}`)} 
      />
      <Button 
        title="Download Contract PDF" 
        onPress={() => downloadPdfFile(`${API_BASE_URL}${tenantDoc.downloadUrl}`)} 
      />
    </View>
  );
}

if (tenantDoc.type === 'final_notarized') {
  // State: Final Notarized Contract
  return (
    <View>
      <Badge text="Final Notarized Contract" color="emerald" />
      <Button 
        title="View Final Contract" 
        onPress={() => openPdfViewer(`${API_BASE_URL}${tenantDoc.viewUrl}`)} 
      />
      <Button 
        title="Download Final Contract" 
        onPress={() => downloadPdfFile(`${API_BASE_URL}${tenantDoc.downloadUrl}`)} 
      />
    </View>
  );
}
```

---

### B. Streaming / Downloading the PDF Binary

When fetching or downloading the PDF binary (for PDF viewers like `react-native-pdf` or `expo-file-system`):

```javascript
import * as FileSystem from 'expo-file-system';

async function downloadContractPdf(relativeUrl, targetFileName) {
  const fileUri = `${FileSystem.documentDirectory}${targetFileName}`;
  const fullUrl = `${API_BASE_URL}${relativeUrl}`;

  const downloadRes = await FileSystem.downloadAsync(
    fullUrl,
    fileUri,
    {
      headers: {
        Authorization: `Bearer ${userSessionToken}`,
      },
    }
  );

  return downloadRes.uri;
}
```

---

## 5. Summary of Error Handling & Status Codes

| HTTP Status | Error Code / Cause | Mobile Handling |
| :--- | :--- | :--- |
| `200 OK` | Document available | Render View/Download actions and load PDF binary. |
| `401 Unauthorized` | `TOKEN_EXPIRED` or invalid session | Redirect to mobile login screen. |
| `404 Not Found` | `PREPARED_DOCUMENT_UNAVAILABLE` / `CONTRACT_NOT_FOUND` | Display *"Contract is being prepared."* placeholder with no download button. |
| `503 Service Unavailable` | Storage temporarily unreachable | Show friendly retry dialog: *"Unable to load document at this time. Please try again."* |
