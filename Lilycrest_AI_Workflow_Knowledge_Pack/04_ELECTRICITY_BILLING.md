# Electricity Billing & Occupancy Segmentation

> **Purpose:** Explain the electricity billing cycle, meter readings,
> occupancy segments, calculations, rounding, approval, and exceptions.
>
> **Source:** Lilycrest Gil Puyat Developer Workflow Manual, Version 1.0
> --- August 2026. This file is a system-understanding reference. It
> preserves the business rules from the source manual and does not
> invent unresolved rules.

18. Electricity Billing Electricity is the most error-prone part of the
    operation, because the number of people sharing a meter changes in
    the middle of a billing cycle. This section is the one to implement
    most carefully.

18.1 The cycle Meter reading is done every 15th of the month. Bills are
normally prepared after the reading and sent around the 17th or 18th.
The due date is one week after the bill was actually sent.

Event Date example

Opening meter reading 15 February

Closing meter reading 15 March

Bill sent 18 March

Due date 25 March

Grace day 26 March

Late fee starts 27 March

Anchor the due date correctly: The due date is seven days after the
actual bill issuance date, not seven days after the reading date. If the
bill goes out late, the due date moves with it.

18.2 Base formulas

Consumption = closing meter reading − opening meter reading

Room charge = consumption in kWh × electricity rate per kWh

Tenant share for a segment = segment room charge ÷ eligible occupants in
that segment

Tenant total = sum of that tenant's shares across all segments

The sample rate is Php 16 per kWh. This must be a configurable setting,
not a constant in code, because the rate can change between cycles.

18.3 Why the period must be split into segments When a tenant moves in,
moves out, or transfers rooms during the cycle, the occupant count
changes. Dividing the whole month by the final occupant count would
overcharge the tenants who stayed and undercharge those who left. The
cycle must therefore be cut into segments at every occupancy boundary.

18.4 Full worked computation Billing period 15 February to 15 March.
Tenants A, B, C and D start in the room. Tenant B moves out on 24
February. Rate is Php 16 per kWh.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

Segment Meter readings Consumption Occupant Room charge Tenant A share s

15 Feb -- 24 Feb 1016.61 to 1052.39 35.78 kWh 4 35.78 × 16 = Php 572.48
÷ 4 = Php 572.48 143.12

24 Feb -- 15 Mar 1052.39 to 1091.91 39.52 kWh 3 39.52 × 16 = Php 632.32
÷ 3 = Php 632.32 210.77

Tenant A total = Php 143.12 + Php 210.77 = Php 353.89

This result matches the sample billing supplied by Lilycrest, so it is
the reference case to write the first automated test against.

18.5 The intermediate reading rule When an occupancy change happens
mid-cycle, staff record the meter on that exact date. That single
reading closes the old segment and opens the new one. It must never be
counted twice.

Required detail Example

Room number Room 401

Reading date and time 24 February

Meter value 1052.39 kWh

Reason Tenant B moved out

Related move-out or transfer Link to the stay record

Recorded by Admin or engineer account

Evidence Meter photo, optional but recommended

Verification status Pending or verified

18.6 When the intermediate reading is missing Without a boundary
reading, the exact split cannot be known. The system must say so rather
than produce a confident wrong number.

Bill status when the boundary reading is absent: Manual Review Required

Approved fallback method What must be saved

Use the nearest available reading Which reading, and its date

Apply a management-approved proration The proration basis used

Waive the uncertain portion Waived amount and approver

Enter a manual adjustment Original amount, adjusted amount, reason

18.7 Occupant eligibility Only tenants with an active stay in that room
during that segment are counted. The occupant count must be derived from
stay history, not from the number of people currently in the room.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

    Never include                                         Reason

    Applicants who have not moved in                      No occupancy yet

    Cancelled or expired reservations                     Never occupied the bed

    Former tenants after their move-out date              Consumption is not theirs

    Tenants already transferred out                       They belong to the new room's segment

    Duplicate assignment records                          Would divide the charge incorrectly

18.8 Rounding Tenant amounts are displayed to two decimal places, but
the system keeps the unrounded value for audit. Any one-centavo
difference created by division must be assigned consistently so that the
sum of all tenant shares still equals the room total.

     Php 210.7733 → displayed as Php 210.77 (unrounded value retained)

18.9 Pre-approval summary Before an admin approves any utility bill, the
system must show the following so errors are caught before the bill
reaches tenants. • Total room consumption for the full cycle • Total
room charge for the full cycle • Number of billing segments generated •
Occupant names and count in every segment • Sum of all tenant shares •
Rounding difference between the room total and the sum of shares

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

18.10 Utility bill statuses Status Meaning

Reading Pending The closing reading is not yet recorded

Reading Recorded Readings captured, computation not started

Computation Pending Segments not yet finalised

Manual Review Required Missing or conflicting data

Ready for Review Calculation complete, awaiting approval

Approved Admin approved the computation

Issued Sent to the tenant

Unpaid No verified payment

Proof Submitted Tenant uploaded proof

Under Verification Proof is being checked

Paid Settled

Overdue Past the grace day

Disputed The tenant raised a concern

Adjusted Corrected by an admin with a reason

Cancelled Should no longer be collected
