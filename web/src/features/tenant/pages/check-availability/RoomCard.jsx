import React, { useState, useRef, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { getOptimizedUrl } from "../../../../shared/utils/imageOptimizer";

/**
 * Redesigned Room Card — soft shadows, bed availability dots, muted type badge.
 */
const RoomCard = React.memo(({ room, onClick, selectedLeaseTermFilter = "All" }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loadedMap, setLoadedMap] = useState({});   // { [index]: true } when fully loaded
  const debounceRef = useRef(false);

  const images = useMemo(() => {
    const rawImages = room.images?.length ? room.images : [room.image];
    return rawImages.map((src) => getOptimizedUrl(src));
  }, [room.images, room.image]);

  const navigate = useCallback((delta, e) => {
    e.stopPropagation();
    if (debounceRef.current) return;
    debounceRef.current = true;
    setCurrentImageIndex((prev) => (prev + delta + images.length) % images.length);
    setTimeout(() => { debounceRef.current = false; }, 150);
  }, [images.length]);

  const nextImage = useCallback((e) => navigate(1, e), [navigate]);
  const prevImage = useCallback((e) => navigate(-1, e), [navigate]);

  const isCurrentLoaded = Boolean(loadedMap[currentImageIndex]);

  // Memoized bed metrics & rate calculations
  const {
    totalBeds,
    reservedBeds,
    lockedBeds,
    availableBeds,
    takenBeds,
    availabilityLabel,
    isPrivate,
    minMonths,
    shortTermRate,
    longTermRate,
    discountPercent,
  } = useMemo(() => {
    const totalBedsCount = room.capacity || room.beds?.length || parseInt(room.occupancy?.split("/")[1]) || 0;
    const occupiedFromBedsCount = room.beds
      ? room.beds.filter((b) => String(b.status || "").toLowerCase() === "occupied" || (b.status === undefined && b.available === false)).length
      : parseInt(room.occupancy?.split("/")[0]) || 0;
    const occupiedCount = room.beds?.length > 0 ? occupiedFromBedsCount : Math.max(room.currentOccupancy ?? 0, occupiedFromBedsCount);
    const reservedBedsCount = room.reservedBeds ?? (
      room.beds
        ? room.beds.filter((b) => String(b.status || "").toLowerCase() === "reserved").length
        : 0
    );
    const lockedBedsCount = room.unavailableBeds ?? (
      room.beds
        ? room.beds.filter((b) => ["locked", "maintenance"].includes(String(b.status || "").toLowerCase())).length
        : 0
    );
    const availableBedsCount = room.availableBeds ?? Math.max(0, totalBedsCount - occupiedCount - reservedBedsCount - lockedBedsCount);
    const takenBedsCount = Math.min(totalBedsCount, occupiedCount);
    const availLabel = availableBedsCount === 0 && lockedBedsCount > 0 ? "Unavailable" : "Full";

    const privateType = String(room.type || "").toLowerCase().includes("private");
    const minMonthsVal = room.longTermLeaseMinMonths ?? 6;

    // Flyer calculation logic
    const norm = String(room.type || "").toLowerCase();
    let regularLong = room.regularLongRate ?? 6000;
    let regularShort = room.regularShortRate ?? 7000;
    let defaultDiscount = room.quadrupleDiscountPercent ?? 10;

    if (norm.includes("double")) {
      regularLong = room.regularLongRate ?? 9000;
      regularShort = room.regularShortRate ?? 10000;
      defaultDiscount = room.doubleDiscountPercent ?? 20;
    } else if (norm.includes("private")) {
      regularLong = room.regularLongRate ?? 15000;
      regularShort = room.regularShortRate ?? 16000;
      defaultDiscount = room.privateDiscountPercent ?? 10;
    }

    const discountPercentConfig = typeof room.longTermDiscountPercent === "number"
      ? room.longTermDiscountPercent
      : defaultDiscount;

    let longTermCalculated = typeof room.monthlyPrice === "number" && room.monthlyPrice > 0
      ? room.monthlyPrice
      : Math.round(regularLong * (1 - discountPercentConfig / 100));

    let shortTermCalculated = typeof room.shortTermRate === "number" && room.shortTermRate > 0
      ? room.shortTermRate
      : (typeof room.price === "number" && room.price > 0 ? room.price : Math.round(regularShort * (1 - discountPercentConfig / 100)));

    if (discountPercentConfig > 0 && discountPercentConfig < 100) {
      regularLong = Math.round(longTermCalculated / (1 - discountPercentConfig / 100));
      regularShort = Math.round(shortTermCalculated / (1 - discountPercentConfig / 100));
    }

    const discountEnabled = room.isDiscountEnabled !== false;
    const activeRegRate = regularLong;
    const finalLongTermRate = !discountEnabled ? regularLong : (room.monthlyPrice || longTermCalculated);
    const finalShortTermRate = !discountEnabled ? regularShort : (room.shortTermRate || shortTermCalculated);

    const activeDiscount = (discountEnabled && activeRegRate > finalLongTermRate)
      ? (activeRegRate - finalLongTermRate)
      : 0;

    const discountPct = (discountEnabled && activeRegRate > 0 && activeDiscount > 0)
      ? Math.round((activeDiscount / activeRegRate) * 100)
      : 0;

    return {
      totalBeds: totalBedsCount,
      reservedBeds: reservedBedsCount,
      lockedBeds: lockedBedsCount,
      availableBeds: availableBedsCount,
      takenBeds: takenBedsCount,
      availabilityLabel: availLabel,
      isPrivate: privateType,
      minMonths: minMonthsVal,
      shortTermRate: finalShortTermRate,
      longTermRate: finalLongTermRate,
      discountPercent: discountPct,
    };
  }, [room]);

  return (
    <div className="ca-card" onClick={onClick}>
      {/* Image carousel */}
      <div className="ca-card-image-wrap">
        {/* Shimmer overlay — visible until this image is fully preloaded */}
        {!isCurrentLoaded && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              background:
                "linear-gradient(90deg,var(--skeleton-base,#e2e8f0) 25%,var(--skeleton-shine,#f1f5f9) 50%,var(--skeleton-base,#e2e8f0) 75%)",
              backgroundSize: "200% 100%",
              animation: "caCardShimmer 1.4s infinite",
              borderRadius: "inherit",
            }}
          />
        )}

        <img
          src={images[currentImageIndex]}
          alt={room.title || "Room photo"}
          loading={currentImageIndex === 0 ? "eager" : "lazy"}
          fetchpriority={currentImageIndex === 0 ? "high" : "auto"}
          decoding="async"
          onLoad={() => setLoadedMap((prev) => ({ ...prev, [currentImageIndex]: true }))}
          onError={() => setLoadedMap((prev) => ({ ...prev, [currentImageIndex]: true }))}
          style={{
            opacity: isCurrentLoaded ? 1 : 0,
            transition: "opacity 0.3s ease",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />

        {/* Discount Badge */}
        {discountPercent > 0 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md bg-amber-500 text-slate-950 z-10">
            {discountPercent}% OFF
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
