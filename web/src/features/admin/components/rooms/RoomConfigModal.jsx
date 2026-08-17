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
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Hash,
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
  Users,
  X,
} from "lucide-react";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import { roomApi } from "../../../../shared/api/roomApi";
import { showNotification } from "../../../../shared/utils/notification";
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
    return 2;
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
  const [activeMenuBedIndex, setActiveMenuBedIndex] = useState(null);
  const [selectedOccupantBed, setSelectedOccupantBed] = useState(null);
  const [newAmenityInput, setNewAmenityInput] = useState("");
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const COMMON_AMENITIES_PRESETS = [
    "Air Conditioning",
    "WiFi",
    "Double Decker Bed",
    "Mattress",
    "Table",
    "Chair",
    "Cabinet",
    "Shower Water Heater",
  ];

  const getNormalizedAmenities = (amenities) => {
    if (Array.isArray(amenities)) {
      return amenities.map((a) => String(a).trim()).filter(Boolean);
    }
    if (typeof amenities === "string") {
      return amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
    }
    return [];
  };

  const isFormDirty = () => {
    if (!isEditing) return false;
    const fieldsToCompare = ["name", "roomNumber", "price", "description", "isPopular"];
    for (const field of fieldsToCompare) {
      const origVal = room?.[field] ?? "";
      const draftVal = draftRoom?.[field] ?? "";
      if (String(origVal) !== String(draftVal)) return true;
    }
    const origAmenities = getNormalizedAmenities(room?.amenities).join(",");
    const draftAmenities = getNormalizedAmenities(draftRoom?.amenities).join(",");
    if (origAmenities !== draftAmenities) return true;

    const origBeds = JSON.stringify((room?.beds || []).map((b) => ({ id: b.id, position: b.position, status: b.status })));
    const draftBeds = JSON.stringify((draftRoom?.beds || []).map((b) => ({ id: b.id, position: b.position, status: b.status })));
    if (origBeds !== draftBeds) return true;

    return false;
  };

  const handleAttemptClose = () => {
    if (isFormDirty()) {
      setPendingAction("close");
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const handleAttemptToggleEdit = () => {
    if (isEditing && isFormDirty()) {
      setPendingAction("toggleEdit");
      setShowConfirmClose(true);
    } else {
      setIsEditing(!isEditing);
    }
  };

  const handleConfirmDiscard = () => {
    setShowConfirmClose(false);
    if (pendingAction === "toggleEdit") {
      setDraftRoom(room);
      setIsEditing(false);
    } else {
      onClose();
    }
    setPendingAction(null);
  };

  const handleAddAmenity = (amenityToAdd) => {
    const clean = amenityToAdd.trim();
    if (!clean) return;
    const currentList = getNormalizedAmenities(draftRoom?.amenities);
    if (currentList.some((a) => a.toLowerCase() === clean.toLowerCase())) {
      return;
    }
    const updated = [...currentList, clean];
    handleFieldChange("amenities", updated);
    setNewAmenityInput("");
  };

  const handleRemoveAmenity = (indexToRemove) => {
    const currentList = getNormalizedAmenities(draftRoom?.amenities);
    const updated = currentList.filter((_, idx) => idx !== indexToRemove);
    handleFieldChange("amenities", updated);
  };

  const handleTogglePresetAmenity = (preset) => {
    const currentList = getNormalizedAmenities(draftRoom?.amenities);
    const exists = currentList.some((a) => a.toLowerCase() === preset.toLowerCase());
    if (exists) {
      const updated = currentList.filter((a) => a.toLowerCase() !== preset.toLowerCase());
      handleFieldChange("amenities", updated);
    } else {
      const updated = [...currentList, preset];
      handleFieldChange("amenities", updated);
    }
  };

  useEscapeClose(true, handleAttemptClose);

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

  useEffect(() => {
    setDraftRoom(room);
    const imgs = getInitialImages(room);
    setImagesState(imgs.map(buildImageState));
  }, [room]);

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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".bed-action-menu")) {
        setActiveMenuBedIndex(null);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

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
    if (field === "name") {
      const lettersOnly = value.replace(/[^a-zA-Z\s-]/g, "");
      setDraftRoom((prev) => ({ ...prev, name: lettersOnly }));
    } else if (field === "roomNumber") {
      const digitsOnly = value.replace(/\D/g, "");
      setDraftRoom((prev) => ({ ...prev, roomNumber: digitsOnly }));
    } else {
      setDraftRoom((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
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

  const handleToggleMaintenance = (targetIndex) => {
    setBeds((beds) =>
      beds.map((bed, idx) => {
        if (idx !== targetIndex) return bed;
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

  const handleBedFieldChange = (targetIndex, field, value) => {
    setBeds((beds) =>
      beds.map((bed, idx) => (idx === targetIndex ? { ...bed, [field]: value } : bed)),
    );
  };

  const handleAddBed = () => {
    if (isMaxBedsReached) {
      showNotification({
        message: `Maximum limit of ${maxBeds} beds reached for ${formatRoomType(roomType)} room.`,
        type: "warning",
      });
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

  const handleMoveBed = (targetIndex, direction) => {
    setBeds((beds) => {
      const nextIndex = direction === "up" ? targetIndex - 1 : targetIndex + 1;
      if (targetIndex < 0 || nextIndex < 0 || nextIndex >= beds.length) {
        return beds;
      }
      const nextBeds = [...beds];
      const [movedBed] = nextBeds.splice(targetIndex, 1);
      nextBeds.splice(nextIndex, 0, movedBed);
      return nextBeds;
    });
  };

  const handleRemoveBed = (targetIndex) => {
    setBeds((beds) => beds.filter((_, idx) => idx !== targetIndex));
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
    // 1. Unique Bed Code Validation
    const bedIds = (draftRoom.beds || []).map((b) => String(b.id || "").trim().toLowerCase());
    const uniqueBedIds = new Set(bedIds);
    if (bedIds.length !== uniqueBedIds.size) {
      showNotification({
        message: "Each bed must have a unique code (e.g. bed-1, bed-2). Duplicate bed codes are not allowed.",
        type: "warning",
      });
      return;
    }

    // 2. Room Name validation
    const nameVal = (draftRoom.name || "").trim();
    if (!nameVal) {
      showNotification({
        message: "Room name is required.",
        type: "warning",
      });
      return;
    }
    if (nameVal.length > 50) {
      showNotification({
        message: "Room name cannot exceed 50 characters.",
        type: "warning",
      });
      return;
    }

    // 3. Room Number validation
    const roomNumVal = (draftRoom.roomNumber || "").trim();
    if (!roomNumVal) {
      showNotification({
        message: "Room number is required.",
        type: "warning",
      });
      return;
    }
    if (roomNumVal.length > 10) {
      showNotification({
        message: "Room number cannot exceed 10 digits.",
        type: "warning",
      });
      return;
    }

    // 4. Base Price validation
    const priceVal = Number(draftRoom.price || 0);
    if (priceVal < 0 || priceVal > 1000000) {
      showNotification({
        message: "Base price must be between ₱0 and ₱1,000,000.",
        type: "warning",
      });
      return;
    }

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
        name: nameVal,
        roomNumber: roomNumVal,
        description: (draftRoom.description || "").trim(),
        price: priceVal,
        monthlyPrice: 0,
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
        showNotification({
          message: "Room configuration saved successfully.",
          type: "success",
        });
        onClose();
      }
    } catch (err) {
      console.error("Failed to save room details:", err);
      showNotification({
        message: "Unable to save room changes. Please review the details and try again.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!draftRoom) return null;

  // Group beds by bunk pairs (2 beds per bunk)
  const bedsArray = draftRoom.beds || [];
  const bunksList = [];
  for (let i = 0; i < bedsArray.length; i += 2) {
    const bunkLetter = String.fromCharCode(65 + Math.floor(i / 2));
    const bunkBeds = bedsArray.slice(i, i + 2).map((bed, offset) => ({
      ...bed,
      bunkBlock: bunkLetter,
      globalIndex: i + offset,
    }));
    const occupiedInBunk = bunkBeds.filter((b) => {
      const st = getBedStatus(b);
      return (
        ["occupied", "reserved", "locked"].includes(st) ||
        b.available === false ||
        Boolean(b.occupiedBy?.userId) ||
        Boolean(b.occupiedBy?.name) ||
        Boolean(b.tenantName) ||
        Boolean(b.userName)
      );
    }).length;
    const maintenanceInBunk = bunkBeds.filter((b) => getBedStatus(b) === "maintenance").length;
    const availableInBunk = Math.max(0, bunkBeds.length - occupiedInBunk - maintenanceInBunk);
    bunksList.push({
      bunkBlock: bunkLetter,
      bunkLabel: `Bunk ${bunkLetter}`,
      beds: bunkBeds,
      occupiedCount: occupiedInBunk,
      availableCount: availableInBunk,
      maintenanceCount: maintenanceInBunk,
    });
  }

  return createPortal(
    <div className="admin-modal-overlay" onClick={handleAttemptClose}>
      <div
        className="admin-modal-content room-config-modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="admin-modal-header rfm-header">
          <div className="rfm-header__title-block">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#0A1628] dark:text-[#D4AF37] border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <h2>Configure Room: {draftRoom.name || `Room ${draftRoom.roomNumber}`}</h2>
              <div className="room-config-modal__header-badges">
                <span className="room-config-modal__badge">
                  <Building2 size={11} />
                  {formatBranch(draftRoom.branch)}
                </span>
                <span className="room-config-modal__badge">
                  Floor {draftRoom.floor}
                </span>
                <span className="room-config-modal__badge">
                  {formatRoomType(roomType)}
                </span>
                {isEditing ? (
                  <span className="room-config-modal__badge room-config-modal__badge--editing">
                    <Pencil size={11} className="text-amber-600 dark:text-amber-400" />
                    Editing Mode Active
                  </span>
                ) : (
                  <span className="room-config-modal__badge">
                    <Eye size={11} className="text-slate-500" />
                    View Mode
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="room-config-modal__header-actions">
            <button
              type="button"
              className={`room-config-modal__icon-btn ${isEditing ? "rfm-type-card--active" : ""}`}
              onClick={handleAttemptToggleEdit}
              aria-label={isEditing ? "Switch to view mode" : "Edit room configuration"}
              title={isEditing ? "Switch to View Mode" : "Edit Room Details"}
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
              onClick={handleAttemptClose}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="admin-modal-body rfm-body">
          {/* Section: Overview / Details */}
          <div className="rfm-section">
            <div className="rfm-section-label">
              <Building2 size={13} />
              Room Overview
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div className="room-form-row">
                  <div className="room-form-group">
                    <label>Room Name / Title <span className="rfm-required">*</span></label>
                    <input
                      type="text"
                      spellCheck={false}
                      maxLength={50}
                      value={draftRoom.name || ""}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder="e.g. Premium Suite"
                    />
                  </div>
                  <div className="room-form-group">
                    <label>Room Number <span className="rfm-required">*</span></label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      spellCheck={false}
                      maxLength={10}
                      value={draftRoom.roomNumber || ""}
                      onChange={(e) => handleFieldChange("roomNumber", e.target.value)}
                      placeholder="e.g. 202"
                    />
                  </div>
                </div>

                <div className="room-form-group">
                  <label>Base Price (₱) <span className="rfm-required">*</span></label>
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    value={draftRoom.price ?? 0}
                    onChange={(e) => handleFieldChange("price", e.target.value)}
                  />
                  <span className="capacity-hint">
                    Undiscounted rate per tenant/month. Effective long-term monthly rates are automatically calculated using your Business Settings discount percentages.
                  </span>
                </div>

                <div className="room-form-group">
                  <label>Public Description</label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={draftRoom.description || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    placeholder="Brief details about room furnishings, view, or amenities..."
                  />
                </div>

                <div className="room-form-group">
                  <label>Amenities</label>
                  <div className="amenities-tag-container">
                    {getNormalizedAmenities(draftRoom.amenities).length > 0 ? (
                      getNormalizedAmenities(draftRoom.amenities).map((tag, idx) => (
                        <span key={idx} className="amenity-chip">
                          {tag}
                          <button
                            type="button"
                            className="amenity-chip__remove"
                            onClick={() => handleRemoveAmenity(idx)}
                            title={`Remove ${tag}`}
                            aria-label={`Remove ${tag}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="amenities-empty-hint">No amenities added yet</span>
                    )}
                  </div>

                  <div className="amenity-input-row">
                    <input
                      type="text"
                      value={newAmenityInput}
                      onChange={(e) => setNewAmenityInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddAmenity(newAmenityInput);
                        }
                      }}
                      placeholder="Type amenity and press Enter..."
                      className="amenity-custom-input"
                    />
                    <button
                      type="button"
                      className="btn-add-amenity"
                      onClick={() => handleAddAmenity(newAmenityInput)}
                      disabled={!newAmenityInput.trim()}
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>

                  <div className="amenities-presets-block">
                    <span className="amenities-presets-label">Quick Presets</span>
                    <div className="amenities-presets-list">
                      {COMMON_AMENITIES_PRESETS.map((preset) => {
                        const isSelected = getNormalizedAmenities(draftRoom.amenities).some(
                          (a) => a.toLowerCase() === preset.toLowerCase()
                        );
                        return (
                          <button
                            key={preset}
                            type="button"
                            className={`amenity-preset-btn ${isSelected ? "amenity-preset-btn--selected" : ""}`}
                            onClick={() => handleTogglePresetAmenity(preset)}
                          >
                            {isSelected ? "✓ " : "+ "}
                            {preset}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div
                  className="rfm-beds-notice rfm-beds-notice--clickable"
                  onClick={() => handleFieldChange("isPopular", !draftRoom.isPopular)}
                  style={{ cursor: "pointer" }}
                >
                  <Star size={14} className={draftRoom.isPopular ? "text-amber-500 fill-amber-500" : ""} />
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Mark as "Most Popular" Room for public listings</span>
                    <input
                      type="checkbox"
                      checked={Boolean(draftRoom.isPopular)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleFieldChange("isPopular", e.target.checked);
                      }}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="info-grid">
                <div className="info-tile">
                  <span className="info-tile__label">Room Type</span>
                  <span className="info-tile__value">{formatRoomType(draftRoom.type)}</span>
                </div>
                <div className="info-tile">
                  <span className="info-tile__label">Total Capacity</span>
                  <span className="info-tile__value">{draftRoom.capacity} pax ({draftRoom.beds?.length || 0} beds)</span>
                </div>
                <div className="info-tile">
                  <span className="info-tile__label">Base Price</span>
                  <span className="info-tile__value info-tile__value--price">
                    ₱{Number(draftRoom.price || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">/ mo</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section: Photos */}
          <div className="rfm-section">
            <div className="rfm-section-label">
              <ImagePlus size={13} />
              Room Photos ({imagesState.length})
            </div>

            {isEditing ? (
              imagesState.length > 0 ? (
                <div className="image-preview-grid">
                  {imagesState.map((entry) => (
                    <article key={entry.id} className="image-preview-card">
                      <img
                        src={entry.preview}
                        alt="Room"
                        className="image-preview-card__img"
                      />
                      <div className="image-preview-card__footer">
                        <span className="image-preview-card__name">{entry.name}</span>
                        <button
                          type="button"
                          className="image-preview-card__remove"
                          onClick={() => handleRemoveImage(entry.id)}
                          aria-label="Remove image"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </article>
                  ))}
                  <label className="rfm-photo-add-more">
                    <ImagePlus size={18} />
                    <span>Add more</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      multiple
                      hidden
                      onChange={handleImageSelection}
                    />
                  </label>
                </div>
              ) : (
                <label className="rfm-photo-dropzone">
                  <ImagePlus size={22} />
                  <span className="rfm-photo-dropzone__title">Upload room photos</span>
                  <span className="rfm-photo-dropzone__hint">
                    Applicants will see these photos while browsing available rooms
                  </span>
                  <span className="rfm-photo-dropzone__btn">Choose Photos</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    multiple
                    hidden
                    onChange={handleImageSelection}
                  />
                </label>
              )
            ) : (
              imagesState.length > 0 ? (
                <div className="image-preview-grid">
                  {imagesState.map((entry) => (
                    <div key={entry.id} className="image-preview-card" style={{ height: "80px" }}>
                      <img
                        src={entry.preview}
                        alt="Room photo"
                        className="image-preview-card__img"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <span className="capacity-hint">No photos added yet.</span>
              )
            )}
          </div>

          {/* Section: Bed Configuration (Bunk Pair Groupings) */}
          {!isPrivate && (
            <div className="rfm-section">
              <div className="bed-config-section__header">
                <div className="rfm-section-label" style={{ marginBottom: 0 }}>
                  <Bed size={13} />
                  Bed Configuration
                  <span className={`bed-count-pill ${isMaxBedsReached ? "bed-count-pill--full" : ""}`}>
                    {currentBedsCount}/{maxBeds} Beds
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={handleAddBed}
                  disabled={!isEditing || isMaxBedsReached}
                  title={
                    !isEditing
                      ? "Switch to Edit Mode to add beds"
                      : isMaxBedsReached
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

              {/* Render beds grouped by Bunk Pair */}
              <div className="bed-list">
                {bunksList.length > 0 ? (
                  bunksList.map((bunkGroup) => (
                    <div key={bunkGroup.bunkLabel} className="rcm-bunk-card">
                      <div className="rcm-bunk-card__header">
                        <div className="rcm-bunk-card__title-group">
                          <Bed size={15} className="rcm-bunk-card__icon" />
                          <span className="rcm-bunk-card__title">{bunkGroup.bunkLabel}</span>
                        </div>
                        <span className="rcm-bunk-card__summary-badge">
                          {bunkGroup.beds.length} {bunkGroup.beds.length === 1 ? "Deck" : "Decks"}
                          {bunkGroup.occupiedCount === 0 && bunkGroup.maintenanceCount === 0 && " • All Available"}
                          {bunkGroup.occupiedCount === bunkGroup.beds.length && " • Fully Occupied"}
                          {bunkGroup.maintenanceCount === bunkGroup.beds.length && " • In Maintenance"}
                          {!(bunkGroup.occupiedCount === 0 && bunkGroup.maintenanceCount === 0) &&
                            !(bunkGroup.occupiedCount === bunkGroup.beds.length) &&
                            !(bunkGroup.maintenanceCount === bunkGroup.beds.length) && (
                              ` • ${[
                                bunkGroup.occupiedCount > 0 ? `${bunkGroup.occupiedCount} Occupied` : null,
                                bunkGroup.availableCount > 0 ? `${bunkGroup.availableCount} Available` : null,
                                bunkGroup.maintenanceCount > 0 ? `${bunkGroup.maintenanceCount} Maint` : null,
                              ].filter(Boolean).join(", ")}`
                            )}
                        </span>
                      </div>

                      <div className="rcm-bunk-card__body">
                        {bunkGroup.beds.map((bed) => {
                          const index = bed.globalIndex;
                          const rawStatus = getBedStatus(bed);
                          const normStatus = String(rawStatus || "").toLowerCase();
                          const isLocked = ["occupied", "reserved", "locked"].includes(normStatus);
                          const isInputDisabled = !isEditing || isLocked;
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
                            ["occupied", "reserved", "locked"].includes(normStatus) ||
                            bed.available === false ||
                            Boolean(occupantName) ||
                            Boolean(occupant.userId) ||
                            Boolean(occupant.reservationId);

                          const isUpper = bed.position === "upper";
                          const isBedActiveMenu = activeMenuBedIndex === index;

                          return (
                            <div
                              key={bed._id ? `bed-${bed._id}` : `bed-slot-${index}`}
                              className={`rcm-deck-row ${isBedActiveMenu ? "rcm-deck-row--active-menu" : ""}`}
                            >
                              <div className="rcm-deck-main">
                                {/* Deck Label with Arrow Icon */}
                                <div className="rcm-deck-tag">
                                  {isUpper ? (
                                    <ArrowUp size={13} className="rcm-deck-tag__icon-upper shrink-0" />
                                  ) : (
                                    <ArrowDown size={13} className="rcm-deck-tag__icon-lower shrink-0" />
                                  )}
                                  <span>{isUpper ? "Upper Deck" : "Lower Deck"}</span>
                                </div>

                                {/* Framed Bed Code Box with Hash Icon */}
                                <div
                                  className={`rcm-bed-code-box ${isInputDisabled ? "rcm-bed-code-box--disabled" : ""}`}
                                  title={
                                    !isEditing
                                      ? "Switch to Edit Mode to rename bed"
                                      : isLocked
                                        ? "Bed code locked while occupied"
                                        : "Bed Code (e.g. bed-1)"
                                  }
                                >
                                  <Hash size={13} className="text-slate-400 shrink-0" />
                                  <input
                                    value={bed.id || ""}
                                    onChange={(event) =>
                                      handleBedFieldChange(index, "id", event.target.value)
                                    }
                                    disabled={isInputDisabled}
                                    readOnly={!isEditing}
                                    placeholder="Bed ID"
                                  />
                                </div>

                                {/* Deck Position Selector */}
                                <select
                                  className="rcm-deck-select"
                                  value={bed.position || "lower"}
                                  onChange={(event) =>
                                    handleBedFieldChange(
                                      index,
                                      "position",
                                      event.target.value,
                                    )
                                  }
                                  disabled={isInputDisabled}
                                  title={
                                    !isEditing
                                      ? "Switch to Edit Mode to change deck position"
                                      : isLocked
                                        ? "Position locked while occupied"
                                        : "Change Bed Deck Position"
                                  }
                                >
                                  <option value="lower">Lower Deck</option>
                                  <option value="upper">Upper Deck</option>
                                </select>

                                {/* Rich Tenant Card or Semantic Status Badge */}
                                {isOccupiedOrReserved ? (
                                  <button
                                    type="button"
                                    className={`rcm-tenant-btn ${
                                      normStatus === "reserved" || normStatus === "locked"
                                        ? "rcm-tenant-btn--reserved"
                                        : ""
                                    }`}
                                    onClick={() => handleOpenOccupantDetails(bed)}
                                    title={`View tenant profile for ${occupantName || "tenant"}`}
                                  >
                                    <span className="rcm-tenant-btn__avatar">
                                      {occupantName ? occupantName.charAt(0).toUpperCase() : <User size={11} />}
                                    </span>
                                    <span className="rcm-tenant-btn__name">
                                      {occupantName || (
                                        normStatus === "reserved" ? "Reserved"
                                        : normStatus === "locked" ? "Payment Pending"
                                        : "Occupied"
                                      )}
                                    </span>
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        normStatus === "reserved" || normStatus === "locked"
                                          ? "bg-amber-500"
                                          : "bg-rose-500"
                                      }`}
                                    />
                                    <ExternalLink size={12} className="rcm-tenant-btn__link-icon" />
                                  </button>
                                ) : (
                                  <span className={`rcm-status-tag ${
                                    normStatus === "maintenance"
                                      ? "rcm-status-tag--maintenance"
                                      : "rcm-status-tag--available"
                                  }`}>
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${
                                        normStatus === "maintenance"
                                          ? "bg-slate-400"
                                          : "bg-emerald-500"
                                      }`}
                                    />
                                    <span>
                                      {normStatus === "maintenance" ? "Maintenance" : "Available"}
                                    </span>
                                  </span>
                                )}
                              </div>

                              {/* Action Menu (⋮) */}
                              <div className="bed-action-menu shrink-0">
                                <button
                                  type="button"
                                  className={`rcm-action-menu-btn ${
                                    isBedActiveMenu ? "rcm-action-menu-btn--active" : ""
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuBedIndex(isBedActiveMenu ? null : index);
                                  }}
                                  aria-label="Bed options"
                                  title="Bed options"
                                >
                                  <MoreVertical size={15} />
                                </button>

                                {isBedActiveMenu && (
                                  <div className="bed-menu-dropdown">
                                    <button
                                      type="button"
                                      className="bed-menu-item"
                                      onClick={() => {
                                        handleToggleMaintenance(index);
                                        setActiveMenuBedIndex(null);
                                      }}
                                      disabled={isLocked}
                                      title={isLocked ? "Cannot put occupied bed into maintenance" : undefined}
                                    >
                                      <Lock size={14} />
                                      {normStatus === "maintenance" ? "Unlock Bed" : "Maintenance Mode"}
                                    </button>

                                    <button
                                      type="button"
                                      className="bed-menu-item"
                                      onClick={() => {
                                        handleMoveBed(index, "up");
                                        setActiveMenuBedIndex(null);
                                      }}
                                      disabled={!isEditing || index === 0}
                                      title={!isEditing ? "Switch to Edit Mode to reorder beds" : index === 0 ? "Already at the top" : undefined}
                                    >
                                      <ArrowUp size={14} />
                                      Move Deck Up
                                    </button>

                                    <button
                                      type="button"
                                      className="bed-menu-item"
                                      onClick={() => {
                                        handleMoveBed(index, "down");
                                        setActiveMenuBedIndex(null);
                                      }}
                                      disabled={!isEditing || index === (draftRoom.beds?.length || 0) - 1}
                                      title={!isEditing ? "Switch to Edit Mode to reorder beds" : index === (draftRoom.beds?.length || 0) - 1 ? "Already at the bottom" : undefined}
                                    >
                                      <ArrowDown size={14} />
                                      Move Deck Down
                                    </button>

                                    <div className="bed-menu-divider" />

                                    <button
                                      type="button"
                                      className="bed-menu-item bed-menu-item--danger"
                                      onClick={() => {
                                        handleRemoveBed(index);
                                        setActiveMenuBedIndex(null);
                                      }}
                                      disabled={!isEditing || isLocked}
                                      title={!isEditing ? "Switch to Edit Mode to remove bed" : isLocked ? "Cannot remove an occupied or reserved bed" : undefined}
                                    >
                                      <Trash2 size={14} />
                                      Remove Bed
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="room-config-empty-state">
                    <span>No beds have been configured for this room.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="admin-modal-footer">
          <button type="button" className="btn-secondary" onClick={handleAttemptClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary btn-primary--emerald"
            onClick={handleSaveAll}
            disabled={saving}
            title={saving ? "Saving room changes..." : "Save all room changes"}
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
          onReleaseBed={async (bed) => {
            try {
              await roomApi.releaseBed(draftRoom._id, bed.id);
              qc.invalidateQueries({ queryKey: ["room", draftRoom._id] });
              qc.invalidateQueries({ queryKey: ["rooms"] });
            } catch (err) {
              console.error("Failed to release bed:", err);
            }
          }}
        />
      )}

      {showConfirmClose && (
        <div className="confirm-discard-overlay" onClick={() => setShowConfirmClose(false)}>
          <div className="confirm-discard-card" onClick={(e) => e.stopPropagation()}>
            <h3>Discard Unsaved Changes?</h3>
            <p>You have unsaved changes to this room. Are you sure you want to discard them?</p>
            <div className="confirm-discard-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowConfirmClose(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }}
                onClick={handleConfirmDiscard}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}