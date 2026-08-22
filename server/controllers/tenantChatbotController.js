import { z } from "zod";
import {
  buildNeutralContext,
  resolveTenantAIContext,
} from "../services/chatbot/tenantContextResolver.js";
import { queryTenantGeminiChatbot, streamTenantGeminiChatbot } from "../services/chatbot/tenantChatbotService.js";
import {
  classifyLilyRequest,
  lilyDomainReply,
} from "../services/chatbot/tenantDomainGuard.js";
import ChatConversation from "../models/ChatConversation.js";
import ChatMessage from "../models/ChatMessage.js";
import { ensureChatTicketId } from "../services/chatTicketIdService.js";
import { emitToChatAdmins, emitToUser } from "../utils/socket.js";

const querySchema = z.object({
  message: z.string().min(1).max(1000),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "model"]),
    content: z.string()
  })).optional().default([]),
});

const escalationSchema = z.object({
  category: z.string(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
  summary: z.string(),
  lastBotMessage: z.string().optional(),
});

const CONVERSATION_CATEGORIES = new Set([
  "billing_concern",
  "maintenance_concern",
  "reservation_concern",
  "payment_concern",
  "general_inquiry",
  "urgent_issue",
]);

function conversationCategory(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (CONVERSATION_CATEGORIES.has(normalized)) return normalized;
  if (normalized.includes("billing")) return "billing_concern";
  if (normalized.includes("maintenance")) return "maintenance_concern";
  if (normalized.includes("reservation")) return "reservation_concern";
  if (normalized.includes("payment")) return "payment_concern";
  if (normalized.includes("urgent")) return "urgent_issue";
  return "general_inquiry";
}

function canonicalBranch(contextSnapshot) {
  const raw = String(contextSnapshot?.branchRaw || contextSnapshot?.branch || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (raw.includes("gil-puyat")) return "gil-puyat";
  if (raw.includes("guadalupe")) return "guadalupe";
  return null;
}

async function tenantContext(req, userId, domains = null) {
  return (await resolveTenantAIContext(userId, req.authUser, { domains }))
    || buildNeutralContext(req.authUser);
}

export const handleTenantQuery = async (req, res, next) => {
  try {
    const validatedData = querySchema.parse(req.body);
    const { message, conversationHistory } = validatedData;
    const userId = req.authUser?._id || req.user?.uid;
    // conversationHistory is client supplied, so it is intentionally not
    // trusted to widen Lily's server-side scope decision.
    const domainDecision = classifyLilyRequest(message);
    if (!domainDecision.allowed) {
      const restricted = lilyDomainReply();
      return res.status(200).json({
        success: true,
        data: {
          reply: restricted.reply,
          widget: null,
          suggestedActions: restricted.suggestions,
          canEscalate: false,
        },
        message: "Operation completed successfully.",
      });
    }

    const contextSnapshot = await tenantContext(req, userId, domainDecision.domains);

    const { reply, widget, suggestedActions } = await queryTenantGeminiChatbot({
      message,
      conversationHistory,
      contextSnapshot
    });

    return res.status(200).json({
      success: true,
      data: {
        reply,
        contextSnapshot,
        widget,
        suggestedActions,
        canEscalate: true
      },
      message: "Operation completed successfully."
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        code: "VALIDATION_ERROR",
        errors: error.errors
      });
    }
    next(error);
  }
};

export const handleTenantStream = async (req, res, next) => {
  try {
    const validatedData = querySchema.parse(req.body);
    const { message, conversationHistory } = validatedData;
    const userId = req.authUser?._id || req.user?.uid;
    const domainDecision = classifyLilyRequest(message);

    if (!domainDecision.allowed) {
      const restricted = lilyDomainReply();
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: "token", text: restricted.reply })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "actions", actions: restricted.suggestions })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", canEscalate: false })}\n\n`);
      res.end();
      return;
    }

    const contextSnapshot = await tenantContext(req, userId, domainDecision.domains);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const abortController = new AbortController();
    req.on("close", () => abortController.abort());

    await streamTenantGeminiChatbot({
      message,
      conversationHistory,
      contextSnapshot,
      signal: abortController.signal,
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`);
      },
      onWidget: (widget) => {
        res.write(`data: ${JSON.stringify({ type: "widget", widget })}\n\n`);
      },
      onActions: (actions) => {
        res.write(`data: ${JSON.stringify({ type: "actions", actions })}\n\n`);
      },
      onDone: () => {
        res.write(`data: ${JSON.stringify({ type: "done", contextSnapshot, canEscalate: true })}\n\n`);
        res.end();
      },
      onError: (err) => {
        res.write(`data: ${JSON.stringify({ type: "error", message: "Failed to process request." })}\n\n`);
        res.end();
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        code: "VALIDATION_ERROR",
        errors: error.errors
      });
    }
    if (!res.headersSent) {
      next(error);
    }
  }
};

export const handleTenantEscalation = async (req, res, next) => {
  try {
    const validatedData = escalationSchema.parse(req.body);
    const { category, priority, summary, lastBotMessage } = validatedData;
    const userId = req.authUser?._id || req.user?.uid;

    const contextSnapshot = await tenantContext(req, userId);
    const branch = canonicalBranch(contextSnapshot);
    if (!branch) {
      return res.status(409).json({
        success: false,
        message: "Your current branch could not be verified. Please refresh your tenancy details before escalating.",
        code: "TENANT_BRANCH_UNRESOLVED",
      });
    }
    
    let conversation = await ChatConversation.findOne({
      tenantId: userId,
      status: { $in: ["open", "in_review", "waiting_tenant", "resolved"] },
      branch
    });

    if (!conversation) {
      conversation = new ChatConversation({
        tenantId: userId,
        tenantUserId: req.authUser?.user_id || req.authUser?.firebaseUid || "",
        tenantName: contextSnapshot.tenantName,
        tenantEmail: contextSnapshot.tenantEmail || req.authUser?.email || "",
        branch,
        roomNumber: contextSnapshot.roomNumber || "",
        roomBed: contextSnapshot.bedPosition || "",
        category: conversationCategory(category),
        status: "open",
        priority: priority === "low" ? "normal" : priority,
        statusHistory: [],
      });
      await conversation.save();
    } else if (conversation.status === "resolved") {
      conversation.status = "open";
      conversation.closedAt = null;
      conversation.closedBy = null;
      conversation.closingNote = "";
      conversation.statusHistory.push({
        status: "open",
        note: "Tenant escalated the persistent concern from Lily.",
        actorId: userId,
        actorName: contextSnapshot.tenantName,
        createdAt: new Date(),
      });
    }

    conversation = await ensureChatTicketId(conversation);

    const initialMessageContent = `[AI Escalation Summary]
Category: ${category}
Priority: ${priority}

Tenant Summary:
${summary}

Last AI Response:
${lastBotMessage || "N/A"}

Context Snapshot:
Room: ${contextSnapshot.roomNumber} | Bed: ${contextSnapshot.bedPosition}
Active Bills: ${contextSnapshot.currentBill ? "Yes" : "No"}
Active Maintenance: ${contextSnapshot.activeMaintenance.length}
Support Inquiries: ${contextSnapshot.inquiries?.length || 0}`;

    const newMsg = new ChatMessage({
      conversationId: conversation._id,
      senderId: userId,
      senderUserId: req.authUser?.user_id || req.authUser?.firebaseUid || "",
      senderName: contextSnapshot.tenantName,
      senderRole: "tenant",
      message: initialMessageContent,
    });
    
    await newMsg.save();

    conversation.lastMessage = summary;
    conversation.lastMessageAt = new Date();
    conversation.unreadAdminCount = Number(conversation.unreadAdminCount || 0) + 1;
    await conversation.save();

    const serializedMsg = {
      id: String(newMsg._id),
      conversationId: String(conversation._id),
      senderId: String(userId),
      senderUserId: req.authUser?.user_id || req.authUser?.firebaseUid || "",
      senderName: contextSnapshot.tenantName,
      senderRole: "tenant",
      message: initialMessageContent,
      attachments: [],
      createdAt: newMsg.createdAt,
      updatedAt: newMsg.updatedAt,
    };

    // Emit to both branch admin room and tenant's specific room
    emitToChatAdmins(branch, "chat:message-new", {
      conversationId: String(conversation._id),
      message: serializedMsg,
    });
    emitToUser(userId, "chat:message-new", {
      conversationId: String(conversation._id),
      message: serializedMsg,
    });

    let assignedAdminName = conversation.assignedAdminName || "Pending Support Team";
    if (conversation.assigned_admin_id && !conversation.assignedAdminName) {
       assignedAdminName = "Support Agent";
    }

    return res.status(200).json({
      success: true,
      data: {
        conversationId: conversation._id,
        ticketId: conversation.ticketId || "",
        status: conversation.status,
        category: conversation.category,
        priority: conversation.priority,
        assignedAdminName,
      },
      message: "Operation completed successfully."
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        code: "VALIDATION_ERROR",
        errors: error.errors
      });
    }
    next(error);
  }
};

