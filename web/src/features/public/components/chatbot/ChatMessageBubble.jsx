import React from "react";
import { useNavigate } from "react-router-dom";
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
  isLatestAssistant = true,
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
    if (!isLatestAssistant) return;
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

        .lc-user-avatar {
          background-color: #0A1628;
          border: 1px solid #1e293b;
          color: #ffffff;
        }

        .dark .lc-user-avatar,
        [data-theme="dark"] .lc-user-avatar {
          background-color: #D4AF37;
          border: 1px solid #B9921F;
          color: #0A1628;
        }

        .lc-user-bubble {
          background-color: #0A1628;
          color: #ffffff !important;
          border: 1px solid #1e293b;
        }

        .lc-user-bubble * {
          color: #ffffff !important;
        }

        .dark .lc-user-bubble,
        [data-theme="dark"] .lc-user-bubble {
          background-color: #D4AF37;
          color: #0A1628 !important;
          border: 1px solid #B9921F;
        }

        .dark .lc-user-bubble *,
        [data-theme="dark"] .lc-user-bubble * {
          color: #0A1628 !important;
        }
      `}</style>

      <div
        className={`flex items-start gap-2 max-w-[92%] sm:max-w-[88%] ${
          isUser ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Avatar Icon */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 select-none shadow-xs transition-transform duration-200 hover:scale-105 overflow-hidden mt-0.5 ${
            isUser ? "lc-user-avatar" : ""
          }`}
          style={{
            backgroundColor: !isUser ? "#ffffff" : undefined,
            border: !isUser ? "1.5px solid var(--lp-accent, #D4AF37)" : undefined,
            padding: isUser ? "0" : "3.5px",
          }}
          aria-hidden="true"
        >
          {isUser ? (
            <span className="text-[10px] font-bold">You</span>
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
                ? "rounded-tr-xs self-end lc-user-bubble"
                : "rounded-tl-xs self-start w-full bg-white dark:bg-[#111C31] border border-[#E6D9B2] dark:border-[#27334A] text-[#162f53] dark:text-[#F8FAFC]"
            }`}
            style={{
              backgroundColor: isUser
                ? undefined
                : isError
                ? undefined
                : "var(--lp-bg-card, #ffffff)",
              borderColor: isUser
                ? undefined
                : isError
                ? undefined
                : "var(--lp-border, #E6D9B2)",
              color: isUser
                ? undefined
                : isError
                ? undefined
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
              <div
                className={`mt-3 pt-2.5 border-t border-[#E6D9B2] dark:border-[#27334A] flex flex-wrap gap-1.5 transition-opacity ${
                  isLatestAssistant ? "opacity-100" : "opacity-45 pointer-events-none select-none"
                }`}
              >
                {message.suggestedActions.map((action, idx) => {
                  const isEscalationAction =
                    action.action === "open_escalation_form" || action.action === "escalate";
                  const isViewingAction =
                    action.action === "open_viewing_form" || action.action === "open_viewing_widget";
                  const isBudgetAction = action.action === "open_budget_widget" || action.action === "calculate_budget";
                  const isKycAction = action.action === "open_kyc_widget" || action.action === "view_requirements";
                  const isRoomAction = action.action === "open_room_showcase";

                  const isAccentPill =
                    isEscalationAction || isViewingAction || isBudgetAction || isKycAction || isRoomAction;

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!isLatestAssistant}
                      onClick={() => handleActionClick(action)}
                      className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-150 shadow-xs focus:outline-none ${
                        isLatestAssistant
                          ? "cursor-pointer active:scale-95"
                          : "cursor-default opacity-70"
                      } ${
                        isAccentPill
                          ? "bg-amber-50/80 dark:bg-[#162238] text-amber-900 dark:text-slate-100 border border-amber-300/90 dark:border-slate-700 hover:bg-amber-100 dark:hover:bg-slate-700/80 hover:border-amber-400 dark:hover:border-amber-400"
                          : "bg-slate-50 dark:bg-[#162238] text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:border-amber-400 dark:hover:border-amber-400"
                      }`}
                      style={{
                        animation: `chipPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 60}ms forwards`,
                        opacity: 0,
                      }}
                    >
                      <span className="font-bold tracking-tight">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Retry Button if Error */}
            {isError && onRetry && (
              <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800 flex items-center justify-between">
                <span className="text-xs text-red-600 dark:text-red-400">Connection error</span>
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-xs font-semibold text-red-700 dark:text-red-300 underline hover:text-red-900 dark:hover:text-red-200 cursor-pointer"
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
        className={`text-[10px] mt-1 px-1 font-medium select-none text-slate-400 dark:text-slate-500 ${
          isUser ? "text-right pr-9" : "text-left pl-9"
        }`}
      >
        {formatTime(message.timestamp || Date.now())}
      </span>
    </div>
  );
}

export default ChatMessageBubble;
