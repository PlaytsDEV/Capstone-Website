import { resolveWebEnvironment, validateWebServiceEnvironment } from "../config/environment.js";

const normalizeUrl = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const envApiUrl = normalizeUrl(import.meta.env.VITE_API_URL);
const envSocketUrl = normalizeUrl(import.meta.env.VITE_SOCKET_URL);
const isProd = import.meta.env.PROD;
export const WEB_DEPLOYMENT_ENVIRONMENT = resolveWebEnvironment(
  import.meta.env.VITE_DEPLOYMENT_ENV,
  { productionBuild: isProd },
);

if (!envApiUrl && isProd) {
  throw new Error("VITE_API_URL is required for production builds.");
}

const fallbackApiUrl = "http://localhost:5000/api";

export const API_BASE_URL = envApiUrl || fallbackApiUrl;
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");
export const SOCKET_BASE_URL = (envSocketUrl || API_ORIGIN).replace(/\/api$/, "");

validateWebServiceEnvironment({
  environment: WEB_DEPLOYMENT_ENVIRONMENT,
  apiUrl: API_BASE_URL,
  socketUrl: SOCKET_BASE_URL,
  appUrl: normalizeUrl(import.meta.env.VITE_APP_URL) || "http://localhost:5173",
});
