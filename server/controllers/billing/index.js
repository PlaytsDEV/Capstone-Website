export * from "./_helpers.js";
export * from "./rentBillingController.js";
export * from "./paymentVerificationController.js";
export * from "./billingQueryController.js";
export * from "./billingReportController.js";

import * as rentBilling from "./rentBillingController.js";
import * as paymentVerification from "./paymentVerificationController.js";
import * as billingQuery from "./billingQueryController.js";
import * as billingReport from "./billingReportController.js";

const billingController = {
  ...rentBilling,
  ...paymentVerification,
  ...billingQuery,
  ...billingReport,
};

export default billingController;
