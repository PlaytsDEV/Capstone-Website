const { Types: { ObjectId } } = require('mongoose');
const { getDb } = require('../config/database');
const {
  CHATBOT_SYSTEM_PROMPT,
  buildLeasingSystemPrompt,
  KNOWLEDGE_BASE,
  ESCALATION_KEYWORDS,
  DEFAULT_FOLLOWUPS,
  isGreeting,
  getTimeOfDayGreeting,
  detectEmotionalTone,
} = require('../config/chatbot.presets');
const {
  sendGeminiMessage,
  liveChatQueue,
  chatSessions,
} = require('../services/gemini.service');
const {
  notifyAdminChatAccepted,
  notifyChatbotReply,
} = require('../services/pushService');
const { resolveTenantAIContext } = require('../services/tenantContextResolver');

function sanitizeResponse(text = '') {
  const withoutFences = text.replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''));
  const withoutInline = withoutFences.replace(/`([^`]+)`/g, '$1');
  const squashedBlankLines = withoutInline.replace(/\n{3,}/g, '\n\n');
  return squashedBlankLines.trim();
}

function looksLikeCode(text = '') {
  if (!text) return false;
  if (/```/.test(text)) return true;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const codeLineCount = lines.filter((line) =>
    /^(const|let|var|function|class|import|export|if\s*\(|for\s*\(|while\s*\(|return\b|<\w+|SELECT\b|INSERT\b|UPDATE\b|DELETE\b)/i.test(line)
  ).length;
  const symbolHits = (text.match(/[{}<>;]/g) || []).length;
  return codeLineCount >= 2 || symbolHits > 40;
}

const KNOWLEDGE_LIST = Object.values(KNOWLEDGE_BASE);
const MAX_CHAT_MESSAGE_CHARS = 800;
const MAX_ADMIN_REASON_CHARS = 300;
const MAX_SESSION_ID_CHARS = 120;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function normalizeSessionId(rawSessionId, userId) {
  const candidate = typeof rawSessionId === 'string' ? rawSessionId.trim() : '';
  if (!candidate) {
    return { ok: true, value: `${userId}_${Date.now()}` };
  }
  if (candidate.length > MAX_SESSION_ID_CHARS || !SESSION_ID_PATTERN.test(candidate)) {
    return { ok: false, error: 'Invalid session id format' };
  }
  return { ok: true, value: candidate };
}

// A sessionId is a client-supplied, guessable/enumerable string — it must
// never be treated as proof of ownership. Every read/write against
// liveChatQueue that isn't already admin-gated must resolve the session
// through this helper so a tenant who knows or guesses another tenant's
// sessionId cannot read their live-chat status/messages or inject messages
// into their active admin conversation.
function getOwnedLiveChat(sessionId, userId) {
  const liveChat = liveChatQueue.get(sessionId);
  if (!liveChat || liveChat.user_id !== userId) return null;
  return liveChat;
}

function normalizeUserMessage(rawMessage) {
  if (typeof rawMessage !== 'string') {
    return { ok: false, error: 'Message must be text' };
  }
  const collapsed = rawMessage.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!collapsed) {
    return { ok: false, error: 'Message is required' };
  }
  if (collapsed.length > MAX_CHAT_MESSAGE_CHARS) {
    return { ok: false, error: `Message must be ${MAX_CHAT_MESSAGE_CHARS} characters or fewer` };
  }
  return { ok: true, value: collapsed };
}

// ── Knowledge matching (for context hints, NOT direct responses) ──

function findRelevantKnowledge(message) {
  const lower = message.toLowerCase();
  return KNOWLEDGE_LIST.filter((entry) =>
    (entry.triggers || []).some((t) => lower.includes(t))
  );
}

function findKnowledgeByIntent(intent) {
  return KNOWLEDGE_LIST.find((entry) => entry.intent === intent) || null;
}

// Fast in-process intent classifier — no extra Gemini API call required
function classifyIntentLocal(message) {
  const lower = message.toLowerCase();
  let bestIntent = 'general';
  let bestScore = 0;
  for (const [, entry] of Object.entries(KNOWLEDGE_BASE)) {
    const matchCount = (entry.triggers || []).filter((t) => lower.includes(t)).length;
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestIntent = entry.intent;
    }
  }
  const confidence = bestScore === 0 ? 0.3 : Math.min(0.5 + bestScore * 0.15, 0.95);
  return { intent: bestIntent, confidence };
}

// Safe structured log — never logs tokens, credentials, or full message content
function logChatEvent(type, data) {
  try {
    console.log(`[Chatbot:${type}] ${JSON.stringify(data)}`);
  } catch (_) {}
}

function shouldEscalate(knowledgeEntries, message) {
  const lower = message.toLowerCase();
  const hitGlobalKeyword = ESCALATION_KEYWORDS.some((word) => lower.includes(word));
  const hitEntryKeyword = knowledgeEntries.some((entry) =>
    (entry.escalation_if || []).some((word) => lower.includes(word))
  );
  return hitGlobalKeyword || hitEntryKeyword;
}

/**
 * Pick follow-up suggestions based on matched knowledge or intent.
 */
function pickFollowups(knowledgeEntries, intent) {
  // Use followups from the first matched knowledge entry that has them
  for (const entry of knowledgeEntries) {
    if (entry.followups?.length) return entry.followups.slice(0, 3);
  }
  // Fall back to intent-based lookup
  const intentEntry = findKnowledgeByIntent(intent);
  if (intentEntry?.followups?.length) return intentEntry.followups.slice(0, 3);
  return DEFAULT_FOLLOWUPS;
}

/**
 * Dynamically fetches live room prices from MongoDB and hydrates the Leasing Assistant prompt.
 */
async function fetchHydratedLeasingPrompt(db, branch) {
  try {
    if (!['gil-puyat', 'guadalupe'].includes(branch)) return buildLeasingSystemPrompt();
    const rooms = await db.collection('rooms').find(
      { branch, isArchived: { $ne: true } },
      { projection: { type: 1, price: 1, monthlyPrice: 1 } }
    ).toArray();

    if (!rooms || rooms.length === 0) {
      return buildLeasingSystemPrompt();
    }

    const quad = rooms.find((r) => r.type === 'quadruple-sharing') || {};
    const double = rooms.find((r) => r.type === 'double-sharing') || {};
    const privateRoom = rooms.find((r) => r.type === 'private') || {};

    const formatNum = (num, fallback) =>
      typeof num === 'number' && !isNaN(num) && num > 0 ? num.toLocaleString('en-PH') : fallback;

    const quadShort = formatNum(quad.price, '6,300');
    const quadLong = formatNum(quad.monthlyPrice, '5,400');
    const quadSav = formatNum((quad.price || 6300) - (quad.monthlyPrice || 5400), '900');

    const doubleShort = formatNum(double.price, '8,000');
    const doubleLong = formatNum(double.monthlyPrice, '7,200');
    const doubleSav = formatNum((double.price || 8000) - (double.monthlyPrice || 7200), '800');

    const privateShort = formatNum(privateRoom.price, '14,400');
    const privateLong = formatNum(privateRoom.monthlyPrice, '13,500');
    const privateSav = formatNum((privateRoom.price || 14400) - (privateRoom.monthlyPrice || 13500), '900');

    return buildLeasingSystemPrompt({
      quadShort,
      quadLong,
      quadSavings: quadSav,
      doubleShort,
      doubleLong,
      doubleSavings: doubleSav,
      privateShort,
      privateLong,
      privateSavings: privateSav,
    });
  } catch (err) {
    console.error('[Chatbot] Error fetching room rates for leasing prompt:', err);
    return buildLeasingSystemPrompt();
  }
}

/**
 * Build a rich, context-aware prompt for Gemini.
 * This is the heart of the AI-first approach.
 */
function buildAIPrompt(userMessage, contextLines, knowledgeHints, conversationHistory, isEmotional = false, systemPromptOverride = null) {
  const timeContext = `Current time: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`;
  const baseSystemPrompt = systemPromptOverride || CHATBOT_SYSTEM_PROMPT;
  const contextBlock = contextLines.length > 0
    ? `\nTENANT CONTEXT:\n${contextLines.join('\n')}`
    : '';
  const knowledgeBlock = knowledgeHints.length > 0
    ? `\nRELEVANT POLICIES (reference naturally, don't quote verbatim):\n${knowledgeHints.map((k) => `- ${k.knowledge}`).join('\n')}`
    : '';
  const historyBlock = conversationHistory.length > 0
    ? `\nRECENT CONVERSATION:\n${conversationHistory.slice(-6).map((h) => `${h.role === 'user' ? 'Tenant' : 'Lily'}: ${h.content}`).join('\n')}`
    : '';
  const emotionalHint = isEmotional
    ? '\n\nNOTE: The tenant appears frustrated or upset. Lead your response with genuine empathy in the first sentence before addressing their issue.'
    : '';

  return `${baseSystemPrompt}\n\n${timeContext}${contextBlock}${knowledgeBlock}${historyBlock}${emotionalHint}\n\nTenant: ${userMessage}`;
}

function contextDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-PH');
}

function buildTenantContextLines(context = {}, fallbackUser = {}) {
  const lines = [];
  lines.push(`Tenant: ${context.tenantName || fallbackUser.name || 'Resident'} (${context.tenantEmail || fallbackUser.email || 'email unavailable'})`);

  if (context.branchRaw) {
    lines.push(`Current branch: ${context.branch} (${context.branchRaw}; source: ${context.branchSource})`);
  } else {
    lines.push('Current branch: not resolved from canonical occupancy records');
  }

  if (context.tenancy?.isCurrentResident) {
    const started = contextDate(context.tenancy.occupancyStartedAt);
    lines.push(`Current tenancy: active resident${started ? `; move-in completed on ${started}` : ''}. Do not present a move-in reminder.`);
  } else if (context.tenancy?.scheduledMoveInDate) {
    lines.push(`Current tenancy: ${context.tenancy.status}; scheduled move-in date: ${contextDate(context.tenancy.scheduledMoveInDate)}`);
  } else {
    lines.push(`Current tenancy: ${context.tenancy?.status || 'unknown'}; no verified move-in date`);
  }

  if (context.roomNumber || context.bedPosition) {
    lines.push(`Current assignment: room ${context.roomNumber || 'not recorded'}, ${context.bedPosition || 'bed not recorded'}`);
  }

  if (context.currentBill) {
    const bill = context.currentBill;
    lines.push(
      `Canonical current bill (${bill.billingPeriod || 'current cycle'}): ${bill.statusLabel || bill.status}; `
      + `total PHP ${Number(bill.totalAmount || 0).toFixed(2)}, remaining PHP ${Number(bill.remainingAmount || 0).toFixed(2)}, `
      + `due ${contextDate(bill.dueDate) || 'not set'}; utilities ${bill.utilityReleased ? 'released' : 'not released'}`,
    );
  } else {
    lines.push('Canonical current bill: none');
  }

  if (context.contract) {
    const documentState = context.contract.tenantDocument?.available
      ? `${context.contract.tenantDocument.label || 'tenant document'} available (version ${context.contract.tenantDocument.version || 'unknown'})`
      : 'tenant document not available yet';
    lines.push(`Canonical contract: ${context.contract.displayStatus || context.contract.status}; ${documentState}`);
  } else {
    lines.push('Canonical contract: none');
  }

  if (context.inquiries?.length) {
    const inquiries = context.inquiries
      .map((inquiry) => `- ${inquiry.category || 'general inquiry'}: ${inquiry.status}`)
      .join('\n');
    lines.push(`Support inquiries:\n${inquiries}`);
  } else {
    lines.push('Support inquiries: none');
  }

  if (context.recentAnnouncements?.length) {
    const announcements = context.recentAnnouncements
      .map((announcement) => `- ${announcement.title}: ${announcement.content}`)
      .join('\n');
    lines.push(`Audience-authorized recent announcements:\n${announcements}`);
  }

  return lines;
}

async function ensureLiveChatRequest(db, sessionId, userId, userName, userEmail, reason, tenantContext = null) {
  const existing = liveChatQueue.get(sessionId);
  if (existing) return existing;

  const session = chatSessions.get(sessionId);
  const chatHistory = session ? session.history : [];
  const liveChatRequest = {
    session_id: sessionId,
    user_id: userId,
    user_name: userName || 'Tenant',
    user_email: userEmail,
    reason: reason || 'Requested admin assistance',
    chat_history: chatHistory,
    messages: [],
    status: 'waiting',
    admin_id: null,
    admin_name: null,
    branch: tenantContext?.branchRaw || null,
    position: liveChatQueue.size + 1,
    created_at: new Date(),
  };

  liveChatQueue.set(sessionId, liveChatRequest);
  await db.collection('live_chat_requests').insertOne(liveChatRequest);

  // Bridge escalation to the same chat_conversations collection used by the
  // mobile inquiry screen and web admin panel. Never create a parallel ticket.
  try {
    const conversations = db.collection('chat_conversations');
    const alreadyBridged = await conversations.findOne(
      { mobileSessionId: sessionId },
      { projection: { _id: 1 } },
    );
    if (!alreadyBridged) {
      const dbUser = await db.collection('users').findOne(
        { $or: [{ firebaseUid: userId }, { user_id: userId }] },
        { projection: { _id: 1, user_id: 1 } },
      );

      const branch = tenantContext?.branchRaw;
      if (!dbUser?._id || !['gil-puyat', 'guadalupe'].includes(branch)) {
        return liveChatRequest;
      }

      const now = new Date();
      const existingConversation = await conversations.findOne({
        tenantId: dbUser._id,
        status: { $in: ['open', 'in_review', 'waiting_tenant', 'resolved'] },
      }, { sort: { lastMessageAt: -1, updatedAt: -1 } });
      let convId = existingConversation?._id || null;

      if (existingConversation) {
        await conversations.updateOne(
          { _id: existingConversation._id },
          {
            $set: {
              mobileSessionId: sessionId,
              status: 'open',
              lastMessage: (reason || 'AI escalation').slice(0, 200),
              lastMessageAt: now,
              closedAt: null,
              closedBy: null,
              closingNote: '',
              updatedAt: now,
            },
            $inc: { unreadAdminCount: chatHistory.filter((item) => item.role === 'user').length || 1 },
            ...(existingConversation.status !== 'open' ? {
              $push: {
                statusHistory: {
                  $each: [{
                    status: 'open',
                    note: 'Tenant escalated the persistent concern from Lily.',
                    actorId: dbUser._id,
                    actorName: tenantContext.tenantName || userName || 'Tenant',
                    createdAt: now,
                  }],
                  $slice: -25,
                },
              },
            } : {}),
          },
        );
      } else {
        const convDoc = {
          tenantId: dbUser._id,
          tenantUserId: userId,
          tenantName: tenantContext.tenantName || userName || 'Mobile Tenant',
          tenantEmail: tenantContext.tenantEmail || userEmail || '',
          branch,
          roomNumber: tenantContext.roomNumber || '',
          roomBed: tenantContext.bedPosition || '',
          status: 'open',
          category: 'general_inquiry',
          priority: 'normal',
          assignedAdminId: null,
          assignedAdminName: '',
          lastMessage: (reason || 'AI escalation').slice(0, 200),
          lastMessageAt: now,
          unreadAdminCount: chatHistory.filter((item) => item.role === 'user').length || 1,
          unreadTenantCount: 0,
          closedAt: null,
          closedBy: null,
          closingNote: '',
          statusHistory: [],
          mobileSessionId: sessionId,
          createdAt: now,
          updatedAt: now,
        };
        const inserted = await conversations.insertOne(convDoc);
        convId = inserted.insertedId;
      }

      if (chatHistory.length > 0) {
        const messages = chatHistory.map((h) => ({
          conversationId: convId,
          senderId: h.role === 'user' ? (dbUser?._id || null) : null,
          senderUserId: h.role === 'user' ? userId : 'system',
          senderName: h.role === 'user' ? (userName || 'Tenant') : 'Lily (AI)',
          senderRole: h.role === 'user' ? 'tenant' : 'admin',
          message: h.content.slice(0, 1000),
          readAt: null,
          createdAt: now,
          updatedAt: now,
        }));
        await db.collection('chat_messages').insertMany(messages);
      }
    }
  } catch (bridgeErr) {
    console.error('[chatbot] Web admin conversation bridge failed (non-fatal):', bridgeErr.message);
  }

  return liveChatRequest;
}

// ─────────────────────────────────────────────────────
// Send message — main chatbot endpoint (AI-first)
// ─────────────────────────────────────────────────────
async function sendMessage(req, res) {
  try {
    const { message, session_id } = req.body;
    const userId = req.user.user_id;
    const userEmail = req.user.email;
    const userName = req.user.name;
    const normalizedMessage = normalizeUserMessage(message);
    if (!normalizedMessage.ok) {
      return res.status(400).json({ detail: normalizedMessage.error });
    }

    const normalizedSession = normalizeSessionId(session_id, userId);
    if (!normalizedSession.ok) {
      return res.status(400).json({ detail: normalizedSession.error });
    }
    const sessionId = normalizedSession.value;
    const userMessage = normalizedMessage.value;

    logChatEvent('message', { sessionId, messageLength: userMessage.length, userId });

    // Resolve MongoDB ObjectId from the authenticated server-owned identity.
    const rawId = req.user?._id;
    const mongoId = rawId && ObjectId.isValid(String(rawId)) ? new ObjectId(String(rawId)) : null;

    // Pull the shared canonical tenant context used by both web and mobile Lily.
    const db = getDb();
    const tenantContext = await resolveTenantAIContext(mongoId, req.user, { db });

    // Check if this is an active live chat (admin is responding)
    const liveChat = getOwnedLiveChat(sessionId, userId);
    if (liveChat && liveChat.status === 'active') {
      liveChat.messages.push({ sender: 'tenant', content: userMessage, timestamp: new Date() });
      return res.json({ response: null, session_id: sessionId, live_chat_active: true, admin_name: liveChat.admin_name, message: 'Message sent to admin' });
    }

    const contextLines = buildTenantContextLines(tenantContext, req.user);

    // Find relevant knowledge entries (context hints for the AI)
    const knowledgeHints = findRelevantKnowledge(userMessage);
    const meta = { intent: 'general', confidence: null };
    let followups = [];
    let aiResponse = '';
    let needsAdmin = false;

    // Classify intent in-process — no extra API call
    const intentResult = classifyIntentLocal(userMessage);
    meta.intent = intentResult.intent;
    meta.confidence = intentResult.confidence;
    const intentKnowledge = findKnowledgeByIntent(intentResult.intent);
    if (intentKnowledge && !knowledgeHints.includes(intentKnowledge)) {
      knowledgeHints.push(intentKnowledge);
    }

    // Pick follow-ups
    followups = pickFollowups(knowledgeHints, meta.intent);

    // Detect emotional tone — modifies prompt empathy level, does not trigger escalation
    const isEmotional = detectEmotionalTone(userMessage);

    // Check for escalation
    const escalate = shouldEscalate(knowledgeHints, userMessage);

    // Get conversation history for continuity
    const session = chatSessions.get(sessionId) || { history: [] };
    const conversationHistory = session.history || [];

    logChatEvent('intent', { sessionId, intent: meta.intent, confidence: meta.confidence, escalate, isEmotional });

    // ── Generate response ──
    try {
      if (escalate) {
        // Safety/admin escalation — AI still generates the response, but flags it for human review
        needsAdmin = true;
        await ensureLiveChatRequest(
          db, sessionId, userId, userName, userEmail,
          `Escalated: ${userMessage.slice(0, 120)}`,
          tenantContext,
        );
        const escalationPrompt = buildAIPrompt(
          userMessage, contextLines, knowledgeHints, conversationHistory, isEmotional
        ) + "\n\nIMPORTANT: This message has been flagged for admin attention. Acknowledge the tenant's concern empathetically, let them know an admin will follow up shortly, and reassure them. Keep it to 2-3 warm sentences.";
        const { text } = await sendGeminiMessage(sessionId, escalationPrompt);
        aiResponse = text || "I completely understand your concern, and I want to make sure it gets properly handled. I've flagged this for our admin team and they'll reach out to you shortly. If it's urgent, you can also call us directly at +63 912 345 6789.";
      } else if (isGreeting(userMessage) && userMessage.trim().split(/\s+/).length <= 4) {
        // Pure greeting — warm, personalized, mentions context if useful
        const greetingPrompt = buildAIPrompt(
          userMessage, contextLines, [], conversationHistory, false
        ) + '\n\nThis is a greeting. Respond warmly, introduce yourself briefly as Lily, and ask how you can help. Mention the time of day naturally. Keep it to 1-2 sentences.';
        const { text } = await sendGeminiMessage(sessionId, greetingPrompt);
        aiResponse = text || `${getTimeOfDayGreeting()} I'm Lily, your LilyCrest dorm assistant. How can I help you today?`;
        meta.intent = 'greeting';
        meta.confidence = 1;
      } else {
        // Normal message — AI-first, check if message is related to leasing/pricing/rooms
        let systemPromptOverride = null;
        const isLeasingInquiry =
          meta.intent === 'reservation' ||
          /(price|rate|cost|rent|how much|quad|double|private|room rate|deposit|advance|short-term|long-term|move-in)/i.test(userMessage);

        if (isLeasingInquiry) {
          const branch = tenantContext?.branchRaw;
          if (branch) systemPromptOverride = await fetchHydratedLeasingPrompt(db, branch);
        }

        const prompt = buildAIPrompt(
          userMessage, contextLines, knowledgeHints, conversationHistory, isEmotional, systemPromptOverride
        );
        const { text } = await sendGeminiMessage(sessionId, prompt);

        if (text && !looksLikeCode(text)) {
          aiResponse = text;
          if (text.includes('[NEEDS_ADMIN]')) {
            needsAdmin = true;
            await ensureLiveChatRequest(
              db, sessionId, userId, userName, userEmail,
              `AI escalation: ${userMessage.slice(0, 120)}`,
              tenantContext,
            );
          }
        } else {
          // AI returned code or empty — retry with a plain prompt
          const retryPrompt = `${CHATBOT_SYSTEM_PROMPT}\n\nThe tenant asked: "${userMessage}"\n\nRespond naturally and helpfully in plain conversational text. Do NOT include any code, formatting symbols, or technical syntax.`;
          const retry = await sendGeminiMessage(sessionId, retryPrompt);
          aiResponse = retry.text || "I'm here to help! Could you rephrase your question? Feel free to ask me anything about billing, maintenance, house rules, or your stay at LilyCrest.";
        }
      }
    } catch (modelError) {
      logChatEvent('ai_error', { sessionId, error: modelError?.message });
      aiResponse = "I'm having a bit of trouble connecting right now. Please try again in a moment — or if it's urgent, you can reach the admin office directly at +63 912 345 6789.";
    }

    // Clean the response
    const responseText = typeof aiResponse === 'string' ? aiResponse : String(aiResponse ?? '');
    let cleanResponse = sanitizeResponse(responseText.replace('[NEEDS_ADMIN]', '').trim())
      || "I'm here to help. Could you tell me more about what you need?";

    // Final code check
    if (looksLikeCode(cleanResponse)) {
      cleanResponse = "I'm here to help. Could you rephrase your question? You can ask me about billing, maintenance, house rules, or anything about your stay.";
    }

    // Update in-memory session history
    session.history = session.history || [];
    session.history.push({ role: 'user', content: userMessage });
    session.history.push({ role: 'assistant', content: cleanResponse });
    if (session.history.length > 30) {
      session.history = session.history.slice(-30);
    }
    chatSessions.set(sessionId, session);

    logChatEvent('response', { sessionId, responseLength: cleanResponse.length, needsAdmin, intent: meta.intent });

    res.json({
      response: cleanResponse,
      session_id: sessionId,
      needs_admin: needsAdmin,
      live_chat_active: false,
      fallback: false,
      suggestions: followups,
      meta,
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({
      response: "I'm having trouble connecting right now po. Please try again, or contact the admin office at +63 912 345 6789.",
      error: {
        code: 'LILY_TEMPORARILY_UNAVAILABLE',
        message: 'Lily is temporarily unavailable. Please try again.',
      },
    });
  }
}

// ─────────────────────────────────────────────────────
// Request admin
// ─────────────────────────────────────────────────────
async function requestAdmin(req, res) {
  try {
    const { session_id, reason } = req.body;
    const userId = req.user.user_id;
    const db = getDb();
    const user = await db.collection('users').findOne({
      $or: [{ user_id: userId }, { firebaseUid: userId }],
    });
    const normalizedSession = normalizeSessionId(session_id, userId);
    if (!normalizedSession.ok) {
      return res.status(400).json({ detail: normalizedSession.error });
    }
    const sessionId = normalizedSession.value;
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    if (normalizedReason.length > MAX_ADMIN_REASON_CHARS) {
      return res.status(400).json({ detail: `Reason must be ${MAX_ADMIN_REASON_CHARS} characters or fewer` });
    }

    const mongoId = user?._id && ObjectId.isValid(String(user._id))
      ? new ObjectId(String(user._id))
      : null;
    const tenantContext = await resolveTenantAIContext(mongoId, req.user, { db });
    const liveChatRequest = await ensureLiveChatRequest(
      db,
      sessionId,
      userId,
      tenantContext?.tenantName || user?.name || 'Tenant',
      tenantContext?.tenantEmail || user?.email,
      normalizedReason || 'Requested admin assistance',
      tenantContext,
    );

    res.json({
      queued: true,
      session_id: sessionId,
      position: liveChatRequest.position,
      status: liveChatRequest.status,
      message: liveChatRequest.status === 'active'
        ? `You are now chatting with ${liveChatRequest.admin_name}`
        : 'Your request has been submitted. An admin will be with you shortly.',
    });
  } catch (error) {
    console.error('Live chat request error:', error);
    res.status(500).json({ error: 'Failed to request admin chat' });
  }
}

// ─────────────────────────────────────────────────────
// Get live status
// ─────────────────────────────────────────────────────
async function getLiveStatus(req, res) {
  try {
    const { sessionId } = req.params;
    const normalizedSession = normalizeSessionId(sessionId, req.user.user_id);
    if (!normalizedSession.ok) {
      return res.status(400).json({ detail: normalizedSession.error });
    }
    const liveChat = getOwnedLiveChat(normalizedSession.value, req.user.user_id);
    if (!liveChat) {
      return res.json({ active: false, in_queue: false });
    }
    res.json({ active: liveChat.status === 'active', in_queue: liveChat.status === 'waiting', position: liveChat.position, admin_name: liveChat.admin_name, messages: liveChat.messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
}

// ─────────────────────────────────────────────────────
// Get live chats (admin)
// ─────────────────────────────────────────────────────
async function getLiveChats(req, res) {
  try {
    const pendingChats = [];
    liveChatQueue.forEach((chat, sessionId) => {
      if ((chat.status === 'waiting' || chat.status === 'active') && (!req.mobileBranchScope || chat.branch === req.mobileBranchScope)) {
        pendingChats.push({ session_id: sessionId, user_name: chat.user_name, reason: chat.reason, status: chat.status, created_at: chat.created_at });
      }
    });
    res.json(pendingChats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get live chats' });
  }
}

// ─────────────────────────────────────────────────────
// Reset Gemini chat session
// ─────────────────────────────────────────────────────
async function resetSession(req, res) {
  try {
    const { session_id } = req.body;
    const sessionId = session_id || `${req.user?.user_id || 'guest'}_${Date.now()}`;

    chatSessions.delete(sessionId);

    const liveChat = liveChatQueue.get(sessionId);
    if (liveChat && liveChat.status !== 'active') {
      liveChatQueue.delete(sessionId);
    }

    return res.json({ reset: true, session_id: sessionId });
  } catch (error) {
    console.error('Reset chat session error:', error);
    return res.status(500).json({ error: 'Failed to reset chat session' });
  }
}

// ─────────────────────────────────────────────────────
// Accept live chat (admin)
// ─────────────────────────────────────────────────────
async function acceptLiveChat(req, res) {
  try {
    const { session_id } = req.body;
    const db = getDb();
    const adminUser = await db.collection('users').findOne({ user_id: req.user.user_id });
    const liveChat = liveChatQueue.get(session_id);
    if (!liveChat) return res.status(404).json({ error: 'Chat session not found' });
    if (req.mobileBranchScope && liveChat.branch !== req.mobileBranchScope) return res.status(404).json({ error: 'Chat session not found' });
    if (liveChat.status === 'active') return res.status(400).json({ error: 'Chat already being handled', admin_name: liveChat.admin_name });

    liveChat.status = 'active';
    liveChat.admin_id = req.user.user_id;
    liveChat.admin_name = adminUser?.name || 'Admin';
    liveChat.messages.push({ sender: 'system', content: `${liveChat.admin_name} has joined the chat.`, timestamp: new Date() });

    await db.collection('live_chat_requests').updateOne({ session_id }, { $set: { status: 'active', admin_id: req.user.user_id, admin_name: liveChat.admin_name } });
    notifyAdminChatAccepted(liveChat.user_id, liveChat.admin_name, session_id).catch(() => {});
    res.json({ success: true, chat_history: liveChat.chat_history, user_name: liveChat.user_name, reason: liveChat.reason });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept chat' });
  }
}

// ─────────────────────────────────────────────────────
// Send admin message
// ─────────────────────────────────────────────────────
async function sendAdminMessage(req, res) {
  try {
    const { session_id, message } = req.body;
    const normalizedSession = normalizeSessionId(session_id, req.user.user_id);
    if (!normalizedSession.ok) return res.status(400).json({ detail: normalizedSession.error });
    const normalizedMessage = normalizeUserMessage(message);
    if (!normalizedMessage.ok) return res.status(400).json({ detail: normalizedMessage.error });
    const db = getDb();
    const adminUser = await db.collection('users').findOne({ user_id: req.user.user_id });

    const liveChat = liveChatQueue.get(normalizedSession.value);
    if (!liveChat || liveChat.status !== 'active') return res.status(404).json({ error: 'Active chat session not found' });
    if (req.mobileBranchScope && liveChat.branch !== req.mobileBranchScope) return res.status(404).json({ error: 'Active chat session not found' });

    liveChat.messages.push({ sender: 'admin', admin_name: adminUser?.name || 'Admin', content: normalizedMessage.value, timestamp: new Date() });
    notifyChatbotReply(liveChat.user_id, {
      adminName: adminUser?.name || 'Admin',
      message: normalizedMessage.value,
      sessionId: normalizedSession.value,
    }).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
}

// ─────────────────────────────────────────────────────
// Close live chat
// ─────────────────────────────────────────────────────
async function closeLiveChat(req, res) {
  try {
    const { session_id } = req.body;
    const liveChat = liveChatQueue.get(session_id);
    if (liveChat) {
      const isOwner = liveChat.user_id === req.user.user_id;
      const role = (req.user?.role || '').toLowerCase();
      const isAdmin = role === 'admin' || role === 'owner' || role === 'branch_admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Only the session owner or an admin can close this chat' });
      }

      liveChat.status = 'closed';
      liveChat.messages.push({ sender: 'system', content: 'Chat session has been closed.', timestamp: new Date() });
      const db = getDb();
      await db.collection('live_chat_archive').insertOne({ ...liveChat, closed_at: new Date() });
      setTimeout(() => liveChatQueue.delete(session_id), 5000);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to close chat' });
  }
}

// ─────────────────────────────────────────────────────
// Get chat history
// ─────────────────────────────────────────────────────
async function getChatHistory(req, res) {
  try {
    const userId = req.user.user_id;
    const db = getDb();
    const [liveRequests, archived] = await Promise.all([
      db.collection('live_chat_requests').find({ user_id: userId }).sort({ created_at: -1 }).limit(50).toArray(),
      db.collection('live_chat_archive').find({ user_id: userId }).sort({ created_at: -1 }).limit(50).toArray(),
    ]);
    res.json({ escalations: liveRequests, archive: archived });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get history' });
  }
}

module.exports = {
  sendMessage,
  requestAdmin,
  getLiveStatus,
  getLiveChats,
  resetSession,
  acceptLiveChat,
  sendAdminMessage,
  closeLiveChat,
  getChatHistory,
  __test: {
    getOwnedLiveChat,
    buildTenantContextLines,
    liveChatQueue,
  },
};
