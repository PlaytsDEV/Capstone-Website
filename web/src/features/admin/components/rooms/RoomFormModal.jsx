import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  MapPin,
  User,
  Users,
  LayoutGrid,
  ImagePlus,
  DollarSign,
  FileText,
  Sparkles,
  LoaderCircle,
  Trash2,
  X,
  Plus,
  Star,
  Check,
  ShieldAlert,
  Percent,
  Tag,
  ShieldCheck,
} from "lucide-react";
import { BRANCH_OPTIONS } from "../../../../shared/utils/constants";
import { uploadRoomPhotoIfFile } from "../../../../shared/utils/firebaseStorageUpload";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { useBusinessSettings } from "../../../../shared/hooks/queries/useSettings";

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
  private: { label: "Private", description: "1 tenant · 1 bunk bed", icon: User },
  "double-sharing": { label: "Double Sharing", description: "2 tenants · 2 beds", icon: Users },
  "quadruple-sharing": { label: "Quadruple Sharing", description: "4 tenants · 4 beds", icon: LayoutGrid },
};

const AMENITY_PRESETS = [
  "Air Conditioning",
  "WiFi",
  "Double Decker Bed",
  "Study Desk",
  "Cabinet / Wardrobe",
  "Water Heater",
  "Personal Locker",
  "Electric Fan",
  "Window View",
  "Balcony",
];

const POLICY_PRESETS = [
  "No Smoking",
  "No Pets",
  "Quiet Hours (10PM - 6AM)",
  "Visitors until 8PM",
  "Valid ID Required",
  "Clean As You Go (CLAYGO)",
];

const INITIAL_FORM = {
  name: "",
  roomNumber: "",
  branch: "gil-puyat",
  type: "private",
  floor: 1,
  capacity: 1,
  price: "",
  monthlyPrice: 0,
  description: "",
  amenities: [],
  policies: [],
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

const normalizeList = (val) => {
  if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
  if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};

export default function RoomFormModal({ room, onClose, onSave }) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const isEdit = Boolean(room);

  // Business settings for live discount pricing
  const { data: businessSettingsData } = useBusinessSettings();
  const settings = businessSettingsData?.data || businessSettingsData || {};

  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    branch: room?.branch || user?.branch || "gil-puyat",
  }));

  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // Custom tags input state
  const [customAmenity, setCustomAmenity] = useState("");
  const [customPolicy, setCustomPolicy] = useState("");

  // Lock body scroll on mount
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, []);

  // Initialize or populate form
  useEffect(() => {
    if (room) {
      const populated = {
        name: room.name || "",
        roomNumber: room.roomNumber || "",
        branch: room.branch || user?.branch || "gil-puyat",
        type: room.type || "private",
        floor: room.floor || 1,
        capacity: room.capacity || 1,
        price: room.price !== undefined && room.price !== null ? String(room.price) : "",
        monthlyPrice: room.monthlyPrice || 0,
        description: room.description || "",
        amenities: normalizeList(room.amenities),
        policies: normalizeList(room.policies),
        images: (room.images || []).map(buildImageState),
      };
      setForm(populated);
      setInitialSnapshot(JSON.stringify(populated));
    } else {
      const initial = {
        ...INITIAL_FORM,
        branch: user?.branch || "gil-puyat",
      };
      setForm(initial);
      setInitialSnapshot(JSON.stringify(initial));
    }
  }, [room, user?.branch]);

  // Check if form has unsaved modifications
  const isFormDirty = useCallback(() => {
    if (!initialSnapshot) return false;
    const currentComparable = {
      ...form,
      images: (form.images || []).map((img) => img.name || img.preview),
    };
    try {
      const initialParsed = JSON.parse(initialSnapshot);
      const initialComparable = {
        ...initialParsed,
        images: (initialParsed.images || []).map((img) => img.name || img.preview),
      };
      return JSON.stringify(currentComparable) !== JSON.stringify(initialComparable);
    } catch {
      return false;
    }
  }, [form, initialSnapshot]);

  // Intercept close requests
  const handleAttemptClose = useCallback(() => {
    if (isFormDirty()) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  }, [isFormDirty, onClose]);

  // Escape key handler
  useEscapeClose(true, () => {
    if (showConfirmClose) {
      setShowConfirmClose(false);
    } else {
      handleAttemptClose();
    }
  });

  // Calculate live long-term discount rates
  const pricingSummary = useMemo(() => {
    const basePrice = Number(form.price) || 0;
    if (basePrice <= 0) return null;

    const isDiscountEnabled = settings?.isDiscountEnabled !== false;
    let discountPercent = 0;

    if (form.type === "private") {
      discountPercent = settings?.privateDiscountPercent ?? 10;
    } else if (form.type === "double-sharing") {
      discountPercent = settings?.doubleDiscountPercent ?? 20;
    } else {
      discountPercent =
        settings?.quadrupleDiscountPercent ?? settings?.defaultLongTermDiscountPercent ?? 10;
    }

    const effectiveDiscount = isDiscountEnabled ? Number(discountPercent) || 0 : 0;
    const discountedPrice = effectiveDiscount > 0
      ? Math.round(basePrice * (1 - effectiveDiscount / 100))
      : basePrice;
    const monthlySavings = Math.max(0, basePrice - discountedPrice);
    const minMonths = settings?.longTermLeaseMinMonths || 6;

    return {
      basePrice,
      isDiscountEnabled: isDiscountEnabled && effectiveDiscount > 0,
      discountPercent: effectiveDiscount,
      discountedPrice,
      monthlySavings,
      minMonths,
    };
  }, [form.price, form.type, settings]);

  const handleChange = (field, value) => {
    if (field === "name") {
      // Room name: letters, numbers, spaces, hyphens, and parentheses
      const allowed = value.replace(/[^a-zA-Z0-9\s()\-]/g, "");
      setForm((prev) => ({ ...prev, name: allowed }));
      if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
    } else if (field === "roomNumber") {
      // Room number: alphanumeric and hyphens (e.g. 101, 101-A, PH-1)
      const allowed = value.replace(/[^a-zA-Z0-9\-]/g, "");
      setForm((prev) => ({ ...prev, roomNumber: allowed }));
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

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, form[field]);
  };

  const validateField = (field, value) => {
    let err = null;

    if (field === "name") {
      const trimmed = String(value || "").trim();
      if (!trimmed) {
        err = "Room name is required";
      } else if (trimmed.length > 50) {
        err = "Room name cannot exceed 50 characters";
      }
    }

    if (field === "roomNumber") {
      const trimmed = String(value || "").trim();
      if (!trimmed) {
        err = "Room number is required";
      } else if (trimmed.length > 10) {
        err = "Room number cannot exceed 10 characters";
      }
    }

    if (field === "price") {
      if (value === "" || value === null || value === undefined) {
        err = "Base price is required";
      } else if (Number(value) <= 0) {
        err = "Base price must be greater than ₱0";
      } else if (Number(value) > 1000000) {
        err = "Base price cannot exceed ₱1,000,000";
      }
    }

    if (field === "floor") {
      if (value === "" || Number(value) < 1) {
        err = "Floor must be at least 1";
      } else if (Number(value) > 100) {
        err = "Floor cannot exceed 100";
      }
    }

    setErrors((prev) => ({ ...prev, [field]: err }));
    return !err;
  };

  const validate = () => {
    const newErrors = {};

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      newErrors.name = "Room name is required";
    } else if (trimmedName.length > 50) {
      newErrors.name = "Room name cannot exceed 50 characters";
    }

    const trimmedNumber = form.roomNumber.trim();
    if (!trimmedNumber) {
      newErrors.roomNumber = "Room number is required";
    } else if (trimmedNumber.length > 10) {
      newErrors.roomNumber = "Room number cannot exceed 10 characters";
    }

    if (!form.capacity || form.capacity < 1) {
      newErrors.capacity = "Capacity must be at least 1";
    }

    if (form.price === "" || form.price === null || form.price === undefined) {
      newErrors.price = "Base price is required";
    } else if (Number(form.price) <= 0) {
      newErrors.price = "Base price must be greater than ₱0";
    } else if (Number(form.price) > 1000000) {
      newErrors.price = "Base price cannot exceed ₱1,000,000";
    }

    if (form.floor === "" || Number(form.floor) < 1) {
      newErrors.floor = "Floor must be at least 1";
    } else if (Number(form.floor) > 100) {
      newErrors.floor = "Floor cannot exceed 100";
    }

    if (form.description && form.description.length > 500) {
      newErrors.description = "Description cannot exceed 500 characters";
    }

    setErrors(newErrors);
    setTouched({
      name: true,
      roomNumber: true,
      price: true,
      floor: true,
    });
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
        amenities: form.amenities || [],
        policies: form.policies || [],
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

  // ── Amenities Tag Helpers ──
  const handleAddAmenity = (text) => {
    const clean = text.trim();
    if (!clean) return;
    if (form.amenities.includes(clean)) {
      setCustomAmenity("");
      return;
    }
    setForm((prev) => ({
      ...prev,
      amenities: [...prev.amenities, clean],
    }));
    setCustomAmenity("");
  };

  const handleToggleAmenityPreset = (preset) => {
    setForm((prev) => {
      const exists = prev.amenities.includes(preset);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((item) => item !== preset)
          : [...prev.amenities, preset],
      };
    });
  };

  const handleRemoveAmenity = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.filter((_, idx) => idx !== indexToRemove),
    }));
  };

  // ── Policies Tag Helpers ──
  const handleAddPolicy = (text) => {
    const clean = text.trim();
    if (!clean) return;
    if (form.policies.includes(clean)) {
      setCustomPolicy("");
      return;
    }
    setForm((prev) => ({
      ...prev,
      policies: [...prev.policies, clean],
    }));
    setCustomPolicy("");
  };

  const handleTogglePolicyPreset = (preset) => {
    setForm((prev) => {
      const exists = prev.policies.includes(preset);
      return {
        ...prev,
        policies: exists
          ? prev.policies.filter((item) => item !== preset)
          : [...prev.policies, preset],
      };
    });
  };

  const handleRemovePolicy = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      policies: prev.policies.filter((_, idx) => idx !== indexToRemove),
    }));
  };

  return createPortal(
    <>
      <div className="admin-modal-overlay" onClick={handleAttemptClose}>
        <div
          className="admin-modal-content room-form-wide"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="admin-modal-header rfm-header">
            <div className="rfm-header__title-block">
              <Building2 size={20} className="rfm-header__icon" />
              <div>
                <h2>{isEdit ? `Edit Room` : "Add New Room"}</h2>
                {isEdit && (
                  <span className="rfm-header__subtitle">{room.name}</span>
                )}
              </div>
            </div>
            <button
              className="modal-close-btn"
              onClick={handleAttemptClose}
              aria-label="Close modal"
              type="button"
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
                  <Building2 size={14} />
                  <span>Room Details</span>
                </div>
                <div className="room-form-row">
                  {/* Room Name */}
                  <div className={`room-form-group ${touched.name && errors.name ? "has-error" : ""}`}>
                    <div className="rfm-field-header">
                      <label htmlFor="rfm-name">
                        Room Name <span className="rfm-required">*</span>
                      </label>
                      <span className="rfm-char-counter">{form.name.length}/50</span>
                    </div>
                    <input
                      id="rfm-name"
                      type="text"
                      spellCheck={false}
                      maxLength={50}
                      autoFocus={!isEdit}
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      onBlur={() => handleBlur("name")}
                      placeholder="e.g. Deluxe Room"
                    />
                    {touched.name && errors.name && (
                      <span className="field-error">{errors.name}</span>
                    )}
                  </div>

                  {/* Room Number */}
                  <div className={`room-form-group ${touched.roomNumber && errors.roomNumber ? "has-error" : ""}`}>
                    <div className="rfm-field-header">
                      <label htmlFor="rfm-number">
                        Room Number <span className="rfm-required">*</span>
                      </label>
                      <span className="rfm-char-counter">{form.roomNumber.length}/10</span>
                    </div>
                    <input
                      id="rfm-number"
                      type="text"
                      spellCheck={false}
                      maxLength={10}
                      value={form.roomNumber}
                      onChange={(e) => handleChange("roomNumber", e.target.value)}
                      onBlur={() => handleBlur("roomNumber")}
                      placeholder="e.g. 101 or 101-A"
                    />
                    {touched.roomNumber && errors.roomNumber && (
                      <span className="field-error">{errors.roomNumber}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Section: Location & Type ── */}
              <div className="rfm-section">
                <div className="rfm-section-label">
                  <MapPin size={14} />
                  <span>Location &amp; Classification</span>
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
                  <div className={`room-form-group ${touched.floor && errors.floor ? "has-error" : ""}`}>
                    <label htmlFor="rfm-floor">Floor</label>
                    <input
                      id="rfm-floor"
                      type="number"
                      min="1"
                      max="100"
                      value={form.floor}
                      onChange={(e) => handleChange("floor", e.target.value)}
                      onBlur={() => handleBlur("floor")}
                    />
                    {touched.floor && errors.floor && (
                      <span className="field-error">{errors.floor}</span>
                    )}
                  </div>
                </div>

                {/* Room Type selector — pill style */}
                <div className="room-form-group" style={{ marginTop: "4px" }}>
                  <label>Room Type <span className="rfm-required">*</span></label>
                  <div className="rfm-type-grid">
                    {Object.entries(ROOM_TYPE_META).map(([value, meta]) => {
                      const TypeIcon = meta.icon || LayoutGrid;
                      return (
                        <button
                          key={value}
                          type="button"
                          className={`rfm-type-card ${form.type === value ? "rfm-type-card--active" : ""}`}
                          onClick={() => handleChange("type", value)}
                        >
                          <TypeIcon size={15} />
                          <span className="rfm-type-card__label">{meta.label}</span>
                          <span className="rfm-type-card__desc">{meta.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Locked capacity badge */}
                <div className="rfm-capacity-badge">
                  <Users size={13} />
                  <span>
                    Capacity locked at <strong>{form.capacity}</strong> tenant{form.capacity !== 1 ? "s" : ""} for {ROOM_TYPE_META[form.type]?.label} rooms
                  </span>
                </div>
              </div>

              {/* ── Section: Pricing ── */}
              <div className="rfm-section">
                <div className="rfm-section-label">
                  <DollarSign size={14} />
                  <span>Pricing &amp; Rent Billing</span>
                </div>
                <div className="room-form-row">
                  <div className={`room-form-group ${touched.price && errors.price ? "has-error" : ""}`}>
                    <label htmlFor="rfm-price">
                      Base Price (₱) <span className="rfm-required">*</span>
                    </label>
                    <div className="rfm-currency-input-wrap">
                      <span className="rfm-currency-prefix">₱</span>
                      <input
                        id="rfm-price"
                        type="number"
                        min="1"
                        max="1000000"
                        step="50"
                        placeholder="e.g. 5500"
                        value={form.price}
                        onChange={(e) => handleChange("price", e.target.value)}
                        onBlur={() => handleBlur("price")}
                        className="rfm-currency-input"
                      />
                    </div>
                    {touched.price && errors.price && (
                      <span className="field-error">{errors.price}</span>
                    )}
                  </div>
                </div>

                {/* Live Calculated Pricing Preview */}
                {pricingSummary && (
                  <div className="rfm-pricing-preview">
                    <div className="rfm-pricing-preview__header">
                      <Percent size={14} />
                      <span>Live Lease Rent Calculation Preview</span>
                    </div>
                    <div className="rfm-pricing-preview__grid">
                      <div className="rfm-pricing-preview__card">
                        <span className="rfm-pricing-preview__label">Short-Term (Monthly)</span>
                        <span className="rfm-pricing-preview__value">
                          ₱{pricingSummary.basePrice.toLocaleString("en-PH")}/mo
                        </span>
                        <span className="rfm-pricing-preview__sub">Undiscounted base rate</span>
                      </div>
                      {pricingSummary.isDiscountEnabled ? (
                        <div className="rfm-pricing-preview__card rfm-pricing-preview__card--highlight">
                          <span className="rfm-pricing-preview__label">
                            Long-Term ({pricingSummary.minMonths}+ mos)
                          </span>
                          <span className="rfm-pricing-preview__value rfm-pricing-preview__value--green">
                            ₱{pricingSummary.discountedPrice.toLocaleString("en-PH")}/mo
                          </span>
                          <span className="rfm-pricing-preview__sub">
                            {pricingSummary.discountPercent}% discount · Save ₱{pricingSummary.monthlySavings.toLocaleString("en-PH")}/mo
                          </span>
                        </div>
                      ) : (
                        <div className="rfm-pricing-preview__card">
                          <span className="rfm-pricing-preview__label">Long-Term Rent</span>
                          <span className="rfm-pricing-preview__value">
                            ₱{pricingSummary.basePrice.toLocaleString("en-PH")}/mo
                          </span>
                          <span className="rfm-pricing-preview__sub">No discount active</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Section: Photos ── */}
              <div className="rfm-section">
                <div className="rfm-section-label">
                  <ImagePlus size={14} />
                  <span>Room Photos</span>
                </div>

                {form.images?.length > 0 ? (
                  <div className="image-preview-grid">
                    {form.images.map((entry, index) => (
                      <article key={entry.id} className="image-preview-card">
                        {index === 0 && (
                          <span className="rfm-cover-photo-badge">
                            <Star size={10} />
                            Cover Photo
                          </span>
                        )}
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

              {/* ── Section: Amenities Tag System ── */}
              <div className="rfm-section">
                <div className="rfm-section-label">
                  <Tag size={14} />
                  <span>Room Amenities</span>
                </div>

                {/* Selected Amenities Chips */}
                <div className="amenities-tag-container">
                  {form.amenities.length > 0 ? (
                    form.amenities.map((amenity, idx) => (
                      <span key={`${amenity}-${idx}`} className="amenity-chip">
                        {amenity}
                        <button
                          type="button"
                          className="amenity-chip__remove"
                          onClick={() => handleRemoveAmenity(idx)}
                          aria-label={`Remove ${amenity}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="amenities-empty-hint">
                      No amenities added yet. Click presets below or type to add.
                    </span>
                  )}
                </div>

                {/* Custom Amenity Input */}
                <div className="amenity-input-row">
                  <input
                    type="text"
                    maxLength={50}
                    value={customAmenity}
                    onChange={(e) => setCustomAmenity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddAmenity(customAmenity);
                      }
                    }}
                    placeholder="Add custom amenity (e.g. Personal Refrigerator)..."
                    className="amenity-custom-input"
                  />
                  <button
                    type="button"
                    className="btn-add-amenity"
                    onClick={() => handleAddAmenity(customAmenity)}
                    disabled={!customAmenity.trim()}
                    title={!customAmenity.trim() ? "Type an amenity name first" : "Add amenity"}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="amenities-presets-block">
                  <span className="amenities-presets-label">Popular Amenities</span>
                  <div className="amenities-presets-list">
                    {AMENITY_PRESETS.map((preset) => {
                      const isSelected = form.amenities.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          className={`amenity-preset-btn ${isSelected ? "amenity-preset-btn--selected" : ""}`}
                          onClick={() => handleToggleAmenityPreset(preset)}
                        >
                          {isSelected ? <Check size={11} /> : <Plus size={11} />}
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Section: Policies Tag System ── */}
              <div className="rfm-section">
                <div className="rfm-section-label">
                  <ShieldCheck size={14} />
                  <span>Policies &amp; House Rules</span>
                </div>

                {/* Selected Policies Chips */}
                <div className="amenities-tag-container">
                  {form.policies.length > 0 ? (
                    form.policies.map((policy, idx) => (
                      <span key={`${policy}-${idx}`} className="amenity-chip">
                        {policy}
                        <button
                          type="button"
                          className="amenity-chip__remove"
                          onClick={() => handleRemovePolicy(idx)}
                          aria-label={`Remove ${policy}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="amenities-empty-hint">
                      No policies specified. Click presets below or type to add.
                    </span>
                  )}
                </div>

                {/* Custom Policy Input */}
                <div className="amenity-input-row">
                  <input
                    type="text"
                    maxLength={60}
                    value={customPolicy}
                    onChange={(e) => setCustomPolicy(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddPolicy(customPolicy);
                      }
                    }}
                    placeholder="Add custom policy (e.g. No Cooking in Room)..."
                    className="amenity-custom-input"
                  />
                  <button
                    type="button"
                    className="btn-add-amenity"
                    onClick={() => handleAddPolicy(customPolicy)}
                    disabled={!customPolicy.trim()}
                    title={!customPolicy.trim() ? "Type a policy name first" : "Add policy"}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>

                {/* Quick Policy Presets */}
                <div className="amenities-presets-block">
                  <span className="amenities-presets-label">Common House Rules</span>
                  <div className="amenities-presets-list">
                    {POLICY_PRESETS.map((preset) => {
                      const isSelected = form.policies.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          className={`amenity-preset-btn ${isSelected ? "amenity-preset-btn--selected" : ""}`}
                          onClick={() => handleTogglePolicyPreset(preset)}
                        >
                          {isSelected ? <Check size={11} /> : <Plus size={11} />}
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Section: Description ── */}
              <div className="rfm-section">
                <div className="rfm-section-label">
                  <FileText size={14} />
                  <span>Room Description</span>
                </div>
                <div className={`room-form-group ${errors.description ? "has-error" : ""}`}>
                  <div className="rfm-field-header">
                    <label htmlFor="rfm-desc">Description</label>
                    <span className="rfm-char-counter">{form.description.length}/500</span>
                  </div>
                  <textarea
                    id="rfm-desc"
                    rows={2}
                    maxLength={500}
                    value={form.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="Brief description of this room for applicants..."
                  />
                  {errors.description && (
                    <span className="field-error">{errors.description}</span>
                  )}
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
              <button
                type="button"
                className="btn-secondary"
                onClick={handleAttemptClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
                title={
                  saving
                    ? "Saving room details..."
                    : !form.name.trim() || !form.roomNumber.trim() || !form.price
                    ? "Please complete all required fields (Room Name, Room Number, Base Price)"
                    : undefined
                }
              >
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
      </div>

      {/* ── Unsaved Changes Confirmation Modal ── */}
      {showConfirmClose && (
        <div className="confirm-discard-overlay" onClick={() => setShowConfirmClose(false)}>
          <div className="confirm-discard-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <ShieldAlert size={20} color="#dc2626" />
              <h3 style={{ margin: 0 }}>Discard Unsaved Changes?</h3>
            </div>
            <p>
              You have unsaved modifications for this room. If you close now, all your typed details and uploaded photos will be discarded.
            </p>
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
                className="btn-danger"
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setShowConfirmClose(false);
                  onClose();
                }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}