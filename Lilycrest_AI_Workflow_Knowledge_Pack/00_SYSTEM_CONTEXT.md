# Lilycrest System --- AI Context & Global Workflow

> **Purpose:** Give an AI coding agent the global mental model,
> lifecycle, invariants, and implementation principles before it touches
> any module.
>
> **Source:** Lilycrest Gil Puyat Developer Workflow Manual, Version 1.0
> --- August 2026. This file is a system-understanding reference. It
> preserves the business rules from the source manual and does not
> invent unresolved rules.

1.  Purpose and Source Basis This manual describes how Lilycrest Gil
    Puyat actually operates as a dormitory, and translates that into
    rules the LILIORA system must enforce. It is written for developers,
    but deliberately in plain language so that the operations staff who
    supplied these rules can read it back and correct us. Every workflow
    below follows one tenant along a single timeline: inquiry, viewing,
    application, reservation, payment, move-in, contract, monthly
    billing, utilities, and finally renewal or move-out.

1.1 What this manual covers • Inquiry capture, viewing, and approved
viewing waivers • Online registration, document checking, and
conditional approval • Rate selection, lease type derivation, and rate
snapshots • Reservation fee, slot locking, and first-come first-served
control • Accepted and prohibited payment methods • Advance rent,
security deposit, and the initial balance formula • Room and bed
inventory, capacity checks, and the lower-bed waitlist • Move-in
readiness, tenant activation, and house rules acknowledgment • Lease
contract preparation, signing, notarization, and versioning • Monthly
rent billing driven by the actual move-in date • Electricity billing
split by segment when occupancy changes mid-cycle • Proof-of-payment
verification, partial payments, and allocation • Grace day, daily late
fee, the three-notice process, and disputes • Room transfer, violations,
renewal, early termination, and move-out clearance

1.2 Source basis The rules here come from the Lilycrest interview
transcripts, the 1 January 2026 Gil Puyat price list, Annex A of the
house rules, the sample two-page lease contract, and the sample
quadruple-sharing electricity bill for 15 February to 15 March 2026.
Where two sources disagree, this manual names the conflict rather than
quietly picking a side.

    Important: The system must not guess a missing business rule. Anything still unconfirmed belongs in
    admin settings or behind a manual approval step. A hard-coded guess becomes invisible policy the
    moment it ships.

2.  The Tenant Journey at a Glance The whole operation is one pipeline.
    A person changes category only when a specific, verifiable event
    occurs --- never because a form was opened or a message was sent.

           Inquiry           ›   Viewing      ›        Application     ›   Reservation Fee     ›    Room / Bed Confirmed

    Initial Payment › Move-In › Contract Active › Monthly Billing ›
    Renew or Move-Out

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

A person is not a tenant merely because they asked about a room. They
become a reserved applicant only after the registration form and the
reservation payment are both accepted. They become an active tenant only
after move-in is actually completed and recorded.

2.1 Person categories and their system records Category What it means
Main system record

Inquirer Asking about rooms and rates. No slot is held. Inquiry

Applicant Submitted personal details and requirements. Application

Reserved applicant Reservation fee verified and a slot confirmed.
Reservation + verified payment

Ready for move-in Initial balance settled and requirements complete.
Move-in checklist

Active tenant Physically moved in and activated. Stay + room/bed
assignment

Former tenant Move-out and clearance complete. Completed stay +
clearance

3.  Core Rules the System Must Never Break If a developer remembers
    nothing else from this manual, it should be these.

1 A submitted registration form is not a reservation. 2 A slot becomes
reserved only when the Php 2,000 reservation fee is verified --- not
when proof is uploaded. 3 Rent due dates follow the actual move-in date,
not the requested one. 4 Never bill the first month twice: the one-month
advance already covers it. 5 Save the exact approved rate and discount
as a snapshot; later price changes must not rewrite history. 6 Never
allow two active tenants on the same bed, and never exceed room
capacity. 7 Split the electricity bill into segments whenever the
occupant count changes mid-cycle. 8 Record an intermediate meter reading
on every move-in, move-out, and transfer. 9 A payment screenshot showing
processing, pending, or scheduled is not proof of a completed transfer.
10 Uploading proof must never mark a bill paid automatically. 11 Apply
exactly one grace day, then start the Php 50 per day late fee. 12 Three
notices trigger an admin review --- never an automatic lease
termination. 13 Never auto-renew an expired contract without a recorded
tenant decision. 14 Never delete a tenant account after move-out;
deactivate access instead. 15 Every waiver, adjustment, and override
must store a reason and an approver.

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
a guess in code becomes undocumented policy the moment it ships. \## AI
Implementation Contract

When modifying the system:

1.  Treat inventory, approved pricing snapshots, payment verification,
    occupancy history, and actual move-in dates as authoritative
    sources.
2.  Never infer a reservation from form submission alone.
3.  Never mark payment as paid merely because proof was uploaded.
4.  Never mutate historical rate snapshots when the master rate changes.
5.  Never allow inventory overlap, duplicate active bed assignments, or
    capacity violations.
6.  When occupancy changes during an electricity cycle, use the required
    segment/intermediate-reading workflow.
7.  Any waiver, adjustment, override, custom rate, or manual release
    must have a reason and approver recorded.
8.  Three overdue notices create an admin termination review; they do
    not automatically terminate the lease.
9.  Move-out deactivates access; it does not delete the tenant account.
10. If a rule is unresolved in the source manual, keep it configurable
    or require manual approval. Do not hard-code a guess.
