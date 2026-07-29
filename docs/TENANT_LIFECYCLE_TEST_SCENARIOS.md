# Lilycrest Dormitory Management System (Lilycrest DMS)
## Tenant Lifecycle & Operational Test Scenarios

### Executive Summary
This document defines a comprehensive suite of end-to-end testing scenarios designed to validate the full tenant lifecycle within the **Lilycrest Dormitory Management System (Lilycrest DMS)**. It spans from initial public room discovery and reservation to active residency management (utility billing, payments, maintenance, contracts, community features) through to lease renewal, room transfer, and final checkout.

---

### Table of Contents
1. [Phase 1: Room Discovery & Pre-Reservation](#phase-1-room-discovery--pre-reservation)
2. [Phase 2: Reservation & Account Onboarding](#phase-2-reservation--account-onboarding)
3. [Phase 3: Admin Review & Deposit Verification](#phase-3-admin-review--deposit-verification)
4. [Phase 4: Contract Execution & Digital Signatures](#phase-4-contract-execution--digital-signatures)
5. [Phase 5: Check-In & Residency Activation](#phase-5-check-in--residency-activation)
6. [Phase 6: Resident Account & Profile Management](#phase-6-resident-account--profile-management)
7. [Phase 7: Financials, Invoicing & Utility Billing](#phase-7-financials-invoicing--utility-billing)
8. [Phase 8: Payment Submissions & Receipt Processing](#phase-8-payment-submissions--receipt-processing)
9. [Phase 9: Maintenance & Support Tickets](#phase-9-maintenance--support-tickets)
10. [Phase 10: In-App Communication & Real-time Chat](#phase-10-in-app-communication--real-time-chat)
11. [Phase 11: Community Engagement, Announcements & Surveys](#phase-11-community-engagement-announcements--surveys)
12. [Phase 12: Room Transfer & Contract Renewal](#phase-12-room-transfer--contract-renewal)
13. [Phase 13: Move-Out Notice, Clearance & Security Deposit Refund](#phase-13-move-out-notice-clearance--security-deposit-refund)
14. [Phase 14: System Resilience, Mobile Parity & Edge Cases](#phase-14-system-resilience-mobile-parity--edge-cases)
15. [Verification & Testing Execution Matrix](#verification--testing-execution-matrix)

---

### Detailed Test Scenarios

#### Phase 1: Room Discovery & Pre-Reservation

##### Scenario 1.1: Room Search & Filter Validation
* **Description:** Verify that prospective tenants can search and filter available rooms by branch/building, room type, capacity, price range, and amenities.
* **Prerequisites:** System seeded with active branches, room types, and available beds.
* **Steps:**
  1. Navigate to the Public Landing Page / Check Availability section (`/check-availability`).
  2. Select target Branch/Building (e.g., Main Branch).
  3. Filter by move-in date range and room capacity (e.g., 2-bed solo/shared).
  4. Observe the filtered room list and live room preview cards.
* **Expected Outcome:**
  * Only active rooms with unreserved, available beds matching criteria are displayed.
  * Occupancy indicators clearly distinguish `Available`, `Reserved`, and `Occupied` beds.

##### Scenario 1.2: Pre-Booking Inquiry Submission
* **Description:** Validate that unregistered guests can send inquiries regarding room amenities, policies, or visit schedules.
* **Steps:**
  1. Click "Inquire" on a room card or open the Contact/Inquiry modal.
  2. Enter full name, valid email address, phone number, and inquiry message.
  3. Submit the inquiry form.
* **Expected Outcome:**
  * Confirmation toast notification is shown ("Inquiry submitted successfully").
  * Backend registers inquiry record and sends automated email confirmation to guest.
  * Admin Inquiry Dashboard updates with new incoming guest inquiry.

---

#### Phase 2: Reservation & Account Onboarding

##### Scenario 2.1: Multi-Step Room & Bed Reservation Flow
* **Description:** Validate the step-by-step reservation workflow for reserving a specific bed in a room.
* **Steps:**
  1. Select a specific room and available Bed ID.
  2. Complete **Step 1 (Personal Details):** Full Name, DOB, Gender, Phone, Address.
  3. Complete **Step 2 (Occupancy Details):** Expected Move-in Date, Lease Duration (e.g., 6 months or 12 months).
  4. Complete **Step 3 (Emergency Contact & Verification):** Next of Kin contact, Upload Valid ID (Government/Student ID).
  5. Complete **Step 4 (Reservation Payment):** Select payment method (GCash, Bank Transfer, PayMongo Gateway) and upload deposit payment proof / transaction ref.
  6. Submit Reservation.
* **Expected Outcome:**
  * System creates temporary reservation record in `pending` status.
  * Target bed status changes to `reserved` (locking it from concurrent bookings).
  * System prompts user to set account credentials (password setup / email OTP verification).

##### Scenario 2.2: Concurrent Bed Booking Conflict Handling
* **Description:** Ensure two simultaneous users cannot double-book the same bed.
* **Steps:**
  1. Open two separate browser sessions (User A and User B).
  2. Both select the exact same Room Bed simultaneously.
  3. User A submits reservation payment proof first.
  4. User B attempts to complete payment submission 2 seconds later.
* **Expected Outcome:**
  * User A's reservation succeeds.
  * User B receives a clear conflict alert: "This bed was just reserved by another user. Please select another available bed."
  * Database transaction rollback enforces strict bed lock.

---

#### Phase 3: Admin Review & Deposit Verification

##### Scenario 3.1: Reservation Approval Workflow
* **Description:** Validate admin review of submitted reservation details and proof of down payment.
* **Steps:**
  1. Log into Admin Portal (`/admin/reservations`).
  2. Open pending reservation for Applicant.
  3. Verify applicant ID documents and payment reference number.
  4. Click **Approve Reservation**.
* **Expected Outcome:**
  * Reservation status transitions to `approved`.
  * Applicant receives email & SMS notification with login credentials and contract link.
  * System generates pending lease contract draft.

##### Scenario 3.2: Reservation Rejection with Reason
* **Description:** Verify admin rejection handling for invalid credentials or unverified payment proof.
* **Steps:**
  1. Admin opens pending reservation.
  2. Click **Reject Reservation**, select reason (e.g., "Invalid Payment Proof").
  3. Submit rejection.
* **Expected Outcome:**
  * Reservation status updates to `rejected`.
  * Reserved bed returns to `available` state.
  * Applicant receives notification explaining reason for rejection and steps to re-apply.

---

#### Phase 4: Contract Execution & Digital Signatures

##### Scenario 4.1: Tenant Contract Review & E-Signing
* **Description:** Validate that an approved applicant can view, review, and digitally sign their dormitory contract online.
* **Steps:**
  1. Log into Tenant Portal using newly verified credentials.
  2. Navigate to **Contracts** page (`/contracts`).
  3. Read generated contract terms, house rules, monthly rate, and security deposit details.
  4. Draw or type E-signature in the designated signature pad.
  5. Check agreement checkbox and submit signed contract.
* **Expected Outcome:**
  * Signed contract is stored securely with IP address, timestamp, and signature blob.
  * Downloadable canonical PDF contract becomes available in portal.
  * Contract status changes to `signed`.

---

#### Phase 5: Check-In & Residency Activation

##### Scenario 5.1: Physical Check-In & Room Key Issuance
* **Description:** Verify transition from reserved applicant to active checked-in tenant.
* **Steps:**
  1. Admin navigates to `/admin/occupancy` or Tenant Details.
  2. Verify signed contract and key handover.
  3. Click **Execute Check-In** and set actual move-in timestamp.
* **Expected Outcome:**
  * Tenant user status updates from `reserved` to `checked-in`.
  * Room bed status updates to `occupied`.
  * System initializes tenant billing ledger and sets up recurring monthly billing cycle.

---

#### Phase 6: Resident Account & Profile Management

##### Scenario 6.1: Profile Information & Security Updates
* **Description:** Validate updating personal info, emergency contact details, and password.
* **Steps:**
  1. Tenant navigates to **Profile Page** (`/profile`).
  2. Update contact number and emergency contact details.
  3. Update password under Security tab (entering current password, new password, confirm).
  4. Save changes.
* **Expected Outcome:**
  * Profile updates successfully.
  * Password change invalidates old session / requires re-authentication on next login.
  * Profile locking prevents altering locked fields (e.g., Name, Assigned Room) without admin approval.

---

#### Phase 7: Financials, Invoicing & Utility Billing

##### Scenario 7.1: Monthly Rent Invoice Generation & Viewing
* **Description:** Ensure active tenants can view current and historical monthly rent statements.
* **Steps:**
  1. Tenant navigates to **Billing Page** (`/billing`).
  2. View active invoice balance breakdown (Base Rent + Fixed Utility Charges).
  3. Download official statement of account (PDF format).
* **Expected Outcome:**
  * Line items match contract agreed rates.
  * Due dates, penalty terms, and payment status (`unpaid`, `partially-paid`, `paid`) are clear.

##### Scenario 7.2: Electricity & Water Sub-Meter Utility Billing Calculation
* **Description:** Verify split utility calculations based on room sub-meter readings.
* **Steps:**
  1. Admin inputs sub-meter reading (previous vs current kWh / cubic meters) for Room 201.
  2. System computes total room bill and splits equally among checked-in room occupants.
  3. Tenant opens Billing page.
* **Expected Outcome:**
  * Tenant sees individual utility breakdown (e.g., Electricity: 120 kWh x rate / 2 occupants).
  * System accurately adds utility fee to tenant's total monthly balance.

---

#### Phase 8: Payment Submissions & Receipt Processing

##### Scenario 8.1: Proof of Payment Upload & Verification
* **Description:** Validate tenant submitting manual bank/GCash payment proof for verification.
* **Steps:**
  1. Tenant clicks **Pay Now** on an unpaid invoice.
  2. Select payment method: **Manual Bank/GCash Transfer**.
  3. Enter Payment Reference Number, Amount, Payment Date, and upload image proof.
  4. Submit payment.
* **Expected Outcome:**
  * Invoice payment status changes to `payment-pending-verification`.
  * Admin receives verification alert under Payments dashboard.
  * Upon admin approval, invoice status changes to `paid`, tenant account balance updates to 0.00, and Official Receipt (OR) is generated.

##### Scenario 8.2: Partial Payment & Outstanding Balance Tracking
* **Description:** Validate handling partial payment for rent/utility bills.
* **Steps:**
  1. Total bill is ₱5,000. Tenant submits proof of payment for ₱3,000.
  2. Admin approves partial payment of ₱3,000.
* **Expected Outcome:**
  * Invoice status updates to `partially-paid`.
  * System retains remaining balance of ₱2,000 on tenant ledger.
  * Next payment prompt reflects remaining ₱2,000 due.

---

#### Phase 9: Maintenance & Support Tickets

##### Scenario 9.1: Maintenance Ticket Creation & Media Attachment
* **Description:** Validate reporting maintenance issues (e.g., aircon repair, plumbing leaking).
* **Steps:**
  1. Tenant navigates to **Maintenance** (`/maintenance`).
  2. Click **New Repair Request**.
  3. Select Category (e.g., Plumbing), Priority (High/Medium/Low), and detailed problem description.
  4. Attach photo/video evidence.
  5. Submit ticket.
* **Expected Outcome:**
  * Ticket is created with unique reference code (e.g., `MNT-2026-0042`).
  * Ticket status defaults to `pending`.
  * Admin and Service Provider dashboards receive repair notification.

##### Scenario 9.2: Maintenance Progress Tracking & Feedback Submission
* **Description:** Validate tracking maintenance lifecycle from assignment to resolution.
* **Steps:**
  1. Admin assigns maintenance ticket to technician.
  2. Technician updates status to `in-progress` and then `resolved` after fixing.
  3. Tenant views ticket status update in real-time.
  4. Tenant clicks **Confirm & Rate Service**, providing 5-star rating and review.
* **Expected Outcome:**
  * Ticket completes lifecycle and updates status to `closed`.
  * Satisfaction metrics update in Admin Analytics.

---

#### Phase 10: In-App Communication & Real-time Chat

##### Scenario 10.1: Real-Time Chat with Admin / Staff
* **Description:** Validate direct messaging between tenant and dormitory management.
* **Steps:**
  1. Tenant opens Messages/Chat tab.
  2. Send message to Admin ("Hi, can I request an extra study table?").
  3. Admin responds from Admin Chat Console.
* **Expected Outcome:**
  * Messages deliver instantly (via Socket.io / Firebase real-time listeners).
  * Unread badge indicators increment/decrement correctly.

---

#### Phase 11: Community Engagement, Announcements & Surveys

##### Scenario 11.1: Announcement Viewing & Acknowledgment
* **Description:** Validate broadcast announcement delivery to active tenants.
* **Steps:**
  1. Admin posts announcement: "Scheduled Water Maintenance on Saturday".
  2. Tenant logs into portal or receives mobile notification.
  3. Tenant views post under **Announcements** (`/announcements`).
* **Expected Outcome:**
  * Urgent announcements display priority banners.
  * Read receipt/acknowledgment is registered by system.

##### Scenario 11.2: Tenant Satisfaction Survey Participation
* **Description:** Validate completing dormitory satisfaction surveys.
* **Steps:**
  1. Tenant navigates to **Surveys** (`/surveys`).
  2. Select active survey (e.g., "Q3 Dormitory Cleanliness Evaluation").
  3. Complete rating scales and open text feedback.
  4. Submit survey.
* **Expected Outcome:**
  * Survey response is saved securely.
  * Prevents duplicate submissions from the same tenant.

---

#### Phase 12: Room Transfer & Contract Renewal

##### Scenario 12.1: Room Transfer Request Workflow
* **Description:** Validate request to switch rooms or beds within the dormitory.
* **Steps:**
  1. Tenant submits **Room Transfer Request** with preferred target room and reason.
  2. Admin reviews available inventory and approves transfer.
  3. Admin executes room transfer in system.
* **Expected Outcome:**
  * Tenant room assignment updates to new room/bed.
  * Rent rate adjusts automatically if moving to a different room tier.
  * System logs audit trail of transfer.

##### Scenario 12.2: Contract Renewal Flow
* **Description:** Validate contract extension before lease expiration.
* **Steps:**
  1. System alerts tenant 30 days before contract expiry.
  2. Tenant clicks **Request Contract Renewal** and selects desired extension term (e.g., 6 months).
  3. Admin approves renewal and generates new contract addendum.
  4. Tenant signs updated contract.
* **Expected Outcome:**
  * Contract expiry date updates seamlessly without interrupting residency status.

---

#### Phase 13: Move-Out Notice, Clearance & Security Deposit Refund

##### Scenario 13.1: Intent to Move-Out & Clearance Processing
* **Description:** Validate lease termination notice, damage clearance, and move-out completion.
* **Steps:**
  1. Tenant submits **Move-Out Notice** with target departure date (e.g., 30-day notice).
  2. Admin conducts physical room inspection and inputs damage deductions (if any).
  3. Final utility meter reading is calculated and deducted from Security Deposit.
  4. Admin issues final clearance and executes **Check-Out**.
* **Expected Outcome:**
  * Tenant account status changes to `checked-out`.
  * Room bed returns to `available` inventory.
  * Final Settlement PDF generated showing Deposit amount - Deductions = Net Refund Amount.

---

#### Phase 14: System Resilience, Mobile Parity & Edge Cases

##### Scenario 14.1: Mobile Endpoint Parity Verification (`/api/mobile/...`)
* **Description:** Ensure mobile app authentication, billing, maintenance, and notifications API endpoints function identically to web frontend.
* **Steps:**
  1. Execute API requests against `/api/mobile/auth/login`, `/api/mobile/billing`, `/api/mobile/maintenance`.
* **Expected Outcome:**
  * Standardized JSON envelope `{ success: true, data: ... }` returned across all endpoints.
  * Backward compatibility maintained.

##### Scenario 14.2: Graceful Offline & API Server Unreachable Guard
* **Description:** Validate system behavior during database or backend server outage.
* **Steps:**
  1. Simulate offline state or disconnect server `/api/health`.
  2. Navigate through web portal.
* **Expected Outcome:**
  * Graceful offline fallback screen / error boundary banner appears.
  * Prevents UI crash, blank screen, or data corruption.

---

### Verification & Testing Execution Matrix

| Phase | Test Scenario ID | Scenario Name | Automation Status | Target Result |
|---|---|---|---|---|
| **Discovery** | `TC-01.1` | Room Search & Filter | Automated (Playwright) | Pass |
| **Discovery** | `TC-01.2` | Guest Inquiry Submission | Integration Test | Pass |
| **Reservation**| `TC-02.1` | Multi-step Room Reservation | E2E Simulation | Pass |
| **Reservation**| `TC-02.2` | Concurrent Booking Conflict | Lock Unit Test | Pass |
| **Approval** | `TC-03.1` | Admin Reservation Approval | Integration Test | Pass |
| **Contract** | `TC-04.1` | E-Signature & PDF Contract | Canonical Layout Test | Pass |
| **Check-In** | `TC-05.1` | Check-in & Bed Occupancy | Atomic Transaction | Pass |
| **Profile** | `TC-06.1` | Profile & Security Update | Unit Test | Pass |
| **Billing** | `TC-07.1` | Rent Invoice & Ledger | Billing Controller Test | Pass |
| **Billing** | `TC-07.2` | Utility Metering & Split | Billing Test Suite | Pass |
| **Payments** | `TC-08.1` | Payment Proof & Verification | Payment Controller Test | Pass |
| **Maintenance**| `TC-09.1` | Repair Request Creation | Maintenance Suite | Pass |
| **Chat** | `TC-10.1` | Real-time Admin Chat | Socket/API Test | Pass |
| **Community** | `TC-11.1` | Announcement & Survey | Survey Test Suite | Pass |
| **Checkout** | `TC-13.1` | Move-Out Clearance & Refund | Lifecycle Simulation | Pass |
