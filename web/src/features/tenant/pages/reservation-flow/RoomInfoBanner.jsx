import React from "react";
import { Home, MapPin, Tag } from "lucide-react";
import { formatBranch, formatRoomType } from "../../../../shared/utils/formatDate";

/**
 * Compact room info banner showing room name, branch, type, and price.
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
  // Lease-duration-aware final rate isn't knowable from the flat room object
  // alone (short-term vs. long-term discount) — only trust the server-derived
  // pricingDisplay preview/snapshot from GET /reservations/:id.
  const hasResolvedMonthlyRate =
    (pricingDisplay?.status === "preview" || pricingDisplay?.status === "snapshotted") &&
    Number.isFinite(Number(pricingDisplay?.finalMonthlyRate));
  const applianceFees = toFiniteNumber(room.applianceFees, 0);
  const roomPrice = hasResolvedMonthlyRate
    ? toFiniteNumber(pricingDisplay.finalMonthlyRate, 0) + applianceFees
    : null;

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
        {hasResolvedMonthlyRate ? (
          <>
            {"\u20b1"}{roomPrice.toLocaleString()}
            <small> /mo</small>
          </>
        ) : (
          <small>Pricing confirmed during review</small>
        )}
      </div>
    </div>
  );
};

export default RoomInfoBanner;
