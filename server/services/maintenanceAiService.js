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

const clampReportText = (value) =>
  String(value || "").trim().replace(/\r\n/g, "\n").slice(0, 7000);

const stripTenantReportSensitiveDetails = (text, context = {}) => {
  let output = clampReportText(text);
  const sensitiveValues = [
    context?.providerContact,
    context?.providerNotes,
    ...(Array.isArray(context?.internalNotes) ? context.internalNotes : []),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const value of sensitiveValues) {
    output = output.split(value).join("[hidden]");
  }

  return output
    .replace(/\b(?:\+?63|0)\d[\d\s().-]{7,}\d\b/g, "[contact hidden]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[contact hidden]");
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

export const generateMaintenanceReportText = async ({
  reportType = "admin",
  title = "Maintenance Report",
  standardSummary = "",
  context = {},
} = {}) => {
  const safeReportType = reportType === "tenant" ? "tenant" : "admin";
  const fallbackMessage =
    "AI summary is unavailable, so a standard report was generated from the recorded timeline.";
  const fallbackSummary =
    safeReportType === "tenant"
      ? stripTenantReportSensitiveDetails(standardSummary, context)
      : clampReportText(standardSummary);

  if (!hasGeminiKey()) {
    return {
      summary: fallbackSummary,
      provider: "rule-based",
      unavailable: true,
      message: fallbackMessage,
    };
  }

  const safetyRules = safeReportType === "tenant"
    ? [
        "This is a tenant-safe summary. Do not include provider contact numbers, provider notes, admin notes, internal proof, removed attachments, removed file URLs, private comments, internal ratings, or internal feedback.",
        "Use friendly wording and only tenant-visible updates from the JSON context.",
      ]
    : [
        "This is an admin-only case report. Keep admin-only facts if they are present in the JSON context.",
        "Do not add facts, progress, visits, dates, providers, or outcomes that are not present.",
      ];
  const aiContext = safeReportType === "tenant"
    ? {
        ...context,
        providerContact: undefined,
        providerNotes: undefined,
        internalNotes: undefined,
      }
    : context;

  const prompt = [
    `Improve the clarity of this ${safeReportType === "tenant" ? "tenant maintenance summary" : "admin maintenance report"} for Lilycrest.`,
    "Use only the recorded facts in the JSON context and standard report text.",
    "Do not invent repair actions, technician visits, dates, provider names, provider contacts, or completion status.",
    "Preserve the section structure and keep the output suitable for preview and copy/paste.",
    ...safetyRules,
    "Return only the report text.",
    JSON.stringify({
      title,
      reportType: safeReportType,
      context: aiContext,
      standardReport: clampReportText(standardSummary),
    }),
  ].join("\n\n");

  try {
    const generated = clampReportText(await callGemini(prompt));
    const summary = generated || fallbackSummary;
    return {
      summary:
        safeReportType === "tenant"
          ? stripTenantReportSensitiveDetails(summary, context)
          : summary,
      provider: "gemini",
      unavailable: false,
      message: null,
    };
  } catch {
    return {
      summary: fallbackSummary,
      provider: "rule-based",
      unavailable: true,
      message: fallbackMessage,
    };
  }
};

const formatPesoRange = (minRate, maxRate) => {
  const format = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "";
    return `PHP ${amount.toLocaleString("en-PH", {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  };
  const minLabel = format(minRate);
  const maxLabel = format(maxRate);
  if (minLabel && maxLabel && Number(minRate) !== Number(maxRate)) return `${minLabel} - ${maxLabel}`;
  return minLabel || maxLabel || "Rate not recorded";
};

const getProviderRateMidpoint = (provider = {}) => {
  const minRate = Number(provider.minRate ?? provider.minimumRate);
  const maxRate = Number(provider.maxRate ?? provider.maximumRate);
  if (Number.isFinite(minRate) && Number.isFinite(maxRate)) return (minRate + maxRate) / 2;
  if (Number.isFinite(minRate)) return minRate;
  if (Number.isFinite(maxRate)) return maxRate;
  return null;
};

const parseResponseHours = (value) => {
  const text = String(value || "").toLowerCase();
  const firstNumber = Number(text.match(/\d+(\.\d+)?/)?.[0]);
  if (!Number.isFinite(firstNumber)) return null;
  if (text.includes("minute")) return firstNumber / 60;
  if (text.includes("day")) return firstNumber * 24;
  return firstNumber;
};

const getProviderStrength = (scores = {}) => {
  const entries = [
    ["Best Price", scores.price],
    ["Best Rated", scores.rating],
    ["Closest Provider", scores.location],
    ["Fastest Response", scores.response],
  ];
  const [label] = entries.sort((left, right) => right[1] - left[1])[0] || ["Best Overall"];
  return scores.total >= 90 ? "Best Overall" : label;
};

const scoreProvider = (provider = {}, request = {}, context = {}) => {
  const providerKeys = new Set([
    ...(Array.isArray(provider.serviceCategoryKeys) ? provider.serviceCategoryKeys : []),
    ...(Array.isArray(provider.serviceCategories) ? provider.serviceCategories : []),
  ].map((item) => String(item || "").toLowerCase()));
  const requestType = String(request?.request_type || request?.typeLabel || "").toLowerCase();
  const serviceMatch = requestType && [...providerKeys].some((key) => key.includes(requestType) || requestType.includes(key))
    ? 100
    : 75;

  const rateMidpoint = getProviderRateMidpoint(provider);
  const price = rateMidpoint && context.maxRate && context.minRate !== context.maxRate
    ? Math.max(0, Math.min(100, 100 - ((rateMidpoint - context.minRate) / (context.maxRate - context.minRate)) * 100))
    : rateMidpoint
      ? 80
      : 55;

  const rating = Number(provider.averageRating ?? provider.internalRating ?? 0);
  const ratingScore = Number.isFinite(rating) && rating > 0 ? Math.min(100, (rating / 5) * 100) : 60;

  const requestBranch = String(request?.branchLabel || request?.branch || "").toLowerCase();
  const locationText = String(provider.location || provider.notes || "").toLowerCase();
  const locationScore = locationText && requestBranch && locationText.includes(requestBranch) ? 100 : 70;

  const responseHours = parseResponseHours(provider.estimatedResponseTime || provider.averageResponseTime || provider.notes);
  const responseScore = responseHours == null
    ? 65
    : Math.max(40, Math.min(100, 100 - Math.max(responseHours - 1, 0) * 10));

  const total = Math.round(
    serviceMatch * 0.4 +
    price * 0.25 +
    ratingScore * 0.2 +
    locationScore * 0.1 +
    responseScore * 0.05,
  );

  return {
    total,
    serviceMatch,
    price,
    rating: ratingScore,
    location: locationScore,
    response: responseScore,
  };
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

  const rateMidpoints = providers
    .map(getProviderRateMidpoint)
    .filter((value) => Number.isFinite(value));
  const scoreContext = {
    minRate: rateMidpoints.length ? Math.min(...rateMidpoints) : null,
    maxRate: rateMidpoints.length ? Math.max(...rateMidpoints) : null,
  };
  const ranked = [...providers]
    .map((provider) => {
      const scores = scoreProvider(provider, request, scoreContext);
      return {
        provider,
        scores,
        strength: getProviderStrength(scores),
      };
    })
    .sort((left, right) => {
    const scoreDelta = right.scores.total - left.scores.total;
    if (scoreDelta !== 0) return scoreDelta;
    return String(left.provider.providerName || "").localeCompare(String(right.provider.providerName || ""));
  });
  const recommendedRow = ranked[0];
  const recommended = recommendedRow.provider;
  const alternative = ranked[1]?.provider || null;
  const baseReason = `Matches ${request?.typeLabel || request?.request_type || "this request type"} requests and covers ${request?.branchLabel || request?.branch || "the request branch"}.`;
  const comparison = ranked.slice(0, 5).map(({ provider, scores, strength }) => ({
    providerId: String(provider._id || provider.id || ""),
    providerName: provider.providerName,
    serviceType: provider.serviceCategories?.[0] || request?.typeLabel || request?.request_type || "Maintenance",
    estimatedRateLabel: formatPesoRange(provider.minRate ?? provider.minimumRate, provider.maxRate ?? provider.maximumRate),
    minRate: provider.minRate ?? provider.minimumRate ?? null,
    maxRate: provider.maxRate ?? provider.maximumRate ?? null,
    strength,
    aiRating: scores.total,
  }));

  return {
    recommendedProviderId: String(recommended._id || recommended.id || ""),
    recommendedProviderName: recommended.providerName,
    serviceType: recommended.serviceCategories?.[0] || request?.typeLabel || request?.request_type || "Maintenance",
    estimatedRateLabel: formatPesoRange(recommended.minRate ?? recommended.minimumRate, recommended.maxRate ?? recommended.maximumRate),
    minRate: recommended.minRate ?? recommended.minimumRate ?? null,
    maxRate: recommended.maxRate ?? recommended.maximumRate ?? null,
    bestOptionBadge: recommendedRow.strength,
    aiRating: recommendedRow.scores.total,
    reason: recommended.averageResponseTime
      ? `${baseReason} It has a ${recommendedRow.scores.total}% AI rating based on service match, estimated rate, reliability, location, and response time. Estimated response time: ${recommended.averageResponseTime}.`
      : `${baseReason} It has a ${recommendedRow.scores.total}% AI rating based on service match, estimated rate, reliability, location, and response time.`,
    comparison,
    alternativeProviderId: alternative ? String(alternative._id || alternative.id || "") : null,
    alternativeProviderName: alternative?.providerName || null,
    provider: hasGeminiKey() ? "gemini-safe-directory" : "heuristic-fallback",
  };
};
