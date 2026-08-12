# Payments → Verification → Late Fees → Disputes

> **Purpose:** Explain proof-of-payment verification, allocation,
> partial payments, late fees, notices, escalation, and billing
> disputes.
>
> **Source:** Lilycrest Gil Puyat Developer Workflow Manual, Version 1.0
> --- August 2026. This file is a system-understanding reference. It
> preserves the business rules from the source manual and does not
> invent unresolved rules.

19. Proof of Payment and Verification Since cash is not accepted, every
    peso received arrives with an external transaction behind it.
    Verification is what turns a screenshot into a settled bill.

19.1 What a complete proof must show 1 A successful transfer status 2
The transaction date 3 The reference number 4 The Lilycrest receiving
account details 5 The exact amount paid

Status shown on the proof Accepted as payment?

Successful / Completed Yes, subject to verification

Processing No

Being processed No

Pending No

Scheduled No

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

19.2 Verification steps 1 Tenant uploads proof, or the payment provider
sends a successful event. 2 System checks image readability and the
presence of required details. 3 Admin checks amount, date, status,
reference number, and receiving account. 4 System searches for a
duplicate reference number across all payments. 5 Admin links the
payment to one or more specific bills. 6 Only after verification does a
bill become Paid or Partially Paid.

    Proof uploaded is not payment verified: Never let an upload event change a bill status on its own. The upload
    changes the proof status; only a verification changes the bill status.

19.3 Proof of payment statuses Status Meaning

Not Submitted No proof yet

Submitted Waiting for review

Incomplete Missing one or more required details

Processing Status Shown Not a completed transfer

Under Verification Being checked

Verified Accepted

Rejected Invalid proof

Duplicate The reference number was already used

Amount Mismatch The amount does not match the bill or allocation

Account Mismatch Sent to an account that is not Lilycrest's

19.4 Partial and combined payments One transfer may cover several bills,
and one bill may be settled by several transfers. Allocation must always
show exactly how much of each payment was applied to which bill.

Allocation result Meaning

Fully Paid The bill is completely settled

Partially Paid A balance remains on the bill

Overpaid The payment exceeded the bill total

Unallocated Balance Money received but not yet applied to any bill

    Example: bill Php 1,000, payment Php 600 → remaining Php 400, status Partially Paid

19.5 Payment date versus upload date If a transfer succeeded on time but
the proof was uploaded later, the system should use the verified
transaction date when assessing lateness.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

Event Date

Payment actually made 25 March

Proof uploaded by the tenant 27 March

Date used for late fee assessment 25 March --- no late fee

Keep this configurable: This rule is a reasonable default but has not
been finally confirmed by Lilycrest. Expose it as a setting so the
policy can be flipped without a code change.

20. Late Fees, Notices, and Escalation

20.1 The one-day grace rule Day relative to due date Result

Due date No late fee

One day after Grace day, still no late fee

Two days after First Php 50 late fee

Three days after Php 100 total

Four days after Php 150 total

Penalty days = payment date − penalty start date + 1

Penalty = penalty days × Php 50

20.2 Worked example based on the sample bill Date Status Penalty

25 March Due date Php 0

26 March Grace day Php 0

27 March First late day Php 50

28 March Second late day Php 100

29 March Third late day Php 150

20.3 The three-notice process

         Bill overdue       ›        Notice 1            ›        Notice 2         ›            Notice 3             ›   Termination review

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

    Notice               Sent when                           Must contain

    Notice 1             The bill becomes overdue            Original bill amount, current penalty, updated total, payment
                                                             instructions, proof requirements

    Notice 2             Still unpaid after Notice 1         Days overdue, current penalty, date of the previous notice,
                                                             warning that the case may be escalated

    Notice 3             Still unpaid after Notice 2         Full outstanding balance, total penalty, history of previous
                                                             notices, final response deadline, warning of lease termination
                                                             review

20.4 What every notice must record • Notice number and the date sent •
Tenant email or channel used, and the delivery result • Amount due,
current penalty, and total balance at the time of sending • Any tenant
response received • The admin who approved the notice

20.5 Lease termination review After three valid notices the system
creates a termination review. It must never end a lease by itself.

    Admin decision                                     Meaning

    Allow more time                                    A new deadline is approved and recorded

    Approve payment arrangement                        Installment plan or promised date recorded

    Waive part of the penalty                          Requires a reason and an approver

    Continue monitoring                                No termination action yet

    Issue final demand                                 Formal last written demand

    Start lease termination                            Formal action begins under Section 25

    Dismiss escalation                                 The case is closed

Before deciding, the reviewer needs the amount due, days overdue, notice
history, full payment history, tenant responses, any open dispute, any
payment promise, prior waivers, and the governing contract terms.

21. Billing Disputes Tenants must be able to question a bill through the
    system rather than through a private message that leaves no record.
    Utility bills in particular invite disputes, because the tenant
    cannot see the meter arithmetic themselves.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

21.1 Dispute workflow

              Tenant raises concern       ›                    Bill marked Disputed                   ›         Admin checks readings


            Admin checks occupancy        ›                    Recompute or confirm                   ›           Resolution issued

1 Tenant opens a billing concern against a specific bill. 2 The bill is
marked Disputed and the reason is stored. 3 Admin re-checks the meter
readings and the intermediate reading, if any. 4 Admin re-checks the
occupant list and the move-in, move-out, and transfer dates used for
each segment. 5 Admin either recomputes the bill or confirms the
original figure. 6 A written resolution is issued to the tenant and
stored against the bill.

21.2 Possible resolutions Resolution Effect on the bill

Billing Confirmed Original amount stands

Billing Adjusted Amount changed, with reason and approver

Reading Corrected Meter value fixed and segments recomputed

Occupant Count Corrected Segment shares recalculated

Rate Corrected Electricity rate fixed and the bill recomputed

Charge Waived Specific charge removed, with approval

Dispute Rejected No change; the reasoning is recorded

    Disputes pause escalation: A valid unresolved dispute must suspend the termination review clock for the
    disputed bill. Continuing to escalate while an official concern is open is both unfair and a support
    problem.
