import { useEffect, useState } from "react";
import { Download, Eye, FileText, Info, LoaderCircle } from "lucide-react";
import { tenantContractApi } from "../api/tenantContractApi";
import {
  formatContractType,
  formatRoomBed,
  formatTenantContractStatus,
  getTenantContractError,
  getTenantContractMessage,
} from "../utils/tenantContractUi.mjs";
import ContractsPageSkeleton from "../components/contracts/ContractsPageSkeleton";
import "../styles/tenant-common.css";
import "../styles/contracts.css";

const date = (value) => value ? new Date(value).toLocaleDateString("en-PH", {
  year: "numeric", month: "long", day: "numeric",
}) : "Not available";
const money = (value) => value == null ? "Not available" : `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fileSize = (value) => value == null ? "Not available" : `${(Number(value) / 1024).toFixed(1)} KB`;

const Detail = ({ label, value }) => <div className="tenant-contract-detail">
  <span>{label}</span><strong>{value}</strong>
</div>;

export default function ContractsPage() {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fileBusy, setFileBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    tenantContractApi.getMyCurrentContract()
      .then((payload) => setContract(payload.contract || null))
      .catch((requestError) => setError(getTenantContractError(requestError)))
      .finally(() => setLoading(false));
  }, []);

  const retrieveFile = async (mode, documentType = "prepared") => {
    setFileBusy(`${documentType}-${mode}`);
    setError("");
    try {
      const blob = documentType === "final"
        ? await tenantContractApi.getMyFinalContractFile(contract.id, mode === "download")
        : await tenantContractApi.getMyPreparedContractFile(contract.id, mode === "download");
      const url = URL.createObjectURL(blob);
      if (mode === "download") {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = documentType === "final"
          ? contract.finalDocument.fileName || "final-contract.pdf"
          : contract.preparedDocument.fileName || "prepared-contract.pdf";
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (requestError) {
      setError(getTenantContractError(requestError));
    } finally {
      setFileBusy("");
    }
  };

  if (loading) return <ContractsPageSkeleton />;
  const notice = getTenantContractMessage(contract);
  const assignment = formatRoomBed(contract?.roomNumber, contract?.bedLabel);

  return <main className="contracts-page tenant-contract-page">
    <header className="contracts-header"><h1>My Contract</h1><p>View your lease details and prepared Contract document.</p></header>
    {error && <div className="contracts-error" role="alert">{error}</div>}
    {!contract ? <div className="contracts-empty">
      <div className="empty-icon"><FileText size={42} /></div>
      <h3>{notice.title}</h3><p>{notice.message}</p>
    </div> : <>
      <section aria-labelledby="contract-summary-title">
        <h2 className="tenant-contract-section-title" id="contract-summary-title">Contract Summary</h2>
        <article className="tenant-contract-summary">
          <div className="tenant-contract-summary__heading">
            <div><span>Contract number</span><h3>{contract.contractNumber || "Contract Record"}</h3>
              <p>{formatContractType(contract.templateType, contract.roomType, contract.leaseType)}</p></div>
            <span className="tenant-contract-status-badge">{formatTenantContractStatus(contract.status)}</span>
          </div>
          <div className="tenant-contract-summary__groups">
            <div><h4>Property and Assignment</h4>
              <Detail label="Branch" value={String(contract.branch || "Not available").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} />
              <Detail label="Property" value={contract.propertyName || "Not available"} />
              <Detail label="Room" value={assignment.room} />
              <Detail label="Bed/Slot" value={assignment.bed} />
            </div>
            <div><h4>Lease Information</h4>
              <Detail label="Lease Start" value={date(contract.leaseStartDate)} />
              <Detail label="Lease End" value={date(contract.leaseEndDate)} />
              <Detail label="Duration" value={contract.leaseDurationMonths ? `${contract.leaseDurationMonths} months` : "Not available"} />
              <Detail label="Days Remaining" value={contract.daysRemaining == null ? "Not available" : contract.daysRemaining < 0 ? "Expired" : `${contract.daysRemaining} days`} />
            </div>
          </div>
          <div className="tenant-contract-financial"><Detail label="Approved Monthly Rate" value={money(contract.approvedMonthlyRate)} /></div>
        </article>
      </section>

      <section className="tenant-contract-notice" aria-labelledby="contract-status-title">
        <Info size={20} /><div><h2 id="contract-status-title">{notice.title}</h2><p>{notice.message}</p><strong>{notice.nextAction}</strong></div>
      </section>

      <section aria-labelledby="contract-document-title">
        <h2 className="tenant-contract-section-title" id="contract-document-title">Contract Document</h2>
        {contract.finalDocument?.available && <article className="tenant-contract-document tenant-contract-document--final">
          <div className="tenant-contract-document__icon"><FileText size={26} /></div>
          <div className="tenant-contract-document__content">
            <h3>Final Signed and Notarized Contract</h3>
            <p>Your published legal digital copy.</p>
            <div className="tenant-contract-document__meta">
              <span>{contract.contractNumber}</span>
              <span>Published {date(contract.finalDocument.publishedAt)}</span>
              <span>{date(contract.leaseStartDate)} — {date(contract.leaseEndDate)}</span>
              <span>{contract.finalDocument.pageCount || "—"} page(s)</span>
              <span>{fileSize(contract.finalDocument.fileSize)}</span>
            </div>
          </div>
          <div className="tenant-contract-actions">
            <button type="button" className="tenant-contract-button tenant-contract-button--primary"
              disabled={Boolean(fileBusy)} onClick={() => retrieveFile("view", "final")}>
              <Eye size={16}/>View Final Contract
            </button>
            <button type="button" className="tenant-contract-button tenant-contract-button--secondary"
              disabled={Boolean(fileBusy)} onClick={() => retrieveFile("download", "final")}>
              <Download size={16}/>Download Final Contract
            </button>
          </div>
        </article>}
        <article className="tenant-contract-document">
          <div className="tenant-contract-document__icon"><FileText size={26} /></div>
          <div className="tenant-contract-document__content">
            <h3>{contract.preparedDocument.available ? "Prepared Copy — Not Yet Signed or Notarized" : "Prepared Document Temporarily Unavailable"}</h3>
            <p>{contract.preparedDocument.available ? "The final wet-signed and notarized Contract is still being processed." : "Your Contract record is available, but the prepared PDF cannot currently be opened. The dormitory administrator must regenerate the document."}</p>
            {contract.preparedDocument.available && <div className="tenant-contract-document__meta">
              <span>Version {contract.preparedDocument.currentVersion}</span>
              <span>Generated {date(contract.preparedDocument.generatedAt)}</span>
              <span>{contract.preparedDocument.pageCount || "—"} page{contract.preparedDocument.pageCount === 1 ? "" : "s"}</span>
              <span>{fileSize(contract.preparedDocument.fileSize)}</span>
            </div>}
          </div>
          {contract.preparedDocument.available && <div className="tenant-contract-actions">
            <button type="button" className="tenant-contract-button tenant-contract-button--primary" disabled={Boolean(fileBusy)} onClick={() => retrieveFile("view")}>
              {fileBusy === "view" && <LoaderCircle className="tenant-contract-spinner" size={16} />}<Eye size={16} />{fileBusy === "view" ? "Opening Contract…" : "View Prepared Copy"}
            </button>
            <button type="button" className="tenant-contract-button tenant-contract-button--secondary" disabled={Boolean(fileBusy)} onClick={() => retrieveFile("download")}>
              {fileBusy === "download" && <LoaderCircle className="tenant-contract-spinner" size={16} />}<Download size={16} />{fileBusy === "download" ? "Preparing Download…" : "Download Prepared Copy"}
            </button>
          </div>}
        </article>
      </section>
    </>}
  </main>;
}
