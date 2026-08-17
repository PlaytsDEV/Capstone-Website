import { GoogleGenerativeAI } from "@google/generative-ai";

const getApiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const getModelName = () => process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

function getGenAIClient() {
  const key = getApiKey();
  if (!key || key === "dummy-key") return null;
  return new GoogleGenerativeAI(key);
}

function getSystemPrompt(contextSnapshot) {
  const branchName = contextSnapshot?.branch || "Lilycrest Residence";
  const assignment = contextSnapshot?.roomNumber
    ? `assigned to Room ${contextSnapshot.roomNumber}${contextSnapshot?.bedPosition ? `, ${contextSnapshot.bedPosition}` : ""}`
    : "whose room assignment is not available in the canonical context";
  const currentTime = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  return `You are the official Lilycrest Tenant Assistant, an intelligent authenticated assistant for Lilycrest Dormitory Management System (Lilycrest DMS).
You assist tenants at the ${branchName} branch (${assignment}) with a warm, polite, empathetic, and friendly tone in simple, conversational English.
Current server time in Asia/Manila: ${currentTime}.

FRIENDLY POLICIES & STEP-BY-STEP EXPLANATIONS:
1. Pro-Rata Electricity Sharing:
   - Your room has its own submeter measuring actual electricity consumed.
   - Total electricity cost is divided equally among active roommates for the billing period.
   - Water consumption and high-speed Wi-Fi are completely free and included in monthly base rent.
2. Monthly Rent & Due Dates:
   - Monthly rent due dates follow each tenant's individual move-in / lease start cycle (NOT fixed to the 15th for all tenants).
   - Submetered electricity is measured and recorded on the 15th of each month, then divided pro-rata among room occupants.
   - Payments can easily be settled online via bank transfer or GCash in the Billing tab.
3. Contract Expiration & Lease Renewal:
   - Tenants can request a lease renewal 30 days before contract expiration under the Contracts tab.
4. Move-Out Clearance & Security Deposit:
   - Security deposit is fully refundable upon completing a simple move-out clearance room check.
5. Maintenance & Repair Tickets:
   - Submit repair tickets via the Maintenance Portal; our accredited on-site technicians attend to repairs promptly within 24-48 hours.
6. Building Access:
   - Main doors lock from 11:00 PM to 5:00 AM for security; 24/7 late entry is always accommodated for night-shift workers and students with a valid ID.

STRICT OPERATIONAL GUIDELINES:
1. Language & Professional Tone: Answer in warm, polite, empathetic, and friendly English only. Avoid heavy corporate jargon. Do NOT insert filler words or Tagalog honorifics like "po" or "opo". Respond strictly in English.
2. Grounded Facts: Answer strictly using the TENANT CONTEXT JSON below. NEVER invent unlisted bills, contracts, room assignments, dates, reminders, announcements, or repair records. If a fact is absent, say it is not available in the canonical record.
3. Read-Only Safety: You are an informational assistant. You cannot alter invoice totals, approve fee waivers, or cancel contracts. Direct disputes or special requests kindly to Branch Admin.
4. Strictly No Icons or Emojis: Do NOT use icons, emojis, or graphical symbols in your answers or responses. Format responses using clean, plain text and standard markdown bold or lists only.

TENANT CONTEXT:
${JSON.stringify(contextSnapshot, null, 2)}
`;
}

export function detectTenantWidgetIntent(message = "") {
  const lower = String(message || "").toLowerCase();

  if (
    lower.match(/\b(maintenance|ticket|tickets|repair|repairs|plumbing|aircon|air-con|electrician|leak|faucet|outlet|ayos|sira|gawain)\b/) ||
    lower.includes("active tickets") ||
    lower.includes("report issue") ||
    lower.includes("technician")
  ) {
    return "maintenance_status";
  }

  if (
    lower.match(/\b(bill|billing|rent|electricity|kuryente|tubig|water|appliance|appliances|charges|bayad|bayarin|penalty|discount|total)\b/) ||
    lower.includes("electricity math") ||
    lower.includes("due date") ||
    lower.includes("payment")
  ) {
    return "billing_breakdown";
  }

  if (
    lower.match(/\b(contract|lease|deposit|security deposit|move-out|move out|clearance|expiration|expire|renew|renewal|kontrata)\b/) ||
    lower.includes("lease expiration") ||
    lower.includes("renew contract") ||
    lower.includes("deposit refund")
  ) {
    return "lease_timeline";
  }

  return null;
}

export function determineTenantSuggestedActions(message = "", botReply = "", contextSnapshot = null) {
  const combined = `${message} ${botReply}`.toLowerCase();
  const widget = detectTenantWidgetIntent(combined);
  const actions = [];

  if (widget === "maintenance_status" || combined.includes("maintenance") || combined.includes("repair")) {
    actions.push(
      { label: "Report New Repair", prompt: "How do I submit an urgent plumbing or air-conditioning issue?" },
      { label: "Technician Hours", prompt: "What are the available hours for on-site technician repairs?" },
      { label: "Chat with Admin", action: "open_escalate_modal" },
    );
  } else if (widget === "billing_breakdown" || combined.includes("bill") || combined.includes("kuryente")) {
    actions.push(
      { label: "Electricity Math", prompt: "How was my submetered electricity share computed this month?" },
      { label: "Payment Due Date", prompt: "When is my current bill due and how do I settle it?" },
      { label: "Dispute / Admin Help", action: "open_escalate_modal" },
    );
  } else if (widget === "lease_timeline" || combined.includes("lease") || combined.includes("contract")) {
    actions.push(
      { label: "Renew Lease", prompt: "What are the steps to request a lease renewal?" },
      { label: "Deposit Refund", prompt: "How does the security deposit refund and move-out clearance work?" },
      { label: "Chat with Admin", action: "open_escalate_modal" },
    );
  } else {
    actions.push(
      { label: "Check Maintenance", prompt: "Do I have any active maintenance tickets scheduled?" },
      { label: "Monthly Bill", prompt: "Can you show my current monthly bill breakdown?" },
      { label: "Lease Timeline", prompt: "How many days are left on my lease agreement?" },
    );
  }

  return actions;
}

/**
 * Deterministic rule-based fallback when Gemini API is unconfigured or unreachable.
 */
export function getTenantRuleBasedFallback(message = "", contextSnapshot = null) {
  const lower = String(message || "").toLowerCase();
  const tenantName = contextSnapshot?.tenantName || "Tenant";
  const roomNumber = contextSnapshot?.roomNumber || "your assigned room";
  const branch = contextSnapshot?.branch || "Lilycrest Residence";

  // 1. Maintenance & Repair Status
  if (
    lower.includes("maintenance") ||
    lower.includes("ticket") ||
    lower.includes("repair") ||
    lower.includes("sira") ||
    lower.includes("ayos") ||
    lower.includes("technician") ||
    lower.includes("plumbing") ||
    lower.includes("aircon")
  ) {
    const tickets = contextSnapshot?.activeMaintenance || [];
    if (tickets.length > 0) {
      const ticketList = tickets
        .map(
          (t, i) =>
            `${i + 1}. **Ticket #${t.ticketCode}** (${t.category})\n   • Status: **${t.status.toUpperCase()}**\n   • Urgency: ${t.urgency}\n   • Note: ${t.description}`,
        )
        .join("\n\n");

      return `Here is the current status of your maintenance requests for **Room ${roomNumber}**:\n\n${ticketList}\n\nYou can track real-time progress or submit additional photos directly on the Maintenance page.`;
    }

    return `You currently have **no active or scheduled maintenance requests** for **Room ${roomNumber}**.\n\nIf you are experiencing any facility issues (such as plumbing leaks, aircon maintenance, or electrical concerns), you can submit a repair request anytime from your Maintenance Portal.`;
  }

  // 2. Billing & Utilities Breakdown
  if (
    lower.includes("bill") ||
    lower.includes("rent") ||
    lower.includes("kuryente") ||
    lower.includes("electric") ||
    lower.includes("tubig") ||
    lower.includes("water") ||
    lower.includes("appliance") ||
    lower.includes("bayad") ||
    lower.includes("due") ||
    lower.includes("next bill")
  ) {
    const bill = contextSnapshot?.currentBill;
    if (bill) {
      const formatNum = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
      const dueDateStr = bill.dueDate ? new Date(bill.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "not set";
      const utilityState = bill.utilityReleased ? "Released" : "Not released";

      return `Here is the canonical current-cycle statement for **Room ${roomNumber}**:\n\n• **Status**: ${bill.statusLabel || bill.status}\n• **Base Rent**: ${formatNum(bill.rentAmount)}${bill.proRataDays ? ` (${bill.proRataDays} days pro-rata)` : ""}\n• **Electricity Share**: ${formatNum(bill.electricityAmount)}\n${bill.applianceAmount > 0 ? `• **Appliance Fees**: ${formatNum(bill.applianceAmount)}\n` : ""}${bill.penaltyAmount > 0 ? `• **Late Penalty**: ${formatNum(bill.penaltyAmount)}\n` : ""}• **Statement Total**: **${formatNum(bill.totalAmount)}**\n• **Remaining Balance**: **${formatNum(bill.remainingAmount)}** (Due on **${dueDateStr}**)\n• **Utility Schedule**: **${utilityState}**\n\nOpen the Billing tab to view the statement and current payment options.`;
    }

    return `No canonical current-cycle statement is available for **Room ${roomNumber}** right now. Please check the Billing tab or contact your branch admin if you expected one.`;
  }

  // 3. Lease & Contract Timeline
  if (
    lower.includes("contract") ||
    lower.includes("lease") ||
    lower.includes("deposit") ||
    lower.includes("expire") ||
    lower.includes("renew") ||
    lower.includes("clearance") ||
    lower.includes("move-out") ||
    lower.includes("move out")
  ) {
    const contract = contextSnapshot?.contract;
    if (contract) {
      const endStr = contract.endDate ? new Date(contract.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Contract Term End";
      const days = contract.daysRemaining !== null ? `${contract.daysRemaining} days remaining` : "Active term";
      const formatNum = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

      return `Your lease agreement for **Room ${roomNumber}${contract.bedPosition ? ` (${contract.bedPosition})` : ""}** at ${branch} is **${contract.status.toUpperCase()}**.\n\n• **Expiration Date**: ${endStr} (${days})\n• **Monthly Base Rate**: ${formatNum(contract.monthlyRate)}\n• **Security Deposit Held**: ${formatNum(contract.depositAmount)}\n• **Document**: ${contract.tenantDocument?.available ? `${contract.tenantDocument.label || "Available"} (version ${contract.tenantDocument.version || "unknown"})` : "Not available yet"}\n\nOpen the Contracts & Agreements tab for the canonical document and available actions.`;
    }

    if (contextSnapshot?.tenancy?.isCurrentResident) {
      return `Your occupancy record confirms that you are a current resident at **${branch}**, Room ${roomNumber}, but no tenant-visible canonical Contract is available yet. Please check the Contracts tab or contact your branch admin.`;
    }
    return "No tenant-visible canonical Contract is available in your current records. Please check the Contracts tab or contact your branch admin.";
  }

  // 4. Curfew & Gate Policy
  if (lower.includes("curfew") || lower.includes("oras") || lower.includes("gate") || lower.includes("late")) {
    return `I do not have a current, tenant-specific gate schedule in the canonical record for **${branch}**. Please confirm the latest access policy with your branch admin.`;
  }

  // 5. Default Greeting & Assistance
  return `Hello, ${tenantName}! I am your **Lilycrest Tenant Assistant** for ${roomNumber} at ${branch}.\n\nI can help explain the canonical billing, maintenance, contract, announcement, and support records available to you. How may I assist you today?`;
}

export async function streamTenantGeminiChatbot({
  message,
  conversationHistory = [],
  contextSnapshot,
  onToken,
  onWidget,
  onActions,
  onDone,
  onError,
  signal,
}) {
  const trimmedMessage = (message || "").trim();
  const widget = detectTenantWidgetIntent(trimmedMessage);
  if (widget && typeof onWidget === "function") {
    try {
      onWidget(widget);
    } catch {
      // Non-fatal
    }
  }

  const genAI = getGenAIClient();

  if (!genAI) {
    const fallbackReply = getTenantRuleBasedFallback(trimmedMessage, contextSnapshot);
    await simulateStreamTokens(fallbackReply, { onToken, signal });
    const actions = determineTenantSuggestedActions(trimmedMessage, fallbackReply, contextSnapshot);
    if (actions.length > 0) onActions?.(actions);
    onDone?.({ fullReply: fallbackReply, widget, actions, contextSnapshot });
    return;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: getModelName(),
      systemInstruction: getSystemPrompt(contextSnapshot),
    });

    const formattedHistory = (conversationHistory || []).map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content || msg.text || "" }],
    }));

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessageStream(trimmedMessage, { signal });
    let fullReply = "";

    for await (const chunk of result.stream) {
      if (signal?.aborted) break;
      const chunkText = chunk.text();
      fullReply += chunkText;
      onToken?.(chunkText);
    }

    if (signal?.aborted) return;

    const detectedWidget = detectTenantWidgetIntent(trimmedMessage) || detectTenantWidgetIntent(fullReply);
    if (detectedWidget && typeof onWidget === "function") {
      onWidget(detectedWidget);
    }

    const actions = determineTenantSuggestedActions(trimmedMessage, fullReply, contextSnapshot);
    if (actions.length > 0 && typeof onActions === "function") {
      onActions(actions);
    }

    onDone?.({ fullReply, widget: detectedWidget, actions, contextSnapshot });
  } catch (error) {
    if (signal?.aborted) return;
    console.warn("Gemini AI Streaming fallback invoked:", error?.message);
    const fallbackReply = getTenantRuleBasedFallback(trimmedMessage, contextSnapshot);
    await simulateStreamTokens(fallbackReply, { onToken, signal });
    const detectedWidget = detectTenantWidgetIntent(trimmedMessage);
    if (detectedWidget && typeof onWidget === "function") {
      onWidget(detectedWidget);
    }
    const actions = determineTenantSuggestedActions(trimmedMessage, fallbackReply, contextSnapshot);
    if (actions.length > 0 && typeof onActions === "function") {
      onActions(actions);
    }
    onDone?.({ fullReply: fallbackReply, widget: detectedWidget, actions, contextSnapshot });
  }
}

export async function queryTenantGeminiChatbot({ message, conversationHistory = [], contextSnapshot }) {
  const trimmedMessage = (message || "").trim();
  const genAI = getGenAIClient();

  if (!genAI) {
    const fallbackReply = getTenantRuleBasedFallback(trimmedMessage, contextSnapshot);
    const widget = detectTenantWidgetIntent(trimmedMessage);
    const suggestedActions = determineTenantSuggestedActions(trimmedMessage, fallbackReply, contextSnapshot);
    return { reply: fallbackReply, widget, suggestedActions, contextSnapshot };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: getModelName(),
      systemInstruction: getSystemPrompt(contextSnapshot),
    });

    const formattedHistory = (conversationHistory || []).map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content || msg.text || "" }],
    }));

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(trimmedMessage);
    const reply = result.response.text();
    const widget = detectTenantWidgetIntent(trimmedMessage) || detectTenantWidgetIntent(reply);
    const suggestedActions = determineTenantSuggestedActions(trimmedMessage, reply, contextSnapshot);

    return { reply, widget, suggestedActions, contextSnapshot };
  } catch (error) {
    console.warn("Gemini AI Query fallback invoked:", error?.message);
    const fallbackReply = getTenantRuleBasedFallback(trimmedMessage, contextSnapshot);
    const widget = detectTenantWidgetIntent(trimmedMessage);
    const suggestedActions = determineTenantSuggestedActions(trimmedMessage, fallbackReply, contextSnapshot);

    return { reply: fallbackReply, widget, suggestedActions, contextSnapshot };
  }
}

/**
 * Simulates a word-by-word streaming effect for fallback responses.
 */
async function simulateStreamTokens(text = "", { onToken, signal }) {
  if (!text) return;
  const words = text.match(/\S+|\s+/g) || [text];
  const delay = process.env.NODE_ENV === "test" ? 0 : 10;

  for (const token of words) {
    if (signal?.aborted) break;
    onToken?.(token);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

