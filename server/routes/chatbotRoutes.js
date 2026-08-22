import express from "express";
import rateLimit from "express-rate-limit";
import { verifyToken } from "../middleware/auth.js";
import {
  handlePublicQuery,
  handlePublicStream,
  handleLeadEscalation,
  handleParseLead,
  handleAdminSopQuery,
  handleAdminSuggestReply,
  handleAdminIssueClusters,
  handleOwnerSupportTrends,
  handleAdminDailyBriefing,
  handleAdminDynamicSuggestions,
} from "../controllers/chatbotController.js";
import {
  handleTenantQuery,
  handleTenantStream,
  handleTenantEscalation,
  handleTenantContext,
} from "../controllers/tenantChatbotController.js";
import { verifyAdmin, verifyOwner } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";

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
router.post("/public/parse-lead", chatbotQueryLimiter, handleParseLead);
router.post("/public/lead-escalation", chatbotEscalationLimiter, handleLeadEscalation);

router.get("/tenant/context", verifyToken, handleTenantContext);
router.post("/tenant/query", verifyToken, tenantChatbotQueryLimiter, handleTenantQuery);
router.post("/tenant/stream", verifyToken, tenantChatbotQueryLimiter, handleTenantStream);
router.post("/tenant/escalate", verifyToken, tenantEscalationLimiter, handleTenantEscalation);

// Phase 3 Admin & Owner Routes
router.post("/admin/sop-query", verifyToken, verifyAdmin, filterByBranch, chatbotQueryLimiter, handleAdminSopQuery);
router.post("/admin/suggest-reply", verifyToken, verifyAdmin, filterByBranch, chatbotQueryLimiter, handleAdminSuggestReply);
router.get("/admin/issue-clusters", verifyToken, verifyAdmin, filterByBranch, chatbotQueryLimiter, handleAdminIssueClusters);
router.get("/admin/daily-briefing", verifyToken, verifyAdmin, filterByBranch, chatbotQueryLimiter, handleAdminDailyBriefing);
router.get("/admin/dynamic-suggestions", verifyToken, verifyAdmin, filterByBranch, chatbotQueryLimiter, handleAdminDynamicSuggestions);

router.get("/owner/support-trends", verifyToken, verifyOwner, chatbotQueryLimiter, handleOwnerSupportTrends);

export default router;
