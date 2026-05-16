import React from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Bed,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Home,
  Image as ImageIcon,
  Maximize2,
  Wallet,
  X,
} from "lucide-react";
import { formatBranch, formatRoomType } from "../../../../shared/utils/formatDate";
import { getRoomImages as getFallbackRoomImages } from "../check-availability/checkAvailabilityConstants";
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

const toTitle = (value, fallback = "") => {
  const text = toDisplayString(value, fallback).trim();
  if (!text) return fallback;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

const formatCurrency = (value) => `\u20b1${toFiniteNumber(value).toLocaleString()}`;

const getRoomName = (room) =>
  toDisplayString(room?.name || room?.roomNumber || room?.title || room?.id, "N/A");

const getSelectedBedLabel = (selectedBed) => {
  if (!selectedBed) return "No bed selected";
  const positionText = toDisplayString(selectedBed.position);
  const position = positionText
    ? `${toTitle(positionText)} Bed`
    : "Selected Bed";
  const bedId = toDisplayString(selectedBed.id);
  return bedId ? `${position} (${bedId})` : position;
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

/**
 * Step 1 - Room review summary
 */
const ReservationSummaryStep = ({
  reservationData,
  onNext,
  onChangeRoom,
  readOnly,
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = React.useState(0);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const room = reservationData?.room || {};
  const selectedBed = reservationData?.selectedBed;
  const applianceFees = toFiniteNumber(reservationData?.applianceFees, 0);
  const monthlyRent = toFiniteNumber(room.price || room.monthlyPrice, 0);
  const estimatedMonthlyTotal = monthlyRent + applianceFees;
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

  const closeViewer = () => {
    setViewerOpen(false);
  };

  return (
    <div className="reservation-card">
      <div className="main-header">
        <div className="main-header-badge"><span>Step 1 · Getting Started</span></div>
        <h2 className="main-header-title">Room Summary</h2>
        <p className="main-header-subtitle">
          Review the details of your selected room below. Once confirmed, you'll
          proceed to choose your viewing or move-in preference.
        </p>
      </div>

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
              <img
                src={activePhoto}
                alt={`${getRoomName(room)} photo ${activePhotoIndex + 1}`}
                loading="lazy"
              />
              <span className="rf-room-photo-open-hint">
                <Maximize2 size={14} />
                View
              </span>
            </button>

            {roomImages.length > 1 && (
              <>
                <button
                  type="button"
                  className="rf-room-photo-nav rf-room-photo-nav-prev"
                  onClick={showPreviousPhoto}
                  aria-label="Previous room photo"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="rf-room-photo-nav rf-room-photo-nav-next"
                  onClick={showNextPhoto}
                  aria-label="Next room photo"
                >
                  <ChevronRight size={18} />
                </button>
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
            <button type="button" onClick={closeViewer} aria-label="Close photo viewer">
              <X size={17} />
            </button>
          </div>

          <div className="rf-photo-viewer-stage" onClick={(event) => event.stopPropagation()}>
            <img
              src={activePhoto}
              alt={`${getRoomName(room)} enlarged photo ${activePhotoIndex + 1}`}
            />
          </div>
        </div>,
        document.body,
      )}

      <div className="rf-summary-grid rf-room-review-grid">
        <section className="content-card rf-summary-panel rf-summary-panel-main">
          <div className="card-section-title">
            <div className="icon"><Home size={15} /></div>
            Room Information
          </div>

          <div className="summary-section">
            <div className="summary-row">
              <span className="summary-label">Branch</span>
              <span className="summary-value">{formatBranch(room.branch)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Room Type</span>
              <span className="summary-value">{formatRoomType(room.type)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Room</span>
              <span className="summary-value">{getRoomName(room)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Floor</span>
              <span className="summary-value">{floorLabel ? `Floor ${floorLabel}` : "To be confirmed"}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Selected Bed</span>
              <span className="summary-value">{getSelectedBedLabel(selectedBed)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Availability</span>
              <span className={`rf-status-pill rf-status-pill-${availabilityTone}`}>
                {availabilityLabel}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Available Slots</span>
              <span className="summary-value">
                {availableSlots === null ? "To be confirmed" : `${availableSlots} of ${capacityLabel}`}
              </span>
            </div>
          </div>
        </section>

        <section className="content-card rf-summary-panel">
          <div className="card-section-title">
            <div className="icon"><Wallet size={15} /></div>
            Payment Preview
          </div>

          <div className="summary-section">
            <div className="summary-row">
              <span className="summary-label">Monthly Rent</span>
              <span className="summary-value">{formatCurrency(monthlyRent)}/month</span>
            </div>
            {selectedAppliances.length > 0 && (
              <div className="summary-row">
                <span className="summary-label">Selected Appliances</span>
                <span className="summary-value">
                  {selectedAppliances
                    .map(formatSelectedAppliance)
                    .join(", ")}
                </span>
              </div>
            )}
            {applianceFees > 0 && (
              <div className="summary-row">
                <span className="summary-label">Appliance Fees</span>
                <span className="summary-value">{formatCurrency(applianceFees)}/month</span>
              </div>
            )}
            <div className="summary-row">
              <span className="summary-label">Reservation Fee</span>
              <span className="summary-value">{formatCurrency(reservationFeeAmount)} due later</span>
            </div>
            <div className="total-section">
              <span>Estimated Monthly Total</span>
              <span className="total-amount">{formatCurrency(estimatedMonthlyTotal)}</span>
            </div>
          </div>
        </section>
      </div>

      {amenities.length > 0 && (
        <section className="content-card rf-summary-panel">
          <div className="card-section-title">
            <div className="icon"><Bed size={15} /></div>
            Room Includes
          </div>

          <div className="rf-inclusion-list">
            {amenities.map((amenity) => (
              <span className="rf-inclusion-item" key={amenity}>
                <CheckCircle size={14} />
                {amenity}
              </span>
            ))}
          </div>
        </section>
      )}

      {!readOnly && (
        <div className="info-box" style={{ marginTop: 24, marginBottom: 24 }}>
          <div className="info-box-title">What happens next?</div>
          <div className="info-text">
            After confirming, you'll choose between a physical visit, 2D remote
            viewing, or an urgent move-in review request before submitting your
            tenant application.
          </div>
        </div>
      )}

      {readOnly && (
        <div className="rf-locked-banner">
          <div className="info-box-title">This step is locked</div>
          <div className="info-text">{ROOM_SELECTION_LOCKED_MESSAGE}</div>
        </div>
      )}

      {!readOnly && (
        <div className="stage-buttons rf-summary-actions">
          {onChangeRoom && (
            <button type="button" onClick={onChangeRoom} className="btn btn-secondary">
              <ArrowLeft size={16} />
              Change Selected Room
            </button>
          )}
          <button type="button" onClick={onNext} className="btn btn-primary">
            Confirm Room &amp; Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default ReservationSummaryStep;
