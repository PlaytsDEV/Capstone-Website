export * from "./_helpers.js";
export * from "./rentBillingController.js";
export * from "./paymentVerificationController.js";
export * from "./billingQueryController.js";
export * from "./billingReportController.js";
export * from "./tenantViolationController.js";
export * from "./overdueNoticeController.js";

import * as rentBilling from "./rentBillingController.js";
import * as paymentVerification from "./paymentVerificationController.js";
import * as billingQuery from "./billingQueryController.js";
import * as billingReport from "./billingReportController.js";
import * as tenantViolation from "./tenantViolationController.js";
import * as overdueNotice from "./overdueNoticeController.js";

const billingController = {
  ...rentBilling,
  ...paymentVerification,
  ...billingQuery,
  ...billingReport,
  ...tenantViolation,
  ...overdueNotice,
};

export default billingController;

