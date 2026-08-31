import React, { useState, useEffect } from "react";
import { X, Bot } from "lucide-react";
import { motion } from "framer-motion";
import PublicChatbotModal from "./PublicChatbotModal";
import { useFooterOffset } from "../../../../shared/hooks/useFooterOffset";

/**
 * PublicChatbotLauncher
 *
 * Floating bottom-right circular launcher button that toggles the AI receptionist modal.
 * Dynamically computes footer intersection on scroll/resize using IntersectionObserver (via useFooterOffset)
 * so the bot gracefully stops and floats above the footer without overlapping footer content.
 * Uses hardware-accelerated Framer Motion for buttery-smooth 60fps floating
 * with zero layout repaints and optimal battery/CPU efficiency.
 */
export function PublicChatbotLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [externalPrompt, setExternalPrompt] = useState("");
  const bottomOffset = useFooterOffset(24, 20);

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
        @keyframes lcBotFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-14px);
          }
        }

        @keyframes radarPing {
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

        .lc-bot-float-anim {
          animation: lcBotFloat 2.2s ease-in-out infinite !important;
          will-change: transform;
        }

        .lc-bot-btn {
          transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
          background-color: #0A1628 !important;
          border: 1.5px solid #1e293b !important;
          color: #D4AF37 !important;
          box-shadow: 0 4px 14px rgba(10, 22, 40, 0.3) !important;
        }

        .lc-bot-btn:hover {
          background-color: #162f53 !important;
          border-color: #D4AF37 !important;
          box-shadow: 0 6px 20px rgba(10, 22, 40, 0.4) !important;
        }

        .lc-bot-btn:active {
          transform: scale(0.96);
        }

        .dark .lc-bot-btn,
        [data-theme="dark"] .lc-bot-btn {
          background-color: #D4AF37 !important;
          border: 1.5px solid #B9921F !important;
          color: #0A1628 !important;
          box-shadow: 0 4px 14px rgba(212, 175, 55, 0.4) !important;
        }

        .dark .lc-bot-btn:hover,
        [data-theme="dark"] .lc-bot-btn:hover {
          background-color: #E5C358 !important;
          border-color: #F3E4B0 !important;
          box-shadow: 0 6px 20px rgba(212, 175, 55, 0.5) !important;
        }

        .lc-bot-icon-svg {
          color: #D4AF37;
          transition: color 0.2s ease;
        }

        .dark .lc-bot-icon-svg,
        [data-theme="dark"] .lc-bot-icon-svg {
          color: #0A1628;
        }

        .lc-radar-badge {
          animation: radarPing 2s ease-in-out infinite;
          border-color: #0A1628 !important;
        }

        .dark .lc-radar-badge,
        [data-theme="dark"] .lc-radar-badge {
          border-color: #D4AF37 !important;
        }

        .lc-tooltip-btn {
          background-color: #ffffff;
          border: 1px solid #D4AF37;
          color: #0A1628;
          box-shadow: 0 4px 16px rgba(10, 22, 40, 0.12);
        }

        .dark .lc-tooltip-btn,
        [data-theme="dark"] .lc-tooltip-btn {
          background-color: #08111F;
          border: 1px solid #D4AF37;
          color: #F8FAFC;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }
      `}</style>

      {/* Floating Launcher Container */}
      <div
        className="fixed z-[990] flex items-center gap-3 select-none pointer-events-none"
        style={{
          bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
          right: "24px",
          transition: "bottom 0.15s ease-out",
        }}
      >
        {/* Floating Attention Pill / Tooltip (pure fade on hover, perfectly centered) */}
        {!isOpen && (
          <button
            type="button"
            onClick={handleToggle}
            aria-label="Open AI Chatbot prompt"
            tabIndex={isHovered ? 0 : -1}
            className={`pointer-events-auto hidden sm:flex items-center gap-2 py-2 px-3.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-opacity duration-300 ease-in-out lc-tooltip-btn ${
              isHovered
                ? "opacity-100"
                : "opacity-0"
            }`}
          >
            <span>Need Help? Ask Lilycrest AI Chatbot</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5 flex-shrink-0" />
          </button>
        )}

        {/* Main Floating Button in Hardware-Accelerated Container */}
        <motion.div
          className="pointer-events-auto"
          animate={!isOpen ? { y: [0, -12, 0] } : { y: 0 }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <motion.button
            type="button"
            onClick={handleToggle}
            onFocus={() => setIsHovered(true)}
            onBlur={() => setIsHovered(false)}
            whileTap={{ scale: 0.96 }}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Close AI Chatbot" : "Open Lilycrest AI Chatbot"}
            title={isOpen ? "Close Chatbot" : "Chat with Lilycrest AI Chatbot"}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer focus:outline-none relative lc-bot-btn ${
              isOpen ? "shadow-xl" : ""
            }`}
          >
            {isOpen ? (
              <X className="w-5 h-5 lc-bot-icon-svg" aria-hidden="true" />
            ) : (
              <div className="relative flex items-center justify-center">
                <div className="flex items-center justify-center">
                  <Bot className="w-5 h-5 lc-bot-icon-svg" aria-hidden="true" />
                </div>
                {hasUnread && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white dark:border-slate-900 lc-radar-badge" />
                )}
              </div>
            )}
          </motion.button>
        </motion.div>
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
