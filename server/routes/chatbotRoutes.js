import express from "express";
import rateLimit from "express-rate-limit";
import { verifyToken } from "../middleware/auth.js";
import {
  handlePublicQuery,
  handlePublicStream,
  handleLeadEscalation,
} from "../controllers/chatbotController.js";
import {
  handleTenantQuery,
  handleTenantStream,
  handleTenantEscalation,
} from "../controllers/tenantChatbotController.js";

const router = express.Router();

const chatbotQueryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 req/min for interactive querying & streaming
  message: {
    success: false,
    message: "Too many chatbot queries from this IP, please try again after a minute.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development",
});

const chatbotEscalationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 req/15min
  message: {
    success: false,
    message: "Too many lead escalations from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development",
});

const tenantChatbotQueryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: "Too many queries from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development",
});

const tenantEscalationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many escalations from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development",
});

router.post("/public/query", chatbotQueryLimiter, handlePublicQuery);
router.post("/public/stream", chatbotQueryLimiter, handlePublicStream);
router.post("/public/lead-escalation", chatbotEscalationLimiter, handleLeadEscalation);

router.post("/tenant/query", verifyToken, tenantChatbotQueryLimiter, handleTenantQuery);
router.post("/tenant/stream", verifyToken, tenantChatbotQueryLimiter, handleTenantStream);
router.post("/tenant/escalate", verifyToken, tenantEscalationLimiter, handleTenantEscalation);

export default router;
