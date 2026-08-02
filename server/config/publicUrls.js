const trimTrailingSlash = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const firstConfiguredUrl = (value = "") =>
  trimTrailingSlash(String(value || "").split(",").find((entry) => entry.trim()) || "");

const requireHttpUrl = (name, value, { required = false } = {}) => {
  const normalized = trimTrailingSlash(value);
  if (!normalized) {
    if (required) throw new Error(`${name} is required`);
    return "";
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use HTTP(S)`);
  }
  return trimTrailingSlash(parsed.toString());
};

export const getPublicUrlConfig = (environment = process.env) => {
  const production = environment.NODE_ENV === "production";
  const publicFrontendUrl = requireHttpUrl(
    "PUBLIC_FRONTEND_URL",
    environment.PUBLIC_FRONTEND_URL || (!production ? firstConfiguredUrl(environment.FRONTEND_URL) : "") || (!production ? "http://localhost:3000" : ""),
    { required: production },
  );
  const publicApiUrl = requireHttpUrl(
    "PUBLIC_API_URL",
    environment.PUBLIC_API_URL || (!production ? environment.BACKEND_URL : "") || (!production ? "http://localhost:5000" : ""),
    { required: production },
  );
  const emailActionUrl = requireHttpUrl(
    "EMAIL_ACTION_URL",
    environment.EMAIL_ACTION_URL || (!production && publicFrontendUrl ? `${publicFrontendUrl}/auth-action` : ""),
    { required: production },
  );
  const reservationContinuationUrl = requireHttpUrl(
    "RESERVATION_CONTINUATION_URL",
    environment.RESERVATION_CONTINUATION_URL || (!production && publicFrontendUrl ? `${publicFrontendUrl}/applicant/check-availability` : ""),
    { required: production },
  );
  const mobileDeepLinkUrl = requireHttpUrl(
    "MOBILE_DEEP_LINK_URL",
    environment.MOBILE_DEEP_LINK_URL,
  );

  return {
    publicFrontendUrl,
    publicApiUrl,
    emailActionUrl,
    reservationContinuationUrl,
    mobileDeepLinkUrl,
  };
};

export default getPublicUrlConfig;
