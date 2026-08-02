import { SOCKET_BASE_URL } from "./baseUrl";

const normalizeSocketPath = (value = "") => {
  const path = String(value || "").trim();
  if (!path) return "/socket.io";
  return path.startsWith("/") ? path : `/${path}`;
};

const parseSocketTransports = (value = "") => {
  const transports = String(value || "")
    .split(",")
    .map((transport) => transport.trim().toLowerCase())
    .filter((transport) => transport === "polling" || transport === "websocket");

  return [...new Set(transports)];
};

const getDefaultSocketTransports = () => {
  if (import.meta.env.PROD) {
    return ["polling"];
  }

  return ["polling", "websocket"];
};

export const SOCKET_PATH = normalizeSocketPath(import.meta.env.VITE_SOCKET_PATH);

const configuredSocketTransports = parseSocketTransports(import.meta.env.VITE_SOCKET_TRANSPORTS);

export const SOCKET_TRANSPORTS =
  configuredSocketTransports.length > 0
    ? configuredSocketTransports
    : getDefaultSocketTransports();

export const SOCKET_CLIENT_OPTIONS = {
  withCredentials: true,
  path: SOCKET_PATH,
  transports: SOCKET_TRANSPORTS,
  reconnectionAttempts: 3,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  timeout: 10000,
};

export const describeSocketTarget = () =>
  `${SOCKET_BASE_URL}${SOCKET_PATH} via ${SOCKET_TRANSPORTS.join(",")}`;
