# Lilycrest Dormitory Management System — System Specification & Feature Reference

A web-based management platform for a multi-branch dormitory (Gil Puyat and Guadalupe locations), covering the complete tenant lifecycle from public room browsing to reservation, occupancy management, billing, maintenance, and move-out.

---

## 1. System Roles & Access Control

| Role | Scope | Key Capabilities & Authorization |
| :--- | :--- | :--- |
| **Guest** | Public pages only | Browse rooms, view amenities, pricing, availability map, and submit visitor inquiries. |
| **Applicant** | Self-service portal | Create account, submit 5-step room reservation, upload IDs/payment proofs, track application status. |
| **Tenant** | Self-service portal | View current contract, pay monthly bills via PayMongo or payment proof upload, submit maintenance requests, view branch announcements. |
| **Admin** | Assigned branch | Manage branch rooms, review/approve reservations, record utility readings, generate bills, resolve maintenance tickets, publish announcements. |
| **Owner** | All branches | System owner access across both branches, manage admin accounts, override decisions, view cross-branch financial reports and audit logs. |

---

## 2. Core Functional Modules

### Module 1: User & Access Management
- **Registration & Login**: Email/password authentication, branch preference, password reset via email/username.
- **Profile Self-Service**: Edit phone number, username, profile photo preview & upload.
- **Branch Admin Management**: View branch users, filter by role (`applicant`, `tenant`), create applicant accounts with password setup emails, edit user metadata, deactivate accounts.
- **Owner Governance**: Cross-branch user table, branch reassignment, role elevation/demotion, user statistics (total, role distribution, active/inactive counts).
- **Session & Security Guard**: Role-based access control (RBAC), automatic session expiration warnings, logout confirmation prompts.

### Module 2: Reservation, Tenant & Contract Management
- **Public Browsing**: Filter by branch (Gil Puyat / Guadalupe) and type (Private, Shared, Quadruple). Card carousels, bed-by-bed availability maps.
- **Bed Selection & Appliance Declaration**: Bunk/single bed selection, optional appliance fees (fan, rice cooker, laptop), automatic price preview. One active reservation constraint.
- **5-Step Guided Reservation Flow**:
  1. *Room Summary*: Review room, bed, branch, price, move-in target.
  2. *Visit Scheduling*: Schedule visit, location declaration, house rules acknowledgment.
  3. *Tenant Application*: Personal, employment/school, emergency contact, ID/NBI clearance document uploads.
  4. *Payment*: Payment reference entry, proof of payment upload.
  5. *Confirmation*: Reservation summary receipt, next-action indicators, status tracker.
- **Admin Reservation Workflows**: Approve/reject pending applications, move-in deadline extensions, slot releasing, account archive, tenant check-in/check-out execution.
- **Contract Tracking**: Expiration reminders (30-day dashboard alerts), renewal workflows, move-in/out date monitoring.

### Module 3: Room, Bed & Occupancy Management
- **Visual Room Grid**: Real-time occupancy status cards (available, partially occupied, full), type filtering.
- **Room Configuration**: Create/edit room pricing, capacity, amenities, house policies, image galleries, and bed layouts. Deletion guard for occupied rooms.
- **Atomic Occupancy Tracking**: Real-time occupancy statistics, per-room capacity vs actual count, automated `$inc` updates on check-in/out.

### Module 4: Billing, Payments & Utility Management
- **Tenant Billing Portal**: Monthly balance display, itemized breakdown (rent, electricity, water, appliances, penalties), billing history, status badges (Pending, Paid, Overdue, Partially Paid).
- **Online Checkout**: PayMongo integration for bill payment and security deposit processing.
- **Utility Billing Engine**: Room-based electricity & water billing, pro-rata distribution logic, meter reading inputs, 15th-cycle billing periods, publish-readiness verification.
- **Penalty & Overdue Enforcement**: Configurable late payment rate, automatic overdue flagging, penalty waiver support with audit log context.

### Module 5: Maintenance, Announcements & Compliance
- **Tenant Maintenance Requests**: Urgency setting (Low, Medium, High), category selection (Plumbing, Electrical, Hardware, Appliance, Cleaning), photo upload, resolution history tracking.
- **Admin Maintenance Management**: Urgent ticket sorting, staff assignment, status progression (Pending, In-Progress, Completed, Cancelled), resolution metrics & frequency reports.
- **Announcements Engine**: Categorized posts (Reminder, Maintenance, Policy, Event, Alert, General), targeted visibility (Public, Tenants, Staff), mandatory acknowledgment tracking, pinned posts feed.

### Module 6: Reports, Analytics & Executive Audit Trail
- **Admin & Owner Dashboards**: Summary metrics cards, 6-month reservation trends, expiring contracts alerts, overdue bills alerts, side-by-side branch comparisons.
- **Executive Audit Trail**: Chronological activity logs (logins, data mutations, deletions, errors), color-coded severity levels (Info, Warning, High, Critical), failed login tracking, CSV export, retention cleanup.
