import { BedDouble, Lock, Settings, Unlock, X } from "lucide-react";
import { createPortal } from "react-dom";
import { formatRoomType } from "../../utils/formatters";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import { DrawerSkeleton } from "../../../../shared/components/LoadingSkeletons";
import { getBedDisplayLabel } from "../../../../shared/utils/bedIdentifier";

export default function OccupancyRoomModal({ room, loadingDetails, onClose }) {
 useEscapeClose(true, onClose);
 const roomInfo = room.room || room;
 const beds = room.beds || [];
 const occupiedBeds =
 room.occupiedBeds ||
 beds.filter((bed) => bed.status === "occupied" || bed.occupant?.reservationStatus === "moveIn");
 const reservedBeds =
 room.reservedBeds ||
 beds.filter((bed) => bed.status === "reserved" && bed.occupant?.reservationStatus !== "moveIn");
 const availableBeds = room.availableBeds || beds.filter((bed) => bed.status === "available");
 const lockedBeds = room.lockedBeds || beds.filter((bed) => bed.status === "locked");
 const maintenanceBeds = room.maintenanceBeds || beds.filter((bed) => bed.status === "maintenance");

 const title = roomInfo.name || roomInfo.roomName || "Room";
 const formatBedLabel = (bed, index = 0) => {
   return getBedDisplayLabel(bed, index);
 };
 const formatOccupantName = (bed) =>
 bed.occupiedBy?.userName ||
 bed.occupant?.name ||
 "Unknown";

 const formatOccupantEmail = (bed) =>
 bed.occupiedBy?.email ||
 bed.occupant?.email ||
 null;

 const formatOccupiedSince = (bed) =>
 bed.occupiedBy?.occupiedSince ||
 bed.occupant?.since ||
 null;

 const formatExpectedVacancy = (bed) =>
 bed.expectedVacancyDate ||
 bed.occupiedBy?.expectedVacancyDate ||
 bed.occupant?.expectedVacancyDate ||
 null;

 const formatDaysRemaining = (bed) =>
 bed.daysRemaining ??
 bed.occupiedBy?.daysRemaining ??
 bed.occupant?.daysRemaining ??
 null;

 const getBedTone = (kind) => {
 switch (kind) {
 case "occupied":
 return {
 card: "bg-blue-50 border-blue-200 border-l-blue-500",
 icon: "text-blue-600",
 accent: "text-info-dark",
 };
 case "reserved":
 return {
 card: "bg-amber-50 border-amber-200 border-l-amber-500",
 icon: "text-warning-dark",
 accent: "text-warning-dark",
 };
 case "locked":
 return {
 card: "bg-muted border-border border-l-slate-500",
 icon: "text-muted-foreground",
 accent: "text-card-foreground",
 };
 case "maintenance":
 return {
 card: "bg-orange-50 border-orange-200 border-l-orange-500",
 icon: "text-orange-600",
 accent: "text-orange-700",
 };
 default:
 return {
 card: "bg-emerald-50 border-emerald-200 border-l-emerald-500",
 icon: "text-emerald-600",
 accent: "text-success-dark",
 };
 }
 };

 const occupiedTone = getBedTone("occupied");
 const reservedTone = getBedTone("reserved");
 const lockedTone = getBedTone("locked");
 const maintenanceTone = getBedTone("maintenance");
 const availableTone = getBedTone("available");

 const modal = (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-transparent backdrop-blur-sm" onClick={onClose}>
 <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
 <div className="px-6 py-4 border-b border-border flex items-center justify-between">
 <h2 className="text-lg font-semibold text-foreground">{title} - Bed Assignment Details</h2>
 <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors" onClick={onClose}>
 <X size={20} />
 </button>
 </div>

 <div className="p-4 sm:p-5 space-y-4">
 {loadingDetails ? (
 <DrawerSkeleton rows={4} />
 ) : (
 <>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(() => {
                const isPrivateModal = String(roomInfo.type || roomInfo.roomType || "").toLowerCase().includes("private");
                const modalOcc = isPrivateModal
                  ? Math.min(1, roomInfo.currentOccupancy || roomInfo.occupancy || 0)
                  : roomInfo.currentOccupancy || roomInfo.occupancy || 0;
                const modalCap = isPrivateModal ? 1 : (roomInfo.capacity || 1);
                const modalRate = Math.min(100, Math.round((modalOcc / modalCap) * 100));

                return (
                  <>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-1">Room Type</div>
                      <div className="text-sm font-medium text-foreground">{formatRoomType(roomInfo.type || roomInfo.roomType)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-1">Capacity</div>
                      <div className="text-sm font-medium text-foreground">{isPrivateModal ? "1 (Solo Room)" : `${roomInfo.capacity || 0} beds`}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-1">Committed Occupancy</div>
                      <div className="text-sm font-medium text-foreground">{isPrivateModal ? `${modalOcc} room` : modalOcc}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-1">Occupancy Rate</div>
                      <div className="text-sm font-medium text-foreground">{modalRate}%</div>
                    </div>
                  </>
                );
              })()}
 </div>

 {occupiedBeds?.length > 0 && (
 <div>
 <h3 className="text-sm font-semibold text-foreground mb-2">Occupied Beds</h3>
 <div className="space-y-2">
 {occupiedBeds.map((bed, idx) => (
 <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border border-l-4 ${occupiedTone.card}`}>
 <div className={`${occupiedTone.icon} mt-0.5`}>
 <BedDouble size={22} />
 </div>
 <div className="flex-1">
 <h4 className="text-sm font-semibold text-foreground mb-1">{formatBedLabel(bed)}</h4>
 <p className="text-sm text-foreground">
 Resident: {formatOccupantName(bed)}
 </p>
 {formatOccupantEmail(bed) && (
 <p className="text-sm text-muted-foreground">Email: {formatOccupantEmail(bed)}</p>
 )}
 {formatOccupiedSince(bed) && (
 <p className="text-xs text-muted-foreground">
 Since:{" "}
 {new Date(
 formatOccupiedSince(bed),
 ).toLocaleDateString()}
 </p>
 )}
 {formatExpectedVacancy(bed) && (
 <p className="text-xs font-semibold text-primary mt-1">
 Expected Vacancy:{" "}
 {new Date(formatExpectedVacancy(bed)).toLocaleDateString(undefined, {
 month: "short",
 day: "numeric",
 year: "numeric",
 })}
 {formatDaysRemaining(bed) != null && (
 <span className="ml-1 opacity-90 font-medium">
 ({formatDaysRemaining(bed) <= 0 ? "Overdue / Due today" : `${formatDaysRemaining(bed)} days left`})
 </span>
 )}
 </p>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {reservedBeds?.length > 0 && (
 <div>
 <h3 className="text-sm font-semibold text-foreground mb-2">Reserved Beds</h3>
 <div className="space-y-2">
 {reservedBeds.map((bed, idx) => (
 <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border border-l-4 ${reservedTone.card}`}>
 <div className={`${reservedTone.icon} mt-0.5`}>
 <Lock size={22} />
 </div>
 <div className="flex-1">
 <h4 className="text-sm font-semibold text-foreground mb-1">{formatBedLabel(bed)}</h4>
 <p className="text-sm text-foreground">
 Reserved by: {bed.reservedBy?.userName || bed.occupant?.name || "Unknown"}
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {lockedBeds?.length > 0 && (
 <div>
 <h3 className="text-sm font-semibold text-foreground mb-2">Locked Beds</h3>
 <div className="space-y-2">
 {lockedBeds.map((bed, idx) => (
 <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border border-l-4 ${lockedTone.card}`}>
 <div className={`${lockedTone.icon} mt-0.5`}>
 <Lock size={22} />
 </div>
 <div className="flex-1">
 <h4 className="text-sm font-semibold text-foreground mb-1">{formatBedLabel(bed)}</h4>
 <p className="text-sm text-foreground">Temporarily held</p>
 {bed.lockExpiresAt && (
 <p className="text-xs text-muted-foreground">
 Expires: {new Date(bed.lockExpiresAt).toLocaleString()}
 </p>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {maintenanceBeds?.length > 0 && (
 <div>
 <h3 className="text-sm font-semibold text-foreground mb-2">Maintenance Beds</h3>
 <div className="space-y-2">
 {maintenanceBeds.map((bed, idx) => (
 <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border border-l-4 ${maintenanceTone.card}`}>
 <div className={`${maintenanceTone.icon} mt-0.5`}>
 <Settings size={22} />
 </div>
 <div className="flex-1">
 <h4 className="text-sm font-semibold text-foreground mb-1">{formatBedLabel(bed)}</h4>
 <p className="text-sm text-foreground">Unavailable due to maintenance</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {availableBeds?.length > 0 && (
 <div>
 <h3 className="text-sm font-semibold text-foreground mb-2">Available Beds ({availableBeds.length})</h3>
 <div className="space-y-2">
 {availableBeds.map((bed, idx) => (
 <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border border-l-4 ${availableTone.card}`}>
 <div className={`${availableTone.icon} mt-0.5`}>
 <Unlock size={22} />
 </div>
 <div className="flex-1">
 <h4 className="text-sm font-semibold text-foreground mb-1">{formatBedLabel(bed)}</h4>
 <p className={`text-sm ${availableTone.accent}`}>
 Available for booking
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {!occupiedBeds.length && !reservedBeds.length && !availableBeds.length && !lockedBeds.length && !maintenanceBeds.length && (
 <p className="text-center text-sm text-muted-foreground py-6">
 No detailed bed information available for this room.
 </p>
 )}
 </>
 )}
 </div>

 <div className="px-4 sm:px-5 py-3 border-t border-border bg-muted/20">
 <button className="w-full px-4 py-2 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity text-sm font-medium" onClick={onClose}>
 Close
 </button>
 </div>
 </div>
 </div>
 );

 if (typeof document === "undefined") {
 return modal;
 }

 return createPortal(modal, document.body);
}
