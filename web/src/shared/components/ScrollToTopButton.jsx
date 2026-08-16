import React, { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

/**
 * ScrollToTopButton — Secondary floating utility button.
 * Stacks vertically above the primary PublicChatbotLauncher (bottom: 92px, right: 32px)
 * to maintain clean visual hierarchy without overlapping.
 */
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Back to top"
      title="Back to top"
      className="fixed z-[980] flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2"
      style={{
        bottom: "92px",
        right: "32px",
        width: "40px",
        height: "40px",
        backgroundColor: isHovered
          ? "var(--lp-navy, #0A1628)"
          : "var(--lp-bg-card, #ffffff)",
        color: isHovered ? "var(--lp-accent, #D4AF37)" : "var(--lp-text, #0A1628)",
        border: isHovered
          ? "1px solid var(--lp-accent, #D4AF37)"
          : "1px solid var(--lp-border, #E6D9B2)",
        boxShadow: isHovered
          ? "0 6px 16px rgba(10, 22, 40, 0.16)"
          : "0 2px 8px rgba(10, 22, 40, 0.08)",
        transform: isHovered ? "translateY(-2px) scale(1.05)" : "translateY(0) scale(1)",
      }}
    >
      <ArrowUp size={18} className="transition-transform duration-200" />
    </button>
  );
}
