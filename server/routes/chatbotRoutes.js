import express from "express";
import rateLimit from "express-rate-limit";
import { handlePublicQuery, handleLeadEscalation } from "../controllers/chatbotController.js";

const router = express.Router();

const chatbotQueryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // 15 req/min
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
  max: 5, // 5 req/15min
  message: {
    success: false,
    message: "Too many lead escalations from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development",
});

router.post("/public/query", chatbotQueryLimiter, handlePublicQuery);
router.post("/public/lead-escalation", chatbotEscalationLimiter, handleLeadEscalation);

export default router;
