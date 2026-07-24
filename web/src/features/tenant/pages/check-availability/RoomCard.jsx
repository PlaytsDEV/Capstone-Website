import React, { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

/**
 * Redesigned Room Card — soft shadows, bed availability dots, muted type badge.
 */
const RoomCard = React.memo(({ room, onClick }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = room.images?.length ? room.images : [room.image];

  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };
  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Reserved beds are not open, even when room occupancy has not changed yet.
  const totalBeds = room.capacity || room.beds?.length || parseInt(room.occupancy?.split("/")[1]) || 0;
  const occupiedFromBeds = room.beds
    ? room.beds.filter((b) => String(b.status || "").toLowerCase() === "occupied" || (b.status === undefined && b.available === false)).length
    : parseInt(room.occupancy?.split("/")[0]) || 0;
  const occupied = Math.max(room.currentOccupancy ?? 0, occupiedFromBeds);
  const reservedBeds = room.reservedBeds ?? (
    room.beds
      ? room.beds.filter((b) => String(b.status || "").toLowerCase() === "reserved").length
      : 0
  );
  const lockedBeds = room.unavailableBeds ?? (
    room.beds
      ? room.beds.filter((b) => ["locked", "maintenance"].includes(String(b.status || "").toLowerCase())).length
      : 0
  );
  const availableBeds = room.availableBeds ?? Math.max(0, totalBeds - occupied - reservedBeds - lockedBeds);
  const takenBeds = Math.min(totalBeds, occupied);
  const availabilityLabel =
    availableBeds === 0 && lockedBeds > 0 ? "Unavailable" : "Full";

  const isPrivate = String(room.type || "").toLowerCase().includes("private");

  // Pricing & Discount logic strictly aligned with official flyer
  const getFlyerRates = (roomType) => {
    const norm = String(roomType || "").toLowerCase();
    if (norm.includes("double")) {
      return { regularShort: 10000, shortTerm: 8000, regularLong: 9000, longTerm: 7200, discountPercent: 20 };
    }
    if (norm.includes("private")) {
      return { regularShort: 16000, shortTerm: 14400, regularLong: 15000, longTerm: 13500, discountPercent: 10 };
    }
    return { regularShort: 7000, shortTerm: 6300, regularLong: 6000, longTerm: 5400, discountPercent: 10 };
  };

  const flyer = getFlyerRates(room.type);
  const isDiscountEnabled = room.isDiscountEnabled !== false;

  const shortTermRate = room.shortTermRate || flyer.shortTerm || flyer.regularShort;
  const activeRegularRate = flyer.regularLong;
  const longTermRate = !isDiscountEnabled
    ? activeRegularRate
    : (room.monthlyPrice || room.price || flyer.longTerm);

  const activeFlyerDiscount = (isDiscountEnabled && activeRegularRate > longTermRate)
    ? (activeRegularRate - longTermRate)
    : 0;

  const discountPercent = (isDiscountEnabled && activeRegularRate > 0 && activeFlyerDiscount > 0)
    ? Math.round((activeFlyerDiscount / activeRegularRate) * 100)
    : 0;

  return (
    <div className="ca-card" onClick={onClick}>
      {/* Image carousel */}
      <div className="ca-card-image-wrap">
        <img
          src={images[currentImageIndex]}
          alt={room.title}
          loading="lazy"
        />

        {/* Discount Badge */}
        {discountPercent > 0 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md bg-amber-500 text-slate-950 z-10">
            {discountPercent}% OFF (6+ mos)
          </div>
        )}

        {/* Nav buttons (visible on hover via CSS) */}
        {images.length > 1 && (
          <>
            <button
              className="ca-card-nav-btn left"
              onClick={prevImage}
              type="button"
              aria-label="Previous image"
            >
              <ChevronLeft style={{ width: 16, height: 16, color: "#374151" }} />
            </button>
            <button
              className="ca-card-nav-btn right"
              onClick={nextImage}
              type="button"
              aria-label="Next image"
            >
              <ChevronRight style={{ width: 16, height: 16, color: "#374151" }} />
            </button>
          </>
        )}

        {/* Dots indicator */}
        {images.length > 1 && (
          <div className="ca-card-dots">
            {images.map((_, index) => (
              <div
                key={index}
                className={`ca-card-dot ${index === currentImageIndex ? "active" : ""}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="ca-card-body">
        <div className="ca-card-title">
          {room.title}
          <span className="ca-type-badge">{room.type}</span>
        </div>

        {/* Bed availability status */}
        <div className="ca-bed-dots">
          {!isPrivate && (
            <div className="dots">
              {/* Available beds first (green) */}
              {Array.from({ length: availableBeds }).map((_, i) => (
                <div key={`a-${i}`} className="ca-bed-dot available" />
              ))}
              {/* Taken beds (red) */}
              {Array.from({ length: takenBeds }).map((_, i) => (
                <div key={`t-${i}`} className="ca-bed-dot taken" />
              ))}
              {Array.from({ length: reservedBeds }).map((_, i) => (
                <div key={`r-${i}`} className="ca-bed-dot reserved" />
              ))}
              {Array.from({ length: lockedBeds }).map((_, i) => (
                <div key={`l-${i}`} className="ca-bed-dot locked" />
              ))}
            </div>
          )}
          <span className="label">
            {isPrivate
              ? availableBeds > 0
                ? "Available"
                : availabilityLabel
              : availableBeds === 0
                ? availabilityLabel
                : `${availableBeds} of ${totalBeds} open`}
          </span>
        </div>

        {/* Location */}
        <div className="ca-card-location">
          <MapPin />
          <span>{room.branch}</span>
        </div>

        {/* Ultra-Minimalist Single Price UI */}
        <div className="ca-card-price-container">
          {shortTermRate > longTermRate && (
            <span className="ca-price-prefix">from</span>
          )}
          <span className="ca-price-primary">
            ₱{(longTermRate || shortTermRate).toLocaleString()}
          </span>
          <span className="ca-price-unit">/ mo</span>
        </div>
      </div>
    </div>
  );
});

export default RoomCard;
