const DOMAIN_RULES = Object.freeze([
  {
    intent: "billing",
    domains: ["billing"],
    pattern: /\b(bill(?:ing)?|balance|amount due|due(?: date)?|pay(?:ment|ing)?|paid|unpaid|overdue|rent|penalt(?:y|ies)|fee|statement|invoice|receipt|gcash|maya|bank transfer|electric(?:ity)?|water|utilit(?:y|ies)|submeter|charge(?:s|d)?|kuryente|tubig|bayad|bayarin|babayaran|magkano|mataas)\b/i,
  },
  {
    intent: "contract",
    domains: ["contract"],
    pattern: /\b(contract|lease|agreement|document|draft|final|pdf|notari[sz](?:e|ed|ation)|sign(?:ed|ing)?|renew(?:al|ing)?|security deposit|move[ -]?out clearance)\b/i,
  },
  {
    intent: "maintenance",
    domains: ["maintenance"],
    pattern: /\b(maintenance|repair|broken|leak(?:ing)?|plumb(?:ing|er)|aircon|air conditioning|electrician|technician|facility issue|no power|power outage|no water|sira|ayos|cr)\b/i,
  },
  {
    intent: "tenancy",
    domains: [],
    pattern: /\b(room|bed|branch|assignment|move[ -]?in|moved in|nakamove[ -]?in|occupan(?:cy|t)|resident|reservation|application status|viewing schedule|key turnover|my stay|pending pa rin)\b/i,
  },
  {
    intent: "announcements",
    domains: ["announcements"],
    pattern: /\b(announcement|news|notice|reminder|dorm alert|lilycrest alert)\b/i,
  },
  {
    intent: "policy",
    domains: ["announcements"],
    pattern: /\b(policy|policies|house rules?|curfew|visitor|guest|bisita|quiet hours?|gate hours?|dorm rules?|amenit(?:y|ies)|wifi|oras)\b/i,
  },
  {
    intent: "support",
    domains: ["support"],
    pattern: /\b(inquir(?:y|ies)|admin|support|concern|complaint|account|profile|password|login|email address|phone number|contact details|support ticket|reklamo|reply|replied|nagreply)\b/i,
  },
]);

const GREETING_PATTERN = /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening)|thanks?|thank you|help)(?:\s+lily)?[.!?\s]*$/i;
const LILYCREST_PATTERN = /\b(lilycrest|dorm(?:itory)?)\b/i;
const FOLLOW_UP_PATTERN = /^(?:why|when|where|which one|how much|how many|what about|how about|and what about|is it|is that|are they|can i|could i|does it|do i|has it|have they|show me|explain that|what does that mean|bakit|kelan|kailan|magkano|paano|pwede ba|meron pa|mayroon pa)(?:\b|[?.!])/i;
const FOLLOW_UP_CONTEXT_PATTERN = /\b(it|that|this|them|there|again|latest|current|next|previous|still|status|date|amount|total|breakdown|available|ready|open|closed|resolved|pending|overdue|paid|unpaid|due|pa ba|pa rin|na ba|nung)\b/i;

export const LILY_DOMAIN_RESPONSE = "I can help with Lilycrest-related concerns such as billing, maintenance, contracts, house rules, announcements, and your tenant account.";

export const LILY_DOMAIN_SUGGESTIONS = Object.freeze([
  Object.freeze({ label: "Check my bill", prompt: "Show my current Lilycrest bill." }),
  Object.freeze({ label: "Contract status", prompt: "What is my current contract status?" }),
  Object.freeze({ label: "Maintenance help", prompt: "Check my maintenance requests." }),
]);

function matchDirectDomain(message) {
  const matched = DOMAIN_RULES.filter((rule) => rule.pattern.test(message));
  if (!matched.length) return null;

  return {
    allowed: true,
    intent: matched[0].intent,
    domains: [...new Set(matched.flatMap((rule) => rule.domains))],
  };
}

function trustedHistoryHasDomain(history = []) {
  return history.slice(-6).some((entry) => {
    if (entry?.role !== "user") return false;
    const text = String(entry?.content || entry?.text || "").trim();
    return Boolean(text && (LILYCREST_PATTERN.test(text) || matchDirectDomain(text)));
  });
}

/**
 * Deterministic, server-side scope gate for authenticated Lily requests.
 * `trustedHistory` must come from server-owned session state; caller-supplied
 * history must never be used to turn an unrelated request into a follow-up.
 */
export function classifyLilyRequest(message, trustedHistory = []) {
  const normalized = String(message || "").replace(/\s+/g, " ").trim();
  const direct = matchDirectDomain(normalized);
  if (direct) return direct;

  if (GREETING_PATTERN.test(normalized) || LILYCREST_PATTERN.test(normalized)) {
    return { allowed: true, intent: "general", domains: [] };
  }

  const isTrustedFollowUp = trustedHistoryHasDomain(trustedHistory)
    && normalized.split(/\s+/).length <= 14
    && (FOLLOW_UP_PATTERN.test(normalized) || FOLLOW_UP_CONTEXT_PATTERN.test(normalized));

  if (isTrustedFollowUp) {
    const previous = [...trustedHistory].reverse()
      .filter((entry) => entry?.role === "user")
      .map((entry) => matchDirectDomain(String(entry?.content || entry?.text || "")))
      .find(Boolean);
    return previous || { allowed: true, intent: "general", domains: [] };
  }

  return { allowed: false, intent: "general", domains: [] };
}

export function lilyDomainReply() {
  return {
    reply: LILY_DOMAIN_RESPONSE,
    suggestions: LILY_DOMAIN_SUGGESTIONS.map((suggestion) => ({ ...suggestion })),
  };
}
