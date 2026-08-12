# Reservation → Inventory → Move-In Workflow

> **Purpose:** Explain slot locking, reservation confirmation,
> availability rules, waitlisting, initial payment, readiness, and
> tenant activation.
>
> **Source:** Lilycrest Gil Puyat Developer Workflow Manual, Version 1.0
> --- August 2026. This file is a system-understanding reference. It
> preserves the business rules from the source manual and does not
> invent unresolved rules.

7.  Reservation Fee and Slot Confirmation The reservation fee is Php
    2,000 for every room type. It is credited against the applicant's
    required initial payment, and it is normally non-refundable if the
    applicant cancels.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

7.1 When a reservation becomes official

      Application submitted   ›    Basic review passed     ›     Php 2,000 verified   ›   Availability rechecked     ›    Reservation confirmed

All four conditions must be true at the same time. The form alone is not
a reservation, and a slot is confirmed only when the payment is verified
and the selected room or bed is still available at that moment.

7.2 Reservation payment statuses Status Meaning

    Awaiting Payment                                 No transaction yet

    Payment Submitted                                Applicant sent proof, or the provider sent an event

    Under Verification                               Staff or the payment provider is checking

    Verified                                         Payment accepted; the slot may now be confirmed

    Rejected                                         The proof is invalid

    Failed                                           The transaction failed at the provider

    Expired                                          The payment window closed

7.3 First-come, first-served control Lilycrest allocates on a
first-come, first-served basis: whoever completes the application and
payment first gets the slot. The system must therefore never block a bed
permanently just because a form was submitted.

         Checkout starts      ›   Bed temporarily locked   ›     Payment completed    ›     Payment verified         ›        Bed reserved


     Recommended temporary payment lock: 30 minutes

• The lock expires automatically and returns the bed to the available
pool. • A failed or abandoned payment releases the lock immediately. • A
lock is not a confirmed reservation and must never appear as one. • When
only one slot remains, two applicants must not both reach a completed
payment for that bed.

8.  Accepted Payment Methods The house rules are explicit that payments
    are made online or through bank deposit. This constrains the payment
    module, so it belongs in the requirements rather than in staff
    memory.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

    Method                                  Status                    Notes

    Online bank transfer                    Accepted                  Reference number required on the proof

    BDO bank deposit                        Accepted                  Deposit slip must show the Lilycrest account

    BPI bank deposit                        Accepted                  Deposit slip must show the Lilycrest account

    Other approved online channel           Accepted if configured    Must be enabled by management in settings

    Cash                                    Not accepted              Do not build a cash tender flow

    Credit card                             Not accepted              Only if management formally adds it later


     Build note: Because cash is not accepted, every payment in the system has an external reference. The
     proof-of-payment workflow in Section 19 is therefore mandatory for all money received, including the
     reservation fee.

9.  Reservation Validity, Date Changes, and No-Shows

9.1 Reservation validity A confirmed reservation does not hold a bed
forever. The normal validity is one month, although Lilycrest may allow
longer in specific cases.

     Default reservation validity: 30 days from confirmation

• A longer validity requires a written reason, an admin approval, and an
explicit approved expiration date. • On expiry the reservation moves to
Expired and the bed returns to inventory. • Expired reservations must
stop blocking availability immediately.

9.2 Move-in date changes Applicants commonly request a different move-in
date, and Lilycrest usually allows around two changes before escalating.

     Normal changes allowed: 2

     More than 2 changes: admin approval required


    Saved on every change                              Example

    Original date                                      10 September 2026

    New date                                           18 September 2026

    Reason                                             Delayed release of school clearance

    Requested by / approved by                         Applicant / admin account

    Change number                                      1 of 2

    Date changed                                       Timestamp of the edit

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

    Cascade rule: Changing the move-in date must recalculate the reservation expiration, the room availability
    window, the initial payment deadline, the contract start and end dates, the billing cycle, and the first rent
    due date. A date change that updates only one field will silently corrupt billing.

9.3 No-show handling A no-show is a confirmed applicant who does not
arrive on the approved move-in date. Lilycrest follows up by email or
call; if there is no reply after one to two days and another applicant
needs the slot, management may release it.

      Move-in date missed   ›   Marked Move-In Overdue   ›          Follow-up sent    ›        Wait 1 to 2 days         ›       Admin decision


    Outcome                                                   System effect

    Applicant reschedules                                     New move-in date recorded, cascade rule applies

    Applicant confirms arrival                                Reservation stays confirmed

    Applicant cancels                                         Reservation cancelled, fee normally forfeited

    No response and slot needed                               Admin releases the bed with a written reason


    Never automate this: Releasing a paid reservation must be an explicit admin decision with a recorded
    reason. The system may flag and recommend, but must not cancel by itself.

10. Room and Bed Availability

10.1 Assignment hierarchy

                Branch            ›               Room type               ›          Room number                  ›           Bed or slot

Shared rooms require a specific bed or slot. Private rooms are charged
per room and may hold up to two approved occupants, but one main tenant
must remain responsible for the billing account.

10.2 When availability must be checked • During application review •
Before the payment request is issued • Before payment confirmation •
Before the room or bed is assigned • Immediately before move-in is
marked complete

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

10.3 Conditions the system must prevent Blocked condition Why

Two active tenants on the same bed Physical impossibility and a billing
conflict

Occupants exceeding room capacity Breaches the house rules and fire
limits

Confirming a reservation for a full room Creates an unfulfillable
obligation

Assigning a tenant to the wrong branch Breaks inventory and utility
reporting

One tenant assigned to two rooms at once Duplicates the utility share

Overlapping move-in and move-out dates Double-counts occupancy for
electricity

Cancelled or expired reservations holding stock Starves real applicants
of slots

10.4 Record structure for an assignment Field Notes

Main tenant Responsible for the billing account

Approved co-occupant Private rooms only, up to the stated limit

Room number Must belong to the assigned branch

Bed or slot number Required for shared rooms

Start date The actual move-in date

End date Contract end, or actual move-out once known

11. Lower-Bed Waitlist Lower beds are consistently in higher demand than
    upper beds and are often full. Lilycrest already keeps an informal
    internal waitlist, so the system should formalise it rather than
    leave it in a chat thread.

11.1 Offer flow

     Lower bed frees up     ›   Waitlist checked           ›   Offer sent to first eligible   ›   Tenant accepts or declines     ›    Next tenant contacted

1 A tenant requests a lower bed and joins the waitlist with a timestamp.
2 When a lower bed becomes available, the system identifies the first
eligible tenant in queue order. 3 An offer is sent with an explicit
response deadline. 4 If the tenant accepts, the room transfer workflow
in Section 22 runs. 5 If the tenant declines or does not respond by the
deadline, the offer expires and the next tenant is contacted.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

11.2 Waitlist statuses Status Meaning

Waiting In queue, no bed available yet

Offered A bed was offered and the deadline is running

Accepted Tenant accepted; transfer workflow begins

Declined Tenant refused this specific offer

Expired No response before the deadline

Transferred The move to the lower bed is complete

Removed Withdrawn by the tenant, or the stay ended

Eligibility rule: Only tenants with an active stay and no unpaid overdue
balance should receive an offer. Declining an offer must not remove a
tenant from the queue unless they ask to be removed.

12. Initial Payment Before Move-In A new tenant pays one month advance
    rent plus one month security deposit. The Php 2,000 reservation fee
    already paid is subtracted from that total.

12.1 Formula

Initial balance =

advance rent + security deposit + approved initial charges − reservation
fee already paid

12.2 Worked example: quadruple sharing, long-term Item Amount

One month advance rent Php 5,400

One month security deposit Php 5,400

Less reservation fee already paid − Php 2,000

Remaining initial balance Php 8,800

12.3 What the advance rent actually covers The advance covers the
tenant's first month, counted from the actual move-in date. The system
must not generate a second regular rent bill for a period the advance
already paid for.

Actual move-in Covered by the advance Next regular rent due

10 January 10 January to 9 February 10 February

25 March 25 March to 24 April 25 April

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

13. Security Deposit The security deposit is generally refundable after
    move-out, but the lease allows it to be applied against unpaid bills
    or damage caused by the tenant. The system should calculate and
    propose; a person approves.

13.1 Permitted deductions • Unpaid rent • Unpaid electricity • Unpaid
water • Penalties and accumulated late fees • Damage to the room,
furniture, or fixtures • Lost RFID card replacement --- Php 1,000 •
Other charges valid under the contract or house rules

13.2 Deposit outcomes Outcome Meaning

    Fully Refundable                 No deductions apply

    Partially Refundable             Some deductions were applied

    Fully Applied                    The deposit exactly covered valid charges

    Forfeited                        Approved forfeiture after early termination or serious breach

    Under Review                     Calculation complete, awaiting an approver

    Under Dispute                    The tenant is questioning the result

    Refunded                         The refund has been released

14. Move-In Readiness and Tenant Activation

14.1 Readiness checklist If any critical item below is unmet, the
applicant must not be marked ready for move-in.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

Checklist item Blocking?

Reservation is confirmed Yes

Initial balance is paid, or an approved arrangement exists Yes

Required documents complete, or an active approved exception Yes

Room and bed assigned Yes

Actual move-in date confirmed Yes

Rate snapshot approved Yes

Emergency contact saved Yes

House rules prepared for acknowledgment Yes

Tenant portal account prepared No, but required before activation

14.2 Move-in day sequence 1 Admin verifies the tenant's identity against
the submitted ID. 2 Admin confirms the actual room and bed, which may
differ from the request. 3 System re-checks the initial payment and any
unresolved requirement. 4 Admin records the actual move-in date and
time. 5 RFID card and access details are issued and logged. 6 Tenant
receives and acknowledges the house rules. 7 The stay record becomes
Active. 8 The contract finalization task is created automatically.

14.3 Why the actual move-in date governs everything The actual move-in
date --- not the requested date, not the reservation date --- is the
anchor for the entire billing life of the tenancy.

Derived from the actual move-in date Example (move-in 10 January)

Monthly rent due day Every 10th of the month

Period covered by the advance 10 January to 9 February

First regular rent due date 10 February

Contract start date 10 January

Contract end date Start date plus the agreed months

Utility sharing start 10 January, within the current meter cycle

Renewal reminder schedule Counted back from the contract end date

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

15. House Rules Acknowledgment Before or during move-in, the tenant must
    acknowledge the house rules. Because repeated warnings can
    eventually justify pre-termination and deposit forfeiture, the
    acknowledgment has to be evidenced, not assumed.

15.1 Rules the tenant is acknowledging • No smoking inside the building
• No cooking inside the rooms • No pets • No room or bed transfer
without management approval • Proper RFID use; cards are not to be
shared or lent • Visitor restrictions as published • Payments only
through the accepted online or bank channels • Responsibility for damage
to the room and its fixtures • Room cleanliness and proper waste
disposal • Responsibility for the tenant's share of utilities

15.2 What the system must store Saved value Why

    House rules version                             Rules change; the tenant agreed to one specific version

    Date given                                      Proves the tenant received them before activation

    Date acknowledged                               Establishes the effective date of the obligation

    Acknowledging account                           Ties the acknowledgment to the tenant

    Signed copy, when collected                     Evidence for any later escalation
