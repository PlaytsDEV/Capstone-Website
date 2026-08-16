import React, { useRef, useEffect } from "react";
import ChatMessageBubble from "./ChatMessageBubble";
import ChatTypingIndicator from "./ChatTypingIndicator";
import ChatQuickPrompts from "./ChatQuickPrompts";

/**
 * ChatMessageList
 *
 * Auto-scrolling scrollable container for chat bubbles and interactive prompt chips.
 */
export function ChatMessageList({
  messages = [],
  isTyping = false,
  showQuickPrompts = true,
  onSelectPrompt,
  onOpenEscalation,
  onRetryLastMessage,
}) {
  const scrollRef = useRef(null);
  const bottomAnchorRef = useRef(null);

  // Auto-scroll to bottom whenever messages change or typing status triggers
  useEffect(() => {
    if (bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, showQuickPrompts]);

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-label="Chat conversation history"
      className="flex-1 overflow-y-auto px-3 py-3 space-y-2 overscroll-contain"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "var(--lp-border, #E6D9B2) transparent",
      }}
    >
      {/* Date Divider */}
      <div className="flex items-center justify-center my-1 select-none">
        <span
          className="text-[10px] uppercase font-semibold px-2.5 py-0.5 rounded-full"
          style={{
            backgroundColor: "var(--lp-icon-bg, rgba(212, 175, 55, 0.1))",
            color: "var(--lp-text-muted, #64748B)",
            border: "1px solid var(--lp-border, #E6D9B2)",
          }}
        >
          Today
        </span>
      </div>

      {/* Message Bubbles */}
      {messages.map((msg) => (
        <ChatMessageBubble
          key={msg.id || msg.timestamp}
          message={msg}
          onSelectPrompt={onSelectPrompt}
          onOpenEscalation={onOpenEscalation}
          onRetry={onRetryLastMessage}
        />
      ))}

      {/* Typing Indicator */}
      {isTyping && <ChatTypingIndicator />}

      {/* Quick Prompts below initial messages */}
      {showQuickPrompts && !isTyping && (
        <div className="mt-3 pt-2 border-t" style={{ borderColor: "var(--lp-border, #E6D9B2)" }}>
          <ChatQuickPrompts onSelectPrompt={onSelectPrompt} disabled={isTyping} />
        </div>
      )}

      {/* Scroll Anchor */}
      <div ref={bottomAnchorRef} style={{ height: "1px" }} />
    </div>
  );
}

export default ChatMessageList;
