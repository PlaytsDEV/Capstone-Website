# Transfer → Violations → Renewal → Termination → Move-Out

> **Purpose:** Explain post-move-in lifecycle workflows and how the
> tenant account ends without deleting historical records.
>
> **Source:** Lilycrest Gil Puyat Developer Workflow Manual, Version 1.0
> --- August 2026. This file is a system-understanding reference. It
> preserves the business rules from the source manual and does not
> invent unresolved rules.

22. Room or Bed Transfer A tenant may transfer only with management
    approval. Charges are prorated, and any additional amount is settled
    before the transfer completes.

22.1 Transfer flow

              Request                 ›   Check availability            ›             Compute old room      ›           Compute new room


          Approve quote               ›   Collect difference            ›             Transfer assignment   ›             Update contract

22.2 Effect on electricity The tenant is counted in the old room only up
to the transfer boundary, and in the new room only after it.
Intermediate readings should be taken for both rooms whenever possible.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

    Scenario: transfer from Room 401 to Room 502 on 5 March                                  Charged

    Room 401 share                                                                           15 February to 5 March

    Room 502 share                                                                           5 March to 15 March


     Never double-charge: The tenant must not appear as a full-period occupant in both rooms. Every date in the
     cycle belongs to exactly one room for that tenant.

22.3 Blocking conditions • The target bed is already occupied • The
transfer would exceed the new room's capacity • The computed payment
difference is still unpaid • The old and new assignments would overlap
in time • The utility treatment for the transfer date is incomplete •
The contract amendment or replacement is missing

23. Violations and Warnings Violations must be recorded formally,
    because repeated warnings can become grounds for pre-termination and
    deposit forfeiture. An escalation built on undocumented verbal
    warnings will not hold up.

23.1 Violation workflow

              Report              ›         Review evidence           ›            Tenant informed       ›            Tenant responds


                 Admin decision             ›                 Warning or penalty                ›            Resolved or escalated

23.2 Common violations • Smoking inside the building • Cooking inside
the room • Unauthorized appliance use • Unauthorized visitors • RFID
misuse, including lending the card • Room or bed transfer without
approval • Damage to property • Repeated cleanliness issues • Persistent
unpaid bills

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

23.3 What each violation record stores Saved detail Example

Rule violated No cooking inside the room

Date, time, and place 5 August, Room 402

Evidence Photo or incident note

Warning count for this tenant First warning

Penalty applied Only if allowed by policy

Tenant response Explanation submitted by the tenant

Decision Confirmed or dismissed

Resolution Settled, repeated, or escalated

23.4 Violation statuses Status Meaning

Reported Logged, not yet reviewed

Under Review Admin is checking the evidence

Awaiting Response The tenant has been asked to explain

Confirmed The violation is established

Dismissed Not substantiated

Warning Issued A formal warning was given

Penalty Issued A penalty was applied under policy

Resolved The case is closed

Escalated Referred for pre-termination review

24. Renewal and Contract Expiration

24.1 Reminder schedule Time before expiry System action

60 days First reminder to tenant and admin

30 days Tenant decision formally requested

15 days Admin follow-up on non-responders

7 days Final reminder

Expiry date Unresolved cases escalate to admin review

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

24.2 Tenant choices • Renew or extend • Move out • Undecided • No
response

24.3 Renewal flow

              Request         ›          Review account            ›              Check room            ›         Choose duration


          Set renewal rate    ›          Tenant accepts            ›        New contract or extension   ›            Activate

Before offering renewal, the admin reviews payment history, outstanding
balances, violation history, and room availability for the new term.

24.4 Renewal pricing The system must not silently carry over the old
discount into a new term.

    Admin must choose                                     When it applies

    Keep the previous rate                                Retention decision, requires a reason

    Apply the current published rate                      Default behaviour

    Approve a custom rate                                 Requires a reason and an approver


    New term, new snapshot: Every renewal creates a fresh rate snapshot. The old snapshot stays attached to
    the old contract period.

24.5 No response after expiry In current practice, billing sometimes
continues even when the tenant gives no decision. The system must not
read that as an automatic long-term renewal.

    Stay status when the term lapses without a decision: Expired – Occupancy Continuing

• An admin review is required immediately. • Temporary month-to-month
billing may continue only if approved. • The tenant must still provide a
written decision: renew, extend, or move out. • This keeps billing
accurate without pretending the fixed term is still active.

25. Early Termination Early termination means the tenant leaves before
    completing the agreed period. Under the contract and house rules the
    security deposit may be forfeited, but that outcome is a decision,
    not an automatic calculation.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

25.1 Process 1 The tenant submits an early termination request, or
management opens a termination case. 2 Admin reviews the contract,
unpaid bills, violation history, and the stated reason for leaving. 3
The system marks the deposit as subject to forfeiture --- flagged, not
yet final. 4 Final rent, utilities, penalties, and damage charges are
calculated. 5 Room inspection and clearance are completed. 6 An
authorised admin confirms the final deposit decision and records the
reason.

25.2 Termination categories Category Opened by

Tenant-requested The tenant, with a stated reason

Management-initiated Lilycrest, with documented grounds

Due to unpaid bills Escalation from the three-notice process

Due to repeated violations Escalation from the violation workflow

Special approved release Management discretion, reason required

    Do not automate forfeiture: The system may calculate and propose the deposit outcome, but an authorised
    person must approve the final decision and its reason.

26. Normal Move-Out and Deposit Settlement

26.1 Move-out flow

      Move-out notice       ›   Confirm date   ›      Stop future billing   ›   Final meter reading     ›       Final utilities


      Room inspection       ›   RFID return    ›     Deposit calculation    ›       Clearance           ›     Deactivate access

26.2 Step detail 1 Tenant gives notice; the intended move-out date is
recorded. 2 Admin confirms the move-out date and stops scheduling future
regular bills. 3 A move-out survey is sent to the tenant. 4 A final
meter reading is recorded on the actual move-out date. 5 Final utilities
are computed using the segment rules in Section 18. 6 The room is
inspected and any damage is documented with evidence. 7 The RFID card is
returned, or the Php 1,000 replacement charge is applied. 8 The final
account is prepared and deposit deductions are applied. 9 An authorised
admin approves the refund or forfeiture. 10 Clearance is completed, the
stay is ended, and building access is deactivated.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

26.3 Final account formula

Refundable balance = security deposit

     − unpaid rent − unpaid utilities − penalties

     − damage charges − lost RFID (Php 1,000) − other approved charges

26.4 The account after move-out Do not delete the tenant account.
Building access and RFID must end, but the former tenant may still need
to view final bills, clearance, deposit details, and documents.

Account status Meaning

Applicant Not yet a tenant

Active Tenant Currently occupying

Move-Out Processing Clearance is ongoing

Former Tenant Move-out complete, read-only access retained

Temporarily Inactive Suspended for a recorded reason

Deactivated Access removed, records retained

Returning tenants: A former tenant who comes back must reuse the
existing profile. Creating a duplicate account loses their payment and
violation history, which is exactly the history that matters on return.
