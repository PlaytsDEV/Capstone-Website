import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const ESTIMATED_ELECTRICITY_PER_BED = 650; // Pro-rata submetered aircon estimate in PHP

/**
 * Returns room recommendations based on budget threshold
 */
function getRecommendation(budget) {
  if (budget < 5000) {
    return {
      type: "Quadruple Sharing Bed",
      roomTypeParam: "Quadruple",
      baseRent: 3500,
      description: "Economical 4-tenant air-conditioned room with personal locker and desk.",
      branch: "Gil Puyat / Guadalupe",
    };
  } else if (budget < 8000) {
    return {
      type: "Double Sharing Room",
      roomTypeParam: "Shared",
      baseRent: 5500,
      description: "Comfortable 2-tenant shared room with dedicated study tables and wardrobe.",
      branch: "Gil Puyat Branch",
    };
  } else {
    return {
      type: "Private Solo Room",
      roomTypeParam: "Private",
      baseRent: 9000,
      description: "Executive private room with private ensuite bathroom and maximum privacy.",
      branch: "Gil Puyat Branch",
    };
  }
}

/**
 * ChatBudgetEstimatorWidget
 *
 * Interactive monthly budget slider and pro-rata utility cost calculator.
 */
export function ChatBudgetEstimatorWidget({ data = {}, onNavigate }) {
  const navigate = useNavigate();
  const [budget, setBudget] = useState(data.initialBudget || 4500);

  const recommendation = getRecommendation(budget);
  const netEstimatedTotal = recommendation.baseRent + ESTIMATED_ELECTRICITY_PER_BED;
  const budgetSurplus = budget - netEstimatedTotal;

  const handleViewRooms = () => {
    if (onNavigate) {
      onNavigate(recommendation.roomTypeParam);
    }
    navigate(`/applicant/check-availability?roomType=${encodeURIComponent(recommendation.roomTypeParam)}`);
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
          Monthly Budget Estimator
        </h4>
        <p className="text-[10px]" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
          Slide to estimate rent, utilities, and recommended accommodation.
        </p>
      </div>

      {/* Interactive Budget Slider */}
      <div className="mb-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="budget-slider" className="text-[11px] font-semibold" style={{ color: "var(--lp-text, #162f53)" }}>
            Target Monthly Budget:
          </label>
          <span className="text-sm font-extrabold" style={{ color: "var(--lp-accent, #B45309)" }}>
            ₱{budget.toLocaleString()}
          </span>
        </div>

        <input
          id="budget-slider"
          type="range"
          min={3000}
          max={12000}
          step={250}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{
            accentColor: "var(--lp-accent, #D4AF37)",
            backgroundColor: "var(--surface-input, #e2e8f0)",
          }}
        />

        <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-medium">
          <span>₱3,000</span>
          <span>₱7,500</span>
          <span>₱12,000</span>
        </div>
      </div>

      {/* Recommendation Card */}
      <div
        className="p-2.5 rounded-lg mb-3"
        style={{
          backgroundColor: "var(--surface-input, #f8fafc)",
          border: "1px solid var(--lp-border, #E6D9B2)",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Best Fit Accommodation
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            {recommendation.branch}
          </span>
        </div>

        <div className="text-xs font-bold mb-1" style={{ color: "var(--lp-text, #162f53)" }}>
          {recommendation.type}
        </div>
        <p className="text-[10px] text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
          {recommendation.description}
        </p>

        {/* Cost Breakdown Table */}
        <div className="space-y-1 text-[11px] pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex justify-between">
            <span className="text-slate-500">
              Base Bed Rate:
            </span>
            <span className="font-semibold" style={{ color: "var(--lp-text, #162f53)" }}>
              ₱{recommendation.baseRent.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">
              Est. Electricity Share:
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              ~₱{ESTIMATED_ELECTRICITY_PER_BED.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">
              Water & High-Speed Wi-Fi:
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Included (₱0)
            </span>
          </div>

          <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800 text-xs font-bold">
            <span style={{ color: "var(--lp-text, #162f53)" }}>Net Monthly Total:</span>
            <span style={{ color: "var(--lp-accent, #B45309)" }}>
              ₱{netEstimatedTotal.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Budget Balance Feedback */}
      <div className="flex items-center justify-between text-[11px] mb-3 px-1">
        <span className="text-slate-500">Budget Margin:</span>
        {budgetSurplus >= 0 ? (
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            +₱{budgetSurplus.toLocaleString()} surplus
          </span>
        ) : (
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            ₱{Math.abs(budgetSurplus).toLocaleString()} gap
          </span>
        )}
      </div>

      {/* CTA Button */}
      <button
        type="button"
        onClick={handleViewRooms}
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
        <span className="text-white font-bold">View Available {recommendation.roomTypeParam} Rooms</span>
      </button>
    </div>
  );
}

export default ChatBudgetEstimatorWidget;
