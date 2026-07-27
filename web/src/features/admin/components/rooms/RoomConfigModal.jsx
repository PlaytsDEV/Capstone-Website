import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatRoomType, formatBranch } from "../../utils/formatters";
import { getBedDisplayLabel } from "../../../../shared/utils/bedIdentifier";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Image as ImageIcon,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  User,
  X,
} from "lucide-react";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import { roomApi } from "../../../../shared/api/roomApi";

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
  const [activeMenuBedId, setActiveMenuBedId] = useState(null);
  const [repairing, setRepairing] = useState(false);
  const [repairMsg, setRepairMsg] = useState(null); // { type: 'success'|'error', text: string }
  useEscapeClose(true, onClose);

  const roomType = draftRoom?.type || room?.type;
  const isPrivate =
    String(roomType || "").toLowerCase().trim() === "private" ||
    String(roomType || "").toLowerCase().includes("single");
  const maxBeds = getMaxBedsForRoomType(roomType);
  const currentBedsCount = (draftRoom?.beds || []).length;
  const isMaxBedsReached = currentBedsCount >= maxBeds;

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

  useEffect(() => {
    setDraftRoom(room);
  }, [room]);

  const getBedStatus = (bed) =>
    bed.status || (bed.available === false ? "occupied" : "available");

  const setBeds = (updater) => {
    setDraftRoom((current) => ({
      ...current,
      beds: updater([...(current?.beds || [])]),
    }));
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

  const handleNavigateToOccupant = (bed) => {
    const occupant = bed.occupiedBy || {};
    const name =
      occupant.name ||
      occupant.userName ||
      bed.userName ||
      bed.tenantName ||
      (occupant.firstName || occupant.lastName
        ? `${occupant.firstName || ""} ${occupant.lastName || ""}`.trim()
        : "");
    const email = occupant.email || occupant.userEmail || bed.userEmail || "";
    const resId = occupant.reservationId || bed.reservationId;

    if (onClose) onClose();

    const searchStr = name || email;
    if (resId) {
      navigate(
        `/admin/tenants?reservationId=${resId}${
          searchStr ? `&search=${encodeURIComponent(searchStr)}` : ""
        }`,
      );
    } else if (searchStr) {
      navigate(`/admin/tenants?search=${encodeURIComponent(searchStr)}`);
    } else {
      navigate(`/admin/tenants`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (onSave) await onSave(draftRoom);
      onClose();
    } catch (err) {
      console.error("Failed to save room config:", err);
    } finally {
      setSaving(false);
    }
  };

  /** Detect occupancy drift: counter > 0 but every bed is available */
  const hasDrift =
    !isPrivate &&
    (draftRoom.currentOccupancy || 0) > 0 &&
    (draftRoom.beds || []).every((b) => getBedStatus(b) === "available");

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

  return createPortal(
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — direct flex child, sticky at top */}
        <div className="admin-modal-header">
          <h2>Configure Room: {draftRoom.name}</h2>
          <div className="room-config-modal__header-actions">
            {onEdit && (
              <button
                type="button"
                className="room-config-modal__icon-btn"
                onClick={() => onEdit(draftRoom)}
                aria-label="Edit room"
                title="Edit room"
              >
                <Pencil size={16} />
              </button>
            )}
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

        {/* Body — direct flex child, no overflow — overlay scrolls */}
        <div className="admin-modal-body">

          {/* Room Information */}
          <div className="room-info-section">
            <h3>Room Information</h3>
            <div className="info-grid">
              <div>
                <strong>Type</strong>
                {formatRoomType(draftRoom.type)}
              </div>
              <div>
                <strong>Capacity</strong>
                {draftRoom.capacity} pax
              </div>
              <div>
                <strong>Floor</strong>
                Floor {draftRoom.floor}
              </div>
              <div>
                <strong>Branch</strong>
                {formatBranch(draftRoom.branch)}
              </div>
              <div>
                <strong>Base Price</strong>
                ₱{Number(draftRoom.price || 0).toLocaleString()}
              </div>
              <div>
                <strong>Monthly Price</strong>
                ₱{Number(draftRoom.monthlyPrice || 0).toLocaleString()}
              </div>
            </div>
            {draftRoom.description && (
              <div className="info-description mt-3">
                <strong>Description</strong>
                <p className="text-sm text-muted-foreground mt-1">
                  {draftRoom.description}
                </p>
              </div>
            )}
          </div>

          {/* Room Images */}
          <div className="bed-config-section">
            <h3>Room Images</h3>
            {draftRoom.images?.length ? (
              <div className="room-images-grid">
                {draftRoom.images.map((image, index) => (
                  <img
                    key={`${image}-${index}`}
                    src={image}
                    alt={`${draftRoom.name} ${index + 1}`}
                    className="room-image-thumb"
                  />
                ))}
              </div>
            ) : (
              <p className="no-beds no-beds--with-icon">
                <ImageIcon size={16} />
                No room images saved yet. Use Edit Room to upload photos.
              </p>
            )}
          </div>

          {/* Bed Configuration */}
          {!isPrivate && (
            <div className="bed-config-section">
              <div className="bed-config-section__header">
                <div>
                  <h3>Bed Configuration ({currentBedsCount}/{maxBeds})</h3>
                  {isMaxBedsReached && (
                    <p
                      className="text-xs font-medium mt-0.5"
                      style={{ color: "var(--status-warning-text, #d97706)", fontSize: "0.8rem", marginTop: "2px" }}
                    >
                      Maximum {maxBeds} beds reached for {formatRoomType(roomType)} room.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
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
                        className="bed-item"
                      >
                        <div className="bed-info">
                          <span className="text-xs font-semibold text-muted-foreground mr-1">
                            {getBedDisplayLabel(bed, index)}
                          </span>
                          <input
                            className="bed-id"
                            value={bed.id || ""}
                            onChange={(event) =>
                              handleBedFieldChange(bed.id, "id", event.target.value)
                            }
                            disabled={isLocked}
                          />
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
                          {isOccupiedOrReserved ? (
                            <button
                              type="button"
                              className={`bed-occupant-badge bed-occupant-badge--${normStatus === "reserved" ? "reserved" : "occupied"}`}
                              onClick={() => handleNavigateToOccupant(bed)}
                              title={`Navigate to ${occupantName || "occupant"}'s tenancy details`}
                            >
                              <User size={13} className="bed-occupant-icon" />
                              <span className="bed-occupant-name">
                                {occupantName || (normStatus === "reserved" ? "Reserved" : "Occupied")}
                              </span>
                              <ExternalLink size={12} className="bed-occupant-link-icon" />
                            </button>
                          ) : (
                            <span className={`status-badge status-badge--${normStatus}`}>
                              {rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)}
                            </span>
                          )}
                        </div>

                        <div className="bed-action-menu">
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
                  <p className="no-beds">
                    No beds have been configured for this room.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Occupancy */}
          <div className="occupancy-info">
            <h3>Current Occupancy</h3>
            <div className="occupancy-bar">
              <div
                className="occupancy-fill"
                style={{
                  width: `${
                    Math.min(
                      100,
                      Math.round(
                        ((isPrivate
                          ? Math.min(1, draftRoom.currentOccupancy || 0)
                          : draftRoom.currentOccupancy || 0) /
                          (isPrivate ? 1 : draftRoom.capacity || 1)) *
                          100,
                      ),
                    )
                  }%`,
                }}
              />
            </div>
            <p className="occupancy-label">
              {isPrivate
                ? `${Math.min(1, draftRoom.currentOccupancy || 0)} of 1 room currently occupied`
                : `${draftRoom.currentOccupancy || 0} of ${draftRoom.capacity || 1} beds currently occupied`}
            </p>

            {/* Drift repair: only shown when counter > 0 but all beds are available */}
            {hasDrift && (
              <div className="occupancy-drift-alert">
                <ShieldAlert size={14} />
                <span>
                  Counter mismatch detected &mdash; no active reservations but
                  occupancy shows {draftRoom.currentOccupancy}.
                </span>
                <button
                  type="button"
                  className="btn-repair-occupancy"
                  onClick={handleRepairOccupancy}
                  disabled={repairing}
                >
                  {repairing ? "Repairing…" : "Repair Occupancy"}
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

        {/* Footer — direct flex child of admin-modal-content, sticky at bottom */}
        <div className="admin-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}