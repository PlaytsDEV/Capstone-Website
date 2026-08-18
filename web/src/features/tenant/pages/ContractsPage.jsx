import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import {
  ArrowRight,
  Building2,
  Calendar,
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

  const roomRaw = String(stayData?.roomNumber || contract?.roomNumber || "").trim();
  const room = roomRaw.startsWith("Room ") ? roomRaw.replace(/^Room\s+/i, "") : roomRaw;
  const bedRaw = stayData?.bedLabel || contract?.bedLabel;
  const isPrivate =
    String(stayData?.roomType || contract?.roomType || "").toLowerCase().includes("private") ||
    roomRaw.toLowerCase().includes("private") ||
    roomRaw.includes("803") ||
    !bedRaw;

  const durationMonths = Number(stayData?.leaseDurationMonths || contract?.leaseDurationMonths || 12);
  const isShortTerm = durationMonths < 6;
  const termLabel = isShortTerm ? "Short Term" : "Long Term";

  const rawMonthlyRate = Number(stayData?.approvedMonthlyRate ?? contract?.approvedMonthlyRate ?? 0);
  const monthlyRate = rawMonthlyRate > 0 ? rawMonthlyRate : (isPrivate ? 13500 : 5400);
  const discountPercent = Number(
    stayData?.discountPercentage ?? contract?.discountPercentage ?? 0
  );

  const rawAdvanceRent = Number(stayData?.advanceRentAmount ?? contract?.advanceRentAmount ?? 0);
  const advanceRent = rawAdvanceRent > 0 ? rawAdvanceRent : monthlyRate;

  const rawSecurityDeposit = Number(stayData?.securityDepositAmount ?? contract?.securityDepositAmount ?? 0);
  const securityDeposit = rawSecurityDeposit > 0 ? rawSecurityDeposit : monthlyRate;

  const startDate = stayData?.leaseStartDate || contract?.leaseStartDate;
  const endDate = stayData?.leaseEndDate || contract?.leaseEndDate;
  const dateRangeStr = startDate && endDate
    ? `${dayjs(startDate).format("MMM D, YYYY")} – ${dayjs(endDate).format("MMM D, YYYY")}`
    : `${durationMonths} Months`;

  return (
    <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1: Branch & Room */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 cursor-default">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Accommodation
          </span>
          <Building2 size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" strokeWidth={2} />
        </div>
        <div className="mt-2">
          <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            {formattedBranch}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isPrivate
              ? (room && room.toLowerCase().includes("room") ? room : `Room ${room || "GP-803"} • Private Room`)
              : (!room || room === "—"
                  ? "Room Assignment Pending"
                  : (room.toLowerCase().includes("room")
                      ? `${room} • Bed Slot ${bedRaw || "1"}`
                      : `Room ${room} • Bed Slot ${bedRaw || "1"}`))}
          </div>
        </div>
      </div>

      {/* 2: Duration */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 cursor-default">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Lease Period
          </span>
          <Calendar size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" strokeWidth={2} />
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
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 cursor-default">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Monthly Rate
          </span>
          <Coins size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" strokeWidth={2} />
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
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 cursor-default">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Initial Deposits
          </span>
          <ShieldCheck size={16} className="text-purple-600 dark:text-purple-400 flex-shrink-0" strokeWidth={2} />
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
        if (contractRes.status === "fulfilled" && contractRes.value?.contract) {
          setContract(contractRes.value.contract);
        }
        if (stayProofRes.status === "fulfilled" && stayProofRes.value?.stayProof) {
          setStayData(stayProofRes.value.stayProof);
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

  const isNotarized = Boolean(
    contract?.tenantDocument?.type === "final_notarized" &&
    (contract?.finalDocument?.available || contract?.tenantDocument?.isFinal)
  );

  const notice = getTenantContractMessage(
    contract || (stayData ? { status: isNotarized ? "active" : "generated", stayProofAvailable: true } : null),
  );

  return (
    <main className="contracts-page tenant-contract-page">
      {/* Header */}
      <header className="contracts-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Official Lease Contract</h1>
            {isNotarized ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-transparent text-emerald-700 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Notarized Lease Contract
              </span>
            ) : contract ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-transparent text-sky-700 dark:text-sky-300">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Lease Draft — Review Copy
              </span>
            ) : null}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {isNotarized
              ? "Your official notarized lease agreement and tenancy terms with First JRAC Partnership Co."
              : contract
              ? "Review your lease agreement terms, house rules, and accommodation details. Physical signing and notarization will occur upon move-in."
              : "View and manage your official lease agreement once generated."}
          </p>
        </div>
      </header>

      {error && (
        <div className="contracts-error mb-4" role="alert">
          {error}
        </div>
      )}

      {!contract && !stayData ? (
        <div className="contracts-empty rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-xl mx-auto my-8 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-4">
            <FileText size={28} strokeWidth={2} />
          </div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 mb-2">
            {notice.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6 max-w-md">
            {notice.message}
          </p>
          <Link
            to="/tenant/reservation"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs"
          >
            <span>View My Reservation</span>
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
      ) : (
        <>
          {/* Informative Pre-Move-In Draft Notice when not notarized */}
          {!isNotarized && (
            <div className="mb-5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-200">
              <div className="flex items-start gap-3">
                <FileText size={18} className="text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Pre-Move-In Draft Review
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    This prepared copy is provided so you can inspect all lease terms and house rules in advance. Your 1-month advance rent and 1-month security deposit will be settled prior to move-in, after which your agreement will be signed and notarized.
                  </p>
                </div>
              </div>
              <Link
                to="/tenant/reservation"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors flex-shrink-0"
              >
                <span>View My Reservation</span>
                <ArrowRight size={13} strokeWidth={2} />
              </Link>
            </div>
          )}

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
