import { useEffect, useState } from "react";
import { Eye, FileText } from "lucide-react";
import { tenantContractApi } from "../../api/tenantContractApi";
import {
  formatContractType,
  formatRoomBed,
  formatTenantContractStatus,
  getTenantContractError,
  getTenantContractMessage,
} from "../../utils/tenantContractUi.mjs";
import { CardSkeleton, StatGridSkeleton } from "../../../../shared/components/LoadingSkeletons";

const date = (value) => value ? new Date(value).toLocaleDateString("en-PH", {
  year: "numeric", month: "long", day: "numeric",
}) : "Not available";
const money = (value) => value == null ? "Not available" : `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const InfoBlock = ({ label, value }) => <div style={{ borderTop: "2.5px solid #E8734A", paddingTop: 12 }}>
  <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 4, fontWeight: 500 }}>{label}</p>
  <p style={{ fontSize: 15, fontWeight: 600, color: "#0A1628", margin: 0 }}>{value}</p>
</div>;

export default function ContractTab() {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);

  useEffect(() => {
    tenantContractApi.getMyCurrentContract()
      .then((payload) => setContract(payload.contract || null))
      .catch((requestError) => setError(getTenantContractError(requestError)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ width: "100%" }}>
    <CardSkeleton lines={2} height={100} style={{ marginBottom: 20 }} />
    <StatGridSkeleton count={4} minWidth={160} />
  </div>;

  const message = getTenantContractMessage(contract);
  if (!contract) return <div style={{ width: "100%" }}>
    <div style={{ textAlign: "center", padding: "56px 24px", background: "#fff", borderRadius: 10, border: "1px solid #E8EBF0" }}>
      <FileText size={48} color="#D1D5DB" />
      <h3 style={{ fontSize: 16, fontWeight: 600, color: "#374151", margin: "16px 0 8px" }}>{message.title}</h3>
      <p style={{ fontSize: 13, color: "#9CA3AF", maxWidth: 420, margin: "0 auto" }}>{error || message.message}</p>
    </div>
  </div>;

  const assignment = formatRoomBed(contract.roomNumber, contract.bedLabel);
  const viewFinal = async () => {
    setFileBusy(true);
    try {
      const blob = await tenantContractApi.getMyFinalContractFile(contract.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) { setError(getTenantContractError(requestError)); }
    finally { setFileBusy(false); }
  };

  return <div style={{ width: "100%" }}>
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8EBF0", padding: "24px 28px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, color: "#0A1628", margin: "0 0 4px" }}>{message.title}</h2>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>{message.message}</p></div>
        <span style={{ background: "#FFF7ED", color: "#C2410C", fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 20 }}>{formatTenantContractStatus(contract.status)}</span>
      </div>
    </div>
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8EBF0", padding: 28 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "20px 24px" }}>
        <InfoBlock label="Contract Number" value={contract.contractNumber || "Not available"} />
        <InfoBlock label="Contract Type" value={formatContractType(contract.templateType, contract.roomType, contract.leaseType)} />
        <InfoBlock label="Branch" value={formatContractType(contract.branch)} />
        <InfoBlock label="Room / Bed" value={assignment.combined} />
        <InfoBlock label="Lease Start" value={date(contract.leaseStartDate)} />
        <InfoBlock label="Lease End" value={date(contract.leaseEndDate)} />
        <InfoBlock label="Lease Duration" value={contract.leaseDurationMonths ? `${contract.leaseDurationMonths} months` : "Not available"} />
        <InfoBlock label="Days Remaining" value={contract.daysRemaining == null ? "Not available" : contract.daysRemaining < 0 ? "Expired" : `${contract.daysRemaining} days`} />
        <InfoBlock label="Approved Monthly Rate" value={money(contract.approvedMonthlyRate)} />
        <InfoBlock label="Prepared Document" value={contract.preparedDocument.available ? "Prepared Contract PDF available" : "Not yet available"} />
        <InfoBlock label="Final Document" value={contract.finalDocument?.available ? "Final Contract Available" : "Not yet published"} />
        <InfoBlock label="Published Date" value={date(contract.finalDocument?.publishedAt)} />
      </div>
      {contract.finalDocument?.available && <button type="button" disabled={fileBusy}
        onClick={viewFinal} className="tenant-contract-button tenant-contract-button--primary"
        style={{ marginTop: 20 }}><Eye size={16}/>View Final Contract</button>}
    </div>
  </div>;
}
