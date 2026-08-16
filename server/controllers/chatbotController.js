/**
 * ============================================================================
 * LILYCREST PUBLIC AI CHATBOT CONTROLLER
 * ============================================================================
 *
 * Handles public visitor inquiries, real-time SSE streaming responses, and
 * lead escalation to the admin inquiry intake pipeline.
 * ============================================================================
 */

import { z } from "zod";
import {
  queryGeminiChatbot,
  streamGeminiChatbot,
} from "../services/chatbot/chatbotService.js";
import {
  streamTenantAssistant as streamTenantAssistantService,
  queryTenantAssistantService,
  escalateTenantAssistantService,
} from "../services/chatbot/tenantAssistantService.js";
import Inquiry from "../models/Inquiry.js";

const querySchema = z.object({
  message: z.string().min(1, "Message is required").max(1000).trim(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().min(1).max(2000),
      }),
    )
    .max(50, "Conversation history is too long")
    .default([]),
  branchFocus: z.enum(["all", "gil_puyat", "guadalupe"]).default("all").optional(),
});

const escalationSchema = z.object({
  name: z.string().min(1, "Name is required").max(150).trim(),
  email: z
    .string()
    .email("Invalid email format")
    .min(1, "Email is required")
    .trim()
    .toLowerCase(),
  phone: z.string().min(1, "Phone number is required").max(20).trim(),
  preferredBranch: z.enum(["gil_puyat", "guadalupe", "any", "all"]).nullable().optional(),
  message: z.string().min(1, "Message is required").max(5000).trim(),
  preferredRoomType: z
    .string()
    .max(100)
    .nullable()
    .optional(),
  concernCategory: z.string().max(100).optional(),
  source: z.string().max(100).default("chatbot_front_desk_request").optional(),
});

const tenantEscalationSchema = z.object({
  category: z.string().max(100).default("General Inquiry"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  summary: z.string().min(1, "Summary is required").max(2000).trim(),
  lastBotMessage: z.string().max(2000).optional(),
});

/**
 * Standard REST query endpoint for public chatbot responses.
 */
export const handlePublicQuery = async (req, res, next) => {
  try {
    const { message, conversationHistory, branchFocus } = querySchema.parse(req.body);
    const data = await queryGeminiChatbot(message, conversationHistory, branchFocus || "all");
    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues ? error.issues[0].message : "Validation Error",
      });
    }
    next(error);
  }
};

/**
 * Server-Sent Events (SSE) streaming endpoint for real-time token delivery and rich widgets.
 */
export const handlePublicStream = async (req, res, next) => {
  let validatedData;
  try {
    validatedData = querySchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues ? error.issues[0].message : "Validation Error",
      });
    }
    return next(error);
  }

  // Set SSE streaming headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const abortController = new AbortController();
  req.on("close", () => {
    abortController.abort();
  });

  const sendEvent = (event, payload) => {
    if (res.writableEnded || res.closed) return;
    res.write(`data: ${JSON.stringify({ event, ...payload })}\n\n`);
  };

  try {
    await streamGeminiChatbot({
      message: validatedData.message,
      conversationHistory: validatedData.conversationHistory,
      branchFocus: validatedData.branchFocus || "all",
      signal: abortController.signal,
      onToken: (token) => {
        sendEvent("token", { data: token, token, text: token });
      },
      onWidget: (widget) => {
        sendEvent("widget", { data: widget, widget, richWidgets: [widget] });
      },
      onActions: (actions) => {
        sendEvent("actions", { data: actions, actions, suggestedActions: actions });
      },
      onDone: (result) => {
        sendEvent("done", { data: result, done: true, ...(result || {}) });
        if (!res.writableEnded) {
          res.end();
        }
      },
      onError: (err) => {
        const errorMsg = err?.message || "Streaming failed";
        sendEvent("error", { error: errorMsg, message: errorMsg, data: { error: errorMsg } });
        if (!res.writableEnded) {
          res.end();
        }
      },
    });
  } catch (streamError) {
    if (!res.writableEnded) {
      const errorMsg = streamError?.message || "Streaming failed";
      sendEvent("error", { error: errorMsg, message: errorMsg, data: { error: errorMsg } });
      res.end();
    }
  }
};

/**
 * Lead escalation endpoint for transferring chatbot conversations to the admin inquiry queue.
 */
export const handleLeadEscalation = async (req, res, next) => {
  try {
    const validatedData = escalationSchema.parse(req.body);

    const newInquiry = new Inquiry({
      fullName: validatedData.name,
      email: validatedData.email,
      contactNumber: validatedData.phone,
      preferredBranch:
        validatedData.preferredBranch &&
        validatedData.preferredBranch !== "any" &&
        validatedData.preferredBranch !== "all"
          ? validatedData.preferredBranch
          : null,
      message: validatedData.message,
      preferredRoomType:
        validatedData.preferredRoomType && validatedData.preferredRoomType !== "undecided"
          ? validatedData.preferredRoomType
          : null,
      source: "website",
      sourceNote: validatedData.source || "chatbot_front_desk_request",
      viewingStatus: "new",
      priority: "medium",
    });

    await newInquiry.save();

    res.status(200).json({
      success: true,
      data: {
        inquiryId: newInquiry._id,
        message:
          "Your assistance request has been sent to our front desk admin team. We will contact you promptly.",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues ? error.issues[0].message : "Validation Error",
      });
    }
    next(error);
  }
};

/**
 * Tenant-authenticated REST query endpoint.
 */
export const handleTenantQuery = async (req, res, next) => {
  try {
    const { message, conversationHistory } = querySchema.parse(req.body);
    const userId = req.authUser?._id || req.user?.mongoId || req.user?.uid;
    const data = await queryTenantAssistantService({
      userId,
      message,
      conversationHistory,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues ? error.issues[0].message : "Validation Error",
      });
    }
    next(error);
  }
};

/**
 * Tenant-authenticated SSE streaming endpoint.
 */
export const handleTenantStream = async (req, res, next) => {
  let validatedData;
  try {
    validatedData = querySchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues ? error.issues[0].message : "Validation Error",
      });
    }
    return next(error);
  }

  const userId = req.authUser?._id || req.user?.mongoId || req.user?.uid;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const abortController = new AbortController();
  req.on("close", () => {
    abortController.abort();
  });

  const sendEvent = (event, payload) => {
    if (res.writableEnded || res.closed) return;
    res.write(`data: ${JSON.stringify({ event, ...payload })}\n\n`);
  };

  try {
    await streamTenantAssistantService({
      userId,
      message: validatedData.message,
      conversationHistory: validatedData.conversationHistory,
      signal: abortController.signal,
      onToken: (token) => {
        sendEvent("token", { data: token, token, text: token });
      },
      onWidget: (widget) => {
        sendEvent("widget", { data: widget, widget, richWidgets: [widget] });
      },
      onActions: (actions) => {
        sendEvent("actions", { data: actions, actions, suggestedActions: actions });
      },
      onDone: (result) => {
        sendEvent("done", { data: result, done: true, ...(result || {}) });
        if (!res.writableEnded) {
          res.end();
        }
      },
      onError: (err) => {
        const errorMsg = err?.message || "Streaming failed";
        sendEvent("error", { error: errorMsg, message: errorMsg, data: { error: errorMsg } });
        if (!res.writableEnded) {
          res.end();
        }
      },
    });
  } catch (streamError) {
    if (!res.writableEnded) {
      const errorMsg = streamError?.message || "Streaming failed";
      sendEvent("error", { error: errorMsg, message: errorMsg, data: { error: errorMsg } });
      res.end();
    }
  }
};

/**
 * Tenant escalation to branch admin.
 */
export const handleTenantEscalate = async (req, res, next) => {
  try {
    const validatedData = tenantEscalationSchema.parse(req.body);
    const userId = req.authUser?._id || req.user?.mongoId || req.user?.uid;
    const result = await escalateTenantAssistantService({
      userId,
      category: validatedData.category,
      priority: validatedData.priority,
      summary: validatedData.summary,
      lastBotMessage: validatedData.lastBotMessage,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues ? error.issues[0].message : "Validation Error",
      });
    }
    next(error);
  }
};

