export const withProtectedRequestPolicy = (options = {}, headers = {}) => ({
  ...options,
  // Protected API calls require both the Firebase bearer token and the
  // device-bound HttpOnly application-session cookie across approved origins.
  // This intentionally overrides a caller-provided omit/same-origin value.
  credentials: "include",
  headers,
});

export const withPublicRequestPolicy = (options = {}, headers = {}) => ({
  ...options,
  headers,
});
