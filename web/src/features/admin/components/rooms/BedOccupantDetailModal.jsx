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
  Unlock,
  Tag,
} from "lucide-react";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import { getBedDisplayLabel } from "../../../../shared/utils/bedIdentifier";
import { formatRoomType, formatBranch } from "../../utils/formatters";
import { reservationApi } from "../../../../shared/api/reservationApi";
import { userApi } from "../../../../shared/api/userApi";

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
  onReleaseBed,
}) {
  useEscapeClose(true, onClose);
  const [extraDetails, setExtraDetails] = useState(null);

  const occupant = bed?.occupiedBy || bed?.reservedBy || bed?.occupant || {};
  const rawStatus = (bed?.status || (bed?.available === false ? "occupied" : "available")).toLowerCase();
  const isReserved = rawStatus === "reserved";
  const isLocked = rawStatus === "locked";

  const resolvedName =
    occupant.name ||
    occupant.tenantName ||
    occupant.userName ||
    bed?.userName ||
    bed?.tenantName ||
    (occupant.firstName || occupant.lastName
      ? `${occupant.firstName || ""} ${occupant.lastName || ""}`.trim()
      : null) ||
    extraDetails?.tenantName ||
    extraDetails?.name ||
    extraDetails?.tenant?.tenantName ||
    extraDetails?.tenant?.name ||
    extraDetails?.tenant?.personalInformation?.fullName ||
    extraDetails?.user?.name ||
    (extraDetails?.tenant?.personalInformation?.firstName || extraDetails?.tenant?.personalInformation?.lastName
      ? `${extraDetails?.tenant?.personalInformation?.firstName || ""} ${extraDetails?.tenant?.personalInformation?.lastName || ""}`.trim()
      : null) ||
    (extraDetails?.tenant?.firstName || extraDetails?.tenant?.lastName
      ? `${extraDetails?.tenant?.firstName || ""} ${extraDetails?.tenant?.lastName || ""}`.trim()
      : null) ||
    (extraDetails?.firstName || extraDetails?.lastName
      ? `${extraDetails?.firstName || ""} ${extraDetails?.lastName || ""}`.trim()
      : null);

  const [loadingDetails, setLoadingDetails] = useState(!resolvedName);

  const email =
    occupant.email ||
    occupant.userEmail ||
    bed?.userEmail ||
    extraDetails?.email ||
    extraDetails?.tenant?.email ||
    extraDetails?.tenant?.personalInformation?.email ||
    extraDetails?.contact?.email ||
    extraDetails?.tenant?.contact?.email ||
    null;

  const phone =
    occupant.phone ||
    occupant.userPhone ||
    bed?.userPhone ||
    extraDetails?.phone ||
    extraDetails?.tenant?.phone ||
    extraDetails?.tenant?.personalInformation?.phone ||
    extraDetails?.contact?.phone ||
    extraDetails?.tenant?.contact?.phone ||
    null;

  const userId =
    (occupant.userId && typeof occupant.userId === "object" ? occupant.userId._id : occupant.userId) ||
    (bed?.userId && typeof bed.userId === "object" ? bed.userId._id : bed?.userId) ||
    extraDetails?.userId ||
    extraDetails?.tenant?.tenantId ||
    extraDetails?.tenantId ||
    null;

  const reservationId =
    (occupant.reservationId && typeof occupant.reservationId === "object"
      ? occupant.reservationId._id
      : occupant.reservationId) ||
    (bed?.reservationId && typeof bed.reservationId === "object"
      ? bed.reservationId._id
      : bed?.reservationId) ||
    extraDetails?.reservationId ||
    extraDetails?.tenant?.reservationId ||
    extraDetails?._id ||
    null;

  const occupiedSince =
    occupant.occupiedSince ||
    bed?.occupiedSince ||
    extraDetails?.moveInDate ||
    extraDetails?.startDate ||
    null;

  const expectedVacancy =
    bed?.expectedVacancyDate ||
    occupant.expectedVacancyDate ||
    extraDetails?.endDate ||
    extraDetails?.expectedVacancyDate ||
    null;

  const daysRemaining =
    bed?.daysRemaining ??
    occupant.daysRemaining ??
    (expectedVacancy
      ? Math.ceil((new Date(expectedVacancy) - new Date()) / (1000 * 60 * 60 * 24))
      : null);

  // Fetch extra details if reservationId or userId is available and name/email/phone are missing
  useEffect(() => {
    if (email && phone && resolvedName) {
      setLoadingDetails(false);
      return;
    }
    let isMounted = true;
    setLoadingDetails(true);

    const handleFinally = () => {
      if (isMounted) setLoadingDetails(false);
    };

    const roomNumStr = String(room?.roomNumber || room?.name || "").toLowerCase().trim();
    const targetPos = String(bed?.position || "").toLowerCase().trim();
    const targetBedId = String(bed?.id || bed?.bedId || bed?.code || "").toLowerCase().trim();

    if (reservationId) {
      reservationApi
        .getTenantWorkspaceById(String(reservationId))
        .then((res) => {
          if (!isMounted) return;
          const data = res?.data || res;
          if (data) {
            const t = data.tenant || data;
            const tName =
              t.tenantName ||
              t.name ||
              t.personalInformation?.fullName ||
              (t.personalInformation?.firstName || t.personalInformation?.lastName
                ? `${t.personalInformation?.firstName || ""} ${t.personalInformation?.lastName || ""}`.trim()
                : null) ||
              (t.firstName || t.lastName ? `${t.firstName || ""} ${t.lastName || ""}`.trim() : null);

            setExtraDetails((prev) => ({
              ...(prev || {}),
              ...data,
              ...t,
              tenantName: tName || prev?.tenantName,
              name: tName || prev?.name,
              email: t.email || t.personalInformation?.email || prev?.email,
              phone: t.phone || t.personalInformation?.phone || prev?.phone,
              moveInDate: t.moveInDate || t.startDate || prev?.moveInDate,
              endDate: t.endDate || t.leaseEndDate || prev?.endDate,
            }));
          }
        })
        .catch((err) => {
          console.warn("Could not fetch extra reservation details for modal:", err);
        })
        .finally(handleFinally);
    } else if (userId && typeof userId === "string") {
      userApi
        .getById(userId)
        .then((res) => {
          if (!isMounted) return;
          const uData = res?.data?.user || res?.data || res?.user || res;
          if (uData) {
            const fullName =
              uData.name ||
              (uData.firstName || uData.lastName
                ? `${uData.firstName || ""} ${uData.lastName || ""}`.trim()
                : null) ||
              uData.email;
            setExtraDetails((prev) => ({
              ...(prev || {}),
              ...uData,
              tenantName: fullName || prev?.tenantName,
              name: fullName || prev?.name,
              email: uData.email || prev?.email,
              phone: uData.phone || prev?.phone,
            }));
          }
        })
        .catch((err) => {
          console.warn("Could not fetch extra user details for modal:", err);
        })
        .finally(handleFinally);
    } else if (room?._id || room?.id) {
      // Guaranteed Fallback: Query tenancy workspace to match occupant in this room
      reservationApi
        .getTenantWorkspace({ branch: room?.branch || "all" })
        .then((res) => {
          if (!isMounted) return;
          const tenants = res?.data?.tenants || res?.tenants || (Array.isArray(res) ? res : []);
          const roomIdStr = String(room._id || room.id);
          const roomTenants = tenants.filter((t) => {
            const tRoomId = String(t.roomId || t.room?._id || t.room?.id || "");
            const tRoomNum = String(t.roomNumber || t.room?.roomNumber || t.room?.name || "").toLowerCase().trim();
            return (tRoomId && tRoomId === roomIdStr) || (tRoomNum && tRoomNum === roomNumStr);
          });

          const matchedTenant =
            roomTenants.find((t) => {
              const tBedPos = String(t.bedPosition || t.selectedBed?.position || t.bedId || "").toLowerCase().trim();
              const tBedId = String(t.bedId || t.selectedBed?.id || "").toLowerCase().trim();

              return (
                (targetPos && tBedPos && (targetPos === tBedPos || tBedPos.includes(targetPos) || targetPos.includes(tBedPos))) ||
                (targetBedId && tBedId && (targetBedId === tBedId || targetBedId.includes(targetBedId) || targetBedId.includes(tBedId)))
              );
            }) || (roomTenants.length === 1 ? roomTenants[0] : null);

          if (matchedTenant) {
            setExtraDetails((prev) => ({
              ...(prev || {}),
              ...matchedTenant,
              reservationId: matchedTenant.reservationId || matchedTenant._id || prev?.reservationId,
              userId: matchedTenant.userId || matchedTenant.tenantId || prev?.userId,
              tenantName: matchedTenant.tenantName || matchedTenant.name || prev?.tenantName,
              name: matchedTenant.tenantName || matchedTenant.name || prev?.name,
              email: matchedTenant.email || matchedTenant.tenant?.email || prev?.email,
              phone: matchedTenant.phone || matchedTenant.tenant?.phone || prev?.phone,
              moveInDate: matchedTenant.moveInDate || matchedTenant.startDate || prev?.moveInDate,
              endDate: matchedTenant.endDate || matchedTenant.leaseEndDate || prev?.endDate,
            }));
          }
        })
        .catch((err) => {
          console.warn("Could not fetch tenant workspace fallback for modal:", err);
        })
        .finally(handleFinally);
    } else {
      setLoadingDetails(false);
    }

    return () => {
      isMounted = false;
    };
  }, [reservationId, userId, email, phone, resolvedName, room, bed]);

  const handleOpenTenantsPage = () => {
    const searchStr = resolvedName || email;
    let url = "/admin/tenants";
    if (reservationId) {
      url = `/admin/tenants?reservationId=${encodeURIComponent(String(reservationId))}${
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
  const initials = resolvedName ? getInitials(resolvedName) : isReserved ? "RES" : isLocked ? "PAY" : "UT";

  if (loadingDetails && !resolvedName) {
    const skeletonContent = (
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
          {/* Skeleton Top Header */}
          <div className="p-4 border-b border-border/70 bg-muted/30 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
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

          {/* Skeleton Body Details */}
          <div className="p-4 space-y-3">
            <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="h-3.5 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-3.5 w-36 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-3.5 w-52 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          </div>

          {/* Skeleton Footer */}
          <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-3 py-1.5 bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 rounded-md text-xs font-medium transition-colors"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
    if (typeof document === "undefined") return skeletonContent;
    return createPortal(skeletonContent, document.body);
  }

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
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 bg-[#0A1628] text-white dark:bg-[#D4AF37] dark:text-[#0A1628] border border-[#0A1628]/20 dark:border-[#D4AF37]/40 shadow-xs"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-foreground truncate leading-snug">
                {resolvedName || (isReserved ? "Reserved Bed" : isLocked ? "Payment Pending" : "Tenant Profile")}
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium text-[11px] bg-card text-foreground border border-border"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLocked || isReserved ? "bg-amber-500" : "bg-emerald-500"}`} />
              {isReserved ? "Reserved" : isLocked ? "Payment Pending" : "Active Tenant"}
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
              <div className="flex items-center justify-between gap-2 text-muted-foreground flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="flex-shrink-0 text-foreground/70" />
                  <span className="text-foreground font-medium">
                    {occupiedSince && expectedVacancy
                      ? `${formatDate(occupiedSince)} → ${formatDate(expectedVacancy)}`
                      : occupiedSince
                      ? `Since ${formatDate(occupiedSince)}`
                      : `Until ${formatDate(expectedVacancy)}`}
                  </span>
                </div>
                {expectedVacancy && daysRemaining != null && (
                  <span
                    className={`whitespace-nowrap inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-border bg-card ${
                      daysRemaining <= 7
                        ? "text-rose-700 dark:text-rose-400"
                        : daysRemaining <= 30
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {daysRemaining <= 0
                      ? "Vacant Today"
                      : `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left`}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Compact Footer Actions */}
        <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
          {/* Release Bed — only shown for payment-pending (locked) beds */}
          <div>
            {isLocked && onReleaseBed && (
              <button
                type="button"
                className="px-3 py-1.5 bg-card text-rose-700 border border-border hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                onClick={() => { onReleaseBed(bed); onClose(); }}
                title="Release this bed back to Vacant. This will cancel the applicant's payment window."
              >
                <Unlock size={12} />
                Release Bed
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 rounded-md text-xs font-medium transition-colors"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="px-3 py-1.5 bg-[#0A1628] text-white hover:bg-[#13243D] focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              onClick={handleOpenTenantsPage}
            >
              Full Profile
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
}
