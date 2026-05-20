const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash-lite";
const GEMINI_API_VERSION = "v1beta";
const GEMINI_TIMEOUT_MS = 12000;

const clampText = (value, maxLength = 1200) =>
  String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);

const hasGeminiKey = () =>
  Boolean(String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim());

const getGeminiConfig = () => ({
  apiKey: String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim(),
  model: String(process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL).trim(),
});

const parseGeminiText = (payload) =>
  payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim() || "";

const callGemini = async (prompt) => {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    throw new Error("AI provider is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const endpoint = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 280,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider returned ${response.status}`);
    }

    return parseGeminiText(await response.json());
  } finally {
    clearTimeout(timeout);
  }
};

const stripSensitiveProviderDetails = (text, request = {}) => {
  let output = clampText(text, 900);
  const contact = String(request.assignedProviderContact || "").trim();
  if (contact) {
    output = output.split(contact).join("[contact hidden]");
  }
  return output.replace(/\b(?:\+?63|0)\d[\d\s().-]{7,}\d\b/g, "[contact hidden]");
};

const buildFallbackDraft = (request = {}) => {
  const type = request.typeLabel || request.request_type || "maintenance";
  const status = request.status || "pending";
  const hasProvider = Boolean(request.assignedProviderName || request.assigned_to);

  if (["resolved", "completed", "closed"].includes(status)) {
    return `Hi! Your ${type.toLowerCase()} request has been marked ${status === "closed" ? "closed" : "completed"}. Please review the update and let us know if you need anything else. Thank you.`;
  }

  if (status === "in_progress") {
    return hasProvider
      ? "Hi! Your maintenance request has already been reviewed and is currently in progress. A service provider has been assigned to check the issue. We will update you once there is progress. Thank you for your patience."
      : "Hi! Your maintenance request has already been reviewed and is currently in progress. We will update you once the next step is confirmed. Thank you for your patience.";
  }

  return hasProvider
    ? "Hi! Your maintenance request has been received and a service provider has been assigned to review it. We will update you once there is progress. Thank you for your patience."
    : "Hi! Your maintenance request has been received and is currently under review. We will update you once an admin has confirmed the next step.";
};

export const generateMaintenanceUpdateDraft = async ({ request, timeline = [] } = {}) => {
  const basedOn = {
    status: request?.status || null,
    category: request?.typeLabel || request?.request_type || null,
    hasAssignedProvider: Boolean(request?.assignedProviderName || request?.assigned_to),
  };

  if (!hasGeminiKey()) {
    return {
      draft: "AI drafting is currently unavailable. Please write the update manually.",
      basedOn,
      provider: "unavailable",
      unavailable: true,
    };
  }

  const prompt = [
    "Draft one concise, tenant-friendly maintenance update for Lilycrest.",
    "Use only the facts in the JSON context. Do not invent repair progress, visits, schedules, dates, providers, or phone numbers.",
    "Do not mention provider contact numbers or internal admin-only notes verbatim.",
    "If completion is not supported by status/completion data, do not say the repair is completed.",
    "Return only the message text.",
    JSON.stringify({
      request: {
        type: request?.typeLabel || request?.request_type,
        description: clampText(request?.description, 500),
        status: request?.status,
        urgency: request?.urgency,
        hasAssignedProvider: basedOn.hasAssignedProvider,
        assignedProviderName: request?.assignedProviderName || null,
        notes: clampText(request?.notes, 300),
        resolutionNote: clampText(request?.resolution_note, 300),
      },
      timeline: timeline.slice(-8).map((entry) => ({
        event: entry.event || entry.title,
        status: entry.status,
        note: clampText(entry.note || entry.message, 220),
        timestamp: entry.timestamp || entry.created_at || entry.logged_at,
      })),
    }),
  ].join("\n\n");

  try {
    const draft = stripSensitiveProviderDetails(await callGemini(prompt), request);
    return {
      draft: draft || buildFallbackDraft(request),
      basedOn,
      provider: "gemini",
      unavailable: false,
    };
  } catch {
    return {
      draft: "AI drafting is currently unavailable. Please write the update manually.",
      basedOn,
      provider: "unavailable",
      unavailable: true,
    };
  }
};

const scoreProvider = (provider = {}, request = {}) => {
  let score = 0;
  const rating = Number(provider.internalRating || 0);
  if (Number.isFinite(rating)) score += rating * 10;
  if (provider.averageResponseTime) score += 3;
  if (request.urgency === "high" && /hour|same day|today|within/i.test(provider.averageResponseTime || provider.notes || "")) {
    score += 8;
  }
  if ((provider.internalFeedback || []).length > 0) score += 2;
  return score;
};

export const suggestMaintenanceProviderFromDirectory = async ({
  request,
  providers = [],
} = {}) => {
  if (!Array.isArray(providers) || providers.length === 0) {
    return {
      message: "No matching saved providers found for this branch and request type.",
      recommendation: null,
    };
  }

  const ranked = [...providers].sort((left, right) => {
    const scoreDelta = scoreProvider(right, request) - scoreProvider(left, request);
    if (scoreDelta !== 0) return scoreDelta;
    return String(left.providerName || "").localeCompare(String(right.providerName || ""));
  });
  const recommended = ranked[0];
  const alternative = ranked[1] || null;
  const baseReason = `Matches ${request?.typeLabel || request?.request_type || "this request type"} requests and covers ${request?.branchLabel || request?.branch || "the request branch"}.`;

  return {
    recommendedProviderId: String(recommended._id || recommended.id || ""),
    recommendedProviderName: recommended.providerName,
    reason: recommended.averageResponseTime
      ? `${baseReason} Average response time: ${recommended.averageResponseTime}.`
      : baseReason,
    alternativeProviderId: alternative ? String(alternative._id || alternative.id || "") : null,
    alternativeProviderName: alternative?.providerName || null,
    provider: hasGeminiKey() ? "gemini-safe-directory" : "heuristic-fallback",
  };
};
