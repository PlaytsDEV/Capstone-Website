import { FileText, Eye, Download } from "lucide-react";
import SignedContractUploadSection from "../../SignedContractUploadSection";
import { formatDate, formatMoney } from "./tenantDetailConstants";

export default function TenantContractsTab({
  tenant,
  dedicatedContract,
  dedicatedContractError,
  stayReference: stayReferenceProp,
  downloadingProof,
  onOpenDigitalContract,
  onDownloadStayProof,
  onContractUpdated,
}) {
  const stayReference =
    stayReferenceProp !== undefined
      ? stayReferenceProp
      : dedicatedContractError === "MULTIPLE_CANONICAL_CONTRACTS"
      ? "Conflicting records"
      : dedicatedContract?.contractNumber || tenant?.reservationCode || "LIL-RES-RECORD";

  return (
    <div className="space-y-4">
      {/* Digital Stay Record & Tenancy Proof Card */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-foreground flex items-center justify-between uppercase tracking-wide">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Digital Stay Record &amp; Proof
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Verified Active Stay</span>
          </div>
        </h4>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Move-in Date</span>
              <span className="font-semibold text-foreground">
                {formatDate(
                  dedicatedContract?.leaseStartDate || tenant.moveInDate || tenant.moveIn,
                )}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Lease End Date</span>
              <span className="font-semibold text-foreground">
                {formatDate(
                  dedicatedContract?.leaseEndDate ||
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
            <div>
              <span className="text-muted-foreground block text-[11px]">Monthly Rent Rate</span>
              <span className="font-semibold text-foreground">
                {formatMoney(tenant.monthlyRate || dedicatedContract?.approvedMonthlyRate)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              onClick={() => onOpenDigitalContract && onOpenDigitalContract()}
            >
              <Eye className="w-3.5 h-3.5" />
              View Digital Contract
            </button>

            <button
              type="button"
              disabled={downloadingProof}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              onClick={() => onDownloadStayProof && onDownloadStayProof()}
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
        dedicatedContract={dedicatedContract}
        onContractUpdated={onContractUpdated}
      />
    </div>
  );
}
