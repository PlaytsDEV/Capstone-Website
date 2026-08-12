# Contract → Monthly Rent Billing

> **Purpose:** Explain contract preparation/versioning and how rent
> bills are generated from the actual move-in date and advance coverage.
>
> **Source:** Lilycrest Gil Puyat Developer Workflow Manual, Version 1.0
> --- August 2026. This file is a system-understanding reference. It
> preserves the business rules from the source manual and does not
> invent unresolved rules.

16. Contract Preparation and Signing Lilycrest currently prepares
    contracts after move-in, because dates and room assignments can
    still change and applicants can cancel. The safer system design
    keeps that habit but adds early visibility: create a prepared draft
    once the reservation is confirmed, then finalize it only after the
    actual move-in details are known.

16.1 Recommended contract flow

        Prepared draft      ›   Move-in confirmed    ›       Validate details   ›       Generate PDF     ›      Print two copies


        Physical signing    ›       Notarize         ›     Upload signed copy   ›          Verify        ›          Active

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

16.2 Required contract data Category Required data

Tenant Complete legal name, home address, contact details

Property Branch legal name and full address

Assignment Room number, and bed or space for shared rooms

Term Start date, end date, number of months, lease type

Price Regular rate, discount, final monthly rate

Payments Advance rent, security deposit, reservation fee credit

Utilities Rules for water and electricity, including sharing method

Documents Contract template version and house rules version

16.3 Contract statuses Status Meaning

Draft Not ready for use

Prepared Initial data inserted from the reservation

Waiting for Move-In Held until the actual move-in is recorded

Ready for Validation All fields populated, awaiting the check

Validation Failed Required data is missing or conflicting

Ready for Printing The final PDF is approved

Printed Two copies produced

Signed Both parties signed physically

Pending Notarization Signed but not yet notarized

Notarized Notary step completed

Verified Signed copy checked and filed

Active The contract is in effect

Extended Term extended by an approved amendment

Completed Ended normally at term

Pre-Terminated Tenant ended the contract early

Terminated Management ended the contract

Archived Retained for records only

Validation gate: The system must refuse to generate a final contract
when the legal name, dates, rate, deposit, room, or bed is missing or
conflicts with the active assignment.

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL

17. Monthly Rent Billing

17.1 Due date rule The monthly rent due date follows the tenant's
move-in day. A tenant who moved in on 10 January normally has a rent due
date on the 10th of every month thereafter.

17.2 Billing steps 1 Create the next bill before the due date, typically
seven days ahead. 2 Show the exact rental period the bill covers. 3 Send
a reminder seven days before and three days before the due date. 4 Send
the due notice on the due date itself. 5 Apply one grace day after the
due date. 6 Start the Php 50 daily late fee on the day after the grace
day. 7 Stop future regular billing once move-out is approved, but still
create the final charges.

17.3 Reminder schedule Timing Action

7 days before due date Generate the bill and send the first reminder

3 days before due date Send the second reminder

Due date Send the due notice

1 day after due date Grace day; no late fee yet

2 days after due date First Php 50 late fee, send the late notice

17.4 Rent bill statuses Status Meaning

Scheduled Created but not yet sent

Issued Visible to the tenant

Unpaid No verified payment received

Partially Paid Some balance remains

Under Verification Proof is being checked

Paid Fully settled

Overdue Past the grace day

Waived Cancelled by approval, with a reason and approver

Adjusted Amount changed by an admin, with a reason

Cancelled Should no longer be collected

LILYCREST GIL PUYAT DEVELOPER WORKFLOW MANUAL
