const CHATBOT_SYSTEM_PROMPT = [
  "You are Lily, the Lilycrest tenant support assistant.",
  "Only answer Lilycrest dormitory, tenancy, billing, contract, maintenance, announcement, policy, or tenant-account questions.",
  "Answer in clear, friendly tenant-facing language.",
  "Treat authenticated server context as authoritative and never ask for a branch, room, move-in date, contract number, or billing fact already present there.",
  "Use only facts explicitly present in server context or authorized policy hints; if a fact is unavailable, say it cannot currently be confirmed.",
  "Never invent prices, balances, dates, room assignments, statuses, contact details, or policies.",
  "If a request needs staff action, explain that an admin will follow up.",
  "Strictly do not use icons, emojis, or graphical symbols in answers.",
].join(" ");

const KNOWLEDGE_BASE = {
  billing: {
    intent: "billing",
    triggers: ["bill", "billing", "payment", "paid", "receipt", "balance", "rent"],
    knowledge: "Tenants can review bills, balances, receipts, and payment status in the billing section.",
    followups: ["Check my balance", "View payment status", "Ask about receipts"],
    escalation_if: ["wrong charge", "overcharged", "double payment", "refund"],
  },
  maintenance: {
    intent: "maintenance",
    triggers: ["maintenance", "repair", "broken", "leak", "issue", "fix"],
    knowledge: "Use the authenticated room assignment when available. Ask only for genuinely missing issue details, urgency, and photos.",
    followups: ["Create maintenance request", "Check request status", "Add more details"],
    escalation_if: ["emergency", "flood", "fire", "danger", "unsafe"],
  },
  reservation: {
    intent: "reservation",
    triggers: ["reservation", "reserve", "visit", "room", "bed", "availability"],
    knowledge: "Reservation and visit details depend on canonical availability, submitted requirements, and admin confirmation.",
    followups: ["Check reservation status", "Ask about visits", "Ask about available rooms"],
  },
  account: {
    intent: "account",
    triggers: ["account", "login", "password", "email", "profile", "otp"],
    knowledge: "Account concerns may require identity verification before staff can change sensitive information.",
    followups: ["Reset password", "Update profile", "Contact admin"],
    escalation_if: ["blocked", "locked", "can't login", "cannot login"],
  },
};

const ESCALATION_KEYWORDS = [
  "admin",
  "human",
  "staff",
  "urgent",
  "emergency",
  "unsafe",
  "complaint",
  "refund",
  "blocked",
];

const DEFAULT_FOLLOWUPS = [
  "Check my account",
  "Ask about billing",
  "Talk to an admin",
];

function isGreeting(message = "") {
  return /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(message.trim());
}

function getTimeOfDayGreeting() {
  const hour = new Date().toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    hour12: false,
  });
  const numericHour = Number(hour);
  if (numericHour < 12) return "Good morning!";
  if (numericHour < 18) return "Good afternoon!";
  return "Good evening!";
}

function detectEmotionalTone(message = "") {
  return /(angry|upset|frustrated|annoyed|unfair|bad service|disappointed|stress)/i.test(message);
}

module.exports = {
  CHATBOT_SYSTEM_PROMPT,
  KNOWLEDGE_BASE,
  ESCALATION_KEYWORDS,
  DEFAULT_FOLLOWUPS,
  isGreeting,
  getTimeOfDayGreeting,
  detectEmotionalTone,
};
