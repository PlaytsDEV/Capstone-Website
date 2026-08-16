/**
 * ============================================================================
 * LILYCREST PUBLIC AI CHATBOT SERVICE (PHASE 1 PRO MAX)
 * ============================================================================
 *
 * Provides intelligent conversational assistance for public website visitors
 * and prospective tenants.
 *
 * Features:
 * - Grounded LLM generation with Gemini 2.5 Flash
 * - Natural Tagalog/Taglish conversational understanding with polite Filipino hospitality
 * - Server-Sent Events (SSE) token streaming with low latency
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

const SYSTEM_PROMPT = `
You are the official Lilycrest AI Chatbot representing Lilycrest Dormitory Management System (Lilycrest DMS).
You embody warm, respectful Filipino hospitality (Mabuhay!), answering inquiries with polite professionalism and natural Tagalog/Taglish fluency (using respectful honorifics "po" and "opo" when addressed in Tagalog/Taglish).

STRICT GROUNDING & BEHAVIOR RULES:
1. Grounding: Answer strictly using facts from the OFFICIAL DORMITORY CONTEXT below. NEVER invent or hallucinate unlisted policies.
2. Branches: Always refer to our two official branches: "Gil Puyat Branch" (Pasay City) and "Guadalupe Branch" (Makati City).
3. Concise Responses: Keep replies concise (3 to 4 sentences maximum per turn), clear, and courteous.
4. Room Types & Availability Navigation: When asked about rooms, types, rates, or pricing, describe the room types (Quadruple Sharing, Double Sharing, Private Room) and their amenities, and guide visitors to check live room availability and current pricing directly via our official availability checker at /applicant/check-availability. DO NOT quote specific price figures or numerical rates in your chat responses.
5. House Rules & Utilities:
   - Curfew: Building entry locks at 11:00 PM and opens at 5:00 AM (24/7 late entry permitted with night-shift company ID or prior written log).
   - Free water and Wi-Fi included in base monthly rent.
   - Electricity is metered per room and billed pro-rata monthly on the 15th among active room occupants.
   - Laptops and smartphones are free of charge.
6. 5-Stage Guided Application: 1) Room Selection -> 2) Viewing Schedule / Remote Waiver -> 3) Tenant Info & KYC -> 4) Payment Deposit (1-mo advance + 1-mo deposit) -> 5) Confirmation & Admin Approval (24-48 hrs).
7. KYC IDs: Passport, UMID, Driver's License, PhilSys National ID, Postal ID, PRC ID, Student ID + current semester COR.
8. Unlisted Topics: If an inquiry cannot be answered by the context, politely suggest escalating to our Branch Admin team.

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

  // 3. KYC Checklist / Accepted IDs / Requirements intent (using word boundary check to avoid false matches like 'fridge')
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
 * Parses user message and bot reply to generate dynamic, context-aware suggested action pills.
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
 * Courteous rule-based fallback responses when Gemini is offline or API key is absent.
 *
 * @param {string} message - User query text
 * @param {string} [branchFocus="all"] - Branch filter
 * @returns {string} Courteous, grounded answer
 */
export function getRuleBasedFallback(message = "", branchFocus = "all") {
  const rawText = (message || "").trim();
  const text = rawText.toLowerCase();

  // Detect Tagalog/Taglish vs English
  const isTagalog = /(po\b|opo\b|magkano|ano\b|saan\b|kailan|paano|meron|may\b|kwarto|sangay|kuryente|tubig|gamit|pwede|pede|bisita|kamusta|salamat|kailangan|papeles|bahay)/i.test(rawText);

  // Both branches mentioned
  const mentionsBothBranches = (text.includes("gil puyat") || text.includes("pasay")) && (text.includes("guadalupe") || text.includes("makati"));

  // 1. Room Types & Availability Inquiries
  if (text.includes("quadruple") || text.includes("quad")) {
    if (isTagalog) {
      return "Ang aming Quadruple Sharing Room po ay may 4 bunk beds, air-conditioning, personal steel locker, dedicated study desk, at shared en-suite bathroom. Maaari po ninyong i-check ang live availability at kasalukuyang rates sa ating [Check Room Availability](/applicant/check-availability) page.";
    }
    return "Our **Quadruple Sharing Room** features 4 bunk beds, air-conditioning, personal steel locker, dedicated study desk, high-speed Wi-Fi, and a shared en-suite bathroom. You can check real-time availability and live rates on our [Check Room Availability](/applicant/check-availability) page.";
  }

  if (text.includes("double")) {
    if (isTagalog) {
      return "Ang aming Double Sharing Room po ay may 2 single/bunk beds, air-conditioning, personal study table, clothes wardrobe, at shared en-suite bathroom para sa 2 tenants. Maaari po ninyong i-check ang live availability sa ating [Check Room Availability](/applicant/check-availability) page.";
    }
    return "Our **Double Sharing Room** features 2 beds, air-conditioning, ergonomic study desks, personal wardrobe, high-speed Wi-Fi, and a shared en-suite bathroom for 2 tenants. You can check current availability on our [Check Room Availability](/applicant/check-availability) page.";
  }

  if (text.includes("private") || text.includes("solo")) {
    if (isTagalog) {
      return "Ang aming Private Solo Room po ay solo occupancy na may dedicated inverter aircon, executive work desk, high-speed Wi-Fi, at private ensuite bathroom. Maaari po ninyong tingnan ang availability sa ating [Check Room Availability](/applicant/check-availability) page.";
    }
    return "Our **Private Solo Room** offers solo occupancy with dedicated inverter air-conditioning, an executive work desk, high-speed Wi-Fi, and a private ensuite bathroom. You can check current availability on our [Check Room Availability](/applicant/check-availability) page.";
  }

  if (text.includes("rate") || text.includes("price") || text.includes("magkano") || text.includes("pricing") || text.includes("cost") || text.includes("room type") || text.includes("types") || text.includes("avail") || text.includes("budget")) {
    if (isTagalog) {
      return "Mayroon po kaming tatlong uri ng kwarto sa aming Gil Puyat at Guadalupe branches: **Quadruple Sharing Room**, **Double Sharing Room**, at **Private Room**. Libre po ang tubig at Wi-Fi! Upang makita ang live availability at kasalukuyang rates para sa inyong napiling petsa, mangyaring magtungo sa ating [Check Room Availability](/applicant/check-availability) page.";
    }
    return "At Lilycrest, we offer three room types across our **Gil Puyat (Pasay)** and **Guadalupe (Makati)** branches:\n\n• **Quadruple Sharing Room** — 4 bunk beds, air-conditioned, personal steel locker, study desk, shared en-suite bathroom.\n• **Double Sharing Room** — 2 beds, air-conditioned, ergonomic study tables, wardrobe, shared en-suite bathroom.\n• **Private Room** — Solo occupancy, dedicated inverter aircon, executive work desk, private en-suite bathroom.\n\nWater and high-speed Wi-Fi are included in your rent. To check real-time room availability, vacant bed positions, and live rates for your preferred dates, please visit our [Check Room Availability](/applicant/check-availability) page.";
  }

  // 2. Branch Location Inquiries
  if (mentionsBothBranches) {
    if (isTagalog) {
      return "Mayroon po kaming dalawang strategic branches: Ang **Gil Puyat Branch** (Buendia / Taft Ave, Pasay City malapit sa LRT-1) at ang **Guadalupe Branch** (EDSA Guadalupe Nuevo, Makati City malapit sa MRT-3 at BGC).";
    }
    return "Lilycrest operates two strategic branches:\n\n• **Gil Puyat Branch**: Located along Buendia / Taft Avenue, Pasay City (near LRT-1 Gil Puyat Station & Arellano University).\n• **Guadalupe Branch**: Located at EDSA Guadalupe Nuevo, Makati City (near MRT-3 Guadalupe Station & BGC Bus Terminal).";
  }

  if (text.includes("gil puyat") || text.includes("pasay") || branchFocus === "gil_puyat") {
    if (isTagalog) {
      return "Ang aming Gil Puyat Branch po ay matatagpuan sa Buendia / Taft Avenue, Pasay City, malapit sa LRT-1 Gil Puyat Station, Arellano University, at DLTB/JAM Liner terminals. Malugod po kayong makakabisita para sa on-site viewing!";
    }
    return "Our **Gil Puyat Branch** is located along Buendia / Taft Avenue, Pasay City, steps away from LRT-1 Gil Puyat Station, Arellano University, and provincial bus terminals. On-site tours are available Monday to Saturday!";
  }

  if (text.includes("guadalupe") || text.includes("makati") || branchFocus === "guadalupe") {
    if (isTagalog) {
      return "Ang aming Guadalupe Branch po ay matatagpuan sa EDSA Guadalupe Nuevo, Makati City, malapit sa MRT-3 Guadalupe Station, Guadalupe Mall, at BGC Bus Terminal. Napakadali po nitong puntahan para sa mga nagtatrabaho sa BGC o Makati CBD!";
    }
    return "Our **Guadalupe Branch** is located at EDSA Guadalupe Nuevo, Makati City, conveniently accessible via MRT-3 Guadalupe Station and minutes away from BGC and Makati CBD. We welcome prospective tenants for ocular visits!";
  }

  // 3. Curfew & House Rules
  if (text.includes("curfew") || text.includes("oras") || text.includes("gate") || text.includes("late")) {
    if (isTagalog) {
      return "Ang aming main entrance gate po ay nakasara mula 11:00 PM hanggang 5:00 AM. Subalit pinapayagan po ang 24/7 late entry para sa mga night-shift workers o students basta magpakita ng company ID o mag-log sa security.";
    }
    return "Our main building gates are secured from **11:00 PM to 5:00 AM**. 24/7 late entry is permitted for night-shift employees and students upon presenting a valid company or university ID to building security.";
  }

  if (text.includes("visitor") || text.includes("bisita") || text.includes("guest")) {
    if (isTagalog) {
      return "Tinatanggap po ang mga rehistradong daytime visitors sa ating common lounge mula 8:00 AM hanggang 8:00 PM. Mahigpit po nating ipinagbabawal ang overnight visitors sa loob ng dorm rooms para sa seguridad ng lahat.";
    }
    return "Registered daytime visitors are welcome in the common lounge from **8:00 AM to 8:00 PM**. For resident security and privacy, overnight guests are strictly prohibited inside tenant rooms.";
  }

  // 4. Utilities & Appliance Fees
  if (text.includes("electric") || text.includes("water") || text.includes("kuryente") || text.includes("tubig") || text.includes("utility") || text.includes("appliance")) {
    if (isTagalog) {
      return "Libre po ang konsumo sa tubig! Ang kuryente naman po ay sinusukat kada kwarto at binibili pro-rata tuwing ika-15 ng buwan. Libre po ang laptops at phones; may maliit na surcharge para sa mini-refrigerator (₱200/mo), rice cooker (₱150/mo), at electric fan (₱100/mo).";
    }
    return "Water and high-speed Wi-Fi are **free and included** in your monthly rent! Room electricity is submetered and billed pro-rata among room occupants on the 15th of each month. Laptops and smartphones have no extra fee; small monthly surcharges apply for mini-refrigerators (₱200/mo), rice cookers (₱150/mo), and electric fans (₱100/mo).";
  }

  // 5. KYC IDs & Requirements
  if (text.includes("id") || text.includes("document") || text.includes("requirement") || text.includes("kyc") || text.includes("papeles")) {
    if (isTagalog) {
      return "Tumatanggap po kami ng Philippine Passport, UMID, Driver's License, PhilSys National ID, Postal ID, PRC ID, o Student ID kalakip ang Certificate of Registration (COR) para sa kasalukuyang semestre.";
    }
    return "We accept valid Philippine government and academic IDs: **Passport**, **UMID**, **Driver's License**, **PhilSys National ID**, **Postal ID**, **PRC ID**, or **Student ID** accompanied by the current semester's Certificate of Registration (COR).";
  }

  // 6. Application Lifecycle / How to reserve
  if (text.includes("apply") || text.includes("reserve") || text.includes("process") || text.includes("paano") || text.includes("lifecycle") || text.includes("step")) {
    if (isTagalog) {
      return "Napakadali po mag-apply sa pamamagitan ng aming 5-step process: 1) Pumili ng kwarto, 2) Mag-book ng viewing o submit waiver, 3) Magbigay ng tenant info at valid ID, 4) Magbayad ng 1-month advance at 1-month deposit, at 5) Hintayin ang admin approval sa loob ng 24–48 oras.";
    }
    return "Applying is quick and simple via our 5-stage online reservation flow:\n1. **Room Selection** — Choose your preferred branch and bed.\n2. **Viewing / Waiver** — Schedule an on-site tour or sign the remote lease waiver.\n3. **Tenant Info & KYC** — Submit contact details and upload valid IDs.\n4. **Payment Deposit** — Settle 1-month advance and 1-month security deposit.\n5. **Confirmation** — Receive official admin approval within 24–48 hours.";
  }

  // 7. General greeting
  if (text.includes("kamusta") || text.includes("hello") || text.includes("hi") || text.includes("good day") || text.includes("mabuhay") || text.includes("morning") || text.includes("afternoon") || text.includes("evening")) {
    if (isTagalog) {
      return "Mabuhay! Malugod po kayong tinatanggap sa Lilycrest Dormitory AI Assistant. Maaari po kayong magtanong tungkol sa aming mga sangay sa Gil Puyat at Guadalupe, room rates, house rules, o magpa-schedule ng viewing!";
    }
    return "Hello and welcome to Lilycrest Dormitory! I am your AI assistant. Feel free to ask about our room types and monthly rates for **Gil Puyat** and **Guadalupe**, house rules, curfews, utility billing, or scheduling an in-person tour.";
  }

  if (isTagalog) {
    return "Maraming salamat po sa pag-inquire sa Lilycrest AI Chatbot! Kung may karagdagang katanungan po kayo o nais mag-book ng ocular visit, maaari po kayong mag-iwan ng contact details para matawagan kayo ng aming Branch Admin.";
  }

  return "Thank you for reaching out to Lilycrest AI Chatbot! If you would like more details or wish to schedule an ocular visit, feel free to ask or click below to request front desk assistance.";
}

/**
 * Builds the payload contents array formatted for Gemini API.
 */
function buildGeminiContents(message, conversationHistory) {
  const contents = [
    {
      role: "user",
      parts: [{ text: SYSTEM_PROMPT }],
    },
    {
      role: "model",
      parts: [{ text: "Opo, naiintindihan ko po. I will strictly follow all Lilycrest guidelines and represent Lilycrest Dormitory with utmost courtesy and accuracy." }],
    },
  ];

  if (Array.isArray(conversationHistory)) {
    for (const msg of conversationHistory) {
      if (msg && msg.text) {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.text }],
        });
      }
    }
  }

  contents.push({
    role: "user",
    parts: [{ text: message }],
  });

  return contents;
}

/**
 * Stream conversational responses from Gemini 2.5 Flash with rich widget emission and fallback handling.
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

  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback if no API key is configured
  if (!apiKey) {
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
    return;
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;
  const contents = buildGeminiContents(trimmedMessage, conversationHistory);

  const localAbort = new AbortController();
  const timeoutId = setTimeout(() => localAbort.abort(), 20000); // 20s timeout guard

  // Link caller signal with timeout abort controller
  const handleCallerAbort = () => localAbort.abort();
  if (signal) {
    signal.addEventListener("abort", handleCallerAbort);
  }

  let fullReply = "";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contents }),
      signal: localAbort.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini streaming API error: ${response.status} ${response.statusText}`);
    }

    // Read SSE stream
    if (response.body) {
      const textDecoder = new TextDecoder("utf-8");
      let lineBuffer = "";

      const parseAndEmitLines = (rawChunk) => {
        lineBuffer += rawChunk;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() || ""; // Keep incomplete tail

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, "");
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const candidates = parsed?.candidates || [];
            for (const cand of candidates) {
              const parts = cand?.content?.parts || [];
              for (const part of parts) {
                if (part.text) {
                  fullReply += part.text;
                  onToken?.(part.text);
                }
              }
            }
          } catch {
            // Ignore incomplete JSON chunks in SSE stream
          }
        }
      };

      if (typeof response.body.getReader === "function") {
        const reader = response.body.getReader();
        while (true) {
          if (signal?.aborted || localAbort.signal.aborted) break;
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            parseAndEmitLines(textDecoder.decode(value, { stream: true }));
          }
        }
      } else if (typeof response.body[Symbol.asyncIterator] === "function") {
        for await (const chunk of response.body) {
          if (signal?.aborted || localAbort.signal.aborted) break;
          parseAndEmitLines(textDecoder.decode(chunk, { stream: true }));
        }
      }

      // Flush remaining line buffer if any
      if (lineBuffer.trim().startsWith("data:")) {
        try {
          const parsed = JSON.parse(lineBuffer.trim().replace(/^data:\s*/, ""));
          const parts = parsed?.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.text) {
              fullReply += part.text;
              onToken?.(part.text);
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    if (!fullReply) {
      throw new Error("Empty response received from Gemini stream");
    }

    const actions = determineSuggestedActions(trimmedMessage, fullReply, branchFocus);
    onActions?.(actions);
    onDone?.({
      fullReply,
      widget,
      suggestedActions: actions,
      canEscalate: true,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (signal && !signal.aborted && process.env.NODE_ENV !== "production") {
      console.warn("Gemini stream failed, falling back to rule-based engine:", err?.message);
    }

    if (signal?.aborted) {
      return; // Connection closed by client
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
  } finally {
    if (signal) {
      signal.removeEventListener("abort", handleCallerAbort);
    }
  }
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
 * Standard non-streaming query handler maintaining backward compatibility with existing tests and callers.
 *
 * @param {string|Object} arg1 - User message or options object
 * @param {Array<{role: string, text: string}>} [arg2=[]] - Conversation history
 * @param {string} [arg3="all"] - Branch focus
 * @returns {Promise<{reply: string, suggestedActions: Array, widget: Object|null, canEscalate: boolean}>}
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
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const reply = getRuleBasedFallback(trimmedMessage, branchFocus);
    return {
      reply,
      suggestedActions: determineSuggestedActions(trimmedMessage, reply, branchFocus),
      widget,
      canEscalate: true,
    };
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const contents = buildGeminiContents(trimmedMessage, conversationHistory);

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 12000); // 12s timeout

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contents }),
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      const reply = data.candidates[0].content.parts.map((p) => p.text).join("");
      return {
        reply,
        suggestedActions: determineSuggestedActions(trimmedMessage, reply, branchFocus),
        widget,
        canEscalate: true,
      };
    } else {
      throw new Error("Invalid response structure received from Gemini");
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (process.env.NODE_ENV !== "production") {
      console.warn("Gemini API request failed, using rule-based fallback:", error?.message);
    }
    const reply = getRuleBasedFallback(trimmedMessage, branchFocus);
    return {
      reply,
      suggestedActions: determineSuggestedActions(trimmedMessage, reply, branchFocus),
      widget,
      canEscalate: true,
    };
  }
};
