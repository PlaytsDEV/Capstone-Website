# Inquiry → Application → Pricing Workflow

> **Purpose:** Explain how a person enters the system, becomes an
> applicant, is reviewed, and receives a frozen pricing decision.
>
> **Source:** Lilycrest Gil Puyat Developer Workflow Manual, Version 1.0
> --- August 2026. This file is a system-understanding reference. It
> preserves the business rules from the source manual and does not
> invent unresolved rules.

4.  Inquiry and Viewing The pipeline starts the moment someone asks
    about a room. Staff must be able to save that person even when they
    are not yet ready to apply, because inquiry sources feed the
    marketing reports Lilycrest wants later.

4.1 Inquiry sources and captured fields Applicants reach Lilycrest
through Facebook, TikTok, Instagram, text message, walk-in, building
signage, or referral.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

    Field                                 Example                                           Notes

    Full name                             Tenant A                                          Required

    Contact number                        09xx xxx xxxx                                     Required

    Email address                         tenant@example.com                                Required for billing later

    Preferred branch                      Gil Puyat                                         Drives inventory lookup

    Preferred room type                   Quadruple sharing                                 Drives the quoted rate

    Target move-in date                   10 September 2026                                 Provisional only

    Expected length of stay               6 months                                          Derives the lease type

    Source                                Facebook                                          Required for the source report

    Viewing choice                        Schedule viewing                                  Or request a waiver

4.2 The viewing process Lilycrest recommends viewing before reservation.
The reason is practical: an applicant who reserves sight-unseen may
arrive, dislike the room, and then ask for a refund of a non-refundable
fee.

        Inquiry received     ›   Viewing recommended   ›      Applicant visits         ›      Room or bed shown     ›     Applicant decides

1 Staff explain the room types, current rates, and the basic house
rules. 2 Applicant selects a viewing schedule. 3 After viewing, the
applicant decides whether to continue to registration. 4 If the
applicant cannot view, staff record a viewing waiver reason.

4.3 When viewing is skipped Applicants from outside Metro Manila, or
those needing urgent accommodation, may proceed without viewing. This is
an exception, so the system must make it visible rather than silent. • A
written reason is mandatory --- the field cannot be left blank. • An
admin must approve the waiver, and the approver is recorded. • The
applicant must acknowledge the waiver before the reservation continues.

    Accepted waiver reason                                                       Evidence expected

    Applicant is from another province                                           Address on the submitted valid ID

    Applicant needs immediate accommodation                                      Stated target move-in within days

    Applicant personally chose not to view                                       Written acknowledgment

    Management approved an exception                                             Named approver and reason


     Required acknowledgment text: “I understand that I am continuing with the reservation without viewing the
     actual room.” Store the acknowledgment with a timestamp and the account that gave it.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

4.4 Inquiry statuses Status Meaning

New Inquiry Captured, no action taken yet

Viewing Scheduled A viewing date and time are set

Viewing Completed The applicant saw the property

Viewing Waived Proceeding without viewing, with an approved reason

Converted to Application Registration has started

Closed The inquiry did not continue

5.  Registration and Application Review After viewing, or after an
    approved waiver, Lilycrest sends the registration form and the list
    of requirements. The current manual process runs on email and Google
    Forms; the system replaces that with a single tracked application
    record.

5.1 Information the application must collect Group Fields

Personal details Complete legal name, birth date, current home address,
mobile number, email address

Emergency contact Name, relationship, contact number

Background School or employer, occupation or student status

Reservation details Branch, room type, bed preference, planned move-in
date, number of months of stay

Documents Valid government ID, school or company ID when needed, NBI
clearance when needed, applicant photo

Viewing Viewing status, or waiver reason and acknowledgment

5.2 Review steps 1 Applicant submits the online registration form. 2
System validates required fields, file types, and file sizes. 3 Admin
reviews identity, documents, room choice, lease duration, and move-in
date. 4 If a document is missing, admin records the exact missing item
and a deadline. 5 If an alternative document is accepted, admin records
the reason and the approving person. 6 When the application passes, the
system prepares the reservation payment request.

5.3 Conditionally complete applications Lilycrest may accept another
valid ID when the NBI clearance is not yet available, provided the
applicant asks permission. This is a real state, not an edge case, so it
needs its own status and its own audit trail.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

Saved value Example

Missing requirement NBI clearance

Temporary replacement Valid government ID

Deadline to submit Before move-in

Approval reason Clearance appointment already booked

Approved by Admin account and timestamp

System rule: A conditionally complete application must block move-in
readiness once the deadline passes, unless an admin extends it with a
new recorded reason.

5.4 Application statuses Status Use it when

Draft Applicant has not submitted yet

Submitted The form was sent

Under Review Admin is checking the submission

Requirements Incomplete Something required is missing

Conditionally Complete A temporary document was approved with a deadline

Ready for Reservation Payment The application passed basic review

Reservation Confirmed Payment verified and the slot is held

Rejected The application cannot continue

Withdrawn The applicant stopped before confirmation

Cancelled Lilycrest cancelled it after confirmation, with a reason

Expired The reservation validity period lapsed

Converted to Tenant Move-in completed and the stay record opened

6.  Rates, Discounts, and Lease Type

6.1 January 2026 Gil Puyat rates Room type Long-term Short-term Charging
unit

Quadruple sharing Php 5,400 Php 6,300 Per person

Double sharing Php 7,200 Php 8,000 Per person

Private room Php 13,500 Php 14,400 Per room

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

6.2 Lease type is derived, never typed

Short-term lease = 1 to 5 months

Long-term lease = 6 to 12 months

The system derives the lease type from the selected number of months. An
admin must not be able to mark a five-month stay as long-term, or a
six-month stay as short-term, unless management formally changes the
policy in settings.

Selected stay Derived lease type Quadruple rate applied

4 months Short-term Php 6,300 per person

6 months Long-term Php 5,400 per person

12 months Long-term Php 5,400 per person

6.3 The rate snapshot A rate snapshot is a frozen copy of the exact
price approved for one applicant. When Lilycrest updates the master
price list next month, every already-approved reservation and contract
must keep its original price.

Saved value Why it is needed

Regular rate Shows the published base price at the time

Discount percentage Shows the approved promotion

Discount amount Auditable peso value, not just a percentage

Final monthly rate The figure actually used for billing

Room type and lease type Ties the price to what was sold

Rate effective date Identifies which price list was used

Promotion name Links the discount to a campaign

Approved by and approval date Accountability for manual overrides

Reason for custom rate Mandatory whenever the rate is edited by hand

Example: Regular rate Php 6,000 − 10% discount = Final monthly rate Php
5,400

Do not recalculate old records: Editing the master rate table must
affect only new or not-yet-approved applications. Existing snapshots are
immutable.
