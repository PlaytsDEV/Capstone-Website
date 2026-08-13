import { useEffect, useState } from "react";
import { Coins, DollarSign, Receipt, Save, ShieldAlert } from "lucide-react";
import { showNotification } from "../../../../../shared/utils/notification";
import { useUpdateMaintenanceCost } from "../../../../../shared/hooks/queries/useMaintenance";
import { getMaintenanceApiErrorMessage, sanitizeAmountInput } from "../maintenanceUtils";
import { DetailDrawer } from "../../../components/shared";
import { SectionBadge } from "./SectionBadge";

export function CostAttributionCard({ request }) {
  const updateCostMutation = useUpdateMaintenanceCost();

  const [laborCost, setLaborCost] = useState(
    request?.costBreakdown?.laborCost !== undefined ? String(request.costBreakdown.laborCost) : "0",
  );
  const [materialsCost, setMaterialsCost] = useState(
    request?.costBreakdown?.materialsCost !== undefined ? String(request.costBreakdown.materialsCost) : "0",
  );
  const [isTenantChargeable, setIsTenantChargeable] = useState(
    Boolean(request?.costBreakdown?.isTenantChargeable),
  );
  const [chargeReason, setChargeReason] = useState(
    request?.costBreakdown?.chargeReason || "",
  );

  useEffect(() => {
    if (request) {
      setLaborCost(
        request?.costBreakdown?.laborCost !== undefined ? String(request.costBreakdown.laborCost) : "0",
      );
      setMaterialsCost(
        request?.costBreakdown?.materialsCost !== undefined ? String(request.costBreakdown.materialsCost) : "0",
      );
      setIsTenantChargeable(Boolean(request?.costBreakdown?.isTenantChargeable));
      setChargeReason(request?.costBreakdown?.chargeReason || "");
    }
  }, [request]);

  const numLabor = Math.max(0, Number(laborCost) || 0);
  const numMaterials = Math.max(0, Number(materialsCost) || 0);
  const totalCost = numLabor + numMaterials;

  const handleSaveCost = async () => {
    try {
      await updateCostMutation.mutateAsync({
        requestId: request.request_id,
        payload: {
          laborCost: numLabor,
          materialsCost: numMaterials,
          isTenantChargeable,
          chargeReason: isTenantChargeable ? chargeReason.trim() : null,
        },
      });

      showNotification({
        title: "Cost Saved",
        message: `Maintenance cost recorded at PHP ${totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`,
        type: "success",
      });
    } catch (err) {
      showNotification({
        title: "Save Failed",
        message: getMaintenanceApiErrorMessage(err, "Failed to save cost details"),
        type: "error",
      });
    }
  };

  const hasChanges =
    numLabor !== Number(request?.costBreakdown?.laborCost || 0) ||
    numMaterials !== Number(request?.costBreakdown?.materialsCost || 0) ||
    isTenantChargeable !== Boolean(request?.costBreakdown?.isTenantChargeable) ||
    chargeReason.trim() !== String(request?.costBreakdown?.chargeReason || "").trim();

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <DetailDrawer.Section
        label={(
          <>
            <Coins size={14} />
            Cost & Damage Attribution
            <SectionBadge tone="amber">Admin Only</SectionBadge>
          </>
        )}
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Track expenses for labor and materials. Specify whether costs are dormitory-absorbed or chargeable to tenant damages.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Labor / Service Cost (PHP)
            </label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                ₱
              </span>
              <input
                type="text"
                value={laborCost}
                onChange={(e) => setLaborCost(sanitizeAmountInput(e.target.value))}
                placeholder="0.00"
                className="h-10 w-full rounded-lg border border-border bg-card pl-7 pr-3 text-sm text-card-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Materials / Parts Cost (PHP)
            </label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                ₱
              </span>
              <input
                type="text"
                value={materialsCost}
                onChange={(e) => setMaterialsCost(sanitizeAmountInput(e.target.value))}
                placeholder="0.00"
                className="h-10 w-full rounded-lg border border-border bg-card pl-7 pr-3 text-sm text-card-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Total Cost Display */}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <span className="text-xs font-semibold text-muted-foreground">Computed Total Expense</span>
          <span className="text-sm font-bold text-card-foreground">
            PHP {totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Tenant Chargeable Checkbox & Reason */}
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={isTenantChargeable}
              onChange={(e) => setIsTenantChargeable(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <div>
              <span className="text-xs font-semibold text-card-foreground">
                Charge expense to resident (Tenant Damage)
              </span>
              <p className="text-[11px] text-muted-foreground">
                If checked, this expense will be attributed to the resident and can be itemized on their billing ledger.
              </p>
            </div>
          </label>

          {isTenantChargeable ? (
            <div className="mt-3 space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Reason for Resident Charge
              </label>
              <input
                type="text"
                value={chargeReason}
                onChange={(e) => setChargeReason(e.target.value)}
                placeholder="e.g. Fixture damaged due to resident negligence"
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-xs text-card-foreground focus:border-primary focus:outline-none"
              />
            </div>
          ) : null}
        </div>

        {/* Save Button */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSaveCost}
            disabled={!hasChanges || updateCostMutation.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            <Save size={13} />
            <span>{updateCostMutation.isPending ? "Saving..." : "Save Cost Attribution"}</span>
          </button>
        </div>
      </DetailDrawer.Section>
    </div>
  );
}
