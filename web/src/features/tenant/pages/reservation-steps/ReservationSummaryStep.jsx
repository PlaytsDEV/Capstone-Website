import React from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bed,
  ChevronLeft,
  ChevronRight,
  Home,
  Image as ImageIcon,
  Maximize2,
  Wallet,
  X,
  MapPin,
  AlertCircle,
  Wind,
  Wifi,
  BookOpen,
  UserCheck,
  Box,
  ShowerHead,
  Bath,
  CheckCircle2,
  Layers,
  Sparkles,
  Users,
} from "lucide-react";
import { formatBranch, formatRoomType } from "../../../../shared/utils/formatDate";
import { getRoomImages as getFallbackRoomImages } from "../check-availability/checkAvailabilityConstants";
import { getBedDisplayLabel } from "../../../../shared/utils/bedIdentifier";
import { getResolvedMonthlyRate, isPricingDisplayUsable } from "../../utils/pricingDisplayHelpers";
import { ROOM_SELECTION_LOCKED_MESSAGE } from "../../utils/reservationRoomLock";

const toDisplayString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const text = value.map((item) => toDisplayString(item)).filter(Boolean).join(", ");
    return text || fallback;
  }
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

const formatCurrency = (value) => `\u20b1${toFiniteNumber(value).toLocaleString()}`;

const getRoomName = (room) =>
  toDisplayString(room?.name || room?.roomNumber || room?.title || room?.id, "N/A");

const getSelectedBedLabel = (selectedBed) => {
  if (!selectedBed) return "No bed selected";
  return getBedDisplayLabel(selectedBed);
};

const getAvailableSlots = (room) => {
  if (Number.isFinite(Number(room?.availableSlots))) {
    return Number(room.availableSlots);
  }
  const capacity = Number(room?.capacity);
  const currentOccupancy = Number(room?.currentOccupancy);
  if (Number.isFinite(capacity) && Number.isFinite(currentOccupancy)) {
    return Math.max(0, capacity - currentOccupancy);
  }
  if (Array.isArray(room?.beds)) {
    return room.beds.filter((bed) => toDisplayString(bed?.status).toLowerCase() === "available").length;
  }
  return null;
};

const getAvailabilityLabel = (room, selectedBed) => {
  const beds = Array.isArray(room?.beds) ? room.beds : [];
  const selectedBedId = toDisplayString(selectedBed?.id);
  const matchedBed = selectedBedId
    ? beds.find((bed) => toDisplayString(bed?.id) === selectedBedId)
    : null;
  const bedStatus = toDisplayString(selectedBed?.status || matchedBed?.status).toLowerCase();

  if (bedStatus === "locked") return "Temporarily held";
  if (bedStatus === "reserved") return "Reserved";
  if (bedStatus === "occupied") return "Occupied";
  if (bedStatus === "maintenance") return "Under maintenance";
  if (room?.available === false || getAvailableSlots(room) === 0) return "Unavailable";
  return "Available";
};

const getAvailabilityTone = (label) => {
  const normalized = String(label).toLowerCase();
  if (normalized.includes("unavailable") || normalized.includes("occupied")) return "neutral";
  if (normalized.includes("available")) return "success";
  if (normalized.includes("held")) return "warning";
  return "neutral";
};

const getSummaryRoomImages = (room) => {
  const images = Array.isArray(room?.images)
    ? room.images.filter((image) => typeof image === "string" && image.trim())
    : [];
  if (typeof room?.image === "string" && room.image.trim()) images.unshift(room.image);
  const fallbackImages = getFallbackRoomImages(room?.type, room?.branch);
  return Array.from(new Set([...images, ...fallbackImages]));
};

const formatSelectedAppliance = (item) => {
  if (typeof item === "string") return item;
  const name = toDisplayString(item?.name, "Appliance");
  const quantity = toFiniteNumber(item?.quantity, 0);
  return `${name}${quantity > 0 ? ` x${quantity}` : ""}`;
};

const getAmenityIcon = (name) => {
  const normalized = String(name).toLowerCase();
  if (normalized.includes("air") || normalized.includes("ac") || normalized.includes("cooling")) return Wind;
  if (normalized.includes("wifi") || normalized.includes("internet")) return Wifi;
  if (normalized.includes("bed") || normalized.includes("mattress") || normalized.includes("bunk")) return Bed;
  if (normalized.includes("table") || normalized.includes("desk") || normalized.includes("study")) return BookOpen;
  if (normalized.includes("chair") || normalized.includes("seat")) return UserCheck;
  if (normalized.includes("cabinet") || normalized.includes("closet") || normalized.includes("wardrobe") || normalized.includes("storage")) return Box;
  if (normalized.includes("shower") || normalized.includes("water heater") || normalized.includes("heater")) return ShowerHead;
  if (normalized.includes("bath") || normalized.includes("restroom") || normalized.includes("toilet")) return Bath;
  return CheckCircle2;
};

/**
 * Reservation Summary Step
 */
const ReservationSummaryStep = ({ reservationData, onNext, onChangeRoom, readOnly }) => {
  const [activePhotoIndex, setActivePhotoIndex] = React.useState(0);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [showRoomChangeConfirm, setShowRoomChangeConfirm] = React.useState(false);
  const room = reservationData?.room || {};

  const selectedBed = reservationData?.selectedBed;
  const applianceFees = toFiniteNumber(reservationData?.applianceFees, 0);
  const pricingDisplay = reservationData?.pricingDisplay;
  const hasResolvedMonthlyRate = isPricingDisplayUsable(pricingDisplay);
  const monthlyRent = getResolvedMonthlyRate(pricingDisplay);
  const estimatedMonthlyTotal = hasResolvedMonthlyRate ? monthlyRent + applianceFees : null;
  const reservationFeeAmount = toFiniteNumber(reservationData?.reservationFeeAmount, 2000);
  const availableSlots = getAvailableSlots(room);
  const availabilityLabel = getAvailabilityLabel(room, selectedBed);
  const availabilityTone = getAvailabilityTone(availabilityLabel);
  const amenities = Array.isArray(room.amenities)
    ? room.amenities.map((amenity) => toDisplayString(amenity)).filter(Boolean)
    : [];
  const roomImages = getSummaryRoomImages(room);
  const selectedAppliances = Array.isArray(reservationData?.selectedAppliances)
    ? reservationData.selectedAppliances
    : [];
  const activePhoto = roomImages[activePhotoIndex] || roomImages[0];
  const floorLabel = toDisplayString(room.floor);
  const capacityLabel = Number.isFinite(Number(room.capacity))
    ? Number(room.capacity)
    : toDisplayString(room.capacity, "?");

  const showPreviousPhoto = () => {
    setActivePhotoIndex((current) =>
      current === 0 ? roomImages.length - 1 : current - 1,
    );
  };

  const showNextPhoto = () => {
    setActivePhotoIndex((current) =>
      current === roomImages.length - 1 ? 0 : current + 1,
    );
  };

  const closeViewer = () => setViewerOpen(false);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header (Strictly Solid Colors, No Gradients) */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
            Step 1 · Getting Started
          </span>
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-1 flex items-center gap-3">
            <div className="p-2.5 rounded-xl shadow-sm flex items-center justify-center">
              <Home className="w-5 h-5" />
            </div>
            Room Summary
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Review the specifications and pricing preview for your selected dormitory space before scheduling your visit or move-in preference.
          </p>
        </div>
      </div>

      {/* Photos Carousel */}
      {roomImages.length > 0 && (
        <section className="content-card rf-room-photos-card">
          <div className="card-section-title">
            <div className="icon"><ImageIcon size={15} /></div>
            Room Photos
          </div>

          <div className="rf-room-photo-carousel">
            <button
              type="button"
              className="rf-room-photo-open"
              onClick={() => setViewerOpen(true)}
              aria-label="Open room photo viewer"
            >
              <img src={activePhoto} alt={`${getRoomName(room)} photo ${activePhotoIndex + 1}`} loading="lazy" className="img-reveal" onLoad={(e) => e.currentTarget.classList.add("loaded")} />
              <span className="rf-room-photo-open-hint"><Maximize2 size={14} />View</span>
            </button>

            {roomImages.length > 1 && (
              <>
                <button type="button" className="rf-room-photo-nav rf-room-photo-nav-prev" onClick={showPreviousPhoto} aria-label="Previous room photo"><ChevronLeft size={18} /></button>
                <button type="button" className="rf-room-photo-nav rf-room-photo-nav-next" onClick={showNextPhoto} aria-label="Next room photo"><ChevronRight size={18} /></button>
                <div className="rf-room-photo-dots" aria-label="Room photo slides">
                  {roomImages.map((image, index) => (
                    <button
                      type="button"
                      key={image}
                      className={`rf-room-photo-dot ${index === activePhotoIndex ? "active" : ""}`}
                      onClick={() => setActivePhotoIndex(index)}
                      aria-label={`Show room photo ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {viewerOpen && createPortal(
        <div className="rf-photo-viewer" role="dialog" aria-modal="true" onClick={closeViewer}>
          <div className="rf-photo-viewer-toolbar" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={closeViewer} aria-label="Close photo viewer"><X size={17} /></button>
          </div>

          <div className="rf-photo-viewer-stage" onClick={(event) => event.stopPropagation()}>
            <img src={activePhoto} alt={`${getRoomName(room)} enlarged photo ${activePhotoIndex + 1}`} className="img-reveal" onLoad={(e) => e.currentTarget.classList.add("loaded")} />
          </div>
        </div>,
        document.body,
      )}

      {/* Room Specifications Card (Single Column Stack) */}
      <section className="content-card rf-summary-panel">
        <div className="card-section-title">
          <div className="icon"><Home size={15} /></div>
          Room Specifications
        </div>

        <div className="summary-section">
          <div className="summary-row">
            <span className="summary-label">Branch</span>
            <span className="summary-value flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {formatBranch(room.branch)}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Room Type</span>
            <span className="summary-value">{formatRoomType(room.type)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Room Designation</span>
            <span className="summary-value font-bold">{getRoomName(room)}</span>
          </div>
          {floorLabel && (
            <div className="summary-row">
              <span className="summary-label">Floor Location</span>
              <span className="summary-value">Floor {floorLabel}</span>
            </div>
          )}
          <div className="summary-row">
            <span className="summary-label">Selected Bed</span>
            <span className="summary-value font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Bed className="w-3.5 h-3.5 text-amber-600" />
              {getSelectedBedLabel(selectedBed)}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Capacity</span>
            <span className="summary-value text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {capacityLabel} Beds total
            </span>
          </div>
        </div>
      </section>

      {/* Room Features & Amenities */}
      {amenities.length > 0 && (
        <section className="content-card rf-summary-panel">
          <div className="card-section-title">
            <div className="icon"><Layers size={15} /></div>
            Room Features & Inclusions
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
            {amenities.map((amenity) => {
              const IconComponent = getAmenityIcon(amenity);
              return (
                <div
                  key={amenity}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                >
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                    <IconComponent size={16} />
                  </div>
                  <span className="text-xs font-semibold leading-tight">{amenity}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Pricing Card (Single Column Stack) */}
      <section className="content-card rf-summary-panel">
        <div className="card-section-title">
          <div className="icon"><Wallet size={15} /></div>
          Price
        </div>

        <div className="summary-section">
          <div className="summary-row">
            <span className="summary-label">Monthly Rent</span>
            <span className="summary-value font-semibold">
              {hasResolvedMonthlyRate ? `${formatCurrency(monthlyRent)} / month` : "Calculated upon review"}
            </span>
          </div>

          {selectedAppliances.length > 0 && (
            <div className="summary-row">
              <span className="summary-label">Add-on Appliances</span>
              <span className="summary-value">{selectedAppliances.map(formatSelectedAppliance).join(", ")}</span>
            </div>
          )}

          {applianceFees > 0 && (
            <div className="summary-row">
              <span className="summary-label">Appliance Monthly Fee</span>
              <span className="summary-value text-slate-700 dark:text-slate-300">{formatCurrency(applianceFees)} / month</span>
            </div>
          )}

          <div className="summary-row">
            <span className="summary-label">Reservation Fee Deposit</span>
            <span className="summary-value text-slate-800 dark:text-slate-200 text-right">
              {formatCurrency(reservationFeeAmount)}
              <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                Credited toward 1st month rent
              </span>
            </span>
          </div>

          <div className="total-section mt-4 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide font-medium text-zinc-900">
  Estimated Monthly Total
</span>
<span className="text-[11px] text-zinc-800/70 font-normal">
  Excludes utility water/electricity share
</span>
            </div>
            <span className="total-amount text-xl font-bold">
              {hasResolvedMonthlyRate ? formatCurrency(estimatedMonthlyTotal) : "To be confirmed"}
            </span>
          </div>
        </div>
      </section>

      {readOnly && (
        <div className="rf-locked-banner">
          <div className="info-box-title">This step is locked</div>
          <div className="info-text">{ROOM_SELECTION_LOCKED_MESSAGE}</div>
        </div>
      )}

      {/* Navigation Actions */}
      {!readOnly && (
        <div className="stage-buttons rf-summary-actions pt-2" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            {onChangeRoom && (
              <button
                type="button"
                onClick={() => {
                  if (reservationData?.visitDate || reservationData?.visitScheduledAt) {
                    setShowRoomChangeConfirm(true);
                  } else {
                    onChangeRoom();
                  }
                }}
                className="btn btn-secondary"
                style={{ marginRight: 8 }}
              >
                <ArrowLeft size={16} /> Change Selected Room
              </button>
            )}
          </div>

          <div>
            <button type="button" onClick={onNext} className="btn btn-success">
              Confirm & Continue <ArrowRight size={16} style={{ marginLeft: 8 }} />
            </button>
          </div>
        </div>
      )}

      {/* Room Change Confirmation Modal */}
      {showRoomChangeConfirm && createPortal(
        <div className="rf-photo-viewer" role="dialog" aria-modal="true" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 12%, transparent)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-4 border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Change Selected Room?</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Changing your room will cancel your currently scheduled room visit and require selecting a new visit slot for the new room.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                onClick={() => setShowRoomChangeConfirm(false)}
              >
                Keep Current Room
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-xl transition-colors shadow-sm"
                onClick={() => {
                  setShowRoomChangeConfirm(false);
                  onChangeRoom();
                }}
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ReservationSummaryStep;
