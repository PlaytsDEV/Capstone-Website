# Lilycrest DMS — Occupancy & Reservation Management Guide

This guide details room bed layouts, atomic occupancy counters, reservation lifecycle states, and room allocation rules.

---

## 1. Room Types & Bed Mapping

Lilycrest DMS supports multi-branch dormitory layouts (Gil Puyat and Guadalupe) across three room categories:

| Room Type | Max Capacity | Bed Types Available | Water Billing Rule |
| :--- | :--- | :--- | :--- |
| **Private Room** | 1 Bed | Single Bed | Directly Billable |
| **Shared Room** | 2 - 4 Beds | Upper Bunk, Lower Bunk | Pro-rata Shared |
| **Quadruple Sharing** | 4 Beds | Upper Bunk, Lower Bunk | Excluded from Water Billing |

---

## 2. Atomic Occupancy Management

To prevent race conditions when multiple applicants reserve the same room/bed simultaneously, MongoDB operations use strict atomic updates:

```js
// Atomic Occupancy Increment on Tenant Check-in
await Room.findByIdAndUpdate(roomId, {
  $inc: { occupiedBeds: 1 }
});

// Atomic Occupancy Decrement on Tenant Move-Out
await Room.findByIdAndUpdate(roomId, {
  $inc: { occupiedBeds: -1 }
});
```

---

## 3. 5-Step Guided Reservation Lifecycle

```
[ Step 1: Room Summary ] -> Select Room, Bed & Move-in Target
           |
[ Step 2: Visit Schedule ] -> Schedule Visit & House Rules Acknowledgment
           |
[ Step 3: Application ] -> Personal Info & ID/NBI Document Uploads
           |
[ Step 4: Payment Proof ] -> Reference Number & Payment Receipt Upload
           |
[ Step 5: Confirmation ] -> Confirmation Receipt & Admin Verification Queue
```

### Reservation Status Machine
- `pending` -> Initial applicant creation.
- `visit_pending` -> Dormitory visit scheduled.
- `visit_approved` -> Visit verified by Branch Admin.
- `payment_pending` -> Payment reference uploaded.
- `reserved` -> Deposit approved; room bed locked.
- `checked_in` -> Active resident status; billing active.
- `checked_out` -> Move-out completed; bed released.
