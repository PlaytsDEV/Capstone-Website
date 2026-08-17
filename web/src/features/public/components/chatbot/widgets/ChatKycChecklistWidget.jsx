import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const KYC_ITEMS = [
  {
    id: "primary_id",
    category: "Primary Government ID (1 required)",
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
    items: [
      "Student: Valid Student ID + Current Certificate of Registration (COR)",
      "Employed: Company ID + Certificate of Employment (COE) or 1-Month Payslip",
    ],
  },
  {
    id: "financial_deposit",
    category: "Move-In Advance & Deposit",
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
      <div className="mb-3 pb-2 border-b" style={{ borderColor: "var(--lp-border, #E6D9B2)" }}>
        <h4 className="text-xs sm:text-sm font-bold" style={{ color: "var(--lp-text, #162f53)" }}>
          Application Documents Checklist
        </h4>
        <p className="text-[10px]" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
          Standard tenant requirements for lease verification and room check-in.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-3 mb-3.5">
        {KYC_ITEMS.map((section) => {
          return (
            <div
              key={section.id}
              className="p-2.5 rounded-lg"
              style={{
                backgroundColor: "var(--surface-input, #f8fafc)",
                border: "1px solid var(--lp-border, #E6D9B2)",
              }}
            >
              <div className="mb-1.5">
                <span className="text-[11px] font-bold" style={{ color: "var(--lp-text, #162f53)" }}>
                  {section.category}
                </span>
              </div>

              <ul className="space-y-1.5 pl-1">
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
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="rounded border-slate-400 text-amber-600 focus:ring-0 cursor-pointer mt-0.5"
                      />
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
        className="p-2 rounded-lg mb-3 text-[10px] leading-relaxed"
        style={{
          backgroundColor: "var(--lp-icon-bg, rgba(212, 175, 55, 0.08))",
          border: "1px solid var(--lp-border, #E6D9B2)",
          color: "var(--lp-text, #162f53)",
        }}
      >
        <span>You can upload digital PDF or JPG copies directly during the 5-step online reservation flow.</span>
      </div>

      {/* CTA Button */}
      <button
        type="button"
        onClick={handleApply}
        className="w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer flex items-center justify-center focus:outline-none active:scale-98 shadow-xs"
        style={{
          backgroundColor: "#0A1628",
          border: "1px solid #0A1628",
          color: "#FFFFFF",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#1A2C4E";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#0A1628";
        }}
      >
        <span className="text-white font-bold">Start Online Reservation</span>
      </button>
    </div>
  );
}

export default ChatKycChecklistWidget;
