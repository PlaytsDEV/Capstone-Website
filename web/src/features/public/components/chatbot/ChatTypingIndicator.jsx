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
      className="flex items-start gap-2.5 my-2"
      role="status"
      aria-live="polite"
      aria-label="Lilycrest AI is formulating a response"
      style={{
        animation: "typingBubbleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      <style>{`
        @keyframes typingBubbleIn {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes waveDotBounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
      `}</style>

      {/* Bot Icon Badge */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white select-none shadow-xs"
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
        className="inline-flex items-center gap-1.5 py-2 px-3 rounded-2xl rounded-tl-xs text-xs shadow-xs"
        style={{
          backgroundColor: "var(--lp-bg-card, #ffffff)",
          border: "1px solid var(--lp-border, #E6D9B2)",
          color: "var(--lp-text-muted, #475569)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: "var(--lp-accent, #D4AF37)",
            animation: "waveDotBounce 1.2s ease-in-out 0ms infinite",
          }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: "var(--lp-navy, #0A1628)",
            animation: "waveDotBounce 1.2s ease-in-out 200ms infinite",
          }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: "var(--lp-accent, #D4AF37)",
            animation: "waveDotBounce 1.2s ease-in-out 400ms infinite",
          }}
        />
        <span className="text-[11px] font-medium ml-1 select-none" style={{ color: "var(--lp-text-muted, #64748B)" }}>
          Formulating response...
        </span>
      </div>
    </div>
  );
}

export default ChatTypingIndicator;
