# Master Statuses & Validation Rules

> **Purpose:** Give an AI agent the state vocabulary and non-negotiable
> validation/error rules used across modules.
>
> **Source:** Lilycrest Gil Puyat Developer Workflow Manual, Version 1.0
> --- August 2026. This file is a system-understanding reference. It
> preserves the business rules from the source manual and does not
> invent unresolved rules.

27. Master Status Reference Collected here for quick lookup during
    implementation. Each status is defined in the section that owns it.

27.1 Reservation progression Order Status

1 Draft

2 Submitted

3 Under Review

4 Requirements Incomplete

5 Conditionally Complete

6 Ready for Reservation Payment

7 Reservation Confirmed

8 Ready for Move-In

9 Moved In / Converted to Tenant

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

27.2 Stay Status Meaning

Upcoming Confirmed but not yet moved in

Active Currently occupying

Renewal Decision Pending Approaching contract expiry

Expired -- Occupancy Continuing Term lapsed without a decision

Move-Out Processing Clearance is ongoing

Completed Normal move-out complete

Pre-Terminated Ended before the contract term finished

Terminated Management ended the stay

27.3 Where the other status sets live Status set Section

Inquiry 4.4

Application 5.4

Reservation payment 7.2

Waitlist 11.2

Deposit outcome 13.2

Contract 16.3

Rent bill 17.4

Utility bill 18.10

Proof of payment 19.3

Payment allocation 19.4

Dispute resolution 21.2

Violation 23.4

Account 26.4

28. Validation and Error Checklist Use this as the acceptance checklist
    before any billing-related module is considered done.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

28.1 Reservation and inventory • Do not confirm a reservation without a
verified reservation payment. • Do not allow two active assignments for
the same bed. • Do not exceed room capacity. • Do not let an expired or
cancelled reservation keep blocking a slot. • Recheck availability both
before and after payment. • Do not allow a payment lock to be mistaken
for a confirmed reservation.

28.2 Pricing and contract • Lease type must match the number of months
selected. • The contract rate must match the approved rate snapshot
exactly. • The contract start date must match the actual move-in date,
unless management approves a different legal date with a reason. • The
room and bed on the contract must match the active assignment. • Do not
generate a final contract missing legal name, dates, rate, or deposit. •
Do not allow a rate table edit to alter an approved snapshot.

28.3 Electricity • A closing reading may not be lower than the opening
reading unless a meter replacement is recorded. • Every date in the
billing period must belong to exactly one segment. • Segments must not
overlap. • The occupant count must come from stay history, not the
current room count. • Every move-in, move-out, and transfer must have a
billing treatment. • The sum of all tenant shares must reconcile to the
room total after rounding. • A missing intermediate reading must force
Manual Review Required.

28.4 Payments and notices • Proof showing pending or processing is never
valid. • A reference number must not be reused across payments. • Amount
and receiving account must match before verification. • Uploading proof
must not mark a bill paid automatically. • Every adjustment, waiver, or
override must store a reason and an approver. • An open valid dispute
must pause the termination review clock. • Three notices must produce a
review, never an automatic termination.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL
