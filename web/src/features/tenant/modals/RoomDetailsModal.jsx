import { useState } from "react";
import {
  AlertCircle,
  Bed,
  Calculator,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Info,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  X,
  Zap,
} from "lucide-react";
import SpotlightCard from "../components/SpotlightCard";
import BedSelector from "../components/BedSelector";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import { showNotification } from "../../../shared/utils/notification";
import { LEASE_OPTIONS } from "../pages/reservation-steps/applicationFormConstants";

// ─── Helpers ──────────────────────────────────────────────────

function getAvailabilityMeta(room) {
  const beds = room.beds || [];
  const totalBeds = room.capacity || beds.length || 0;
  const availableBeds =
    room.availableBeds ??
    beds.filter(
      (bed) =>
        String(bed.status || "").toLowerCase().trim() === "available" ||
        (bed.status === undefined && bed.available),
    ).length;

  let label = "Available";
  if (totalBeds) {
    if (availableBeds === 0) {
      label = room.unavailableBeds > 0 ? "Unavailable" : "Full";
    } else if (availableBeds <= Math.max(1, Math.ceil(totalBeds * 0.25))) {
      label = "Limited";
    }
  }

  const meta = {
    Available: { bg: "var(--success)", fg: "var(--success-foreground)" },
    Limited: { bg: "var(--warning)", fg: "var(--warning-foreground)" },
    Full: { bg: "var(--danger)", fg: "var(--danger-foreground)" },
    Unavailable: { bg: "var(--neutral)", fg: "var(--neutral-foreground)" },
  }[label];

  return { label, ...meta };
}

function getImages(room) {
  if (room.images?.length) return room.images;
  if (room.image) return [room.image];
  return [];
}

function isPrivateRoomType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  return normalized === "private" || normalized.includes("private");
}

// ─── Small presentational pieces ─────────────────────────────

const SectionHeading = ({ icon: Icon, tone = "neutral", title, subtitle, action }) => (
  <div className="flex items-center justify-between gap-3 mb-4">
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, var(--${tone}) 16%, transparent)` }}
      >
        <Icon className="w-[18px] h-[18px]" style={{ color: `var(--${tone})` }} />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-sm text-foreground truncate">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

const StatChip = ({ icon: Icon, label, value, tone = "neutral" }) => (
  <div className="flex-1 min-w-[110px] rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
      <Icon className="w-3.5 h-3.5" style={{ color: `var(--${tone})` }} />
      {label}
    </div>
    <p className="text-lg font-semibold text-foreground leading-none">{value}</p>
  </div>
);

// ─── Component ────────────────────────────────────────────────

export default function RoomDetailsModal({
  isOpen,
  room,
  onClose,
  onProceed,
  isOverbooked,
  selectedBed,
  onSelectBed,
  selectedAppliances,
  onApplianceQuantityChange,
  calculateApplianceFees,
  availableAppliances,
  proceedButtonText = "Proceed to Reservation",
  selectedLeaseDuration = "",
  onSelectLeaseDuration,
  targetMoveInDate,
  onTargetMoveInDateChange,
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [internalLeaseDuration, setInternalLeaseDuration] = useState("");
  const [internalMoveInDate, setInternalMoveInDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });

  useEscapeClose(isOpen && !!room, onClose);

  if (!isOpen || !room) return null;

  const activeLeaseDuration =
    onSelectLeaseDuration && selectedLeaseDuration !== undefined
      ? selectedLeaseDuration
      : internalLeaseDuration;

  const hasLeaseSelected = Boolean(
    activeLeaseDuration && String(activeLeaseDuration).trim() !== "",
  );

  const handleLeaseChange = (val) => {
    setInternalLeaseDuration(val);
    if (onSelectLeaseDuration) onSelectLeaseDuration(val);
  };

  const activeMoveInDate = targetMoveInDate || internalMoveInDate;

  const handleMoveInChange = (val) => {
    setInternalMoveInDate(val);
    if (onTargetMoveInDateChange) onTargetMoveInDateChange(val);
  };

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

    const discountPercent =
      typeof targetRoom.longTermDiscountPercent === "number"
        ? targetRoom.longTermDiscountPercent
        : defaultDiscount;

    let longTerm =
      typeof targetRoom.monthlyPrice === "number" && targetRoom.monthlyPrice > 0
        ? targetRoom.monthlyPrice
        : Math.round(regularLong * (1 - discountPercent / 100));

    let shortTerm =
      typeof targetRoom.shortTermRate === "number" && targetRoom.shortTermRate > 0
        ? targetRoom.shortTermRate
        : typeof targetRoom.price === "number" && targetRoom.price > 0
        ? targetRoom.price
        : Math.round(regularShort * (1 - discountPercent / 100));

    if (discountPercent > 0 && discountPercent < 100) {
      regularLong = Math.round(longTerm / (1 - discountPercent / 100));
      regularShort = Math.round(shortTerm / (1 - discountPercent / 100));
    }

    return { regularShort, shortTerm, regularLong, longTerm, discountPercent };
  };

  const flyer = getFlyerRates(room.type, room);
  const isDiscountEnabled = room.isDiscountEnabled !== false;

  const minMonths = room.longTermLeaseMinMonths ?? 6;
  const leaseMonths = parseInt(activeLeaseDuration, 10) || minMonths;
  const isLongTerm = leaseMonths >= minMonths;

  const activeRegularRate = isLongTerm ? flyer.regularLong : flyer.regularShort;

  let activeMonthlyRate = isDiscountEnabled
    ? isLongTerm
      ? flyer.longTerm
      : flyer.shortTerm
    : activeRegularRate;

  const activeFlyerDiscount =
    isDiscountEnabled && activeRegularRate > activeMonthlyRate
      ? activeRegularRate - activeMonthlyRate
      : 0;

  const discountPercent =
    isDiscountEnabled && activeRegularRate > 0 && activeFlyerDiscount > 0
      ? Math.round((activeFlyerDiscount / activeRegularRate) * 100)
      : 0;

  const applianceFeesAmount = calculateApplianceFees ? calculateApplianceFees() : 0;
  const securityDepositAmount = activeMonthlyRate;
  const calculatedUpfrontTotal = activeMonthlyRate + securityDepositAmount + applianceFeesAmount;
  const calculatedContractTotal = (activeMonthlyRate + applianceFeesAmount) * leaseMonths;
  const totalSavingsAmount = activeFlyerDiscount * leaseMonths;

  const images = getImages(room);
  const requiresBedSelection =
    room.beds && room.beds.length > 1 && !isPrivateRoomType(room.type);
  const proceedDisabled =
    isOverbooked || !hasLeaseSelected || (requiresBedSelection && !selectedBed);

  const handleProceedClick = () => {
    if (!hasLeaseSelected) {
      showNotification("Please select a preferred lease term before proceeding.", "warning");
      return;
    }
    if (requiresBedSelection && !selectedBed) {
      showNotification("Please select a bed location before proceeding.", "warning");
      return;
    }
    if (isOverbooked) {
      showNotification("This room is currently fully booked.", "warning");
      return;
    }
    if (onProceed) onProceed();
  };

  const totalBeds = room.capacity || room.beds?.length || 0;
  const availableBeds =
    room.availableBeds ??
    (room.beds
      ? room.beds.filter(
          (bed) =>
            String(bed.status || "").toLowerCase().trim() === "available" ||
            (bed.status === undefined && bed.available),
        ).length
      : 0);
  const occupancyPercentage = totalBeds ? ((totalBeds - availableBeds) / totalBeds) * 100 : 0;

  const handlePrevImage = () => {
    if (!images.length) return;
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };
  const handleNextImage = () => {
    if (!images.length) return;
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const availability = getAvailabilityMeta(room);
  const defaultTerms = (() => {
    const terms = LEASE_OPTIONS.map((opt) => Number(opt.value)).sort((a, b) => a - b);
    if (!terms.includes(minMonths)) {
      terms.push(minMonths);
      terms.sort((a, b) => a - b);
    }
    return terms;
  })();

  return (
    <div
      className="rdm-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={onClose}
    >
      <style>{`
        @keyframes rdm-rise { from { opacity: 0; transform: translateY(16px) scale(0.99); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .rdm-panel { animation: rdm-rise 0.22s cubic-bezier(0.16,1,0.3,1); }
        @media (prefers-reduced-motion: reduce) { .rdm-panel { animation: none; } }
        .rdm-scroller::-webkit-scrollbar { width: 8px; }
        .rdm-scroller::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; }
        .rdm-thumbstrip::-webkit-scrollbar { display: none; }
        .rdm-chip {
          border: 1px solid var(--border);
          background: var(--muted);
          transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
        }
        .rdm-chip:hover { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); }
        .rdm-chip.is-active {
          background: var(--primary);
          border-color: var(--primary);
          color: var(--primary-foreground);
        }
        .rdm-date-input::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rdm-title"
        className="rdm-panel bg-card w-full sm:max-w-6xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-5 sm:px-7 py-5 border-b border-border">
          <div className="min-w-0">
            <h2 id="rdm-title" className="text-xl sm:text-2xl font-semibold text-foreground truncate">
              {room.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {room.branch}
              </span>
              <span className="opacity-50">•</span>
              <span>{room.type}</span>
              <span className="opacity-50">•</span>
              <span>{room.bedLayout}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close room details"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="rdm-scroller flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-8 p-5 sm:p-7">
            {/* ── LEFT: visual identity, sticky on desktop ── */}
            <div className="lg:sticky lg:top-0 lg:self-start space-y-5">
              <SpotlightCard spotlightColor="rgba(212, 175, 55, 0.24)" className="p-0">
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                  {images.length > 0 && (
                    <img
                      src={images[currentImageIndex]}
                      alt={`${room.title} — photo ${currentImageIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}

                  <span
                    className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm"
                    style={{ backgroundColor: availability.bg, color: availability.fg }}
                  >
                    {availability.label}
                  </span>

                  {images.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        aria-label="Previous photo"
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:bg-card shadow-md transition-all"
                      >
                        <ChevronLeft className="w-5 h-5 text-foreground" />
                      </button>
                      <button
                        onClick={handleNextImage}
                        aria-label="Next photo"
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:bg-card shadow-md transition-all"
                      >
                        <ChevronRight className="w-5 h-5 text-foreground" />
                      </button>
                      <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs">
                        {currentImageIndex + 1} / {images.length}
                      </div>
                    </>
                  )}
                </div>
              </SpotlightCard>

              {images.length > 1 && (
                <div className="rdm-thumbstrip flex gap-2 overflow-x-auto pb-1">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      aria-label={`View photo ${index + 1}`}
                      aria-current={currentImageIndex === index}
                      className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all"
                      style={{
                        borderColor: currentImageIndex === index ? "var(--primary)" : "transparent",
                        opacity: currentImageIndex === index ? 1 : 0.7,
                      }}
                    >
                      <img src={image} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Quick facts */}
              <div className="flex flex-wrap gap-2">
                <StatChip icon={Users} label="Capacity" value={`${totalBeds} ${totalBeds === 1 ? "Bed" : "Beds"}`} />
                <StatChip
                  icon={Bed}
                  label="Available"
                  value={`${availableBeds} / ${totalBeds}`}
                  tone={availableBeds === 0 ? "danger" : "success"}
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Current occupancy</span>
                  <span>{totalBeds - availableBeds} / {totalBeds} unavailable</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${occupancyPercentage}%`,
                      backgroundColor: occupancyPercentage >= 75 ? "var(--warning)" : "var(--success)",
                    }}
                  />
                </div>
              </div>

              {room.intendedTenant && (
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground font-medium">Intended for:</strong> {room.intendedTenant}
                </p>
              )}

              {/* Amenities */}
              {room.amenities?.length > 0 && (
                <div>
                  <SectionHeading icon={Sparkles} title="Amenities" />
                  <div className="flex flex-wrap gap-2">
                    {room.amenities.map((amenity, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full text-xs font-medium border border-border/70 bg-muted/40 text-foreground"
                      >
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--success)" }} />
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Policies */}
              {room.policies?.length > 0 && (
                <details className="group rounded-xl border border-border/70 bg-muted/30 open:bg-muted/40">
                  <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      <Info className="w-4 h-4" style={{ color: "var(--neutral-dark)" }} />
                      Policies & important notes
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-4 pb-4 space-y-2">
                    {room.policies.map((policy, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                        <span className="text-xs text-muted-foreground leading-relaxed">{policy}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* ── RIGHT: booking configuration ── */}
            <div className="space-y-5">
              {requiresBedSelection && (
                <div className="rounded-2xl border border-border/70 p-5">
                  <SectionHeading icon={Bed} title="Choose your bed" subtitle="Pick an available bed location" />
                  <BedSelector beds={room.beds} selectedBed={selectedBed} onSelect={onSelectBed} />
                </div>
              )}

              {/* Lease term + move-in date */}
              <div className="rounded-2xl border border-border/70 p-5">
                <SectionHeading icon={Calendar} title="Lease term & move-in" subtitle="Choose how long you'll stay" />

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mb-4">
                  {defaultTerms.map((m) => {
                    const valStr = String(m);
                    const labelStr = m === 12 ? "1 yr" : `${m} mo${m > 1 ? "s" : ""}`;
                    const isSelected = activeLeaseDuration === valStr;
                    const itemIsLongTerm = m >= minMonths;
                    return (
                      <button
                        key={valStr}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleLeaseChange(valStr)}
                        className={`rdm-chip py-2 px-1 rounded-lg text-xs flex flex-col items-center justify-center${isSelected ? " is-active" : ""}`}
                      >
                        <span className="font-semibold">{labelStr}</span>
                        {isDiscountEnabled && discountPercent > 0 ? (
                          <span
                            className="text-[9px] font-semibold mt-0.5"
                            style={{ color: isSelected ? "inherit" : "var(--success)" }}
                          >
                            {discountPercent}% OFF
                          </span>
                        ) : (
                          <span className="text-[9px] mt-0.5 opacity-70">
                            {itemIsLongTerm ? "Long-term" : "Short-term"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <label className="block text-xs font-medium text-muted-foreground mb-1.5" htmlFor="rdm-movein">
                  Preferred move-in date
                </label>
                <input
                  id="rdm-movein"
                  type="date"
                  className="rdm-date-input w-full sm:w-56 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2"
                  style={{ "--tw-ring-color": "color-mix(in srgb, var(--ring) 45%, transparent)" }}
                  value={activeMoveInDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => handleMoveInChange(e.target.value)}
                />

                {!hasLeaseSelected ? (
                  <div
                    className="mt-4 p-3 rounded-lg text-xs flex items-center gap-2.5"
                    style={{ backgroundColor: "var(--status-warning-bg)", color: "var(--warning-dark)" }}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "var(--warning)" }} />
                    Select a lease term above to see pricing.
                  </div>
                ) : (
                  <div className="mt-4">
                    {isLongTerm ? (
                      isDiscountEnabled && discountPercent > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: "var(--status-success-bg)", color: "var(--success-dark)" }}
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Long-term rate applied
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                          Long-term
                        </span>
                      )
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: "var(--status-info-bg)", color: "var(--info-dark)" }}
                      >
                        <Zap className="w-3.5 h-3.5" /> Short-term rate applied
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Appliance add-ons */}
              {room.applianceFeeEnabled && (
                <div className="rounded-2xl border border-border/70 p-5">
                  <SectionHeading icon={Zap} title="Appliance add-ons" subtitle="Optional, billed monthly per tenant" />
                  <div className="divide-y divide-border/60">
                    {availableAppliances.map((appliance) => {
                      const qty = selectedAppliances[appliance.id] || 0;
                      return (
                        <div key={appliance.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{appliance.name}</p>
                            <p className="text-xs text-muted-foreground">₱{appliance.price}/month each</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              aria-label={`Decrease ${appliance.name} quantity`}
                              onClick={() => onApplianceQuantityChange(appliance.id, Math.max(0, qty - 1))}
                              className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                              disabled={qty === 0}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold text-foreground tabular-nums">{qty}</span>
                            <button
                              type="button"
                              aria-label={`Increase ${appliance.name} quantity`}
                              onClick={() => onApplianceQuantityChange(appliance.id, qty + 1)}
                              className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {applianceFeesAmount > 0 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60 text-sm">
                      <span className="text-muted-foreground">Total add-on fees</span>
                      <span className="font-semibold" style={{ color: "var(--primary)" }}>
                        ₱{applianceFeesAmount.toLocaleString()}/mo
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Cost summary */}
              <div className="rounded-2xl border border-border/70 overflow-hidden">
                <div className="p-5 pb-0">
                  <SectionHeading icon={Calculator} tone="primary" title="Cost summary" subtitle="Estimated charges based on your selection" />
                </div>

                {!hasLeaseSelected ? (
                  <div className="mx-5 mb-5 p-4 rounded-xl text-xs flex items-center gap-3" style={{ backgroundColor: "var(--status-warning-bg)" }}>
                    <AlertCircle className="w-5 h-5 shrink-0" style={{ color: "var(--warning)" }} />
                    <span style={{ color: "var(--warning-dark)" }}>
                      Choose a lease term to view the full rate breakdown.
                    </span>
                  </div>
                ) : (
                  <div className="px-5 pb-5 space-y-3">
                    <div className="rounded-xl border border-border/70 overflow-hidden divide-y divide-border/60">
                      <div className="p-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Regular rate <span className="text-xs opacity-70">({isLongTerm ? "long-term" : "short-term"})</span>
                        </span>
                        <span className={`font-medium tabular-nums ${activeFlyerDiscount > 0 ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          ₱{activeRegularRate.toLocaleString()}/mo
                        </span>
                      </div>

                      {activeFlyerDiscount > 0 && (
                        <div className="p-3 flex items-center justify-between text-sm" style={{ backgroundColor: "var(--status-success-bg)" }}>
                          <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--success-dark)" }}>
                            <Tag className="w-3.5 h-3.5" /> Promo discount
                            <span
                              className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                              style={{ backgroundColor: "var(--success)", color: "var(--success-foreground)" }}
                            >
                              -{discountPercent}%
                            </span>
                          </span>
                          <span className="font-semibold tabular-nums" style={{ color: "var(--success-dark)" }}>
                            -₱{activeFlyerDiscount.toLocaleString()}/mo
                          </span>
                        </div>
                      )}

                      <div className="p-3 flex items-center justify-between text-sm font-semibold bg-muted/40">
                        <span className="text-foreground">Effective monthly rent</span>
                        <span className="text-base font-bold tabular-nums" style={{ color: "var(--primary)" }}>
                          ₱{activeMonthlyRate.toLocaleString()}
                          <span className="text-xs font-normal text-muted-foreground"> /mo</span>
                        </span>
                      </div>

                      {applianceFeesAmount > 0 && (
                        <div className="p-3 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Appliance add-ons</span>
                          <span className="font-medium tabular-nums" style={{ color: "var(--primary)" }}>
                            +₱{applianceFeesAmount.toLocaleString()}/mo
                          </span>
                        </div>
                      )}

                      <div className="p-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4" style={{ color: "var(--success)" }} />
                          Security deposit
                          <span className="text-xs opacity-80">(1 mo, refundable)</span>
                        </span>
                        <span className="font-medium text-foreground tabular-nums">
                          ₱{securityDepositAmount.toLocaleString()}
                        </span>
                      </div>

                      {/* Prominent Estimated Upfront Move-In Total Card */}
                      <div
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        style={{
                          backgroundColor: "var(--primary)",
                          color: "var(--primary-foreground)",
                        }}
                      >
                        <div>
                          <p className="text-[11px] font-bold tracking-wider uppercase opacity-90">
                            Estimated Upfront Move-In Total
                          </p>
                          <p className="text-[11px] opacity-85 mt-0.5">
                            Includes 1st Month Rent + Refundable Deposit{applianceFeesAmount > 0 ? " + Appliances" : ""}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <span className="text-2xl font-extrabold tracking-tight tabular-nums">
                            ₱{calculatedUpfrontTotal.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {totalSavingsAmount > 0 && (
                      <div
                        className="p-3 rounded-xl text-xs font-medium flex items-center gap-2.5"
                        style={{ backgroundColor: "var(--status-success-bg)", color: "var(--success-dark)" }}
                      >
                        <Sparkles className="w-4 h-4 shrink-0" style={{ color: "var(--success)" }} />
                        <span>
                          <strong>Total savings:</strong> ₱{totalSavingsAmount.toLocaleString()} over your {leaseMonths}-month term.
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span>Total contract commitment ({leaseMonths} {leaseMonths === 1 ? "month" : "months"})</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        ₱{calculatedContractTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer — persistent price + CTA */}
        <div className="shrink-0 border-t border-border px-5 sm:px-7 py-4 bg-card shadow-[0_-6px_18px_-8px_rgba(0,0,0,0.08)]">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "color-mix(in srgb, var(--primary) 14%, transparent)" }}
              >
                <CreditCard className="w-[18px] h-[18px]" style={{ color: "var(--primary)" }} />
              </div>
              {hasLeaseSelected ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Est. upfront move-in total</p>
                  <p className="text-xl font-bold tabular-nums leading-tight" style={{ color: "var(--primary)" }}>
                    ₱{calculatedUpfrontTotal.toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a lease term to see your total.</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleProceedClick}
              className="px-7 py-3.5 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed hover:brightness-95"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
                opacity: proceedDisabled ? 0.55 : 1,
              }}
            >
              {!hasLeaseSelected
                ? "Select a lease term"
                : requiresBedSelection && !selectedBed
                ? "Select a bed"
                : proceedButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}