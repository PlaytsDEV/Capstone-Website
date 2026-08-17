/**
 * ============================================================================
 * LILYCREST INTELLIGENT FORM & LEAD PARSER SERVICE (QWEN / LLAMA POWERED)
 * ============================================================================
 *
 * Converts conversational, unstructured Tagalog/Taglish/English chat history
 * into structured parameters conforming to Lilycrest's Inquiry schema.
 * ============================================================================
 */

import { generateChatCompletion, buildStandardMessages } from "./aiProviderService.js";

const LEAD_PARSER_SYSTEM_PROMPT = `
You are the Lilycrest Dormitory Intelligent Lead & Inquiry Parser.
Analyze the conversation between a prospective tenant/visitor and the dormitory assistant.
Extract all lead contact and preference details into a strict JSON object.

Allowed Enum Values:
- preferredBranch: "gil_puyat" | "guadalupe" | "all"
- preferredRoomType: "quadruple_sharing" | "double_sharing" | "private_room" | null
- expectedLengthOfStay: "short_term" | "semester" | "1_year" | null
- viewingRequested: boolean (true if applicant requested an ocular/visit/tour)

Output JSON Schema:
{
  "name": string or null,
  "email": string or null,
  "phone": string or null,
  "preferredBranch": "gil_puyat" | "guadalupe" | "all",
  "preferredRoomType": "quadruple_sharing" | "double_sharing" | "private_room" | null,
  "targetMoveInDate": string or null,
  "expectedLengthOfStay": "short_term" | "semester" | "1_year" | null,
  "viewingRequested": boolean,
  "preferredViewingDate": string or null,
  "notes": string or null,
  "hasContactInfo": boolean,
  "confidenceScore": number (0.0 to 1.0)
}

Strict Rules:
1. Return ONLY the valid JSON object with NO markdown formatting, NO backticks, and NO conversational filler.
2. If phone is mentioned (e.g. 0917-123-4567 or +639171234567), normalize to numeric format where possible.
3. If an email is provided, validate that it contains an @ symbol and a domain.
4. Set "hasContactInfo" to true if either a valid email or phone number is extracted.
`;

/**
 * Heuristic regex extractor for offline or fallback lead extraction.
 */
export function extractLeadHeuristics(text = "") {
  const content = String(text || "");
  const lower = content.toLowerCase();

  // 1. Phone matching (PH mobile patterns)
  const phoneMatch = content.match(/(?:\+63|0)?9\d{2}[-\s]?\d{3}[-\s]?\d{4}|\b09\d{9}\b/);
  const phone = phoneMatch ? phoneMatch[0].replace(/[-\s]/g, "") : null;

  // 2. Email matching
  const emailMatch = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0].toLowerCase() : null;

  // 3. Branch detection
  let preferredBranch = "all";
  if (lower.includes("gil puyat") || lower.includes("pasay")) {
    preferredBranch = "gil_puyat";
  } else if (lower.includes("guadalupe") || lower.includes("makati")) {
    preferredBranch = "guadalupe";
  }

  // 4. Room type detection
  let preferredRoomType = null;
  if (lower.includes("quadruple") || lower.includes("quad") || lower.includes("4 person") || lower.includes("4-person")) {
    preferredRoomType = "quadruple_sharing";
  } else if (lower.includes("double") || lower.includes("2 person") || lower.includes("2-person") || lower.includes("dalawa")) {
    preferredRoomType = "double_sharing";
  } else if (lower.includes("private") || lower.includes("solo") || lower.includes("single") || lower.includes("isang tao")) {
    preferredRoomType = "private_room";
  }

  // 5. Viewing request detection
  const viewingRequested = /(viewing|visit|ocular|schedule|tour|appointment|pumunta|bisita)/i.test(lower);

  // 6. Length of stay
  let expectedLengthOfStay = null;
  if (lower.includes("sem") || lower.includes("semester") || lower.includes("5 month") || lower.includes("6 month")) {
    expectedLengthOfStay = "semester";
  } else if (lower.includes("year") || lower.includes("1 year") || lower.includes("12 month") || lower.includes("taon")) {
    expectedLengthOfStay = "1_year";
  } else if (lower.includes("short") || lower.includes("month") || lower.includes("summer")) {
    expectedLengthOfStay = "short_term";
  }

  const hasContactInfo = Boolean(phone || email);
  const confidenceScore = hasContactInfo ? 0.8 : (preferredRoomType || preferredBranch !== "all" ? 0.5 : 0.2);

  return {
    name: null,
    email,
    phone,
    preferredBranch,
    preferredRoomType,
    targetMoveInDate: null,
    expectedLengthOfStay,
    viewingRequested,
    preferredViewingDate: null,
    notes: text.slice(0, 300),
    hasContactInfo,
    confidenceScore,
  };
}

/**
 * Parses conversational messages into structured lead data using Qwen/Llama with fallback.
 *
 * @param {Array<{role: string, text: string}>|string} input - Conversation history or user message
 * @param {string} [currentBranch="all"] - Active branch context
 * @returns {Promise<Object>} Structured lead payload
 */
export async function parseLeadFromConversation(input, currentBranch = "all") {
  let combinedText = "";

  if (Array.isArray(input)) {
    combinedText = input.map((m) => `${m.role || "user"}: ${m.text || ""}`).join("\n");
  } else {
    combinedText = String(input || "");
  }

  if (!combinedText.trim()) {
    return extractLeadHeuristics("");
  }

  // First check heuristics for rapid evaluation
  const fallback = extractLeadHeuristics(combinedText);
  if (currentBranch !== "all" && fallback.preferredBranch === "all") {
    fallback.preferredBranch = currentBranch;
  }

  try {
    const userPrompt = `Extract lead details from this conversation:\n\n${combinedText}`;
    const messages = buildStandardMessages(LEAD_PARSER_SYSTEM_PROMPT, userPrompt);

    const rawResponse = await generateChatCompletion({
      messages,
      responseFormat: "json",
      temperature: 0.1,
    });

    let parsed = null;
    try {
      const cleanJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    if (parsed && typeof parsed === "object") {
      return {
        name: parsed.name || fallback.name || null,
        email: parsed.email || fallback.email || null,
        phone: parsed.phone || fallback.phone || null,
        preferredBranch: ["gil_puyat", "guadalupe"].includes(parsed.preferredBranch)
          ? parsed.preferredBranch
          : fallback.preferredBranch || "all",
        preferredRoomType: ["quadruple_sharing", "double_sharing", "private_room"].includes(parsed.preferredRoomType)
          ? parsed.preferredRoomType
          : fallback.preferredRoomType || null,
        targetMoveInDate: parsed.targetMoveInDate || null,
        expectedLengthOfStay: ["short_term", "semester", "1_year"].includes(parsed.expectedLengthOfStay)
          ? parsed.expectedLengthOfStay
          : fallback.expectedLengthOfStay || null,
        viewingRequested: Boolean(parsed.viewingRequested || fallback.viewingRequested),
        preferredViewingDate: parsed.preferredViewingDate || null,
        notes: parsed.notes || fallback.notes || null,
        hasContactInfo: Boolean(parsed.email || parsed.phone || fallback.hasContactInfo),
        confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.9,
      };
    }
  } catch (err) {
    console.warn(`[LeadParser] AI lead parsing failed (${err.message}). Using heuristic fallback.`);
  }

  return fallback;
}
