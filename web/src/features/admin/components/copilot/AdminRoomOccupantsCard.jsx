import React from "react";
import { useNavigate } from "react-router-dom";
import { Home, Users, ArrowRight, User } from "lucide-react";
import ProfileAvatar from "../../../../shared/components/ProfileAvatar";

export default function AdminRoomOccupantsCard({ roomDetails, occupants = [], onSelectTenant, onCloseDrawer }) {
  const navigate = useNavigate();

  if (!roomDetails) return null;

  const branchLabel =
    roomDetails.branch === "gil-puyat"
      ? "Gil Puyat"
      : roomDetails.branch === "guadalupe"
      ? "Guadalupe"
      : roomDetails.branch || "General";

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs text-xs">
      {/* Room Header */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center justify-center text-primary">
            <Home size={18} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground">Room {roomDetails.roomNumber}</h4>
            <p className="text-[11px] text-muted-foreground">
              {branchLabel} · Floor {roomDetails.floor || 1} · {roomDetails.type || "Sharing"}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground border border-border px-2 py-0.5 rounded-md">
          <Users size={12} className="text-muted-foreground" />
          <span>
            {occupants.length}/{roomDetails.capacity || 4} Occupants
          </span>
        </span>
      </div>

      {/* Occupants List */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Current Occupants:
        </div>

        {occupants.length === 0 ? (
          <div className="p-3 text-center rounded-lg bg-muted/20 border border-border text-muted-foreground text-xs">
            This room is currently vacant.
          </div>
        ) : (
          occupants.map((occ) => (
            <div
              key={occ._id}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/60 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ProfileAvatar
                  src={occ.profileImage}
                  user={{ name: occ.fullName }}
                  size={26}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate text-xs">{occ.fullName}</div>
                  <div className="text-[10px] text-muted-foreground">{occ.bedLabel}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onSelectTenant) onSelectTenant(occ);
                }}
                className="inline-flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline cursor-pointer ml-2 shrink-0"
              >
                <span>View Details</span>
                <ArrowRight size={11} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Quick Link to Room Management */}
      <button
        type="button"
        onClick={() => {
          if (onCloseDrawer) onCloseDrawer();
          navigate(`/admin/rooms?search=${encodeURIComponent(roomDetails.roomNumber)}`);
        }}
        className="w-full py-1.5 px-2 rounded-lg bg-muted border border-border text-foreground font-semibold text-[11px] hover:bg-muted/80 transition-colors cursor-pointer text-center"
      >
        Manage Room in Inventory
      </button>
    </div>
  );
}
