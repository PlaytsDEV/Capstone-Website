const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function resolveAuthEmulatorConfig({ url, projectId }) {
  const value = String(url || "").trim();
  if (!value) return null;
  if (!String(projectId || "").startsWith("demo-")) {
    throw new Error("Firebase Auth Emulator requires a demo- project ID.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid Firebase Auth Emulator URL.");
  }
  if (parsed.protocol !== "http:" || !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("Firebase Auth Emulator must use an HTTP loopback URL.");
  }
  if (!parsed.port) {
    throw new Error("Firebase Auth Emulator URL must include a port.");
  }
  return parsed.origin;
}

