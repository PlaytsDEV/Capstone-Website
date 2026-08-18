import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Wind,
  BookOpen,
  Wifi,
  Lock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const ROOM_PRESETS = {
  "quadruple sharing": {
    title: "Quadruple Sharing Room",
    branch: "Gil Puyat / Guadalupe",
    badge: "Most Popular",
    features: [
      { text: "Air-Conditioned", icon: Wind },
      { text: "Personal Study Desk", icon: BookOpen },
      { text: "High-Speed Wi-Fi", icon: Wifi },
      { text: "Steel Security Locker", icon: Lock },
    ],
    roomTypeParam: "Quadruple",
    description: "Spacious 4-tenant shared dorm room with individual lockers, dedicated desks, and shared en-suite bathroom.",
  },
  "double sharing": {
    title: "Double Sharing Room",
    branch: "Gil Puyat / Guadalupe",
    badge: "High Demand",
    features: [
      { text: "Air-Conditioned", icon: Wind },
      { text: "Ergonomic Study Desk", icon: BookOpen },
      { text: "High-Speed Wi-Fi", icon: Wifi },
      { text: "Private Clothes Wardrobe", icon: Lock },
    ],
    roomTypeParam: "Shared",
    description: "Quiet 2-tenant shared room with dedicated study desks, clothes wardrobe, and shared en-suite bathroom.",
  },
  "private room": {
    title: "Private Solo Room",
    branch: "Gil Puyat / Guadalupe",
    badge: "Executive Solo",
    features: [
      { text: "Dedicated Inverter AC", icon: Wind },
      { text: "Executive Work Desk", icon: BookOpen },
      { text: "Dedicated Wi-Fi AP", icon: Wifi },
      { text: "En-suite Bathroom", icon: ShieldCheck },
    ],
    roomTypeParam: "Private",
    description: "Full private room with dedicated ensuite bathroom, inverter air-conditioning, and maximum privacy.",
  },
};

/**
 * ChatRoomShowcaseCard
 *
 * Solid minimalist interactive room preview card rendered inside the AI chat stream.
 * Directs prospective tenants to check live availability and booking slots.
 */
export function ChatRoomShowcaseCard({ data = {}, onSelectRoom }) {
  const navigate = useNavigate();

  const requestedType = (data.roomType || "Quadruple Sharing").toLowerCase();
  let defaultPresetKey = "quadruple sharing";
  if (requestedType.includes("private")) {
    defaultPresetKey = "private room";
  } else if (requestedType.includes("double") || requestedType.includes("shared") || requestedType.includes("twin")) {
    defaultPresetKey = "double sharing";
  }

  const [selectedKey, setSelectedKey] = React.useState(defaultPresetKey);
  const preset = ROOM_PRESETS[selectedKey] || ROOM_PRESETS["quadruple sharing"];

  const displayTitle = preset.title;
  const roomTypeParam = preset.roomTypeParam;

  const handleCheckAvailability = (branchName) => {
    if (onSelectRoom) {
      onSelectRoom({ branch: branchName, roomType: roomTypeParam });
    }
    navigate(`/applicant/check-availability?branch=${encodeURIComponent(branchName)}&roomType=${encodeURIComponent(roomTypeParam)}`);
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
      {/* Interactive Room Tabs */}
      <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b overflow-x-auto no-scrollbar" style={{ borderColor: "var(--lp-border, #E6D9B2)" }}>
        <button
          type="button"
          onClick={() => setSelectedKey("quadruple sharing")}
          className="py-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer border shadow-xs"
          style={{
            backgroundColor: selectedKey === "quadruple sharing" ? "#0A1628" : "#FFFFFF",
            borderColor: selectedKey === "quadruple sharing" ? "#0A1628" : "#CBD5E1",
            color: selectedKey === "quadruple sharing" ? "#FFFFFF" : "#0A1628",
          }}
        >
          Quadruple Sharing
        </button>
        <button
          type="button"
          onClick={() => setSelectedKey("double sharing")}
          className="py-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer border shadow-xs"
          style={{
            backgroundColor: selectedKey === "double sharing" ? "#0A1628" : "#FFFFFF",
            borderColor: selectedKey === "double sharing" ? "#0A1628" : "#CBD5E1",
            color: selectedKey === "double sharing" ? "#FFFFFF" : "#0A1628",
          }}
        >
          Double Sharing
        </button>
        <button
          type="button"
          onClick={() => setSelectedKey("private room")}
          className="py-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer border shadow-xs"
          style={{
            backgroundColor: selectedKey === "private room" ? "#0A1628" : "#FFFFFF",
            borderColor: selectedKey === "private room" ? "#0A1628" : "#CBD5E1",
            color: selectedKey === "private room" ? "#FFFFFF" : "#0A1628",
          }}
        >
          Private Solo
        </button>
      </div>

      {/* Header Strip */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={{
                backgroundColor: "var(--lp-icon-bg, rgba(212, 175, 55, 0.12))",
                color: "var(--lp-accent, #B45309)",
                border: "1px solid var(--lp-border, #E6D9B2)",
              }}
            >
              {preset.badge}
            </span>
            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--lp-text-secondary, #64748B)" }}
            >
              Gil Puyat & Guadalupe
            </span>
          </div>
          <h4
            className="text-sm font-bold mt-1 tracking-tight"
            style={{ color: "var(--lp-text, #162f53)" }}
          >
            {displayTitle}
          </h4>
        </div>

        <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
          <span>Live Availability</span>
        </div>
      </div>

      <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--lp-text-secondary, #475569)" }}>
        {preset.description}
      </p>

      {/* Feature Badges Grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {preset.features.map((feat, idx) => {
          const FeatIcon = feat.icon;
          return (
            <div
              key={idx}
              className="flex items-center gap-1.5 p-1.5 rounded-lg text-[11px] font-medium"
              style={{
                backgroundColor: "var(--surface-input, #f8fafc)",
                border: "1px solid var(--lp-border, #E6D9B2)",
                color: "var(--lp-text, #162f53)",
              }}
            >
              {FeatIcon && <FeatIcon className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />}
              <span className="truncate">{feat.text}</span>
            </div>
          );
        })}
      </div>

      {/* Utility Inclusions Note */}
      <div
        className="flex items-center gap-1.5 py-1 px-2 rounded-md mb-3 text-[10px] font-medium"
        style={{
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          border: "1px solid rgba(16, 185, 129, 0.25)",
          color: "#065F46",
        }}
      >
        <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
        <span>Wi-Fi & Water Included • Metered Room Electricity</span>
      </div>

      {/* 2-Column Branch Check Availability Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleCheckAvailability("Gil Puyat")}
          className="py-2.5 px-2.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer flex items-center justify-center gap-1 focus:outline-none active:scale-98 shadow-xs"
          style={{
            backgroundColor: "#D4AF37",
            border: "1px solid #B9921F",
            color: "#0A1628",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#C49E26";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#D4AF37";
          }}
        >
          <span className="truncate font-bold text-[#0A1628]">Check Gil Puyat</span>
          <ArrowRight className="w-3 h-3 text-[#0A1628] flex-shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => handleCheckAvailability("Guadalupe")}
          className="py-2.5 px-2.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer flex items-center justify-center gap-1 focus:outline-none active:scale-98 shadow-xs"
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
          <span className="truncate font-bold text-white">Check Guadalupe</span>
          <ArrowRight className="w-3 h-3 text-white flex-shrink-0" />
        </button>
      </div>
    </div>
  );
}

export default ChatRoomShowcaseCard;
