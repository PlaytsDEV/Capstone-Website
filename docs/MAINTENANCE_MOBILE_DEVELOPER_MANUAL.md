# LilyCrest Residences — Maintenance Module
## Mobile Flow Developer Manual & Implementation Guide

**Document Metadata**
- **System:** LilyCrest Residences
- **Module:** Maintenance
- **Primary Mobile User:** Tenant
- **Document Version:** 1.0
- **Date:** August 2026

---

### Core Architectural Principle
> **The tenant reports and tracks the problem in the mobile app.**  
> **The admin controls provider assignment, external service contacts, AI suggestions, internal notes, completion approval, and analytics.**

---

## 1. Purpose, Scope & High-Level Architecture

This manual defines the technical and functional specifications for the Maintenance module across the **LilyCrest Tenant Mobile Application** and the **Admin Back-Office Platform**. The architecture strictly isolates operational complexity and administrative data from the tenant interface while ensuring seamless communication, transparent tracking, and automated reporting.

### 1.1 Role-Based Access Control (RBAC) Overview

| Role | Main Responsibility | Access Level |
| :--- | :--- | :--- |
| **Tenant** | Report issues, attach photos, track real-time progress, reply to thread updates, view finalized completion reports, and confirm issue resolution (or reopen). | Mobile tenant-scoped features only. Strictly restricted to own tenancy records. |
| **Admin / Authorized Staff** | Review incoming requests, assign in-house staff or external service contractors, manage vendor contact/quotes, post updates/evidence, generate/edit AI reports, finalize completion, and analyze performance. | Full operational and administrative access scoped by branch/property permissions. |
| **LilyCrest Maintenance Staff** | Execute assigned in-house repair tasks, submit work logs, and upload completion proof. | Assigned operational data and task execution permissions only. |
| **External Service Provider** | Fulfill specialized or high-complexity maintenance work exceeding in-house capacity. | No tenant portal account required (handled externally by Admin). |

### 1.2 End-to-End Workflow Pipeline

```text
[1. Tenant Submits Request]
           │
           ▼
[2. Admin Reviews Request]
           │
           ▼
[3. Admin Selects Handling Strategy] ◄── [AI Provider Suggestion (Optional Assist)]
           │
           ▼
[4. Provider Assigned (In-House / External)]
           │
           ▼
[5. Repair Scheduled / Work Started]
           │
           ▼
[6. Admin Posts Progress Updates & Tenant-Safe Proof] ◄──► [Tenant Replies in Thread]
           │
           ▼
[7. Work Completed on Site]
           │
           ▼
[8. AI Generates Draft Completion Report]
           │
           ▼
[9. Admin Edits, Approves & Finalizes Report]
           │
           ▼
[10. Tenant Views Report & Confirms Resolution]
           │
     ┌─────┴────────────────────────┐
     ▼                              ▼
[Resolved -> Archived]     [Unresolved -> Reopened]
                                    │
                                    ▼
[11. Comprehensive Data Feeds Maintenance Analytics & Preventive Planning]
```

### 1.3 Strict Architectural Boundary: Tenant vs. Admin

- **Tenant Mobile App:**
  - Submit requests with rich media.
  - Track live tenant-safe statuses.
  - Interactive two-way ticket messaging.
  - View sanitized provider indicators (e.g., *"LilyCrest In-House Staff"* or *"External Specialist Assigned"*).
  - Review official, finalized completion reports.
  - **Constraint:** Tenants MUST NOT select providers, view commercial vendor terms, or access administrative diagnostics.
- **Admin Platform:**
  - Triage queue and direct vendor assignment.
  - Full vendor CRM, dispatch, and quote management.
  - Private operational logs and internal note threading.
  - AI prompt orchestration and output review.
  - Completion verification and multi-branch analytics engine.

---

## 2. Tenant Mobile Flow & UI Specifications

### 2.1 Maintenance Home View
The mobile entry view presents an uncluttered, actionable dashboard containing:
- **Dashboard Metric Badges:** Quick counts (e.g., `"1 Active Request"`, `"4 Completed Requests"`).
- **Active Requests List:** Displays all records in `Pending Review`, `Provider Assigned`, `Scheduled`, `In Progress`, or `Reopened` status.
- **Completed / History List:** Displays finalized tickets with instant links to their signed/finalized completion reports.
- **Call-to-Action (CTA):** Primary Floating Action Button (FAB) or prominent button: `+ Report an Issue`.

> ⚠️ **Security & UI Constraint:** Never expose admin analytics (fault frequency percentages, contractor ratings, vendor costs, raw AI output, or branch-wide performance) within the mobile tenant interface.

---

### 2.2 Maintenance Request Submission Flow

```text
┌─────────────────────────────────────────────────────────┐
│               Submit Maintenance Request                │
├─────────────────────────────────────────────────────────┤
│ Category*        [ Select: Plumbing / Electrical...  ▼ ]│
│ Urgency*         ( ) Normal   ( ) Urgent   ( ) Emergency│
│ Room Context     Unit 402 - Bed A (Auto-populated)      │
│ Description*     [ Water leaking under bathroom sink... ]│
│ Attachments      [ 📷 Add Photos (Max 5, JPG/PNG)       ]│
│                                                         │
│                  [   Submit Request   ]                 │
└─────────────────────────────────────────────────────────┘
```

#### Field Validation Rules

| Field | Input Type | Validation & Business Logic |
| :--- | :--- | :--- |
| **Category** | Dropdown / Picker | **Required.** Standard options: `Plumbing`, `Electrical`, `Elevator`, `Air-conditioning`, `Furniture/Fixture`, `Internet/Network`, `Other`. |
| **Description** | Multiline Text Area | **Required.** Minimum 10 characters; trim whitespace; sanitize input against injection attacks. |
| **Urgency** | Radio / Segmented Control | **Required.** Enum: `NORMAL`, `URGENT`, `EMERGENCY`. Emergency selections may trigger automated priority routing. |
| **Context** | Read-Only Badge | **Auto-Populated.** Fetched automatically from active lease/occupancy token (`branchId`, `unitNumber`, `bedId`). |
| **Photos / Proof** | File Picker / Camera | **Optional.** Enforce client-side image compression, allowed MIME types (`image/jpeg`, `image/png`, `image/webp`), max 5 files, 10MB per file limit. |

**Post-Submission Action:** On successful HTTP `201 Created`, the system initializes the record with status `PENDING_REVIEW` and redirects the user immediately to the **Request Detail Screen** with an affirmative toast notification.

---

## 3. Lifecycle States, Detail View & Communication Thread

### 3.1 Lifecycle Status Matrix

| Status Enum | Tenant-Facing Label | Meaning & UI Behavior | Developer Implementation Rule |
| :--- | :--- | :--- | :--- |
| `PENDING_REVIEW` | Pending Review | Request logged; awaiting admin triage. | Default initial state upon submission. |
| `PROVIDER_ASSIGNED` | Provider Assigned | Admin assigned in-house staff or external team. | Render tenant-safe label (`tenantVisibleProviderLabel`). |
| `SCHEDULED` | Scheduled | Work slot or contractor visit confirmed. | Display date/time badge and scheduling notes. |
| `IN_PROGRESS` | In Progress | Technicians are actively working on-site. | Allow ongoing admin progress posts and safe media uploads. |
| `COMPLETED` | Completed | Work finished and verified by admin. | Expose finalized report download/viewing modal. |
| `REOPENED` | Reopened | Tenant reported recurring issue post-fix. | Retain complete audit trail, message history, and past reports. |
| `CANCELLED` | Cancelled | Ticket voided (with mandatory reason). | Lock thread; show cancellation reason modal. |

---

### 3.2 Request Detail View Elements
1. **Ticket Header:** Request Code (e.g., `#MNT-2026-0841`), Category Icon, Urgency Pill, Submission Timestamp.
2. **Current Status Banner:** Visual step tracker highlighting current progress.
3. **Assignment Summary:** Displays generic provider label (e.g., *"LilyCrest Facilities Team"* or *"Authorized AC Specialist"*).
4. **Schedule Card:** Displayed when work date/time window is populated.
5. **Timeline & Message Thread:** Combined audit events and two-way updates.
6. **Final Completion Report Banner:** Rendered once the status reaches `COMPLETED`.

> 🔒 **Tenant Data Privacy Guardrail:** Under no circumstances should APIs serving the mobile client expose:
> - Contractor personal phone numbers, emails, or company contracts.
> - Quoted costs, invoices, or hourly labor rates.
> - Internal admin notes and supervisor flags.
> - Raw AI prompt context, embeddings, or intermediate model outputs.

---

### 3.3 Two-Way Ticket Communication Thread
Rather than isolating communications in a disconnected live-chat system, all messaging occurs within the context of the specific maintenance record:
- **Admin Capabilities:** Post progress updates, revised arrival times, tenant-visible photo proof of ongoing work, and operational inquiries.
- **Tenant Capabilities:** Reply with entry permission authorizations, access instructions, or issue clarifications.
- **Message Payload Schema:** Each entry must contain `messageId`, `requestId`, `senderId`, `senderRole` (`TENANT` | `ADMIN` | `STAFF`), `content`, `attachments[]`, `isInternalOnly` (boolean), and `createdAt`.
- **Filtering Engine:** The mobile API gateway must strictly filter out any record where `isInternalOnly == true`.

---

## 4. Provider Assignment Architecture & Data Isolation

```text
                       ┌──────────────────────────────┐
                       │  Admin Triage & Assignment   │
                       └──────────────┬───────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
   [ Option A: In-House Staff ]                    [ Option B: External Vendor ]
   • Internal Maintenance Crew                     • Complex / Specialized repairs
   • Direct Task Dispatch                          • Admin contacts vendor off-platform
   • Mobile displays: "LilyCrest Staff"            • Mobile displays: "External Specialist"
                                                   • Private: Quotation, Billing, Direct Contact
```

### 4.1 Dispatch Routing Models
1. **Option A — LilyCrest Maintenance Staff (In-House):**
   - Dispatched for standard repairs, filter replacements, routine carpentry, and electrical fixes.
   - Assigned directly via internal staff user IDs.
2. **Option B — External Service Provider:**
   - Dispatched for heavy structural work, certified elevator maintenance, complex HVAC overhauls, or hazardous tasks.
   - Admin manages commercial negotiations, rates, and external dispatching.

### 4.2 Data Protection & Snapshotting Rules
- **Snapshot Retention:** If an external vendor is archived or deleted from the global vendor master catalog, the maintenance ticket must retain an immutable historical snapshot (`providerSnapshotJson`) containing the contact and cost data as it existed at the time of execution.
- **Sanitized Public Alias:** Always serialize a computed property `tenantVisibleProviderLabel` (e.g., *"Certified Aircon Technician"*) for tenant consumption.

---

## 5. AI Integration Specifications

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                             AI Service Layer                               │
├────────────────────────────────────────────────────────────────────────────┤
│ 1. AI Provider Recommendation (Admin Triage Assist)                        │
│    • Ingests: Category + User Description + Property Context               │
│    • Outputs: Trade classification, recommended tools, required questions   │
│    • Safety: Recommendation ONLY — requires human manual assignment.       │
├────────────────────────────────────────────────────────────────────────────┤
│ 2. AI Completion Report Synthesizer                                        │
│    • Ingests: Initial ticket, activity logs, technician notes, photo proof  │
│    • Outputs: Structured Draft Report (Summary, Work Done, Follow-up)      │
│    • Safety: Marked DRAFT until Admin verifies, edits, and signs off.      │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 AI Provider Recommendation (Admin-Facing Only)
- **Functionality:** Ingests issue description and image tags to classify the required specialization (e.g., Master Plumber, Level 2 Electrician) and generate diagnostic questions for the admin to ask the technician.
- **Strict Guardrail:** AI never executes automated vendor booking, dispatching, contracting, or funds disbursement. All actions require explicit human admin confirmation.

### 5.2 AI Automated Completion Report Synthesis
When work concludes, the system compiles ticket artifacts to draft a formal report:
- **Input Parameters:** Ticket category, initial complaint, diagnostic timeline, technician notes, before/after media metadata, and completion timestamps.
- **Generated Report Sections:**
  1. *Executive Issue Summary*
  2. *Timeline & Intervention Milestones*
  3. *Technical Work Performed & Parts Replaced*
  4. *Evidence & Verification Record*
  5. *Preventive Maintenance Advice / Follow-up Recommendations*
- **Finalization Workflow:** The generated report is saved as `isDraft = true`. The admin reviews, amends, and clicks **Finalize Report**, which sets `isDraft = false`, assigns a cryptographic hash/version ID, and makes the report visible to the tenant.

---

## 6. Completion Validation & Tenant Resolution Loop

### 6.1 Admin Completion Protocol
To transition a ticket to `COMPLETED`, the system enforces the following constraints:
1. **Resolution Notes Required:** Detailed notes on actions taken must be present.
2. **Proof of Work Validation:** If branch policy requires visual evidence, at least one tenant-safe completion photo must be attached.
3. **Audit Immutability:** The finalization action locks the completion report and records `completedByUserId` and `completedAt`.

### 6.2 Tenant Feedback & Reopening Mechanics
Once a ticket is marked `COMPLETED`, the tenant app displays an interactive prompt:

```text
┌─────────────────────────────────────────────────────────┐
│              Was your issue resolved?                   │
│                                                         │
│        [  ✓ Yes, Resolved  ]     [  ✗ No, Issue Remains ]│
└─────────────────────────────────────────────────────────┘
```

- **If "Yes, Resolved":** Ticket transitions to read-only archive in `Completed / History`.
- **If "No, Issue Remains":**
  - Ticket transitions directly to `REOPENED`.
  - Increments `reopenCount`.
  - Preserves entire historical thread, previous completion reports, uploaded media, and vendor assignments.
  - Generates immediate high-priority triage notification for admin staff.
  - **Developer Rule:** Never spawn a disconnected duplicate ticket; keep the continuous lifecycle under the same `requestId`.

---

## 7. Business Intelligence, Analytics & Preventive Maintenance

Admin dashboards compute real-time operational metrics across branches to drive preventive maintenance.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                    Admin Maintenance Intelligence View                     │
├────────────────────────────────────────────────────────────────────────────┤
│ Category Distribution:                                                     │
│ █ Elevator (32%) ──► Action: Schedule quarterly motor overhaul             │
│ █ Plumbing (24%) ──► Action: Check main risers & pressure valves           │
│ █ Electrical (18%) ─► Action: Inspect sub-breakers & common area lighting  │
│ █ Others (26%)                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│ Key Performance Indicators:                                                │
│ • Mean Time to First Action (MTTFA)  • Mean Time to Resolution (MTTR)     │
│ • In-House vs. Vendor Ratio          • Ticket Reopen / Recidivism Rate     │
└────────────────────────────────────────────────────────────────────────────┘
```

### Key Analytics Metrics Schema
- **Category Share (%):** `(Count(Category) / TotalRequests) * 100`.
- **Mean Time to First Action (MTTFA):** `Avg(assignedAt - createdAt)`.
- **Mean Time to Resolution (MTTR):** `Avg(completedAt - createdAt)`.
- **Reopen Rate (%):** `(Count(reopenCount > 0) / TotalCompletedRequests) * 100`.
- **Data Isolation:** All aggregate queries must enforce hard tenant/branch tenancy boundaries (`WHERE branch_id = :currentBranchId`).

---

## 8. Push & In-App Notification Trigger Matrix

| Event Trigger | Recipient | Notification Channel | Payload / Display Title |
| :--- | :--- | :--- | :--- |
| `REQUEST_CREATED` | Tenant | Push + In-App | *"Request Received: We have logged your request #MNT-XXXX."* |
| `PROVIDER_ASSIGNED` | Tenant | Push + In-App | *"Update: A technician has been assigned to your issue."* |
| `WORK_SCHEDULED` | Tenant | Push + In-App | *"Service Scheduled: Repair planned for [Date/Time]."* |
| `ADMIN_MESSAGE` | Tenant | Push + In-App | *"New Message: LilyCrest staff added a note to your request."* |
| `WORK_COMPLETED` | Tenant | Push + In-App | *"Maintenance Completed: Please review the work summary."* |
| `REPORT_FINALIZED` | Tenant | Push + In-App | *"Final Report Ready: View the official completion report."* |
| `TICKET_REOPENED` | Admin / Staff | Admin Webhook / Alert | *"Priority Alert: Ticket #MNT-XXXX reopened by tenant."* |

---

## 9. Data Models & API Specifications

### 9.1 Core Entity Data Schema (`MaintenanceRequest`)

```json
{
  "requestId": "mnt_89f41a0e",
  "ticketNumber": "MNT-2026-0841",
  "tenantId": "usr_tenant_9921",
  "branchId": "brn_manila_01",
  "occupancyContext": {
    "unitNumber": "402",
    "bedNumber": "A",
    "floor": 4
  },
  "category": "AIR_CONDITIONING",
  "description": "AC unit in Room 402 leaking water and making loud rattling noise.",
  "urgency": "URGENT",
  "status": "IN_PROGRESS",
  "providerDetails": {
    "providerType": "EXTERNAL",
    "tenantVisibleLabel": "Certified HVAC Specialist",
    "internalProviderId": "vend_coolair_09",
    "privateContact": "service@coolairhvac.local / +63 917 555 0199",
    "quotedCost": 2500.00,
    "currency": "PHP"
  },
  "schedule": {
    "scheduledDate": "2026-08-16T14:00:00Z",
    "notes": "Technician arriving between 2:00 PM and 4:00 PM."
  },
  "timeline": [
    {
      "messageId": "msg_001",
      "senderId": "usr_admin_04",
      "senderRole": "ADMIN",
      "content": "Technician dispatched for site inspection.",
      "isInternalOnly": false,
      "attachments": [],
      "createdAt": "2026-08-15T19:30:00Z"
    }
  ],
  "completionReport": {
    "reportId": "rep_99120",
    "isDraft": false,
    "summary": "Replaced clogged drain line and secured fan motor mounting.",
    "finalizedBy": "usr_admin_04",
    "finalizedAt": "2026-08-16T16:30:00Z",
    "reportUrl": "https://storage.lilycrest.local/reports/rep_99120.pdf"
  },
  "reopenHistory": [],
  "createdAt": "2026-08-15T19:05:00Z",
  "updatedAt": "2026-08-15T19:30:00Z"
}
```

### 9.2 API Endpoint & Access Control Matrix

| Endpoint | Method | Allowed Roles | Description & Data Transformation |
| :--- | :--- | :--- | :--- |
| `/api/v1/tenant/maintenance` | `POST` | `TENANT` | Creates a new maintenance ticket. Sets context automatically. |
| `/api/v1/tenant/maintenance` | `GET` | `TENANT` | Lists active and past tickets owned by the authenticated tenant. |
| `/api/v1/tenant/maintenance/:id` | `GET` | `TENANT` | Retrieves sanitized ticket details and public timeline. |
| `/api/v1/tenant/maintenance/:id/messages` | `POST` | `TENANT` | Appends a tenant response message to the timeline. |
| `/api/v1/tenant/maintenance/:id/confirm` | `POST` | `TENANT` | Submits resolution confirmation or reopens the ticket. |
| `/api/v1/admin/maintenance` | `GET` | `ADMIN`, `STAFF` | Branch-filtered triage queue with filtering and sorting. |
| `/api/v1/admin/maintenance/:id/assign` | `PATCH` | `ADMIN` | Assigns in-house staff or external vendor with private metadata. |
| `/api/v1/admin/maintenance/:id/ai-assist` | `POST` | `ADMIN` | Generates diagnostic advice or drafts completion reports. |
| `/api/v1/admin/maintenance/:id/finalize` | `POST` | `ADMIN` | Validates, approves, signs, and publishes completion report. |
| `/api/v1/admin/analytics/maintenance` | `GET` | `ADMIN` | Aggregates category distribution, MTTR, and failure trends. |

---

## 10. Robustness, Edge Cases & Validation Rules

1. **Idempotent Submission & Double-Tap Prevention:**
   - Enforce an `Idempotency-Key` header on mobile `POST` requests to prevent duplicate ticket generation from network retries or rapid tapping.
2. **Network Resilience & Offline Failure Recovery:**
   - If media upload fails mid-flight, store the ticket payload locally in SQLite/Room/CoreData and present a retry queue to the tenant without losing typed descriptions.
3. **Strict Tenancy & Authorization Scoping:**
   - Mobile endpoints must ignore any client-supplied `tenantId` in the request body and strictly infer identity from the validated JWT claims.
4. **Resilience to AI Outages:**
   - All admin workflows (triage, vendor assignment, report creation) must function with standard manual input forms if the LLM microservice experiences latency or downtime.
5. **Analytics Categorization Fallback:**
   - Any ticket with an ambiguous or null category must automatically default to `OTHER` to prevent data dropping during aggregate calculation.

---

## 11. Developer Acceptance Checklist

- [ ] **Mobile Request Creation:** Tenant can submit an issue with category, description, urgency, and photos.
- [ ] **Initial State:** Newly created requests immediately transition to `Pending Review`.
- [ ] **Provider Assignment:** Admin can assign internal staff or external contractor.
- [ ] **Privacy Guardrails:** Verified that mobile responses NEVER leak vendor pricing, direct phone numbers, or private internal notes.
- [ ] **Sanitized Provider Display:** Tenant sees clean provider status without raw operational metadata.
- [ ] **Bi-Directional Messaging:** Admin and tenant can exchange messages and photos within the ticket thread.
- [ ] **Push Notification Dispatch:** Verified notifications fire on assignment, scheduling, updates, and completion.
- [ ] **Mandatory Completion Validation:** Admin cannot complete a ticket without resolution notes and required proof.
- [ ] **AI Draft Isolation:** AI drafts reports as `isDraft: true` and requires explicit admin finalization.
- [ ] **Tenant Verification Loop:** Tenant can confirm resolution or reopen the exact same ticket.
- [ ] **History Continuity on Reopen:** Reopened tickets preserve all previous messages, attachments, and past reports.
- [ ] **Multi-Branch Isolation:** Admin analytics and queries strictly isolate data by `branchId`.
- [ ] **Graceful AI Degradation:** Complete system functionality remains available when AI service is offline.
