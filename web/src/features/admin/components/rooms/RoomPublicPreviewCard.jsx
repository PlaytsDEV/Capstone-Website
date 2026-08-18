import React from "react";
import { ArrowRight, Star, Check } from "lucide-react";
import privateRoomImg from "../../../../assets/images/branches/gil-puyat/Private - GP/private room copy.webp";
import doubleRoomImg from "../../../../assets/images/branches/gil-puyat/Double - GP/Double sharing room1.webp";
import quadRoomImg from "../../../../assets/images/branches/gil-puyat/Quadruple - GP/Pic quad.webp";
import guadalupeSharedRoomImg from "../../../../assets/images/branches/guadalupe/2d-viewing/Guadalupe shared room.webp";

/**
 * RoomPublicPreviewCard — Renders a pixel-accurate preview of how the room card looks on the public landing page.
 */
export default function RoomPublicPreviewCard({ room }) {
  if (!room) return null;

  const title = formatRoomTypeLabel(room.type);
  const branchLabel = room.branch === "guadalupe" ? "Guadalupe Branch" : "Gil Puyat Branch";
  const description = room.description || "All rooms come fully furnished with essential amenities, fast Wi-Fi, and security.";
  const amenities = room.amenities && room.amenities.length > 0
    ? room.amenities
    : ["Private Restroom", "Aircon", "Wi-Fi", "Fully Furnished"];
  const isPopular = Boolean(room.isPopular);

  const defaultRegularRate = room.type === "private" ? 15000 : room.type === "double-sharing" ? 9000 : 6000;
  const defaultDiscountedRate = room.type === "private" ? 13500 : room.type === "double-sharing" ? 7200 : 5400;
  const defaultDiscountPct = room.type === "private" ? 10 : room.type === "double-sharing" ? 20 : 10;

  const regularPrice = typeof room.regularLongRate === "number" && room.regularLongRate > 0
    ? room.regularLongRate
    : (typeof room.price === "number" && room.price > 0 ? room.price : defaultRegularRate);

  const discountedPrice = typeof room.monthlyPrice === "number" && room.monthlyPrice > 0
    ? room.monthlyPrice
    : defaultDiscountedRate;

  const discountPercent = typeof room.longTermDiscountPercent === "number" && room.longTermDiscountPercent > 0
    ? room.longTermDiscountPercent
    : (regularPrice > discountedPrice ? Math.round(((regularPrice - discountedPrice) / regularPrice) * 100) : defaultDiscountPct);

  const isDiscountEnabled = room.isDiscountEnabled !== false;
  const hasDiscount = isDiscountEnabled && regularPrice > discountedPrice && discountPercent > 0;
  const priceNote = room.type === "private" ? "/room" : "/pax";

  const defaultImage =
    room.branch === "guadalupe"
      ? guadalupeSharedRoomImg
      : room.type === "private"
      ? privateRoomImg
      : room.type === "double-sharing"
      ? doubleRoomImg
      : quadRoomImg;

  const displayImage = (room.images && room.images.length > 0)
    ? (typeof room.images[0] === "string" ? room.images[0] : room.images[0]?.preview)
    : (room.image || defaultImage);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Live Website Preview
        </span>
        <span className="text-[11px] text-muted-foreground font-medium">
          Public Visitor View
        </span>
      </div>

      <div
        className="rounded-2xl overflow-hidden border transition-all duration-300 shadow-sm bg-card text-foreground"
        style={{
          border: isPopular ? "2px solid var(--lp-accent, #D4AF37)" : "1px solid var(--border-default, #E2E8F0)",
        }}
      >
        {/* Card Image Banner */}
        <div className="relative h-52 sm:h-56 overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={displayImage}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          {/* Price Badge */}
          <div
            className="absolute top-3 left-3 backdrop-blur-md rounded-full px-3 py-1 bg-background/90 border border-border shadow-sm flex items-center gap-1.5"
          >
            {hasDiscount && (
              <span className="text-[11px] line-through text-muted-foreground font-normal">
                ₱{Number(regularPrice).toLocaleString()}
              </span>
            )}
            <span className="text-sm sm:text-base font-bold text-foreground">
              ₱{Number(hasDiscount ? discountedPrice : regularPrice).toLocaleString()}
            </span>
            <span className="text-[11px] text-muted-foreground">{priceNote}</span>
            {hasDiscount && discountPercent > 0 && (
              <span className="ml-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                {discountPercent}% OFF
              </span>
            )}
          </div>

          {/* Popular Tag */}
          {isPopular && (
            <span
              className="absolute top-3 right-3 text-white text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 bg-[#D4AF37]"
            >
              <Star className="w-3 h-3 fill-current" /> Most Popular
            </span>
          )}
        </div>

        {/* Card Content */}
        <div className="p-5 flex flex-col gap-3">
          <div>
            <h4 className="font-semibold text-lg tracking-tight text-foreground">
              {title}
            </h4>
            <p className="text-xs font-medium text-muted-foreground">
              {branchLabel} &bull; Floor {room.floor || 1}
            </p>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
            {description}
          </p>

          {/* Inclusions */}
          <div className="flex flex-wrap gap-1.5 my-1">
            {amenities.slice(0, 4).map((item, idx) => (
              <span
                key={idx}
                className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground border border-border/50 flex items-center gap-1"
              >
                <Check className="w-3 h-3 text-emerald-600" />
                {item}
              </span>
            ))}
            {amenities.length > 4 && (
              <span className="text-[11px] px-2 py-1 rounded-full font-medium bg-muted text-muted-foreground">
                +{amenities.length - 4} more
              </span>
            )}
          </div>

          {/* CTA Preview */}
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 w-full py-3 rounded-full text-xs font-semibold border transition-all mt-1 bg-muted text-muted-foreground border-border cursor-not-allowed"
          >
            <span>View Details & Check Availability</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRoomTypeLabel(type) {
  if (!type) return "Standard Room";
  if (type === "private") return "Private Room";
  if (type === "double-sharing") return "Double Sharing";
  if (type === "quadruple-sharing") return "Quadruple Sharing";
  return type.replace("-", " ");
}
