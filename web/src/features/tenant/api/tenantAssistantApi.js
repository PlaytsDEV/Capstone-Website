/**
 * =============================================================================
 * TENANT ASSISTANT API - Context-Aware Resident AI Assistant Client
 * =============================================================================
 *
 * Provides HTTP REST and SSE streaming methods for communicating with the
 * authenticated Lilycrest Tenant Assistant. Grounded on real-time resident
 * stay data, submetered utility shares, lease contract dates, and maintenance
 * tickets.
 *
 * Endpoints:
 *   - POST /api/chatbot/tenant/query (standard REST query)
 *   - POST /api/chatbot/tenant/stream (SSE token streaming + rich snapshot cards)
 *   - POST /api/chatbot/tenant/escalate (escalation to branch admin)
 *
 * =============================================================================
 */

import { authFetch, getFreshToken } from "../../../shared/api/httpClient";
import { API_BASE_URL } from "../../../shared/api/baseUrl";

/**
 * Send a non-streaming conversational query to the Tenant Assistant.
 *
 * @param {string} message - Tenant query text
 * @param {Array<{role: string, content?: string, text?: string}>} [conversationHistory=[]]
 * @returns {Promise<{reply: string, contextSnapshot?: Object, widget?: Object|string|null, suggestedActions?: Array<string|Object>, canEscalate?: boolean}>}
 */
export const queryTenantAssistant = async (message, conversationHistory = []) => {
  const formattedHistory = Array.isArray(conversationHistory)
    ? conversationHistory.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        content: msg.content || msg.text || "",
      }))
    : [];

  return authFetch("/chatbot/tenant/query", {
    method: "POST",
    body: JSON.stringify({
      message: message?.trim() || "",
      conversationHistory: formattedHistory,
    }),
  });
};

/**
 * Stream real-time tokens and rich snapshot widgets from the Tenant Assistant via SSE.
 *
 * @param {Object} options
 * @param {string} options.message - User prompt text
 * @param {Array<{role: string, content?: string, text?: string}>} [options.conversationHistory=[]]
 * @param {(token: string, accumulated: string) => void} [options.onToken] - Invoked on each text chunk
 * @param {(widget: Object|string) => void} [options.onWidget] - Invoked when a rich widget is detected
 * @param {(actions: Array<string|Object>) => void} [options.onActions] - Invoked when suggested actions arrive
 * @param {(result: { text: string, widget: Object|string|null, actions: Array<string|Object>|null, contextSnapshot: Object|null }) => void} [options.onDone]
 * @param {(error: Error) => void} [options.onError]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{text: string, widget: Object|string|null, actions: Array<string|Object>|null, contextSnapshot: Object|null}>}
 */
export const streamTenantAssistant = async ({
  message,
  conversationHistory = [],
  onToken,
  onWidget,
  onActions,
  onDone,
  onError,
  signal,
}) => {
  let accumulatedText = "";
  let emittedWidget = null;
  let emittedActions = null;
  let emittedContextSnapshot = null;

  try {
    const token = await getFreshToken();
    if (!token) {
      throw new Error("Authentication token is unavailable. Please log in again.");
    }

    const formattedHistory = Array.isArray(conversationHistory)
      ? conversationHistory.map((msg) => ({
          role: msg.role === "user" ? "user" : "model",
          content: msg.content || msg.text || "",
        }))
      : [];

    const response = await fetch(`${API_BASE_URL}/chatbot/tenant/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: message?.trim() || "",
        conversationHistory: formattedHistory,
      }),
      signal,
    });

    if (!response.ok) {
      let errPayload;
      try {
        errPayload = await response.json();
      } catch {
        errPayload = { message: response.statusText || "Streaming request failed" };
      }
      const err = new Error(
        errPayload?.message || errPayload?.error || `HTTP ${response.status}: Failed to stream assistant response`,
      );
      if (onError) onError(err);
      throw err;
    }

    if (!response.body) {
      throw new Error("ReadableStream not supported or empty response body received.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const handlePayload = (payload) => {
      if (!payload || typeof payload !== "object") return;

      // Handle type-based SSE events: { type: "token", text: "..." }
      const eventType = payload.type || payload.event;

      if (eventType === "token" || payload.token !== undefined || payload.delta !== undefined) {
        const textToken = payload.text ?? payload.token ?? payload.delta ?? payload.data ?? "";
        if (textToken) {
          accumulatedText += textToken;
          if (onToken) onToken(textToken, accumulatedText);
        }
      }

      if (eventType === "widget" || payload.widget !== undefined || payload.richWidgets !== undefined) {
        const w = payload.widget ?? payload.data?.widget ?? payload.data ?? payload.richWidgets;
        if (w) {
          emittedWidget = w;
          if (onWidget) onWidget(w);
        }
      }

      if (eventType === "actions" || payload.actions !== undefined || payload.suggestedActions !== undefined) {
        const acts = payload.actions ?? payload.suggestedActions ?? payload.data?.actions ?? payload.data;
        if (acts) {
          emittedActions = acts;
          if (onActions) onActions(acts);
        }
      }

      if (payload.contextSnapshot) {
        emittedContextSnapshot = payload.contextSnapshot;
      }

      if (eventType === "done") {
        if (payload.contextSnapshot) {
          emittedContextSnapshot = payload.contextSnapshot;
        }
        if (payload.fullReply && !accumulatedText) {
          accumulatedText = payload.fullReply;
        }
      }

      if (eventType === "error") {
        const errMsg = payload.message || payload.error || "Streaming failed";
        const streamErr = new Error(errMsg);
        if (onError) onError(streamErr);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;

        if (trimmed.startsWith("data:")) {
          const jsonString = trimmed.replace(/^data:\s*/, "").trim();
          if (jsonString === "[DONE]") {
            const finalResult = {
              text: accumulatedText,
              widget: emittedWidget,
              actions: emittedActions,
              contextSnapshot: emittedContextSnapshot,
            };
            if (onDone) onDone(finalResult);
            return finalResult;
          }

          try {
            const data = JSON.parse(jsonString);
            handlePayload(data);
          } catch (parseErr) {
            console.warn("Unable to parse tenant SSE chunk:", jsonString, parseErr);
          }
        }
      }
    }

    // Flush any remaining buffer
    if (buffer.trim().startsWith("data:")) {
      try {
        const jsonString = buffer.trim().replace(/^data:\s*/, "").trim();
        if (jsonString !== "[DONE]") {
          const data = JSON.parse(jsonString);
          handlePayload(data);
        }
      } catch {
        // Ignore partial parse
      }
    }

    const finalResult = {
      text: accumulatedText,
      widget: emittedWidget,
      actions: emittedActions,
      contextSnapshot: emittedContextSnapshot,
    };
    if (onDone) onDone(finalResult);
    return finalResult;
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        text: accumulatedText,
        widget: emittedWidget,
        actions: emittedActions,
        contextSnapshot: emittedContextSnapshot,
        aborted: true,
      };
    }
    if (onError) onError(error);
    throw error;
  }
};

/**
 * Escalate conversation to branch administrators.
 *
 * @param {Object} payload
 * @param {string} payload.category - Concern category (e.g. "billing", "contract", "maintenance")
 * @param {string} [payload.priority="medium"] - Priority tier ("low" | "medium" | "high" | "urgent")
 * @param {string} payload.summary - Tenant explanation / concern summary
 * @param {string} [payload.lastBotMessage] - Last assistant reply
 * @returns {Promise<{conversationId?: string, redirectUrl?: string, message: string}>}
 */
export const escalateTenantAssistant = async ({
  category,
  priority = "medium",
  summary,
  lastBotMessage = "",
}) => {
  return authFetch("/chatbot/tenant/escalate", {
    method: "POST",
    body: JSON.stringify({
      category: category || "General Inquiry",
      priority: priority || "medium",
      summary: summary?.trim() || "",
      lastBotMessage: lastBotMessage?.trim() || "",
    }),
  });
};

export const tenantAssistantApi = {
  queryTenantAssistant,
  streamTenantAssistant,
  escalateTenantAssistant,
};

export default tenantAssistantApi;
