/**
 * ============================================================================
 * SECURITY HEADERS MIDDLEWARE
 * ============================================================================
 *
 * Centralized security headers configuration for Express.js using Helmet
 * and standard Permissions-Policy headers.
 *
 * Content Security Policy (CSP) includes whitelisted origins required for:
 * - Firebase Authentication SDK
 * - Google Identity / OAuth 2.0 ("Continue with Google")
 * - Google Fonts & static asset delivery
 */

import helmet from "helmet";

export const PERMISSIONS_POLICY_HEADER =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), accelerometer=(), gyroscope=(), magnetometer=()";

export const securityDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "https://apis.google.com",
    "https://*.firebaseapp.com",
  ],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: [
    "'self'",
    "https://*.googleapis.com",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://accounts.google.com",
  ],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  objectSrc: ["'none'"],
  frameSrc: [
    "'self'",
    "https://accounts.google.com",
    "https://*.firebaseapp.com",
  ],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
};

export const helmetOptions = {
  contentSecurityPolicy: {
    directives: securityDirectives,
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: "deny",
  },
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },
  permittedCrossDomainPolicies: {
    permittedPolicies: "none",
  },
  xContentTypeOptions: true,
  crossOriginResourcePolicy: {
    policy: "same-origin",
  },
};

export const permissionsPolicyMiddleware = (_req, res, next) => {
  res.setHeader("Permissions-Policy", PERMISSIONS_POLICY_HEADER);
  next();
};

export const helmetMiddleware = helmet(helmetOptions);

/**
 * Combined security headers middleware.
 * Applies both Permissions-Policy and Helmet headers.
 */
export const securityHeaders = (req, res, next) => {
  permissionsPolicyMiddleware(req, res, () => {
    helmetMiddleware(req, res, next);
  });
};

export default securityHeaders;
