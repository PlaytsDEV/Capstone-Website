# Viewing Request Admin Notifications Design Specification

**Document Identifier**: `2026-08-26-viewing-request-admin-notifications-design`  
**Date**: August 26, 2026  
**Status**: Approved / Ready for Implementation  
**System**: Lilycrest Dormitory Management System (Lilycrest DMS)

---

## 1. Executive Summary & Problem Statement

When an applicant submits or updates a room viewing preference (such as scheduling a physical on-site visit, requesting 2D photo-based remote viewing, or selecting urgent move-in review), no in-app notification or real-time badge count is delivered to the Dorm Owner or Branch Admin.

This prevents dormitory management staff from receiving timely alerts when prospective tenants request room tours or need viewing coordination, causing uncoordinated visits and delays in applicant onboarding.

---

## 2. Root Cause Analysis

Tracing the notification lifecycle from the tenant client to the backend database revealed four compounding defects:

1. **Mongoose Schema Enum Validation Failure**:
   - In `server/controllers/reservations/_helpers.js`, the helper function `notifyAdminsOfVisitSchedule` calls `notify.visitScheduledAlert(admin._id, ...)`.
   - In `server/services/notifications/notificationService.js`, `visitScheduledAlert` calls `createNotification(adminUserId, "visit_scheduled", title, message, ...)`.
   - In `server/models/Notification.js`, the schema's `type` enum defines `["visit_approved", "visit_rejected", "visit_requested", ...]`, but **omits** `"visit_scheduled"`.
   - When `notification.save()` executes, Mongoose rejects the document with a `ValidationError: visit_scheduled is not a valid enum value for path type`.
   - `createNotification` catches this error, logs a console warning, and returns `null`. Consequently, zero records are persisted into MongoDB and no real-time WebSocket event (`notification:new`) is broadcast.

2. **Role-Based Visibility Filter Suppression**:
   - In `server/services/notifications/notificationVisibility.js` and `web/src/shared/utils/notificationVisibility.js`, the `ADMIN_NOTIFICATION_TYPES` whitelist only includes `"visit_requested"` (and excludes `"visit_scheduled"`).
   - Even if the document had bypassed schema validation, the backend MongoDB query filter (`{ type: { $in: [...ADMIN_NOTIFICATION_TYPES] } }`) and the frontend filter (`isNotificationVisibleForUser`) would have suppressed it from the notification bell and list views.

3. **Controller Decoupling & Incomplete Payload in `visitSchedulingController.js`**:
   - When an applicant updates their visit preference via `PATCH /api/reservations/:reservationId/visit-preference` (`visitSchedulingController.js`), lines 494–512 called `notify.newVisitRequested(branchName, applicantName, roomName, visitDateLabel || "TBD", visitTime)`.
   - `newVisitRequested` did not accept or pass the `entityId` (`reservationId`), did not construct a deep-link action URL, and unconditionally formatted a message claiming the applicant *"scheduled a viewing visit on TBD"* even when they chose 2D Remote Viewing or Urgent Move-in Review.

4. **Branch Recipient Matching Inconsistency**:
   - In `notifyBranchAdmins` (`notificationService.js`), branch admins were queried via `{ role: "branch_admin", branch }`.
   - In the database, branch identifiers can appear as slugs (e.g., `"gil-puyat"`) or display names (e.g., `"Gil Puyat"`). Inconsistent casing or format risked excluding branch admins from receiving notifications.

---

## 3. Design Requirements & User Decisions

Based on the `/grill-me` requirements alignment:

| Requirement | Specification |
| :--- | :--- |
| **Viewing Types Supported** | Notifications must trigger for **all 3 viewing preferences**: (1) Physical Visit, (2) 2D Remote Viewing, and (3) Urgent Move-in Review. |
| **Lifecycle Events Supported** | Notifications must trigger on **both initial viewing requests and applicant-initiated updates/reschedules**. |
| **Recipient Scope** | Notifications must be delivered to the **Dorm Owner** (all branches) and the **Branch Admin** assigned to the specific room's branch. Other branch admins are isolated. |
| **Action & Navigation** | Clicking the notification must navigate to `/admin/reservations?reservationId=${reservationId}&tab=visits` to focus the specific reservation under the Visits tab. |
| **Real-time Delivery** | Every notification creation must emit a `notification:new` WebSocket payload to the recipient's personal socket room so badges update without refresh. |

---

## 4. Architecture & Component Specification

```
[ Applicant Submits / Updates Viewing ]
                  │
                  ▼
[ visitSchedulingController / reservationCrudController ]
                  │
                  ▼
[ notifyAdminsOfVisitSchedule(_helpers.js) ]
                  │
                  ▼
[ notificationService.visitScheduledAlert / notifyBranchAdmins ]
                  │
   ┌──────────────┴──────────────┐
   ▼                             ▼
[ MongoDB Notification ]   [ WebSocket emitToUser ]
 (type: "visit_requested",  (event: "notification:new")
  entityType: "reservation",      │
  entityId: reservationId,        ▼
  actionUrl: /admin/reservations?reservationId=...&tab=visits)
                  │
                  ▼
[ Admin Notification Bell & AdminNotificationsPage ]
```

### 4.1 Backend Data Model (`Notification.js`)
- Update `notificationSchema.type.enum` to include both `"visit_requested"` and `"visit_scheduled"`:
  ```javascript
  enum: [
    "reservation_confirmed",
    "reservation_cancelled",
    "reservation_cancellation_requested",
    "reservation_cancellation_rejected",
    "reservation_expired",
    "reservation_noshow",
    "visit_approved",
    "visit_rejected",
    "visit_requested",
    "visit_scheduled", // Added for backward & forward compatibility
    ...
  ]
  ```

### 4.2 Notification Visibility (`notificationVisibility.js` Server & Web)
- Add `"visit_scheduled"` to `ADMIN_NOTIFICATION_TYPES` in both:
  - `server/services/notifications/notificationVisibility.js`
  - `web/src/shared/utils/notificationVisibility.js`
- Ensure that queries for `role: "owner"` and `role: "branch_admin"` include all viewing request notification types.

### 4.3 Notification Service Dispatches (`notificationService.js`)
1. **Canonical Event Type**: Standardize dispatches on `"visit_requested"`.
2. **Branch Query Normalization**: In `notifyBranchAdmins`, normalize the branch argument to match both slug and display formats:
   ```javascript
   const normalizedBranch = String(branch || "").toLowerCase().trim();
   const branchSlug = normalizedBranch.replace(/\s+/g, "-");
   const branchDisplay = normalizedBranch === "gil-puyat" || normalizedBranch === "gil puyat"
     ? "Gil Puyat"
     : normalizedBranch === "guadalupe"
       ? "Guadalupe"
       : branch;

   const adminRecipients = branch
     ? [
         { role: "branch_admin", branch: { $in: [branch, branchSlug, branchDisplay] } },
         { role: "owner" },
       ]
     : [
         { role: "branch_admin" },
         { role: "owner" },
       ];
   ```
3. **Multi-Preference Message Generator**:
   - **Physical Visit**:
     - Title: `isReschedule ? "Visit Rescheduled" : "New Visit Scheduled"`
     - Message: `${tenantName} scheduled a viewing visit for ${roomName} on ${dateLabel} at ${visitTime}.`
   - **2D Remote Viewing**:
     - Title: `"2D Remote Viewing Request"`
     - Message: `${tenantName} requested photo-based remote viewing for ${roomName}.`
   - **Urgent Move-in Review**:
     - Title: `"Priority Viewing Review Request"`
     - Message: `${tenantName} requested priority viewing review for ${roomName}.`
4. **Action URL & Metadata**:
   - `entityType: "reservation"`
   - `entityId: String(reservationId)`
   - `actionUrl: reservationId ? \`/admin/reservations?reservationId=${String(reservationId)}&tab=visits\` : "/admin/reservations?tab=visits"`

### 4.4 Reservation Sub-Controllers
1. **`server/controllers/reservations/_helpers.js`**:
   - Update `notifyAdminsOfVisitSchedule` to extract `reservation._id`, `room.branch`, `room.name`, `applicantUser`, `viewingPreference`, `visitDate`, and `visitTime`.
   - Dispatch `visitScheduledAlert` for each matched admin/owner and emit `notification:new` over WebSockets.
2. **`server/controllers/reservations/visitSchedulingController.js`**:
   - In `updateVisitPreferenceAndSchedule`, call `notifyAdminsOfVisitSchedule({ reservation: updatedReservation, applicantUser: updatedReservation.userId || dbUser, viewingPreference: effectiveViewingPreference, visitDate: updatedReservation.visitDate, visitTime: updatedReservation.visitTime, isReschedule })`.
3. **`server/controllers/reservations/reservationCrudController.js`**:
   - Ensure initial reservation creation calls `notifyAdminsOfVisitSchedule` when any viewing preference or visit schedule is provided.
4. **`server/controllers/reservations/reservationLifecycleController.js`**:
   - Ensure reservation updates call `notifyAdminsOfVisitSchedule` consistently.

### 4.5 Frontend UI & Deep-Linking
1. **`web/src/features/admin/pages/AdminNotificationsPage.jsx`**:
   - Verify `TYPE_META.visit_requested` and `TYPE_META.visit_scheduled` define the `CalendarCheck` icon, priority `medium`, category `reservations`, and action label `"Review Visit"`.
   - Ensure clicking the notification follows `actionUrl` containing `reservationId` and `tab=visits`.
2. **`web/src/shared/components/NotificationBell.jsx`**:
   - Verify `NotificationBellIcon` maps both `visit_requested` and `visit_scheduled` to `<Clock size={15} style={{ color: "#D97706" }} />`.
   - Ensure clicking a notification closes the dropdown and navigates directly to `actionUrl`.

---

## 5. Security & Permission Invariants

- **Branch Access Control**: Branch admins only receive notifications for rooms within their assigned branch. System Owners receive notifications across all branches.
- **Non-Fatal Notification Execution**: All notification dispatches are wrapped in non-blocking try/catch blocks with structured logger warnings so that notification failures never abort or roll back underlying reservation updates.
- **Sanitized Copywriting**: All messages use professional, formal English with proper capitalization and avoid internal database syntax or slang.

---

## 6. Verification & Testing Strategy

1. **Unit & Integration Tests**:
   - Run backend test suite (`npm test` in `/server`) to verify all reservation access, lifecycle, and notification tests pass.
   - Run frontend build check (`npm run build` in `/web`) to ensure zero lint/compilation regressions.
2. **End-to-End Functional Validation**:
   - Scenario 1: Applicant schedules a Physical Visit -> Verify Owner & Branch Admin receive "New Visit Scheduled" with date/time.
   - Scenario 2: Applicant chooses 2D Remote Viewing -> Verify Owner & Branch Admin receive "2D Remote Viewing Request".
   - Scenario 3: Applicant chooses Urgent Move-in Review -> Verify Owner & Branch Admin receive "Priority Viewing Review Request".
   - Scenario 4: Applicant reschedules a Physical Visit -> Verify Owner & Branch Admin receive "Visit Rescheduled".
   - Scenario 5: Click notification from bell dropdown and notifications page -> Verify navigation opens `/admin/reservations?reservationId=<id>&tab=visits`.
