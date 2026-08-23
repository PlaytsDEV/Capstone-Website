import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { tenantContractApi } from "../../api/tenantContractApi";
import {
  getTenantContractError,
  getTenantContractMessage,
} from "../../utils/tenantContractUi.mjs";
import { CardSkeleton, StatGridSkeleton } from "../../../../shared/components/LoadingSkeletons";
import DigitalContractPaper from "../contracts/DigitalContractPaper";

export default function ContractTab() {
  const [contract, setContract] = useState(null);
  const [stayData, setStayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      tenantContractApi.getMyCurrentContract(),
      tenantContractApi.getMyStayProofData(),
    ]).then(([contractRes, stayProofRes]) => {
      if (!active) return;
      if (contractRes.status === "fulfilled") {
        setContract(contractRes.value?.contract || null);
      }
      if (stayProofRes.status === "fulfilled" && stayProofRes.value?.stayProof) {
        setStayData(stayProofRes.value.stayProof);
      }
    }).catch((requestError) => {
      if (active) setError(getTenantContractError(requestError));
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, []);

  const downloadStayProof = async () => {
    setFileBusy(true);
    setError("");
    try {
      const blob = await tenantContractApi.getMyStayProofBlob(true);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Lilycrest-Lease-Contract-${stayData?.referenceNumber || contract?.contractNumber || "Record"}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError?.message || "Contract download failed.");
    } finally {
      setFileBusy(false);
    }
  };

  if (loading) return (
    <div style={{ width: "100%" }}>
      <CardSkeleton lines={2} height={100} style={{ marginBottom: 20 }} />
      <StatGridSkeleton count={4} minWidth={160} />
    </div>
  );

  const message = getTenantContractMessage(contract || (stayData ? { status: "active", stayProofAvailable: true } : null));
  if (!contract && !stayData) {
    return (
      <div style={{ width: "100%" }}>
        <div style={{ textAlign: "center", padding: "56px 24px", background: "#fff", borderRadius: 12, border: "1px solid #E8EBF0" }}>
          <FileText size={48} color="#D1D5DB" />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#374151", margin: "16px 0 8px" }}>{message.title}</h3>
          <p style={{ fontSize: 13, color: "#64748B", maxWidth: 420, margin: "0 auto" }}>{error || message.message}</p>
        </div>
      </div>
    );
  }

  const handleViewSigned = async (version) => {
    if (!contract?.id) return;
    try {
      const blob = await tenantContractApi.getMySignedContractFile(contract.id, version, false);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      setError(requestError?.message || "Failed to preview signed contract.");
    }
  };

  const handleDownloadSigned = async (version, fileName) => {
    if (!contract?.id) return;
    try {
      const blob = await tenantContractApi.getMySignedContractFile(contract.id, version, true);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName || `Signed-Contract-v${version}.pdf`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError?.message || "Failed to download signed contract.");
    }
  };

  return (
    <div style={{ width: "100%" }}>
      {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <DigitalContractPaper
        stayData={stayData}
        contract={contract}
        onDownloadPdf={downloadStayProof}
        isDownloading={fileBusy}
        onViewSigned={handleViewSigned}
        onDownloadSigned={handleDownloadSigned}
        fetchDocumentPdf={(c) => (c?.tenantDocument?.isFinal
          ? tenantContractApi.getMyFinalContractFile(c.id || c._id, false)
          : tenantContractApi.getMyPreparedContractFile(c.id || c._id, false))}
      />
    </div>
  );
}
