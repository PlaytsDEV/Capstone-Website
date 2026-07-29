import React, { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

/**
 * Redesigned Room Card — soft shadows, bed availability dots, muted type badge.
 */
const RoomCard = React.memo(({ room, onClick, selectedLeaseTermFilter = "All" }) => {
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
  // Prefer bed-level count as ground truth when beds data is present.
  // Using Math.max with currentOccupancy here re-introduces the same stale-counter
  // drift that causes the "Full" label when beds are actually available.
  const occupied = room.beds?.length > 0 ? occupiedFromBeds : Math.max(room.currentOccupancy ?? 0, occupiedFromBeds);
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

  const minMonths = room.longTermLeaseMinMonths ?? 6;

  const getFlyerRates = (roomType, targetRoom = {}) => {
    const norm = String(roomType || "").toLowerCase();
    let regularLong = targetRoom.regularLongRate ?? 6000;
    let regularShort = targetRoom.regularShortRate ?? 7000;
    let defaultDiscount = targetRoom.quadrupleDiscountPercent ?? 10;

    if (norm.includes("double")) {
      regularLong = targetRoom.regularLongRate ?? 9000;
      regularShort = targetRoom.regularShortRate ?? 10000;
      defaultDiscount = targetRoom.doubleDiscountPercent ?? 20;
    } else if (norm.includes("private")) {
      regularLong = targetRoom.regularLongRate ?? 15000;
      regularShort = targetRoom.regularShortRate ?? 16000;
      defaultDiscount = targetRoom.privateDiscountPercent ?? 10;
    } else {
      regularLong = targetRoom.regularLongRate ?? 6000;
      regularShort = targetRoom.regularShortRate ?? 7000;
      defaultDiscount = targetRoom.quadrupleDiscountPercent ?? 10;
    }

    const discountPercent = typeof targetRoom.longTermDiscountPercent === "number"
      ? targetRoom.longTermDiscountPercent
      : defaultDiscount;

    let longTerm = typeof targetRoom.monthlyPrice === "number" && targetRoom.monthlyPrice > 0
      ? targetRoom.monthlyPrice
      : Math.round(regularLong * (1 - discountPercent / 100));

    let shortTerm = typeof targetRoom.shortTermRate === "number" && targetRoom.shortTermRate > 0
      ? targetRoom.shortTermRate
      : (typeof targetRoom.price === "number" && targetRoom.price > 0 ? targetRoom.price : Math.round(regularShort * (1 - discountPercent / 100)));

    if (discountPercent > 0 && discountPercent < 100) {
      regularLong = Math.round(longTerm / (1 - discountPercent / 100));
      regularShort = Math.round(shortTerm / (1 - discountPercent / 100));
    }

    return {
      regularShort,
      shortTerm,
      regularLong,
      longTerm,
      discountPercent,
    };
  };

  const flyer = getFlyerRates(room.type, room);
  const isDiscountEnabled = room.isDiscountEnabled !== false;

  const activeRegularRate = flyer.regularLong;
  const longTermRate = !isDiscountEnabled ? flyer.regularLong : (room.monthlyPrice || flyer.longTerm);
  const shortTermRate = !isDiscountEnabled ? flyer.regularShort : (room.shortTermRate || flyer.shortTerm);

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
          alt={room.title || "Room photo"}
          loading="lazy"
          decoding="async"
        />

        {/* Discount Badge */}
        {discountPercent > 0 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md bg-amber-500 text-slate-950 z-10">
            {discountPercent}% OFF ({minMonths}+ mos)
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

        {/* Transparent Price UI with Lease Term Awareness */}
        <div className="ca-card-price-container flex items-center flex-wrap gap-1.5">
          {selectedLeaseTermFilter === "shortTerm" ? (
            <>
              <span className="ca-price-primary">
                ₱{shortTermRate.toLocaleString()}
              </span>
              <span className="ca-price-unit">/ mo</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                Short-Term
              </span>
            </>
          ) : selectedLeaseTermFilter === "longTerm" ? (
            <>
              <span className="ca-price-primary">
                ₱{longTermRate.toLocaleString()}
              </span>
              <span className="ca-price-unit">/ mo</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                Long-Term Rate
              </span>
            </>
          ) : (
            <>
              {shortTermRate > longTermRate && (
                <span className="ca-price-prefix">Starts at</span>
              )}
              <span className="ca-price-primary">
                ₱{longTermRate.toLocaleString()}
              </span>
              <span className="ca-price-unit">/ mo</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 border border-amber-500/20 dark:text-amber-300">
                Flexi-Lease
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default RoomCard;
