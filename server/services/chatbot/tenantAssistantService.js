/**
 * ============================================================================
 * LILYCREST TENANT CONTEXT-AWARE AI ASSISTANT SERVICE (PHASE 2)
 * ============================================================================
 *
 * Provides real-time, grounded conversational assistance for authenticated tenants.
 * Grounded on the tenant's actual room occupancy, pro-rata utility billings,
 * active lease contract timelines, and maintenance tickets.
 *
 * Features:
 * - Real-time MongoDB context retrieval (User, Contract, Room, Bill, MaintenanceRequest)
 * - Grounded LLM generation with Gemini 2.5 Flash
 * - Natural Tagalog/Taglish conversational fluency with polite Filipino hospitality
 * - Server-Sent Events (SSE) token streaming with low latency
 * - Rich UI widget intent detection (Billing Breakdown, Lease Timeline, Maintenance Card)
 * - Dynamic suggested action pills with route links
 * - Zero-downtime offline rule-based fallback streaming
 * ============================================================================
 */

import { User, Contract, Room, Bill, MaintenanceRequest, Inquiry } from "../../models/index.js";
import { APPLIANCE_FEES } from "./knowledgeBase.js";

/**
 * Gathers complete live stay context for an authenticated tenant.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Object>}
 */
export async function getTenantStayContext(userId) {
  try {
    const user = await User.findById(userId).lean();
    if (!user) {
      return null;
    }

    // 1. Fetch active or most recent contract
    const contract = await Contract.findOne({
      tenantId: user._id,
      status: { $nin: ["voided", "cancelled", "rejected", "archived"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch room details if roomId is available
    let room = null;
    if (contract?.roomId) {
      room = await Room.findById(contract.roomId).lean();
    } else if (user.roomId) {
      room = await Room.findById(user.roomId).lean();
    }

    // 3. Fetch most recent bill record
    const latestBill = await Bill.findOne({
      userId: user._id,
      status: { $nin: ["voided"] },
    })
      .sort({ billingMonth: -1, createdAt: -1 })
      .lean();

    // 4. Fetch active or recent maintenance requests
    const recentMaintenance = await MaintenanceRequest.find({
      user_id: String(user._id),
      status: { $nin: ["cancelled"] },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Compute Lease Timeline metrics
    let leaseDaysRemaining = null;
    let leaseProgressPercent = null;
    if (contract?.leaseStartDate && contract?.leaseEndDate) {
      const start = new Date(contract.leaseStartDate).getTime();
      const end = new Date(contract.leaseEndDate).getTime();
      const now = Date.now();
      const totalDuration = Math.max(end - start, 1);
      const elapsed = Math.max(0, now - start);

      leaseDaysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
      leaseProgressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
    }

    return {
      user: {
        id: String(user._id),
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "Tenant",
        email: user.email,
        phone: user.phoneNumber || user.contactNumber || "N/A",
        branch: user.branch || contract?.branch || "Guadalupe",
        accountStatus: user.accountStatus || "active",
      },
      contract: contract
        ? {
            contractNumber: contract.contractNumber,
            status: contract.status,
            branch: contract.branch,
            roomNumber: contract.roomNumber || room?.roomNumber || "Unassigned",
            bedLabel: contract.bedLabel || "Bed A",
            roomType: contract.roomType || "Shared",
            leaseStartDate: contract.leaseStartDate ? new Date(contract.leaseStartDate).toISOString().split("T")[0] : null,
            leaseEndDate: contract.leaseEndDate ? new Date(contract.leaseEndDate).toISOString().split("T")[0] : null,
            leaseDurationMonths: contract.leaseDurationMonths || 6,
            daysRemaining: leaseDaysRemaining,
            progressPercent: leaseProgressPercent,
            monthlyRate: contract.approvedMonthlyRate || contract.regularMonthlyRate || 0,
            securityDeposit: contract.securityDepositAmount || 0,
            advanceRent: contract.advanceRentAmount || 0,
          }
        : null,
      room: room
        ? {
            roomNumber: room.roomNumber,
            branch: room.branch,
            floor: room.floor,
            roomType: room.roomType,
            capacity: room.capacity,
            activeOccupants: room.currentOccupancy || 1,
          }
        : null,
      bill: latestBill
        ? {
            id: String(latestBill._id),
            billingMonth: latestBill.billingMonth ? new Date(latestBill.billingMonth).toISOString().split("T")[0] : null,
            dueDate: latestBill.dueDate ? new Date(latestBill.dueDate).toISOString().split("T")[0] : null,
            status: latestBill.status || "pending",
            proRataDays: latestBill.proRataDays || null,
            rentAmount: latestBill.charges?.rent || 0,
            electricityAmount: latestBill.charges?.electricity || 0,
            waterAmount: 0,
            isWaterFree: true,
            applianceFees: latestBill.charges?.applianceFees || 0,
            penalties: latestBill.charges?.penalty || 0,
            discount: latestBill.charges?.discount || 0,
            totalAmount: latestBill.totalAmount || 0,
            remainingAmount: latestBill.remainingAmount !== undefined ? latestBill.remainingAmount : latestBill.totalAmount || 0,
          }
        : null,
      maintenance: recentMaintenance.map((m) => ({
        id: String(m._id),
        ticketNumber: m.ticketNumber || m.request_id || "MNT-ACTIVE",
        type: m.request_type || "General",
        description: m.description,
        urgency: m.urgency || "normal",
        status: m.status || "pending",
        providerName: m.providerDetails?.tenantVisibleLabel || m.assigned_to || "Assigned Facility Technician",
        scheduledDate: m.schedule?.scheduledDate ? new Date(m.schedule.scheduledDate).toISOString().split("T")[0] : null,
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString().split("T")[0] : null,
      })),
    };
  } catch (error) {
    console.error("Error gathering tenant stay context:", error);
    return null;
  }
}

/**
 * Builds the dynamic system prompt grounded on the tenant's database records.
 *
 * @param {Object} context - Tenant stay context
 * @returns {string}
 */
export function buildTenantSystemPrompt(context) {
  const user = context?.user || {};
  const contract = context?.contract;
  const bill = context?.bill;
  const maintenance = context?.maintenance || [];

  return `
You are the official Lilycrest AI Resident Assistant for Lilycrest Dormitory Management System (Lilycrest DMS).
You are speaking directly to resident tenant ${user.name} (${user.email}) at Lilycrest ${user.branch || "Dormitory"}.

You embody warm, respectful Filipino hospitality (Mabuhay!), answering inquiries with polite professionalism and natural Tagalog/Taglish fluency (using respectful honorifics "po" and "opo" when addressed in Tagalog/Taglish).

TENANT'S REAL-TIME GROUNDED PROFILE & STAY RECORD:
- Tenant Name: ${user.name}
- Branch: ${user.branch || "Not Specified"}
- Account Status: ${user.accountStatus}

CONTRACT & LEASE DETAILS:
${
  contract
    ? `- Contract Number: ${contract.contractNumber}
- Room Number: ${contract.roomNumber} (${contract.bedLabel}, ${contract.roomType})
- Lease Term: ${contract.leaseStartDate || "N/A"} to ${contract.leaseEndDate || "N/A"} (${contract.leaseDurationMonths} months)
- Days Remaining on Lease: ${contract.daysRemaining !== null ? `${contract.daysRemaining} days (${contract.progressPercent}% completed)` : "N/A"}
- Monthly Rate: ₱${Number(contract.monthlyRate).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
- Security Deposit: ₱${Number(contract.securityDeposit).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
- Status: ${contract.status}`
    : "- No active contract record found on file."
}

LATEST BILLING SNAPSHOT:
${
  bill
    ? `- Billing Period: ${bill.billingMonth || "Current Cycle"}
- Due Date: ${bill.dueDate || "15th of the month"}
- Payment Status: ${bill.status.toUpperCase()}
- Monthly Base Rent: ₱${Number(bill.rentAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
- Submetered Electricity Share: ₱${Number(bill.electricityAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
- Water Consumption: ₱0.00 (FREE & INCLUDED in rent)
- Appliance Surcharges: ₱${Number(bill.applianceFees).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
- Late Penalties: ₱${Number(bill.penalties).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
- Net Total Amount: ₱${Number(bill.totalAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
- Remaining Balance: ₱${Number(bill.remainingAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    : "- No active billing statement record found."
}

ACTIVE MAINTENANCE TICKETS (${maintenance.length}):
${
  maintenance.length > 0
    ? maintenance
        .map(
          (m, i) =>
            `${i + 1}. Ticket ${m.ticketNumber}: ${m.type} (${m.urgency.toUpperCase()} urgency) - Status: ${m.status.toUpperCase()}${
              m.scheduledDate ? ` - Scheduled on: ${m.scheduledDate}` : ""
            }${m.providerName ? ` - Tech: ${m.providerName}` : ""}`,
        )
        .join("\n")
    : "- No active or pending maintenance requests found."
}

STRICT GROUNDING & BEHAVIOR RULES:
1. Grounding: Answer strictly using facts from the TENANT'S PROFILE above. When asked about their rent, electricity, due dates, contract expiration, or maintenance, cite their exact numbers and dates.
2. Concise Responses: Keep replies concise (3 to 4 sentences maximum per turn), clear, and courteous.
3. Utility Rules:
   - Water and high-speed Wi-Fi are 100% FREE and included in rent.
   - Electricity is submetered per room and divided pro-rata among room occupants monthly.
   - Laptops and phones are free; appliances (mini-fridge ₱200/mo, rice cooker ₱150/mo, fan ₱100/mo) carry monthly fees.
4. Curfew & Gate Hours: Main gate locks at 11:00 PM and opens at 5:00 AM. 24/7 entry permitted with company/school ID.
5. Escalation: If a tenant requests human admin intervention or expresses an unresolved complaint, encourage escalating using the "Escalate to Admin" button.
`;
}

/**
 * Detects tenant widget intent and packages data from stay context.
 *
 * @param {string} message - User query text
 * @param {Object} context - Tenant stay context
 * @returns {Object|null} Rich widget payload or null
 */
export function detectTenantWidgetIntent(message = "", context = null) {
  const text = (message || "").toLowerCase();

  // 1. Billing Breakdown Intent
  if (
    text.includes("bill") ||
    text.includes("kuryente") ||
    text.includes("electric") ||
    text.includes("bayad") ||
    text.includes("magkano") ||
    text.includes("rent") ||
    text.includes("due date") ||
    text.includes("breakdown") ||
    text.includes("penalty") ||
    text.includes("appliance") ||
    text.includes("tubig") ||
    text.includes("statement")
  ) {
    if (context?.bill) {
      return {
        type: "billing_breakdown",
        title: "Monthly Billing Statement",
        data: {
          billingMonth: context.bill.billingMonth,
          dueDate: context.bill.dueDate,
          status: context.bill.status,
          rentAmount: context.bill.rentAmount,
          electricityAmount: context.bill.electricityAmount,
          waterAmount: 0,
          isWaterFree: true,
          applianceFees: context.bill.applianceFees,
          penalties: context.bill.penalties,
          discount: context.bill.discount,
          totalAmount: context.bill.totalAmount,
          remainingAmount: context.bill.remainingAmount,
          roomNumber: context.contract?.roomNumber || "Your Room",
          branch: context.contract?.branch || context.user?.branch || "Lilycrest",
        },
      };
    }
  }

  // 2. Lease Timeline Intent
  if (
    text.includes("contract") ||
    text.includes("lease") ||
    text.includes("expire") ||
    text.includes("matapos") ||
    text.includes("renewal") ||
    text.includes("renew") ||
    text.includes("deposit") ||
    text.includes("refund") ||
    text.includes("move out") ||
    text.includes("clearance") ||
    text.includes("timeline") ||
    text.includes("days remaining")
  ) {
    if (context?.contract) {
      return {
        type: "lease_timeline",
        title: "Lease Contract Timeline",
        data: {
          contractNumber: context.contract.contractNumber,
          roomNumber: context.contract.roomNumber,
          bedLabel: context.contract.bedLabel,
          roomType: context.contract.roomType,
          leaseStartDate: context.contract.leaseStartDate,
          leaseEndDate: context.contract.leaseEndDate,
          leaseDurationMonths: context.contract.leaseDurationMonths,
          daysRemaining: context.contract.daysRemaining,
          progressPercent: context.contract.progressPercent,
          monthlyRate: context.contract.monthlyRate,
          securityDeposit: context.contract.securityDeposit,
          status: context.contract.status,
        },
      };
    }
  }

  // 3. Maintenance Ticket Intent
  if (
    text.includes("maintenance") ||
    text.includes("repair") ||
    text.includes("sira") ||
    text.includes("ticket") ||
    text.includes("technician") ||
    text.includes("ayusin") ||
    text.includes("aircon") ||
    text.includes("gripo") ||
    text.includes("plumbing") ||
    text.includes("ilaw") ||
    text.includes("leak")
  ) {
    const activeTicket = context?.maintenance?.[0];
    if (activeTicket) {
      return {
        type: "maintenance_status",
        title: "Active Maintenance Request",
        data: {
          ticketNumber: activeTicket.ticketNumber,
          type: activeTicket.type,
          description: activeTicket.description,
          urgency: activeTicket.urgency,
          status: activeTicket.status,
          providerName: activeTicket.providerName,
          scheduledDate: activeTicket.scheduledDate,
          createdAt: activeTicket.createdAt,
        },
      };
    }
  }

  return null;
}

/**
 * Determines dynamic suggested actions for tenant queries.
 *
 * @param {string} message
 * @param {string} botReply
 * @param {Object} context
 * @returns {Array<{label: string, url?: string, action?: string, prompt?: string}>}
 */
export function determineTenantSuggestedActions(message = "", botReply = "", context = null) {
  const actions = [];
  const text = `${message} ${botReply}`.toLowerCase();

  // Billing direct links
  if (text.includes("bill") || text.includes("bayad") || text.includes("electric") || text.includes("kuryente") || text.includes("penalty")) {
    actions.push({ label: "View Billing Statement", url: "/applicant/billing" });
    actions.push({ label: "Check Electricity Share", prompt: "How was my electricity share computed this month?" });
  }

  // Contract & Lease links
  if (text.includes("contract") || text.includes("lease") || text.includes("renew") || text.includes("deposit") || text.includes("expire")) {
    actions.push({ label: "View My Contract", url: "/applicant/contracts" });
    actions.push({ label: "Lease Renewal Steps", prompt: "How do I request a lease renewal?" });
  }

  // Maintenance links
  if (text.includes("maintenance") || text.includes("repair") || text.includes("sira") || text.includes("ticket") || text.includes("technician")) {
    actions.push({ label: "Maintenance Portal", url: "/applicant/maintenance" });
    actions.push({ label: "Submit New Request", prompt: "How can I report a broken facility in my room?" });
  }

  // Default quick actions
  if (actions.length === 0) {
    actions.push({ label: "View My Bills", url: "/applicant/billing" });
    actions.push({ label: "View Contract", url: "/applicant/contracts" });
    actions.push({ label: "Request Maintenance", url: "/applicant/maintenance" });
  }

  // Escalation action
  actions.push({ label: "Escalate to Admin", action: "open_escalate_modal" });

  // Deduplicate
  const uniqueActions = [];
  const seen = new Set();
  for (const act of actions) {
    if (!seen.has(act.label)) {
      seen.add(act.label);
      uniqueActions.push(act);
    }
  }

  return uniqueActions.slice(0, 4);
}

/**
 * Generates accurate rule-based fallback responses grounded on the tenant context.
 *
 * @param {string} message
 * @param {Object} context
 * @returns {string}
 */
export function getTenantRuleBasedFallback(message = "", context = null) {
  const rawText = (message || "").trim();
  const text = rawText.toLowerCase();
  const isTagalog = /(po\b|opo\b|magkano|ano\b|saan\b|kailan|paano|meron|may\b|kwarto|kuryente|tubig|gamit|pwede|pede|sira|ayusin|kamusta|salamat)/i.test(rawText);

  const user = context?.user;
  const contract = context?.contract;
  const bill = context?.bill;
  const maintenance = context?.maintenance || [];

  // 1. Billing & Electricity Inquiries
  if (text.includes("electric") || text.includes("kuryente") || text.includes("meter")) {
    if (bill) {
      const elecFormatted = `₱${Number(bill.electricityAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
      if (isTagalog) {
        return `Ang inyong pro-rata submetered electricity share po para sa buwang ito ay **${elecFormatted}**. Libre po ang inyong konsumo sa tubig! Maaari po ninyong makita ang buong detalye sa inyong [Billing Page](/applicant/billing).`;
      }
      return `Your pro-rata submetered electricity share for the current period is **${elecFormatted}**. Water consumption is 100% free and included in your rent! You can review full invoice details on your [Billing Page](/applicant/billing).`;
    }
    return isTagalog
      ? "Ang kuryente po sa inyong kwarto ay sinusukat via submeter at hinahati pro-rata sa mga aktibong boarders. Libre po ang tubig at Wi-Fi!"
      : "Room electricity is submetered monthly and shared pro-rata among room occupants. Water and Wi-Fi are free and included in your rent.";
  }

  if (text.includes("bill") || text.includes("bayad") || text.includes("rent") || text.includes("due date") || text.includes("magkano")) {
    if (bill) {
      const totalFormatted = `₱${Number(bill.totalAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
      const dueFormatted = bill.dueDate || "15th of the month";
      if (isTagalog) {
        return `Ang inyong kasalukuyang total bill po ay **${totalFormatted}** na may due date sa **${dueFormatted}** (Status: ${bill.status.toUpperCase()}). Maaari po kayong magbayad online o mag-upload ng proof of payment sa [Billing Page](/applicant/billing).`;
      }
      return `Your total billing balance is **${totalFormatted}**, due on **${dueFormatted}** (Payment Status: ${bill.status.toUpperCase()}). You may settle this online or upload proof of payment via your [Billing Page](/applicant/billing).`;
    }
  }

  // 2. Contract & Lease Inquiries
  if (text.includes("contract") || text.includes("lease") || text.includes("expire") || text.includes("matapos") || text.includes("renew") || text.includes("deposit")) {
    if (contract) {
      const endFormatted = contract.leaseEndDate || "N/A";
      const days = contract.daysRemaining !== null ? `${contract.daysRemaining} araw` : "N/A";
      const daysEn = contract.daysRemaining !== null ? `${contract.daysRemaining} days` : "N/A";
      if (isTagalog) {
        return `Ang inyong lease sa Room **${contract.roomNumber}** (${contract.bedLabel}) ay magtatapos sa **${endFormatted}** (${days} na lang po ang natitira). Maaari po kayong mag-request ng renewal sa inyong [Contracts Page](/applicant/contracts).`;
      }
      return `Your lease for Room **${contract.roomNumber}** (${contract.bedLabel}) is scheduled to end on **${endFormatted}** (${daysEn} remaining). You can request an extension or review your signed lease on the [Contracts Page](/applicant/contracts).`;
    }
  }

  // 3. Maintenance Inquiries
  if (text.includes("maintenance") || text.includes("repair") || text.includes("sira") || text.includes("ticket") || text.includes("aircon") || text.includes("gripo")) {
    const active = maintenance[0];
    if (active) {
      if (isTagalog) {
        return `Ang inyong active ticket **${active.ticketNumber}** (${active.type}) ay kasalukuyang nasa status na **${active.status.toUpperCase()}**.${
          active.scheduledDate ? ` Nakatakda po itong bisitahin sa ${active.scheduledDate}.` : ""
        } Maaari po ninyong i-track sa [Maintenance Workspace](/applicant/maintenance).`;
      }
      return `Your active request **${active.ticketNumber}** (${active.type}) is currently **${active.status.toUpperCase()}**.${
        active.scheduledDate ? ` Service is scheduled for ${active.scheduledDate}.` : ""
      } You can track updates in your [Maintenance Workspace](/applicant/maintenance).`;
    }
    return isTagalog
      ? "Wala po kayong active na maintenance ticket sa kasalukuyan. Maaari po kayong mag-submit ng bagong request sa ating [Maintenance Portal](/applicant/maintenance)."
      : "You have no active maintenance tickets right now. You can submit a new repair request anytime through the [Maintenance Portal](/applicant/maintenance).";
  }

  // 4. Curfew & House Rules
  if (text.includes("curfew") || text.includes("gate") || text.includes("oras") || text.includes("late")) {
    return isTagalog
      ? "Ang main gate po ay nakasara mula 11:00 PM hanggang 5:00 AM. Pinapayagan po ang 24/7 late entry para sa mga may night shift o academic schedule basta magpakita ng valid ID sa lobby guard."
      : "Building gates are secured between 11:00 PM and 5:00 AM. 24/7 late entry is permitted for night-shift employees or students upon presenting a valid ID to the on-duty guard.";
  }

  // 5. Greeting
  if (text.includes("kamusta") || text.includes("hello") || text.includes("hi") || text.includes("mabuhay")) {
    const tenantName = user?.name || "Resident";
    if (isTagalog) {
      return `Mabuhay ${tenantName}! Ako po ang inyong Lilycrest AI Assistant. Maaari po kayong magtanong tungkol sa inyong monthly bill, electricity share, contract timeline, o maintenance tickets!`;
    }
    return `Hello ${tenantName}! I am your Lilycrest Resident Assistant. Feel free to ask about your monthly billing statement, electricity breakdown, lease dates, or active maintenance requests.`;
  }

  return isTagalog
    ? "Nandito po ako upang tumulong sa inyong pananatili sa Lilycrest. Maaari po kayong magtanong tungkol sa inyong bill, kuryente, kontrata, o maintenance repairs!"
    : "I am here to assist with your stay at Lilycrest. You can ask about your monthly bill, electricity charges, lease timeline, or active maintenance tickets.";
}

/**
 * Streams Gemini LLM response with real-time SSE token delivery grounded on tenant stay context.
 *
 * @param {Object} options
 */
export async function streamTenantAssistant({
  userId,
  message,
  conversationHistory = [],
  onToken,
  onWidget,
  onActions,
  onDone,
  onError,
  signal,
}) {
  const trimmedMessage = (message || "").trim();
  const context = await getTenantStayContext(userId);

  // 1. Emit widget if detected
  const widget = detectTenantWidgetIntent(trimmedMessage, context);
  if (widget && typeof onWidget === "function") {
    try {
      onWidget(widget);
    } catch {
      // Non-fatal
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback to offline rule-based streaming if no Gemini key
  if (!apiKey) {
    const fallbackReply = getTenantRuleBasedFallback(trimmedMessage, context);
    await simulateStream(fallbackReply, { onToken, signal });
    const actions = determineTenantSuggestedActions(trimmedMessage, fallbackReply, context);
    onActions?.(actions);
    onDone?.({
      fullReply: fallbackReply,
      widget,
      suggestedActions: actions,
      canEscalate: true,
    });
    return;
  }

  const systemPrompt = buildTenantSystemPrompt(context);
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;

  const contents = [
    {
      role: "user",
      parts: [{ text: systemPrompt }],
    },
    {
      role: "model",
      parts: [{ text: "Opo, naiintindihan ko po. I will assist the tenant with accurate, courteous, and grounded information based on their residency records." }],
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
    parts: [{ text: trimmedMessage }],
  });

  const localAbort = new AbortController();
  const timeoutId = setTimeout(() => localAbort.abort(), 20000);

  const handleCallerAbort = () => localAbort.abort();
  if (signal) {
    signal.addEventListener("abort", handleCallerAbort);
  }

  let fullReply = "";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
      signal: localAbort.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini stream error: ${response.status} ${response.statusText}`);
    }

    if (response.body) {
      const decoder = new TextDecoder("utf-8");
      let lineBuffer = "";

      const parseAndEmitLines = (chunk) => {
        lineBuffer += chunk;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() || "";

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
            // Ignore incomplete chunks
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
            parseAndEmitLines(decoder.decode(value, { stream: true }));
          }
        }
      }
    }

    if (!fullReply) {
      throw new Error("Empty response from Gemini stream");
    }

    const actions = determineTenantSuggestedActions(trimmedMessage, fullReply, context);
    onActions?.(actions);
    onDone?.({
      fullReply,
      widget,
      suggestedActions: actions,
      canEscalate: true,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (signal?.aborted) return;

    // Fallback to grounded rule-based streaming
    const fallbackReply = getTenantRuleBasedFallback(trimmedMessage, context);
    await simulateStream(fallbackReply, { onToken, signal });
    const actions = determineTenantSuggestedActions(trimmedMessage, fallbackReply, context);
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
 * Standard REST query handler for tenant assistant.
 */
export async function queryTenantAssistantService({ userId, message, conversationHistory = [] }) {
  const trimmedMessage = (message || "").trim();
  const context = await getTenantStayContext(userId);
  const widget = detectTenantWidgetIntent(trimmedMessage, context);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const reply = getTenantRuleBasedFallback(trimmedMessage, context);
    return {
      reply,
      widget,
      suggestedActions: determineTenantSuggestedActions(trimmedMessage, reply, context),
      canEscalate: true,
    };
  }

  const systemPrompt = buildTenantSystemPrompt(context);
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Opo, naiintindihan ko po. I am grounded on the tenant profile and ready to assist." }] },
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

  contents.push({ role: "user", parts: [{ text: trimmedMessage }] });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (!res.ok) throw new Error(`Gemini query error: ${res.statusText}`);

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    if (!reply) throw new Error("Empty reply");

    return {
      reply,
      widget,
      suggestedActions: determineTenantSuggestedActions(trimmedMessage, reply, context),
      canEscalate: true,
    };
  } catch {
    const reply = getTenantRuleBasedFallback(trimmedMessage, context);
    return {
      reply,
      widget,
      suggestedActions: determineTenantSuggestedActions(trimmedMessage, reply, context),
      canEscalate: true,
    };
  }
}

/**
 * Escalate tenant assistant conversation to the branch admin team.
 */
export async function escalateTenantAssistantService({ userId, category, priority = "medium", summary, lastBotMessage }) {
  const context = await getTenantStayContext(userId);
  const user = context?.user;

  const inquiry = new Inquiry({
    fullName: user?.name || "Resident Tenant",
    email: user?.email || "tenant@lilycrest.com",
    contactNumber: user?.phone || "09000000000",
    preferredBranch: context?.contract?.branch || user?.branch || "guadalupe",
    preferredRoomType: context?.contract?.roomType || "Shared",
    message: `[TENANT ASSISTANT ESCALATION - ${category || "General Inquiry"}]\nTenant: ${user?.name} (Room ${context?.contract?.roomNumber || "N/A"})\nPriority: ${priority}\nSummary: ${summary}\n\nLast Assistant Response: ${lastBotMessage || "N/A"}`,
    source: "website",
    sourceNote: "tenant_ai_assistant_escalation",
    viewingStatus: "new",
    priority: priority === "high" || priority === "urgent" ? "high" : "medium",
  });

  await inquiry.save();

  return {
    escalationId: String(inquiry._id),
    message: "Your inquiry has been escalated directly to our Branch Admin team. We will attend to your concern promptly.",
  };
}

async function simulateStream(text, { onToken, signal }) {
  if (!text) return;
  const words = text.match(/\S+|\s+/g) || [text];
  const delay = process.env.NODE_ENV === "test" ? 0 : 12;
  for (const token of words) {
    if (signal?.aborted) break;
    onToken?.(token);
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
