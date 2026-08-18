import React from "react";
import { Home, MapPin, Tag } from "lucide-react";
import { formatBranch, formatRoomType } from "../../../../shared/utils/formatDate";
import { getResolvedMonthlyRate, isPricingDisplayUsable } from "../../utils/pricingDisplayHelpers";

/**
 * Compact room info banner showing room name, branch, type, and price.
 * Follows Lilycrest DMS solid design system and neutral 1px borders.
 */
const RoomInfoBanner = ({ room, pricingDisplay }) => {
  if (!room) return null;

  const toDisplayString = (value, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (typeof value === "object") {
      return toDisplayString(
        value.displayName ??
          value.name ??
          value.label ??
          value.title ??
          value.roomNumber ??
          value.slug ??
          value.key ??
          value.code ??
          value.value ??
          value.id,
        fallback,
      );
    }
    return fallback;
  };

  const toFiniteNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  const roomName = toDisplayString(
    room.title || room.name || room.roomNumber || room.id,
    "Room",
  );
  const hasResolvedMonthlyRate = isPricingDisplayUsable(pricingDisplay);
  const applianceFees = toFiniteNumber(room.applianceFees, 0);
  const roomPrice = hasResolvedMonthlyRate
    ? getResolvedMonthlyRate(pricingDisplay) + applianceFees
    : null;

  return (
    <div className="w-full p-4 sm:px-5 sm:py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between gap-4">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center text-slate-700 dark:text-slate-300 flex-shrink-0">
          <Home size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {roomName}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-slate-400" /> {formatBranch(room.branch) || "Branch"}
            </span>
            <span className="flex items-center gap-1">
              <Tag size={12} className="text-slate-400" /> {formatRoomType(room.type) || "Type"}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        {hasResolvedMonthlyRate ? (
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            {"\u20b1"}{roomPrice.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400"> /mo</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">Pricing confirmed during review</span>
        )}
      </div>
    </div>
  );
};

export default RoomInfoBanner;
