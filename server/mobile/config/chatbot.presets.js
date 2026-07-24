const CHATBOT_SYSTEM_PROMPT = [
  "You are Lily, the LilyCrest tenant support assistant.",
  "Answer in clear, friendly tenant-facing language.",
  "Use available tenant context and policy hints when provided.",
  "If a request needs staff action, explain that an admin will follow up.",
].join(" ");

const KNOWLEDGE_BASE = {
  billing: {
    intent: "billing",
    triggers: ["bill", "billing", "payment", "paid", "receipt", "balance", "rent"],
    knowledge:
      "Tenants can review bills, balances, receipts, and payment status in the billing section.",
    followups: ["Check my balance", "View payment status", "Ask about receipts"],
    escalation_if: ["wrong charge", "overcharged", "double payment", "refund"],
  },
  maintenance: {
    intent: "maintenance",
    triggers: ["maintenance", "repair", "broken", "leak", "issue", "fix"],
    knowledge:
      "Maintenance concerns should include the room, issue details, urgency, and photos when available.",
    followups: ["Create maintenance request", "Check request status", "Add more details"],
    escalation_if: ["emergency", "flood", "fire", "danger", "unsafe"],
  },
  reservation: {
    intent: "reservation",
    triggers: ["reservation", "reserve", "visit", "room", "bed", "availability"],
    knowledge:
      "Reservation and visit details depend on room availability, submitted requirements, and admin confirmation.",
    followups: ["Check reservation status", "Ask about visits", "Ask about available rooms"],
  },
  account: {
    intent: "account",
    triggers: ["account", "login", "password", "email", "profile", "otp"],
    knowledge:
      "Account concerns may require identity verification before staff can change sensitive information.",
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
  return /(angry|upset|frustrated|annoyed|unfair|bad service|disappointed|stress)/i.test(
    message,
  );
}

const LEASING_ASSISTANT_SYSTEM_PROMPT_TEMPLATE = `
System Role: You are Lily, the official Leasing Assistant for Lilycrest Gil Puyat (#7 Gil Puyat Ave. cor Marconi St., Brgy Palanan, Makati City). Your job is to quote accurate rental prices to prospective tenants and explain leasing terms in a clear, friendly, and professional manner.

Lease Terms:
- Long-Term Lease: Minimum 6 months.
- Short-Term Lease: 1 to 5 months (Minimum 1 month).

Room Pricing Matrix (Per Month):
- Quadruple Sharing (Billed Per Pax):
  • Short-Term (<6 mo): ₱[QUAD_SHORT] / month
  • Long-Term (≥6 mo): ₱[QUAD_LONG] / month (Save ₱[QUAD_SAVINGS] / month)
- Double Sharing (Billed Per Pax):
  • Short-Term (<6 mo): ₱[DOUBLE_SHORT] / month
  • Long-Term (≥6 mo): ₱[DOUBLE_LONG] / month (Save ₱[DOUBLE_SAVINGS] / month)
- Private Room (Max 2 Pax - Billed Per Room):
  • Short-Term (<6 mo): ₱[PRIVATE_SHORT] / month
  • Long-Term (≥6 mo): ₱[PRIVATE_LONG] / month (Save ₱[PRIVATE_SAVINGS] / month)

Payment Terms & Move-In Requirements:
- Move-In Payment: 1 month advance rent + 1 month security deposit (Total = 2x Monthly Rate).
- Reservation Fee: ₱2,000.00 (Credited directly toward initial move-in fees).
- Remaining Move-In Balance = (2x Monthly Rate) - ₱2,000.00.
- Utilities: Electricity consumption is metered separately per room/tenant and billed monthly (not included in rent).

Room Amenities & Inclusions:
- All Rooms: Fully furnished with double-decked beds (mattresses included), air conditioning unit, tables, chairs, cabinets, and hot shower.
- Quad & Double Sharing: Access to common floor lounge and shared toilet & bath.
- Private Room: Includes private in-room toilet & bath and kitchenette.

Instructions for Output:
1. When asked for pricing, ask for the intended length of stay and preferred room type if missing.
2. Present both the regular short-term rate and the discounted long-term rate to emphasize savings.
3. Keep currency numbers formatted cleanly with commas and Peso signs (e.g., ₱5,400).
4. If asked about move-in terms, explain the 1-month advance, 1-month deposit, and ₱2,000 reservation fee credit.
`.trim();

function buildLeasingSystemPrompt(rates = {}) {
  const defaults = {
    quadShort: "6,300",
    quadLong: "5,400",
    quadSavings: "900",
    doubleShort: "8,000",
    doubleLong: "7,200",
    doubleSavings: "800",
    privateShort: "14,400",
    privateLong: "13,500",
    privateSavings: "900",
  };

  const r = { ...defaults, ...rates };

  return LEASING_ASSISTANT_SYSTEM_PROMPT_TEMPLATE
    .replace("[QUAD_SHORT]", r.quadShort)
    .replace("[QUAD_LONG]", r.quadLong)
    .replace("[QUAD_SAVINGS]", r.quadSavings)
    .replace("[DOUBLE_SHORT]", r.doubleShort)
    .replace("[DOUBLE_LONG]", r.doubleLong)
    .replace("[DOUBLE_SAVINGS]", r.doubleSavings)
    .replace("[PRIVATE_SHORT]", r.privateShort)
    .replace("[PRIVATE_LONG]", r.privateLong)
    .replace("[PRIVATE_SAVINGS]", r.privateSavings);
}

module.exports = {
  CHATBOT_SYSTEM_PROMPT,
  LEASING_ASSISTANT_SYSTEM_PROMPT_TEMPLATE,
  buildLeasingSystemPrompt,
  KNOWLEDGE_BASE,
  ESCALATION_KEYWORDS,
  DEFAULT_FOLLOWUPS,
  isGreeting,
  getTimeOfDayGreeting,
  detectEmotionalTone,
};

