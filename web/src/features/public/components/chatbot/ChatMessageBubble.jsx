import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  User,
  ArrowUpRight,
  Calendar,
  HelpCircle,
  Calculator,
  ShieldCheck,
  Bed,
  Headphones,
} from "lucide-react";
import {
  ChatRoomShowcaseCard,
  ChatViewingBookingCard,
  ChatBudgetEstimatorWidget,
  ChatKycChecklistWidget,
} from "./widgets";

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
 * Parse inline **bold**, *italic*, and [link](url)
 */
function parseInlineMarkdown(text) {
  if (!text) return "";

  // Match bold **text** and markdown links [text](url)
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
 * Lightweight safe markdown renderer for bold, lists, and inline links.
 */
function renderFormattedText(text = "", isStreaming = false) {
  if (!text && !isStreaming) return null;

  // Split into paragraph blocks
  const paragraphs = (text || "").split(/\n{2,}/);

  return (
    <>
      {paragraphs.map((para, pIdx) => {
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
      })}

      {/* Subtle Blinking Streaming Cursor */}
      {isStreaming && (
        <span
          className="inline-block w-1.5 h-3.5 ml-1 bg-amber-500 rounded-xs align-middle"
          style={{
            animation: "streamCursorBlink 0.8s ease-in-out infinite",
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
}

/**
 * Render individual rich interactive widget based on its type descriptor.
 */
function renderRichWidget(widget, index, handlers) {
  if (!widget) return null;

  const widgetType = typeof widget === "string" ? widget : widget.type;
  const widgetData = typeof widget === "object" && widget.data ? widget.data : {};

  switch (widgetType) {
    case "room_showcase":
    case "room_card":
      return <ChatRoomShowcaseCard key={index} data={widgetData} onSelectRoom={handlers.onSelectRoom} />;

    case "viewing_booking":
    case "tour_booking":
    case "schedule_viewing":
      return <ChatViewingBookingCard key={index} data={widgetData} onBookingComplete={handlers.onBookingComplete} />;

    case "budget_estimator":
    case "budget_calculator":
      return <ChatBudgetEstimatorWidget key={index} data={widgetData} onNavigate={handlers.onSelectRoom} />;

    case "kyc_checklist":
    case "kyc_requirements":
    case "requirements_checklist":
      return <ChatKycChecklistWidget key={index} onStartApplication={handlers.onStartApplication} />;

    default:
      return null;
  }
}

/**
 * ChatMessageBubble
 *
 * Renders individual chat messages for both User and AI Receptionist,
 * including SSE streaming text indicators, action chips, and rich interactive widgets.
 */
export function ChatMessageBubble({
  message,
  onSelectPrompt,
  onOpenEscalation,
  onOpenWidget,
  onRetry,
}) {
  const navigate = useNavigate();
  const isUser = message.role === "user";
  const isError = Boolean(message.isError);
  const isStreaming = Boolean(message.isStreaming);

  // Normalize rich widgets payload (supports richWidgets array or single widget object)
  const widgetsList = Array.isArray(message.richWidgets)
    ? message.richWidgets
    : message.widget
    ? [message.widget]
    : Array.isArray(message.widgets)
    ? message.widgets
    : [];

  const handleActionClick = (action) => {
    if (action.url) {
      if (action.url.startsWith("/")) {
        navigate(action.url);
      } else {
        window.open(action.url, "_blank", "noopener,noreferrer");
      }
    } else if (
      action.action === "open_viewing_widget" ||
      action.action === "open_viewing_form" ||
      action.action === "open_escalation_form" ||
      action.action === "escalate"
    ) {
      if (onOpenWidget) {
        onOpenWidget({ type: "viewing_booking" });
      } else if (onOpenEscalation) {
        onOpenEscalation(action);
      }
    } else if (action.action === "open_budget_widget" || action.action === "calculate_budget") {
      if (onOpenWidget) onOpenWidget({ type: "budget_estimator" });
    } else if (action.action === "open_kyc_widget" || action.action === "view_requirements") {
      if (onOpenWidget) onOpenWidget({ type: "kyc_checklist" });
    } else if (action.action === "open_room_showcase") {
      if (onOpenWidget) onOpenWidget({ type: "room_showcase" });
    } else if (action.prompt && onSelectPrompt) {
      onSelectPrompt(action.prompt);
    }
  };

  const widgetHandlers = {
    onSelectRoom: (params) => {
      if (params?.roomType && onSelectPrompt) {
        onSelectPrompt(`Tell me more about ${params.roomType} rooms in ${params.branch || "Lilycrest"}`);
      }
    },
    onBookingComplete: () => {
      // Tour scheduled callback
    },
    onStartApplication: () => {
      navigate("/applicant/check-availability");
    },
  };

  // If assistant message is still waiting for first token and has no widgets, don't render empty placeholder bubble
  if (!isUser && isStreaming && !message.text && (!widgetsList || widgetsList.length === 0)) {
    return null;
  }

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

        @keyframes streamCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      <div
        className={`flex items-start gap-2 max-w-[92%] sm:max-w-[88%] ${
          isUser ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Avatar Icon */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 select-none shadow-xs transition-transform duration-200 hover:scale-105 overflow-hidden mt-0.5"
          style={{
            backgroundColor: isUser
              ? "var(--lp-navy, #0A1628)"
              : "#ffffff",
            border: isUser
              ? "1px solid var(--lp-border, #E6D9B2)"
              : "1.5px solid var(--lp-accent, #D4AF37)",
            padding: isUser ? "0" : "3.5px",
          }}
          aria-hidden="true"
        >
          {isUser ? (
            <User className="w-4 h-4 text-white" />
          ) : (
            <img
              src="/lilycrest-logo.png"
              alt="Lilycrest Logo"
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Message Bubble Container */}
        <div className="flex flex-col min-w-0 flex-1">
          <div
            className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm shadow-sm transition-all ${
              isUser
                ? "rounded-tr-xs text-white self-end"
                : "rounded-tl-xs self-start w-full"
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
            {renderFormattedText(
              message.text ||
                (isError
                  ? "We encountered an issue connecting to the AI assistant. You can retry or request front desk assistance below."
                  : !isStreaming && (!widgetsList || widgetsList.length === 0)
                  ? "Hello! I am here to help you with room rates, branch locations, and dormitory policies. How can I assist you today?"
                  : ""),
              isStreaming
            )}

            {/* Action Chips */}
            {!isUser && Array.isArray(message.suggestedActions) && message.suggestedActions.length > 0 && !isStreaming && (
              <div className="mt-3 pt-2.5 border-t flex flex-wrap gap-1.5" style={{ borderColor: "var(--lp-border, #E6D9B2)" }}>
                {message.suggestedActions.map((action, idx) => {
                  const isEscalationAction =
                    action.action === "open_escalation_form" || action.action === "escalate";
                  const isViewingAction =
                    action.action === "open_viewing_form" || action.action === "open_viewing_widget";
                  const isBudgetAction = action.action === "open_budget_widget" || action.action === "calculate_budget";
                  const isKycAction = action.action === "open_kyc_widget" || action.action === "view_requirements";
                  const isRoomAction = action.action === "open_room_showcase";
                  const isNavAction = Boolean(action.url);

                  const isAccentPill =
                    isEscalationAction || isViewingAction || isBudgetAction || isKycAction || isRoomAction;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleActionClick(action)}
                      className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer shadow-xs focus:outline-none active:scale-95"
                      style={{
                        backgroundColor: isAccentPill
                          ? "rgba(212, 175, 55, 0.14)"
                          : "var(--surface-input, #f8fafc)",
                        color: isAccentPill ? "#92400E" : "var(--lp-text, #162f53)",
                        border: isAccentPill
                          ? "1px solid var(--lp-accent, #D4AF37)"
                          : "1px solid var(--lp-border, #E6D9B2)",
                        animation: `chipPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 60}ms forwards`,
                        opacity: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-1.5px) scale(1.02)";
                        e.currentTarget.style.backgroundColor = isAccentPill ? "rgba(212, 175, 55, 0.22)" : "rgba(212, 175, 55, 0.10)";
                        e.currentTarget.style.borderColor = "var(--lp-accent, #D4AF37)";
                        e.currentTarget.style.boxShadow = "0 3px 8px rgba(10, 22, 40, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0) scale(1)";
                        e.currentTarget.style.backgroundColor = isAccentPill ? "rgba(212, 175, 55, 0.14)" : "var(--surface-input, #f8fafc)";
                        e.currentTarget.style.borderColor = isAccentPill ? "var(--lp-accent, #D4AF37)" : "var(--lp-border, #E6D9B2)";
                        e.currentTarget.style.boxShadow = "";
                      }}
                    >
                      {isEscalationAction && <Headphones className="w-3 h-3 text-amber-600" />}
                      {isViewingAction && <Calendar className="w-3 h-3 text-amber-600" />}
                      {isBudgetAction && <Calculator className="w-3 h-3 text-amber-600" />}
                      {isKycAction && <ShieldCheck className="w-3 h-3 text-amber-600" />}
                      {isRoomAction && <Bed className="w-3 h-3 text-amber-600" />}
                      {isNavAction && <ArrowUpRight className="w-3 h-3 text-amber-600" />}
                      {!isEscalationAction && !isViewingAction && !isBudgetAction && !isKycAction && !isRoomAction && !isNavAction && (
                        <HelpCircle className="w-3 h-3 text-amber-600" />
                      )}
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

          {/* Embedded Rich Widgets (Rendered below message text) */}
          {!isUser && widgetsList.length > 0 && !isStreaming && (
            <div className="w-full mt-1.5 space-y-2">
              {widgetsList.map((widget, idx) => renderRichWidget(widget, idx, widgetHandlers))}
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
