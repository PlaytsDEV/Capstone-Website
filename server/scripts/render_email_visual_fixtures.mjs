import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { EMAIL_TEMPLATES } from "../services/email/emailRegistry.js";
import { normalizeEmailVariables } from "../services/email/lilycrestEmailService.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(here, "..", "..", ".codex-run-logs", "email-visual-qa");
fs.mkdirSync(outputDir, { recursive: true });

const common = {
  TENANT_NAME: "Aya Guest",
  USER_NAME: "Aya Guest",
  BRANCH_NAME: "gil-puyat",
};

const samples = {
  EMAIL_VERIFICATION: { ...common, VERIFICATION_URL: "https://www.lilycrest.space/auth-action?mode=verifyEmail&oobCode=fixture" },
  PASSWORD_RESET: { ...common, RESET_URL: "https://www.lilycrest.space/auth-action?mode=resetPassword&oobCode=fixture" },
  LOGIN_OTP: { ...common, OTP_CODE: "482913", EXPIRY_MINUTES: 10 },
  PASSWORD_CHANGED: { ...common, TIMESTAMP: "August 18, 2026 at 5:30 PM", IP_ADDRESS: "203.0.113.10" },
  INQUIRY_RESPONSE: { ...common, CUSTOMER_NAME: "Aya Guest", INQUIRY_SUBJECT: "Urgent Issue", RESPONSE: "We reviewed your concern and have updated your request.", TICKET_ID: "INQ-2026-000123" },
  RESERVATION_CONFIRMED: { ...common, RESERVATION_CODE: "RES-2026-001", ROOM_NAME: "GP - Room 202", MOVE_IN_DATE: "September 1, 2026" },
  VISIT_APPROVED: common,
  VISIT_STATUS: { ...common, ROOM_NAME: "GP - Room 202", VISIT_CODE: "VST-2026-001", VISIT_SCHEDULE: "August 22, 2026 at 2:00 PM", PREVIOUS_SCHEDULE: "", REMARKS: "Bring one valid ID.", STATUS_LABEL: "Physical Visit Scheduled", STATUS_INTRO: "Your room-viewing schedule is confirmed.", NEXT_STEP: "Attend your scheduled visit before continuing the application." },
  DOCUMENTS_REJECTED: { ...common, REJECTION_REASON: "Please upload a clearer image of your government ID." },
  BILL_GENERATED: { ...common, BILL_TYPE_LABEL: "Electricity", ROOM_NAME: "GP - Room 202", BILLING_MONTH: "September 2026", TOTAL_AMOUNT: "7,200.00", DUE_DATE: "September 28, 2026" },
  UTILITY_CHARGE: { ...common, UTILITY_LABEL: "Electricity", BILLING_MONTH: "September 2026", UTILITY_AMOUNT: "7,200.00", TOTAL_AMOUNT: "7,200.00", DUE_DATE: "September 28, 2026" },
  PAYMENT_REMINDER: { ...common, BILL_TYPE_LABEL: "Electricity", TOTAL_AMOUNT: "7,200.00", DUE_DATE: "September 28, 2026" },
  OVERDUE_NOTICE: { ...common, BILL_TYPE_LABEL: "Electricity", DAYS_LATE: 3, TOTAL_AMOUNT: "7,350.00", PENALTY: "150.00", DUE_DATE: "September 28, 2026", REASON: "Past the payment due date", NOTICE_VARIANT: "overdue" },
  PAYMENT_APPROVED: { ...common, BILLING_MONTH: "September 2026", PAID_AMOUNT: "7,200.00" },
  PAYMENT_REJECTED: { ...common, BILLING_MONTH: "September 2026", REJECTION_REASON: "The submitted reference could not be verified." },
  PAYMENT_RECEIPT: { ...common, AMOUNT: "7,200.00", DESCRIPTION: "September 2026 electricity", BILLED_TO: "Aya Guest", PAYMENT_METHOD: "GCash", PAYMENT_DATE: "September 21, 2026", REFERENCE_NUMBER: "PAY-2026-000123", RESERVATION_CODE: "RES-2026-001", ROOM_NAME: "GP - Room 202" },
};

const manifest = [];
for (const [key, config] of Object.entries(EMAIL_TEMPLATES)) {
  const variables = normalizeEmailVariables(samples[key] || common);
  const fileName = `${key.toLowerCase()}.html`;
  fs.writeFileSync(path.join(outputDir, fileName), config.builder(variables), "utf8");
  manifest.push({ key, file: fileName, branch: variables.BRANCH_SUBTITLE || "Lilycrest Dormitory" });
}

for (const [label, branch, roomName] of [
  ["gil-puyat", "gil-puyat", "GP - Room 202"],
  ["guadalupe", "guadalupe", "GUA - Room 304"],
  ["unassigned", null, "Room 202"],
]) {
  const variables = normalizeEmailVariables({
    ...samples.BILL_GENERATED,
    BRANCH_NAME: branch,
    ROOM_NAME: roomName,
  });
  const fileName = `branch-${label}.html`;
  fs.writeFileSync(path.join(outputDir, fileName), EMAIL_TEMPLATES.BILL_GENERATED.builder(variables), "utf8");
  manifest.push({ key: "BRANCH_QA", file: fileName, branch: variables.BRANCH_SUBTITLE });
}

fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(JSON.stringify({ outputDir, rendered: manifest.length }, null, 2));
