# Lilycrest Dormitory Management System (Lilycrest DMS)
## Simplified Guide: Automated Tenant Test Scenarios

### Overview
This document explains all the **automatically tested tenant scenarios** in Lilycrest DMS using simple, everyday language. Every item listed here is 100% verified by automated system tests.

---

### Table of Contents
1. [Phase 1: Finding a Room & Asking Questions](#1-finding-a-room--asking-questions)
2. [Phase 2: Reserving a Bed & Room](#2-reserving-a-bed--room)
3. [Phase 3: Admin Approval & Rejection](#3-admin-approval--rejection)
4. [Phase 4: Digital Lease Signing](#4-digital-lease-signing)
5. [Phase 5: Profile & Password Security](#5-profile--password-security)
6. [Phase 6: Monthly Rent & Utility Bill Splitting](#6-monthly-rent--utility-bill-splitting)
7. [Phase 7: Paying Bills & Tracking Balances](#7-paying-bills--tracking-balances)
8. [Phase 8: Reporting & Tracking Repairs](#8-reporting--tracking-repairs)
9. [Phase 9: In-App Chat Messaging](#9-in-app-chat-messaging)
10. [Phase 10: Announcements & Feedback Surveys](#10-announcements--feedback-surveys)
11. [Phase 11: Room Transfers & Contract Renewals](#11-room-transfers--contract-renewals)
12. [Phase 12: Moving Out & Security Deposit Refund](#12-moving-out--security-deposit-refund)
13. [Phase 13: Mobile App & Security Checks](#13-mobile-app--security-checks)

---

### 1. 🔍 Finding a Room & Asking Questions
* **Searching Rooms:** Checks that when a user searches for rooms by date or room size, the system only shows rooms with available beds and hides full rooms.
* **Sending Inquiries:** Checks that visitors can ask questions about rates or rules, and the system saves their inquiry and sends them a confirmation email.

---

### 2. 📝 Reserving a Bed & Room
* **Reserving a Room:** Checks that a user can complete the step-by-step reservation form (entering personal info, move-in date, ID photo, and down payment proof) to reserve a specific bed.
* **Preventing Double-Booking:** Checks that if two people try to book the exact same bed at the exact same second, the system gives it to the first person and safely tells the second person to pick another bed.

---

### 3. 👔 Admin Approval & Rejection
* **Approving Reservations:** Checks that when an admin approves a valid reservation and payment proof, the system changes the applicant's status to "Approved" and creates their contract.
* **Rejecting Invalid Requests:** Checks that if an admin rejects fake payment proof, the system immediately frees up that bed so someone else can book it.

---

### 4. ✍️ Digital Lease Signing
* **Signing the Lease:** Checks that approved tenants can read their dormitory contract online, sign it electronically on their screen, and download an official PDF copy.

---

### 5. 🔒 Profile & Password Security
* **Profile & Password Updates:** Checks that tenants can update their contact info and password, but blocks them from secretly altering locked information (like changing their assigned room number).

---

### 6. 💡 Monthly Rent & Utility Bill Splitting
* **Monthly Rent Bills:** Checks that the system automatically generates correct monthly rent statements based on the agreed contract price.
* **Splitting Electricity & Water:** Checks that when meter readings are entered for a room, the system fairly splits the bill among the room's current roommates.

---

### 7. 💳 Paying Bills & Tracking Balances
* **Uploading Payment Proof:** Checks that when a tenant uploads a GCash or Bank receipt, the admin gets alerted to verify it, and the bill updates to "Paid".
* **Partial Payments:** Checks that if a bill is ₱5,000 and the tenant pays ₱3,000, the system updates the bill status to "Partially Paid" and accurately tracks the remaining ₱2,000 due.

---

### 8. 🛠️ Reporting & Tracking Repairs
* **Submitting Repair Tickets:** Checks that tenants can report broken items (like a leaking sink or AC issue) with photos and get a unique tracking number.
* **Tracking Repair Progress:** Checks that when a repairman fixes the issue, the tenant sees the status update to "Resolved" and can leave a 5-star rating.

---

### 9. 💬 In-App Chat Messaging
* **Messaging Admin:** Checks that tenants and admin staff can send messages back and forth in real-time and see unread message badges.

---

### 10. 📢 Announcements & Feedback Surveys
* **Dorm Announcements:** Checks that important notices posted by management (like scheduled water maintenance) appear on the tenant's feed with alert banners.
* **Satisfaction Surveys:** Checks that tenants can fill out evaluation surveys about dormitory services, while preventing double submissions.

---

### 11. 🔄 Room Transfers & Contract Renewals
* **Changing Rooms:** Checks that if a tenant requests to move to another room, the system updates their assigned bed and adjusts their rent accordingly.
* **Extending Lease Stay:** Checks that when a tenant renews their contract, their move-out date gets extended without interrupting their stay.

---

### 12. 🚪 Moving Out & Security Deposit Refund
* **Final Settlement:** Checks that when a tenant checks out, the system automatically calculates:
  $$\text{Net Refund} = \text{Security Deposit} - \text{Unpaid Bills} - \text{Damage Deductions}$$
  and outputs their final financial settlement summary.

---

### 13. 📱 Mobile App & Security Checks
* **Mobile App Compatibility:** Checks that the phone app receives the exact same accurate billing, contract, and repair information as the web version.
* **Permission Locks:** Checks that normal tenants cannot open admin-only management pages or change system settings.
