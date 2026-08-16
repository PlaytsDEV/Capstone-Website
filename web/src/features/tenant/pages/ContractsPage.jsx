import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { tenantContractApi } from "../api/tenantContractApi";
import {
  getTenantContractError,
  getTenantContractMessage,
} from "../utils/tenantContractUi.mjs";
import ContractsPageSkeleton from "../components/contracts/ContractsPageSkeleton";
import DigitalContractPaper from "../components/contracts/DigitalContractPaper";
import "../styles/tenant-common.css";
import "../styles/contracts.css";

function ContractSummaryBanner({ contract, stayData }) {
  const branchName =
    stayData?.branch ||
    contract?.branch ||
    "Lilycrest Residence";
  const formattedBranch = String(branchName).toLowerCase().includes("guadalupe")
    ? "Lilycrest Guadalupe"
    : String(branchName).toLowerCase().includes("gil")
    ? "Lilycrest Gil Puyat"
    : branchName;

  const room = stayData?.roomNumber || contract?.roomNumber || "—";
  const bed = stayData?.bedLabel || contract?.bedLabel;
  const isPrivate =
    String(stayData?.roomType || contract?.roomType || "").toLowerCase().includes("private") ||
    String(room).includes("803") ||
    !bed;

  const durationMonths = Number(stayData?.leaseDurationMonths || contract?.leaseDurationMonths || 12);
  const isShortTerm = durationMonths < 6;
  const termLabel = isShortTerm ? "Short Term" : "Long Term";

  const monthlyRate = Number(
    stayData?.approvedMonthlyRate ?? contract?.approvedMonthlyRate ?? (isPrivate ? 13500 : 5400)
  );
  const discountPercent = Number(
    stayData?.discountPercentage ?? contract?.discountPercentage ?? 0
  );

  const advanceRent = Number(
    stayData?.advanceRentAmount ?? contract?.advanceRentAmount ?? monthlyRate
  );
  const securityDeposit = Number(
    stayData?.securityDepositAmount ?? contract?.securityDepositAmount ?? monthlyRate
  );

  const startDate = stayData?.leaseStartDate || contract?.leaseStartDate;
  const endDate = stayData?.leaseEndDate || contract?.leaseEndDate;
  const dateRangeStr = startDate && endDate
    ? `${dayjs(startDate).format("MMM D, YYYY")} – ${dayjs(endDate).format("MMM D, YYYY")}`
    : `${durationMonths} Months`;

  return (
    <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1: Branch & Room */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Accommodation
          </span>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/60">
            <Building2 size={14} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            {formattedBranch}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Room {room} {isPrivate ? "• Private Room" : `• Bed Slot ${bed || "1"}`}
          </div>
        </div>
      </div>

      {/* 2: Duration */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Lease Period
          </span>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/60">
            <Calendar size={14} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            {durationMonths} Months ({termLabel})
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={dateRangeStr}>
            {dateRangeStr}
          </div>
        </div>
      </div>

      {/* 3: Monthly Rent */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Monthly Rate
          </span>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60">
            <Coins size={14} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            ₱{monthlyRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {discountPercent > 0 ? `${discountPercent}% promo discount applied` : "Net of electricity consumption"}
          </div>
        </div>
      </div>

      {/* 4: Deposits */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Initial Deposits
          </span>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/60">
            <ShieldCheck size={14} />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            ₱{(advanceRent + securityDeposit).toLocaleString("en-PH", { minimumFractionDigits: 2 })} Total
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            1 Mo. Advance + 1 Mo. Security Deposit
          </div>
        </div>
      </div>
    </div>
  );
}

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
    ])
      .then(([contractRes, stayProofRes]) => {
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
      })
      .catch((requestError) => {
        if (active) setError(getTenantContractError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
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

  const notice = getTenantContractMessage(
    contract || (stayData ? { status: "active", stayProofAvailable: true } : null),
  );

  return (
    <main className="contracts-page tenant-contract-page">
      {/* Header */}
      <header className="contracts-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Official Lease Contract</h1>
            {contract?.tenantDocument?.type === "final_notarized" || contract?.finalDocument?.available || contract?.status === "active" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                <CheckCircle2 size={12} />
                Final Notarized Contract
              </span>
            ) : contract?.tenantDocument?.type === "generated_draft" || contract?.preparedDocument?.available ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                <FileText size={12} />
                Generated Draft — For Signing
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                Contract is being prepared
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {contract?.tenantDocument?.type === "generated_draft"
              ? "Your contract has been generated and is ready for in-person signing. The final notarized copy will replace this document once uploaded by the admin."
              : "Your official First JRAC Partnership Co. Contract of Lease agreement and terms of residency."}
          </p>
        </div>
      </header>

      {error && (
        <div className="contracts-error mb-4" role="alert">
          {error}
        </div>
      )}

      {!contract && !stayData ? (
        <div className="contracts-empty">
          <div className="empty-icon">
            <FileText size={42} />
          </div>
          <h3>{notice.title}</h3>
          <p>{notice.message}</p>
        </div>
      ) : (
        <>
          {/* Key Information Banner */}
          <ContractSummaryBanner contract={contract} stayData={stayData} />

          {/* Digital Contract Paper View */}
          <DigitalContractPaper
            stayData={stayData}
            contract={contract}
            onViewSigned={handleViewSignedCopy}
            onDownloadSigned={handleDownloadSignedCopy}
          />
        </>
      )}
    </main>
  );
}
