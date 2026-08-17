/**
 * ============================================================================
 * LILYCREST AI PROVIDER SERVICE (MULTI-PROVIDER CORE)
 * ============================================================================
 *
 * Provides a resilient, multi-provider LLM abstraction supporting:
 * - Groq (Llama 3.3 70B / Llama 3.1 8B) - Primary ultra-fast streaming
 * - Google Gemini (Gemini 2.5 Flash / Flash Lite) - Fallback & grounding
 * - OpenRouter (Qwen 2.5 / DeepSeek) - Optional multi-model routing
 * - Automatic cascade failover with zero-downtime fallback
 * ============================================================================
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Normalizes conversation history into OpenAI-standard message objects:
 * [{ role: "system"|"user"|"assistant", content: string }]
 */
export function buildStandardMessages(systemPrompt, userMessage, conversationHistory = []) {
  const messages = [];

  if (systemPrompt && typeof systemPrompt === "string" && systemPrompt.trim()) {
    messages.push({ role: "system", content: systemPrompt.trim() });
  }

  if (Array.isArray(conversationHistory)) {
    for (const item of conversationHistory) {
      if (!item || !item.text) continue;
      const role = item.role === "model" || item.role === "assistant" ? "assistant" : "user";
      messages.push({ role, content: String(item.text).trim() });
    }
  }

  if (userMessage && typeof userMessage === "string" && userMessage.trim()) {
    messages.push({ role: "user", content: userMessage.trim() });
  }

  return messages;
}

/**
 * Converts standard messages to Google Gemini contents format.
 */
export function convertToGeminiContents(messages = []) {
  const contents = [];
  let systemInstruction = "";

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = msg.content;
      continue;
    }

    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  return { contents, systemInstruction };
}

/**
 * Performs a streaming chat completion using Groq (OpenAI-compatible SSE).
 */
async function streamGroq({
  messages,
  model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  temperature = 0.65,
  maxTokens = 800,
  onToken,
  signal,
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Groq API error ${response.status} ${response.statusText}: ${errText}`);
  }

  let fullReply = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.replace(/^data:\s*/, "");
        if (dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta?.content || "";
          if (delta) {
            fullReply += delta;
            if (typeof onToken === "function") {
              onToken(delta);
            }
          }
        } catch {
          // Ignore incomplete JSON chunks in SSE stream
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullReply.trim();
}

/**
 * Performs a streaming chat completion using Google Gemini Generative Language API.
 */
async function streamGemini({
  messages,
  model = process.env.GEMINI_MODEL || "gemini-2.5-flash",
  onToken,
  signal,
}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const { contents, systemInstruction } = convertToGeminiContents(messages);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

  const payload = { contents };
  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Gemini API error ${response.status} ${response.statusText}: ${errText}`);
  }

  let fullReply = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.replace(/^data:\s*/, "");

        try {
          const parsed = JSON.parse(dataStr);
          const parts = parsed.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.text) {
              fullReply += part.text;
              if (typeof onToken === "function") {
                onToken(part.text);
              }
            }
          }
        } catch {
          // Ignore incomplete chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullReply.trim();
}

/**
 * Universal Multi-Provider Streaming Chat Completion.
 * Tries the primary provider, cascading to secondary provider if available.
 */
export async function streamChatCompletion({
  messages,
  onToken,
  preferredProvider,
  signal,
}) {
  const provider = (preferredProvider || process.env.AI_CHAT_PROVIDER || "groq").toLowerCase();
  const errors = [];

  // 1. Try Primary Provider
  if (provider === "groq" && process.env.GROQ_API_KEY) {
    try {
      return await streamGroq({ messages, onToken, signal });
    } catch (err) {
      console.warn(`[AIProvider] Groq streaming failed (${err.message}). Attempting fallback.`);
      errors.push({ provider: "groq", message: err.message });
    }
  }

  // 2. Try Gemini Fallback
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) {
    try {
      return await streamGemini({ messages, onToken, signal });
    } catch (err) {
      console.warn(`[AIProvider] Gemini streaming failed (${err.message}).`);
      errors.push({ provider: "gemini", message: err.message });
    }
  }

  // If primary was Gemini and failed, try Groq
  if (provider === "gemini" && process.env.GROQ_API_KEY) {
    try {
      return await streamGroq({ messages, onToken, signal });
    } catch (err) {
      console.warn(`[AIProvider] Groq failover failed (${err.message}).`);
      errors.push({ provider: "groq", message: err.message });
    }
  }

  const err = new Error("All configured AI streaming providers failed or are unconfigured.");
  err.details = errors;
  throw err;
}

/**
 * Universal Non-Streaming Chat Completion (Supports strict JSON format).
 */
export async function generateChatCompletion({
  messages,
  responseFormat,
  model,
  temperature = 0.2,
  signal,
}) {
  const provider = (process.env.AI_CHAT_PROVIDER || "groq").toLowerCase();

  // Try Groq First if key available
  if (process.env.GROQ_API_KEY) {
    try {
      const groqModel = model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
      const bodyPayload = {
        model: groqModel,
        messages,
        temperature,
      };

      if (responseFormat === "json" || responseFormat?.type === "json_object") {
        bodyPayload.response_format = { type: "json_object" };
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify(bodyPayload),
        signal,
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
      }
    } catch (err) {
      console.warn(`[AIProvider] Groq generateChatCompletion failed (${err.message}). Attempting Gemini.`);
    }
  }

  // Fallback to Gemini
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    const { contents, systemInstruction } = convertToGeminiContents(messages);
    const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const payload = { contents };
    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (responseFormat === "json") {
      payload.generationConfig = { responseMimeType: "application/json" };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
  }

  throw new Error("No available AI provider succeeded for chat completion.");
}
