import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  CheckSquare,
  Square,
  GraduationCap,
  Briefcase,
  IdCard,
  Receipt,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

const KYC_ITEMS = [
  {
    id: "primary_id",
    category: "Primary Government ID (1 required)",
    icon: IdCard,
    items: [
      "Philippine Passport",
      "UMID (Unified Multi-Purpose ID)",
      "Driver's License (LTO)",
      "PhilSys National ID (ePhilID or Card)",
      "PRC ID / Postal ID",
    ],
  },
  {
    id: "enrollment_or_employment",
    category: "Proof of Status (Choose one)",
    icon: GraduationCap,
    items: [
      "Student: Valid Student ID + Current Certificate of Registration (COR)",
      "Employed: Company ID + Certificate of Employment (COE) or 1-Month Payslip",
    ],
  },
  {
    id: "financial_deposit",
    category: "Move-In Advance & Deposit",
    icon: Receipt,
    items: [
      "1-Month Advance Rental Payment",
      "1-Month Security Deposit (Refundable upon contract end)",
    ],
  },
];

/**
 * ChatKycChecklistWidget
 *
 * Interactive checklist card for Philippine tenant identity & application requirements.
 */
export function ChatKycChecklistWidget({ onStartApplication }) {
  const navigate = useNavigate();
  const [checkedMap, setCheckedMap] = useState({});

  const toggleCheck = (itemId) => {
    setCheckedMap((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleApply = () => {
    if (onStartApplication) {
      onStartApplication();
    }
    navigate("/applicant/check-availability");
  };

  return (
    <div
      className="my-2.5 p-3.5 rounded-xl text-left select-none transition-all duration-200"
      style={{
        backgroundColor: "var(--lp-bg-card, #ffffff)",
        border: "1px solid var(--lp-border, #E6D9B2)",
        boxShadow: "0 2px 8px rgba(10, 22, 40, 0.05)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b" style={{ borderColor: "var(--lp-border, #E6D9B2)" }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: "var(--lp-icon-bg, rgba(212, 175, 55, 0.12))",
            color: "var(--lp-accent, #B45309)",
            border: "1px solid var(--lp-border, #E6D9B2)",
          }}
        >
          <ShieldCheck className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-bold" style={{ color: "var(--lp-text, #162f53)" }}>
            Application Documents Checklist
          </h4>
          <p className="text-[10px]" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
            Standard tenant requirements for lease verification and room check-in.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3 mb-3.5">
        {KYC_ITEMS.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.id}
              className="p-2.5 rounded-lg"
              style={{
                backgroundColor: "var(--surface-input, #f8fafc)",
                border: "1px solid var(--lp-border, #E6D9B2)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span className="text-[11px] font-bold" style={{ color: "var(--lp-text, #162f53)" }}>
                  {section.category}
                </span>
              </div>

              <ul className="space-y-1 pl-1">
                {section.items.map((item, idx) => {
                  const itemKey = `${section.id}-${idx}`;
                  const isChecked = Boolean(checkedMap[itemKey]);

                  return (
                    <li
                      key={idx}
                      onClick={() => toggleCheck(itemKey)}
                      className="flex items-start gap-2 text-[11px] cursor-pointer group leading-tight select-none"
                      style={{
                        color: isChecked ? "var(--color-success, #059669)" : "var(--lp-text-secondary, #475569)",
                      }}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 flex-shrink-0 mt-0.5 transition-colors" />
                      )}
                      <span className={isChecked ? "line-through opacity-80" : ""}>{item}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Digital Application Note */}
      <div
        className="p-2 rounded-lg mb-3 text-[10px] leading-relaxed flex items-center gap-2"
        style={{
          backgroundColor: "var(--lp-icon-bg, rgba(212, 175, 55, 0.08))",
          border: "1px solid var(--lp-border, #E6D9B2)",
          color: "var(--lp-text, #162f53)",
        }}
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        <span>You can upload digital PDF or JPG copies directly during the 5-step online reservation flow.</span>
      </div>

      {/* CTA Button */}
      <button
        type="button"
        onClick={handleApply}
        className="w-full py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 focus:outline-none active:scale-98 shadow-xs"
        style={{
          backgroundColor: "var(--lp-accent, #D4AF37)",
          border: "1px solid var(--lp-accent, #D4AF37)",
          color: "#ffffff",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--color-accent-hover, #B9921F)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--lp-accent, #D4AF37)";
        }}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Start Online Reservation</span>
        <ArrowUpRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default ChatKycChecklistWidget;
