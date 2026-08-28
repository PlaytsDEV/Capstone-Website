const normalizeUrl = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const envApiUrl = normalizeUrl(env.VITE_API_URL);
const envSocketUrl = normalizeUrl(env.VITE_SOCKET_URL);
const isProd = Boolean(env.PROD);

if (!envApiUrl && isProd) {
  throw new Error("VITE_API_URL is required for production builds.");
}

const fallbackApiUrl = "http://localhost:5000/api";

export const API_BASE_URL = envApiUrl || fallbackApiUrl;
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");
export const SOCKET_BASE_URL = (envSocketUrl || API_ORIGIN).replace(/\/api$/, "");
