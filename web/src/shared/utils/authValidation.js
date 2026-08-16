/**
 * Shared auth validation utilities used by both SignUp and SignIn pages.
 * Eliminates ~120 lines of duplication.
 */

/** Advanced email validation — checks format, domain structure, consecutive dots, valid characters */
const EMAIL_FORMAT_MESSAGE = "Enter a valid email address, such as name@example.com.";

export const validateEmail = (email) => {
  if (!email || !email.trim()) return "Email address is required";
  const basicRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicRegex.test(email)) return EMAIL_FORMAT_MESSAGE;

  const parts = email.split("@");
  if (parts.length !== 2) return EMAIL_FORMAT_MESSAGE;
  const [localPart, domain] = parts;

  if (localPart.length === 0 || localPart.length > 64)
    return EMAIL_FORMAT_MESSAGE;
  if (domain.length === 0 || domain.length > 255) return EMAIL_FORMAT_MESSAGE;

  const domainParts = domain.split(".");
  if (domainParts.length < 2) return EMAIL_FORMAT_MESSAGE;

  for (let part of domainParts) {
    if (part.length === 0 || !/^[a-zA-Z0-9-]+$/.test(part))
      return EMAIL_FORMAT_MESSAGE;
    if (part.startsWith("-") || part.endsWith("-"))
      return EMAIL_FORMAT_MESSAGE;
  }

  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return EMAIL_FORMAT_MESSAGE;
  if (email.includes("..")) return EMAIL_FORMAT_MESSAGE;

  return null; // Valid
};

/** Password strength calculator and rules definition */
const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?/]/;

export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (value) => typeof value === "string" && value.length >= 8 },
  { id: "uppercase", label: "At least 1 uppercase letter", test: (value) => /[A-Z]/.test(value || "") },
  { id: "lowercase", label: "At least 1 lowercase letter", test: (value) => /[a-z]/.test(value || "") },
  { id: "number", label: "At least 1 number", test: (value) => /\d/.test(value || "") },
  { id: "special", label: "At least 1 special character", test: (value) => SPECIAL_CHARS_REGEX.test(value || "") || /[^A-Za-z0-9]/.test(value || "") },
  { id: "no-spaces", label: "No spaces allowed", test: (value) => typeof value === "string" && value.length > 0 && !/\s/.test(value) },
];

export const evaluatePasswordRules = (password = "") => {
  const results = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }));
  const allPassed = results.every((r) => r.passed);
  return { results, allPassed };
};

export const calculatePasswordStrength = (password = "") => {
  const requirements = {
    length: typeof password === "string" && password.length >= 8,
    uppercase: /[A-Z]/.test(password || ""),
    lowercase: /[a-z]/.test(password || ""),
    number: /\d/.test(password || ""),
    special: SPECIAL_CHARS_REGEX.test(password || "") || /[^A-Za-z0-9]/.test(password || ""),
    noSpaces: typeof password === "string" && password.length > 0 && !/\s/.test(password),
  };

  const metRequirements = Object.values(requirements).filter(Boolean).length;
  let score = 0;
  let level = "weak";
  let label = "Weak";

  if (!password) {
    score = 0;
    level = "none";
    label = "Empty";
  } else if (!requirements.length) {
    score = Math.min(25, metRequirements * 8);
    level = "weak";
    label = "Weak";
  } else if (metRequirements >= 6 && password.length >= 12) {
    score = 100;
    level = "strong";
    label = "Very Strong";
  } else if (metRequirements >= 6) {
    score = 85;
    level = "strong";
    label = "Strong";
  } else if (metRequirements >= 5) {
    score = 65;
    level = "medium";
    label = "Good";
  } else if (metRequirements >= 3) {
    score = 40;
    level = "fair";
    label = "Fair";
  } else {
    score = 20;
    level = "weak";
    label = "Weak";
  }

  return { score, level, label, metRequirements, requirements };
};

/**
 * Enforce password strength — returns error message or null if valid.
 * Requires minimum "medium" strength (3+ of 5 requirements met).
 */
export const validatePassword = (password) => {
  if (!password) return "Password is required";
  if (password.length < 8)
    return "Your password must be at least 8 characters long.";

  const { requirements } = calculatePasswordStrength(password);
  const missing = [];
  if (!requirements.uppercase) missing.push("an uppercase letter");
  if (!requirements.lowercase) missing.push("a lowercase letter");
  if (!requirements.number) missing.push("a number");
  if (!requirements.special) missing.push("a special character");

  if (missing.length > 2) {
    return `Your password needs at least ${missing.join(", ")}.`;
  }
  return null; // Valid
};

/** Sanitize name fields — allow only letters, spaces, hyphens, apostrophes */
export const sanitizeName = (value) => value.replace(/[^a-zA-Z\s'-]/g, "");

/** Generate a backend-compatible 3-30 character username from an email. */
export const generateUsername = (email, attempt = 0) => {
  const normalizedBase = String(email || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const base = (normalizedBase || "user").slice(0, 21).padEnd(3, "0");
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 6)
      : Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  const suffix = `${Number(attempt).toString(36)}${randomPart}`.slice(0, 7);
  return `${base}-${suffix}`.slice(0, 30);
};

/** Map Firebase auth error codes to user-friendly messages */
export const getFirebaseErrorMessage = (error, context = "login") => {
  const code = error?.code;
  const map = {
    "auth/email-already-in-use":
      "An account already exists with this email address. Please sign in instead.",
    "auth/invalid-email": "Enter a valid email address, such as name@example.com.",
    "auth/weak-password":
      "Your password must contain at least 8 characters, including a number and a letter.",
    "auth/invalid-credential":
      "Your email or password is incorrect. Please check your details and try again.",
    "auth/wrong-password":
      "Your email or password is incorrect. Please check your details and try again.",
    "auth/user-not-found":
      "We could not find an account with this email. Please sign up first.",
    "auth/too-many-requests":
      "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed":
      "We could not connect to the server. Check your internet connection and try again.",
    "auth/user-disabled":
      "This account has been disabled. Please contact support.",
    "auth/popup-closed-by-user":
      context === "signup" ? "Sign-up was cancelled." : "Sign-in was cancelled.",
    "auth/popup-blocked":
      "Your browser blocked the sign-in popup. Please allow popups for this site and try again.",
    "auth/account-exists-with-different-credential":
      "An account already exists with this email using a different sign-in method.",
  };
  if (map[code]) return map[code];
  // Never surface raw Firebase codes or backend text to the user — log for debugging instead.
  if (code && typeof console !== "undefined" && console.warn) {
    console.warn("[auth] Unmapped Firebase error code:", code);
  }
  return context === "signup"
    ? "We could not complete your registration. Please check your information and try again."
    : "We could not sign you in. Please check your details and try again.";
};
