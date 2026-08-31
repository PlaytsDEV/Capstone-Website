import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Plus, Check, AlertCircle } from "lucide-react";
import BaseModal from "../../../shared/components/BaseModal";
import { showNotification } from "../../../shared/utils/notification";

const CATEGORY_OPTIONS = [
  { value: "cooling", label: "Cooling & Air" },
  { value: "cooking", label: "Cooking & Kitchen" },
  { value: "electronics", label: "Electronics & Computing" },
  { value: "personal_care", label: "Personal Care" },
  { value: "general", label: "General Appliance" },
];

const NAME_MAX_LEN = 50;
const DESC_MAX_LEN = 150;
const FEE_MAX = 5000;
const MAX_QTY_LIMIT = 10;

// Requires at least one letter; allows letters, digits, spaces, hyphens, parentheses, and slashes
const NAME_REGEX = /^(?=.*[a-zA-Z])[a-zA-Z0-9\s\-()\/]+$/;

export default function ApplianceFormModal({
  isOpen,
  onClose,
  initialData = null,
  existingAppliances = [],
  onSubmit,
  isSubmitting = false,
}) {
  const isEdit = Boolean(initialData?._id);

  const [formData, setFormData] = useState({
    name: "",
    monthlyFee: 200,
    category: "general",
    maxQuantity: 5,
    description: "",
    isActive: true,
  });

  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        monthlyFee: initialData.monthlyFee ?? 200,
        category: initialData.category || "general",
        maxQuantity: initialData.maxQuantity ?? 5,
        description: initialData.description || "",
        isActive: initialData.isActive !== false,
      });
    } else {
      setFormData({
        name: "",
        monthlyFee: 200,
        category: "general",
        maxQuantity: 5,
        description: "",
        isActive: true,
      });
    }
    setTouched({});
    setErrors({});
  }, [initialData, isOpen]);

  const validate = (field, value) => {
    let err = null;
    const strVal = String(value || "").trim();

    if (field === "name") {
      if (!strVal) {
        err = "Appliance name is required.";
      } else if (strVal.length < 3) {
        err = "Appliance name must be at least 3 characters.";
      } else if (strVal.length > NAME_MAX_LEN) {
        err = `Appliance name cannot exceed ${NAME_MAX_LEN} characters.`;
      } else if (!NAME_REGEX.test(strVal)) {
        err = "Name must contain letters (e.g. 'Mini Fridge', 'Desk Fan') and only standard punctuation.";
      } else {
        // Duplicate name detection (case-insensitive)
        const isDuplicate = existingAppliances.some((a) => {
          const currentId = initialData?._id || initialData?.id;
          const targetId = a._id || a.id;
          if (currentId && String(currentId) === String(targetId)) return false;
          return String(a.name || "").trim().toLowerCase() === strVal.toLowerCase();
        });
        if (isDuplicate) {
          err = "An appliance with this name already exists in the catalog.";
        }
      }
    } else if (field === "monthlyFee") {
      const feeNum = Number(value);
      if (value === "" || Number.isNaN(feeNum)) {
        err = "Monthly fee is required.";
      } else if (feeNum < 0) {
        err = "Monthly fee cannot be negative.";
      } else if (feeNum > FEE_MAX) {
        err = `Monthly fee cannot exceed ₱${FEE_MAX.toLocaleString("en-PH")}.`;
      } else if (!Number.isInteger(feeNum) || feeNum % 10 !== 0) {
        err = "Monthly fee must be a whole number in increments of ₱10 (e.g. 50, 100, 250).";
      }
    } else if (field === "maxQuantity") {
      const qtyNum = Number(value);
      if (value === "" || !Number.isInteger(qtyNum) || qtyNum < 1) {
        err = "Max quantity must be at least 1 unit.";
      } else if (qtyNum > MAX_QTY_LIMIT) {
        err = `Max quantity cannot exceed ${MAX_QTY_LIMIT} units per tenant.`;
      }
    } else if (field === "description") {
      if (strVal.length > DESC_MAX_LEN) {
        err = `Description cannot exceed ${DESC_MAX_LEN} characters.`;
      }
    }
    return err;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validate(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const err = validate(field, value);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  const hasErrors = useMemo(() => {
    return Object.values(errors).some((e) => Boolean(e));
  }, [errors]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nameErr = validate("name", formData.name);
    const feeErr = validate("monthlyFee", formData.monthlyFee);
    const qtyErr = validate("maxQuantity", formData.maxQuantity);
    const descErr = validate("description", formData.description);

    const newErrors = {
      name: nameErr,
      monthlyFee: feeErr,
      maxQuantity: qtyErr,
      description: descErr,
    };

    setErrors(newErrors);
    setTouched({
      name: true,
      monthlyFee: true,
      maxQuantity: true,
      description: true,
    });

    if (nameErr || feeErr || qtyErr || descErr) {
      showNotification("Please resolve all validation errors before submitting.", "warning");
      return;
    }

    try {
      await onSubmit({
        name: String(formData.name).trim(),
        monthlyFee: Number(formData.monthlyFee),
        category: formData.category,
        maxQuantity: Number(formData.maxQuantity),
        description: String(formData.description || "").trim(),
        isActive: formData.isActive,
      });
      onClose();
    } catch (err) {
      // Handled by parent error notification
    }
  };

  const nameCharCount = String(formData.name || "").length;
  const descCharCount = String(formData.description || "").length;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Appliance Profile" : "Add New Appliance"}
      subtitle={
        isEdit
          ? "Update appliance pricing, category, and tenant limits."
          : "Define a new appliance and monthly surcharge rate for tenant declaration."
      }
      size="md"
      footer={null}
      cancelText={null}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Appliance Name */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Appliance Name <span className="text-rose-500">*</span>
            </label>
            <span
              className={`text-[11px] font-mono ${
                nameCharCount > NAME_MAX_LEN
                  ? "text-rose-500 font-bold"
                  : nameCharCount >= NAME_MAX_LEN * 0.8
                  ? "text-amber-500 font-medium"
                  : "text-slate-400"
              }`}
            >
              {nameCharCount}/{NAME_MAX_LEN}
            </span>
          </div>
          <input
            type="text"
            placeholder="e.g. Mini Refrigerator, Air Fryer, Hair Dryer"
            maxLength={NAME_MAX_LEN + 10}
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            onBlur={() => handleBlur("name")}
            className={`w-full h-10 px-3 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-colors focus:outline-none focus:ring-2 ${
              errors.name && touched.name
                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                : "border-slate-300 dark:border-slate-700 focus:border-primary focus:ring-primary/20"
            }`}
            disabled={isSubmitting}
            autoFocus
          />
          {errors.name && touched.name && (
            <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1">
              <AlertCircle size={12} className="shrink-0" />
              <span>{errors.name}</span>
            </p>
          )}
        </div>

        {/* Category & Max Quantity Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleChange("category", e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              disabled={isSubmitting}
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Max Units / Tenant <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">1–{MAX_QTY_LIMIT}</span>
            </div>
            <input
              type="number"
              min="1"
              max={MAX_QTY_LIMIT}
              step="1"
              value={formData.maxQuantity}
              onChange={(e) => handleChange("maxQuantity", e.target.value)}
              onBlur={() => handleBlur("maxQuantity")}
              className={`w-full h-10 px-3 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                errors.maxQuantity && touched.maxQuantity
                  ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                  : "border-slate-300 dark:border-slate-700 focus:border-primary focus:ring-primary/20"
              }`}
              disabled={isSubmitting}
            />
            {errors.maxQuantity && touched.maxQuantity && (
              <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1">
                <AlertCircle size={12} className="shrink-0" />
                <span>{errors.maxQuantity}</span>
              </p>
            )}
          </div>
        </div>

        {/* Monthly Surcharge */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Monthly Surcharge Rate (₱ / unit / mo) <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-slate-400 font-mono">Max ₱{FEE_MAX.toLocaleString()}</span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
              ₱
            </span>
            <input
              type="number"
              min="0"
              max={FEE_MAX}
              step="10"
              placeholder="200"
              value={formData.monthlyFee}
              onChange={(e) => handleChange("monthlyFee", e.target.value)}
              onBlur={() => handleBlur("monthlyFee")}
              className={`w-full h-10 pl-8 pr-16 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                errors.monthlyFee && touched.monthlyFee
                  ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                  : "border-slate-300 dark:border-slate-700 focus:border-primary focus:ring-primary/20"
              }`}
              disabled={isSubmitting}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
              / mo
            </span>
          </div>
          {errors.monthlyFee && touched.monthlyFee ? (
            <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1">
              <AlertCircle size={12} className="shrink-0" />
              <span>{errors.monthlyFee}</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Enter ₱0 if allowed without extra fees. Billed monthly per registered unit.
            </p>
          )}
        </div>

        {/* Description / Notes */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Description & Usage Guidelines (Optional)
            </label>
            <span
              className={`text-[11px] font-mono ${
                descCharCount > DESC_MAX_LEN
                  ? "text-rose-500 font-bold"
                  : descCharCount >= DESC_MAX_LEN * 0.8
                  ? "text-amber-500 font-medium"
                  : "text-slate-400"
              }`}
            >
              {descCharCount}/{DESC_MAX_LEN}
            </span>
          </div>
          <textarea
            rows={2}
            placeholder="e.g. Must not exceed 150 Watts. For personal use inside dorm rooms."
            maxLength={DESC_MAX_LEN + 10}
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            onBlur={() => handleBlur("description")}
            className={`w-full p-2.5 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 resize-none ${
              errors.description && touched.description
                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                : "border-slate-300 dark:border-slate-700 focus:border-primary focus:ring-primary/20"
            }`}
            disabled={isSubmitting}
          />
          {errors.description && touched.description && (
            <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
              <AlertCircle size={12} className="shrink-0" />
              <span>{errors.description}</span>
            </p>
          )}
        </div>

        {/* Active Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
              Active in Tenant Catalog
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              When disabled, prospective tenants cannot select this appliance during room booking.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={formData.isActive}
            onClick={() => handleChange("isActive", !formData.isActive)}
            disabled={isSubmitting}
            className={`w-10 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
              formData.isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                formData.isActive ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || hasErrors}
            className={`px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-2xs ${
              hasErrors ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                {isEdit ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isEdit ? "Save Changes" : "Create Appliance"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
