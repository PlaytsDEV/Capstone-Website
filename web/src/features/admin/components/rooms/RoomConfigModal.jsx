import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useRoom } from "../../../../shared/hooks/queries/useRooms";
import { formatRoomType, formatBranch } from "../../utils/formatters";
import { getBedDisplayLabel } from "../../../../shared/utils/bedIdentifier";
import { uploadRoomPhotoIfFile } from "../../../../shared/utils/firebaseStorageUpload";
import {
  ArrowDown,
  ArrowUp,
  Bed,
  Building2,
  ExternalLink,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  ShieldAlert,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import { roomApi } from "../../../../shared/api/roomApi";
import BedOccupantDetailModal from "./BedOccupantDetailModal";

const makeImageId = () =>
  `room-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildImageState = (value) => ({
  id: makeImageId(),
  value,
  preview: typeof value === "string" ? value : URL.createObjectURL(value),
  name: typeof value === "string" ? "Uploaded image" : value.name,
});

export const getMaxBedsForRoomType = (type) => {
  const normType = String(type || "").toLowerCase().trim();
  if (normType === "quadruple-sharing" || normType.includes("quad")) {
    return 4;
  }
  if (normType === "double-sharing" || normType.includes("double") || normType.includes("shared")) {
    return 2;
  }
  if (normType === "private" || normType.includes("single")) {
    return 1;
  }
  return 4;
};

export default function RoomConfigModal({
  room,
  onClose,
  onSave,
  onEdit,
  onDelete,
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [draftRoom, setDraftRoom] = useState(room);
  const [isEditing, setIsEditing] = useState(false);
  const [imagesState, setImagesState] = useState([]);
  const [activeMenuBedId, setActiveMenuBedId] = useState(null);
  const [selectedOccupantBed, setSelectedOccupantBed] = useState(null);
  const [repairing, setRepairing] = useState(false);
  const [repairMsg, setRepairMsg] = useState(null); // { type: 'success'|'error', text: string }
  useEscapeClose(true, onClose);

  // Fetch a fresh individual room record so images (and other fields that
  // may be absent from the paginated list cache) are always current.
  const { data: freshRoom } = useRoom(room?._id);

  const roomType = draftRoom?.type || room?.type;
  const isPrivate =
    String(roomType || "").toLowerCase().trim() === "private" ||
    String(roomType || "").toLowerCase().includes("single");
  const maxBeds = getMaxBedsForRoomType(roomType);
  const currentBedsCount = (draftRoom?.beds || []).length;
  const isMaxBedsReached = currentBedsCount >= maxBeds;

  const getInitialImages = (roomObj) => {
    if (!roomObj) return [];
    let rawImages = Array.isArray(roomObj.images)
      ? roomObj.images.filter((img) => typeof img === "string" && img.trim())
      : [];
    if (rawImages.length === 0 && roomObj.image && typeof roomObj.image === "string" && roomObj.image.trim()) {
      rawImages = [roomObj.image.trim()];
    }
    return rawImages;
  };

  // Populate draft room when the prop changes (e.g., parent re-opens modal)
  useEffect(() => {
    setDraftRoom(room);
    const imgs = getInitialImages(room);
    setImagesState(imgs.map(buildImageState));
  }, [room]);

  // Overwrite imagesState and draftRoom with the freshly-fetched per-room data the moment it arrives.
  useEffect(() => {
    if (!freshRoom) return;
    setDraftRoom((prev) => ({
      ...freshRoom,
      ...prev,
      images: freshRoom.images || prev?.images,
    }));
    const imgs = getInitialImages(freshRoom);
    setImagesState(imgs.map(buildImageState));
  }, [freshRoom]);

  // Close bed action menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".bed-action-menu")) {
        setActiveMenuBedId(null);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  // Lock background scroll while modal is open
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, []);

  const getBedStatus = (bed) =>
    bed.status || (bed.available === false ? "occupied" : "available");

  const setBeds = (updater) => {
    setDraftRoom((current) => ({
      ...current,
      beds: updater([...(current?.beds || [])]),
    }));
  };

  const handleFieldChange = (field, value) => {
    setDraftRoom((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleImageSelection = (event) => {
    const selectedFiles = Array.from(event.target.files || []).filter(Boolean);
    if (selectedFiles.length === 0) return;

    const newEntries = selectedFiles.map(buildImageState);
    setImagesState((prev) => [...prev, ...newEntries]);
    event.target.value = "";
  };

  const handleRemoveImage = (imageId) => {
    setImagesState((prev) => prev.filter((entry) => entry.id !== imageId));
  };

  const handleToggleMaintenance = (bedId) => {
    setBeds((beds) =>
      beds.map((bed) => {
        if (bed.id !== bedId) return bed;
        const currentStatus = getBedStatus(bed);
        if (["occupied", "reserved", "locked"].includes(currentStatus)) {
          return bed;
        }
        return {
          ...bed,
          status: currentStatus === "maintenance" ? "available" : "maintenance",
        };
      }),
    );
  };

  const handleBedFieldChange = (bedId, field, value) => {
    setBeds((beds) =>
      beds.map((bed) => (bed.id === bedId ? { ...bed, [field]: value } : bed)),
    );
  };

  const handleAddBed = () => {
    if (isMaxBedsReached) {
      alert(
        `Cannot add more beds. Maximum limit of ${maxBeds} beds reached for ${formatRoomType(
          roomType,
        )} room.`,
      );
      return;
    }
    setBeds((beds) => [
      ...beds,
      {
        id: `bed-${beds.length + 1}`,
        position: beds.length % 2 === 0 ? "upper" : "lower",
        status: "available",
      },
    ]);
  };

  const handleMoveBed = (bedId, direction) => {
    setBeds((beds) => {
      const index = beds.findIndex((bed) => bed.id === bedId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || nextIndex < 0 || nextIndex >= beds.length) {
        return beds;
      }
      const nextBeds = [...beds];
      const [movedBed] = nextBeds.splice(index, 1);
      nextBeds.splice(nextIndex, 0, movedBed);
      return nextBeds;
    });
  };

  const handleRemoveBed = (bedId) => {
    setBeds((beds) => beds.filter((bed) => bed.id !== bedId));
  };

  const handleOpenOccupantDetails = (bed) => {
    setSelectedOccupantBed(bed);
  };

  const handleNavigateToTenants = (navUrl) => {
    setSelectedOccupantBed(null);
    if (onClose) onClose();
    navigate(navUrl);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const uploadedImages = await Promise.all(
        imagesState.map((entry) => uploadRoomPhotoIfFile(entry.value, String(draftRoom._id || ""))),
      );
      const finalImages = uploadedImages.filter(Boolean);

      const parsedAmenities = Array.isArray(draftRoom.amenities)
        ? draftRoom.amenities
        : typeof draftRoom.amenities === "string"
          ? draftRoom.amenities.split(",").map((s) => s.trim()).filter(Boolean)
          : [];

      const parsedPolicies = Array.isArray(draftRoom.policies)
        ? draftRoom.policies
        : typeof draftRoom.policies === "string"
          ? draftRoom.policies.split(",").map((s) => s.trim()).filter(Boolean)
          : [];

      const updatedDraft = {
        ...draftRoom,
        name: (draftRoom.name || "").trim(),
        roomNumber: (draftRoom.roomNumber || "").trim(),
        description: (draftRoom.description || "").trim(),
        price: Number(draftRoom.price || 0),
        monthlyPrice: Number(draftRoom.monthlyPrice || draftRoom.price || 0),
        isPopular: Boolean(draftRoom.isPopular),
        amenities: parsedAmenities,
        policies: parsedPolicies,
        images: finalImages,
        beds: draftRoom.beds || [],
      };

      if (onSave) {
        await onSave(updatedDraft);
      } else {
        await roomApi.update(draftRoom._id, updatedDraft);
        qc.invalidateQueries({ queryKey: ["rooms"] });
        onClose();
      }
    } catch (err) {
      console.error("Failed to save room details:", err);
    } finally {
      setSaving(false);
    }
  };

  /** Detect occupancy drift: counter > 0 but every bed is available */
  const hasDrift =
    !isPrivate &&
    (draftRoom.currentOccupancy || 0) > 0 &&
    (draftRoom.beds || []).every((b) => getBedStatus(b) === "available");

  /**
   * Detect the GP-201-type stale pointer: a bed is "reserved" or "occupied"
   * but no other bed in the same room carries the same occupant.
   */
  const reservationIdCounts = {};
  for (const bed of draftRoom.beds || []) {
    const s = getBedStatus(bed);
    const rid = bed.occupiedBy?.reservationId;
    if ((s === "reserved" || s === "occupied") && rid) {
      const key = String(rid);
      reservationIdCounts[key] = (reservationIdCounts[key] || 0) + 1;
    }
  }
  const hasDualBedPointer =
    !isPrivate && Object.values(reservationIdCounts).some((count) => count > 1);

  const handleRepairOccupancy = async () => {
    setRepairing(true);
    setRepairMsg(null);
    try {
      const res = await roomApi.repairOccupancy(draftRoom._id);
      const corrected = res?.data?.corrected || res?.corrected;
      const repairedRoom = res?.data?.room || res?.room;
      if (repairedRoom) {
        setDraftRoom((prev) => ({
          ...prev,
          currentOccupancy: repairedRoom.currentOccupancy,
          available: repairedRoom.available,
          beds: repairedRoom.beds || prev.beds,
        }));
      }
      qc.invalidateQueries({ queryKey: ["rooms"] });
      const from = corrected?.from?.currentOccupancy ?? "?";
      const to = corrected?.to?.currentOccupancy ?? repairedRoom?.currentOccupancy ?? "?";
      setRepairMsg({
        type: "success",
        text: `Occupancy corrected: ${from} → ${to}`,
      });
    } catch (err) {
      console.error("Repair occupancy failed:", err);
      setRepairMsg({
        type: "error",
        text: err?.message || "Repair failed. Please try again.",
      });
    } finally {
      setRepairing(false);
    }
  };

  if (!draftRoom) return null;

  const occupancyPercent = Math.min(
    100,
    Math.round(
      ((isPrivate
        ? Math.min(1, draftRoom.currentOccupancy || 0)
        : draftRoom.currentOccupancy || 0) /
        (isPrivate ? 1 : draftRoom.capacity || 1)) *
        100,
    ),
  );

  return createPortal(
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-content room-config-modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — sticky at top */}
        <div className="admin-modal-header">
          <div className="room-config-modal__header-title">
            <h2>Configure Room: {draftRoom.name || `Room ${draftRoom.roomNumber}`}</h2>
            <div className="room-config-modal__header-badges">
              <span className="room-config-modal__badge">
                <Building2 size={12} />
                {formatBranch(draftRoom.branch)}
              </span>
              <span className="room-config-modal__badge">
                Floor {draftRoom.floor}
              </span>
              {isEditing && (
                <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Edit Mode Active
                </span>
              )}
            </div>
          </div>

          <div className="room-config-modal__header-actions">
            <button
              type="button"
              className={`room-config-modal__icon-btn ${
                isEditing
                  ? "bg-primary text-primary-foreground border-primary"
                  : ""
              }`}
              onClick={() => setIsEditing(!isEditing)}
              aria-label={isEditing ? "View mode" : "Edit room configuration"}
              title={isEditing ? "Switch to View Mode" : "Edit Room & Bed Details"}
            >
              <Pencil size={16} />
            </button>
            {onDelete && (
              <button
                type="button"
                className="room-config-modal__icon-btn room-config-modal__icon-btn--danger"
                onClick={() => onDelete(draftRoom)}
                aria-label="Archive room"
                title="Archive room"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body — Single Column Scroll Container */}
        <div className="admin-modal-body">
          {/* Room Overview Section */}
          <div className="room-info-section">
            <div className="room-config-section-header">
              <div className="room-config-section-title">
                <Building2 size={15} className="text-muted-foreground" />
                <h3>Room Overview</h3>
              </div>
            </div>

            {isEditing ? (
              /* Inline Edit Mode Fields */
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Room Name / Title</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary"
                      value={draftRoom.name || ""}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder="e.g. Premium Suite GP-202"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Room Number</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary"
                      value={draftRoom.roomNumber || ""}
                      onChange={(e) => handleFieldChange("roomNumber", e.target.value)}
                      placeholder="e.g. 202"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Monthly Rate (₱)</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary font-semibold text-primary"
                      value={draftRoom.monthlyPrice ?? draftRoom.price ?? 0}
                      onChange={(e) => handleFieldChange("monthlyPrice", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Base Price (₱)</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary"
                      value={draftRoom.price ?? 0}
                      onChange={(e) => handleFieldChange("price", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Public Description</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary"
                    value={draftRoom.description || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    placeholder="Brief details about room furnishings, view, or amenities..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Amenities (comma-separated)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary"
                    value={
                      Array.isArray(draftRoom.amenities)
                        ? draftRoom.amenities.join(", ")
                        : draftRoom.amenities || ""
                    }
                    onChange={(e) => handleFieldChange("amenities", e.target.value)}
                    placeholder="Wi-Fi, Air Conditioning, Private Bathroom, Mattress"
                  />
                </div>

                {/* Photos Edit Section */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Room Photos ({imagesState.length})</span>
                  </label>
                  <div className="border border-dashed border-border rounded-xl p-3 bg-muted/20 space-y-3">
                    <label className="flex items-center justify-center gap-2 py-2 px-3 border border-border rounded-lg bg-background text-xs font-medium cursor-pointer hover:bg-muted transition-colors text-foreground shadow-xs">
                      <ImagePlus size={16} className="text-primary" />
                      <span>Upload Room Photos</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic"
                        multiple
                        hidden
                        onChange={handleImageSelection}
                      />
                    </label>

                    {imagesState.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {imagesState.map((entry) => (
                          <div
                            key={entry.id}
                            className="relative group rounded-lg overflow-hidden border border-border h-20 bg-muted"
                          >
                            <img
                              src={entry.preview}
                              alt="Room"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(entry.id)}
                              className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-80 hover:opacity-100 transition-opacity shadow-xs"
                              title="Remove photo"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground text-center py-1">
                        No photos added yet. Upload room photos for website listings.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500 fill-current" />
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        Mark as "Most Popular" Room
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Displays a highlighted badge for public visitors
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(draftRoom.isPopular)}
                    onChange={(e) => handleFieldChange("isPopular", e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            ) : (
              /* View Mode Overview Cards & Photos */
              <div className="space-y-4">
                <div className="info-grid">
                  <div className="info-tile">
                    <span className="info-tile__label">Type</span>
                    <span className="info-tile__value">{formatRoomType(draftRoom.type)}</span>
                  </div>
                  <div className="info-tile">
                    <span className="info-tile__label">Capacity</span>
                    <span className="info-tile__value">{draftRoom.capacity} pax</span>
                  </div>
                  <div className="info-tile">
                    <span className="info-tile__label">Base Price</span>
                    <span className="info-tile__value info-tile__value--price">
                      ₱{Number(draftRoom.price || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="info-tile">
                    <span className="info-tile__label">Monthly Price</span>
                    <span className="info-tile__value info-tile__value--price-highlight">
                      ₱{Number(draftRoom.monthlyPrice || draftRoom.price || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* View Mode Photos Grid */}
                {imagesState.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ImageIcon size={13} className="text-muted-foreground" />
                      Room Photos ({imagesState.length})
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {imagesState.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg overflow-hidden border border-border/70 h-20 bg-muted"
                        >
                          <img
                            src={entry.preview}
                            alt="Room photo"
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bed Configuration Section */}
          {!isPrivate && (
            <div className="bed-config-section">
              <div className="bed-config-section__header">
                <div className="room-config-section-title mb-0">
                  <Bed size={15} className="text-muted-foreground" />
                  <h3>Bed Configuration</h3>
                  <span className={`bed-count-pill ${isMaxBedsReached ? "bed-count-pill--full" : ""}`}>
                    {currentBedsCount}/{maxBeds} Beds
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={handleAddBed}
                  disabled={isMaxBedsReached}
                  title={
                    isMaxBedsReached
                      ? `Maximum ${maxBeds} beds allowed for ${formatRoomType(roomType)}`
                      : "Add Bed"
                  }
                >
                  <Plus size={14} />
                  Add Bed
                </button>
              </div>

              {isMaxBedsReached && (
                <div className="bed-limit-banner">
                  <ShieldAlert size={15} className="shrink-0" />
                  <span>Maximum {maxBeds} beds reached for {formatRoomType(roomType)} room.</span>
                </div>
              )}

              <div className="bed-list">
                {draftRoom.beds && draftRoom.beds.length > 0 ? (
                  draftRoom.beds.map((bed, index) => {
                    const rawStatus = getBedStatus(bed);
                    const normStatus = String(rawStatus || "").toLowerCase();
                    const isLocked = ["occupied", "reserved", "locked"].includes(normStatus);
                    const occupant = bed.occupiedBy || {};
                    const occupantName =
                      occupant.name ||
                      occupant.userName ||
                      bed.userName ||
                      bed.tenantName ||
                      (occupant.firstName || occupant.lastName
                        ? `${occupant.firstName || ""} ${occupant.lastName || ""}`.trim()
                        : null);

                    const isOccupiedOrReserved =
                      ["occupied", "reserved"].includes(normStatus) ||
                      bed.available === false ||
                      Boolean(occupantName) ||
                      Boolean(occupant.userId) ||
                      Boolean(occupant.reservationId);

                    return (
                      <div
                        key={`${bed.id || "bed"}-${index}`}
                        className={`bed-item flex-nowrap whitespace-nowrap${activeMenuBedId === bed.id ? " bed-item--menu-active" : ""}`}
                      >
                        <div className="bed-info flex-nowrap items-center min-w-0 flex-1 whitespace-nowrap">
                          <span className="bed-label-tag shrink-0 w-32 truncate">
                            {getBedDisplayLabel(bed, index)}
                          </span>

                          <div className="bed-field-group shrink-0">
                            <span className="bed-field-label">Code</span>
                            <input
                              className="bed-id w-24"
                              value={bed.id || ""}
                              onChange={(event) =>
                                handleBedFieldChange(bed.id, "id", event.target.value)
                              }
                              disabled={isLocked}
                              placeholder="e.g. bed-1"
                            />
                          </div>

                          <div className="bed-field-group shrink-0">
                            <span className="bed-field-label">Position</span>
                            <select
                              className="bed-position"
                              value={bed.position || "lower"}
                              onChange={(event) =>
                                handleBedFieldChange(
                                  bed.id,
                                  "position",
                                  event.target.value,
                                )
                              }
                              disabled={isLocked}
                            >
                              <option value="upper">Upper</option>
                              <option value="lower">Lower</option>
                            </select>
                          </div>

                          {isOccupiedOrReserved ? (
                            <div className="shrink-0">
                              <button
                                type="button"
                                className={`bed-occupant-badge bed-occupant-badge--${normStatus === "reserved" ? "reserved" : "occupied"}`}
                                onClick={() => handleOpenOccupantDetails(bed)}
                                title={`View summary for ${occupantName || "occupant"}`}
                              >
                                <User size={13} className="bed-occupant-icon" />
                                <span className="bed-occupant-name truncate max-w-[120px]">
                                  {occupantName || (normStatus === "reserved" ? "Reserved" : "Occupied")}
                                </span>
                                <ExternalLink size={12} className="bed-occupant-link-icon shrink-0" />
                              </button>
                            </div>
                          ) : (
                            <span className={`status-badge status-badge--${normStatus} shrink-0`}>
                              {rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)}
                            </span>
                          )}
                        </div>

                        <div className="bed-action-menu shrink-0">
                          <button
                            type="button"
                            className={`bed-menu-trigger${activeMenuBedId === bed.id ? " bed-menu-trigger--active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuBedId(activeMenuBedId === bed.id ? null : bed.id);
                            }}
                            aria-label="Bed options"
                            title="Bed options"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeMenuBedId === bed.id && (
                            <div className="bed-menu-dropdown">
                              <button
                                type="button"
                                className="bed-menu-item"
                                onClick={() => {
                                  handleToggleMaintenance(bed.id);
                                  setActiveMenuBedId(null);
                                }}
                                disabled={isLocked}
                              >
                                <Lock size={14} />
                                {normStatus === "maintenance" ? "Unlock Bed" : "Maintenance Mode"}
                              </button>

                              <button
                                type="button"
                                className="bed-menu-item"
                                onClick={() => {
                                  handleMoveBed(bed.id, "up");
                                  setActiveMenuBedId(null);
                                }}
                                disabled={index === 0}
                              >
                                <ArrowUp size={14} />
                                Move Up
                              </button>

                              <button
                                type="button"
                                className="bed-menu-item"
                                onClick={() => {
                                  handleMoveBed(bed.id, "down");
                                  setActiveMenuBedId(null);
                                }}
                                disabled={index === draftRoom.beds.length - 1}
                              >
                                <ArrowDown size={14} />
                                Move Down
                              </button>

                              <div className="bed-menu-divider" />

                              <button
                                type="button"
                                className="bed-menu-item bed-menu-item--danger"
                                onClick={() => {
                                  handleRemoveBed(bed.id);
                                  setActiveMenuBedId(null);
                                }}
                                disabled={isLocked}
                              >
                                <Trash2 size={14} />
                                Remove Bed
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="room-config-empty-state">
                    <span>No beds have been configured for this room.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Occupancy Section */}
          <div className="occupancy-info">
            <div className="occupancy-header">
              <h3>Current Occupancy</h3>
              <span className="occupancy-percentage-tag">
                {occupancyPercent}% Occupied
              </span>
            </div>
            <div className="occupancy-bar">
              <div
                className="occupancy-fill"
                style={{ width: `${occupancyPercent}%` }}
              />
            </div>
            <p className="occupancy-label">
              {isPrivate
                ? `${Math.min(1, draftRoom.currentOccupancy || 0)} of 1 room currently occupied`
                : `${draftRoom.currentOccupancy || 0} of ${draftRoom.capacity || 1} beds currently occupied`}
            </p>

            {/* Drift repair */}
            {hasDrift && (
              <div className="occupancy-drift-alert">
                <div className="occupancy-drift-alert__content">
                  <ShieldAlert size={16} className="text-amber-600 flex-shrink-0" />
                  <span>
                    Counter mismatch detected &mdash; no active reservations but
                    occupancy shows {draftRoom.currentOccupancy}.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-repair-occupancy"
                  onClick={handleRepairOccupancy}
                  disabled={repairing}
                >
                  {repairing && <Loader2 size={13} className="animate-spin mr-1" />}
                  {repairing ? "Repairing…" : "Repair Occupancy"}
                </button>
              </div>
            )}

            {/* Stale pointer repair */}
            {!hasDrift && hasDualBedPointer && (
              <div className="occupancy-drift-alert occupancy-drift-alert--warning">
                <div className="occupancy-drift-alert__content">
                  <ShieldAlert size={16} className="text-amber-600 flex-shrink-0" />
                  <span>
                    Stale bed pointer detected &mdash; the same reservation appears
                    on multiple beds. Tap Repair Beds to fix.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-repair-occupancy"
                  onClick={handleRepairOccupancy}
                  disabled={repairing}
                >
                  {repairing && <Loader2 size={13} className="animate-spin mr-1" />}
                  {repairing ? "Repairing…" : "Repair Beds"}
                </button>
              </div>
            )}

            {/* Inline repair feedback */}
            {repairMsg && (
              <p
                className={`occupancy-repair-msg occupancy-repair-msg--${
                  repairMsg.type
                }`}
              >
                {repairMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* Footer — Save / Cancel Buttons */}
        <div className="admin-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveAll}
            disabled={saving}
          >
            {saving && <Loader2 size={15} className="animate-spin mr-1.5" />}
            {saving ? "Saving Changes..." : "Save All Room Changes"}
          </button>
        </div>
      </div>
      {selectedOccupantBed && (
        <BedOccupantDetailModal
          bed={selectedOccupantBed}
          room={draftRoom}
          onClose={() => setSelectedOccupantBed(null)}
          onNavigateToTenants={handleNavigateToTenants}
        />
      )}
    </div>,
    document.body
  );
}