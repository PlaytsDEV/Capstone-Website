import { z } from "zod";
import { resolveTenantAIContext } from "../services/chatbot/tenantContextResolver.js";
import { queryTenantGeminiChatbot, streamTenantGeminiChatbot } from "../services/chatbot/tenantChatbotService.js";
import ChatConversation from "../models/ChatConversation.js";
import ChatMessage from "../models/ChatMessage.js";

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

export const handleTenantQuery = async (req, res, next) => {
  try {
    const validatedData = querySchema.parse(req.body);
    const { message, conversationHistory } = validatedData;
    const userId = req.authUser?._id || req.user?.uid;

    const contextSnapshot = (await resolveTenantAIContext(userId, req.authUser)) || {
      tenantName: req.authUser?.firstName ? `${req.authUser.firstName} ${req.authUser.lastName || ""}`.trim() : "Resident",
      branch: req.authUser?.branch?.includes("gil") ? "Gil Puyat" : "Guadalupe",
      roomNumber: req.authUser?.roomNumber || "304",
      bedPosition: req.authUser?.roomBed || "Bed 1",
      currentBill: null,
      contract: null,
      activeMaintenance: [],
      hasActiveMaintenance: false,
      hasPendingBill: false,
    };

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

    const contextSnapshot = (await resolveTenantAIContext(userId, req.authUser)) || {
      tenantName: req.authUser?.firstName ? `${req.authUser.firstName} ${req.authUser.lastName || ""}`.trim() : "Resident",
      branch: req.authUser?.branch?.includes("gil") ? "Gil Puyat" : "Guadalupe",
      roomNumber: req.authUser?.roomNumber || "304",
      bedPosition: req.authUser?.roomBed || "Bed 1",
      currentBill: null,
      contract: null,
      activeMaintenance: [],
      hasActiveMaintenance: false,
      hasPendingBill: false,
    };

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

    const contextSnapshot = (await resolveTenantAIContext(userId, req.authUser)) || {
      tenantName: req.authUser?.firstName ? `${req.authUser.firstName} ${req.authUser.lastName || ""}`.trim() : "Resident",
      branch: req.authUser?.branch?.includes("gil") ? "Gil Puyat" : "Guadalupe",
      roomNumber: req.authUser?.roomNumber || "304",
      bedPosition: req.authUser?.roomBed || "Bed 1",
      currentBill: null,
      contract: null,
      activeMaintenance: [],
      hasActiveMaintenance: false,
      hasPendingBill: false,
    };

    const branch = contextSnapshot.branchRaw || contextSnapshot.branch || "guadalupe";
    
    let conversation = await ChatConversation.findOne({
      participant_ids: userId,
      status: { $in: ["open", "pending"] },
      branch
    });

    if (!conversation) {
      conversation = new ChatConversation({
        participant_ids: [userId],
        branch,
        category: category || "general",
        status: "pending",
        priority,
      });
      await conversation.save();
    }

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
Active Tickets: ${contextSnapshot.activeMaintenance.length}`;

    const newMsg = new ChatMessage({
      conversation_id: conversation._id,
      sender_id: userId,
      sender_type: "user",
      content: initialMessageContent,
      message_type: "text"
    });
    
    await newMsg.save();

    conversation.last_message_id = newMsg._id;
    conversation.updated_at = new Date();
    await conversation.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`branch_${branch}`).emit("chat:message-new", {
        conversationId: conversation._id,
        message: newMsg,
      });
    }

    let assignedAdminName = "Pending Support Team";
    if (conversation.assigned_admin_id) {
       assignedAdminName = "Support Agent";
    }

    return res.status(200).json({
      success: true,
      data: {
        conversationId: conversation._id,
        status: conversation.status,
        assignedAdminName,
        redirectUrl: "/applicant/chat"
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

