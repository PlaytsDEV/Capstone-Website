const normalizeOrigin = (origin = "") => String(origin || "").trim().replace(/\/+$/, "");

export const DEVELOPMENT_ALLOWED_ORIGINS = Object.freeze([
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5173",
]);

export const PRODUCTION_ALLOWED_ORIGINS = Object.freeze([
  "https://www.lilycrest.space",
  "https://lilycrest.space",
]);

const parseConfiguredOrigins = (value = "", { production = false } = {}) =>
  String(value || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean)
    .map((origin) => {
      if (origin.includes("*")) {
        if (production) throw new Error("Production CORS origins must not contain wildcards");
        throw new Error("CORS origins must be exact origins");
      }
      let parsed;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error("CORS origins must be valid absolute URLs");
      }
      if (
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash ||
        !["http:", "https:"].includes(parsed.protocol)
      ) {
        throw new Error("CORS origins must contain only scheme, host, and optional port");
      }
      if (production) {
        if (parsed.protocol !== "https:") throw new Error("Production CORS origins must use HTTPS");
        if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
          throw new Error("Production CORS origins must not use localhost");
        }
        if (parsed.hostname === "vercel.app" || parsed.hostname.endsWith(".vercel.app")) {
          throw new Error("Production CORS origins must not use Vercel preview hosts");
        }
        if (!PRODUCTION_ALLOWED_ORIGINS.includes(parsed.origin)) {
          throw new Error("Production CORS origins must use an approved Lilycrest origin");
        }
      }
      return parsed.origin;
    });

export const createCorsOriginPolicy = (environment = process.env) => {
  const production = environment.NODE_ENV === "production";
  const configuredValue = environment.ALLOWED_FRONTEND_ORIGINS
    || environment.CORS_ORIGINS
    || environment.FRONTEND_URL;
  const configured = parseConfiguredOrigins(configuredValue, { production });
  const allowedOriginRules = [
    ...configured,
    ...(production ? [] : DEVELOPMENT_ALLOWED_ORIGINS),
  ].filter((origin, index, origins) => origins.indexOf(origin) === index);

  return {
    allowedOriginRules,
    isOriginAllowed(origin) {
      if (!origin) return true;
      let normalized;
      try {
        normalized = new URL(normalizeOrigin(origin)).origin;
      } catch {
        return false;
      }
      return allowedOriginRules.includes(normalized) && normalizeOrigin(origin) === normalized;
    },
  };
};
