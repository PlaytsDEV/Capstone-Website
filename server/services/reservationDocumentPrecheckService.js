const DOCUMENT_PRECHECK_MODEL =
  process.env.RESERVATION_DOCUMENT_PRECHECK_MODEL || "gemini-1.5-flash";
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
const MAX_INLINE_BYTES = 5 * 1024 * 1024;

const JSON_FENCE_REGEX = /```(?:json)?\s*([\s\S]*?)```/i;

const DOCUMENT_LABELS = Object.freeze({
  selfie_photo: "selfie photo",
  valid_id_front: "valid ID front",
  valid_id_back: "valid ID back",
  nbi_clearance: "NBI clearance",
  company_id: "company or school ID",
});

const buildResult = ({
  status = "not_checked",
  warnings = [],
  summary = "",
  provider = "system",
}) => ({
  aiCheckStatus: status,
  aiCheckWarnings: warnings.filter(Boolean),
  aiCheckedAt: new Date(),
  requiresAdminAttention: status !== "passed",
  summaryMessage: summary,
  provider,
});

const parseJsonText = (text) => {
  const match = JSON_FENCE_REGEX.exec(String(text || ""));
  const raw = match?.[1] || text;
  return JSON.parse(raw);
};

const extractGeminiText = (payload) =>
  payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim() || "";

const normalizeWarnings = (warnings) =>
  Array.isArray(warnings)
    ? warnings
        .map((warning) => String(warning || "").trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];

const normalizeAiStatus = (status, warnings) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "passed") return "passed";
  if (normalized === "failed") return "failed";
  if (normalized === "warning") return "warning";
  return warnings.length > 0 ? "warning" : "passed";
};

const buildPrompt = ({ documentType, idType }) => {
  const label = DOCUMENT_LABELS[documentType] || "document";
  const idTypeLine =
    documentType === "valid_id_front" || documentType === "valid_id_back"
      ? `The applicant selected the document type: ${idType || "unknown"}.`
      : "";

  return [
    "You are assisting a dormitory reservation system with document pre-checking.",
    "Do not approve or reject applicants.",
    "Only assess obvious document-quality and document-type issues visible in the uploaded file.",
    "Check for: blurry image, cropped edges, document too dark, document too bright, rotated or hard to read, unreadable text, wrong document type, incomplete document view, or missing expected visible content.",
    "If the document looks usable but has minor concerns, return warning.",
    "If the document is obviously unreadable or unusable, return failed.",
    `Review this ${label}.`,
    idTypeLine,
    'Return strict JSON only with this shape: {"status":"passed|warning|failed","warnings":["short warning"],"summary":"short summary","documentTypeMatch":true,"fullDocumentVisible":true,"readability":"clear|partially_unreadable|unreadable"}.',
  ]
    .filter(Boolean)
    .join("\n");
};

const downloadDocument = async (documentUrl) => {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available for document pre-checking.");
  }

  const response = await fetch(documentUrl, {
    method: "GET",
    headers: {
      Accept: "image/*,application/pdf",
    },
  });

  if (!response.ok) {
    throw new Error(`Document download failed with status ${response.status}.`);
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";

  if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
    return {
      mimeType,
      unsupported: true,
      buffer: null,
    };
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_INLINE_BYTES) {
    return {
      mimeType,
      oversized: true,
      buffer: null,
    };
  }

  return {
    mimeType,
    buffer,
    oversized: false,
    unsupported: false,
  };
};

const callGeminiDocumentCheck = async ({
  documentUrl,
  documentType,
  idType,
}) => {
  const downloaded = await downloadDocument(documentUrl);

  if (downloaded.unsupported) {
    return buildResult({
      status: "warning",
      warnings: [
        "This file type could not be analyzed automatically. Admin will review it manually.",
      ],
      summary: "Automatic analysis skipped because the file type is unsupported.",
      provider: "basic_checks",
    });
  }

  if (downloaded.oversized) {
    return buildResult({
      status: "warning",
      warnings: [
        "This file is too large for automatic pre-checking. Admin will review it manually.",
      ],
      summary: "Automatic analysis skipped because the uploaded file is too large.",
      provider: "basic_checks",
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DOCUMENT_PRECHECK_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt({ documentType, idType }),
              },
              {
                inlineData: {
                  mimeType: downloaded.mimeType,
                  data: downloaded.buffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Document pre-check request failed with ${response.status}: ${errorText.slice(0, 180)}`,
    );
  }

  const payload = await response.json();
  const text = extractGeminiText(payload);
  if (!text) {
    throw new Error("Document pre-check returned an empty response.");
  }

  const parsed = parseJsonText(text);
  const warnings = normalizeWarnings(parsed?.warnings);
  const status = normalizeAiStatus(parsed?.status, warnings);

  return buildResult({
    status,
    warnings,
    summary:
      String(parsed?.summary || "").trim() ||
      (status === "passed"
        ? "Document appears usable for admin review."
        : "Document may need applicant attention before admin review."),
    provider: "gemini",
  });
};

export const runReservationDocumentPrecheck = async ({
  documentType,
  documentUrl,
  idType = "",
}) => {
  if (!documentUrl) {
    return buildResult({
      status: "failed",
      warnings: ["No document was uploaded for checking."],
      summary: "Upload a document first before running the pre-check.",
      provider: "basic_checks",
    });
  }

  if (!GEMINI_API_KEY) {
    return buildResult({
      status: "error",
      warnings: [
        "AI document pre-check is not configured. Your documents will still be reviewed by admin.",
      ],
      summary:
        "Automatic pre-check is unavailable until a Gemini API key is configured on the server.",
      provider: "unconfigured",
    });
  }

  try {
    return await callGeminiDocumentCheck({
      documentUrl,
      documentType,
      idType,
    });
  } catch (error) {
    return buildResult({
      status: "error",
      warnings: [
        "Automatic document pre-check could not be completed. Admin will review this file manually.",
      ],
      summary:
        error?.message ||
        "Automatic document pre-check could not be completed.",
      provider: "error",
    });
  }
};
