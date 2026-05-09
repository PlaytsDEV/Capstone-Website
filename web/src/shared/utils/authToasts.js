export const AUTH_TOAST_DURATION = 5000;

const emailPrefix = (email) => {
  if (!email || typeof email !== "string" || !email.includes("@")) return "";
  return email.split("@")[0]?.trim();
};

export const resolveAuthDisplayName = (user, fallbackName = "there") => {
  const firstName = user?.firstName?.trim();
  const displayName = user?.displayName?.trim();
  const username = user?.username?.trim();
  const emailName = emailPrefix(user?.email) || emailPrefix(fallbackName);
  const fallback = fallbackName?.trim?.() || "there";

  return firstName || displayName || username || emailName || fallback;
};

export const buildAuthSuccessMessage = (user, fallbackName = "there") => {
  const displayName = resolveAuthDisplayName(user, fallbackName);

  return `Welcome back, ${displayName}!`;
};

export const buildAuthWelcomeMessage = (user, fallbackName = "there") =>
  `Welcome to Lilycrest, ${resolveAuthDisplayName(user, fallbackName)}!`;

export const buildAuthSuccessFlash = (message) => ({
  flash: {
    type: "success",
    message,
    duration: AUTH_TOAST_DURATION,
  },
});

export const SIGN_OUT_SUCCESS_MESSAGE = "You have been signed out successfully.";

export const buildSignOutSuccessFlash = () =>
  buildAuthSuccessFlash(SIGN_OUT_SUCCESS_MESSAGE);
