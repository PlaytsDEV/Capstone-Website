import React from "react";
import { Tag, MapPin, Clock, FileText, Sparkles } from "lucide-react";

const QUICK_PROMPTS = [
  {
    id: "rates",
    icon: Tag,
    label: "What are your room rates?",
    prompt: "What are your room types and monthly rental rates for Gil Puyat and Guadalupe?",
  },
  {
    id: "locations",
    icon: MapPin,
    label: "Where are your branches located?",
    prompt: "Where are the Lilycrest branches located and what landmarks or stations are nearby?",
  },
  {
    id: "curfew",
    icon: Clock,
    label: "What are the curfew & visitor rules?",
    prompt: "What are the building curfew hours, visitor policies, and appliance rules?",
  },
  {
    id: "apply",
    icon: FileText,
    label: "How do I apply for a reservation?",
    prompt: "How does the reservation and application process work step-by-step?",
  },
];

/**
 * ChatQuickPrompts
 *
 * Pre-populated one-tap question chips displayed to prospective tenants.
 */
export function ChatQuickPrompts({ onSelectPrompt, disabled = false }) {
  return (
    <div className="py-2 px-1">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--lp-accent, #D4AF37)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--lp-text-muted, #64748B)" }}>
          Frequently Asked
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {QUICK_PROMPTS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPrompt(item.prompt)}
              className="flex items-start gap-2 p-2.5 rounded-xl text-left text-xs font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-none"
              style={{
                backgroundColor: "var(--lp-bg-card, #ffffff)",
                border: "1px solid var(--lp-border, #E6D9B2)",
                color: "var(--lp-text, #162f53)",
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.borderColor = "var(--lp-accent, #D4AF37)";
                  e.currentTarget.style.backgroundColor = "var(--lp-icon-bg, rgba(212, 175, 55, 0.08))";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.currentTarget.style.borderColor = "var(--lp-border, #E6D9B2)";
                  e.currentTarget.style.backgroundColor = "var(--lp-bg-card, #ffffff)";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  backgroundColor: "var(--lp-icon-bg, rgba(212, 175, 55, 0.12))",
                  color: "var(--lp-accent, #D4AF37)",
                }}
              >
                <Icon className="w-3 h-3" />
              </div>
              <span className="leading-snug flex-1 group-hover:text-amber-700 dark:group-hover:text-amber-300">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ChatQuickPrompts;
