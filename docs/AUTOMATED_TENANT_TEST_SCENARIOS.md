# Lilycrest Dormitory Management System (Lilycrest DMS)
## Automated Tenant Lifecycle Test Scenarios

### Overview
This document contains the subset of tenant lifecycle test scenarios from `TENANT_LIFECYCLE_TEST_SCENARIOS.md` that can be **strictly, 100% automated and programmatically verified** via automated Jest test suites, backend controller assertions, database transaction tests, and API contract guards.

> [!NOTE]
> Scenarios requiring manual physical human actions (such as physical brass key handover and physical room damage inspection) have been filtered out of this automation suite.

---

### Table of Contents
1. [Phase 1: Room Discovery & Pre-Reservation](#phase-1-room-discovery--pre-reservation)
2. [Phase 2: Reservation & Account Onboarding](#phase-2-reservation--account-onboarding)
3. [Phase 3: Admin Review & Deposit Verification](#phase-3-admin-review--deposit-verification)
4. [Phase 4: Contract Execution & Digital Signatures](#phase-4-contract-execution--digital-signatures)
5. [Phase 5: Resident Account & Profile Security](#phase-5-resident-account--profile-security)
6. [Phase 6: Financials, Invoicing & Utility Split Calculations](#phase-6-financials-invoicing--utility-split-calculations)
7. [Phase 7: Payment Submissions & Ledger Balance Tracking](#phase-7-payment-submissions--ledger-balance-tracking)
8. [Phase 8: Maintenance & Support Ticket Lifecycle](#phase-8-maintenance--support-ticket-lifecycle)
9. [Phase 9: Real-Time Chat & Communications](#phase-9-real-time-chat--communications)
10. [Phase 10: Announcements & Survey Participation](#phase-10-announcements--survey-participation)
11. [Phase 11: Room Transfer & Contract Renewal](#phase-11-room-transfer--contract-renewal)
12. [Phase 12: Offboarding Financial Settlement & Deposit Refund](#phase-12-offboarding-financial-settlement--deposit-refund)
13. [Phase 13: Mobile API Parity & System Guards](#phase-13-mobile-api-parity--system-guards)

---

### Automated Test Scenarios

#### Phase 1: Room Discovery & Pre-Reservation

##### Scenario 1.1: Room Search & Availability Filtering (`roomsController.test.js`)
* **Automated Check:** Execute GET `/api/rooms/available` with branch, capacity, and date parameters.
* **Target Assertions:**
  * Returns active rooms with unreserved beds.
  * Filters out occupied/reserved beds accurately.

##### Scenario 1.2: Guest Inquiry Submission (`inquiriesController.js`)
* **Automated Check:** POST `/api/inquiries` with guest details and inquiry message.
* **Target Assertions:**
  * Returns HTTP 201 with created inquiry payload.
  * Triggers guest email confirmation payload.

---

#### Phase 2: Reservation & Account Onboarding

##### Scenario 2.1: Multi-Step Room & Bed Reservation (`reservationsController.test.js`)
* **Automated Check:** POST `/api/reservations` with applicant details, bed selection, and deposit reference.
* **Target Assertions:**
  * Status set to `pending`.
  * Target bed state updated to `reserved`.

##### Scenario 2.2: Concurrent Bed Booking Conflict Lock (`reservationHelpers.test.js`)
* **Automated Check:** Run concurrent simulated booking transactions on identical Bed ID.
* **Target Assertions:**
  * First transaction succeeds; second transaction rolls back with conflict exception.

---

#### Phase 3: Admin Review & Deposit Verification

##### Scenario 3.1: Admin Reservation Approval (`reservationsController.access.test.js`)
* **Automated Check:** POST `/api/reservations/:id/approve` with admin session token.
* **Target Assertions:**
  * Reservation status transitions to `approved`.
  * Generates pending lease contract document record.

##### Scenario 3.2: Reservation Rejection & Bed Release (`reservationsController.test.js`)
* **Automated Check:** POST `/api/reservations/:id/reject` with rejection reason.
* **Target Assertions:**
  * Status updates to `rejected`.
  * Reserved bed returns to `available` pool.

---

#### Phase 4: Contract Execution & Digital Signatures

##### Scenario 4.1: Tenant Contract Review & E-Signing (`contractSigningWiring.test.js`)
* **Automated Check:** POST `/api/contracts/:id/sign` with valid base64 signature string and IP metadata.
* **Target Assertions:**
  * Contract status changes to `signed`.
  * Generates valid canonical contract document hash and PDF blob.

---

#### Phase 5: Resident Account & Profile Security

##### Scenario 5.1: Profile Information & Security Updates (`usersController.test.js`, `authController.profileLock.test.js`)
* **Automated Check:** PUT `/api/users/profile` and POST `/api/auth/change-password`.
* **Target Assertions:**
  * Updates emergency contact details cleanly.
  * Rejects unauthorized mutations on locked fields (e.g. assigned room number).

---

#### Phase 6: Financials, Invoicing & Utility Split Calculations

##### Scenario 6.1: Monthly Rent Invoice Generation (`billingController.test.js`, `rentGenerator.test.js`)
* **Automated Check:** Trigger automated monthly bill generation for active checked-in tenants.
* **Target Assertions:**
  * Generates correct base rent ledger entry matching agreed contract rates.

##### Scenario 6.2: Electricity & Water Sub-Meter Pro-Rata Utility Split (`scenario4_utility_pro_rata.test.js`)
* **Automated Check:** POST `/api/utility-billing` sub-meter readings for multi-tenant room.
* **Target Assertions:**
  * Accurately calculates individual pro-rata share based on occupancy duration and room reading.

---

#### Phase 7: Payment Submissions & Ledger Balance Tracking

##### Scenario 7.1: Proof of Payment Upload & Verification (`paymentController.test.js`, `paymentRoutes.test.js`)
* **Automated Check:** POST `/api/payments` with reference number and receipt image path.
* **Target Assertions:**
  * Status transitions to `payment-pending-verification`.
  * Admin approval updates invoice state to `paid` and clears tenant balance.

##### Scenario 7.2: Partial Payment & Ledger Balance Tracking (`paymentLedger.test.js`)
* **Automated Check:** Process partial payment (e.g., ₱3,000 against ₱5,000 invoice).
* **Target Assertions:**
  * Status updates to `partially-paid`.
  * Retains precise remaining balance of ₱2,000 on ledger.

---

#### Phase 8: Maintenance & Support Ticket Lifecycle

##### Scenario 8.1: Maintenance Ticket Creation (`maintenanceController.test.js`, `MaintenanceRequest.test.js`)
* **Automated Check:** POST `/api/maintenance` with issue category, priority, and description.
* **Target Assertions:**
  * Creates ticket with unique ID format `MNT-YYYY-XXXX`.
  * Status defaults to `pending`.

##### Scenario 8.2: Maintenance Progress Tracking & Feedback (`scenario5_maintenance_escalation.test.js`)
* **Automated Check:** PATCH ticket status through `assigned` $\rightarrow$ `in-progress` $\rightarrow$ `resolved`, followed by POST rating.
* **Target Assertions:**
  * Successfully closes ticket and updates satisfaction metrics.

---

#### Phase 9: Real-Time Chat & Communications

##### Scenario 9.1: Real-Time Admin/Tenant Messaging (`chatController.js`)
* **Automated Check:** POST `/api/chat/messages` between tenant and admin IDs.
* **Target Assertions:**
  * Delivers message payload with timestamp and updates unread badge counter.

---

#### Phase 10: Announcements & Survey Participation

##### Scenario 10.1: Announcement Broadcast & Read Receipts (`announcementDispatch.test.js`)
* **Automated Check:** POST `/api/announcements` and query tenant announcement feed.
* **Target Assertions:**
  * Urgent announcements display priority flag.

##### Scenario 10.2: Tenant Satisfaction Survey Submission (`surveyValidationService.test.js`)
* **Automated Check:** POST `/api/surveys/responses` with template ID and responses.
* **Target Assertions:**
  * Saves response and blocks duplicate submissions from same tenant.

---

#### Phase 11: Room Transfer & Contract Renewal

##### Scenario 11.1: Room Transfer Processing (`occupancyController.js`, `roomsController.test.js`)
* **Automated Check:** Execute room transfer action for tenant.
* **Target Assertions:**
  * Updates room/bed assignment and logs transfer audit entry.

##### Scenario 11.2: Contract Renewal Addendum Flow (`contractPublicationWiring.test.js`)
* **Automated Check:** POST `/api/contracts/:id/renew` with new term duration.
* **Target Assertions:**
  * Extends residency expiry without disrupting tenant status.

---

#### Phase 12: Offboarding Financial Settlement & Deposit Refund

##### Scenario 12.1: Deposit Settlement & Final Clearance (`scenario3_offboarding_settlement.test.js`)
* **Automated Check:** Run offboarding financial settlement algorithm with utility charges and damage deductions.
* **Target Assertions:**
  * Calculates exact Net Deposit Refund Amount = `Security Deposit - Outstanding Utilities - Damages`.
  * Generates canonical offboarding settlement summary.

---

#### Phase 13: Mobile API Parity & System Guards

##### Scenario 13.1: Mobile Endpoint Parity (`mobileContractRoutes.test.js`)
* **Automated Check:** Execute `/api/mobile/...` endpoints.
* **Target Assertions:**
  * Standardized JSON payload envelope `{ success: true, data: ... }`.

##### Scenario 13.2: Access Control & Permission Guards (`accessGuards.test.js`, `permissions.test.js`)
* **Automated Check:** Execute endpoints with unauthorized roles.
* **Target Assertions:**
  * Enforces role locks (HTTP 401 / 403 Forbidden).
