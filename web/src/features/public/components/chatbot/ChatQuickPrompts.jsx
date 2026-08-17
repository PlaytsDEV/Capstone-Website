import React from "react";

const QUICK_PROMPTS = [
  {
    id: "rates",
    label: "What are your room rates?",
    prompt: "What are your room types and monthly rental rates for Gil Puyat and Guadalupe?",
  },
  {
    id: "locations",
    label: "Where are your branches located?",
    prompt: "Where are the Lilycrest branches located and what landmarks or stations are nearby?",
  },
  {
    id: "curfew",
    label: "What are the curfew & visitor rules?",
    prompt: "What are the building curfew hours, visitor policies, and appliance rules?",
  },
  {
    id: "apply",
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
      <style>{`
        @keyframes promptCardIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      <div className="flex items-center gap-1.5 mb-2 px-1">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--lp-text-muted, #64748B)" }}>
          Frequently Asked
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {QUICK_PROMPTS.map((item, idx) => {
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPrompt(item.prompt)}
              className="flex items-start p-2.5 rounded-xl text-left text-xs font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-none active:scale-95 shadow-xs"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                color: "#0A1628",
                animation: `promptCardIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 60}ms forwards`,
                opacity: 0,
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.borderColor = "#D4AF37";
                  e.currentTarget.style.backgroundColor = "#FDF8E7";
                  e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
                  e.currentTarget.style.boxShadow = "0 4px 10px rgba(10, 22, 40, 0.08)";
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.currentTarget.style.borderColor = "#CBD5E1";
                  e.currentTarget.style.backgroundColor = "#FFFFFF";
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow = "";
                }
              }}
            >
              <span className="leading-snug flex-1 font-bold text-[#0A1628] group-hover:text-amber-900 transition-colors duration-150">
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
