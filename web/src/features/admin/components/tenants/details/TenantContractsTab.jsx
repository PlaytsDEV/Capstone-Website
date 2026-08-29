import { FileText, Eye, Download, CheckCircle2, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import SignedContractUploadSection from "../../SignedContractUploadSection";
import { formatDate, formatMoney } from "./tenantDetailConstants";
import { CONTRACT_STATUS_LABELS } from "../../../utils/contractStatusLabels.js";
import { contractApi } from "../../../../../shared/api/contractApi";

const TONE_DOT_CLASS = Object.freeze({
  success: "bg-emerald-500",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  neutral: "bg-slate-400",
});

// Uses the canonical status table (contractStatusLabels.js — shared source
// of truth with tenant Web/Mobile via server/config/contractStatusLabels.js)
// instead of a separately hand-maintained status map, so Admin never
// disagrees with what the tenant sees for the same Contract.
const getContractStatusDot = (status) =>
  TONE_DOT_CLASS[CONTRACT_STATUS_LABELS[status]?.tone] || TONE_DOT_CLASS.neutral;

const getContractStatusLabel = (contract) => {
  if (!contract) return "Verified Active Stay";
  const meta = CONTRACT_STATUS_LABELS[contract?.status];
  if (contract?.isCanonical || contract?.isCurrent) {
    return meta ? `Current Contract (${meta.adminLabel})` : "Current Contract";
  }
  return meta?.adminLabel || "Verified Active Stay";
};

export default function TenantContractsTab({
  tenant,
  dedicatedContract,
  dedicatedContractError,
  allTenantContracts = [],
  stayReference: stayReferenceProp,
  downloadingProof,
  onOpenDigitalContract,
  onDownloadStayProof,
  onContractUpdated,
}) {
  const displayContract =
    dedicatedContract ||
    (allTenantContracts && allTenantContracts.length > 0
      ? allTenantContracts.find((c) => c.isCanonical || c.isCurrent) || allTenantContracts[0]
      : null);

  const stayReference =
    stayReferenceProp !== undefined
      ? stayReferenceProp
      : displayContract?.contractNumber
      ? displayContract.contractNumber
      : dedicatedContractError === "MULTIPLE_CANONICAL_CONTRACTS" && !displayContract
      ? "Conflicting records"
      : tenant?.reservationCode || "LIL-RES-RECORD";

  const displayContractId = displayContract?._id || displayContract?.id;
  const isRealContractId = /^[a-f\d]{24}$/i.test(String(displayContractId || ""));
  // Prefer the acknowledgement embedded in the current-contract payload
  // (getTenantCurrentContract now returns it) — one canonical value, no
  // extra round-trip. Fall back to the standalone endpoint, and re-fetch on
  // the app-wide "contract-updated" event so an open admin page reflects a
  // tenant's acknowledgement after navigation/action (a plain refresh also
  // works). This is READ of the one backend state — no local-only state.
  const [acknowledgement, setAcknowledgement] = useState(
    displayContract?.acknowledgement || null,
  );

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      if (!isRealContractId) {
        setAcknowledgement(null);
        return;
      }
      if (displayContract?.acknowledgement) {
        setAcknowledgement(displayContract.acknowledgement);
        return;
      }
      contractApi
        .getContractAcknowledgement(displayContractId)
        .then((result) => {
          if (!cancelled) setAcknowledgement(result || null);
        })
        .catch(() => {
          if (!cancelled) setAcknowledgement(null);
        });
    };

    load();

    const refetch = () => {
      if (!isRealContractId) return;
      contractApi
        .getContractAcknowledgement(displayContractId)
        .then((result) => {
          if (!cancelled) setAcknowledgement(result || null);
        })
        .catch(() => {});
    };
    window.addEventListener("lilycrest:contract-updated", refetch);
    return () => {
      cancelled = true;
      window.removeEventListener("lilycrest:contract-updated", refetch);
    };
  }, [displayContractId, isRealContractId, displayContract?.acknowledgement]);

  return (
    <div className="space-y-4">

      {/* Digital Stay Record & Tenancy Proof Card */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-foreground flex items-center justify-between uppercase tracking-wide">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Digital Stay Record &amp; Proof
          </span>
          <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold bg-transparent normal-case">
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block ${getContractStatusDot(
                displayContract?.status,
              )}`}
            />
            <span>{getContractStatusLabel(displayContract)}</span>
          </div>
        </h4>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Move-in Date</span>
              <span className="font-semibold text-foreground">
                {formatDate(
                  displayContract?.leaseStartDate || tenant.moveInDate || tenant.moveIn,
                )}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Lease End Date</span>
              <span className="font-semibold text-foreground">
                {formatDate(
                  displayContract?.leaseEndDate ||
                    tenant.contractEnd ||
                    tenant.moveOut ||
                    tenant.leaseEndDate,
                )}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Stay Reference</span>
              <span className="font-semibold font-mono text-foreground">{stayReference}</span>
            </div>
            {(() => {
              // The tenant's CURRENT operational rent (backend resolves this
              // from recurringRentRate after a transfer). Historical / non-
              // current contract documents keep their own snapshot rate.
              const isHistoricalDoc =
                displayContract && displayContract.isCurrent === false;
              const isAddendum =
                displayContract?.contractPurpose === "amendment" ||
                displayContract?.purpose === "amendment";
              const docRate = displayContract?.approvedMonthlyRate;
              const currentRate = tenant.monthlyRate;
              return (
                <>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {isHistoricalDoc ? "Rate on This Document (historical)" : "Current Monthly Rent"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatMoney(isHistoricalDoc ? docRate : (currentRate ?? docRate))}
                    </span>
                  </div>
                  {isHistoricalDoc && currentRate != null && Number(currentRate) !== Number(docRate) && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Current Monthly Rent (in effect now)</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatMoney(currentRate)}
                      </span>
                    </div>
                  )}
                  {isAddendum && !isHistoricalDoc && (
                    <div className="col-span-2 text-[11px] text-muted-foreground -mt-1">
                      This is a Room Transfer Addendum under the continuing lease — the lease dates above are the
                      original lease's dates and are unchanged by the transfer.
                    </div>
                  )}
                </>
              );
            })()}
            {acknowledgement?.required && (
              <div className="col-span-2">
                <span className="text-muted-foreground block text-[11px]">
                  Tenant Acknowledgement
                  {acknowledgement.documentKind === "draft"
                    ? " (Draft)"
                    : acknowledgement.documentKind === "final"
                    ? " (Final)"
                    : ""}
                  {acknowledgement.documentVersion ? ` • v${acknowledgement.documentVersion}` : ""}
                </span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  {acknowledgement.acknowledged ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>
                        Acknowledged
                        {acknowledgement.acknowledgedAt
                          ? ` • ${formatDate(acknowledgement.acknowledgedAt)}`
                          : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-muted-foreground">Pending acknowledgement</span>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              onClick={() => onOpenDigitalContract && onOpenDigitalContract(displayContract)}
            >
              <Eye className="w-3.5 h-3.5" />
              View Digital Contract
            </button>

            <button
              type="button"
              disabled={downloadingProof}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              onClick={() => onDownloadStayProof && onDownloadStayProof(displayContract)}
            >
              <Download className="w-3.5 h-3.5" />
              {downloadingProof ? "Generating PDF…" : "Download Lease Contract (PDF)"}
            </button>
          </div>
        </div>
      </div>

      {/* Wet-Signed & Scanned Contract Upload Section */}
      <SignedContractUploadSection
        tenant={tenant}
        dedicatedContract={displayContract}
        onContractUpdated={onContractUpdated}
      />
    </div>
  );
}
