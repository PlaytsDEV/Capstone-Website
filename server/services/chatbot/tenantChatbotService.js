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
  const currentTime = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const isApplicant = contextSnapshot?.isApplicant || (!contextSnapshot?.contract && Boolean(contextSnapshot?.reservation || contextSnapshot?.userRole === "applicant"));

  if (isApplicant) {
    const res = contextSnapshot?.reservation;
    return `You are the official Lilycrest Applicant Assistant for Lilycrest Dormitory Management System (Lilycrest DMS).
You assist applicants and prospective tenants undergoing the reservation, viewing, and move-in onboarding process with a warm, encouraging, polite, and helpful tone in clear English.
Current server time in Asia/Manila: ${currentTime}.

APPLICANT PROFILE:
- Name: ${contextSnapshot?.tenantName || "Applicant"}
- Branch: ${res?.branch || branchName}
- Selected Room: ${res?.roomNumber ? `Room ${res.roomNumber}` : "Room Selection in Progress"} (${res?.bedPosition || "Bed Selected"})
- Room Type: ${res?.roomType || "Double Sharing"}
- Reservation Status: ${res?.status?.toUpperCase() || "PENDING"}
- Intended Move-in Date: ${res?.intendedMoveInDate ? new Date(res.intendedMoveInDate).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "To be scheduled"}
- Viewing Appointment: ${res?.viewingDate ? new Date(res.viewingDate).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "Not yet scheduled / Remote viewing waiver"}
- Deposit / Advance Payment: ${res?.paymentStatus === "paid" ? "PAID / SUBMITTED" : "PENDING (1-Month Advance Rent + 1-Month Security Deposit)"}

GUIDED 5-STAGE APPLICATION LIFECYCLE:
1. Room Selection: Choose branch (Gil Puyat or Guadalupe), room type, and bed position.
2. Viewing Schedule / Remote Waiver: Select an in-person viewing slot or submit a remote viewing waiver.
3. Tenant Info & KYC: Submit personal information, emergency contact, and upload valid government/student ID.
4. Payment Deposit: Pay 1-month advance rent and 1-month security deposit via GCash, Maya, or bank transfer, then upload payment proof.
5. Confirmation & Admin Approval: Branch Admin verifies the application within 24 to 48 hours for lease contract generation and key turnover.

STRICT OPERATIONAL & PRIVACY RULES:
1. Language & Professional Tone: Answer in warm, polite, encouraging, and friendly English only. Do NOT insert filler words or Tagalog honorifics like "po" or "opo".
2. Role Restrictions: You cannot submit room maintenance tickets or calculate monthly utility submeters since the applicant has not checked in as an active tenant yet.
3. Grounding: Answer strictly using the applicant profile and application stages above.
4. Strictly No Icons or Emojis: Format all responses using clean, plain text and standard markdown bold or lists only.

APPLICANT CONTEXT:
${JSON.stringify(contextSnapshot, null, 2)}
`;
  }

  const assignment = contextSnapshot?.roomNumber
    ? `assigned to Room ${contextSnapshot.roomNumber}${contextSnapshot?.bedPosition ? `, ${contextSnapshot.bedPosition}` : ""}`
    : "whose room assignment is not available in the canonical context";

  return `You are the official Lilycrest Tenant Assistant, an intelligent authenticated assistant for Lilycrest Dormitory Management System (Lilycrest DMS).
You assist tenants at the ${branchName} branch (${assignment}) with a warm, polite, empathetic, and friendly tone in simple, conversational English.
Current server time in Asia/Manila: ${currentTime}.

AUTHORIZED KNOWLEDGE:
- Tenant-specific facts come only from TENANT CONTEXT below.
- Recent announcements in that context have already passed tenant and branch audience authorization.
- Do not state a rate, due date, payment method, utility rule, gate schedule, response time, refund rule, or other policy unless the context explicitly provides it.
- If the requested fact is absent, say it cannot currently be confirmed and point to the relevant Lilycrest module or admin-support workflow.

STRICT OPERATIONAL GUIDELINES:
1. Language & Professional Tone: Answer in warm, polite, empathetic, and friendly English only. Avoid heavy corporate jargon. Do NOT insert filler words or Tagalog honorifics like "po" or "opo". Respond strictly in English.
2. Grounded Facts: Answer strictly using the TENANT CONTEXT JSON below. NEVER invent unlisted bills, contracts, room assignments, dates, reminders, announcements, or repair records. If a fact is absent, say it is not available in the canonical record.
3. Known Facts: Never ask the tenant for branch, room, move-in, contract, or billing details already present in TENANT CONTEXT.
4. Read-Only Safety: You are an informational assistant. You cannot alter invoice totals, approve fee waivers, or cancel contracts. Direct disputes or special requests kindly to Branch Admin.
5. Strictly No Icons or Emojis: Do NOT use icons, emojis, or graphical symbols in your answers or responses. Format responses using clean, plain text and standard markdown bold or lists only.

TENANT CONTEXT:
${JSON.stringify(contextSnapshot, null, 2)}
`;
}

export function detectTenantWidgetIntent(message = "", contextSnapshot = null) {
  // If the user is an applicant, they do not have active billing statements, submeter shares, or active room maintenance tickets
  const isApplicant = Boolean(
    contextSnapshot?.isApplicant ||
    contextSnapshot?.userRole === "applicant" ||
    (!contextSnapshot?.contract && (contextSnapshot?.reservation || contextSnapshot?.userRole === "applicant"))
  );

  if (isApplicant) {
    return null;
  }

  const lower = String(message || "").toLowerCase().trim();
  if (!lower) return null;

  // Maintenance Status Widget: Require explicit maintenance query from active tenant
  if (
    lower.match(/\b(maintenance ticket|repair ticket|active tickets|my tickets|maintenance status|repair status|technician status|plumbing repair|aircon repair|electrician visit)\b/) ||
    lower.includes("active tickets") ||
    lower.includes("report issue") ||
    lower.includes("my maintenance")
  ) {
    return "maintenance_status";
  }

  // Billing Breakdown Widget: Trigger on explicit billing queries from active tenants
  if (
    lower.match(/\b(my bill|monthly bill|billing breakdown|electric bill|view bill|bill statement|statement of account|unpaid bill|pay bill|billing summary|my balance|current balance|rent balance|due balance|electricity share|electricity math)\b/) ||
    lower.includes("electricity math") ||
    lower.includes("payment due date") ||
    lower.includes("show my bill") ||
    lower.includes("show my statement") ||
    lower.includes("my bill breakdown")
  ) {
    return "billing_breakdown";
  }

  // Lease / Contract Timeline Widget: Trigger on explicit lease/contract queries
  if (
    lower.match(/\b(my contract|lease contract|lease expiration|lease renewal|renew lease|renew contract|deposit refund|move-out clearance|contract status|how many days left on my lease|lease timeline)\b/) ||
    lower.includes("lease timeline") ||
    lower.includes("renew contract") ||
    lower.includes("deposit refund")
  ) {
    return "lease_timeline";
  }

  return null;
}

export function determineTenantSuggestedActions(message = "", botReply = "", contextSnapshot = null) {
  const isApplicant = Boolean(
    contextSnapshot?.isApplicant ||
    contextSnapshot?.userRole === "applicant" ||
    (!contextSnapshot?.contract && (contextSnapshot?.reservation || contextSnapshot?.userRole === "applicant"))
  );

  if (isApplicant) {
    return [
      { label: "Reservation Status", prompt: "What is my current reservation status?" },
      { label: "Deposit Payment Steps", prompt: "How do I settle the advance rent and security deposit?" },
      { label: "Chat with Admin", action: "open_escalate_modal" },
    ];
  }

  const combined = `${message} ${botReply}`.toLowerCase();
  const widget = detectTenantWidgetIntent(message, contextSnapshot);
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

  // Canonical occupancy wins over any older scheduled reservation state.
  if (
    lower.includes("branch")
    || lower.includes("room")
    || lower.includes("bed")
    || lower.includes("move in")
    || lower.includes("move-in")
    || lower.includes("moved in")
    || lower.includes("nakamove in")
    || lower.includes("occupancy")
  ) {
    const tenancy = contextSnapshot?.tenancy || {};
    if (tenancy.isCurrentResident) {
      const started = tenancy.occupancyStartedAt
        ? new Date(tenancy.occupancyStartedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
        : null;
      const assignment = contextSnapshot?.roomNumber
        ? `Room ${contextSnapshot.roomNumber}${contextSnapshot?.bedPosition ? ` (${contextSnapshot.bedPosition})` : ""}`
        : "a room assignment that is not currently available in Lily";
      return `Your canonical occupancy record confirms that you are already moved in at **${branch}**, assigned to **${assignment}**${started ? ` since **${started}**` : ""}.`;
    }

    if (tenancy.scheduledMoveInDate) {
      const scheduled = new Date(tenancy.scheduledMoveInDate).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
      const assignment = contextSnapshot?.roomNumber
        ? ` Your current assignment is Room ${contextSnapshot.roomNumber}${contextSnapshot?.bedPosition ? ` (${contextSnapshot.bedPosition})` : ""} at ${branch}.`
        : "";
      return `Your canonical record shows a scheduled move-in date of **${scheduled}**.${assignment}`;
    }

    return "Your current move-in date or room assignment cannot be confirmed from the canonical Lilycrest record right now. Please check your tenancy profile or contact admin support.";
  }

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

      return `Your lease agreement for **Room ${roomNumber}${contract.bedPosition ? ` (${contract.bedPosition})` : ""}** at ${branch} is **${contract.status.toUpperCase()}**.\n\n• **Contract Number**: ${contract.contractNumber || "Not currently available"}\n• **Expiration Date**: ${endStr} (${days})\n• **Monthly Base Rate**: ${formatNum(contract.monthlyRate)}\n• **Security Deposit Held**: ${formatNum(contract.depositAmount)}\n• **Document**: ${contract.tenantDocument?.available ? `${contract.tenantDocument.label || "Available"} (version ${contract.tenantDocument.version || "unknown"})` : "Not available yet"}\n\nOpen the Contracts & Agreements tab for the canonical document and available actions.`;
    }

    if (contextSnapshot?.tenancy?.isCurrentResident) {
      return `Your occupancy record confirms that you are a current resident at **${branch}**, Room ${roomNumber}, but no tenant-visible canonical Contract is available yet. Please check the Contracts tab or contact your branch admin.`;
    }
    return "No tenant-visible canonical Contract is available in your current records. Please check the Contracts tab or contact your branch admin.";
  }

  // 4. Announcements and policies are limited to audience-authorized records.
  if (
    lower.includes("announcement")
    || lower.includes("news")
    || lower.includes("notice")
    || lower.includes("reminder")
    || lower.includes("policy")
    || lower.includes("house rule")
    || lower.includes("curfew")
    || lower.includes("gate")
    || lower.includes("visitor")
    || lower.includes("bisita")
  ) {
    const announcements = contextSnapshot?.recentAnnouncements || [];
    if (announcements.length) {
      const items = announcements
        .map((announcement) => `- **${announcement.title}**: ${announcement.content}`)
        .join("\n");
      return `These are your latest audience-authorized Lilycrest updates for **${branch}**:\n\n${items}\n\nIf the policy you need is not listed, it cannot currently be confirmed in Lily.`;
    }
    return `I cannot currently confirm that Lilycrest policy from an audience-authorized record for **${branch}**. Please check Announcements or contact your branch admin.`;
  }

  // 5. Existing support state comes from canonical conversations. Lily does
  // not claim that an administrative action has already been completed.
  if (lower.includes("inquiry") || lower.includes("support") || lower.includes("complaint") || lower.includes("admin") || lower.includes("nagreply")) {
    const inquiries = contextSnapshot?.inquiries || [];
    if (inquiries.length) {
      const items = inquiries
        .map((inquiry) => `- **${inquiry.category || "General inquiry"}**: ${inquiry.status}`)
        .join("\n");
      return `Your recent canonical support conversations are:\n\n${items}\n\nOpen My Inquiries to continue an existing concern without creating a duplicate.`;
    }
    return "You do not currently have a support conversation available in Lily. Use Contact Support if your concern requires an admin.";
  }

  // 6. Default Greeting & Assistance
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
  const widget = detectTenantWidgetIntent(trimmedMessage, contextSnapshot);
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

    const detectedWidget = detectTenantWidgetIntent(trimmedMessage, contextSnapshot);
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
    const detectedWidget = detectTenantWidgetIntent(trimmedMessage, contextSnapshot);
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
    const widget = detectTenantWidgetIntent(trimmedMessage, contextSnapshot);
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
    const widget = detectTenantWidgetIntent(trimmedMessage, contextSnapshot);
    const suggestedActions = determineTenantSuggestedActions(trimmedMessage, reply, contextSnapshot);

    return { reply, widget, suggestedActions, contextSnapshot };
  } catch (error) {
    console.warn("Gemini AI Query fallback invoked:", error?.message);
    const fallbackReply = getTenantRuleBasedFallback(trimmedMessage, contextSnapshot);
    const widget = detectTenantWidgetIntent(trimmedMessage, contextSnapshot);
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

