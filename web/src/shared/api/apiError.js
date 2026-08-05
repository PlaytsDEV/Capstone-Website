const firstString = (values) => values.find((value) => typeof value === "string" && value.trim()) || null;

export const getApiErrorCode = (value) => firstString([
  value?.state,
  value?.code,
  value?.error?.state,
  value?.error?.code,
  value?.data?.state,
  value?.data?.code,
  value?.data?.error?.state,
  value?.data?.error?.code,
  value?.response?.data?.state,
  value?.response?.data?.code,
  value?.response?.data?.error?.state,
  value?.response?.data?.error?.code,
]);

export const normalizeVerificationErrorCode = (value, fallback) => {
  const code = getApiErrorCode(value);
  if (["RATE_LIMITED", "RATE_LIMIT_EXCEEDED", "COOLDOWN_ACTIVE"].includes(code)) {
    return "RATE_LIMITED_OR_COOLDOWN_ACTIVE";
  }
  return code || fallback;
};

export const normalizeRetryAfterSeconds = (value, maximum = 3600) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.ceil(parsed), maximum);
};
