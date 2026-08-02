# Structured Initial Payment v1 — Controlled QA

Use only newly created test Reservations after enabling the feature in a controlled QA environment. Do not opt existing Reservations into this workflow.

Reference values:

- Approved monthly rate: PHP 6,300
- Verified PayMongo Reservation Fee: PHP 2,000
- Advance rent: PHP 6,300
- Security deposit: PHP 6,300
- Remaining initial balance: PHP 10,600
- Actual move-in date: March 23
- Advance coverage: March 23–April 22
- First regular rent period: April 23–May 22
- First regular rent amount and due date: PHP 6,300, due April 23

| Test step | Expected result | Working | Not working | Observed issue | Browser console error | Network/API error | Screenshot or evidence | Tester | Test date |
|---|---|---|---|---|---|---|---|---|---|
| Create a new Reservation while the flag is disabled | No workflow marker is assigned; legacy-compatible behavior remains |  |  |  |  |  |  |  |  |
| Enable the flag and approve a newly eligible Reservation | `structured-initial-payment-v1` and pricing snapshot v1 are stored once |  |  |  |  |  |  |  |  |
| Start Reservation Fee checkout | Applicant is sent to PayMongo for exactly PHP 2,000 |  |  |  |  |  |  |  |  |
| Complete the Reservation Fee through PayMongo | Reservation confirms only after verified provider settlement |  |  |  |  |  |  |  |  |
| Refresh or replay the successful webhook | Exactly one initial-payment Bill exists |  |  |  |  |  |  |  |  |
| Review the initial-payment Bill | PHP 6,300 advance + PHP 6,300 deposit − PHP 2,000 credit = PHP 10,600 |  |  |  |  |  |  |  |  |
| Inspect payment actions | Cash and offline settlement are unavailable; “Continue to PayMongo” is available |  |  |  |  |  |  |  |  |
| Start initial-payment checkout | Server sends the authoritative PHP 10,600 remaining balance |  |  |  |  |  |  |  |  |
| Complete initial payment through PayMongo | Initial Bill becomes Paid, remaining balance is zero, and Reservation becomes financially ready |  |  |  |  |  |  |  |  |
| Attempt move-in without another prerequisite | Move-in remains blocked with a specific, user-readable reason |  |  |  |  |  |  |  |  |
| Record actual move-in as March 23 | Advance coverage becomes March 23–April 22 and next billing date becomes April 23 |  |  |  |  |  |  |  |  |
| Run rent generation for the first rental month | No rent Bill covers March 23–April 22 |  |  |  |  |  |  |  |  |
| Run rent generation for the second rental month | One PHP 6,300 Bill covers April 23–May 22 and is due April 23 |  |  |  |  |  |  |  |  |
| Rerun rent generation and refresh | No duplicate Bill appears |  |  |  |  |  |  |  |  |
| Inspect the first regular Bill | Reservation Fee credit is not applied again |  |  |  |  |  |  |  |  |
| Change current Room or Business Settings pricing | Frozen Reservation, Bill, and Contract pricing remain unchanged |  |  |  |  |  |  |  |  |
| Prepare a Contract | Draft uses the Reservation pricing snapshot and final data uses actual move-in/assignment details |  |  |  |  |  |  |  |  |
| Inspect an existing legacy tenant | Record, balance, occupancy, and workflow remain unchanged |  |  |  |  |  |  |  |  |
