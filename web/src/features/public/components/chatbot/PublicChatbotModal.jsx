import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  X,
  RotateCcw,
  Send,
  Headphones,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ChatMessageList from "./ChatMessageList";
import ChatLeadEscalationForm from "./ChatLeadEscalationForm";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import { chatbotApi } from "../../../../shared/api/chatbotApi";

const STORAGE_KEY = "lc_chatbot_history_v1";
const LAST_ACTIVE_KEY = "lc_chatbot_last_active_v1";
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

const INITIAL_MESSAGE = {
  id: "welcome-msg",
  role: "assistant",
  text: "Hello! I am the **Lilycrest AI Chatbot**. I can assist you with our room types, branch locations (*Gil Puyat* & *Guadalupe*), house rules, curfews, utility billing, and checking live room availability.\n\nHow can I help you today?",
  timestamp: Date.now(),
  suggestedActions: [
    { label: "Check Room Availability", url: "/applicant/check-availability" },
    { label: "Room Types & Amenities", prompt: "What are your room types and amenities for Gil Puyat and Guadalupe?" },
    { label: "Check ID Requirements", action: "open_kyc_widget" },
    { label: "Curfew & Policies", prompt: "What are the building curfew hours and visitor policies?" },
  ],
};

/**
 * PublicChatbotModal
 *
 * 380px x 560px (desktop) / full-screen (mobile < 640px) conversational modal.
 * Built with solid HSL tokens, 1px crisp borders, zero gradients, and real-time SSE streaming.
 */
export function PublicChatbotModal({
  isOpen,
  onClose,
  initialPrompt = "",
  onClearInitialPrompt,
}) {
  const [messages, setMessages] = useState(() => {
    try {
      const lastActive = sessionStorage.getItem(LAST_ACTIVE_KEY);
      if (lastActive) {
        const lastActiveTime = parseInt(lastActive, 10);
        if (!isNaN(lastActiveTime) && Date.now() - lastActiveTime > INACTIVITY_TIMEOUT_MS) {
          sessionStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(LAST_ACTIVE_KEY);
          return [INITIAL_MESSAGE];
        }
      }
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Clear any leftover streaming flags from previous session
          return parsed.map((m) => ({ ...m, isStreaming: false }));
        }
      }
    } catch {
      // Fallback
    }
    return [INITIAL_MESSAGE];
  });

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalationContext, setEscalationContext] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const lastProcessedPromptRef = useRef(null);

  const touchActivity = useCallback(() => {
    try {
      sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    } catch {
      // Ignore
    }
  }, []);

  // Direct local widget injection handler (e.g. clicking widget suggestion chips)
  const handleOpenWidget = useCallback((widgetDescriptor) => {
    const widgetType = widgetDescriptor?.type || widgetDescriptor;
    let descriptionText = "Here is the interactive tool you requested:";
    let defaultActions = [];

    if (widgetType === "budget_estimator") {
      descriptionText = "You can use our **Monthly Budget Estimator** below to calculate your estimated accommodation and pro-rata utility expenses:";
      defaultActions = [
        { label: "Quadruple Sharing Rates", prompt: "What are the rates for Quadruple Sharing rooms?" },
        { label: "Check ID Requirements", action: "open_kyc_widget" },
        { label: "Request Front Desk Assistance", action: "open_escalation_form" },
      ];
    } else if (widgetType === "viewing_booking") {
      descriptionText = "Please fill in your preferred schedule and contact details below to schedule an in-person tour of our dormitory facilities:";
      defaultActions = [
        { label: "Check ID Requirements", action: "open_kyc_widget" },
        { label: "Quadruple Sharing Rates", prompt: "What are the rates for Quadruple Sharing rooms?" },
      ];
    } else if (widgetType === "kyc_checklist") {
      descriptionText = "Here is the official checklist of accepted Philippine Government IDs and documentation required for tenant verification:";
      defaultActions = [
        { label: "Browse Available Rooms", url: "/applicant/check-availability" },
        { label: "Request Front Desk Assistance", action: "open_escalation_form" },
      ];
    } else if (widgetType === "room_showcase") {
      descriptionText = "Here is an overview of our dormitory room features and starting monthly rental rates:";
      defaultActions = [
        { label: "Check ID Requirements", action: "open_kyc_widget" },
        { label: "Browse Available Rooms", url: "/applicant/check-availability" },
      ];
    }

    const injectedMessage = {
      id: `bot-widget-${Date.now()}`,
      role: "assistant",
      text: descriptionText,
      timestamp: Date.now(),
      isStreaming: false,
      richWidgets: [
        {
          type: widgetType,
          data: widgetDescriptor?.data || {},
        },
      ],
      suggestedActions: defaultActions,
    };

    setMessages((prev) => [...prev, injectedMessage]);
  }, []);

  // Send message handler with SSE Streaming support
  const handleSendMessage = useCallback(
    async (textToSend) => {
      const queryText = (textToSend || input).trim();
      if (!queryText || isTyping) return;

      // Abort any ongoing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const userMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: queryText,
        timestamp: Date.now(),
      };

      const botMessageId = `bot-${Date.now()}`;
      const placeholderBotMessage = {
        id: botMessageId,
        role: "assistant",
        text: "",
        timestamp: Date.now(),
        isStreaming: true,
        richWidgets: [],
        suggestedActions: [],
      };

      // Optimistic message list update
      setMessages((prev) => [...prev, userMessage, placeholderBotMessage]);
      setInput("");
      setIsTyping(true);
      touchActivity();

      // Format conversation history for backend context (last 10 turns)
      const conversationHistory = messages
        .slice(-10)
        .filter((m) => m.text && !m.isError)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      try {
        await chatbotApi.streamPublicChatbot({
          message: queryText,
          conversationHistory,
          branchFocus: "all",
          signal: abortController.signal,
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId
                  ? {
                      ...msg,
                      text: msg.text + token,
                      isStreaming: true,
                    }
                  : msg
              )
            );
          },
          onWidget: (widget) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId
                  ? {
                      ...msg,
                      richWidgets: msg.richWidgets?.some((w) => w.type === widget.type)
                        ? msg.richWidgets
                        : [...(msg.richWidgets || []), widget],
                    }
                  : msg
              )
            );
          },
          onActions: (actions) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId
                  ? {
                      ...msg,
                      suggestedActions: actions,
                    }
                  : msg
              )
            );
          },
          onDone: (finalResult) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId
                  ? {
                      ...msg,
                      text: msg.text || finalResult?.text || "",
                      richWidgets:
                        msg.richWidgets?.length > 0
                          ? msg.richWidgets
                          : finalResult?.widget
                          ? Array.isArray(finalResult.widget)
                            ? finalResult.widget
                            : [finalResult.widget]
                          : [],
                      suggestedActions:
                        msg.suggestedActions?.length > 0
                          ? msg.suggestedActions
                          : finalResult?.actions || [],
                      isStreaming: false,
                    }
                  : msg
              )
            );
            setIsTyping(false);
            touchActivity();
          },
          onError: (err) => {
            console.error("Public Chatbot stream error:", err);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId
                  ? {
                      ...msg,
                      text: msg.text || "We encountered an issue connecting to the AI assistant. You can retry or request front desk assistance.",
                      isError: true,
                      isStreaming: false,
                      suggestedActions: [
                        { label: "Request Front Desk Assistance", action: "open_escalation_form" },
                      ],
                    }
                  : msg
              )
            );
            setIsTyping(false);
          },
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Chatbot submission caught error:", err);
          setIsTyping(false);
        }
      }
    },
    [input, isTyping, messages, touchActivity]
  );

  // Save messages to sessionStorage and update last active timestamp
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    } catch {
      // Ignore quota errors
    }
  }, [messages]);

  // Periodic and focus-based inactivity timeout watcher (30 minutes)
  useEffect(() => {
    const checkInactivity = () => {
      try {
        const lastActive = sessionStorage.getItem(LAST_ACTIVE_KEY);
        if (lastActive) {
          const lastActiveTime = parseInt(lastActive, 10);
          if (!isNaN(lastActiveTime) && Date.now() - lastActiveTime > INACTIVITY_TIMEOUT_MS) {
            // Auto-reset conversation to initial greeting
            const resetMsg = [
              {
                ...INITIAL_MESSAGE,
                id: `welcome-${Date.now()}`,
                timestamp: Date.now(),
              },
            ];
            setMessages(resetMsg);
            setIsEscalating(false);
            sessionStorage.removeItem(STORAGE_KEY);
            sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
          }
        }
      } catch {
        // Ignore
      }
    };

    const interval = setInterval(checkInactivity, 30000);
    window.addEventListener("focus", checkInactivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", checkInactivity);
    };
  }, []);

  // Focus input and touch activity on open
  useEffect(() => {
    if (isOpen) {
      touchActivity();
      setTimeout(() => {
        if (inputRef.current && !isEscalating) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, isEscalating, touchActivity]);

  // Escape key closes modal (when confirmation modal is not open)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !showClearConfirm) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, showClearConfirm]);

  // Cleanup active stream on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Handle initial external prompt if provided (consumed once per trigger)
  useEffect(() => {
    if (initialPrompt && isOpen && lastProcessedPromptRef.current !== initialPrompt) {
      lastProcessedPromptRef.current = initialPrompt;
      handleSendMessage(initialPrompt);
      if (typeof onClearInitialPrompt === "function") {
        onClearInitialPrompt();
      }
    }
  }, [initialPrompt, isOpen, handleSendMessage, onClearInitialPrompt]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    lastProcessedPromptRef.current = null;
    if (typeof onClearInitialPrompt === "function") {
      onClearInitialPrompt();
    }
    const reset = [
      {
        ...INITIAL_MESSAGE,
        id: `welcome-${Date.now()}`,
        timestamp: Date.now(),
      },
    ];
    setMessages(reset);
    setIsEscalating(false);
    setIsTyping(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    } catch {
      // Ignore
    }
    setShowClearConfirm(false);
  };

  const handleOpenEscalation = (action) => {
    setEscalationContext(action?.prompt || input || "Assistance request from AI chat");
    setIsEscalating(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes modalPopIn {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes liveDotPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            box-shadow: 0 0 0 5px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }

        .lc-live-dot {
          animation: liveDotPulse 2.2s ease-in-out infinite;
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chatbot-header-title"
        className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[380px] h-[100dvh] sm:h-[560px] max-h-[100dvh] sm:max-h-[560px] z-[999] flex flex-col rounded-none sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--lp-bg, #ffffff)",
          border: "1px solid var(--lp-border, #E6D9B2)",
          animation: "modalPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          transformOrigin: "bottom right",
        }}
      >
        {/* Header */}
        <div
          className="px-3.5 py-3 flex items-center justify-between flex-shrink-0 select-none"
          style={{
            backgroundColor: "var(--lp-bg, #ffffff)",
            borderBottom: "1px solid var(--lp-border, #E6D9B2)",
          }}
        >
          {/* Left: Avatar + Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 select-none shadow-xs overflow-hidden"
              style={{
                backgroundColor: "#ffffff",
                border: "1.5px solid var(--lp-accent, #D4AF37)",
                padding: "3.5px",
              }}
            >
              <img
                src="/lilycrest-logo.png"
                alt="Lilycrest Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3
                  id="chatbot-header-title"
                  className="text-xs sm:text-sm font-bold tracking-tight truncate"
                  style={{ color: "var(--lp-text, #162f53)" }}
                >
                  Lilycrest AI Chatbot
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 lc-live-dot flex-shrink-0" />
                <span className="truncate">Online • 24/7 Digital Assistant</span>
              </div>
            </div>
          </div>

          {/* Right: Actions (Staff Assistance, Clear, Close) */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Request Staff Assistance Shortcut */}
            <button
              type="button"
              onClick={() => setIsEscalating(!isEscalating)}
              title="Request Front Desk Assistance"
              aria-label="Request Front Desk Assistance"
              className="p-1.5 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-amber-50 dark:text-slate-300 dark:hover:text-amber-400 dark:hover:bg-amber-950/30 transition-colors"
            >
              <Headphones className="w-3.5 h-3.5" />
            </button>

            {/* Clear History */}
            <button
              type="button"
              onClick={handleClearHistory}
              title="Reset conversation"
              aria-label="Reset conversation"
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Close Modal */}
            <button
              type="button"
              onClick={onClose}
              title="Close chatbot"
              aria-label="Close chatbot window"
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body / Active View */}
        <div className="flex-1 overflow-hidden flex flex-col relative" style={{ backgroundColor: "var(--lp-bg, #ffffff)" }}>
          {isEscalating ? (
            <div className="flex-1 overflow-y-auto px-2 py-1.5">
              <ChatLeadEscalationForm
                initialBranch="all"
                initialMessage={escalationContext}
                onCancel={() => setIsEscalating(false)}
                onSuccessSubmitted={() => {
                  touchActivity();
                }}
              />
            </div>
          ) : (
            <>
              {/* Message List */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <ChatMessageList
                  messages={messages}
                  isTyping={isTyping}
                  onSelectPrompt={handleSendMessage}
                  onOpenEscalation={handleOpenEscalation}
                  onOpenWidget={handleOpenWidget}
                  onRetry={() => {
                    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
                    if (lastUserMsg) {
                      handleSendMessage(lastUserMsg.text);
                    }
                  }}
                />
              </div>

              {/* Quick Actions Bar */}
              <div
                className="px-3 py-1.5 border-t flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none text-[11px] flex-shrink-0"
                style={{
                  backgroundColor: "var(--lp-bg, #ffffff)",
                  borderColor: "var(--lp-border, #E6D9B2)",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleOpenWidget("kyc_checklist")}
                  className="flex-shrink-0 inline-flex items-center gap-1 py-1 px-2 rounded-lg font-medium transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  style={{
                    color: "var(--lp-text, #162f53)",
                    border: "1px solid var(--lp-border, #E6D9B2)",
                  }}
                >
                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                  <span>ID Requirements</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEscalating(true)}
                  className="flex-shrink-0 inline-flex items-center gap-1 py-1 px-2 rounded-lg font-medium transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  style={{
                    color: "var(--lp-text, #162f53)",
                    border: "1px solid var(--lp-border, #E6D9B2)",
                  }}
                >
                  <Headphones className="w-3 h-3 text-amber-600" />
                  <span>Front Desk Assistance</span>
                </button>
              </div>

              {/* Input Bar */}
              <div
                className="p-2.5 border-t flex-shrink-0"
                style={{
                  backgroundColor: "var(--lp-bg, #ffffff)",
                  borderColor: "var(--lp-border, #E6D9B2)",
                }}
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <div className="flex-1 relative flex items-center">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about rates, curfews, or locations..."
                      disabled={isTyping}
                      className="w-full text-xs py-2 px-3 pr-8 rounded-xl border outline-none resize-none transition-all focus:border-amber-500 disabled:opacity-60"
                      style={{
                        backgroundColor: "var(--surface-input, #f8fafc)",
                        borderColor: "var(--lp-border, #E6D9B2)",
                        color: "var(--lp-text, #162f53)",
                        maxHeight: "80px",
                      }}
                    />
                  </div>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    title="Send message"
                    aria-label="Send message"
                    className="p-2 rounded-xl text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-xs focus:outline-none active:scale-95 flex-shrink-0"
                    style={{
                      backgroundColor: "var(--lp-navy, #0A1628)",
                      border: "1px solid var(--lp-navy, #0A1628)",
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>

                <div className="flex items-center justify-between mt-1 px-1 text-[10px]" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
                  <span>Press Enter to send</span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                    <span>Gemini 2.5 AI</span>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Resetting Conversation */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleConfirmClear}
        title="Clear Conversation"
        message="Are you sure you want to clear this conversation? This will reset your current chat history and start a fresh session."
        confirmText="Clear Chat"
        cancelText="Cancel"
        variant="warning"
      />
    </>
  );
}

export default PublicChatbotModal;
