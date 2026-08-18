import React, { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

/**
 * ScrollToTopButton — Secondary floating utility button.
 * Stacks vertically above the primary PublicChatbotLauncher (bottom: 92px, right: 32px)
 * to maintain clean visual hierarchy without overlapping.
 */
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes scrollToTopIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .scroll-to-top-btn {
          background-color: var(--lp-bg-card, #ffffff);
          color: var(--lp-text, #0A1628);
          border: 1px solid var(--lp-border, #E6D9B2);
          box-shadow: 0 2px 8px rgba(10, 22, 40, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .scroll-to-top-btn:hover {
          background-color: var(--lp-bg-alt, #FAF9F5);
          color: var(--lp-accent, #D4AF37);
          border-color: var(--lp-accent, #D4AF37);
          box-shadow: 0 6px 18px rgba(212, 175, 55, 0.22), 0 2px 6px rgba(10, 22, 40, 0.06);
          transform: translateY(-3px) scale(1.05);
        }

        .scroll-to-top-btn:active {
          transform: translateY(-1px) scale(0.96);
        }
      `}</style>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        title="Back to top"
        className="fixed z-[980] flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 group scroll-to-top-btn"
        style={{
          bottom: "96px",
          right: "32px",
          width: "40px",
          height: "40px",
          animation: "scrollToTopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        <ArrowUp size={18} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
      </button>
    </>
  );
}
