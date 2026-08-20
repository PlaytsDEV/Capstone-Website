# Lilycrest DMS — Contract Generation & Lifecycle Architecture

> **Note:** For the current canonical web/mobile document-resolution and
> finality rules (including the wet-signed-is-final-on-upload rule), see
> [`docs/CONTRACT_CANONICAL_WEB_MOBILE_WORKFLOW.md`](./CONTRACT_CANONICAL_WEB_MOBILE_WORKFLOW.md).
> This document's §4–5 narrative (18-point publication gate as the only path
> to tenant visibility) predates that change and is retained here only for
> the PDF-generation-engine background in §2–3.

## 1. Executive Summary & Architecture Overview

The Contract Management & Generation Subsystem in **Lilycrest Dormitory Management System (Lilycrest DMS)** is an enterprise-grade legal document engine designed to manage the entire lifecycle of tenant lease contracts. It bridges operational dormitory events (such as reservations, check-ins, room transfers, and renewals) with legally binding lease agreements formatted to strict Philippine lease standards.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CONTRACT LIFECYCLE PIPELINE                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
   [ Reservation Approved / Move-In / Transfer / Admin Draft ]
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 1. Data Aggregation & Pre-Generation Validation        │
   │    • Identity & Age (>= 18) verification               │
   │    • Room branch & type compatibility check            │
   │    • Mathematical pricing balance & deposit audit      │
   │    • Official master template matching                 │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 2. Dual PDF Generation Engine                          │
   │    • Mode A: High-Precision pdf-lib Overlay Engine     │
   │      - SHA-256 master template verification            │
   │      - Dynamic text fitting & paragraph flow           │
   │      - Protected legal text collision guard            │
   │    • Mode B: Headless Chromium HTML-to-PDF Engine      │
   │      - Semantic HTML5 & responsive legal styling       │
   │      - Deterministic SVG QR Code generation            │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 3. Secure Private Storage & Versioning                 │
   │    • SHA-256 content hashing & page count indexing     │
   │    • Encapsulated filesystem storage hierarchy         │
   │    • Version immutability & audit logging              │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 4. Physical Signing & Notarization Workflow            │
   │    • Multi-party signing progress (Tenant, Lessor, Wit)│
   │    • High-resolution scan upload (PDF, JPEG, PNG)      │
   │    • Notarial registry details (Doc/Page/Book/Series)  │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 5. 18-Point Publication Quality Gate                   │
   │    • Strict checklist confirmation                     │
   │    • Transition to tenant-visible "Published" state    │
   │    • Digital Stay Proof & Public QR Verification       │
   └────────────────────────────────────────────────────────┘
```

---

## 2. Core Data Models & Database Schemas

The contract subsystem is anchored primarily by the [`Contract`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/models/Contract.js) model, supported by [`ContractCounter`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/models/ContractCounter.js), [`Reservation`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/models/Reservation.js), [`Stay`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/models/Stay.js), [`Room`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/models/Room.js), and [`User`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/models/User.js).

### 2.1 The Contract State Machine

The contract schema defines 23 distinct lifecycle statuses:

```
[ draft / incomplete ] ──► [ ready_for_generation ] ──► [ generated ]
                                                            │
                                                            ▼
                                                [ awaiting_signatures ]
                                                            │
                                                            ▼
                                                [ partially_signed ]
                                                            │
                                                            ▼
                                                        [ signed ]
                                                            │
                                                            ▼
                                                [ awaiting_notarization ]
                                                            │
                                                            ▼
                                                       [ notarized ]
                                                            │
                                                            ▼
                                                [ ready_for_publication ]
                                                            │
                                                            ▼
                                                       [ published ]
                                                            │
                                                            ▼
                                                        [ active ]
                                                            │
                            ┌───────────────────────────────┴───────────────────────────────┐
                            ▼                                                               ▼
                     [ expiring_soon ]                                       [ transfer_review_required ]
                            │                                                               │
                            ▼                                                               ▼
                       [ expired ] ──► [ renewed ]                                    [ replaced ]
                            │
                            ▼
                [ terminated / cancelled / archived / voided ]
```

### 2.2 Sub-Document Schemas

1. **`preparedDocuments` Array**:
   - `version` (Number, incremental $1, 2, \dots$)
   - `storageProvider` (`local` | `firebase-storage`)
   - `storageKey` (Path string relative to storage root)
   - `fileHash` (SHA-256 digest of rendered PDF)
   - `fileSize` (Bytes)
   - `pageCount` (Total pages)
   - `generatedAt`, `generatedBy`
   - `templateId`, `templateVersion`, `coordinateVersion`
   - `generationSnapshot` (Complete immutable record of all parameters used during rendering)
   - `renderMetadata` (Exact font sizes, bounding boxes, and word-wrap calculations)
   - `superseded` (Boolean flag)

2. **`signedDocuments` Array**:
   - Stores uploaded scanned physical signed agreements.
   - Captures `preparedDocumentVersion`, `fileHash`, `mimeType`, `uploadedBy`, and verification/rejection notes.

3. **`notarizedDocuments` Array**:
   - Captures notary public metadata: `notaryName`, `notaryOffice`, `notarizationPlace`, `documentNumber`, `pageNumber`, `bookNumber`, `seriesYear`.

4. **`finalDocument` Object**:
   - The immutable published master contract record visible to the resident tenant.

---

## 3. Template Architecture & Master Registry

Lilycrest DMS operates with **6 official master contract templates** stored under [`server/private/contract-templates/v1/`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/private/contract-templates/v1/).

### 3.1 Official Template Registry

The registry is configured in [`server/config/contractTemplateRegistry.js`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/config/contractTemplateRegistry.js):

| Template ID | Target Room Type | Lease Type | Duration Range | Source Master PDF File | SHA-256 Integrity Hash |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `private-short-term` | Private Room | Short Term | $1 \le \text{months} < 6$ | `Lease_Private_Room_ShortTerm.pdf` | `54e85d044c0c4edf...` |
| `private-long-term` | Private Room | Long Term | $\ge 6\text{ months}$ | `Lease_Private_Room_LongTerm.pdf` | `161561dd9e96a2ed...` |
| `double-sharing-short-term` | Double Sharing | Short Term | $1 \le \text{months} < 6$ | `Lease_Double_Sharing_ShortTerm.pdf` | `c73adb1ed4a903ba...` |
| `double-sharing-long-term` | Double Sharing | Long Term | $\ge 6\text{ months}$ | `Lease_Double_Sharing_LongTerm.pdf` | `6a17fda7a55d2419...` |
| `quadruple-sharing-short-term` | Quadruple Sharing | Short Term | $1 \le \text{months} < 6$ | `Lease_Quadruple_Sharing_ShortTerm.pdf` | `68d69696bd90ce7a...` |
| `quadruple-sharing-long-term` | Quadruple Sharing | Long Term | $\ge 6\text{ months}$ | `Lease_Quadruple_Sharing_LongTerm.pdf` | `d28a4b521f3a467a...` |

### 3.2 Automated Template Resolution Logic

The template resolver (`resolveContractTemplate`) automatically determines the correct master template using:
1. **Branch-specific Room Type normalization**: Validates that the branch (`guadalupe` vs `gil-puyat`) supports the specified room configuration.
2. **Lease Duration validation**: Compares `leaseStartDate` and `leaseEndDate` to confirm a whole number of calendar months. If duration $< 6\text{ months}$, it mandates `short-term`; if $\ge 6\text{ months}$, it mandates `long-term`.

---

## 4. Contract Generation Trigger Mechanisms

Contracts are created and generated through both **autonomous system triggers** and **manual administrative actions**:

### 4.1 Autonomous Move-In Orchestration (`autoGenerateMoveInContract`)
- **Trigger**: When an admin confirms a tenant's physical check-in / Move-In.
- **Service**: [`autoContractOrchestratorService.js`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/services/autoContractOrchestratorService.js).
- **Execution Flow**:
  1. Checks for existing draft or active contract for the reservation.
  2. If none exists, creates a fresh draft contract linked to the reservation and stay.
  3. Executes `validateContractForGeneration`.
  4. If validation succeeds, transitions status to `ready_for_generation` and executes `generatePreparedContractPdf`.
  5. Dispatches real-time WebSocket notifications to branch administrators (`contract_prepared`).
  6. If validation fails (e.g., missing tenant birthdate), flags contract as `incomplete` and notifies administrators (`contract_incomplete`).

### 4.2 Room Transfer Orchestration (`autoGenerateTransferContract`)
- **Trigger**: Tenant completes a room transfer workflow (`transferStayWorkflow`).
- **Execution Flow**:
  1. Locates the previous `isCurrent: true` contract.
  2. Atomically marks the old contract as `supersededByContractId` and updates status to `replaced`.
  3. Creates a new replacement contract pointing to the target room and bed.
  4. Recalculates pro-rata pricing, advance rent, and security deposit transfer credits.
  5. Auto-validates and generates the new prepared PDF contract.

### 4.3 Administrative Manual Generation
- Admins can create drafts, review pricing, validate prerequisites, and trigger generation directly from the **Admin Contracts Workspace** (`/admin/contracts`).

---

## 5. Pre-Generation Data Assembly & Validation Pipeline

Before any PDF is rendered, [`contractGenerationDataService.js`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/services/contractGenerationDataService.js) and [`contractService.js`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/services/contractService.js) perform strict data aggregation and cross-record integrity checks:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                     PRE-GENERATION VALIDATION CHECKS                      │
├───────────────────────────────────────────────────────────────────────────┤
│ 1. Identity Guard: Tenant must be >= 18 years old at contract execution.  │
│ 2. Address & Name Guard: Full legal name & residential address present.   │
│ 3. Room Compatibility: Assigned room branch & room type match template.   │
│ 4. Lease Duration Integrity: End date strictly after start date (whole m).│
│ 5. Pricing Reconciliation:                                                │
│    • Regular Monthly Rate >= Approved Monthly Rate                        │
│    • Approved Monthly Rate = Regular Rate - Discount Amount               │
│    • Advance Rent Amount & Security Deposit Amount verified               │
│    • Reservation Fee credit correctly applied                             │
│ 6. Template Checksum: Master PDF sha256 hash verified against registry.   │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Deep Dive: PDF Rendering Engines

Lilycrest DMS incorporates two specialized rendering pipelines:

### 6.1 Engine 1: High-Precision Fixed-Coordinate Overlay (`pdf-lib`)
This engine takes the official master PDF and overlays dynamic values onto precise typographic coordinates:

1. **Master Inspection & Integrity Check**:
   - Reads `sourceFilePath` from disk.
   - Calculates SHA-256 hash and verifies matching checksum.
   - Asserts page count (must match template) and page dimensions ($8.5 \times 13\text{ inches}$ Legal size).
2. **Font Embedding**:
   - Embeds standard Adobe Type 1 fonts: `Times-Roman` and `Times-Bold`.
3. **Region Erasing**:
   - `eraseLayoutRegion()` draws crisp white rectangles over template blank underlines or placeholder fields prior to drawing text.
4. **Dynamic Paragraph Flow & Text Shrinking Engine**:
   - Built via [`contractPdfTextService.js`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/services/contractPdfTextService.js).
   - Dynamically wraps composite legal paragraphs (e.g., *Tenant Identity Clause* and *Section 4 Deposit Clause*).
   - If text exceeds available width, it iteratively reduces font size from `preferredFontSize` down to `minimumFontSize`.
   - If text still cannot fit within maximum allowed lines, throws explicit error (`TENANT_NAME_TOO_LONG_FOR_TEMPLATE`, `TENANT_ADDRESS_TOO_LONG_FOR_TEMPLATE`).
5. **Protected Legal Text Collision Guard**:
   - `assertContractFieldsAvoidLegalText()` calculates bounding box intersections between all dynamic overlay fields and protected static legal text regions.
   - Guarantees dynamic data never overlaps or obscures official legal clauses.
6. **Watermarking & Draft Marking**:
   - Stamps official `PREPARED COPY — FOR SIGNING` identifier on unfinalized documents.

### 6.2 Engine 2: Headless Chromium HTML-to-PDF (`playwright-core`)
Used for dynamic layouts (such as `quadruple-sharing-short-term` and `DigitalStayProofService`):

1. **Semantic HTML5 Assembly**:
   - Generated via [`contractHtmlPdfService.js`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/services/contractHtmlPdfService.js).
   - Uses strict Times New Roman typography, 1.5 line height, justified paragraph formatting, and exact $8.5 \times 13\text{ in}$ print styling (`@page { size: 8.5in 13in; margin: 1in; }`).
2. **Token Safety Guard**:
   - `assertNoOversizedToken()` prevents single unbroken strings longer than 60 characters from breaking print margins.
3. **Chromium Vector Rendering**:
   - Launches headless browser instance via [`contractChromiumService.js`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/services/contractChromiumService.js).
   - Waits for `networkidle` state and font loading before executing `page.pdf({ format: 'Legal', printBackground: true })`.
4. **Deterministic SVG QR Code Engine**:
   - Generates crisp vector QR codes for instant digital verification of tenant stays.

---

## 7. Storage, Security & Document Streaming Architecture

### 7.1 Encapsulated Storage Hierarchy
All contract files are stored outside the public web root in `server/private/`:

```
server/private/
├── contract-templates/v1/         # Read-only official master PDF templates
├── generated-contracts/           # Generated prepared PDFs
│   └── [branch]/[year]/[contractNumber]/
│       └── [contractNumber]_prepared_v[version].pdf
├── signed-contracts/              # Uploaded signed physical copies
│   └── [branch]/[year]/[contractNumber]/
│       └── [contractNumber]_signed_v[version].[pdf|jpg|png]
└── notarized-contracts/           # Uploaded notarized copies
    └── [branch]/[year]/[contractNumber]/
        └── [contractNumber]_notarized_v[version].[pdf|jpg|png]
```

### 7.2 Security & Access Controls
- **Zero Public Direct Links**: Contract documents cannot be accessed via static URL paths.
- **RBAC & Branch Filtering**: Every document stream request enforces `verifyToken`, `verifyAdmin`, `filterByBranch`, and `requirePermission("manageTenants")`.
- **Tenant Ownership Guard**: Tenant endpoints (`/api/contracts/my/...`) strictly verify that the requesting user's `_id` matches `contract.tenantId`.
- **Audit Logging**: Every view, preview, download, upload, or verification event is recorded in the immutable database audit log.

---

## 8. Physical Signing, Notarization & Publication Workflow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      SIGNING & PUBLICATION LIFECYCLE STEPS                       │
└──────────────────────────────────────────────────────────────────────────────────┘
  1. Print Contract:
     Admin marks contract as printed ──► status: "awaiting_signatures"
  
  2. Signature Progress:
     Admin tracks individual signature acquisition:
     • Tenant Signature (pending / completed)
     • Lessor Representative Signature (pending / completed)
     • Witness Signatures (pending / completed / not_required)
     ──► status transitions to "partially_signed" or "signed"

  3. Scanned Copy Upload & Verification:
     Admin uploads scanned signed contract (PDF/JPG/PNG <= 10MB).
     System validates magic bytes, computes SHA-256 hash, and stores document version.
     Admin performs verification review.

  4. Notarization Entry:
     Admin uploads notarized scan and records legal details:
     • Notary Public Name & Office
     • Doc No., Page No., Book No., Series Year
     ──► status transitions to "notarized"

  5. 18-Point Publication Quality Gate:
     Admin confirms all 18 publication checklist keys before publishing:
     [✓] contractNumberMatches              [✓] acknowledgmentCompleted
     [✓] tenantLegalNameMatches             [✓] notarySignatureVisible
     [✓] branchMatches                      [✓] notarialSealVisible
     [✓] assignmentMatches                  [✓] allPagesPresent
     [✓] leaseDatesMatch                    [✓] scanReadable
     [✓] currentPreparedVersionMatches      [✓] noPageCropped
     [✓] verifiedNotarizedVersionSelected   [✓] legalWordingUnchanged
     [✓] wetSignaturesVisible               [✓] noRejectedOrSupersededVersion
     [✓] tenantSecureAccessConfirmed        [✓] finalDocumentImmutabilityConfirmed
     ──► status transitions to "published" (tenantVisible: true)
```

---

## 9. Frontend Presentation & Tenant Portal Integration

### 9.1 Tenant Portal View ([`ContractsPage.jsx`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/tenant/pages/ContractsPage.jsx) & [`DigitalContractPaper.jsx`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/tenant/components/contracts/DigitalContractPaper.jsx))
- **Digital Contract Paper**: Renders a 1:1 responsive legal document mirroring the official lease agreement.
- **Side-by-Side Verification**: Tenants can view the digital legal text alongside the scanned signed/notarized document.
- **Interactive Controls**: Deep zoom ($50\% - 200\%$), panning, rotation ($90^\circ$ steps), and full-screen inspection modal.
- **Digital Stay Proof**: Instant download of verified PDF proof of stay equipped with security verification QR codes.

### 9.2 Admin Contracts Workspace ([`AdminContractsPage.jsx`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/admin/pages/AdminContractsPage.jsx))
- **Status Filtering Tabs**: Categorized by pipeline stage (`Needs Attention`, `Ready to Generate`, `Prepared`, `Pending Signing`, `Pending Notarization`, `Published`, `Active`, `Closed`).
- **Comprehensive Drawer**: Inspects all versioned documents, pricing breakdown, audit timelines, and signature states.

---

## 10. API Route Reference

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/contracts` | Admin | Creates a new draft contract for a reservation/stay |
| `GET` | `/api/contracts` | Admin | Lists contracts with status and branch filtering |
| `GET` | `/api/contracts/:id` | Admin | Retrieves comprehensive contract details & document availability |
| `POST` | `/api/contracts/:id/validate` | Admin | Validates contract data against official template requirements |
| `GET` | `/api/contracts/:id/generation-preview` | Admin | Returns computed dynamic fields for preview before rendering |
| `POST` | `/api/contracts/:id/generate` | Admin | Renders and stores the prepared contract PDF |
| `GET` | `/api/contracts/:id/documents/prepared/:version?` | Admin | Securely streams prepared contract PDF |
| `POST` | `/api/contracts/:id/mark-printed` | Admin | Marks contract as printed for physical signing |
| `POST` | `/api/contracts/:id/signatures/:signer` | Admin | Updates signature status for tenant, lessor, or witnesses |
| `POST` | `/api/contracts/:id/documents/signed` | Admin | Uploads scanned signed copy (multipart/form-data) |
| `POST` | `/api/contracts/:id/documents/signed/verify` | Admin | Verifies uploaded signed copy |
| `POST` | `/api/contracts/:id/documents/notarized` | Admin | Uploads notarized copy with legal registry details |
| `POST` | `/api/contracts/:id/documents/notarized/verify` | Admin | Verifies notarized copy |
| `POST` | `/api/contracts/:id/ready-for-publication` | Admin | Marks contract ready for publication review |
| `POST` | `/api/contracts/:id/publish` | Admin | Executes 18-point checklist and publishes contract |
| `GET` | `/api/contracts/:id/documents/final` | Admin | Streams immutable published master contract |
| `GET` | `/api/contracts/my/current` | Tenant | Retrieves tenant's canonical current contract |
| `GET` | `/api/contracts/my/history` | Tenant | Retrieves tenant's historical contracts |
| `GET` | `/api/contracts/my/stay-proof` | Tenant | Generates and downloads digital stay proof PDF |
| `GET` | `/api/contracts/verify/:referenceId` | Public | Public QR verification endpoint for active leases |

---

## 11. Summary of Key Guarantees & Safeguards

1. **Atomic Branch Sequencing**: Contract numbers are guaranteed monotonic and collision-free per branch and calendar year.
2. **Template File Integrity**: System verifies cryptographic SHA-256 hashes of master templates before any generation attempt.
3. **No Overlapping Legal Text**: The paragraph flow engine dynamically calculates text metrics, adjusting font sizes and guaranteeing zero collision with static legal clauses.
4. **Strict Immutability**: Once a contract reaches `published` status, it cannot be modified; any room transfer or lease amendment requires generating a formal replacement contract.
5. **Defense-in-Depth Validation**: Data prerequisites are validated across controller, service, and rendering layers before document compilation.
