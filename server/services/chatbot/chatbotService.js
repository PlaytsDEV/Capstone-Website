import { dormitoryKnowledgeContext } from "./knowledgeBase.js";

const SYSTEM_PROMPT = `
You are the official digital receptionist for Lilycrest Dormitory Management System (Lilycrest DMS).
Your mission is to provide courteous, precise, and professional assistance to prospective tenants and website visitors.

STRICT GROUNDING RULES:
1. Use ONLY the facts provided in the official dormitory context.
2. NEVER invent room prices, discounts, promotions, or policies.
3. If a question is outside the provided context, politely inform the user and suggest contacting the branch admin team.
4. Keep answers concise (maximum 3-4 sentences per response), clear, and warm.
5. Currency must always be formatted in Philippine Peso (PHP / ₱).
6. Always refer to our two official branches: "Gil Puyat Branch" (Pasay) and "Guadalupe Branch" (Makati).

OFFICIAL DORMITORY CONTEXT:
${dormitoryKnowledgeContext}
`;

/**
 * Parses user input to generate appropriate action pills based on intent.
 */
function determineSuggestedActions(message, botReply) {
  const actions = [];
  const text = (message + " " + botReply).toLowerCase();

  if (text.includes("rate") || text.includes("price") || text.includes("much")) {
    actions.push({ label: "Browse Guadalupe Rooms", url: "/applicant/check-availability?branch=guadalupe" });
    actions.push({ label: "Browse Gil Puyat Rooms", url: "/applicant/check-availability?branch=gil_puyat" });
  }
  if (text.includes("apply") || text.includes("reserve") || text.includes("reservation")) {
    actions.push({ label: "Start Application", url: "/applicant/check-availability" });
  }
  
  // Default fallback action
  actions.push({ label: "Schedule a Visit", action: "open_escalation_form" });
  
  // Deduplicate and slice top 2
  const uniqueActions = [];
  const seenLabels = new Set();
  for (const act of actions) {
    if (!seenLabels.has(act.label)) {
      seenLabels.add(act.label);
      uniqueActions.push(act);
    }
  }

  return uniqueActions.slice(0, 2);
}

/**
 * Local fallback rules if Gemini fails or API key is missing.
 */
function getRuleBasedFallback(message) {
  const text = message.toLowerCase();
  
  if (text.includes("guadalupe") && text.includes("rate")) {
    return "At our Guadalupe branch, a Quadruple Sharing Room starts at ₱3,500 to ₱4,200 per person per month. Would you like to schedule a viewing?";
  }
  
  if (text.includes("gil puyat") && text.includes("rate")) {
    return "At our Gil Puyat branch, a Quadruple Sharing Room starts at ₱3,500 to ₱4,200 per person per month. We also have Double Sharing and Private Rooms available.";
  }

  if (text.includes("curfew")) {
    return "Our building entry gate locks at 11:00 PM and opens at 5:00 AM. Late entry is permitted with a prior written log or a night-shift company ID.";
  }
  
  if (text.includes("visitor")) {
    return "Registered daytime visitors are allowed in common lounge areas from 8:00 AM to 8:00 PM. No overnight visitors are allowed in tenant dorm rooms.";
  }

  if (text.includes("apply") || text.includes("reserve")) {
    return "To apply, you can start by selecting a room from our availability page, choose a viewing schedule or waive it, submit your info, and pay the deposit.";
  }

  return "Thank you for reaching out to Lilycrest! For specific inquiries not covered by our FAQs, please leave your contact details or contact our branch admin team directly.";
}

export const queryGeminiChatbot = async (message, conversationHistory = []) => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  // Fallback if no API key is provided
  if (!apiKey) {
    const reply = getRuleBasedFallback(message);
    return {
      reply,
      suggestedActions: determineSuggestedActions(message, reply),
      canEscalate: true
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const contents = [
    {
      role: "user",
      parts: [{ text: SYSTEM_PROMPT }]
    },
    {
      role: "model",
      parts: [{ text: "Understood. I will follow these guidelines strictly." }]
    }
  ];

  for (const msg of conversationHistory) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.text }]
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: message }]
  });

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 12000); // 12s timeout

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ contents }),
      signal: abortController.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      const reply = data.candidates[0].content.parts.map(p => p.text).join("");
      return {
        reply,
        suggestedActions: determineSuggestedActions(message, reply),
        canEscalate: true
      };
    } else {
      throw new Error("Invalid response format from Gemini");
    }

  } catch (error) {
    clearTimeout(timeoutId);
    if (process.env.NODE_ENV !== "production") {
      console.error("Gemini API request failed:", error);
    }
    const reply = getRuleBasedFallback(message);
    return {
      reply,
      suggestedActions: determineSuggestedActions(message, reply),
      canEscalate: true
    };
  }
};
