import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Building2, Hash, GitBranch, LayoutGrid, ImagePlus, Layers, Users, DollarSign, FileText, Sparkles, LoaderCircle, Trash2, X } from "lucide-react";
import { BRANCH_OPTIONS } from "../../../../shared/utils/constants";
import { uploadRoomPhotoIfFile } from "../../../../shared/utils/firebaseStorageUpload";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import { useAuth } from "../../../../shared/hooks/useAuth";

/**
 * Generate default beds based on room type and capacity.
 * - private → 1 bunk (upper + lower) for 1 tenant
 * - double-sharing → 1 upper + 1 lower per bunk
 * - quadruple-sharing → 2 upper + 2 lower per bunk pair
 */
function generateBeds(type, capacity) {
  const beds = [];

  if (type === "private") {
    // Private = 1 tenant but 2 beds (1 bunk: upper + lower)
    beds.push({ id: "bed-1", position: "upper", status: "available" });
    beds.push({ id: "bed-2", position: "lower", status: "available" });
  } else {
    for (let i = 1; i <= capacity; i++) {
      const position = i % 2 === 1 ? "upper" : "lower";
      beds.push({ id: `bed-${i}`, position, status: "available" });
    }
  }

  return beds;
}

/** Locked capacity values per room type */
const CAPACITY_BY_TYPE = {
  private: 1,
  "double-sharing": 2,
  "quadruple-sharing": 4,
};

const ROOM_TYPE_META = {
  private: { label: "Private", description: "1 tenant · 1 bunk bed" },
  "double-sharing": { label: "Double Sharing", description: "2 tenants · 2 beds" },
  "quadruple-sharing": { label: "Quadruple Sharing", description: "4 tenants · 4 beds" },
};

const INITIAL_FORM = {
  name: "",
  roomNumber: "",
  branch: "gil-puyat",
  type: "private",
  floor: 1,
  capacity: 1,
  price: 0,
  monthlyPrice: 0,
  description: "",
  amenities: "",
  policies: "",
  images: [],
};

const makeImageId = () =>
  `room-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildImageState = (value) => ({
  id: makeImageId(),
  value,
  preview: typeof value === "string" ? value : URL.createObjectURL(value),
  name: typeof value === "string" ? "Uploaded image" : value.name,
});

export default function RoomFormModal({ room, onClose, onSave }) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const isEdit = Boolean(room);
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    branch: room?.branch || user?.branch || "gil-puyat",
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEscapeClose(true, onClose);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, []);

  useEffect(() => {
    if (room) {
      setForm({
        name: room.name || "",
        roomNumber: room.roomNumber || "",
        branch: room.branch || user?.branch || "gil-puyat",
        type: room.type || "private",
        floor: room.floor || 1,
        capacity: room.capacity || 1,
        price: room.price || 0,
        monthlyPrice: room.monthlyPrice || 0,
        description: room.description || "",
        amenities: (room.amenities || []).join(", "),
        policies: (room.policies || []).join(", "),
        images: (room.images || []).map(buildImageState),
      });
    } else if (user?.branch) {
      setForm((prev) => ({
        ...prev,
        branch: user.branch,
      }));
    }
  }, [room, user?.branch]);

  const handleChange = (field, value) => {
    if (field === "name") {
      // Room name: letters, hyphens, and spaces only
      const lettersOnly = value.replace(/[^a-zA-Z\s-]/g, "");
      setForm((prev) => ({ ...prev, name: lettersOnly }));
      if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
    } else if (field === "roomNumber") {
      // Room number: digits only (0-9)
      const digitsOnly = value.replace(/\D/g, "");
      setForm((prev) => ({ ...prev, roomNumber: digitsOnly }));
      if (errors.roomNumber) setErrors((prev) => ({ ...prev, roomNumber: null }));
    } else if (field === "type") {
      setForm((prev) => ({
        ...prev,
        type: value,
        capacity: CAPACITY_BY_TYPE[value] ?? 1,
      }));
      if (errors.type) setErrors((prev) => ({ ...prev, type: null }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    const lettersOnlyRegex = /^[a-zA-Z\s-]+$/;
    const digitsOnlyRegex = /^\d+$/;

    if (!form.name.trim()) {
      newErrors.name = "Room name is required";
    } else if (!lettersOnlyRegex.test(form.name.trim())) {
      newErrors.name = "Room name can only contain letters, spaces, and hyphens";
    } else if (form.name.trim().length > 50) {
      newErrors.name = "Room name cannot exceed 50 characters";
    }

    if (!form.roomNumber.trim()) {
      newErrors.roomNumber = "Room number is required";
    } else if (!digitsOnlyRegex.test(form.roomNumber.trim())) {
      newErrors.roomNumber = "Room number must contain numbers only (e.g. 101)";
    } else if (form.roomNumber.trim().length > 10) {
      newErrors.roomNumber = "Room number cannot exceed 10 digits";
    }

    if (!form.capacity || form.capacity < 1) newErrors.capacity = "Capacity must be at least 1";

    if (form.price === "" || Number(form.price) < 0) {
      newErrors.price = "Price must be 0 or more";
    } else if (Number(form.price) > 1000000) {
      newErrors.price = "Price cannot exceed ₱1,000,000";
    }

    if (form.floor === "" || Number(form.floor) < 1) {
      newErrors.floor = "Floor must be at least 1";
    } else if (Number(form.floor) > 100) {
      newErrors.floor = "Floor cannot exceed 100";
    }

    if (form.description && form.description.length > 500) {
      newErrors.description = "Description cannot exceed 500 characters";
    }
    if (form.amenities && form.amenities.length > 200) {
      newErrors.amenities = "Amenities cannot exceed 200 characters";
    }
    if (form.policies && form.policies.length > 200) {
      newErrors.policies = "Policies cannot exceed 200 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const storageRoomId = room?._id ? String(room._id) : `new-${Date.now()}`;
      const uploadedImages = await Promise.all(
        (form.images || []).map((entry) => uploadRoomPhotoIfFile(entry.value, storageRoomId)),
      );
      const payload = {
        name: form.name.trim(),
        roomNumber: form.roomNumber.trim(),
        branch: form.branch,
        type: form.type,
        floor: Number(form.floor),
        capacity: Number(form.capacity),
        price: Number(form.price),
        monthlyPrice: 0,
        description: form.description.trim(),
        amenities: form.amenities
          ? form.amenities.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        policies: form.policies
          ? form.policies.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        images: uploadedImages.filter(Boolean),
      };

      if (!isEdit) {
        payload.beds = generateBeds(payload.type, payload.capacity);
      }

      await onSave(payload, room?._id);
    } catch (err) {
      console.error("Failed to save room:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelection = (event) => {
    const selectedFiles = Array.from(event.target.files || []).filter(Boolean);
    if (selectedFiles.length === 0) return;

    setForm((prev) => ({
      ...prev,
      images: [...(prev.images || []), ...selectedFiles.map(buildImageState)],
    }));

    event.target.value = "";
  };

  const handleRemoveImage = (imageId) => {
    setForm((prev) => ({
      ...prev,
      images: (prev.images || []).filter((entry) => entry.id !== imageId),
    }));
  };

  return createPortal(
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-content room-form-wide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="admin-modal-header rfm-header">
          <div className="rfm-header__title-block">
            <div className="rfm-header__icon">
              <Building2 size={18} />
            </div>
            <div>
              <h2>{isEdit ? `Edit Room` : "Add New Room"}</h2>
              {isEdit && (
                <span className="rfm-header__subtitle">{room.name}</span>
              )}
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form
          id="room-form"
          onSubmit={handleSubmit}
          style={{ display: "contents" }}
        >
          <div className="admin-modal-body rfm-body">

            {/* ── Section: Identity ── */}
            <div className="rfm-section">
              <div className="rfm-section-label">
                <Hash size={13} />
                Room Identity
              </div>
              <div className="room-form-row">
                <div className={`room-form-group ${errors.name ? "has-error" : ""}`}>
                  <label htmlFor="rfm-name">Room Name <span className="rfm-required">*</span></label>
                  <input
                    id="rfm-name"
                    type="text"
                    spellCheck={false}
                    maxLength={50}
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="e.g. Deluxe Room"
                  />
                  {errors.name && (
                    <span className="field-error">{errors.name}</span>
                  )}
                </div>
                <div className={`room-form-group ${errors.roomNumber ? "has-error" : ""}`}>
                  <label htmlFor="rfm-number">Room Number <span className="rfm-required">*</span></label>
                  <input
                    id="rfm-number"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    spellCheck={false}
                    maxLength={10}
                    value={form.roomNumber}
                    onChange={(e) => handleChange("roomNumber", e.target.value)}
                    placeholder="e.g. 101"
                  />
                  {errors.roomNumber && (
                    <span className="field-error">{errors.roomNumber}</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section: Location & Type ── */}
            <div className="rfm-section">
              <div className="rfm-section-label">
                <GitBranch size={13} />
                Location &amp; Type
              </div>
              <div className="room-form-row">
                <div className="room-form-group">
                  <label htmlFor="rfm-branch">Branch <span className="rfm-required">*</span></label>
                  <select
                    id="rfm-branch"
                    value={form.branch}
                    onChange={(e) => handleChange("branch", e.target.value)}
                    disabled={!isOwner}
                    title={!isOwner ? "Branch admins can only create rooms for their assigned branch" : undefined}
                  >
                    {BRANCH_OPTIONS.map((branch) => (
                      <option key={branch.value} value={branch.value}>
                        {branch.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`room-form-group ${errors.floor ? "has-error" : ""}`}>
                  <label htmlFor="rfm-floor">Floor</label>
                  <input
                    id="rfm-floor"
                    type="number"
                    min="1"
                    max="100"
                    value={form.floor}
                    onChange={(e) => handleChange("floor", e.target.value)}
                  />
                  {errors.floor && (
                    <span className="field-error">{errors.floor}</span>
                  )}
                </div>
              </div>

              {/* Room Type selector — pill style */}
              <div className="room-form-group" style={{ marginTop: "4px" }}>
                <label>Room Type <span className="rfm-required">*</span></label>
                <div className="rfm-type-grid">
                  {Object.entries(ROOM_TYPE_META).map(([value, meta]) => (
                    <button
                      key={value}
                      type="button"
                      className={`rfm-type-card ${form.type === value ? "rfm-type-card--active" : ""}`}
                      onClick={() => handleChange("type", value)}
                    >
                      <LayoutGrid size={14} />
                      <span className="rfm-type-card__label">{meta.label}</span>
                      <span className="rfm-type-card__desc">{meta.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Locked capacity badge */}
              <div className="rfm-capacity-badge">
                <Users size={13} />
                <span>Capacity locked at <strong>{form.capacity}</strong> tenant{form.capacity !== 1 ? "s" : ""} for {ROOM_TYPE_META[form.type]?.label} rooms</span>
              </div>
            </div>

            {/* ── Section: Pricing ── */}
            <div className="rfm-section">
              <div className="rfm-section-label">
                <DollarSign size={13} />
                Pricing
              </div>
              <div className="room-form-row">
                <div className={`room-form-group ${errors.price ? "has-error" : ""}`}>
                  <label htmlFor="rfm-price">Base Price (₱) <span className="rfm-required">*</span></label>
                  <input
                    id="rfm-price"
                    type="number"
                    min="0"
                    max="1000000"
                    value={form.price}
                    onChange={(e) => handleChange("price", e.target.value)}
                  />
                  <span className="capacity-hint">
                    Undiscounted rate per tenant/month. Effective long-term monthly rates are automatically calculated using your Business Settings discount percentages.
                  </span>
                  {errors.price && (
                    <span className="field-error">{errors.price}</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section: Photos ── */}
            <div className="rfm-section">
              <div className="rfm-section-label">
                <ImagePlus size={13} />
                Room Photos
              </div>

              {form.images?.length > 0 ? (
                <div className="image-preview-grid">
                  {form.images.map((entry) => (
                    <article key={entry.id} className="image-preview-card">
                      <img
                        src={entry.preview}
                        alt={entry.name || "Room image"}
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
                  {/* Inline add more */}
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
              )}
            </div>

            {/* ── Section: Details ── */}
            <div className="rfm-section">
              <div className="rfm-section-label">
                <FileText size={13} />
                Additional Details
              </div>
              <div className={`room-form-group ${errors.description ? "has-error" : ""}`}>
                <label htmlFor="rfm-desc">Description</label>
                <textarea
                  id="rfm-desc"
                  rows={2}
                  maxLength={500}
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Brief description of this room..."
                />
                {errors.description && (
                  <span className="field-error">{errors.description}</span>
                )}
              </div>
              <div className="room-form-row" style={{ marginTop: "4px" }}>
                <div className={`room-form-group ${errors.amenities ? "has-error" : ""}`}>
                  <label htmlFor="rfm-amenities">Amenities</label>
                  <input
                    id="rfm-amenities"
                    type="text"
                    maxLength={200}
                    value={form.amenities}
                    onChange={(e) => handleChange("amenities", e.target.value)}
                    placeholder="WiFi, AC, Desk (comma-separated)"
                  />
                  {errors.amenities && (
                    <span className="field-error">{errors.amenities}</span>
                  )}
                </div>
                <div className={`room-form-group ${errors.policies ? "has-error" : ""}`}>
                  <label htmlFor="rfm-policies">Policies</label>
                  <input
                    id="rfm-policies"
                    type="text"
                    maxLength={200}
                    value={form.policies}
                    onChange={(e) => handleChange("policies", e.target.value)}
                    placeholder="No pets, Quiet hours (comma-separated)"
                  />
                  {errors.policies && (
                    <span className="field-error">{errors.policies}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Beds auto-generate notice — create mode only */}
            {!isEdit && (
              <div className="rfm-beds-notice">
                <Sparkles size={14} />
                <span>
                  Beds will be auto-generated based on room type and capacity.
                  You can adjust individual bed configuration after creation.
                </span>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="admin-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <LoaderCircle size={15} className="admin-announcements-spin" />
                  {isEdit ? "Saving..." : "Creating..."}
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Create Room"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}