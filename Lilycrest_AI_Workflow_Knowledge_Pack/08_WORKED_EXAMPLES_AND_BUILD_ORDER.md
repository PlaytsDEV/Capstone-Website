# Worked Scenarios, Build Order & Open Questions

> **Purpose:** Provide concrete scenarios for testing and the safe
> implementation order, while clearly isolating unresolved business
> rules.
>
> **Source:** Lilycrest Gil Puyat Developer Workflow Manual, Version 1.0
> --- August 2026. This file is a system-understanding reference. It
> preserves the business rules from the source manual and does not
> invent unresolved rules.

29. Worked Example Scenarios

29.1 Example A: new quadruple long-term tenant 1 Tenant views the dorm
and submits a six-month application. 2 System derives long-term and
applies the quadruple rate of Php 5,400 per person. 3 Tenant pays the
Php 2,000 reservation fee; admin verifies it. 4 A specific bed is
confirmed and the reservation validity clock starts. 5 Initial balance
is Php 5,400 + Php 5,400 − Php 2,000 = Php 8,800. 6 Tenant moves in on
10 January; the next regular rent falls due 10 February. 7 The contract
is finalized using the actual room, bed, dates, and approved price.

29.2 Example B: occupant moves out mid-cycle 1 Opening reading on 15
February is 1016.61 kWh with four occupants. 2 Tenant B moves out on 24
February; the intermediate reading is 1052.39 kWh. 3 Segment 1
consumption is 35.78 kWh; at Php 16 the room charge is Php 572.48, so
each of the four pays Php 143.12. 4 Closing reading on 15 March is
1091.91 kWh with three occupants. 5 Segment 2 consumption is 39.52 kWh;
the room charge is Php 632.32, so each of the three pays Php 210.77. 6
Tenant A's total for the cycle is Php 353.89.

29.3 Example C: utility bill paid late 1 The bill is sent 18 March and
falls due 25 March. 2 26 March is the grace day, so no penalty applies.
3 Payment on 27 March carries a Php 50 late fee. 4 Payment on 28 March
carries Php 100. 5 If it remains unpaid, the system issues Notice 1, 2,
and 3 in sequence. 6 A termination review is created only after the full
notice process is complete.

29.4 Example D: renewal at a new rate 1 The tenant receives the 60-day
reminder before contract expiry. 2 The tenant asks to extend for another
six months. 3 Admin checks room availability, outstanding balances, and
violation history. 4 Admin selects the current published long-term rate
and a new snapshot is created. 5 The tenant accepts and signs a new
contract or an approved extension.

29.5 Example E: disputed electricity bill 1 The tenant questions their
share for the 15 February to 15 March cycle. 2 The bill moves to
Disputed and the termination review clock pauses. 3 Admin finds that a
housemate's move-out on 24 February was never recorded. 4 Occupancy
history is corrected and the segments are recomputed. 5 The resolution
is Occupant Count Corrected; an adjusted bill is issued with the reason
and approver attached.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

30. Implementation Order, Source Notes, and Open Questions

30.1 Module completion criteria Module Minimum output before it counts
as complete

    Inquiry                     Inquiry record, viewing schedule, waiver reason and acknowledgment

    Application                 Field validation, document upload, review statuses, conditional approval

    Rates                       Lease type derivation, rate snapshot, discount approval trail

    Reservation                 Php 2,000 payment, 30-minute slot lock, confirmation rules, validity expiry

    Inventory                   Branch-room-bed hierarchy, capacity and overlap checks, waitlist

    Move-In                     Readiness checklist, actual date capture, tenant activation

    Contract                    Prepared draft, validation gate, PDF generation, signing and version history

    Rent Billing                Move-in-based due dates, advance coverage, grace day, penalties

    Utilities                   15th cycle, occupancy segments, intermediate readings, rounding, pre-approval
                                summary

    Payments                    Proof validation, duplicate reference check, allocation, partial payments

    Notices                     Grace day, daily fee, three notices, dispute pause, review escalation

    Renewal                     Expiry reminders, rate choice, new contract or extension

    Move-Out                    Final reading, inspection, deposit settlement, clearance, access deactivation

    Audit                       Who changed what, when, why, with previous and new values

30.2 Safe build order 1 Build the authoritative room and bed inventory
first --- everything else references it. 2 Build reservation payment and
confirmation rules. 3 Build initial payment and the move-in readiness
checklist. 4 Build contracts on top of the same approved data source,
never a parallel copy. 5 Build rent billing and payment verification. 6
Build electricity segmentation with move-in, move-out, and transfer
readings. 7 Build notices, disputes, renewal, termination, and move-out.
8 Add reporting only once the underlying records and calculations are
reliable.

30.3 Source documents • Lilycrest Gil Puyat reservation and operations
interview transcript • Follow-up interview on branches, billing,
utilities, reports, and priorities • Gil Puyat price list effective 1
January 2026 • Annex A --- Gil Puyat House Rules and Guidelines, January
2026 • Sample two-page lease contract • Sample quadruple-sharing
electricity bill, 15 February to 15 March 2026

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

30.4 Open questions for Lilycrest Each of these must stay configurable
or behind a manual approval until Lilycrest confirms it in writing.

Question Why it matters

Is the grace period officially one day in all One interview used
different wording, while the sample bill and current contracts? house
rules support a single grace day.

What happens to the daily late fee after a It is unclear whether the fee
stops, continues at full rate, or partial payment? applies only to the
remaining balance.

Does lateness follow the transaction date or the The sample requires
proof but does not settle this edge case. proof upload date?

How many days should separate Notice 1, 2, Three notices are required
but no fixed interval is given. and 3?

Must every short-term tenant receive a full Current practice may issue
one only on request, but the system contract? needs a documented stay
agreement either way.

Exactly how many move-in date changes are Around two is the practice,
but the hard limit is not official. allowed?

What is the approved method when no The system cannot compute an exact
split without a boundary intermediate reading exists? reading.

May an expired tenant continue Billing continues in practice, but the
legal basis is undefined. month-to-month, and on what terms?

Can the electricity rate vary from month to Determines whether the rate
is a per-cycle field or a global month? setting.

What is the refund processing period for Tenants will ask, and the
system should show a committed security deposits? timeline.

Who may approve penalty waivers and custom Needed to build the approval
hierarchy and audit trail. discounts?

What is the current rule for utilities in private House rules remain the
main source, but configuration must and double rooms? match actual
operations.

Final developer rule: When a business rule is unclear, surface it in
admin settings or require a manual approval. Never hard-code a guess ---
a guess in code becomes undocumented policy the moment it ships.
