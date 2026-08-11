import React from "react";
import { Bed, Wrench, Layers, User, Calendar, CheckCircle2, AlertCircle, History } from "lucide-react";
import { groupBedsByBunk, getBedShortCode, formatBedPosition } from "../../../../shared/utils/bedIdentifier";

/**
 * DoubleDeckRoomCard — Visual Bunk Bed Matrix Card (Upper & Lower Deck)
 * Renders room occupancy as structured double-deck bunk frames with solid high-contrast status pills.
 */
export default function DoubleDeckRoomCard({ room, onConfigure, onViewHistory, canManageRooms = true }) {
  if (!room) return null;

  const roomNumber = room.roomNumber || room.name || "Room";
  const capacity = Number(room.capacity || 0);
  const isPrivate = String(room.type || "").toLowerCase().includes("private");

  // Filter beds in maintenance
  const bedsInMaintenance = (room.beds || []).filter((b) => b.status === "maintenance").length;
  const roomLevelMaintenance = capacity > 0 && bedsInMaintenance === capacity;
  const effectiveCapacity = roomLevelMaintenance ? 0 : Math.max(0, capacity - bedsInMaintenance);

  // Compute total occupied/reserved count
  const occupiedCount = (room.beds || []).filter(
    (b) => b.status === "occupied" || b.status === "reserved" || Boolean(b.occupiedBy?.userId)
  ).length;

  const effectiveOccupancy = Math.max(Number(room.currentOccupancy || 0), occupiedCount);

  // Status configuration
  let statusKey = "available";
  if (roomLevelMaintenance) statusKey = "maintenance";
  else if (effectiveOccupancy >= effectiveCapacity && effectiveCapacity > 0) statusKey = "full";
  else if (effectiveOccupancy > 0) statusKey = "partial";

  const getStatusBadge = () => {
    switch (statusKey) {
      case "full":
        return { label: "Full", bg: "bg-red-100 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-900" };
      case "partial":
        return { label: "Partial", bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-800 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" };
      case "maintenance":
        return { label: "Maintenance", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", border: "border-gray-300 dark:border-gray-700" };
      default:
        return { label: "Available", bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-800 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" };
    }
  };

  const statusStyle = getStatusBadge();

  // Normalize bed list into Bunks with Upper & Lower decks
  const getBunkStructures = () => {
    let bedList = room.beds || [];
    
    // Fallback: If room beds array is empty or short, build synthetic bunk bed objects
    if (bedList.length < capacity) {
      const synthetic = [];
      for (let i = 0; i < capacity; i++) {
        const isUpper = i % 2 === 0;
        const bunkIndex = Math.floor(i / 2);
        const bunkLetter = String.fromCharCode(65 + bunkIndex);
        synthetic.push({
          id: `${roomNumber}-${bunkLetter}-${isUpper ? "U" : "L"}`,
          code: `${roomNumber}-${bunkLetter}-${isUpper ? "U" : "L"}`,
          position: isUpper ? "upper" : "lower",
          bunkBlock: bunkLetter,
          status: i < effectiveOccupancy ? "occupied" : "available",
        });
      }
      bedList = synthetic;
    }

    return groupBedsByBunk(bedList);
  };

  const { bunks, singleBeds } = getBunkStructures();

  const getDeckPillStyle = (bed) => {
    if (!bed) return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-400", label: "Empty", dot: "bg-slate-300" };

    const bedStatus = String(bed.status || "").toLowerCase().trim();
    const isLocked = bedStatus === "locked";
    const isRes = bedStatus === "reserved";
    const isMaint = bedStatus === "maintenance";
    const isOcc = bedStatus === "occupied" || (Boolean(bed.occupiedBy?.userId) && !isLocked && !isRes && !isMaint);

    if (isOcc) {
      return {
        bg: "bg-red-600 dark:bg-red-700 text-white",
        text: "text-white",
        label: bed.occupiedBy?.fullName ? bed.occupiedBy.fullName.split(" ")[0] : "Occupied",
        dot: "bg-red-200",
      };
    }
    if (isRes) {
      return {
        bg: "bg-[#D4AF37] text-slate-950 font-semibold",
        text: "text-slate-950",
        label: "Reserved",
        dot: "bg-amber-700",
      };
    }
    if (isLocked) {
      return {
        bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700",
        text: "text-amber-900 dark:text-amber-300",
        label: bed.occupiedBy?.fullName ? `${bed.occupiedBy.fullName.split(" ")[0]} (Hold)` : "In Progress",
        dot: "bg-amber-500",
      };
    }
    if (isMaint) {
      return {
        bg: "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
        text: "text-slate-600",
        label: "Maint",
        dot: "bg-slate-500",
      };
    }

    return {
      bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
      text: "text-emerald-800 dark:text-emerald-300",
      label: "Vacant",
      dot: "bg-emerald-500",
    };
  };

  return (
    <div
      onClick={() => canManageRooms && onConfigure && onConfigure(room)}
      className={`group relative rounded-xl p-3.5 transition-all duration-200 flex flex-col justify-between w-full bg-card border border-border hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 ${
        canManageRooms ? "cursor-pointer" : "cursor-default"
      }`}
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Card Top Header */}
      <div className="flex items-start justify-between gap-2 pb-2.5 mb-2.5 border-b border-border/60">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-foreground tracking-tight">
              Room {roomNumber}
            </span>
            {bedsInMaintenance > 0 && (
              <span title={`${bedsInMaintenance} bed(s) in maintenance`} className="text-amber-500">
                <Wrench className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground font-medium capitalize block mt-0.5">
            {room.type ? room.type.replace("-", " ") : "Standard"}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
            {statusStyle.label}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {isPrivate ? `${Math.min(1, effectiveOccupancy)}/1` : `${effectiveOccupancy}/${capacity}`} Beds
          </span>
        </div>
      </div>

      {/* Double Deck Bunk Bed Matrix Grid */}
      {!isPrivate && bunks.length > 0 ? (
        <div className="space-y-2 my-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between px-0.5">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-slate-400" /> Bunk Deck Layout
            </span>
            <span className="text-[10px] text-muted-foreground/80 font-normal">Upper / Lower</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {bunks.map((bunk, idx) => {
              const upperStyle = getDeckPillStyle(bunk.upper);
              const lowerStyle = getDeckPillStyle(bunk.lower);

              return (
                <div
                  key={bunk.bunkBlock || idx}
                  className="rounded-lg p-2 bg-muted/40 border border-border/80 flex flex-col gap-1.5"
                >
                  <div className="text-[11px] font-bold text-foreground flex items-center justify-between border-b border-border/40 pb-1">
                    <span>Bunk {bunk.bunkBlock}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">Double Deck</span>
                  </div>

                  {/* Top Deck (Upper Bunk) */}
                  <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground min-w-0">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 shrink-0 uppercase">
                        Top
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-foreground/90 shrink-0" title={getBedShortCode(roomNumber, bunk.upper, idx * 2)}>
                        {bunk.bunkBlock}-U
                      </span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold flex items-center gap-1 shrink-0 ${upperStyle.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${upperStyle.dot}`} />
                      <span className="truncate max-w-[90px]">{upperStyle.label}</span>
                    </span>
                  </div>

                  {/* Structural Bunk Divider / Ladder Indicator */}
                  <div className="w-full h-px bg-border/40 my-0.5" />

                  {/* Bottom Deck (Lower Bunk) */}
                  <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground min-w-0">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 shrink-0 uppercase">
                        Bot
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-foreground/90 shrink-0" title={getBedShortCode(roomNumber, bunk.lower, idx * 2 + 1)}>
                        {bunk.bunkBlock}-L
                      </span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold flex items-center gap-1 shrink-0 ${lowerStyle.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${lowerStyle.dot}`} />
                      <span className="truncate max-w-[90px]">{lowerStyle.label}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Single Bed / Private Room Layout */
        <div className="py-2.5 px-3 rounded-lg bg-muted/40 border border-border flex items-center justify-between text-xs my-1">
          <div className="flex items-center gap-2">
            <Bed className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">Single Bed Unit</span>
          </div>
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${getStatusBadge().bg} ${getStatusBadge().text} ${getStatusBadge().border}`}>
            {effectiveOccupancy > 0 ? "Occupied" : "Vacant"}
          </span>
        </div>
      )}

      {/* Room Inventory & Amenities Chip Strip */}
      <div className="my-2 flex flex-wrap gap-1">
        {(room.amenities && room.amenities.length > 0
          ? room.amenities.filter((a) => !a.toLowerCase().includes("double deck")).slice(0, 2)
          : ["Air Conditioning", "WiFi"]
        ).map((amenity, idx) => (
          <span
            key={idx}
            className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/60"
          >
            {amenity}
          </span>
        ))}
        {room.amenities &&
          room.amenities.filter((a) => !a.toLowerCase().includes("double deck")).length > 2 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/60">
              +{room.amenities.filter((a) => !a.toLowerCase().includes("double deck")).length - 2} more
            </span>
          )}
      </div>

      {/* Footer Details */}
      <div className="pt-2 mt-1 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        {onViewHistory ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewHistory(room._id || room.id);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
            title="View room & bed history"
          >
            <History className="w-3.5 h-3.5 text-slate-400" /> History
          </button>
        ) : (
          <span />
        )}
        {canManageRooms && (
          <span className="text-xs font-bold text-primary group-hover:underline flex items-center gap-1">
            Manage Room &rarr;
          </span>
        )}
      </div>
    </div>
  );
}


