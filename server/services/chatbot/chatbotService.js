/**
 * ============================================================================
 * LILYCREST PUBLIC AI CHATBOT SERVICE (PHASE 1 MULTI-PROVIDER)
 * ============================================================================
 *
 * Provides intelligent conversational assistance for public website visitors
 * and prospective tenants.
 *
 * Features:
 * - Ultra-low-latency real-time streaming via Groq Llama 3.3 / Gemini 2.5 Flash
 * - Natural Tagalog/Taglish conversational understanding with polite Filipino hospitality
 * - Server-Sent Events (SSE) token streaming
 * - Rich UI widget intent detection (Room Showcase, Viewing Booking, Budget Estimator, KYC Checklist)
 * - Dynamic suggested action pills
 * - Zero-downtime offline rule-based fallback streaming
 * ============================================================================
 */

import {
  dormitoryKnowledgeContext,
  BRANCH_PROFILES,
  ROOM_RATES,
  APPLIANCE_FEES,
  ACCEPTED_KYC_IDS,
  APPLICATION_STAGES,
} from "./knowledgeBase.js";
import {
  streamChatCompletion,
  generateChatCompletion,
  buildStandardMessages,
} from "./aiProviderService.js";

const SYSTEM_PROMPT = `
You are the official Lilycrest AI Chatbot representing Lilycrest Dormitory Management System (Lilycrest DMS).
You welcome prospective tenants and visitors with warm, friendly, polite, and approachable English. Communicate clearly, simply, and helpfully without heavy corporate jargon.

STRICT GROUNDING & BEHAVIOR RULES:
1. Language & Tone: Always respond in warm, friendly, polite, and professional English by default. Do NOT use filler words or honorifics such as "po" or "opo" in English sentences. Keep the tone welcoming, encouraging, and approachable.
2. Grounding: Answer strictly using facts from the OFFICIAL DORMITORY CONTEXT below. NEVER invent or hallucinate unlisted policies.
3. Branches: Always refer to our two official branches: "Gil Puyat Branch" (Pasay City) and "Guadalupe Branch" (Makati City).
4. Concise Responses: Keep replies concise (3 to 4 sentences maximum per turn), clear, friendly, and courteous.
5. Room Types & Availability Navigation: When asked about rooms, types, rates, or pricing, warmly describe our room choices (Quadruple Sharing, Double Sharing, Private Room) and their amenities, and guide visitors to check live room availability and current pricing directly via our official availability checker at /applicant/check-availability. DO NOT quote specific price figures or numerical rates in your chat responses.
6. House Rules & Utilities:
   - Curfew: Building entry locks at 11:00 PM and opens at 5:00 AM (24/7 late entry is warmly accommodated for night-shift workers and students with a valid ID or prior notice).
   - Free water and high-speed fiber Wi-Fi are completely included in base monthly rent.
   - Monthly rent due dates follow each tenant's individual move-in / lease start cycle (not fixed to the 15th for all tenants).
   - Electricity is measured per room via dedicated submeter and shared pro-rata monthly on the 15th among active room occupants.
   - Laptops and smartphones are charged ₱0.00 (free of charge).
7. 5-Stage Guided Application: 1) Room Selection -> 2) Viewing Schedule / Remote Waiver -> 3) Tenant Info & KYC -> 4) Payment Deposit (1-mo advance + 1-mo deposit) -> 5) Confirmation & Admin Approval (24-48 hrs).
8. KYC IDs: Passport, UMID, Driver's License, PhilSys National ID, Postal ID, PRC ID, Student ID + current semester COR.
9. Unlisted Topics: If an inquiry cannot be answered by the context, politely and warmly suggest escalating to our Branch Admin team.
10. Strictly No Icons or Emojis: Do NOT use icons, emojis, or graphical symbols in your answers or responses. Format all responses using clean, plain text and standard markdown bold or lists only.

OFFICIAL DORMITORY CONTEXT:
${dormitoryKnowledgeContext}
`;

/**
 * Detects visitor intent to display rich interactive widgets in the chat modal.
 *
 * @param {string} message - User query text
 * @param {string} [branchFocus="all"] - Branch filter ("all" | "gil_puyat" | "guadalupe")
 * @returns {Object|null} Rich widget payload or null
 */
export function detectWidgetIntent(message = "", branchFocus = "all") {
  const text = (message || "").toLowerCase();

  // 1. Budget Estimator / Total Cost intent
  if (
    text.includes("budget") ||
    text.includes("estimate") ||
    text.includes("total cost") ||
    text.includes("calculator") ||
    text.includes("magkano lahat") ||
    text.includes("appliance fee") ||
    text.includes("additional fee")
  ) {
    return {
      type: "budget_estimator",
      title: "Lilycrest Monthly Budget Estimator",
      data: {
        baseRates: {
          quadruple_sharing: 3500,
          double_sharing: 5500,
          private_room: 9000,
        },
        applianceFees: {
          miniRefrigerator: APPLIANCE_FEES.miniRefrigerator.fee,
          riceCooker: APPLIANCE_FEES.riceCooker.fee,
          electricFan: APPLIANCE_FEES.electricFan.fee,
        },
        waterIncluded: true,
        advanceMonths: 1,
        depositMonths: 1,
      },
    };
  }

  // 2. Schedule Viewing / Ocular Tour intent
  if (
    text.includes("viewing") ||
    text.includes("visit") ||
    text.includes("tour") ||
    text.includes("schedule") ||
    text.includes("ocular") ||
    text.includes("appointment") ||
    text.includes("bisita") ||
    text.includes("pumunta") ||
    text.includes("makita")
  ) {
    return {
      type: "viewing_booking",
      title: "Schedule an In-Person Viewing",
      data: {
        defaultBranch: branchFocus !== "all" ? branchFocus : "guadalupe",
        branches: [
          { id: "gil_puyat", name: "Gil Puyat (Pasay)", location: BRANCH_PROFILES.gil_puyat.location },
          { id: "guadalupe", name: "Guadalupe (Makati)", location: BRANCH_PROFILES.guadalupe.location },
        ],
        visitingHours: "8:00 AM – 6:00 PM (Monday to Saturday)",
      },
    };
  }

  // 3. KYC Checklist / Accepted IDs / Requirements intent
  const hasIdKeyword =
    /\b(id|ids|kyc|cor|prc|umid|passport)\b/i.test(text) ||
    text.includes("valid id") ||
    text.includes("document") ||
    text.includes("requirement") ||
    text.includes("papeles") ||
    text.includes("kailangan");

  if (hasIdKeyword) {
    return {
      type: "kyc_checklist",
      title: "Accepted KYC Documents & IDs",
      data: {
        acceptedIds: ACCEPTED_KYC_IDS,
        note: "Students must present their valid Student ID alongside their current semester Certificate of Registration (COR).",
      },
    };
  }

  // 4. Room Showcase / Rates / Availability intent
  if (
    text.includes("rate") ||
    text.includes("price") ||
    text.includes("pricing") ||
    text.includes("quadruple") ||
    text.includes("double") ||
    text.includes("private") ||
    text.includes("magkano") ||
    text.includes("room") ||
    text.includes("kwarto") ||
    text.includes("bed") ||
    text.includes("available") ||
    text.includes("avail")
  ) {
    return {
      type: "room_showcase",
      title: "Lilycrest Room Types & Availability",
      data: {
        branch: branchFocus || "all",
        rooms: ROOM_RATES,
      },
    };
  }

  return null;
}

/**
 * Parses user message and bot reply to generate dynamic suggested action pills.
 *
 * @param {string} message - User message
 * @param {string} botReply - Bot response text
 * @param {string} [branchFocus="all"] - Active branch filter
 * @returns {Array<{label: string, url?: string, action?: string, prompt?: string}>}
 */
export function determineSuggestedActions(message = "", botReply = "", branchFocus = "all") {
  const actions = [];
  const text = `${message} ${botReply}`.toLowerCase();

  // 1. Room type filters prioritized if mentioned
  if (text.includes("quadruple") || text.includes("quad")) {
    actions.push({ label: "View Quadruple Rooms", url: "/applicant/check-availability?roomType=Quadruple" });
  }
  if (text.includes("double") || text.includes("shared")) {
    actions.push({ label: "View Double Rooms", url: "/applicant/check-availability?roomType=Shared" });
  }
  if (text.includes("private") || text.includes("solo")) {
    actions.push({ label: "View Private Rooms", url: "/applicant/check-availability?roomType=Private" });
  }

  // 2. Branch-specific room browsing
  if (
    branchFocus === "guadalupe" ||
    (text.includes("guadalupe") && (text.includes("rate") || text.includes("room") || text.includes("price") || text.includes("avail") || text.includes("where")))
  ) {
    actions.push({ label: "Check Guadalupe Rooms", url: "/applicant/check-availability?branch=Guadalupe" });
  } else if (
    branchFocus === "gil_puyat" ||
    ((text.includes("gil puyat") || text.includes("pasay")) && (text.includes("rate") || text.includes("room") || text.includes("price") || text.includes("avail") || text.includes("where")))
  ) {
    actions.push({ label: "Check Gil Puyat Rooms", url: "/applicant/check-availability?branch=Gil%20Puyat" });
  } else {
    actions.push({ label: "Check Room Availability", url: "/applicant/check-availability" });
    actions.push({ label: "Check Guadalupe Rooms", url: "/applicant/check-availability?branch=Guadalupe" });
    actions.push({ label: "Check Gil Puyat Rooms", url: "/applicant/check-availability?branch=Gil%20Puyat" });
  }

  // 3. Application & Requirements
  if (text.includes("apply") || text.includes("reserve") || text.includes("reservation") || text.includes("process")) {
    actions.push({ label: "Start Application", url: "/applicant/check-availability" });
  }
  if (/\b(id|ids|kyc)\b/i.test(text) || text.includes("requirement") || text.includes("document")) {
    actions.push({ label: "Accepted KYC IDs", prompt: "What valid IDs are accepted for application?" });
  }

  // 4. Default viewing & escalation fallback action
  actions.push({ label: "Schedule a Viewing", action: "open_escalation_form" });

  // Deduplicate
  const uniqueActions = [];
  const seenLabels = new Set();
  for (const act of actions) {
    if (!seenLabels.has(act.label)) {
      seenLabels.add(act.label);
      uniqueActions.push(act);
    }
  }

  // Always preserve room-specific or branch link + viewing escalation
  if (uniqueActions.length > 3) {
    const hasEscalation = uniqueActions.some((a) => a.action === "open_escalation_form");
    const top = uniqueActions.slice(0, 3);
    if (!top.some((a) => a.action === "open_escalation_form") && hasEscalation) {
      const esc = uniqueActions.find((a) => a.action === "open_escalation_form");
      top[2] = esc;
    }
    return top;
  }

  return uniqueActions;
}

/**
 * Courteous rule-based fallback responses when all AI providers are offline or unconfigured.
 *
 * @param {string} message - User query text
 * @param {string} [branchFocus="all"] - Branch filter
 * @returns {string} Courteous, grounded answer
 */
export function getRuleBasedFallback(message = "", branchFocus = "all") {
  const rawText = (message || "").trim();
  const text = rawText.toLowerCase();

  const isTagalog = /(magkano|ano\b|saan\b|kailan|paano|meron|may\b|kwarto|sangay|kuryente|tubig|gamit|pwede|pede|bisita|kamusta|salamat|kailangan|papeles|bahay)/i.test(rawText);
  const mentionsBothBranches = (text.includes("gil puyat") || text.includes("pasay")) && (text.includes("guadalupe") || text.includes("makati"));

  // 1. Room Types & Availability Inquiries
  if (text.includes("quadruple") || text.includes("quad")) {
    if (isTagalog) {
      return "Ang aming Quadruple Sharing Room ay may 4 bunk beds, air-conditioning, personal steel locker, dedicated study desk, at shared en-suite bathroom. Maaari ninyong i-check ang live availability sa ating [Check Room Availability](/applicant/check-availability) page.";
    }
    return "Our **Quadruple Sharing Room** features 4 bunk beds, air-conditioning, personal steel locker, dedicated study desk, high-speed Wi-Fi, and a shared en-suite bathroom. You can check real-time availability on our [Check Room Availability](/applicant/check-availability) page.";
  }

  if (text.includes("double")) {
    if (isTagalog) {
      return "Ang aming Double Sharing Room ay may 2 single/bunk beds, air-conditioning, personal study table, clothes wardrobe, at shared en-suite bathroom para sa 2 tenants. Maaari ninyong i-check ang live availability sa ating [Check Room Availability](/applicant/check-availability) page.";
    }
    return "Our **Double Sharing Room** features 2 beds, air-conditioning, ergonomic study desks, personal wardrobe, high-speed Wi-Fi, and a shared en-suite bathroom for 2 tenants. You can check current availability on our [Check Room Availability](/applicant/check-availability) page.";
  }

  if (text.includes("private") || text.includes("solo")) {
    if (isTagalog) {
      return "Ang aming Private Solo Room ay may premium single bed, air-conditioning, executive study desk, private en-suite bathroom, at extra personal storage. Maaari ninyong i-check ang live availability sa ating [Check Room Availability](/applicant/check-availability) page.";
    }
    return "Our **Private Solo Room** offers ultimate comfort with a premium single bed, private en-suite bathroom, executive study area, air-conditioning, and high-speed Wi-Fi. Check real-time vacancy on our [Check Room Availability](/applicant/check-availability) page.";
  }

  // 2. Both branches & Room Types breakdown
  if (
    mentionsBothBranches ||
    ((text.includes("rate") || text.includes("price") || text.includes("room") || text.includes("types") || text.includes("magkano")) &&
     (text.includes("gil puyat") || text.includes("guadalupe")))
  ) {
    if (isTagalog) {
      return "Nag-aalok ang Lilycrest ng tatlong uri ng kwarto:\n1. **Quadruple Sharing**\n2. **Double Sharing**\n3. **Private Room**\nAvailable ito sa aming **Gil Puyat** at **Guadalupe** branches. Maaari ninyong i-check ang live availability sa [Check Room Availability](/applicant/check-availability).";
    }
    return "Lilycrest offers three room categories across our **Gil Puyat** and **Guadalupe** branches:\n1. **Quadruple Sharing**\n2. **Double Sharing**\n3. **Private Room**\nCheck real-time rates and vacancies on our [Check Room Availability](/applicant/check-availability) page.";
  }

  // 3. Branches & Location
  if (text.includes("branch") || text.includes("location") || text.includes("saan") || branchFocus === "guadalupe" || branchFocus === "gil_puyat") {
    const branchName = branchFocus === "guadalupe" || text.includes("guadalupe") ? "Guadalupe Branch (Makati City)" : "Gil Puyat Branch (Pasay City)";
    if (isTagalog) {
      return `Mabuhay! Ang aming ${branchName} ay handang maglingkod sa inyo. Mayroon din kaming Gil Puyat at Guadalupe branches. Aling branch ang nais ninyong i-explore?`;
    }
    return `Lilycrest operates welcoming dormitory branches: **Gil Puyat Branch** in Pasay City and **Guadalupe Branch** in Makati City. We would love to assist you with room options at ${branchName}!`;
  }

  // 4. Curfew & Building Access
  if (text.includes("curfew") || text.includes("lock") || text.includes("oras") || text.includes("late") || text.includes("gabi")) {
    if (isTagalog) {
      return "Ang standard curfew ng Lilycrest ay **11:00 PM hanggang 5:00 AM**. Para sa mga nagtatrabaho ng panggabi (night-shift) o may school commitments, pinapayagan ang 24/7 late access basta may presented company/school ID o prior written notification sa Front Desk.";
    }
    return "Lilycrest implements a standard building curfew from **11:00 PM to 5:00 AM**. However, 24/7 late entry is fully accommodated for tenants with night-shift work or academic requirements upon presenting valid proof or prior written notice to the Front Desk.";
  }

  // 5. KYC IDs & Requirements
  if (/\b(id|ids|kyc)\b/i.test(text) || text.includes("valid id") || text.includes("requirement") || text.includes("papeles") || text.includes("kailangan")) {
    if (isTagalog) {
      return "Tumatanggap kami ng mga sumusunod na valid IDs: Passport, UMID, Driver's License, PhilSys National ID, Postal ID, PRC ID, at Student ID (kalakip ang current semester COR).";
    }
    return "Lilycrest accepts the following valid IDs for application: Passport, UMID, Driver's License, PhilSys National ID, Postal ID, PRC ID, and Student ID (with current semester Certificate of Registration).";
  }

  // 6. Utilities & Wi-Fi
  if (text.includes("kuryente") || text.includes("electric") || text.includes("water") || text.includes("tubig") || text.includes("wifi") || text.includes("wi-fi") || text.includes("internet")) {
    if (isTagalog) {
      return "Libre ang konsumo sa tubig at high-speed fiber Wi-Fi! Ang konsumo naman sa kuryente ay sinusukat kada kwarto via dedicated submeter at hinahati nang pantay (pro-rata) sa mga aktibong boarders ng kwarto kada ika-15 ng buwan.";
    }
    return "**High-speed Fiber Wi-Fi** and **water consumption** are 100% free and included in your monthly rent. **Electricity** is measured per room via dedicated submeters and billed pro-rata monthly among active room occupants on the 15th.";
  }

  // Default Greeting / Welcome
  if (text.includes("hi") || text.includes("hello") || text.includes("kamusta") || text.includes("mabuhay")) {
    if (isTagalog) {
      return "Mabuhay! Malugod kayong tinatanggap sa Lilycrest Dormitory AI Assistant. Maaari kayong magtanong tungkol sa aming mga sangay sa Gil Puyat at Guadalupe, room types, house rules, o magpa-schedule ng viewing!";
    }
    return "Hello and welcome to Lilycrest Dormitory! I am your AI assistant. Feel free to ask about our room types and monthly rates for **Gil Puyat** and **Guadalupe**, house rules, curfews, utility billing, or scheduling an in-person tour.";
  }

  if (isTagalog) {
    return "Maraming salamat sa pag-inquire sa Lilycrest AI Chatbot! Kung may karagdagang katanungan kayo o nais mag-book ng ocular visit, maaari kayong mag-iwan ng contact details para matawagan kayo ng aming Branch Admin.";
  }

  return "Thank you for reaching out to Lilycrest AI Chatbot! If you would like more details or wish to schedule an ocular visit, feel free to ask or click below to request front desk assistance.";
}

/**
 * Builds the payload contents array formatted for Gemini API (backward compatibility).
 */
export function buildGeminiContents(message, conversationHistory) {
  return buildStandardMessages(SYSTEM_PROMPT, message, conversationHistory);
}

/**
 * Simulates a smooth word-by-word streaming experience for offline or fallback responses.
 */
async function simulateFallbackStream(text, { onToken, signal }) {
  if (!text) return;
  const words = text.match(/\S+|\s+/g) || [text];
  const delay = process.env.NODE_ENV === "test" ? 0 : 12;
  for (const token of words) {
    if (signal?.aborted) break;
    onToken?.(token);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Stream conversational responses using the multi-provider LLM core (Groq primary, Gemini fallback).
 *
 * @param {Object} options
 * @param {string} options.message - User message text
 * @param {Array<{role: string, text: string}>} [options.conversationHistory=[]] - Chat history
 * @param {string} [options.branchFocus="all"] - Branch filter
 * @param {Function} [options.onToken] - Callback for each stream token
 * @param {Function} [options.onWidget] - Callback for emitted rich widget
 * @param {Function} [options.onActions] - Callback for suggested actions
 * @param {Function} [options.onDone] - Callback on stream completion
 * @param {Function} [options.onError] - Callback on error
 * @param {AbortSignal} [options.signal] - Abort signal
 */
export async function streamGeminiChatbot({
  message,
  conversationHistory = [],
  branchFocus = "all",
  onToken,
  onWidget,
  onActions,
  onDone,
  onError,
  signal,
}) {
  const trimmedMessage = (message || "").trim();

  // Emit widget if detected from intent
  const widget = detectWidgetIntent(trimmedMessage, branchFocus);
  if (widget && typeof onWidget === "function") {
    try {
      onWidget(widget);
    } catch {
      // Non-fatal
    }
  }

  const messages = buildStandardMessages(SYSTEM_PROMPT, trimmedMessage, conversationHistory);

  try {
    const fullReply = await streamChatCompletion({
      messages,
      onToken,
      signal,
    });

    const actions = determineSuggestedActions(trimmedMessage, fullReply, branchFocus);
    onActions?.(actions);
    onDone?.({
      fullReply,
      widget,
      suggestedActions: actions,
      canEscalate: true,
    });
  } catch (err) {
    if (signal?.aborted) {
      return; // Connection closed by client
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("[ChatbotService] Streaming failed, using rule-based fallback:", err?.message);
    }

    // Fallback gracefully to rule-based streaming
    const fallbackReply = getRuleBasedFallback(trimmedMessage, branchFocus);
    await simulateFallbackStream(fallbackReply, { onToken, signal });
    const actions = determineSuggestedActions(trimmedMessage, fallbackReply, branchFocus);
    onActions?.(actions);
    onDone?.({
      fullReply: fallbackReply,
      widget,
      suggestedActions: actions,
      canEscalate: true,
    });
  }
}

/**
 * Standard non-streaming query handler maintaining backward compatibility with existing tests and callers.
 */
export const queryGeminiChatbot = async (arg1, arg2 = [], arg3 = "all") => {
  let message = "";
  let conversationHistory = [];
  let branchFocus = "all";

  if (typeof arg1 === "object" && arg1 !== null) {
    message = arg1.message || "";
    conversationHistory = arg1.conversationHistory || [];
    branchFocus = arg1.branchFocus || "all";
  } else {
    message = String(arg1 || "");
    conversationHistory = Array.isArray(arg2) ? arg2 : [];
    branchFocus = String(arg3 || "all");
  }

  const trimmedMessage = message.trim();
  const widget = detectWidgetIntent(trimmedMessage, branchFocus);
  const messages = buildStandardMessages(SYSTEM_PROMPT, trimmedMessage, conversationHistory);

  try {
    const reply = await generateChatCompletion({
      messages,
      temperature: 0.65,
    });

    if (reply) {
      return {
        reply,
        suggestedActions: determineSuggestedActions(trimmedMessage, reply, branchFocus),
        widget,
        canEscalate: true,
      };
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[ChatbotService] Query failed, using rule-based fallback:", error?.message);
    }
  }

  const fallbackReply = getRuleBasedFallback(trimmedMessage, branchFocus);
  return {
    reply: fallbackReply,
    suggestedActions: determineSuggestedActions(trimmedMessage, fallbackReply, branchFocus),
    widget,
    canEscalate: true,
  };
};
