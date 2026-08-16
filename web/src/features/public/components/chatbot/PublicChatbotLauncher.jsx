import React, { useState, useEffect } from "react";
import { MessageSquare, Bot, X, Sparkles } from "lucide-react";
import PublicChatbotModal from "./PublicChatbotModal";

/**
 * PublicChatbotLauncher
 *
 * Floating bottom-right circular launcher button that toggles the AI receptionist modal.
 * Listens to custom window event 'open-lilycrest-chatbot' for external cross-component triggers.
 */
export function PublicChatbotLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [externalPrompt, setExternalPrompt] = useState("");

  // Dismiss unread badge upon opening
  const handleToggle = () => {
    if (!isOpen) {
      setHasUnread(false);
    }
    setIsOpen((prev) => !prev);
  };

  // Listen for custom event from other public sections (e.g., FAQ accordion)
  useEffect(() => {
    const handleOpenEvent = (e) => {
      const prompt = e.detail?.prompt || "";
      setExternalPrompt(prompt);
      setIsOpen(true);
      setHasUnread(false);
    };

    window.addEventListener("open-lilycrest-chatbot", handleOpenEvent);
    return () => window.removeEventListener("open-lilycrest-chatbot", handleOpenEvent);
  }, []);

  return (
    <>
      {/* Scoped Micro-Animations for Floating Bot */}
      <style>{`
        @keyframes botFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-2.5px);
          }
        }

        @keyframes botGentleTilt {
          0%, 82%, 100% {
            transform: rotate(0deg);
          }
          86% {
            transform: rotate(-7deg) scale(1.03);
          }
          90% {
            transform: rotate(7deg) scale(1.03);
          }
          94% {
            transform: rotate(-3deg) scale(1.01);
          }
        }

        @keyframes botBlink {
          0%, 92%, 100% {
            transform: scaleY(1);
          }
          95% {
            transform: scaleY(0.15);
          }
        }

        @keyframes botLevitate {
          0%, 100% {
            transform: translateY(0px);
            box-shadow: 0 8px 18px rgba(10, 22, 40, 0.24), 0 0 0 0 rgba(212, 175, 55, 0.50);
          }
          50% {
            transform: translateY(-8px);
            box-shadow: 0 20px 32px rgba(10, 22, 40, 0.32), 0 0 0 8px rgba(212, 175, 55, 0);
          }
        }

        @keyframes pillFloatSync {
          0%, 100% {
            transform: translateY(0px);
            box-shadow: 0 4px 14px rgba(10, 22, 40, 0.20);
          }
          50% {
            transform: translateY(-5px);
            box-shadow: 0 12px 24px rgba(10, 22, 40, 0.26);
          }
        }

        @keyframes radarPing {
          0% {
            transform: scale(0.9);
            box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.75);
          }
          70% {
            transform: scale(1.08);
            box-shadow: 0 0 0 7px rgba(212, 175, 55, 0);
          }
          100% {
            transform: scale(0.9);
            box-shadow: 0 0 0 0 rgba(212, 175, 55, 0);
          }
        }

        @keyframes pillSlideIn {
          from {
            opacity: 0;
            transform: translateX(12px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        .lc-bot-btn {
          animation: botLevitate 3.2s ease-in-out infinite;
          will-change: transform, box-shadow;
        }

        .lc-bot-btn:hover {
          animation-play-state: paused;
          transform: translateY(-10px) scale(1.06) !important;
          box-shadow: 0 22px 38px rgba(10, 22, 40, 0.38), 0 0 0 4px rgba(212, 175, 55, 0.40) !important;
        }

        .lc-bot-btn:active {
          transform: translateY(-2px) scale(0.95) !important;
          box-shadow: 0 4px 10px rgba(10, 22, 40, 0.20) !important;
        }

        .lc-bot-icon-idle {
          animation: botFloat 2.6s ease-in-out infinite, botGentleTilt 6s ease-in-out infinite;
          transform-origin: center bottom;
        }

        .lc-bot-icon-idle svg {
          animation: botBlink 4s ease-in-out infinite;
          transform-origin: center center;
        }

        .lc-radar-badge {
          animation: radarPing 2s ease-in-out infinite;
        }

        .lc-pill-animated {
          animation: pillSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards, pillFloatSync 3.2s ease-in-out 0.35s infinite;
        }
      `}</style>

      {/* Floating Launcher Container */}
      <div
        className="fixed z-[990] flex items-center gap-3 select-none"
        style={{ bottom: "24px", right: "24px" }}
      >
        {/* Floating Attention Pill (anchored to the left of launcher when closed and unread) */}
        {!isOpen && hasUnread && (
          <button
            type="button"
            onClick={handleToggle}
            aria-label="Open AI Assistant prompt"
            className="hidden sm:flex items-center gap-2 py-2 px-3.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap lc-pill-animated hover:scale-105 active:scale-95"
            style={{
              backgroundColor: "var(--lp-navy, #0A1628)",
              border: "1px solid var(--lp-accent, #D4AF37)",
              color: "#ffffff",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 animate-spin" style={{ animationDuration: "6s" }} />
            <span>Need Help? Ask Lilycrest AI</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5 flex-shrink-0" />
          </button>
        )}

        {/* Main Floating Button */}
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close AI Chatbot" : "Open Lilycrest AI Digital Receptionist"}
          title={isOpen ? "Close Chatbot" : "Chat with Lilycrest AI Receptionist"}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer focus:outline-none group relative ${!isOpen ? "lc-bot-btn" : "shadow-xl"}`}
          style={{
            backgroundColor: "var(--lp-navy, #0A1628)",
            border: "2px solid var(--lp-accent, #D4AF37)",
            color: "#ffffff",
          }}
        >
          {/* Animated Icon Transition */}
          {isOpen ? (
            <X className="w-6 h-6 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-90" />
          ) : (
            <div className="relative">
              <div className="lc-bot-icon-idle">
                <Bot className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform duration-200" />
              </div>
              {hasUnread && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-[#0A1628] lc-radar-badge" />
              )}
            </div>
          )}
        </button>
      </div>

      {/* Chatbot Modal */}
      <PublicChatbotModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialPrompt={externalPrompt}
      />
    </>
  );
}

export default PublicChatbotLauncher;
