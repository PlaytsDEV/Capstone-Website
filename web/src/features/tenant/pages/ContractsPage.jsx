import React, { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { tenantContractApi } from "../api/tenantContractApi";
import {
  getTenantContractError,
  getTenantContractMessage,
} from "../utils/tenantContractUi.mjs";
import ContractsPageSkeleton from "../components/contracts/ContractsPageSkeleton";
import DigitalContractPaper from "../components/contracts/DigitalContractPaper";
import "../styles/tenant-common.css";
import "../styles/contracts.css";

export default function ContractsPage() {
  const [contract, setContract] = useState(null);
  const [stayData, setStayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        if (!contractRes.value?.contract) {
          setContract({
            id: stayProofRes.value.stayProof.referenceNumber,
            contractNumber: stayProofRes.value.stayProof.referenceNumber,
            roomNumber: stayProofRes.value.stayProof.roomNumber,
            bedLabel: stayProofRes.value.stayProof.bedLabel,
            status: "active",
          });
        }
      }
    }).catch((requestError) => {
      if (active) setError(getTenantContractError(requestError));
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, []);

  const handleViewSignedCopy = async (version) => {
    if (!contract?.id) return;
    try {
      const blob = await tenantContractApi.getMySignedContractFile(contract.id, version, false);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err?.message || "Failed to preview signed contract copy.");
    }
  };

  const handleDownloadSignedCopy = async (version, fileName) => {
    if (!contract?.id) return;
    try {
      const blob = await tenantContractApi.getMySignedContractFile(contract.id, version, true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `Signed-Contract-v${version}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err?.message || "Failed to download signed contract copy.");
    }
  };

  if (loading) return <ContractsPageSkeleton />;

  const notice = getTenantContractMessage(contract || (stayData ? { status: "active", stayProofAvailable: true } : null));

  return (
    <main className="contracts-page tenant-contract-page">
      {/* Header */}
      <header className="contracts-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Official Lease Contract</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Your official First JRAC Partnership Co. Contract of Lease agreement.
          </p>
        </div>
      </header>

      {error && <div className="contracts-error mb-4" role="alert">{error}</div>}

      {!contract ? (
        <div className="contracts-empty">
          <div className="empty-icon"><FileText size={42} /></div>
          <h3>{notice.title}</h3>
          <p>{notice.message}</p>
        </div>
      ) : (
        <DigitalContractPaper
          stayData={stayData}
          contract={contract}
          onViewSigned={handleViewSignedCopy}
          onDownloadSigned={handleDownloadSignedCopy}
        />
      )}
    </main>
  );
}
