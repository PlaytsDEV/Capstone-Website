import React from "react";
import { Sparkles, Tag, MapPin, Clock, FileText } from "lucide-react";

const QUICK_PROMPTS = [
  {
    id: "rates",
    label: "What are your room rates?",
    prompt: "What are your room types and monthly rental rates for Gil Puyat and Guadalupe?",
    icon: Tag,
  },
  {
    id: "locations",
    label: "Where are your branches located?",
    prompt: "Where are the Lilycrest branches located and what landmarks or stations are nearby?",
    icon: MapPin,
  },
  {
    id: "curfew",
    label: "What are the curfew & visitor rules?",
    prompt: "What are the building curfew hours, visitor policies, and appliance rules?",
    icon: Clock,
  },
  {
    id: "apply",
    label: "How do I apply for a reservation?",
    prompt: "How does the reservation and application process work step-by-step?",
    icon: FileText,
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
        <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Frequently Asked
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {QUICK_PROMPTS.map((item, idx) => {
          const IconComp = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPrompt(item.prompt)}
              className="flex items-start gap-2 p-2.5 rounded-xl text-left text-xs font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-none active:scale-95 shadow-xs bg-white dark:bg-[#111C31] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-amber-400 dark:hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-slate-800/80"
              style={{
                animation: `promptCardIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 60}ms forwards`,
                opacity: 0,
              }}
            >
              <IconComp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors" aria-hidden="true" />
              <span className="leading-snug flex-1 font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-900 dark:group-hover:text-amber-200 transition-colors duration-150">
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
