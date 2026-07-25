import React from "react";
import { Home, MapPin, Tag } from "lucide-react";
import { formatBranch, formatRoomType } from "../../../../shared/utils/formatDate";

/**
 * Compact room info banner showing room name, branch, type, and price.
 */
const RoomInfoBanner = ({ room }) => {
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
  const basePrice = toFiniteNumber(room.monthlyPrice || room.price || room.monthlyRent, 0);
  const applianceFees = toFiniteNumber(room.applianceFees, 0);
  const roomPrice = toFiniteNumber(room.totalPrice, basePrice + applianceFees);

  return (
    <div className="rf-room-banner">
      <div className="rf-room-banner-icon">
        <Home size={18} color="#FF8C42" />
      </div>
      <div className="rf-room-banner-info">
        <div className="rf-room-banner-name">{roomName}</div>
        <div className="rf-room-banner-meta">
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <MapPin size={12} /> {formatBranch(room.branch) || "Branch"}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Tag size={12} /> {formatRoomType(room.type) || "Type"}
          </span>
        </div>
      </div>
      <div className="rf-room-banner-price">
        {"\u20b1"}{roomPrice.toLocaleString()}
        <small> /mo</small>
      </div>
    </div>
  );
};

export default RoomInfoBanner;
