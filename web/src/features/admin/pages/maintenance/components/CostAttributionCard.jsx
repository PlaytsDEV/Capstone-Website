import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Coins,
  FileText,
  Loader2,
  Pencil,
  Receipt,
  Save,
  UserX,
} from "lucide-react";
import { showNotification } from "../../../../../shared/utils/notification";
import { useUpdateMaintenanceCost } from "../../../../../shared/hooks/queries/useMaintenance";
import {
  getMaintenanceApiErrorMessage,
  MAX_MAINTENANCE_ITEM_COST,
  sanitizeAmountInput,
} from "../maintenanceUtils";

export const CostAttributionCard = forwardRef(function CostAttributionCard(
  {
    request,
    disabled = false,
    hideStandaloneAction = false,
    defaultSummaryMode = false,
  },
  ref,
) {
  const updateCostMutation = useUpdateMaintenanceCost();

  const [isEditing, setIsEditing] = useState(!defaultSummaryMode);

  const [laborCost, setLaborCost] = useState(
    request?.costBreakdown?.laborCost !== undefined &&
      request?.costBreakdown?.laborCost !== null
      ? String(request.costBreakdown.laborCost)
      : "0",
  );
  const [materialsCost, setMaterialsCost] = useState(
    request?.costBreakdown?.materialsCost !== undefined &&
      request?.costBreakdown?.materialsCost !== null
      ? String(request.costBreakdown.materialsCost)
      : "0",
  );
  const [isTenantChargeable, setIsTenantChargeable] = useState(
    Boolean(request?.costBreakdown?.isTenantChargeable),
  );
  const [chargeReason, setChargeReason] = useState(
    request?.costBreakdown?.chargeReason || "",
  );
  const [touched, setTouched] = useState({
    labor: false,
    materials: false,
    reason: false,
  });

  useEffect(() => {
    if (request) {
      setLaborCost(
        request?.costBreakdown?.laborCost !== undefined &&
          request?.costBreakdown?.laborCost !== null
          ? String(request.costBreakdown.laborCost)
          : "0",
      );
      setMaterialsCost(
        request?.costBreakdown?.materialsCost !== undefined &&
          request?.costBreakdown?.materialsCost !== null
          ? String(request.costBreakdown.materialsCost)
          : "0",
      );
      setIsTenantChargeable(Boolean(request?.costBreakdown?.isTenantChargeable));
      setChargeReason(request?.costBreakdown?.chargeReason || "");
      setTouched({ labor: false, materials: false, reason: false });
    }
  }, [request]);

  useEffect(() => {
    if (defaultSummaryMode) {
      setIsEditing(false);
    }
  }, [defaultSummaryMode, request?.request_id, request?._id]);

  const rawNumLabor = Number(laborCost);
  const rawNumMaterials = Number(materialsCost);

  const laborError = useMemo(() => {
    if (laborCost === undefined || laborCost === null || String(laborCost).trim() === "") {
      return "Labor cost is required (enter 0 if no cost).";
    }
    const val = Number(laborCost);
    if (isNaN(val) || val < 0) {
      return "Labor cost cannot be negative.";
    }
    if (val > MAX_MAINTENANCE_ITEM_COST) {
      return `Labor cost cannot exceed ₱${MAX_MAINTENANCE_ITEM_COST.toLocaleString("en-PH")}.`;
    }
    return null;
  }, [laborCost]);

  const materialsError = useMemo(() => {
    if (materialsCost === undefined || materialsCost === null || String(materialsCost).trim() === "") {
      return "Materials cost is required (enter 0 if no cost).";
    }
    const val = Number(materialsCost);
    if (isNaN(val) || val < 0) {
      return "Materials cost cannot be negative.";
    }
    if (val > MAX_MAINTENANCE_ITEM_COST) {
      return `Materials cost cannot exceed ₱${MAX_MAINTENANCE_ITEM_COST.toLocaleString("en-PH")}.`;
    }
    return null;
  }, [materialsCost]);

  const reasonError = useMemo(() => {
    if (!isTenantChargeable) return null;
    const trimmed = chargeReason.trim();
    if (!trimmed)
      return "Please state the reason for charging this repair to the tenant.";
    if (trimmed.length < 5) return "Reason must be at least 5 characters long.";
    if (trimmed.length > 250) return "Reason cannot exceed 250 characters.";
    return null;
  }, [isTenantChargeable, chargeReason]);

  const hasValidationErrors = Boolean(
    laborError || materialsError || reasonError,
  );

  const numLabor = Math.min(
    MAX_MAINTENANCE_ITEM_COST,
    Math.max(0, isNaN(rawNumLabor) ? 0 : rawNumLabor),
  );
  const numMaterials = Math.min(
    MAX_MAINTENANCE_ITEM_COST,
    Math.max(0, isNaN(rawNumMaterials) ? 0 : rawNumMaterials),
  );
  const totalCost = numLabor + numMaterials;

  const hasChanges =
    numLabor !== Number(request?.costBreakdown?.laborCost || 0) ||
    numMaterials !== Number(request?.costBreakdown?.materialsCost || 0) ||
    isTenantChargeable !==
      Boolean(request?.costBreakdown?.isTenantChargeable) ||
    chargeReason.trim() !==
      String(request?.costBreakdown?.chargeReason || "").trim();

  const handleCancelEdit = () => {
    if (request) {
      setLaborCost(
        request?.costBreakdown?.laborCost !== undefined &&
          request?.costBreakdown?.laborCost !== null
          ? String(request.costBreakdown.laborCost)
          : "0",
      );
      setMaterialsCost(
        request?.costBreakdown?.materialsCost !== undefined &&
          request?.costBreakdown?.materialsCost !== null
          ? String(request.costBreakdown.materialsCost)
          : "0",
      );
      setIsTenantChargeable(Boolean(request?.costBreakdown?.isTenantChargeable));
      setChargeReason(request?.costBreakdown?.chargeReason || "");
      setTouched({ labor: false, materials: false, reason: false });
    }
    setIsEditing(false);
  };

  const handleSaveCost = async () => {
    setTouched({ labor: true, materials: true, reason: true });

    if (disabled) {
      showNotification({
        title: "Ticket Locked",
        message: "This maintenance request is locked and its expense records cannot be edited.",
        type: "warning",
      });
      return false;
    }

    if (!hasChanges) {
      showNotification({
        title: "No Changes Detected",
        message: "To record expenses, enter or update the Labor Cost, Materials Cost, or Tenant Misuse attribution first.",
        type: "info",
      });
      if (defaultSummaryMode) {
        setIsEditing(false);
      }
      return true;
    }

    if (laborError) {
      showNotification({
        title: "Invalid Labor Cost",
        message: laborError,
        type: "error",
      });
      return false;
    }
    if (materialsError) {
      showNotification({
        title: "Invalid Materials Cost",
        message: materialsError,
        type: "error",
      });
      return false;
    }
    if (reasonError) {
      showNotification({
        title: "Reason Required",
        message: reasonError,
        type: "warning",
      });
      return false;
    }

    try {
      const reqId = request?.request_id || request?.id || request?._id;
      await updateCostMutation.mutateAsync({
        requestId: reqId,
        payload: {
          laborCost: numLabor,
          materialsCost: numMaterials,
          isTenantChargeable,
          chargeReason: isTenantChargeable
            ? chargeReason.trim().slice(0, 250)
            : null,
        },
      });

      showNotification({
        title: "Expenses Recorded",
        message: `Maintenance expense of PHP ${totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} recorded to system ${isTenantChargeable ? "as tenant damage charge" : "under Owner's company operational expenses"}.`,
        type: "success",
      });

      if (defaultSummaryMode) {
        setIsEditing(false);
      }
      return true;
    } catch (err) {
      showNotification({
        title: "Save Failed",
        message: getMaintenanceApiErrorMessage(
          err,
          "Failed to save cost details",
        ),
        type: "error",
      });
      return false;
    }
  };

  // Expose methods for unified multi-card submission in parent modal
  useImperativeHandle(ref, () => ({
    validate: () => {
      setTouched({ labor: true, materials: true, reason: true });
      if (laborError) {
        return { valid: false, message: laborError, field: "labor" };
      }
      if (materialsError) {
        return { valid: false, message: materialsError, field: "materials" };
      }
      if (reasonError) {
        return { valid: false, message: reasonError, field: "reason" };
      }
      return {
        valid: true,
        hasChanges,
        payload: {
          laborCost: numLabor,
          materialsCost: numMaterials,
          isTenantChargeable,
          chargeReason: isTenantChargeable
            ? chargeReason.trim().slice(0, 250)
            : null,
        },
      };
    },
    saveCost: async () => {
      setTouched({ labor: true, materials: true, reason: true });
      if (laborError) throw new Error(laborError);
      if (materialsError) throw new Error(materialsError);
      if (reasonError) throw new Error(reasonError);

      if (!hasChanges) {
        return { skipped: true };
      }

      const reqId = request?.request_id || request?.id || request?._id;
      return updateCostMutation.mutateAsync({
        requestId: reqId,
        payload: {
          laborCost: numLabor,
          materialsCost: numMaterials,
          isTenantChargeable,
          chargeReason: isTenantChargeable
            ? chargeReason.trim().slice(0, 250)
            : null,
        },
      });
    },
    getPayload: () => ({
      laborCost: numLabor,
      materialsCost: numMaterials,
      isTenantChargeable,
      chargeReason: isTenantChargeable
        ? chargeReason.trim().slice(0, 250)
        : null,
    }),
    hasChanges,
    hasValidationErrors,
    isPending: updateCostMutation.isPending,
  }));

  // Clean Read-Only Summary Mode
  if (!isEditing) {
    return (
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-slate-700 dark:text-slate-300" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Repair Expenses &amp; Cost Attribution
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-transparent px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hidden sm:inline-flex">
              Post-Service Accounting
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title="Edit repair costs and attribution policy"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 active:scale-[0.98] transition cursor-pointer shadow-2xs"
              >
                <Pencil size={12} className="text-slate-500" />
                <span>Edit Expenses</span>
              </button>
            )}
          </div>
        </div>

        {/* 3-Column Financial Metric Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch text-xs">
          <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
              Labor Cost
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
              ₱{numLabor.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
              Materials Cost
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
              ₱{numMaterials.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/80 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 block">
              Total Computed Expense
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
              ₱{totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Attribution Policy & Audit Summary Box */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                Expense Cost Attribution:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {isTenantChargeable
                  ? "Charge to Tenant (Tenant Misuse)"
                  : "Owner Company Operating Expense"}
              </span>
            </div>

            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              <CheckCircle2 size={12} className="text-emerald-600" />
              <span>Synced to Database</span>
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {isTenantChargeable
              ? "Tenant damage / negligence • Flagged for monthly billing statement."
              : "Dormitory absorbed • Standard wear & tear or facility maintenance."}
          </p>

          {isTenantChargeable && chargeReason && (
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                Reason for Tenant Charge:
              </span>
              <p className="text-xs text-slate-800 dark:text-slate-200 italic mt-0.5">
                "{chargeReason}"
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Interactive Editable Mode
  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-slate-700 dark:text-slate-300" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
            Repair Expenses &amp; Cost Attribution
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-transparent px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Post-Service Accounting
          </span>
          <span className="rounded bg-transparent px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Admin Only
          </span>
        </div>
      </div>

      {/* 3-Column Financial Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
        {/* Labor Cost */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Labor Cost <span className="text-rose-500 font-bold">*</span>
            </label>
            <span className="text-[10px] text-slate-400 font-medium">
              Max ₱500,000
            </span>
          </div>
          <div
            className={`relative flex items-center rounded-lg border bg-white dark:bg-slate-900 transition ${
              laborError && touched.labor
                ? "border-rose-500"
                : "border-slate-300 dark:border-slate-700 focus-within:border-slate-900 dark:focus-within:border-slate-100"
            }`}
          >
            <span className="pointer-events-none pl-3 text-xs font-bold text-slate-400 dark:text-slate-500">
              ₱
            </span>
            <input
              type="text"
              inputMode="decimal"
              maxLength={9}
              value={laborCost}
              onFocus={(e) => {
                if (laborCost === "0" || laborCost === "0.00") {
                  setLaborCost("");
                } else if (laborCost) {
                  e.target.select();
                }
              }}
              onBlur={() => setTouched((curr) => ({ ...curr, labor: true }))}
              onChange={(e) => {
                setTouched((curr) => ({ ...curr, labor: true }));
                setLaborCost(sanitizeAmountInput(e.target.value));
              }}
              disabled={disabled || updateCostMutation.isPending}
              placeholder="0"
              className="h-9 w-full rounded-lg bg-transparent pl-1.5 pr-3 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 font-mono"
            />
          </div>
          {laborError && touched.labor && (
            <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertCircle size={11} className="shrink-0" />
              <span>{laborError}</span>
            </p>
          )}
        </div>

        {/* Materials Cost */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Materials Cost <span className="text-rose-500 font-bold">*</span>
            </label>
            <span className="text-[10px] text-slate-400 font-medium">
              Max ₱500,000
            </span>
          </div>
          <div
            className={`relative flex items-center rounded-lg border bg-white dark:bg-slate-900 transition ${
              materialsError && touched.materials
                ? "border-rose-500"
                : "border-slate-300 dark:border-slate-700 focus-within:border-slate-900 dark:focus-within:border-slate-100"
            }`}
          >
            <span className="pointer-events-none pl-3 text-xs font-bold text-slate-400 dark:text-slate-500">
              ₱
            </span>
            <input
              type="text"
              inputMode="decimal"
              maxLength={9}
              value={materialsCost}
              onFocus={(e) => {
                if (materialsCost === "0" || materialsCost === "0.00") {
                  setMaterialsCost("");
                } else if (materialsCost) {
                  e.target.select();
                }
              }}
              onBlur={() =>
                setTouched((curr) => ({ ...curr, materials: true }))
              }
              onChange={(e) => {
                setTouched((curr) => ({ ...curr, materials: true }));
                setMaterialsCost(sanitizeAmountInput(e.target.value));
              }}
              disabled={disabled || updateCostMutation.isPending}
              placeholder="0"
              className="h-9 w-full rounded-lg bg-transparent pl-1.5 pr-3 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 font-mono"
            />
          </div>
          {materialsError && touched.materials && (
            <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertCircle size={11} className="shrink-0" />
              <span>{materialsError}</span>
            </p>
          )}
        </div>

        {/* Total Expense KPI Tile */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Total Computed Expense
          </label>
          <div className="flex h-9 items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 min-w-0">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Coins size={12} className="text-slate-400" />
              PHP
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono truncate text-right ml-1">
              ₱
              {totalCost.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Attribution Policy 2-Option Segmented Selector */}
      <div className="space-y-2 pt-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Expense Cost Attribution Policy *
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Option 1: Company Absorbed */}
          <button
            type="button"
            disabled={disabled || updateCostMutation.isPending}
            onClick={() => {
              setIsTenantChargeable(false);
              setTouched((curr) => ({ ...curr, reason: false }));
            }}
            className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition cursor-pointer active:scale-[0.98] ${
              !isTenantChargeable
                ? "border-[#0A1628] dark:border-slate-200 bg-slate-50/70 dark:bg-slate-800/60 shadow-2xs"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50"
            }`}
          >
            <div className="pt-0.5 shrink-0">
              <div
                className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border transition ${
                  !isTenantChargeable
                    ? "border-[#0A1628] dark:border-slate-100"
                    : "border-slate-300 dark:border-slate-600 bg-transparent"
                }`}
              >
                {!isTenantChargeable && (
                  <div className="h-2 w-2 rounded-full bg-[#0A1628] dark:bg-slate-100" />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Owner Company Operating Expense</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                Dormitory absorbed • Standard wear &amp; tear or facility maintenance.
              </p>
            </div>
          </button>

          {/* Option 2: Charge to Tenant */}
          <button
            type="button"
            disabled={disabled || updateCostMutation.isPending}
            onClick={() => {
              setIsTenantChargeable(true);
              setTouched((curr) => ({ ...curr, reason: false }));
            }}
            className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition cursor-pointer active:scale-[0.98] ${
              isTenantChargeable
                ? "border-[#0A1628] dark:border-slate-200 bg-slate-50/70 dark:bg-slate-800/60 shadow-2xs"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50"
            }`}
          >
            <div className="pt-0.5 shrink-0">
              <div
                className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border transition ${
                  isTenantChargeable
                    ? "border-[#0A1628] dark:border-slate-100"
                    : "border-slate-300 dark:border-slate-600 bg-transparent"
                }`}
              >
                {isTenantChargeable && (
                  <div className="h-2 w-2 rounded-full bg-[#0A1628] dark:bg-slate-100" />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between gap-2">
                <span>Charge to Tenant</span>
                <span className="text-[10px] font-bold uppercase rounded bg-transparent text-slate-700 dark:text-slate-300 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 shrink-0">
                  Tenant Misuse
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                Tenant damage / negligence • Flagged for monthly billing statement.
              </p>
            </div>
          </button>
        </div>

        {/* Tenant Damage Reason Container (Revealed when Charge to Tenant is active) */}
        {isTenantChargeable && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3.5 space-y-2 mt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText size={13} className="text-slate-500 shrink-0" />
                <span>Reason for Tenant Damage Charge *</span>
              </label>
              <span
                className={`text-[10px] font-medium ${
                  chargeReason.length > 240
                    ? "text-rose-600 dark:text-rose-400 font-bold"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {chargeReason.length}/250 (Min 5 chars)
              </span>
            </div>
            <input
              type="text"
              maxLength={250}
              value={chargeReason}
              onBlur={() => setTouched((curr) => ({ ...curr, reason: true }))}
              onChange={(e) => {
                setChargeReason(e.target.value);
              }}
              disabled={disabled || updateCostMutation.isPending}
              placeholder="e.g. Fixture broken due to tenant misuse, physical force, or negligence"
              className={`h-9 w-full rounded-lg border bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition disabled:opacity-50 ${
                reasonError && touched.reason
                  ? "border-rose-500 focus:border-rose-600"
                  : "border-slate-300 dark:border-slate-700 focus:border-slate-900 dark:focus:border-slate-100"
              }`}
            />
            {reasonError && touched.reason && (
              <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle size={11} className="shrink-0" />
                <span>{reasonError}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action Footer Bar (Rendered when not embedded in a unified multi-card stage) */}
      {!hideStandaloneAction && (
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {hasChanges ? (
              <span className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                <AlertCircle size={13} className="shrink-0" />
                Unsaved expense changes detected.
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Check size={13} className="text-emerald-600 shrink-0" />
                All repair expense records are synced.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {defaultSummaryMode && (
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={updateCostMutation.isPending}
                className="inline-flex h-9 items-center justify-center px-3.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveCost}
              disabled={disabled || updateCostMutation.isPending || !hasChanges || hasValidationErrors}
              title={
                disabled
                  ? "Maintenance request is locked and cannot be edited"
                  : !hasChanges
                    ? "All repair expenses are synced. Update costs to record changes."
                    : hasValidationErrors
                      ? "Fix validation errors above before recording expenses"
                      : "Click to save and record expenses"
              }
              className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-bold shadow-xs transition cursor-pointer active:scale-[0.98] ${
                hasChanges && !hasValidationErrors && !disabled
                  ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-75"
              }`}
            >
              {updateCostMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Save size={13} />
              )}
              <span>
                {updateCostMutation.isPending
                  ? "Saving..."
                  : defaultSummaryMode
                    ? "Save Expense Changes"
                    : "Record Expenses"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

