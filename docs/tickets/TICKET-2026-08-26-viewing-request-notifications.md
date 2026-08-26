# Engineering Ticket: Fix Missing Dorm Owner & Branch Admin Notifications for Viewing Requests

| Field | Details |
| :--- | :--- |
| **Ticket Key** | `BUG-NOTIF-001` / `FEAT-VIEWING-NOTIF` |
| **Title** | Fix Missing In-App & Realtime Notifications for Dorm Owner and Branch Admin on Viewing Requests & Reschedules |
| **Type** | Bug Fix / Reliability Enhancement |
| **Priority** | High (Operational Visibility) |
| **Component(s)** | `server/notifications`, `server/reservations`, `web/notifications`, `web/admin` |
| **Status** | Ready for Implementation |
| **Related Design Spec** | [`docs/superpowers/specs/2026-08-26-viewing-request-admin-notifications-design.md`](../superpowers/specs/2026-08-26-viewing-request-admin-notifications-design.md) |

---

## 1. Problem Description

### Summary
When an applicant schedules an in-person room visit, requests photo-based 2D remote viewing, or selects urgent move-in review, no notification is received by the Dorm Owner or Branch Admin. The notification bell unread counter does not increment, no entry appears in the admin notification dropdown/page, and management staff are unaware that a viewing appointment or review has been requested.

### User Impact
- Dorm Owners and Branch Admins miss new room tour bookings.
- Prospective tenants experience delays in visit coordination and response times.
- Rescheduled visits go unnoticed without manual dashboard checking.

---

## 2. Root Cause Analysis (RCA)

1. **Mongoose Schema Enum Rejection**:
   `notify.visitScheduledAlert` (`server/services/notifications/notificationService.js`) dispatched notifications with `type: "visit_scheduled"`. The Mongoose model schema (`server/models/Notification.js`) only permitted `["visit_approved", "visit_rejected", "visit_requested"]`. Mongoose threw a validation error on `.save()`, causing `createNotification` to catch the error and return `null`. The document was never written to the database.
2. **Admin Query Visibility Whitelist**:
   `ADMIN_NOTIFICATION_TYPES` in `notificationVisibility.js` (server and web) only allowed `"visit_requested"`, so even if persisted, `"visit_scheduled"` was stripped from queries and UI stores.
3. **Decoupled Controller Notifications**:
   `visitSchedulingController.js` called `notify.newVisitRequested` without passing the `entityId` (`reservationId`) or tailoring messages for 2D Remote Viewing and Urgent Move-in requests.
4. **Branch Admin Query Inconsistency**:
   `notifyBranchAdmins` queried branch admins via raw string comparison without slug/display-name normalization.

---

## 3. Acceptance Criteria (AC)

- [ ] **AC 1: Physical Visit Notification**: When an applicant schedules a physical visit, both the Dorm Owner and the assigned Branch Admin receive a notification with the title *"New Visit Scheduled"* and message formatted as: `"[Tenant Name] scheduled a viewing visit for [Room Name] on [Date] at [Time]."`
- [ ] **AC 2: 2D Remote Viewing Notification**: When an applicant selects photo-based remote viewing, both the Dorm Owner and the assigned Branch Admin receive a notification titled *"2D Remote Viewing Request"* with message: `"[Tenant Name] requested photo-based remote viewing for [Room Name]."`
- [ ] **AC 3: Urgent Move-In Review Notification**: When an applicant selects urgent move-in review, both the Dorm Owner and the assigned Branch Admin receive a notification titled *"Priority Viewing Review Request"* with message: `"[Tenant Name] requested priority viewing review for [Room Name]."`
- [ ] **AC 4: Reschedule Notification**: When an applicant reschedules an existing visit, a notification titled *"Visit Rescheduled"* is delivered with the updated date and time.
- [ ] **AC 5: Deep-Link Action Navigation**: Clicking on the notification in the top bell dropdown or `/admin/notifications` page navigates the user directly to `/admin/reservations?reservationId=[ID]&tab=visits`, automatically focusing the specific reservation under the Visits tab.
- [ ] **AC 6: Real-time Socket Event**: Emits `notification:new` to recipient socket channels so the unread badge updates immediately without requiring a browser refresh.
- [ ] **AC 7: Role & Branch Isolation**: The Dorm Owner receives viewing notifications across all branches. Branch Admins only receive notifications for rooms in their assigned branch.
- [ ] **AC 8: Database Integrity & Backward Compatibility**: `Notification.js` schema enum supports both `"visit_requested"` and `"visit_scheduled"`.

---

## 4. Technical Scope & Implementation Checklist

### Backend Changes
- [ ] `server/models/Notification.js`: Add `"visit_scheduled"` to the schema `type` enum.
- [ ] `server/services/notifications/notificationVisibility.js`: Add `"visit_scheduled"` to `ADMIN_NOTIFICATION_TYPES`.
- [ ] `server/services/notifications/notificationService.js`:
  - Standardize `visitScheduledAlert` and `newVisitRequested` on `"visit_requested"`.
  - Format tailored titles and messages for all 3 viewing types and reschedules.
  - Attach `entityType: "reservation"`, `entityId: reservationId`, and deep-link `actionUrl`.
  - Normalize branch queries in `notifyBranchAdmins` to match both slugs (`"gil-puyat"`) and display names (`"Gil Puyat"`).
- [ ] `server/controllers/reservations/_helpers.js`: Ensure `notifyAdminsOfVisitSchedule` resolves room, branch, reservationId, and applicant details accurately and dispatches notifications and real-time socket events.
- [ ] `server/controllers/reservations/visitSchedulingController.js`: Replace legacy notification call with `notifyAdminsOfVisitSchedule` in `updateVisitPreferenceAndSchedule`.
- [ ] `server/controllers/reservations/reservationCrudController.js`: Verify initial reservation viewing alerts.
- [ ] `server/controllers/reservations/reservationLifecycleController.js`: Verify reservation update viewing alerts.

### Frontend Changes
- [ ] `web/src/shared/utils/notificationVisibility.js`: Add `"visit_scheduled"` to `ADMIN_NOTIFICATION_TYPES`.
- [ ] `web/src/shared/components/NotificationBell.jsx`: Support `"visit_requested"` and `"visit_scheduled"` with clock icon and direct action URL routing.
- [ ] `web/src/features/admin/pages/AdminNotificationsPage.jsx`: Ensure meta mapping, filtering, and deep-linking to `/admin/reservations?reservationId=${entityId}&tab=visits`.

---

## 5. Manual QA & Testing Guide

### Prerequisites
1. Ensure backend server is running on `http://localhost:5000`.
2. Ensure frontend web dev server is running on `http://localhost:5173`.
3. Have at least one **Applicant**, one **Dorm Owner**, and one **Branch Admin** account ready.

### Test Cases

| Case ID | Action | Expected Outcome |
| :--- | :--- | :--- |
| **TC-01** | Applicant selects **Physical Visit** (e.g., Aug 27, 2026 at 08:00 AM) on `/applicant/reservation`. | Owner & Branch Admin see red notification badge increment. Notification: *"New Visit Scheduled — [Applicant Name] scheduled a viewing visit for GP - Room 201 on Aug 27, 2026 at 08:00 AM."* |
| **TC-02** | Applicant selects **2D Remote Viewing** preference. | Owner & Branch Admin receive notification: *"2D Remote Viewing Request — [Applicant Name] requested photo-based remote viewing for [Room]."* |
| **TC-03** | Applicant selects **Urgent Move-in Review** preference. | Owner & Branch Admin receive notification: *"Priority Viewing Review Request — [Applicant Name] requested priority viewing review for [Room]."* |
| **TC-04** | Applicant reschedules their physical visit date/time. | Owner & Branch Admin receive notification: *"Visit Rescheduled — [Applicant Name] scheduled a viewing visit for [Room] on [New Date] at [New Time]."* |
| **TC-05** | Admin clicks on any viewing notification in the bell dropdown or notifications page. | Browser navigates directly to `/admin/reservations?reservationId=[ID]&tab=visits` with the specific reservation focused. |
| **TC-06** | Guadalupe branch viewing request is submitted. | Gil Puyat branch admin does **not** receive the notification; Guadalupe branch admin and Dorm Owner receive it. |
