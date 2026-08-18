import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import {
  ArrowRight,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Coins,
  Download,
  Eye,
  FileText,
  History,
  ShieldCheck,
} from "lucide-react";
import { showNotification } from "../../../shared/utils/notification";
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

function PreviousContractsSection({ history, onPreview, onDownload, actionBusyId }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!history || history.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all duration-200">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
            <History size={18} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Previous Agreements &amp; Renewals</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {history.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Access your previous lease agreements, renewal contracts, and room transfer documents.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span>{isOpen ? "Hide" : "Show"}</span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {isOpen && (
        <div className="p-5 border-t border-slate-200/80 dark:border-slate-800 space-y-3.5 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="grid grid-cols-1 gap-3">
            {history.map((item) => {
              const contractId = item.id || item._id;
              const isBusy = actionBusyId === contractId;
              const startDate = item.leaseStartDate ? dayjs(item.leaseStartDate).format("MMM D, YYYY") : "—";
              const endDate = item.leaseEndDate ? dayjs(item.leaseEndDate).format("MMM D, YYYY") : "—";
              const rate = item.approvedMonthlyRate || item.regularMonthlyRate;
              const isReplacement = item.contractPurpose === "replacement" || item.status === "replaced";
              const isExpired = item.status === "expired" || item.status === "completed";
              const isRenewed = item.status === "renewed";

              const statusBadgeLabel = isReplacement
                ? "Superseded (Transfer)"
                : isRenewed
                ? "Renewed"
                : isExpired
                ? "Term Expired"
                : item.status?.replace(/_/g, " ") || "Archived";

              const statusDotColor = isReplacement
                ? "bg-amber-500"
                : isRenewed
                ? "bg-blue-500"
                : "bg-slate-400";

              return (
                <div
                  key={contractId}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.contractNumber || `CON-${String(contractId).slice(-6).toUpperCase()}`}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-transparent text-slate-700 dark:text-slate-300">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
                        <span className="capitalize">{statusBadgeLabel}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Accommodation</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.branch ? (String(item.branch).includes("gil") ? "Gil Puyat" : "Guadalupe") : "Lilycrest"} · Room {item.roomNumber || "—"} {item.bedLabel ? `(${item.bedLabel})` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Lease Period</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {startDate} – {endDate}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Approved Monthly Rent</span>
                        <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                          {rate ? `₱${Number(rate).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onPreview(item)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                      <Eye size={13} strokeWidth={2} />
                      <span>{isBusy ? "Loading…" : "View PDF"}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onDownload(item)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                      <Download size={13} strokeWidth={2} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default function ContractsPage() {
  const [contract, setContract] = useState(null);
  const [stayData, setStayData] = useState(null);
  const [contractHistory, setContractHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusyId, setActionBusyId] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      tenantContractApi.getMyCurrentContract(),
      tenantContractApi.getMyStayProofData(),
      tenantContractApi.getMyContractHistory(),
    ])
      .then(([contractRes, stayProofRes, historyRes]) => {
        if (!active) return;
        if (contractRes.status === "fulfilled" && contractRes.value?.contract) {
          setContract(contractRes.value.contract);
        }
        if (stayProofRes.status === "fulfilled" && stayProofRes.value?.stayProof) {
          setStayData(stayProofRes.value.stayProof);
        }
        if (historyRes.status === "fulfilled" && Array.isArray(historyRes.value?.contracts)) {
          setContractHistory(historyRes.value.contracts);
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

  const handlePreviewHistoryContract = async (histContract) => {
    const contractId = histContract.id || histContract._id;
    if (!contractId) return;
    setActionBusyId(contractId);
    try {
      let blob;
      try {
        blob = await tenantContractApi.getMyFinalContractFile(contractId, false);
      } catch {
        try {
          blob = await tenantContractApi.getMySignedContractFile(contractId, undefined, false);
        } catch {
          blob = await tenantContractApi.getMyPreparedContractFile(contractId, false);
        }
      }
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      showNotification(err?.message || "Failed to preview historical contract copy.", "error");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDownloadHistoryContract = async (histContract) => {
    const contractId = histContract.id || histContract._id;
    if (!contractId) return;
    setActionBusyId(contractId);
    try {
      let blob;
      try {
        blob = await tenantContractApi.getMyFinalContractFile(contractId, true);
      } catch {
        try {
          blob = await tenantContractApi.getMySignedContractFile(contractId, undefined, true);
        } catch {
          blob = await tenantContractApi.getMyPreparedContractFile(contractId, true);
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Lilycrest-Lease-Contract-${histContract.contractNumber || contractId}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotification("Contract PDF download started.", "success");
    } catch (err) {
      showNotification(err?.message || "Failed to download historical contract copy.", "error");
    } finally {
      setActionBusyId(null);
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

      {/* Previous Agreements & Renewals Section */}
      <PreviousContractsSection
        history={contractHistory}
        onPreview={handlePreviewHistoryContract}
        onDownload={handleDownloadHistoryContract}
        actionBusyId={actionBusyId}
      />
    </main>
  );
}
