export const STRUCTURED_INITIAL_PAYMENT_WORKFLOW =
  "structured-initial-payment-v1";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function isStructuredInitialPaymentEnabled(
  now = new Date(),
  env = process.env,
) {
  if (!TRUE_VALUES.has(String(env.STRUCTURED_INITIAL_PAYMENT_ENABLED || "").toLowerCase())) {
    return false;
  }

  const effectiveAt = String(
    env.STRUCTURED_INITIAL_PAYMENT_EFFECTIVE_AT || "",
  ).trim();
  if (!effectiveAt) return true;

  const effectiveDate = new Date(effectiveAt);
  return !Number.isNaN(effectiveDate.getTime()) && effectiveDate <= now;
}
export function usesStructuredInitialPayment(record = {}) {
  return (
    record?.financialWorkflowVersion === STRUCTURED_INITIAL_PAYMENT_WORKFLOW
  );
}
