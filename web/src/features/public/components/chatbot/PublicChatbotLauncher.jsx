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
  const [isHovered, setIsHovered] = useState(false);
  const [externalPrompt, setExternalPrompt] = useState("");

  // Dismiss unread badge upon opening and clear pending prompt on close
  const handleToggle = () => {
    if (!isOpen) {
      setHasUnread(false);
    } else {
      setExternalPrompt("");
    }
    setIsOpen((prev) => !prev);
  };

  const handleClose = () => {
    setIsOpen(false);
    setExternalPrompt("");
  };

  const handleClearInitialPrompt = () => {
    setExternalPrompt("");
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

        .lc-bot-btn {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .lc-bot-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 10px 28px rgba(10, 22, 40, 0.22), 0 0 0 3px rgba(212, 175, 55, 0.35) !important;
        }

        .lc-bot-btn:active {
          transform: scale(0.95);
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
      `}</style>

      {/* Floating Launcher Container */}
      <div
        className="fixed z-[990] flex items-center gap-3 select-none"
        style={{ bottom: "24px", right: "24px" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Floating Attention Pill / Tooltip (pure fade on hover, perfectly centered) */}
        {!isOpen && (
          <button
            type="button"
            onClick={handleToggle}
            aria-label="Open AI Chatbot prompt"
            tabIndex={isHovered ? 0 : -1}
            className={`hidden sm:flex items-center gap-2 py-2 px-3.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-opacity duration-300 ease-in-out ${
              isHovered
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
            style={{
              backgroundColor: "var(--lp-bg, #ffffff)",
              border: "1px solid var(--lp-accent, #D4AF37)",
              color: "var(--lp-text, #162f53)",
              boxShadow: "0 4px 16px rgba(10, 22, 40, 0.12)",
              transition: "opacity 350ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 animate-spin" style={{ animationDuration: "6s" }} />
            <span>Need Help? Ask Lilycrest AI Chatbot</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5 flex-shrink-0" />
          </button>
        )}

        {/* Main Floating Button */}
        <button
          type="button"
          onClick={handleToggle}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close AI Chatbot" : "Open Lilycrest AI Chatbot"}
          title={isOpen ? "Close Chatbot" : "Chat with Lilycrest AI Chatbot"}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer focus:outline-none relative ${!isOpen ? "lc-bot-btn" : "shadow-xl"}`}
          style={{
            backgroundColor: "var(--lp-bg, #ffffff)",
            border: "2px solid var(--lp-accent, #D4AF37)",
            color: "var(--lp-text, #162f53)",
            boxShadow: "0 6px 20px rgba(10, 22, 40, 0.14)",
          }}
        >
          {/* Animated Icon Transition */}
          {isOpen ? (
            <X className="w-6 h-6 text-amber-600 transition-transform duration-200 rotate-0 hover:rotate-90" />
          ) : (
            <div className="relative">
              <div className="lc-bot-icon-idle">
                <Bot className="w-6 h-6 text-amber-600 group-hover:scale-110 transition-transform duration-200" />
              </div>
              {hasUnread && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 border-2 border-white lc-radar-badge" />
              )}
            </div>
          )}
        </button>
      </div>

      {/* Chatbot Modal */}
      <PublicChatbotModal
        isOpen={isOpen}
        onClose={handleClose}
        initialPrompt={externalPrompt}
        onClearInitialPrompt={handleClearInitialPrompt}
      />
    </>
  );
}

export default PublicChatbotLauncher;
