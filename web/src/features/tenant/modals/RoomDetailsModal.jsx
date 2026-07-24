import { useState } from "react";
import {
 AlertCircle,
 Bed,
 Check,
 ChevronLeft,
 ChevronRight,
 MapPin,
 Users,
 X,
 Calculator,
 Calendar,
 ShieldCheck,
 CreditCard,
 Info,
} from "lucide-react";
import SpotlightCard from "../components/SpotlightCard";
import BedSelector from "../components/BedSelector";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";

function getAvailabilityLabel(room) {
 const beds = room.beds || [];
 const totalBeds = room.capacity || beds.length || 0;
 const availableBeds = room.availableBeds ?? beds.filter((bed) => bed.status === "available" || (bed.status === undefined && bed.available)).length;

 if (!totalBeds) return "Available";
 if (availableBeds === 0) {
 return room.unavailableBeds > 0 ? "Unavailable" : "Full";
 }
 if (availableBeds <= Math.max(1, Math.ceil(totalBeds * 0.25))) {
 return "Limited";
 }
 return "Available";
}

function getAvailabilityColor(room) {
 const label = getAvailabilityLabel(room);
 if (label === "Full") return "#EF4444";
 if (label === "Unavailable") return "#6B7280";
 if (label === "Limited") return "#D4AF37";
 return "#10B981";
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
 selectedLeaseDuration = "6",
 onSelectLeaseDuration,
 targetMoveInDate,
 onTargetMoveInDateChange,
}) {
 const [currentImageIndex, setCurrentImageIndex] = useState(0);
 const [internalLeaseDuration, setInternalLeaseDuration] = useState("6");
 const [internalMoveInDate, setInternalMoveInDate] = useState(() => {
   const d = new Date();
   d.setDate(d.getDate() + 30);
   return d.toISOString().split("T")[0];
 });

 useEscapeClose(isOpen && !!room, onClose);

 if (!isOpen || !room) return null;

 const activeLeaseDuration =
   onSelectLeaseDuration && selectedLeaseDuration
     ? selectedLeaseDuration
     : internalLeaseDuration;

 const handleLeaseChange = (val) => {
   setInternalLeaseDuration(val);
   if (onSelectLeaseDuration) {
     onSelectLeaseDuration(val);
   }
 };

 const activeMoveInDate = targetMoveInDate || internalMoveInDate;

 const handleMoveInChange = (val) => {
   setInternalMoveInDate(val);
   if (onTargetMoveInDateChange) {
     onTargetMoveInDateChange(val);
   }
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

  const minMonths = room.longTermLeaseMinMonths ?? 6;
  const leaseMonths = parseInt(activeLeaseDuration, 10) || minMonths;
  const isLongTerm = leaseMonths >= minMonths;

  // Active regular base rate from flyer (short-term vs long-term base rate)
  const activeRegularRate = isLongTerm ? flyer.regularLong : flyer.regularShort;

  // Active net monthly rent (discount applies to both short-term and long-term base rates)
  let activeMonthlyRate = isDiscountEnabled
    ? (isLongTerm ? flyer.longTerm : flyer.shortTerm)
    : activeRegularRate;

  // Calculate flyer discount amount & percent for 100% mathematical consistency
  const activeFlyerDiscount = (isDiscountEnabled && activeRegularRate > activeMonthlyRate)
    ? (activeRegularRate - activeMonthlyRate)
    : 0;

  const discountPercent = (isDiscountEnabled && activeRegularRate > 0 && activeFlyerDiscount > 0)
    ? Math.round((activeFlyerDiscount / activeRegularRate) * 100)
    : 0;

  const shortTermRate = isDiscountEnabled ? flyer.shortTerm : flyer.regularShort;
  const longTermRate = isDiscountEnabled ? (room.monthlyPrice || flyer.longTerm) : flyer.regularLong;
  const monthlyDiscountAmount = activeFlyerDiscount;
  const totalSavingsAmount = activeFlyerDiscount * leaseMonths;

 const applianceFeesAmount = calculateApplianceFees ? calculateApplianceFees() : 0;
 const securityDepositAmount = activeMonthlyRate;
 const calculatedUpfrontTotal = activeMonthlyRate + securityDepositAmount + applianceFeesAmount;
 const calculatedContractTotal = (activeMonthlyRate + applianceFeesAmount) * leaseMonths;

 const images = getImages(room);
 const requiresBedSelection =
 room.beds && room.beds.length > 1 && !isPrivateRoomType(room.type);
 const proceedDisabled =
 isOverbooked || (requiresBedSelection && !selectedBed);
 const totalBeds = room.capacity || room.beds?.length || 0;
 const availableBeds = room.availableBeds ?? (room.beds
 ? room.beds.filter((bed) => bed.status === "available" || (bed.status === undefined && bed.available)).length
 : 0);
 const occupancyPercentage = totalBeds
 ? ((totalBeds - availableBeds) / totalBeds) * 100
 : 0;
 const upperBeds = room.beds
 ? room.beds.filter(
 (bed) => bed.position === "upper" || bed.position === "top",
 )
 : [];
 const lowerBeds = room.beds
 ? room.beds.filter(
 (bed) => bed.position === "lower" || bed.position === "bottom",
 )
 : [];
 const hasBunkPreference = upperBeds.length > 0 || lowerBeds.length > 0;
 const hasAvailableUpper = upperBeds.some((bed) => bed.status === "available" || (bed.status === undefined && bed.available));
 const hasAvailableLower = lowerBeds.some((bed) => bed.status === "available" || (bed.status === undefined && bed.available));

 const handlePrevImage = () => {
 if (!images.length) return;
 setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
 };

 const handleNextImage = () => {
 if (!images.length) return;
 setCurrentImageIndex((prev) => (prev + 1) % images.length);
 };

 return (
 <div className="fixed inset-0 bg-black/60 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
 <div className="bg-card rounded-2xl w-full max-w-6xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
 <div className="sticky top-0 z-20 flex items-start justify-between p-6 border-b border-border bg-card">
 <div>
 <div className="flex items-center gap-3 mb-2">
 <h2 className="text-3xl font-light" style={{ color: "var(--text-heading, #0A1628)" }}>
 {room.title}
 </h2>
 <span
 className="px-3 py-1 rounded-full text-xs font-medium text-primary-foreground"
 style={{ backgroundColor: getAvailabilityColor(room) }}
 >
 {getAvailabilityLabel(room)}
 </span>
 </div>
 <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
 <span className="flex items-center gap-1">
 <MapPin className="w-4 h-4" />
 {room.branch}
 </span>
 <span>•</span>
 <span>{room.type}</span>
 <span>•</span>
 <span>{room.bedLayout}</span>
 </div>
 </div>
 <button
 onClick={onClose}
 className="text-muted-foreground hover:text-muted-foreground transition-colors p-2"
 >
 <X className="w-6 h-6" />
 </button>
 </div>

 <div className="p-6">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 <div className="space-y-4">
 <SpotlightCard
 spotlightColor="rgba(212, 175, 55, 0.26)"
 className="p-0"
 >
 <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
 {images.length > 0 && (
 <img
 src={images[currentImageIndex]}
 alt={`${room.title} - Photo ${currentImageIndex + 1}`}
 className="w-full h-full object-cover"
 />
 )}

 {images.length > 1 && (
 <>
 <button
 onClick={handlePrevImage}
 className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:bg-card shadow-lg transition-all"
 >
 <ChevronLeft className="w-6 h-6 text-foreground" />
 </button>
 <button
 onClick={handleNextImage}
 className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:bg-card shadow-lg transition-all"
 >
 <ChevronRight className="w-6 h-6 text-foreground" />
 </button>
 </>
 )}

 {images.length > 0 && (
 <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-primary-foreground text-sm">
 {currentImageIndex + 1} / {images.length}
 </div>
 )}
 </div>
 </SpotlightCard>

 {images.length > 1 && (
 <SpotlightCard
 spotlightColor="rgba(212, 175, 55, 0.2)"
 className="p-0"
 >
 <div className="grid grid-cols-4 gap-2 p-2">
 {images.map((image, index) => (
 <button
 key={index}
 onClick={() => setCurrentImageIndex(index)}
 className="aspect-square rounded-lg overflow-hidden border-2 transition-all hover:border-border"
 style={{
 borderColor:
 currentImageIndex === index
 ? "var(--color-accent)"
 : "transparent",
 transform:
 currentImageIndex === index
 ? "scale(0.95)"
 : "scale(1)",
 }}
 >
 <img
 src={image}
 alt={`Thumbnail ${index + 1}`}
 className="w-full h-full object-cover"
 />
 </button>
 ))}
 </div>
 </SpotlightCard>
 )}
 </div>

 <div className="space-y-6">
 <div className="bg-muted rounded-xl p-5">
 <h3 className="font-semibold mb-4" style={{ color: "var(--text-heading, #0A1628)" }}>
 Availability Status
 </h3>
 <div className="grid grid-cols-2 gap-4 mb-4">
 <div>
 <p className="text-sm text-muted-foreground mb-1">Capacity</p>
 <p className="text-2xl font-semibold flex items-center gap-2">
 <Users className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
 {totalBeds} {totalBeds === 1 ? "Bed" : "Beds"}
 </p>
 </div>
 <div>
 <p className="text-sm text-muted-foreground mb-1">Beds Available</p>
 <p className="text-2xl font-semibold flex items-center gap-2">
 <Bed className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
 {availableBeds} / {totalBeds}
 </p>
 </div>
 </div>

 <div>
 <div className="flex justify-between text-sm text-muted-foreground mb-2">
 <span>Current Occupancy</span>
 <span>
 {totalBeds - availableBeds} / {totalBeds} Unavailable
 </span>
 </div>
 <div className="w-full h-3 bg-border rounded-full overflow-hidden">
 <div
 className="h-full transition-all"
 style={{
 width: `${occupancyPercentage}%`,
 backgroundColor:
 occupancyPercentage >= 75 ? "var(--color-accent)" : "#10B981",
 }}
 ></div>
 </div>
 </div>
 </div>

 <div>
 <h3 className="font-semibold mb-3" style={{ color: "var(--text-heading, #0A1628)" }}>
 Room Information
 </h3>
 <div className="grid grid-cols-2 gap-3 text-sm">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
 <Bed className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
 </div>
 <div>
 <p className="text-muted-foreground">Type</p>
 <p className="font-medium">{room.type}</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
 <svg
 className="w-4 h-4"
 style={{ color: "var(--color-accent)" }}
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
 />
 </svg>
 </div>
 <div>
 <p className="text-muted-foreground">Bed Layout</p>
 <p className="font-medium">{room.bedLayout}</p>
 </div>
 </div>
 </div>
 {room.intendedTenant && (
 <p className="text-sm text-muted-foreground mt-3">
 <strong>Intended for:</strong> {room.intendedTenant}
 </p>
 )}
 </div>

 <div>
 <h3 className="font-semibold mb-3" style={{ color: "var(--text-heading, #0A1628)" }}>
 Amenities
 </h3>
 <div className="grid grid-cols-1 gap-2">
 {room.amenities.map((amenity, index) => (
 <div key={index} className="flex items-center gap-2">
 <Check
 className="w-4 h-4 flex-shrink-0"
 style={{ color: "#10B981" }}
 />
 <span className="text-sm text-card-foreground">{amenity}</span>
 </div>
 ))}
 </div>
 </div>

 {requiresBedSelection && (
 <BedSelector
 beds={room.beds}
 selectedBed={selectedBed}
 onSelect={onSelectBed}
 />
 )}

 {room.applianceFeeEnabled && (
 <div>
 <h3 className="font-semibold mb-3" style={{ color: "var(--text-heading, #0A1628)" }}>
 Appliance Fees (Optional)
 </h3>
 <p className="text-sm text-muted-foreground mb-3">
 Select only appliances you plan to bring. Appliance fees are
 charged monthly per tenant and added to your billing summary.
 </p>
 {availableAppliances.map((appliance) => (
 <div key={appliance.id} className="appliance-row">
 <div style={{ flex: 1 }}>
 <div style={{ fontWeight: "500", marginBottom: "2px" }}>
 {appliance.name}
 </div>
 <div style={{ fontSize: "12px", color: "#6b7280" }}>
 ₱{appliance.price}/month each
 </div>
 </div>
 <div
 style={{
 display: "flex",
 alignItems: "center",
 gap: "8px",
 }}
 >
 <button
 type="button"
 onClick={() =>
 onApplianceQuantityChange(
 appliance.id,
 Math.max(
 0,
 (selectedAppliances[appliance.id] || 0) - 1,
 ),
 )
 }
 style={{
 width: "32px",
 height: "32px",
 border: "1px solid var(--border-card, #e5e7eb)",
 borderRadius: "6px",
 background: "var(--surface-card, white)",
 cursor: "pointer",
 fontSize: "16px",
 }}
 >
 −
 </button>
 <span
 style={{
 minWidth: "30px",
 textAlign: "center",
 fontWeight: "600",
 }}
 >
 {selectedAppliances[appliance.id] || 0}
 </span>
 <button
 type="button"
 onClick={() =>
 onApplianceQuantityChange(
 appliance.id,
 (selectedAppliances[appliance.id] || 0) + 1,
 )
 }
 style={{
 width: "32px",
 height: "32px",
 border: "1px solid var(--border-card, #e5e7eb)",
 borderRadius: "6px",
 background: "var(--surface-card, white)",
 cursor: "pointer",
 fontSize: "16px",
 }}
 >
 +
 </button>
 <button
 type="button"
 onClick={() =>
 onApplianceQuantityChange(appliance.id, 0)
 }
 style={{
 padding: "6px 12px",
 border: "1px solid var(--border-card, #e5e7eb)",
 borderRadius: "6px",
 background: "var(--surface-card, white)",
 cursor: "pointer",
 fontSize: "13px",
 color: "var(--text-muted, #6b7280)",
 }}
 >
 ✕
 </button>
 </div>
 </div>
 ))}
 <div className="mt-3 text-sm text-muted-foreground">
 Total Appliance Fees:{" "}
 <span className="font-semibold" style={{ color: "var(--color-accent)" }}>
 ₱{calculateApplianceFees().toLocaleString()}
 </span>
 </div>
 </div>
 )}

  {/* Interactive Upfront Move-in Cost Calculator */}
  <div className="bg-muted/60 rounded-xl p-5 border border-border/80 space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-heading, #0A1628)" }}>
        <Calculator className="w-5 h-5" style={{ color: "var(--color-accent, #D4AF37)" }} />
        Move-in Cost & Lease Calculator
      </h3>
      {isDiscountEnabled && discountPercent > 0 ? (
        <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500 text-slate-950">
          {discountPercent}% OFF Promo Rate
        </span>
      ) : (
        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-muted border border-border text-muted-foreground">
          Standard Base Rate
        </span>
      )}
    </div>

    {/* Lease Term Selection */}
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5" />
        Select Preferred Lease Term
      </label>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
        {(() => {
          const defaultTerms = [1, 2, 3, 4, 5, 6, 12];
          if (!defaultTerms.includes(minMonths)) {
            defaultTerms.push(minMonths);
            defaultTerms.sort((a, b) => a - b);
          }
          return defaultTerms.map((m) => {
            const valStr = String(m);
            const labelStr = m === 12 ? "1 yr" : `${m} mo${m > 1 ? "s" : ""}`;
            const isSelected = activeLeaseDuration === valStr;
            return (
              <button
                key={valStr}
                type="button"
                onClick={() => handleLeaseChange(valStr)}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border relative ${
                  isSelected
                    ? "shadow-sm border-amber-500"
                    : "bg-card border-border hover:border-amber-500/50 text-muted-foreground"
                }`}
                style={{
                  backgroundColor: isSelected ? "var(--color-accent, #D4AF37)" : undefined,
                  color: isSelected ? "#0A1628" : undefined,
                }}
              >
                {labelStr}
                {isDiscountEnabled && discountPercent > 0 && (
                  <span className="block text-[9px] font-normal opacity-80">
                    {discountPercent}% OFF
                  </span>
                )}
              </button>
            );
          });
        })()}
      </div>
    </div>

    {/* Cost Breakdown Card — Transparent Itemization matching Flyer */}
    <div className="bg-card rounded-lg p-4 border border-border space-y-2.5 shadow-xs">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground flex items-center gap-1.5">
          Regular Base Rate ({isLongTerm ? "Long-Term" : "Short-Term"})
        </span>
        <span className={`font-medium text-muted-foreground ${activeFlyerDiscount > 0 ? "line-through" : ""}`}>
          ₱{activeRegularRate.toLocaleString()} / mo
        </span>
      </div>

      {activeFlyerDiscount > 0 && (
        <div className="flex justify-between items-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              -{discountPercent}% OFF
            </span>
            Flyer Promo Discount
          </span>
          <span>- ₱{activeFlyerDiscount.toLocaleString()} / mo</span>
        </div>
      )}

      <div className="flex justify-between items-center text-sm font-semibold border-t border-dashed border-border/80 pt-2">
        <span className="text-card-foreground">Effective Monthly Room Rent</span>
        <span className="text-amber-600 dark:text-amber-400 text-base font-bold">
          ₱{activeMonthlyRate.toLocaleString()} / mo
        </span>
      </div>

      {applianceFeesAmount > 0 && (
        <div className="flex justify-between items-center text-sm" style={{ color: "var(--color-accent, #D4AF37)" }}>
          <span>Appliance Add-ons</span>
          <span className="font-medium">+ ₱{applianceFeesAmount.toLocaleString()} / mo</span>
        </div>
      )}

      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Security Deposit (1 Month Rent - Refundable)
        </span>
        <span className="font-medium">₱{securityDepositAmount.toLocaleString()}</span>
      </div>

      <div className="border-t border-border pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Estimated Upfront Move-in Total
          </p>
          <p className="text-[11px] text-muted-foreground">
            Includes 1st Month Rent + Refundable Deposit + Appliances
          </p>
        </div>
        <div className="sm:text-right">
          <span className="text-2xl font-bold" style={{ color: "var(--color-accent, #D4AF37)" }}>
            ₱{calculatedUpfrontTotal.toLocaleString()}
          </span>
        </div>
      </div>
    </div>

    {/* Total Savings Banner */}
    {totalSavingsAmount > 0 && (
      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
        <span>
          🎉 <strong>Total Savings:</strong> You save ₱{totalSavingsAmount.toLocaleString()} over your {leaseMonths}-month contract commitment!
        </span>
      </div>
    )}

    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
      <span>Total contract commitment ({activeLeaseDuration} {leaseMonths === 1 ? "month" : "months"}):</span>
      <span className="font-semibold text-card-foreground">
        ₱{calculatedContractTotal.toLocaleString()}
      </span>
    </div>
  </div>

 <div>
 <h3 className="font-semibold mb-3" style={{ color: "var(--text-heading, #0A1628)" }}>
 Policies & Important Notes
 </h3>
 <div className="space-y-2">
 {(room.policies || []).map((policy, index) => (
 <div key={index} className="flex items-start gap-2">
 <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--color-accent)" }} />
 <span className="text-sm text-card-foreground">{policy}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 </div>

 <div className="border-t border-border p-6">
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
 <div className="text-center sm:text-left">
 <p className="text-sm text-muted-foreground">
 Ready to reserve? Continue to complete your reservation.
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 Bed selection may be required before proceeding.
 </p>
 </div>
 <button
 onClick={onProceed}
 className="px-8 py-4 rounded-xl font-medium hover:opacity-90 transition-opacity"
 style={{
 backgroundColor: "var(--color-accent)",
 color: "var(--color-primary)",
 }}
 disabled={proceedDisabled}
 >
 {requiresBedSelection && !selectedBed
 ? "Please Select a Bed"
 : proceedButtonText}
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}
