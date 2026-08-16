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
            transform: translateY(-2px);
          }
        }

        @keyframes botGentleTilt {
          0%, 82%, 100% {
            transform: rotate(0deg);
          }
          86% {
            transform: rotate(-6deg);
          }
          90% {
            transform: rotate(6deg);
          }
          94% {
            transform: rotate(-3deg);
          }
        }

        @keyframes botRingPulse {
          0% {
            box-shadow: 0 4px 14px rgba(10, 22, 40, 0.25), 0 0 0 0 rgba(212, 175, 55, 0.45);
          }
          60% {
            box-shadow: 0 6px 18px rgba(10, 22, 40, 0.30), 0 0 0 6px rgba(212, 175, 55, 0);
          }
          100% {
            box-shadow: 0 4px 14px rgba(10, 22, 40, 0.25), 0 0 0 0 rgba(212, 175, 55, 0);
          }
        }

        .lc-bot-btn {
          animation: botRingPulse 3.8s ease-in-out infinite;
        }

        .lc-bot-btn:hover {
          animation: none;
        }

        .lc-bot-icon-idle {
          animation: botFloat 2.6s ease-in-out infinite, botGentleTilt 6.5s ease-in-out infinite;
          transform-origin: center bottom;
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
            className="hidden sm:flex items-center gap-2 py-2 px-3.5 rounded-full text-xs font-semibold shadow-xl transition-all duration-200 cursor-pointer whitespace-nowrap hover:scale-105"
            style={{
              backgroundColor: "var(--lp-navy, #0A1628)",
              border: "1px solid var(--lp-accent, #D4AF37)",
              color: "#ffffff",
              boxShadow: "0 4px 14px rgba(10, 22, 40, 0.20)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
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
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {/* Animated Icon Transition */}
          {isOpen ? (
            <X className="w-6 h-6 text-amber-400 transition-transform duration-200" />
          ) : (
            <div className="relative">
              <Bot className="w-6 h-6 text-amber-400 lc-bot-icon-idle group-hover:scale-110 transition-transform duration-200" />
              {hasUnread && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-[#0A1628]" />
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
