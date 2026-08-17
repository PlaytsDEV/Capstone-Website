import React from "react";
import { Search, ChevronLeft, ChevronRight, Home, Users } from "lucide-react";
import { getRoomLabel } from "../../../../../shared/utils/roomLabel";
import { getHistoryStatusClasses, getRoomBadgeLabel } from "./utilityConstants";

export default function UtilityRoomSelector({
  rooms = [],
  filteredRooms = [],
  pagedRooms = [],
  selectedRoomId,
  onSelectRoom,
  sidebarSearch,
  onSearchChange,
  floorFilter,
  onFloorFilterChange,
  availableFloors = [],
  roomStatusFilter,
  onRoomStatusFilterChange,
  roomsPage,
  totalRoomPages,
  onPageChange,
  roomsLoading,
  utilityType,
}) {
  const unit = utilityType === "electricity" ? "kWh" : "cu.m.";

  return (
    <aside
      className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs"
      aria-label="Room selection"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-card-foreground">
          <Home size={13} className="shrink-0 text-slate-700 dark:text-slate-300" />
          Room Selector
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {filteredRooms.length} of {rooms.length} room{rooms.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
          placeholder="Search room name or number..."
          value={sidebarSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search rooms"
        />
        {sidebarSearch && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Floor & Status Filter Dropdowns */}
      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label="Filter by floor level"
          className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
          value={floorFilter}
          onChange={(e) => onFloorFilterChange(e.target.value)}
        >
          <option value="all">All Floors</option>
          {availableFloors.map((fl) => (
            <option key={fl} value={fl}>
              Floor {fl}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by occupancy status"
          className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
          value={roomStatusFilter}
          onChange={(e) => onRoomStatusFilterChange(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="occupied">Occupied</option>
          <option value="vacant">Vacant</option>
        </select>
      </div>

      {/* Room Button List */}
      <div className="space-y-1.5 pt-1 max-h-[460px] overflow-y-auto pr-1">
        {roomsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-12 w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"
              />
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            <p className="font-semibold text-card-foreground">No rooms found</p>
            <p className="mt-1 text-[11px]">Try adjusting your search or filters.</p>
          </div>
        ) : (
          pagedRooms.map((room) => {
            const isSelected = selectedRoomId === room.id;
            const statusTone = getHistoryStatusClasses(room.billingState || "no_active_cycle");
            const hasTenants = Boolean(room.hasActiveTenants || (room.activeTenantCount && room.activeTenantCount > 0));

            return (
              <button
                key={room.id}
                type="button"
                className={`group w-full rounded-lg border px-3 py-2 text-left transition-all shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                  isSelected
                    ? "border-slate-900 bg-slate-100/90 shadow-xs dark:border-slate-100 dark:bg-slate-800"
                    : "border-border bg-card hover:bg-muted/40 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
                aria-pressed={isSelected}
                aria-label={`Select room ${getRoomLabel(room)}`}
                onClick={() => onSelectRoom(room.id)}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? "text-slate-900 dark:text-white" : "text-card-foreground"}`}>
                    {getRoomLabel(room)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${hasTenants ? "bg-emerald-500" : "bg-slate-400"}`}
                      title={hasTenants ? "Occupied with active tenants" : "Vacant / No active tenants"}
                    />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {hasTenants ? `${room.activeTenantCount || 1}t` : "vacant"}
                    </span>
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className={`rounded-sm px-1.5 py-0.2 text-[10px] ${statusTone}`}>
                    {getRoomBadgeLabel(room)}
                  </span>
                  {room.latestReading != null && (
                    <span className="text-[10px] font-mono font-medium text-slate-600 dark:text-slate-400">
                      {room.latestReading} {unit}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalRoomPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground">
          <span>
            Page {roomsPage} of {totalRoomPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={roomsPage <= 1}
              onClick={() => onPageChange(roomsPage - 1)}
              className="h-7 w-7 flex items-center justify-center rounded border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous room page"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              disabled={roomsPage >= totalRoomPages}
              onClick={() => onPageChange(roomsPage + 1)}
              className="h-7 w-7 flex items-center justify-center rounded border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next room page"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
