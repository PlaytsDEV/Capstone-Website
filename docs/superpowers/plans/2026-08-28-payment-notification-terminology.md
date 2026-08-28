# Payment Settlement Terminology & Toast Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove inaccurate "Payment Approved" terminology for automated bill payments, update notification and email services to "Payment Confirmed", and prevent duplicate stacked toast popups on payment return redirects.

**Architecture:** Update backend notification service and email templates to use "Payment Confirmed" semantics while preserving backward compatibility in data schemas and mobile push clients. On the frontend, update socket event categorization and add redirect-verification deduplication to suppress redundant overlapping toasts.

**Tech Stack:** Express.js, MongoDB/Mongoose, Resend/Inline HTML Email Builders, Socket.io, React/Vite.

**Spec:** implementation_plan.md

## Global Constraints

- Never use "Payment Approved" for automated gateway (PayMongo) payments.
- Retain schema compatibility: keep `"payment_approved"` in the Notification enum alongside `"payment_confirmed"`.
- Notification message wording: `"Your payment of ₱{amount} for {month} has been received and confirmed."`
- Email subject wording: `"Payment Confirmed — {month} | Lilycrest Dormitory"`
- Deduplicate on-page redirect toasts and live socket toasts so only one success message appears.

---

### Task 1: Update Backend Notification Model & Service

**Files:**
- Modify: `server/models/Notification.js`
- Modify: `server/services/notifications/notificationService.js`
- Test: `server/controllers/paymentController.test.js`
- Test: `server/controllers/webhookController.test.js`
- Test: `server/controllers/billingController.test.js`

**Interfaces:**
- `notify.paymentApproved(userId, billingMonth, amount, options)` / `notify.paymentConfirmed(...)`
- Produces: `{ title: "Payment Confirmed", message: "Your payment of ₱{amount} for {billingMonth} has been received and confirmed.", type: "payment_approved" | "payment_confirmed" }`

- [ ] **Step 1: Write / update failing tests for notification message and title**
- [ ] **Step 2: Run tests to verify failure**
  - Run: `npm test -- controllers/paymentController.test.js controllers/webhookController.test.js controllers/billingController.test.js`
  - Expected: FAIL due to string mismatch ("Payment Approved" vs "Payment Confirmed")
- [ ] **Step 3: Implement notification service and schema updates**
  - In `server/models/Notification.js`: Add `"payment_confirmed"` to the `type` enum.
  - In `server/services/notifications/notificationService.js`: Update title to `"Payment Confirmed"`, message to `"Your payment of ₱${formattedAmount} for ${billingMonth} has been received and confirmed."`, push type to `"payment_confirmed"`. Export alias `paymentConfirmed: paymentApproved`.
- [ ] **Step 4: Run tests to verify they pass**
  - Run: `npm test -- controllers/paymentController.test.js controllers/webhookController.test.js controllers/billingController.test.js`
  - Expected: PASS
- [ ] **Step 5: Commit**
  - `git commit -m "fix(billing): update payment notification title and message to Payment Confirmed"`

---

### Task 2: Update Email Templates & Registry

**Files:**
- Modify: `server/services/email/builders/billingEmails.js`
- Modify: `server/services/email/emailRegistry.js`
- Modify: `server/config/email.js`
- Test: `server/services/email/lilycrestEmailService.test.js`
- Test: `server/config/email.test.js`

**Interfaces:**
- `buildPaymentApprovedEmail({ TENANT_NAME, BILLING_MONTH, PAID_AMOUNT, BRANCH_NAME })`
- `EMAIL_TEMPLATES.PAYMENT_APPROVED.subject`

- [ ] **Step 1: Write / update tests for email template subject and content**
- [ ] **Step 2: Run tests to verify failure**
  - Run: `npm test -- services/email/lilycrestEmailService.test.js config/email.test.js`
  - Expected: FAIL
- [ ] **Step 3: Update billing email builders and registry**
  - In `server/services/email/builders/billingEmails.js`: Update heading and badge to `"Payment Confirmed"`, body to `"Your payment of <strong>${escapeHtml(amount(PAID_AMOUNT))}</strong> for <strong>${escapeHtml(BILLING_MONTH)}</strong> has been received and confirmed."`
  - In `server/services/email/emailRegistry.js`: Update subject to `` `Payment Confirmed — ${v.BILLING_MONTH} | Lilycrest Dormitory` ``
  - In `server/config/email.js`: Export `sendPaymentConfirmedEmail` alias.
- [ ] **Step 4: Run tests to verify they pass**
  - Run: `npm test -- services/email/lilycrestEmailService.test.js config/email.test.js`
  - Expected: PASS
- [ ] **Step 5: Commit**
  - `git commit -m "fix(email): update payment confirmation email subject and copy"`

---

### Task 3: Frontend Redirect Toast Deduplication & Socket Handling

**Files:**
- Modify: `web/src/features/tenant/components/profile/BillingTab.jsx`
- Modify: `web/src/shared/hooks/useSocketClient.js`

**Interfaces:**
- `useSocketClient.js` handling `payment_confirmed` notification type
- `BillingTab.jsx` suppressing redundant socket toast while return redirect is actively handling payment verification

- [ ] **Step 1: Update useSocketClient.js regex for payment notification types**
  - Verify that `toastType` regex matches `/completed|approved|verified|success|paid|confirmed/i` for success styling.
- [ ] **Step 2: Add session deduplication in BillingTab.jsx**
  - Prevent duplicate simultaneous popups when returning from PayMongo.
- [ ] **Step 3: Run web build check**
  - Run: `npm run build` in `web/`
  - Expected: PASS with 0 build errors
- [ ] **Step 4: Commit**
  - `git commit -m "fix(billing): deduplicate return redirect payment toasts"`

---

## Verification Plan

### Automated Tests
```powershell
cd Capstone-Website/server
npm test -- controllers/paymentController.test.js controllers/webhookController.test.js controllers/billingController.test.js services/email/lilycrestEmailService.test.js config/email.test.js

cd ../web
npm run build
```

### Manual Verification
1. Log in as a tenant and navigate to `/billing`.
2. Pay an active bill via PayMongo.
3. Observe that upon redirection back, a single clean "Payment Confirmed" / "Payment successful" toast appears.
4. Open the Notification Bell and check that the new notification reads "Payment Confirmed".
5. Check that confirmation emails read "Payment Confirmed".
