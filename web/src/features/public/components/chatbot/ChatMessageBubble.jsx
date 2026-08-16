import React from "react";
import { useNavigate } from "react-router-dom";
import { Bot, User, ArrowUpRight, Calendar, HelpCircle, ExternalLink } from "lucide-react";

/**
 * Format timestamp into standard readable time (e.g. 10:24 AM)
 */
function formatTime(dateOrIso) {
  if (!dateOrIso) return "";
  try {
    const d = typeof dateOrIso === "string" || typeof dateOrIso === "number" ? new Date(dateOrIso) : dateOrIso;
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * Lightweight safe markdown renderer for bold, lists, and inline links.
 */
function renderFormattedText(text = "") {
  if (!text) return null;

  // Split into paragraph blocks
  const paragraphs = text.split(/\n{2,}/);

  return paragraphs.map((para, pIdx) => {
    const lines = para.split("\n").map((line) => line.trim()).filter(Boolean);

    // Check if lines are a bullet list
    const isBulletList = lines.length > 0 && lines.every((line) => line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• "));
    // Check if lines are a numbered list
    const isNumberedList = lines.length > 0 && lines.every((line) => /^\d+\.\s/.test(line));

    if (isBulletList) {
      return (
        <ul key={pIdx} className="list-disc pl-5 my-1.5 space-y-1">
          {lines.map((line, lIdx) => {
            const content = line.replace(/^[-*•]\s+/, "");
            return <li key={lIdx} className="leading-relaxed">{parseInlineMarkdown(content)}</li>;
          })}
        </ul>
      );
    }

    if (isNumberedList) {
      return (
        <ol key={pIdx} className="list-decimal pl-5 my-1.5 space-y-1">
          {lines.map((line, lIdx) => {
            const content = line.replace(/^\d+\.\s+/, "");
            return <li key={lIdx} className="leading-relaxed">{parseInlineMarkdown(content)}</li>;
          })}
        </ol>
      );
    }

    // Normal paragraph with line breaks
    return (
      <p key={pIdx} className={pIdx > 0 ? "mt-2 leading-relaxed" : "leading-relaxed"}>
        {lines.map((line, lIdx) => (
          <React.Fragment key={lIdx}>
            {parseInlineMarkdown(line)}
            {lIdx < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

/**
 * Parse inline **bold**, *italic*, and [link](url)
 */
function parseInlineMarkdown(text) {
  if (!text) return "";

  // Regular expression to match bold **text** and markdown links [text](url)
  const regex = /(\*\*.*?\*\*|\[.*?\]\(.*?\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Bold **text**
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold" style={{ color: "inherit" }}>
          {boldText}
        </strong>
      );
    }

    // Link [label](url)
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isInternal = href.startsWith("/");
      return (
        <a
          key={index}
          href={href}
          target={isInternal ? undefined : "_blank"}
          rel={isInternal ? undefined : "noopener noreferrer"}
          className="underline font-medium hover:opacity-80 transition-opacity"
          style={{ color: "var(--lp-accent, #D4AF37)" }}
        >
          {label}
        </a>
      );
    }

    return part;
  });
}

/**
 * ChatMessageBubble
 *
 * Renders individual chat messages for both User and AI Receptionist.
 */
export function ChatMessageBubble({
  message,
  onSelectPrompt,
  onOpenEscalation,
  onRetry,
}) {
  const navigate = useNavigate();
  const isUser = message.role === "user";
  const isError = Boolean(message.isError);

  const handleActionClick = (action) => {
    if (action.url) {
      if (action.url.startsWith("/")) {
        navigate(action.url);
      } else {
        window.open(action.url, "_blank", "noopener,noreferrer");
      }
    } else if (
      action.action === "open_viewing_form" ||
      action.action === "open_escalation_form" ||
      action.action === "escalate"
    ) {
      if (onOpenEscalation) onOpenEscalation(action);
    } else if (action.prompt && onSelectPrompt) {
      onSelectPrompt(action.prompt);
    }
  };

  return (
    <div
      className={`flex flex-col my-2.5 ${
        isUser ? "items-end" : "items-start"
      }`}
      style={{
        animation: "bubbleSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      <style>{`
        @keyframes bubbleSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes chipPopIn {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      <div
        className={`flex items-start gap-2 max-w-[88%] ${
          isUser ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Avatar Icon */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold select-none shadow-xs transition-transform duration-200 hover:scale-110"
          style={{
            backgroundColor: isUser
              ? "var(--lp-navy, #0A1628)"
              : "var(--lp-navy, #0A1628)",
            border: isUser
              ? "1px solid var(--lp-border, #E6D9B2)"
              : "1px solid var(--lp-accent, #D4AF37)",
            color: isUser ? "#ffffff" : "var(--lp-accent, #D4AF37)",
          }}
          aria-hidden="true"
        >
          {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
        </div>

        {/* Message Bubble */}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm shadow-sm transition-all ${
            isUser
              ? "rounded-tr-xs text-white"
              : "rounded-tl-xs"
          }`}
          style={{
            backgroundColor: isUser
              ? "var(--lp-navy, #0A1628)"
              : isError
              ? "#fef2f2"
              : "var(--lp-bg-card, #ffffff)",
            border: isUser
              ? "1px solid #1a2c4e"
              : isError
              ? "1px solid #fecaca"
              : "1px solid var(--lp-border, #E6D9B2)",
            color: isUser
              ? "#ffffff"
              : isError
              ? "#991b1b"
              : "var(--lp-text, #162f53)",
          }}
        >
          {renderFormattedText(message.text)}

          {/* Action Chips */}
          {!isUser && Array.isArray(message.suggestedActions) && message.suggestedActions.length > 0 && (
            <div className="mt-3 pt-2.5 border-t flex flex-wrap gap-1.5" style={{ borderColor: "var(--lp-border, #E6D9B2)" }}>
              {message.suggestedActions.map((action, idx) => {
                const isFormAction =
                  action.action === "open_viewing_form" ||
                  action.action === "open_escalation_form" ||
                  action.action === "escalate";
                const isNavAction = Boolean(action.url);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleActionClick(action)}
                    className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer shadow-xs focus:outline-none active:scale-95"
                    style={{
                      backgroundColor: isFormAction
                        ? "var(--lp-navy, #0A1628)"
                        : "var(--lp-icon-bg, rgba(212, 175, 55, 0.12))",
                      color: isFormAction ? "#ffffff" : "var(--lp-accent, #D4AF37)",
                      border: isFormAction
                        ? "1px solid var(--lp-accent, #D4AF37)"
                        : "1px solid var(--lp-border, #E6D9B2)",
                      animation: `chipPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 60}ms forwards`,
                      opacity: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-1.5px) scale(1.02)";
                      e.currentTarget.style.boxShadow = "0 3px 8px rgba(10, 22, 40, 0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0) scale(1)";
                      e.currentTarget.style.boxShadow = "";
                    }}
                  >
                    {isFormAction && <Calendar className="w-3 h-3 text-amber-400" />}
                    {isNavAction && <ArrowUpRight className="w-3 h-3" />}
                    {!isFormAction && !isNavAction && <HelpCircle className="w-3 h-3" />}
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Retry Button if Error */}
          {isError && onRetry && (
            <div className="mt-2 pt-2 border-t border-red-200 flex items-center justify-between">
              <span className="text-xs text-red-600">Connection error</span>
              <button
                type="button"
                onClick={onRetry}
                className="text-xs font-semibold text-red-700 underline hover:text-red-900 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <span
        className={`text-[10px] mt-1 px-1 font-medium select-none ${
          isUser ? "text-right pr-9" : "text-left pl-9"
        }`}
        style={{ color: "var(--lp-text-muted, #94A3B8)" }}
      >
        {formatTime(message.timestamp || Date.now())}
      </span>
    </div>
  );
}

export default ChatMessageBubble;
