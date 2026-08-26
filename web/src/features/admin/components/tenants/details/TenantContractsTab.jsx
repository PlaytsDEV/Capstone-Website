import { FileText, Eye, Download, Layers } from "lucide-react";
import SignedContractUploadSection from "../../SignedContractUploadSection";
import { formatDate, formatMoney } from "./tenantDetailConstants";

const getContractStatusDot = (status) => {
  const s = String(status || "").toLowerCase();
  if (["active", "signed", "generated", "verified"].includes(s)) return "bg-emerald-500";
  if (["pending", "draft", "review"].includes(s)) return "bg-amber-500";
  if (["voided", "cancelled", "terminated", "expired", "rejected"].includes(s)) return "bg-rose-500";
  return "bg-slate-400";
};

const getContractStatusLabel = (contract) => {
  if (!contract) return "Verified Active Stay";
  const s = String(contract?.status || "").toLowerCase();
  if (contract?.isCanonical) {
    if (s === "signed") return "Canonical (Signed)";
    return "Canonical Contract";
  }
  if (s === "active") return "Active Contract";
  if (s === "signed") return "Signed Contract";
  if (s === "generated") return "Generated Contract";
  if (s === "pending") return "Pending Signature";
  if (s === "draft") return "Draft Contract";
  if (s === "voided") return "Voided Duplicate";
  if (s === "cancelled") return "Cancelled";
  if (s === "terminated") return "Terminated";
  if (s === "expired") return "Expired";
  return "Verified Active Stay";
};

export default function TenantContractsTab({
  tenant,
  dedicatedContract,
  dedicatedContractError,
  allTenantContracts = [],
  selectedContract = null,
  onSelectContract = () => {},
  stayReference: stayReferenceProp,
  downloadingProof,
  onOpenDigitalContract,
  onDownloadStayProof,
  onContractUpdated,
}) {
  const displayContract =
    selectedContract ||
    dedicatedContract ||
    (allTenantContracts && allTenantContracts.length > 0 ? allTenantContracts[0] : null);

  const stayReference =
    stayReferenceProp !== undefined
      ? stayReferenceProp
      : displayContract?.contractNumber
      ? displayContract.contractNumber
      : dedicatedContractError === "MULTIPLE_CANONICAL_CONTRACTS" && !displayContract
      ? "Conflicting records"
      : tenant?.reservationCode || "LIL-RES-RECORD";

  const hasMultipleContracts = Array.isArray(allTenantContracts) && allTenantContracts.length > 1;

  return (
    <div className="space-y-4">
      {/* Multi-Contract Version Selector Toolbar */}
      {hasMultipleContracts && (
        <div className="bg-card border border-border rounded-xl p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Contract Version Switcher
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">
                ({allTenantContracts.length} records on file)
              </span>
            </div>
            {displayContract && (
              <div className="flex items-center gap-1.5 text-xs text-foreground font-medium bg-transparent">
                <span
                  className={`w-1.5 h-1.5 rounded-full inline-block ${getContractStatusDot(
                    displayContract?.status,
                  )}`}
                />
                <span>{getContractStatusLabel(displayContract)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="tenant-contract-select"
                className="text-[11px] font-medium text-muted-foreground block mb-1"
              >
                Select Contract Record
              </label>
              <select
                id="tenant-contract-select"
                value={displayContract?._id || displayContract?.id || ""}
                onChange={(e) => {
                  const found = allTenantContracts.find(
                    (c) => String(c._id || c.id) === e.target.value,
                  );
                  if (found) {
                    onSelectContract(found);
                  }
                }}
                className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {allTenantContracts.map((c, index) => {
                  const isCanonical =
                    String(c._id || c.id) ===
                      String(dedicatedContract?._id || dedicatedContract?.id) ||
                    c.isCanonical;
                  const number = c.contractNumber || `Contract #${index + 1}`;
                  const date = c.createdAt ? formatDate(c.createdAt) : "No date";
                  const status = (c.status || "active").toUpperCase();
                  const label = `${number} • ${status} • ${date}${
                    isCanonical ? " [Current / Canonical]" : ""
                  }`;
                  return (
                    <option key={c._id || c.id || index} value={c._id || c.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col justify-end text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 border border-border/60">
              <div className="flex items-center justify-between text-[11px]">
                <span>Active Selection:</span>
                <span className="font-mono font-semibold text-foreground">
                  {displayContract?.contractNumber || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-0.5">
                <span>Created / Updated:</span>
                <span className="font-medium text-foreground">
                  {formatDate(displayContract?.createdAt || displayContract?.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Digital Stay Record & Tenancy Proof Card */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-foreground flex items-center justify-between uppercase tracking-wide">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Digital Stay Record &amp; Proof
          </span>
          <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold bg-transparent">
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
            <div>
              <span className="text-muted-foreground block text-[11px]">Monthly Rent Rate</span>
              <span className="font-semibold text-foreground">
                {formatMoney(displayContract?.approvedMonthlyRate || tenant.monthlyRate)}
              </span>
            </div>
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
