/**
 * =============================================================================
 * CHATBOT API - Public Visitor & Applicant AI Digital Receptionist
 * =============================================================================
 *
 * Public HTTP client methods for communicating with the Lilycrest AI Chatbot.
 * Routes through the public rate-limited backend endpoints:
 *   - POST /api/chatbot/public/query
 *   - POST /api/chatbot/public/lead-escalation
 *
 * =============================================================================
 */

import { publicFetch } from "./httpClient.js";

/**
 * Query the public conversational AI receptionist.
 *
 * @param {Object} payload
 * @param {string} payload.message - User query text
 * @param {Array<{role: string, text: string}>} [payload.conversationHistory=[]] - Previous conversation turns
 * @param {string} [payload.branchFocus] - Optional branch filter ("gil_puyat" | "guadalupe" | "all")
 * @returns {Promise<{reply: string, suggestedActions?: Array<{label: string, url?: string, action?: string, prompt?: string}>, canEscalate?: boolean}>}
 */
export const queryPublicChatbot = async ({ message, conversationHistory = [], branchFocus = "all" }) => {
  return publicFetch("/chatbot/public/query", {
    method: "POST",
    body: JSON.stringify({
      message: message?.trim() || "",
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
      branchFocus,
    }),
  });
};

/**
 * Escalate an unresolved chatbot conversation to the Admin Inquiry lead pipeline.
 *
 * @param {Object} leadData
 * @param {string} leadData.name - Full name of the prospective tenant
 * @param {string} leadData.email - Contact email
 * @param {string} leadData.phone - Contact phone number
 * @param {string} leadData.preferredBranch - "gil_puyat" | "guadalupe" | "any"
 * @param {string} [leadData.preferredRoomType] - Room type preference
 * @param {string} [leadData.message] - Inquiry notes or question context
 * @param {string} [leadData.source="chatbot_public"] - Tracking source
 * @returns {Promise<{inquiryId: string, message: string}>}
 */
export const escalateChatbotLead = async (leadData) => {
  return publicFetch("/chatbot/public/lead-escalation", {
    method: "POST",
    body: JSON.stringify({
      name: leadData.name?.trim(),
      email: leadData.email?.trim(),
      phone: leadData.phone?.trim(),
      preferredBranch: leadData.preferredBranch || "any",
      preferredRoomType: leadData.preferredRoomType || "undecided",
      message: leadData.message?.trim() || "",
      source: leadData.source || "chatbot_public",
    }),
  });
};

export const chatbotApi = {
  queryPublicChatbot,
  escalateChatbotLead,
};

export default chatbotApi;
