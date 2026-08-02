const normalizeOrigin = (origin = "") =>
  String(origin || "").trim().replace(/\/+$/, "");

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const wildcardToRegex = (pattern = "") =>
  new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, ".*")}$`, "i");

export const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "https://www.lilycrest.space",
  "https://lilycrest.space",
]);

const configuredOrigins = (value = "") =>
  String(value || "")
    .split(",")
    .map(normalizeOrigin)
    // Credentialed CORS must never become an allow-all policy. A scoped
    // wildcard such as https://*.example.test remains supported.
    .filter((origin) => origin && origin !== "*");

export const createCorsOriginPolicy = (environment = process.env) => {
  const allowedOriginRules = [
    ...configuredOrigins(environment.CORS_ORIGINS),
    ...configuredOrigins(environment.FRONTEND_URL),
    ...DEFAULT_ALLOWED_ORIGINS,
  ].filter((origin, index, origins) => origins.indexOf(origin) === index);

  const allowedOriginMatchers = allowedOriginRules.map((rule) =>
    rule.includes("*") ? wildcardToRegex(rule) : rule,
  );

  return {
    allowedOriginRules,
    isOriginAllowed(origin) {
      if (!origin) return true;
      const normalized = normalizeOrigin(origin);
      return allowedOriginMatchers.some((matcher) =>
        matcher instanceof RegExp
          ? matcher.test(normalized)
          : matcher === normalized,
      );
    },
  };
};
