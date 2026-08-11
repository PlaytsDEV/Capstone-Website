import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  ExternalLink,
  Lock,
  CheckCircle2,
  Tag,
} from "lucide-react";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import { getBedDisplayLabel } from "../../../../shared/utils/bedIdentifier";
import { formatRoomType, formatBranch } from "../../utils/formatters";
import { reservationApi } from "../../../../shared/api/reservationApi";

const formatDate = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getInitials = (name) => {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function BedOccupantDetailModal({
  bed,
  room,
  onClose,
  onNavigateToTenants,
}) {
  useEscapeClose(true, onClose);
  const [extraDetails, setExtraDetails] = useState(null);

  const occupant = bed?.occupiedBy || bed?.reservedBy || bed?.occupant || {};
  const rawStatus = (bed?.status || (bed?.available === false ? "occupied" : "available")).toLowerCase();
  const isReserved = rawStatus === "reserved";
  const isLocked = rawStatus === "locked";

  const occupantName =
    occupant.name ||
    occupant.userName ||
    bed?.userName ||
    bed?.tenantName ||
    (occupant.firstName || occupant.lastName
      ? `${occupant.firstName || ""} ${occupant.lastName || ""}`.trim()
      : null);

  const email = occupant.email || occupant.userEmail || bed?.userEmail || extraDetails?.resident?.email || null;
  const phone = occupant.phone || occupant.userPhone || bed?.userPhone || extraDetails?.resident?.phone || null;
  const reservationId = occupant.reservationId || bed?.reservationId || extraDetails?.reservationId || extraDetails?._id || null;
  const occupiedSince = occupant.occupiedSince || bed?.occupiedSince || extraDetails?.moveInDate || extraDetails?.startDate || null;
  const expectedVacancy = bed?.expectedVacancyDate || occupant.expectedVacancyDate || extraDetails?.endDate || extraDetails?.expectedVacancyDate || null;

  // Fetch extra details if reservationId is available and email/phone are missing
  useEffect(() => {
    if (!reservationId || (email && phone)) return;
    let isMounted = true;

    reservationApi
      .getTenantWorkspaceById(reservationId)
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data || res;
        if (data) {
          setExtraDetails(data);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch extra reservation details for modal:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [reservationId, email, phone]);

  const handleOpenTenantsPage = () => {
    const searchStr = occupantName || email;
    let url = "/admin/tenants";
    if (reservationId) {
      url = `/admin/tenants?reservationId=${reservationId}${
        searchStr ? `&search=${encodeURIComponent(searchStr)}` : ""
      }`;
    } else if (searchStr) {
      url = `/admin/tenants?search=${encodeURIComponent(searchStr)}`;
    }

    if (onNavigateToTenants) {
      onNavigateToTenants(url);
    } else {
      onClose();
    }
  };

  const bedLabel = getBedDisplayLabel(bed || {});
  const roomName = room?.name || room?.roomNumber || "Room";
  const initials = occupantName ? getInitials(occupantName) : isReserved ? "RES" : isLocked ? "HLD" : "OCC";

  const modalContent = (
    <div
      className="admin-modal-overlay flex items-center justify-center p-3"
      style={{ zIndex: 10050, backgroundColor: "rgba(0, 0, 0, 0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ width: "min(360px, 92vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Card */}
        <div className="p-4 border-b border-border/70 bg-muted/30 relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                isReserved
                  ? "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
                  : isLocked
                    ? "bg-orange-100 text-orange-900 border border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800"
                    : "bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800"
              }`}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-foreground truncate leading-snug">
                {occupantName || (isReserved ? "Reserved Bed" : isLocked ? "In Progress (Hold)" : "Occupied Bed")}
              </h3>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {roomName} &bull; {bedLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick Body Details */}
        <div className="p-4 space-y-3 text-xs">
          {/* Status & Bed Pill Strip */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium text-[11px] ${
                isReserved
                  ? "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                  : isLocked
                    ? "bg-orange-50 text-orange-800 border border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              }`}
            >
              {isReserved ? <Lock size={12} /> : isLocked ? <Lock size={12} /> : <CheckCircle2 size={12} />}
              {isReserved ? "Reserved" : isLocked ? "In Progress (Hold)" : "Moved In"}
            </span>

            {reservationId && (
              <span className="text-[11px] font-mono bg-muted/60 px-2 py-0.5 rounded border border-border/60 text-muted-foreground">
                #{String(reservationId).slice(-6).toUpperCase()}
              </span>
            )}
          </div>

          {/* Quick Info Items */}
          <div className="space-y-2 pt-1 border-t border-border/50">
            {email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail size={13} className="flex-shrink-0 text-foreground/70" />
                <span className="text-foreground truncate font-medium">{email}</span>
              </div>
            )}

            {phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={13} className="flex-shrink-0 text-foreground/70" />
                <span className="text-foreground font-medium">{phone}</span>
              </div>
            )}

            {(occupiedSince || expectedVacancy) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar size={13} className="flex-shrink-0 text-foreground/70" />
                <span className="text-foreground font-medium">
                  {occupiedSince ? formatDate(occupiedSince) : "Started"}
                  {expectedVacancy ? ` → ${formatDate(expectedVacancy)}` : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Compact Footer Actions */}
        <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md text-xs font-medium transition-colors"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="px-3 py-1.5 bg-primary text-primary-foreground hover:opacity-90 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-opacity"
            onClick={handleOpenTenantsPage}
          >
            Full Profile
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
}
