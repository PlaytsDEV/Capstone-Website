# Resend Template Setup — Copy/Paste Manifest

Each 16-template .html file in this folder is ready to paste directly into
**Resend Dashboard → Templates → Create Template → HTML**.

Resend merge tags use `{{VARIABLE}}` (HTML-escaped) or `{{{VARIABLE}}}` (raw, used
here only for URLs going into an `href=` so the link itself isn't
double-escaped). The variable names below match exactly what
server/services/email/resendEmailService.js sends — do not rename them in
the template.

Before creating templates, first set `LOGO_URL` — replace the literal
`{{{LOGO_URL}}}` placeholder in each HTML file with your actual logo URL
(e.g. `https://www.lilycrest.space/assets/LOGO-8Ay0b2-y.svg`), or leave it
as a merge tag and pass LOGO_URL as an extra variable if you'd rather not
hardcode it.

For each row below:
1. Open the .html file, paste its contents into a new Resend Template.
2. Set the Subject exactly as shown (Resend subjects also accept merge tags).
3. Save/publish the template, copy its Template ID.
4. Paste that ID into the matching Render env var.

| # | Template Key | .html file | Subject | Variables | Env Var |
|---|---|---|---|---|---|
| 1 | EMAIL_VERIFICATION | `EMAIL_VERIFICATION.html` | Verify your Lilycrest email | USER_NAME, VERIFICATION_URL | `RESEND_TEMPLATE_EMAIL_VERIFICATION` |
| 2 | PASSWORD_RESET | `PASSWORD_RESET.html` | Reset your Lilycrest password | USER_NAME, RESET_URL | `RESEND_TEMPLATE_PASSWORD_RESET` |
| 3 | LOGIN_OTP | `LOGIN_OTP.html` | Your Lilycrest login verification code | USER_NAME, OTP_CODE, EXPIRY_MINUTES | `RESEND_TEMPLATE_LOGIN_OTP` |
| 4 | PASSWORD_CHANGED | `PASSWORD_CHANGED.html` | Your Lilycrest password was changed | USER_NAME, TIMESTAMP, IP_ADDRESS | `RESEND_TEMPLATE_PASSWORD_CHANGED` |
| 5 | INQUIRY_RESPONSE | `INQUIRY_RESPONSE.html` | Re: Your Inquiry - Lilycrest Dormitory | CUSTOMER_NAME, INQUIRY_SUBJECT, RESPONSE, BRANCH_NAME | `RESEND_TEMPLATE_INQUIRY_RESPONSE` |
| 6 | RESERVATION_CONFIRMED | `RESERVATION_CONFIRMED.html` | Reservation Confirmed — {{RESERVATION_CODE}} \| Lilycrest Dormitory | TENANT_NAME, RESERVATION_CODE, ROOM_NAME, BRANCH_NAME, MOVE_IN_DATE | `RESEND_TEMPLATE_RESERVATION_CONFIRMED` |
| 7 | VISIT_APPROVED | `VISIT_APPROVED.html` | Visit Schedule Confirmed — Continue Your Application \| Lilycrest Dormitory | TENANT_NAME, BRANCH_NAME | `RESEND_TEMPLATE_VISIT_APPROVED` |
| 8 | VISIT_STATUS | `VISIT_STATUS.html` | {{STATUS_LABEL}} \| Lilycrest Dormitory | TENANT_NAME, ROOM_NAME, BRANCH_NAME, VISIT_CODE, VISIT_SCHEDULE, PREVIOUS_SCHEDULE, REMARKS, STATUS_LABEL, STATUS_INTRO, NEXT_STEP | `RESEND_TEMPLATE_VISIT_STATUS` |
| 9 | DOCUMENTS_REJECTED | `DOCUMENTS_REJECTED.html` | Action Required: Documents Need Attention — Lilycrest Dormitory | TENANT_NAME, REJECTION_REASON, BRANCH_NAME | `RESEND_TEMPLATE_DOCUMENTS_REJECTED` |
| 10 | BILL_GENERATED | `BILL_GENERATED.html` | {{BILL_TYPE_LABEL}} bill for {{BILLING_MONTH}} \| Lilycrest Dormitory | TENANT_NAME, BILL_TYPE_LABEL, ROOM_NAME, BILLING_MONTH, TOTAL_AMOUNT, DUE_DATE, BRANCH_NAME | `RESEND_TEMPLATE_BILL_GENERATED` |
| 11 | UTILITY_CHARGE | `UTILITY_CHARGE.html` | {{UTILITY_LABEL}} charge for {{BILLING_MONTH}} \| Lilycrest Dormitory | TENANT_NAME, UTILITY_LABEL, BILLING_MONTH, UTILITY_AMOUNT, TOTAL_AMOUNT, DUE_DATE, BRANCH_NAME | `RESEND_TEMPLATE_UTILITY_CHARGE` |
| 12 | PAYMENT_REMINDER | `PAYMENT_REMINDER.html` | {{BILL_TYPE_LABEL}} Reminder — Due {{DUE_DATE}} \| Lilycrest Dormitory | TENANT_NAME, BILL_TYPE_LABEL, BILLING_MONTH, TOTAL_AMOUNT, DUE_DATE, BRANCH_NAME | `RESEND_TEMPLATE_PAYMENT_REMINDER` |
| 13 | OVERDUE_NOTICE | `OVERDUE_NOTICE.html` | Overdue / Penalty Notice — {{BILL_TYPE_LABEL}} \| Lilycrest Dormitory | TENANT_NAME, BILL_TYPE_LABEL, BILLING_MONTH, DAYS_LATE, TOTAL_AMOUNT, PENALTY, DUE_DATE, REASON, NOTICE_VARIANT, BRANCH_NAME | `RESEND_TEMPLATE_OVERDUE_NOTICE` |
| 14 | PAYMENT_APPROVED | `PAYMENT_APPROVED.html` | Payment Approved — {{BILLING_MONTH}} \| Lilycrest Dormitory | TENANT_NAME, BILLING_MONTH, PAID_AMOUNT, BRANCH_NAME | `RESEND_TEMPLATE_PAYMENT_APPROVED` |
| 15 | PAYMENT_REJECTED | `PAYMENT_REJECTED.html` | Payment Proof Rejected — {{BILLING_MONTH}} \| Lilycrest Dormitory | TENANT_NAME, BILLING_MONTH, REJECTION_REASON, BRANCH_NAME | `RESEND_TEMPLATE_PAYMENT_REJECTED` |
| 16 | PAYMENT_RECEIPT | `PAYMENT_RECEIPT.html` | Payment Receipt — &#8369;{{AMOUNT}} \| Lilycrest Dormitory | TENANT_NAME, AMOUNT, DESCRIPTION, BILLED_TO, PAYMENT_METHOD, PAYMENT_DATE, REFERENCE_NUMBER, RESERVATION_CODE, ROOM_NAME, BRANCH_NAME | `RESEND_TEMPLATE_PAYMENT_RECEIPT` |

## Notes per template

- **VISIT_STATUS**: PREVIOUS_SCHEDULE and REMARKS may arrive as empty strings — in Resend, leave the row visible (it will render blank) or use a conditional block ({{#if PREVIOUS_SCHEDULE}}...{{/if}}) if your Resend plan supports it.
- **OVERDUE_NOTICE**: NOTICE_VARIANT is "overdue" or "penalty". If your Resend plan supports conditional blocks, use {{#if (eq NOTICE_VARIANT "penalty")}} to swap the heading to "Penalty Notice"; otherwise the generic "Payment Overdue" heading above covers both.

## After setup

Once every `RESEND_TEMPLATE_*` env var is set on Render, redeploy — production
startup validation will stop warning about missing templates
(server/config/startupValidation.js), and every email type will start
delivering through Resend.
