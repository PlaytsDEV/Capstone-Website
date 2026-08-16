import React from "react";
import { Bot } from "lucide-react";

/**
 * ChatTypingIndicator
 *
 * Minimalist 3-dot pulse animation inside an assistant bubble.
 * Adheres strictly to solid HSL tokens, 1px border, and zero gradients.
 */
export function ChatTypingIndicator() {
  return (
    <div
      className="flex items-start gap-2.5 my-2 animate-fadeIn"
      role="status"
      aria-live="polite"
      aria-label="Lilycrest AI is formulating a response"
    >
      {/* Bot Icon Badge */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white select-none"
        style={{
          backgroundColor: "var(--lp-navy, #0A1628)",
          border: "1px solid var(--lp-accent, #D4AF37)",
        }}
        aria-hidden="true"
      >
        <Bot className="w-3.5 h-3.5" style={{ color: "var(--lp-accent, #D4AF37)" }} />
      </div>

      {/* Bubble with 3 pulsing dots */}
      <div
        className="inline-flex items-center gap-1.5 py-2.5 px-3.5 rounded-2xl rounded-tl-sm text-sm"
        style={{
          backgroundColor: "var(--lp-bg-card, #ffffff)",
          border: "1px solid var(--lp-border, #E6D9B2)",
          color: "var(--lp-text-muted, #475569)",
        }}
      >
        <span
          className="w-2 h-2 rounded-full animate-bounce"
          style={{
            backgroundColor: "var(--lp-accent, #D4AF37)",
            animationDelay: "0ms",
            animationDuration: "1000ms",
          }}
        />
        <span
          className="w-2 h-2 rounded-full animate-bounce"
          style={{
            backgroundColor: "var(--lp-navy, #0A1628)",
            animationDelay: "200ms",
            animationDuration: "1000ms",
          }}
        />
        <span
          className="w-2 h-2 rounded-full animate-bounce"
          style={{
            backgroundColor: "var(--lp-accent, #D4AF37)",
            animationDelay: "400ms",
            animationDuration: "1000ms",
          }}
        />
        <span className="text-xs font-medium ml-1.5 select-none" style={{ color: "var(--lp-text-muted, #64748B)" }}>
          Checking dormitory info...
        </span>
      </div>
    </div>
  );
}

export default ChatTypingIndicator;
