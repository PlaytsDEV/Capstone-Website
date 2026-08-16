import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  X,
  RotateCcw,
  Send,
  Building2,
  ChevronDown,
  PhoneCall,
  Sparkles,
  ShieldCheck,
  Info,
} from "lucide-react";
import ChatMessageList from "./ChatMessageList";
import ChatLeadEscalationForm from "./ChatLeadEscalationForm";
import { chatbotApi } from "../../../../shared/api/chatbotApi";

const STORAGE_KEY = "lc_chatbot_history_v1";

const INITIAL_MESSAGE = {
  id: "welcome-msg",
  role: "assistant",
  text: "Hello! I am the **Lilycrest Digital Receptionist**. I can provide instant information on room rates, branch locations (*Gil Puyat* & *Guadalupe*), house policies, curfews, and reservation steps.\n\nHow can I help you today?",
  timestamp: Date.now(),
  suggestedActions: [
    { label: "Quadruple Sharing Rates", prompt: "What are the rates for Quadruple Sharing rooms?" },
    { label: "Curfew & Visitors", prompt: "What are the curfew hours and visitor rules?" },
    { label: "Book a Viewing", action: "open_escalation_form" },
  ],
};

const BRANCH_LABELS = {
  all: "All Branches",
  gil_puyat: "Gil Puyat (Pasay)",
  guadalupe: "Guadalupe (Makati)",
};

/**
 * PublicChatbotModal
 *
 * 380px x 560px (desktop) / full-screen (mobile < 640px) conversational modal.
 * Built with solid HSL tokens, 1px crisp borders, and zero gradients.
 */
export function PublicChatbotModal({ isOpen, onClose, initialPrompt = "" }) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return [INITIAL_MESSAGE];
  });

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [branchFocus, setBranchFocus] = useState("all");
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalationContext, setEscalationContext] = useState("");

  const inputRef = useRef(null);
  const branchMenuRef = useRef(null);

  // Save messages to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Ignore quota errors
    }
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current && !isEscalating) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, isEscalating]);

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Close branch dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target)) {
        setIsBranchMenuOpen(false);
      }
    };
    if (isBranchMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isBranchMenuOpen]);

  // Handle initial external prompt if provided
  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSendMessage(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, isOpen]);

  // Send message handler
  const handleSendMessage = useCallback(
    async (textToSend) => {
      const queryText = (textToSend || input).trim();
      if (!queryText || isTyping) return;

      const userMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: queryText,
        timestamp: Date.now(),
      };

      const updatedHistory = [...messages, userMessage];
      setMessages(updatedHistory);
      setInput("");
      setIsTyping(true);

      try {
        // Format history for backend contract: [{ role, text }]
        const apiHistory = updatedHistory
          .filter((m) => !m.isError)
          .map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            text: m.text,
          }));

        const response = await chatbotApi.queryPublicChatbot({
          message: queryText,
          conversationHistory: apiHistory.slice(-8), // Send last 8 turns for context
          branchFocus,
        });

        const botReplyText =
          response?.reply ||
          response?.data?.reply ||
          "I'm sorry, I couldn't retrieve that information. Please try contacting our admin team directly.";

        const botActions =
          response?.suggestedActions ||
          response?.data?.suggestedActions ||
          [];

        const botMessage = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          text: botReplyText,
          timestamp: Date.now(),
          suggestedActions: botActions,
        };

        setMessages((prev) => [...prev, botMessage]);
      } catch (err) {
        console.error("Chatbot query error:", err);
        const errorMessage = {
          id: `bot-err-${Date.now()}`,
          role: "assistant",
          text: "We encountered an issue connecting to our receptionist system. Please try again or request a callback.",
          timestamp: Date.now(),
          isError: true,
          suggestedActions: [
            { label: "Request Staff Callback", action: "open_escalation_form" },
          ],
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
      }
    },
    [input, isTyping, messages, branchFocus]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear this conversation?")) {
      const reset = [
        {
          ...INITIAL_MESSAGE,
          id: `welcome-${Date.now()}`,
          timestamp: Date.now(),
        },
      ];
      setMessages(reset);
      setIsEscalating(false);
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
  };

  const handleOpenEscalation = (action) => {
    setEscalationContext(action?.prompt || input || "Public inquiry from AI chat");
    setIsEscalating(true);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chatbot-header-title"
      className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[380px] h-[100dvh] sm:h-[560px] max-h-[100dvh] sm:max-h-[560px] z-[999] flex flex-col rounded-none sm:rounded-2xl shadow-2xl overflow-hidden transition-all duration-200"
      style={{
        backgroundColor: "var(--lp-bg, #ffffff)",
        border: "1px solid var(--lp-border, #E6D9B2)",
      }}
    >
      {/* ── HEADER ── */}
      <div
        className="px-3.5 py-3 flex items-center justify-between flex-shrink-0 text-white select-none"
        style={{
          backgroundColor: "var(--lp-navy, #0A1628)",
          borderBottom: "1px solid var(--lp-accent, #D4AF37)",
        }}
      >
        {/* Left: Avatar + Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: "rgba(212, 175, 55, 0.18)",
              border: "1px solid var(--lp-accent, #D4AF37)",
            }}
          >
            <Bot className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3
                id="chatbot-header-title"
                className="text-xs sm:text-sm font-bold tracking-tight text-white truncate"
              >
                Lilycrest AI Receptionist
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="truncate">Online • 24/7 Digital Assistant</span>
            </div>
          </div>
        </div>

        {/* Right: Actions (Branch Toggle, Clear, Close) */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Branch Selector Dropdown */}
          <div className="relative" ref={branchMenuRef}>
            <button
              type="button"
              onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
              title="Filter response by branch"
              aria-label="Filter branch"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px] font-medium"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <ChevronDown className="w-3 h-3" />
            </button>

            {isBranchMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-44 rounded-xl shadow-lg py-1 z-50 text-xs text-left"
                style={{
                  backgroundColor: "var(--lp-bg-card, #ffffff)",
                  border: "1px solid var(--lp-border, #E6D9B2)",
                  color: "var(--lp-text, #162f53)",
                }}
              >
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  Focus Branch
                </div>
                {Object.entries(BRANCH_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setBranchFocus(key);
                      setIsBranchMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center justify-between ${
                      branchFocus === key
                        ? "font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>{label}</span>
                    {branchFocus === key && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear History */}
          <button
            type="button"
            onClick={handleClearHistory}
            title="Reset conversation"
            aria-label="Reset conversation"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Close Modal */}
          <button
            type="button"
            onClick={onClose}
            title="Close chatbot"
            aria-label="Close chatbot window"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Branch Active Filter Banner (if not 'all') */}
      {branchFocus !== "all" && (
        <div
          className="px-3 py-1 text-[11px] flex items-center justify-between border-b select-none"
          style={{
            backgroundColor: "var(--lp-icon-bg, rgba(212, 175, 55, 0.1))",
            borderColor: "var(--lp-border, #E6D9B2)",
            color: "var(--lp-text, #162f53)",
          }}
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Building2 className="w-3 h-3 text-amber-500" />
            Filtered to: <strong>{BRANCH_LABELS[branchFocus]}</strong>
          </span>
          <button
            type="button"
            onClick={() => setBranchFocus("all")}
            className="text-[10px] underline hover:text-amber-600"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── BODY ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ backgroundColor: "var(--lp-bg, #ffffff)" }}>
        {isEscalating ? (
          <div className="flex-1 overflow-y-auto p-2">
            <ChatLeadEscalationForm
              initialBranch={branchFocus === "all" ? "any" : branchFocus}
              initialMessage={escalationContext}
              onCancel={() => setIsEscalating(false)}
              onSuccessSubmitted={() => {
                // Add system message indicating successful inquiry
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `bot-lead-${Date.now()}`,
                    role: "assistant",
                    text: "Thank you! Your callback request has been logged. A member of our staff will reach out to you shortly.",
                    timestamp: Date.now(),
                  },
                ]);
              }}
            />
          </div>
        ) : (
          <ChatMessageList
            messages={messages}
            isTyping={isTyping}
            showQuickPrompts={messages.length <= 2}
            onSelectPrompt={(p) => handleSendMessage(p)}
            onOpenEscalation={handleOpenEscalation}
            onRetryLastMessage={() => {
              const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
              if (lastUserMsg) {
                handleSendMessage(lastUserMsg.text);
              }
            }}
          />
        )}
      </div>

      {/* ── FOOTER & INPUT AREA ── */}
      {!isEscalating && (
        <div
          className="p-2.5 border-t flex-shrink-0"
          style={{
            backgroundColor: "var(--lp-bg-card, #ffffff)",
            borderColor: "var(--lp-border, #E6D9B2)",
          }}
        >
          {/* Quick Staff Escalation Strip */}
          <div className="flex items-center justify-between pb-2 mb-1.5 px-0.5 border-b border-dashed border-slate-200 dark:border-slate-800 text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Verified Dormitory Policies
            </span>
            <button
              type="button"
              onClick={() => handleOpenEscalation({ prompt: input })}
              className="text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
            >
              <PhoneCall className="w-3 h-3" />
              Talk to Staff
            </button>
          </div>

          {/* Form Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-1.5"
          >
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about rates, curfew, requirements..."
                disabled={isTyping}
                maxLength={400}
                aria-label="Ask Lilycrest AI a question"
                className="w-full text-xs py-2 pl-3 pr-2 rounded-xl border outline-none resize-none transition-all disabled:opacity-50"
                style={{
                  backgroundColor: "var(--surface-input, #f8fafc)",
                  borderColor: "var(--lp-border, #E6D9B2)",
                  color: "var(--lp-text, #162f53)",
                  minHeight: "36px",
                  maxHeight: "80px",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              aria-label="Send message"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-sm focus:outline-none"
              style={{
                backgroundColor: "var(--lp-navy, #0A1628)",
                border: "1px solid var(--lp-accent, #D4AF37)",
              }}
            >
              <Send className="w-4 h-4 text-amber-400" />
            </button>
          </form>

          <p className="text-[9px] text-center mt-1.5 text-slate-400 select-none">
            Enter to send • Shift+Enter for new line • AI responses grounded in official policies
          </p>
        </div>
      )}
    </div>
  );
}

export default PublicChatbotModal;
