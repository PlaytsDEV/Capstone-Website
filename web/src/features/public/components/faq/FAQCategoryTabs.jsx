import React from "react";
import { Tag, ShieldAlert, FileCheck2, Wifi, Layers } from "lucide-react";

export const FAQ_CATEGORIES = [
  { id: "all", label: "All Questions", icon: Layers },
  { id: "rates", label: "Rates & Rooms", icon: Tag },
  { id: "policies", label: "House Policies & Curfew", icon: ShieldAlert },
  { id: "reservation", label: "Reservation & Requirements", icon: FileCheck2 },
  { id: "facilities", label: "Facilities & Utilities", icon: Wifi },
];

/**
 * FAQCategoryTabs
 *
 * Tab bar switcher for categorized FAQ items.
 * Enforces solid HSL tokens, 1px crisp borders, responsive wrapping, and zero gradients.
 */
export function FAQCategoryTabs({
  activeCategory = "all",
  onSelectCategory,
  counts = {},
}) {
  return (
    <div
      role="tablist"
      aria-label="FAQ Categories"
      className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 w-full max-w-4xl"
    >
      {FAQ_CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;
        const count = counts[cat.id] ?? 0;

        return (
          <button
            key={cat.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`faq-panel-${cat.id}`}
            onClick={() => onSelectCategory(cat.id)}
            className="group flex items-center gap-2 py-2 px-3.5 sm:px-4 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 select-none flex-shrink-0"
            style={{
              backgroundColor: isActive
                ? "var(--lp-navy, #0A1628)"
                : "var(--lp-bg-card, #ffffff)",
              border: isActive
                ? "1px solid var(--lp-accent, #D4AF37)"
                : "1px solid var(--lp-border, #E6D9B2)",
              color: isActive ? "#ffffff" : "var(--lp-text, #162f53)",
              boxShadow: isActive ? "0 2px 8px rgba(10, 22, 40, 0.15)" : "none",
            }}
          >
            <Icon
              className="w-3.5 h-3.5 transition-colors"
              style={{
                color: isActive
                  ? "var(--lp-accent, #D4AF37)"
                  : "var(--lp-text-muted, #64748B)",
              }}
            />
            <span>{cat.label}</span>
            {count > 0 && (
              <span
                className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-bold ml-0.5 transition-colors"
                style={{
                  backgroundColor: isActive
                    ? "rgba(212, 175, 55, 0.25)"
                    : "var(--lp-icon-bg, rgba(212, 175, 55, 0.12))",
                  color: isActive
                    ? "var(--lp-accent, #D4AF37)"
                    : "var(--lp-text-muted, #64748B)",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default FAQCategoryTabs;

