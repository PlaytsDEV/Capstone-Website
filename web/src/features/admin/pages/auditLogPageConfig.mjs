export const AUDIT_TRAIL_TAB = "audit-trail";
export const SECURITY_SIGNALS_TAB = "security-signals";

export const AUDIT_PAGE_SIZES = [10, 25, 50, 100];

export const AUDIT_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "login", label: "Login" },
  { value: "registration", label: "Registration" },
  { value: "data_modification", label: "Data Modification" },
  { value: "data_deletion", label: "Data Deletion" },
  { value: "error", label: "Error" },
];

export const AUDIT_SEVERITY_OPTIONS = [
  { value: "all", label: "All Severity" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const AUDIT_ROLE_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "applicant", label: "Applicant" },
  { value: "tenant", label: "Tenant" },
  { value: "branch_admin", label: "Branch Admin" },
  { value: "owner", label: "Owner" },
];

export const AUDIT_BRANCH_OPTIONS = [
  { value: "all", label: "All Branches" },
  { value: "gil-puyat", label: "Gil Puyat" },
  { value: "guadalupe", label: "Guadalupe" },
  { value: "general", label: "General / System" },
];

export const AUDIT_DATE_PRESETS = [
  { id: "today", label: "Today", days: 0 },
  { id: "7d", label: "7 Days", days: 7 },
  { id: "30d", label: "30 Days", days: 30 },
  { id: "90d", label: "90 Days", days: 90 },
  { id: "all", label: "All Time", days: null },
  { id: "custom", label: "Custom", days: -1 },
];

const padDatePart = (value) => String(value).padStart(2, "0");

export function formatDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

export function getRelativeDateInputValue(daysAgo, now = new Date()) {
  const next = new Date(now);
  next.setDate(next.getDate() - daysAgo);
  return formatDateInputValue(next);
}

export function createDefaultAuditFilters(now = new Date()) {
  return {
    type: "all",
    severity: "all",
    branch: "all",
    role: "all",
    user: "",
    search: "",
    preset: "7d",
    startDate: getRelativeDateInputValue(7, now),
    endDate: formatDateInputValue(now),
  };
}

export function hasActiveAuditFilters(filters) {
  if (!filters) return false;
  return Boolean(
    (filters.type && filters.type !== "all") ||
    (filters.severity && filters.severity !== "all") ||
    (filters.branch && filters.branch !== "all") ||
    (filters.role && filters.role !== "all") ||
    (filters.user && filters.user.trim() !== "") ||
    (filters.search && filters.search.trim() !== "") ||
    filters.preset !== "7d"
  );
}

export function isAuditQueryFiltered(filters) {
  if (!filters) return false;
  return Boolean(
    (filters.type && filters.type !== "all") ||
    (filters.severity && filters.severity !== "all") ||
    (filters.branch && filters.branch !== "all") ||
    (filters.role && filters.role !== "all") ||
    (filters.user && filters.user.trim() !== "") ||
    (filters.search && filters.search.trim() !== "") ||
    (filters.preset !== "all" && Boolean(filters.startDate || filters.endDate))
  );
}

export function countActiveAuditFilters(filters) {
  if (!filters) return 0;
  let count = 0;
  if (filters.type && filters.type !== "all") count++;
  if (filters.severity && filters.severity !== "all") count++;
  if (filters.branch && filters.branch !== "all") count++;
  if (filters.role && filters.role !== "all") count++;
  if (filters.user && filters.user.trim() !== "") count++;
  if (filters.search && filters.search.trim() !== "") count++;
  if (filters.preset && filters.preset !== "7d") count++;
  return count;
}

export function getAllowedAuditTabs(isOwner) {
  return isOwner
    ? [AUDIT_TRAIL_TAB, SECURITY_SIGNALS_TAB]
    : [AUDIT_TRAIL_TAB];
}

export function normalizeAuditTab(requestedTab, isOwner) {
  const allowedTabs = getAllowedAuditTabs(isOwner);
  return allowedTabs.includes(requestedTab) ? requestedTab : allowedTabs[0];
}

export function formatAuditLabel(value, fallback = "Unknown") {
  if (!value) return fallback;

  // Protect against typos in stored logs
  if (String(value).toLowerCase() === "data_modifcation") {
    return "Data Modification";
  }

  return String(value)
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatAuditBranch(branch) {
  if (!branch || branch === "general") {
    return "General / System";
  }

  return formatAuditLabel(branch.replaceAll("-", "_"));
}

export function mapAuditSeverityToBadgeStatus(severity) {
  const statusMap = {
    info: "new",
    warning: "pending",
    high: "overdue",
    critical: "banned",
  };

  return statusMap[severity] || "archived";
}

export function getAuditTypeBadgeClass(type) {
  const key = String(type || "").toLowerCase();
  switch (key) {
    case "login":
      return "audit-type-badge--login";
    case "registration":
      return "audit-type-badge--registration";
    case "data_modification":
    case "data_modifcation":
      return "audit-type-badge--modification";
    case "data_deletion":
      return "audit-type-badge--deletion";
    case "error":
      return "audit-type-badge--error";
    default:
      return "audit-type-badge--default";
  }
}

export function formatIdentityDisplay(identity, fallback = "Unknown") {
  if (!identity) return { isHash: false, raw: fallback, display: fallback, short: fallback, masked: fallback };
  const raw = String(identity).trim();
  if (raw.startsWith("sha256:")) {
    const hash = raw.replace("sha256:", "");
    return {
      isHash: true,
      raw,
      display: hash,
      short: hash.slice(0, 10),
      masked: `#${hash.slice(0, 8)}`,
    };
  }

  // If email format, create a masked representation for privacy
  if (raw.includes("@")) {
    const [local, domain] = raw.split("@");
    const maskedLocal =
      local.length <= 2
        ? `${local.charAt(0)}*`
        : `${local.charAt(0)}${"*".repeat(Math.min(local.length - 2, 4))}${local.charAt(local.length - 1)}`;
    return {
      isHash: false,
      raw,
      display: raw,
      short: raw,
      masked: `${maskedLocal}@${domain}`,
    };
  }

  return {
    isHash: false,
    raw,
    display: raw,
    short: raw,
    masked: raw,
  };
}

export function parseUserAgent(userAgent) {
  if (!userAgent || typeof userAgent !== "string" || userAgent === "unknown") {
    return {
      label: "Web Browser",
      browser: "Browser",
      os: "Desktop",
      isMobile: false,
    };
  }

  const ua = userAgent.toLowerCase();
  let browser = "Web Client";
  let os = "Desktop";
  let isMobile = false;

  // OS detection
  if (ua.includes("windows")) {
    os = "Windows";
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    os = ua.includes("ipad") ? "iPadOS" : "iOS";
    isMobile = true;
  } else if (ua.includes("android")) {
    os = "Android";
    isMobile = true;
  } else if (ua.includes("macintosh") || ua.includes("mac os")) {
    os = "macOS";
  } else if (ua.includes("linux")) {
    os = "Linux";
  }

  // Browser detection
  if (ua.includes("edg/") || ua.includes("edge/")) {
    browser = "Edge";
  } else if (ua.includes("chrome/") && !ua.includes("chromium") && !ua.includes("edg/")) {
    browser = "Chrome";
  } else if (ua.includes("safari/") && !ua.includes("chrome/")) {
    browser = "Safari";
  } else if (ua.includes("firefox/")) {
    browser = "Firefox";
  } else if (ua.includes("postman") || ua.includes("insomnia") || ua.includes("curl") || ua.includes("axios")) {
    browser = "API Tool";
  }

  return {
    label: `${browser} · ${os}`,
    browser,
    os,
    isMobile,
  };
}

export function getSecurityFailureBadge(detail, fallback = "Unsuccessful Sign-in") {
  if (!detail) {
    return {
      label: fallback,
      variant: "warning",
      tooltip: fallback,
    };
  }

  const str = String(detail).trim();
  const lower = str.toLowerCase();

  if (
    lower.includes("user not found") ||
    lower.includes("account not found") ||
    lower.includes("not registered")
  ) {
    return {
      label: "Unregistered Account",
      variant: "neutral",
      tooltip: "Sign-in attempted with an email or username not found in database",
    };
  }

  if (
    lower.includes("invalid credential") ||
    lower.includes("authentication failed") ||
    lower.includes("incorrect password")
  ) {
    return {
      label: "Invalid Password",
      variant: "danger",
      tooltip: "Password does not match existing account credentials",
    };
  }

  if (lower.includes("account locked") || lower.includes("too many attempts")) {
    return {
      label: "Account Locked",
      variant: "danger",
      tooltip: "Account temporarily locked due to excessive failed attempts",
    };
  }

  if (lower.includes("inactive account") || lower.includes("disabled")) {
    return {
      label: "Inactive Account",
      variant: "warning",
      tooltip: "Sign-in attempted on an inactive or deactivated profile",
    };
  }

  if (lower.includes("email not verified") || lower.includes("unverified")) {
    return {
      label: "Email Unverified",
      variant: "info",
      tooltip: "Applicant must verify email address before logging in",
    };
  }

  if (lower.includes("invalid branch")) {
    return {
      label: "Invalid Branch",
      variant: "warning",
      tooltip: "Sign-in branch parameter mismatch",
    };
  }

  return {
    label: formatSecurityFailureDetail(detail, fallback),
    variant: "warning",
    tooltip: str,
  };
}

export function formatAuditActionDetails(row) {
  if (!row) return "";
  const details = row.details ? String(row.details).trim() : "";
  const action = row.action ? String(row.action).trim() : "";
  const type = String(row.type || "").toLowerCase();

  // If details is identical to action, don't duplicate
  if (details.toLowerCase() === action.toLowerCase()) {
    return "";
  }

  // Clean up legacy/historical misleading fallbacks
  if (
    details.toLowerCase() === "created new contract record" &&
    action.toLowerCase().includes("preview")
  ) {
    return "Document viewed in browser";
  }

  if (type === "login" && details.toLowerCase().startsWith("login from ")) {
    const client = parseUserAgent(row.userAgent || details);
    return `Signed in via ${client.label}`;
  }

  return details;
}

export function formatDisplayIp(ip) {
  if (!ip) return "Unknown";
  let cleaned = String(ip).trim();
  if (cleaned.startsWith("::ffff:")) {
    cleaned = cleaned.replace("::ffff:", "");
  }
  if (cleaned === "::1" || cleaned === "127.0.0.1") {
    return "127.0.0.1 (Localhost)";
  }
  return cleaned;
}

export function formatSecurityFailureDetail(detail, fallback = "No details recorded") {
  if (!detail) return fallback;
  const str = String(detail).trim();
  const lower = str.toLowerCase();

  if (lower.includes("email not verified") || lower.includes("unverified")) {
    return "Sign-in was blocked because the email address is not yet verified. The user must complete email verification before accessing the system.";
  }
  if (lower.includes("user not found in database") || lower.includes("account not found") || lower.includes("not registered")) {
    return "Account not registered (Sign-up required)";
  }
  if (lower.includes("invalid credentials") || lower.includes("authentication failed")) {
    return "Incorrect password or invalid credentials";
  }
  if (lower.includes("account locked") || lower.includes("user account locked")) {
    return "Account temporarily locked";
  }
  if (lower.includes("invalid branch")) {
    return "Invalid branch specified";
  }
  if (lower.includes("duplicate username") || lower.includes("username taken")) {
    return "Username already taken";
  }
  if (lower.includes("duplicate registration")) {
    return "Account already registered";
  }
  if (lower.includes("failed login attempt")) {
    return "Unsuccessful sign-in attempt";
  }
  if (lower.includes("user login successful")) {
    return "Successful sign-in";
  }
  if (lower.startsWith("login from ")) {
    return `Sign-in attempt (${str.replace(/^login from /i, "").slice(0, 40)})`;
  }

  return str;
}

const toDateBoundaryIso = (value, endOfDay = false) => {
  if (!value) return undefined;

  const [year, month, day] = String(value)
    .split("-")
    .map((part) => Number.parseInt(part, 10));

  if (!year || !month || !day) {
    return undefined;
  }

  const parsed = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );

  return parsed.toISOString();
};

export function buildAuditLogQueryParams(
  filters,
  { currentPage = 1, itemsPerPage = 10 } = {},
) {
  const params = {
    limit: String(itemsPerPage),
    offset: String((Math.max(currentPage, 1) - 1) * itemsPerPage),
  };

  if (filters?.type && filters.type !== "all") params.type = filters.type;
  if (filters?.severity && filters.severity !== "all") {
    params.severity = filters.severity;
  }
  if (filters?.branch && filters.branch !== "all") params.branch = filters.branch;
  if (filters?.role && filters.role !== "all") params.role = filters.role;
  if (filters?.user?.trim()) params.user = filters.user.trim();
  if (filters?.search?.trim()) params.search = filters.search.trim();

  const startDate = toDateBoundaryIso(filters?.startDate, false);
  const endDate = toDateBoundaryIso(filters?.endDate, true);

  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  return params;
}

export function buildAuditExportFilters(filters) {
  const params = buildAuditLogQueryParams(filters, {
    currentPage: 1,
    itemsPerPage: 10,
  });

  delete params.limit;
  delete params.offset;

  return params;
}
