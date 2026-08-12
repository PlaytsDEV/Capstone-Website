const trimTrailingSlash = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const firstConfiguredUrl = (value = "") =>
  trimTrailingSlash(String(value || "").split(",").find((entry) => entry.trim()) || "");

const PRODUCTION_URLS = Object.freeze({
  PUBLIC_FRONTEND_URL: "https://www.lilycrest.space",
  PUBLIC_API_URL: "https://api.lilycrest.space",
  EMAIL_ACTION_URL: "https://www.lilycrest.space/auth-action",
  RESERVATION_CONTINUATION_URL: "https://www.lilycrest.space/applicant/check-availability",
});

const requireHttpUrl = (name, value, { required = false, production = false } = {}) => {
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
  if (parsed.username || parsed.password || parsed.hash) {
    throw new Error(`${name} must not contain credentials or a fragment`);
  }
  if (production) {
    if (parsed.protocol !== "https:") throw new Error(`${name} must use HTTPS in production`);
    if (parsed.search) throw new Error(`${name} must not contain a query string in production`);
    const expected = PRODUCTION_URLS[name];
    if (expected && trimTrailingSlash(parsed.toString()) !== expected) {
      throw new Error(`${name} must use the official Lilycrest production URL: ${expected}`);
    }
  }
  return trimTrailingSlash(parsed.toString());
};

export const getPublicUrlConfig = (environment = process.env) => {
  const production = environment.NODE_ENV === "production";
  const publicFrontendUrl = requireHttpUrl(
    "PUBLIC_FRONTEND_URL",
    environment.PUBLIC_FRONTEND_URL || (!production ? firstConfiguredUrl(environment.FRONTEND_URL) : "") || (!production ? "http://localhost:3000" : ""),
    { required: production, production },
  );
  const publicApiUrl = requireHttpUrl(
    "PUBLIC_API_URL",
    environment.PUBLIC_API_URL || (!production ? environment.BACKEND_URL : "") || (!production ? "http://localhost:5000" : ""),
    { required: production, production },
  );
  const emailActionUrl = requireHttpUrl(
    "EMAIL_ACTION_URL",
    environment.EMAIL_ACTION_URL || (!production && publicFrontendUrl ? `${publicFrontendUrl}/auth-action` : ""),
    { required: production, production },
  );
  const reservationContinuationUrl = requireHttpUrl(
    "RESERVATION_CONTINUATION_URL",
    environment.RESERVATION_CONTINUATION_URL || (!production && publicFrontendUrl ? `${publicFrontendUrl}/applicant/check-availability` : ""),
    { required: production, production },
  );
  const mobileDeepLinkUrl = requireHttpUrl(
    "MOBILE_DEEP_LINK_URL",
    environment.MOBILE_DEEP_LINK_URL,
    { production },
  );

  // Stable, non-build-hashed static asset — served directly from
  // web/public/logo512.png, unlike bundler-hashed files under /assets/*
  // whose filename changes between builds. Overridable for a rebrand
  // without a code change.
  const publicLogoUrl = requireHttpUrl(
    "PUBLIC_LOGO_URL",
    environment.PUBLIC_LOGO_URL || (publicFrontendUrl ? `${publicFrontendUrl}/logo512.png` : ""),
    { production },
  );

  return {
    publicFrontendUrl,
    publicApiUrl,
    emailActionUrl,
    reservationContinuationUrl,
    mobileDeepLinkUrl,
    publicLogoUrl,
  };
};

export default getPublicUrlConfig;
