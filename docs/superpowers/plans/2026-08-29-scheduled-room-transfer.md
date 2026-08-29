# Scheduled Room Transfer — Phase 2 implementation plan

Branch: `feat/scheduled-room-transfer` (from `main` @ 86c51a89, PR #153 merged).
Phase-1 analysis: see conversation / `memory/room_transfer_workflow_analysis.md`.

## Phase 2A — `currentOccupancy` / hold semantics finding (PROVEN)

### What `Room.currentOccupancy` means today

`currentOccupancy` is a **denormalized counter of "reservations occupying a capacity slot"**, where
"occupying a slot" = `Reservation.status ∈ {reserved, moveIn}` (`ACTIVE_OCCUPANCY_STATUS_QUERY`,
`server/utils/lifecycleNaming.js:176`). `reserved` = payment-confirmed but **not yet physically moved in**.

Evidence:

| Reader | File:line | Treats `currentOccupancy` as… |
|---|---|---|
| Canonical derivation | `occupancyManager.js:198` `currentOccupancy = reservations.length` (reservations = `{reserved, moveIn}`) | committed slots — and exposes a SEPARATE `physicalOccupancy = occupiedBeds.length` and `reservedCount` |
| Nightly reconcile (Job 15) | `scheduler.js:866` `countDocuments({ status: {$in: ACTIVE_OCCUPANCY_STATUS_QUERY} })` | committed slots (`reserved` + `moveIn`) |
| Room list realtime sync | `roomsController.js:407-413` `liveOccupancy = beds where status ∈ {occupied, reserved, locked}` | committed slots (a `reserved` bed counts) |
| Room serializer `available` | `roomsController.js:564-570` `currentOccupancy < capacity` | committed slots |
| Analytics room inventory | `analyticsController.js:588-612` `availableBeds = capacity - currentOccupancy - unavailableBeds`; labelled `occupiedBeds` | committed slots reduce vacancy |
| Branch summary | `branchSummaryController.js:148` `sum(currentOccupancy)` | committed slots |
| Capacity-reduce guard | `roomsController.js:1269` `capacity < currentOccupancy` rejected | committed slots |
| **New-booking capacity gate** | `reservationCrudController.js:296-304` via `ensureRoomReservationCapacity` → `countDocuments({ status: {$in: ACTIVE_BED_HOLD_STATUSES} })` vs `room.capacity` — **does NOT read `currentOccupancy`** | live reservation count (even wider: includes pre-payment stages) |

### Conclusion

**`currentOccupancy` ALREADY includes committed-but-not-physically-present tenants** (`reserved`). It is
NOT "warm bodies in beds only" — `physicalOccupancy` / `reservedCount` exist precisely because
`currentOccupancy` is the committed-capacity number. Reports that want physical headcount already read
`physicalOccupancy`.

Therefore a scheduled inbound transfer **may legitimately consume a `currentOccupancy` slot on the
destination**, exactly like a paid `reserved` reservation does — this is the established meaning, not
inflation. There is one nuance: `currentOccupancy` is a *counter that gets reconciled from live
reservation status*. Job 15 recomputes it as `countDocuments({status ∈ {reserved, moveIn}})`. A
scheduled transfer's tenant reservation is still `moveIn` (in the SOURCE room) — it is not a second
reservation. So if we merely `atomicIncreaseOccupancy(destRoom)`, **Job 15 will reconcile it straight
back down** (the destination has no reservation with `roomId = destRoom`), silently breaking the hold
within 24h.

### Chosen hold mechanism (concurrency-safe, reconcile-safe)

The hold is expressed on the **destination Room document only**, and made reconcile-proof by teaching
the two reconcilers about scheduled transfers:

**Shared destination (double / quad):**
- `bed.status = "reserved"`, `bed.occupiedBy = { userId: <tenant>, reservationId: <tenant's existing reservation>, occupiedSince: null }`.
- `Room.atomicIncreaseOccupancy(destRoomId, session)` — `null` ⇒ `DESTINATION_ROOM_FULL`, abort.

**Private / capacity-only destination:**
- `Room.atomicIncreaseOccupancy(destRoomId, session)` only. `null` ⇒ `DESTINATION_ROOM_FULL`. No bed row touched, no fake bed id.

**Reconcile carve-outs (the ONLY changes to existing occupancy code):**
1. `scheduler.js` Job 15 `reconcileOccupancyIntegrity` — when recomputing `liveCount` for a room, ADD
   `ScheduledRoomTransfer.countDocuments({ destinationRoomId: room._id, status: {$in: ["scheduled","action_required"]} })`.
   And in the bed-pointer Pass B, skip a `reserved` bed whose `occupiedBy.reservationId` has an open
   `ScheduledRoomTransfer` naming that `destinationBedId`.
2. `roomsController.js` `syncRealtimeBedStatuses` / list serializer — same: a `reserved` bed backed by
   an open `ScheduledRoomTransfer` is kept (not demoted to `available`), and `liveOccupancy` includes
   open scheduled-transfer holds for the room.
3. `occupancyManager.js` `deriveRoomOccupancyState` — accept an optional `scheduledHolds` array; a held
   bed renders `status: "reserved"` with an `occupant` snapshot flagged `scheduledIncoming: true`;
   `currentOccupancy` counts it. (Callers that don't pass holds are unchanged.)

Net effect: the destination shows one fewer available slot / bed everywhere availability is read
(booking gate, admin display, analytics, dashboards), the scheduled tenant is **never** shown as a
current resident of the destination (their reservation `roomId` is still the source; the held bed's
occupant snapshot is explicitly `scheduledIncoming`), and Job 15 no longer fights the hold.

Release = exact reverse (`bed.status="available"`, clear `occupiedBy`, `atomicDecreaseOccupancy`),
done inside the cancellation / departure / (net-zero) execution transaction.

---

## Phase 2B — model

`server/models/ScheduledRoomTransfer.js` — see field list in the task. Indexes:
- `{ status: 1, effectiveTransferDate: 1 }` — cron due-scan
- `{ reservationId: 1, status: 1 }` — lookups
- partial-unique `{ reservationId: 1 }` where `status ∈ {scheduled, action_required}` — at most one open schedule per reservation

Register in `server/models/index.js`. No migration. `pendingTransfer*` fields left untouched/unused.

---

## Phase 2F — scheduler timing (VERIFIED)

Job 0 `generateAutomatedRentBills` runs `cron.schedule('0 0 * * *', …, {timezone: 'Asia/Manila'})`
(`scheduler.js:1312`) — **00:00 Manila**.

Rent-cycle boundaries are move-in-date-anchored (`billingPolicy.resolveCurrentBillingCycle`), NOT
calendar-month. A tenant who moved in on the 20th has cycles the 20th→19th. So "the regular rent Bill
that belongs to the post-transfer period" is only mis-attributed if the executor runs AFTER Job 0 has
already generated that cycle's Bill for the source room on the same day the cycle rolls over AND the
transfer effective date == that cycle-start date.

Decision: **Job 20 (scheduled-transfer executor) at `10 0 * * *` — 00:10 Manila, 10 minutes AFTER Job 0**,
NOT 00:15 and NOT before Job 0. Rationale:
- Running BEFORE Job 0 would mean a transfer effective "today" flips `recurringRentRate` to the
  destination rate, then Job 0 generates *today's* rent Bill at the destination rate — correct for a
  same-day cycle roll, but for a tenant whose cycle does NOT roll today it's fine too (no Bill
  generated). Running before Job 0 is actually the safer ordering for the "Sep 5 = first day of
  destination responsibility" invariant.
- **Revised decision: `55 23 * * *` is wrong (day-boundary risk). Use `5 0 * * *` — 00:05 Manila,
  BEFORE Job 0 (00:00)? No — cron 0 0 fires first.** Final: **Job 20 at `10 0 * * *` (00:10), and the
  executor, when it commits a transfer whose effectiveDate == today's rent-cycle-start for that
  tenant, checks for an already-generated source-room rent Bill for the current cycle and, if found,
  corrects it to the destination rate + room (same idempotent path `transferStayWorkflow` uses for the
  settlement).** This keeps a single deterministic ordering and repairs the one race rather than
  depending on sub-minute cron sequencing.
- Never executes on Sep 4 Manila: due-scan cutoff = `toManilaStartOfDay(now).add(1,'day')`, identical
  to `activateDueRenewalContracts` (`contractRenewalActivationService.js:55`).

### 2G RESOLUTION — no repair logic, Job 20 at `10 0 * * *` Manila

`generateAutomatedRentBills` -> `ensureCurrentCycleRentBill` -> `buildRentBillingCycle`:
`generationDate = billingCycleStart - RENT_GENERATION_LEAD_DAYS` (= 14), and Job 0 only creates a Bill
when `toManilaStartOfDay(now).isSame(generationDate, "day")`. So Job 0 NEVER generates the transferred
tenant's rent Bill at 00:00 on the effective date — it was created 14 days earlier (cycle spanning the
transfer, at the source rate, correct then) or is created 14 days before the next cycle (after
cutover, at `recurringRentRate` = destination). Nothing to repair.

**Decision: Job 20 at `10 0 * * *` (00:10 Asia/Manila), right after Job 0. No pre-midnight trigger, no
same-day rent-bill reconciliation.** The settlement's `resolveApplicablePrepaidRentForTransfer`
already reads the current cycle Bill's `paidAmount`; future cycles use `recurringRentRate`.

### 2G — Bill reuse

`transferStayWorkflow` always `Bill.create`s a `transfer_settlement` Bill. Minimal adaptation:
`payload.scheduledTransferBillId` (+ `payload.__scheduledTransferId`). When present, the workflow
re-uses that Bill: recompute `transferCharges`, assert its `charges.rent`/`charges.securityDeposit`
equal the recompute (mismatch => abort `ROOM_TRANSFER_SCHEDULED_BILL_MISMATCH`), refresh
cycle/notes/transferSnapshot to execution-time values, keep `paidAmount`/`status`/history,
`syncBillAmounts`. Excess-rent `TenantCredit` + deposit ledger keep their predecessor-Contract
idempotency keys, so a retried execution never double-creates.

**The EXECUTOR owns the financial gate; the workflow only runs when already safe:**
1. re-fetch + operational validation -> fail => `action_required`
2. payment gate: unpaid/partial Bill => `action_required` TRANSFER_BALANCE_UNPAID
3. live revalidation: `computeRoomTransferPreview(effectiveDate)`, compare
   `rentAdjustment + deposit.balanceDue` vs the Bill's `rent + securityDeposit`:
     - equal (<=P0.01)               -> proceed, pass `scheduledTransferBillId`
     - higher                        -> add the delta to the Bill, => `action_required` ADDITIONAL_BALANCE_DUE
     - lower AND Bill was paid        -> => `action_required` FINANCIAL_ADJUSTMENT_REQUIRED (Bill untouched)
     - zero-balance schedule now owes -> create the Bill, => `action_required` ADDITIONAL_BALANCE_DUE
4. cutover via `transferStayWorkflow({ payload: { ...intent, scheduledTransferBillId, __scheduledTransferId } })`
5. success -> `executed` + `executedSettlement` + notify (dedupe); failure -> `action_required` +
   `lastError` (workflow txn already rolled back everything).

`retryScheduledRoomTransfer` re-runs 1-5 for an `action_required` record only. Job 20 selects ONLY
`status: "scheduled"`.

---

## Phased checkpoints

- 2A ✅ finding above — REPORTED.
- 2B model + `scheduleRoomTransfer` / `cancelScheduledRoomTransfer` services → focused tests.
- 2C controller today/future branch → focused tests.
- 2G/2H/2I/2J executor (`executeDueScheduledRoomTransfers`) + Job 20 → focused tests.
- 2D/2E frontend → web tests.
- Full backend + web + prod build.

No auto-merge. No prod deploy.
