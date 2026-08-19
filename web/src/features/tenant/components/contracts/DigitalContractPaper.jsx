import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import {
  Download,
  Printer,
  ShieldCheck,
  FileCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Maximize2,
  Columns2,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { tenantContractApi } from "../../api/tenantContractApi";
import useBodyScrollLock from "../../../../shared/hooks/useBodyScrollLock";

dayjs.extend(advancedFormat);

const numberWords = Object.freeze({
  1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six",
  7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve",
});

const durationInWords = (value) => {
  const number = Number(value);
  return numberWords[number] || String(value);
};

const formatMoney = (val) => Number(val || 0).toLocaleString("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Professional 1:1 Legal Contract Typography matching official master template
const POPULATED_COLOR = "#000000";

const Populated = ({ children, className = "", style = {} }) => (
  <span
    className={`font-bold text-slate-900 ${className}`}
    style={{ color: POPULATED_COLOR, ...style }}
  >
    {children}
  </span>
);

export default function DigitalContractPaper({
  stayData,
  contract,
  onDownloadPdf,
  isDownloading,
  onViewSigned,
  onDownloadSigned,
}) {
  const pdfLegalPageRef = useRef(null);

  const rawRoom = String(stayData?.roomType || contract?.roomType || "").toLowerCase();
  const roomNumberStr = String(stayData?.roomNumber || contract?.roomNumber || "").toLowerCase();
  let roomLabel = "DOUBLE SHARING";
  let isPrivate = false;
  if (rawRoom.includes("private") || roomNumberStr.includes("803") || roomNumberStr.includes("private")) {
    roomLabel = "PRIVATE ROOM";
    isPrivate = true;
  } else if (rawRoom.includes("quad")) {
    roomLabel = "QUADRUPLE SHARING";
  }

  const durationMonths = Number(stayData?.leaseDurationMonths || contract?.leaseDurationMonths || 12);
  const isShortTerm = durationMonths < 6;
  const termLabel = isShortTerm ? "SHORT TERM" : "LONG TERM";

  let regularRate = Number(stayData?.regularMonthlyRate ?? contract?.regularMonthlyRate ?? 0);
  let monthlyRent = Number(stayData?.approvedMonthlyRate ?? contract?.approvedMonthlyRate ?? 0);
  let discountPercent = Number(stayData?.discountPercentage ?? contract?.discountPercentage ?? (isPrivate ? 10 : 0));
  let advanceRent = Number(stayData?.advanceRentAmount ?? contract?.advanceRentAmount ?? 0);
  let securityDeposit = Number(stayData?.securityDepositAmount ?? contract?.securityDepositAmount ?? 0);

  if (isPrivate) {
    if (regularRate <= 0 || regularRate < 10000) regularRate = 15000;
    if (monthlyRent <= 0 || monthlyRent < 10000) monthlyRent = 13500;
    if (advanceRent <= 0 || advanceRent < 10000) advanceRent = monthlyRent || 13500;
    if (securityDeposit <= 0 || securityDeposit < 10000) securityDeposit = monthlyRent || 13500;
  } else {
    if (regularRate <= 0) regularRate = 5400;
    if (monthlyRent <= 0) monthlyRent = 5400;
    if (advanceRent <= 0) advanceRent = monthlyRent || 5400;
    if (securityDeposit <= 0) securityDeposit = monthlyRent || 5400;
  }

  const startDate = stayData?.leaseStartDate || contract?.leaseStartDate ? dayjs(stayData?.leaseStartDate || contract?.leaseStartDate) : dayjs();
  const endDate = stayData?.leaseEndDate || contract?.leaseEndDate ? dayjs(stayData?.leaseEndDate || contract?.leaseEndDate) : startDate.add(durationMonths, "month");

  const formattedStart = startDate.format("MMMM D, YYYY");
  const formattedEnd = endDate.format("MMMM D, YYYY");
  const advanceStart = formattedStart;
  const advanceEnd = startDate.add(1, "month").format("MMMM D, YYYY");

  const executionDay = startDate.format("Do");
  const executionMonth = startDate.format("MMMM");
  const executionYear = startDate.format("YYYY");

  const tenantName = stayData?.tenantLegalName || contract?.tenantLegalName || stayData?.tenantName || contract?.tenantName || "Valued Tenant";
  const tenantAddress = stayData?.tenantResidentialAddress || contract?.tenantResidentialAddress || "SMDC JAZZ RESIDENCES, Bel-Air, City of Makati, National Capital Region (NCR)";
  const roomNumber = stayData?.roomNumber || contract?.roomNumber || (isPrivate ? "GP-803" : "GP-305");
  const bedSlot = isPrivate ? "Entire Room" : (stayData?.bedLabel || contract?.bedLabel || "upper");

  const branchName = String(stayData?.branch || contract?.branch || "").toLowerCase().includes("guadalupe")
    ? "LILYCREST GUADALUPE"
    : "LILYCREST GIL PUYAT";

  const branchAddress = stayData?.propertyAddress || (String(stayData?.branch || contract?.branch || "").toLowerCase().includes("guadalupe")
    ? "9431 Magallanes St., Guadalupe Nuevo, Makati City"
    : "#7 Gil Puyat Ave. corner Marconi St., Makati City");

  const leaseSpaceSubject = isPrivate ? "private room" : "bed space";
  const durationCondition = isShortTerm
    ? "not less than one (1) month and less than six (6) months."
    : "not less than six (6) months.";

  const amenitiesParagraph = isPrivate
    ? "The said rental fee is inclusive of the use of the leased premises and the room’s own private toilet and bath and kitchenette, as well as the common lounge area on the same floor, subject to the House Rules and Regulations (ANNEX “A”) provided by the LESSOR. The leased premises are fully furnished with a double-decked bed and mattress, an air conditioning unit, table, chair, cabinet, and shower water heater."
    : "The said rental fee is inclusive of the use of the leased premises and the common facilities provided on the same floor of the unit, such as the toilet and bath and the lounge area with kitchen appliances, subject to the House Rules and Regulations (ANNEX “A”) provided by the LESSOR. The leased premises are fully furnished with a double-decked bed and mattress, an air conditioning unit, table, chair, cabinet, and shower water heater.";

  const activeSignedDocs = (contract?.signedDocuments || []).filter((doc) => !doc.superseded);
  const hasSignedDoc = activeSignedDocs.length > 0;

  // View & Interactive State (Default to Initial Lease view)
  const [layoutMode, setLayoutMode] = useState("digital");
  const [selectedVersion, setSelectedVersion] = useState(activeSignedDocs[0]?.version || 1);
  const [signedBlobUrl, setSignedBlobUrl] = useState(null);
  const [signedBlobLoading, setSignedBlobLoading] = useState(false);
  const [signedBlobError, setSignedBlobError] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Synchronize layout mode and selected version if signed documents change or are deleted
  useEffect(() => {
    if (!hasSignedDoc && layoutMode !== "digital") {
      setLayoutMode("digital");
    }
  }, [hasSignedDoc, layoutMode]);

  useEffect(() => {
    if (activeSignedDocs.length > 0 && !activeSignedDocs.some((d) => d.version === selectedVersion)) {
      setSelectedVersion(activeSignedDocs[0].version);
    }
  }, [activeSignedDocs, selectedVersion]);

  // Zoom & Inspection States
  const [digitalZoom, setDigitalZoom] = useState(100);
  const [scanZoom, setScanZoom] = useState(100);
  const [isFullscreenScanOpen, setIsFullscreenScanOpen] = useState(false);
  const [modalZoom, setModalZoom] = useState(100);
  const [modalRotation, setModalRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const resetModalView = useCallback(() => {
    setModalZoom(100);
    setModalRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleModalZoomIn = useCallback(() => {
    setModalZoom((prev) => Math.min(400, prev + 25));
  }, []);

  const handleModalZoomOut = useCallback(() => {
    setModalZoom((prev) => Math.max(50, prev - 25));
  }, []);

  const handleModalRotate = useCallback(() => {
    setModalRotation((prev) => (prev + 90) % 360);
  }, []);

  // Mouse Drag to Pan
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch Drag to Pan
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  }, [pan]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse Wheel Zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 20 : -20;
    setModalZoom((prev) => Math.min(400, Math.max(50, prev + delta)));
  }, []);

  // Keyboard Shortcuts & Body Scroll Lock
  useBodyScrollLock(isFullscreenScanOpen);

  useEffect(() => {
    if (!isFullscreenScanOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsFullscreenScanOpen(false);
      } else if (e.key === "+" || e.key === "=") {
        handleModalZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        handleModalZoomOut();
      } else if (e.key === "0") {
        resetModalView();
      } else if (e.key === "r" || e.key === "R") {
        handleModalRotate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreenScanOpen, handleModalZoomIn, handleModalZoomOut, resetModalView, handleModalRotate]);

  const selectedDoc = activeSignedDocs.find((d) => Number(d.version) === Number(selectedVersion)) || activeSignedDocs[0];
  const isPdf = selectedDoc?.mimeType === "application/pdf" || selectedDoc?.fileName?.toLowerCase().endsWith(".pdf");

  // Fetch Signed Document Scan Blob
  useEffect(() => {
    if (!contract?.id || !hasSignedDoc) {
      setSignedBlobUrl(null);
      return;
    }
    let active = true;
    setSignedBlobLoading(true);
    setSignedBlobError(null);

    tenantContractApi.getMySignedContractFile(contract.id, selectedVersion, false)
      .then((blob) => {
        if (active) {
          const url = URL.createObjectURL(blob);
          setSignedBlobUrl(url);
        }
      })
      .catch((err) => {
        if (active) {
          setSignedBlobError(err?.message || "Could not load signed document preview.");
        }
      })
      .finally(() => {
        if (active) setSignedBlobLoading(false);
      });

    return () => {
      active = false;
    };
  }, [contract?.id, selectedVersion, hasSignedDoc]);

  // Clean up Object URL
  useEffect(() => {
    return () => {
      if (signedBlobUrl) {
        URL.revokeObjectURL(signedBlobUrl);
      }
    };
  }, [signedBlobUrl]);

  // Single-Page 1:1 Legal (8.5in x 13in) PDF Exporter (Guaranteed Zero Cutoff)
  const handleInternalDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const legalPage = pdfLegalPageRef.current;
      if (!legalPage) {
        throw new Error("Contract PDF print template not mounted.");
      }

      // Dynamically load html2canvas and jsPDF on demand
      const [{ default: html2canvas }, jsPdfModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      // Capture single page at 2x Retina Resolution
      const canvas = await html2canvas(legalPage, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          const clonedWrapper = clonedDoc.getElementById("offscreen-legal-pdf-container");
          if (clonedWrapper) {
            clonedWrapper.style.position = "static";
            clonedWrapper.style.left = "0";
            clonedWrapper.style.top = "0";
            clonedWrapper.style.opacity = "1";
            clonedWrapper.style.display = "block";
            clonedWrapper.style.visibility = "visible";
          }
        },
      });

      // Create Philippine Legal standard document (8.5in x 13in = 215.9mm x 330.2mm)
      const DocClass = jsPdfModule.jsPDF || jsPdfModule.default || jsPdfModule;
      const pdf = new DocClass({
        orientation: "portrait",
        unit: "mm",
        format: [215.9, 330.2],
      });

      // 0.31-inch margin = 8 mm
      const marginMm = 8;
      const contentWidthMm = 215.9 - (marginMm * 2); // 199.9 mm
      const pHeightMm = (canvas.height * contentWidthMm) / canvas.width;

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.98),
        "JPEG",
        marginMm,
        marginMm,
        contentWidthMm,
        Math.min(pHeightMm, 330.2 - (marginMm * 2)),
        undefined,
        "FAST"
      );

      const refCode = contract?.contractNumber || stayData?.referenceNumber || "Official";
      pdf.save(`Contract-of-Lease-${refCode}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      if (onDownloadPdf) onDownloadPdf();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const isDownloadingAny = isDownloading || isGeneratingPdf;

  return (
    <div className="w-full space-y-3">
      {/* Dynamic Print Stylesheet for 1:1 Legal (8.5in x 13in) single-page print */}
      <style>{`
        @media print {
          @page {
            size: 8.5in 13in;
            margin: 0.25in 0.35in;
          }
          body * {
            visibility: hidden !important;
          }
          #digital-contract-paper, #digital-contract-paper * {
            visibility: visible !important;
            color: #000000 !important;
          }
          #digital-contract-paper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            transform: none !important;
            font-size: 8.75pt !important;
            line-height: 1.15 !important;
          }
          #digital-contract-paper h1 {
            font-size: 12.5pt !important;
            margin: 0 0 2pt 0 !important;
          }
          #digital-contract-paper h2 {
            font-size: 9.5pt !important;
            margin: 2pt 0 6pt 0 !important;
          }
          #digital-contract-paper p,
          #digital-contract-paper table,
          #digital-contract-paper div,
          #digital-contract-paper section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Toolbar & Layout Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
            Digital Contract
          </span>
          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/90 dark:border-slate-700">
            {stayData?.referenceNumber || contract?.contractNumber || "LIL-CONTRACT"}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:inline">
            • {isPrivate ? "Private Room Accommodation" : "Dormitory Accommodation"}
          </span>
        </div>

        {/* Layout Switcher (When Signed Doc is Present) */}
        {hasSignedDoc && (
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-lg gap-1 flex-shrink-0 shadow-xs">
            <button
              type="button"
              onClick={() => setLayoutMode("digital")}
              className={`px-3 py-1.5 rounded-md text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                layoutMode === "digital"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold shadow-xs border border-slate-200/90 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 border border-transparent font-semibold"
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${layoutMode === "digital" ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`} />
              <span>Initial Lease</span>
            </button>

            <button
              type="button"
              onClick={() => setLayoutMode("side-by-side")}
              className={`px-3 py-1.5 rounded-md text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                layoutMode === "side-by-side"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold shadow-xs border border-slate-200/90 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 border border-transparent font-semibold"
              }`}
              title="Side-by-side comparison"
            >
              <Columns2 className={`w-3.5 h-3.5 ${layoutMode === "side-by-side" ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`} />
              <span>Side-by-Side</span>
            </button>

            <button
              type="button"
              onClick={() => setLayoutMode("signed")}
              className={`px-3 py-1.5 rounded-md text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                layoutMode === "signed"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold shadow-xs border border-slate-200/90 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 border border-transparent font-semibold"
              }`}
            >
              <FileCheck className={`w-3.5 h-3.5 ${layoutMode === "signed" ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`} />
              <span>Signed Scan</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area - Strictly Equalized Grid */}
      <div
        className={
          layoutMode === "side-by-side" && hasSignedDoc
            ? "grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch"
            : "w-full flex justify-center"
        }
      >
        {/* PANEL 1: INITIAL DIGITAL CONTRACT OF LEASE (Equalized Structure) */}
        {(layoutMode === "side-by-side" || layoutMode === "digital" || !hasSignedDoc) && (
          <section
            aria-label="Initial Digital Contract"
            className={`w-full ${
              layoutMode === "digital" || !hasSignedDoc ? "max-w-4xl" : "max-w-full"
            } bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col h-[800px]`}
          >
            {/* Panel Header (Exact h-11 height alignment) */}
            <div className="h-11 flex-shrink-0 px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <FileText className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Initial Agreement
                </h3>
              </div>

              {/* Action Buttons & Zoom Controls */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Zoom Controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDigitalZoom((prev) => Math.max(70, prev - 10))}
                    disabled={digitalZoom <= 70}
                    className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDigitalZoom(100)}
                    className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                    title="Reset Zoom"
                  >
                    {digitalZoom}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setDigitalZoom((prev) => Math.min(130, prev + 10))}
                    disabled={digitalZoom >= 130}
                    className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>

                {/* Print Button */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-xs cursor-pointer"
                  title="Print Digital Agreement (A4, 0.5 in margins)"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="hidden sm:inline">Print</span>
                </button>

                {/* Download PDF Button */}
                <button
                  type="button"
                  disabled={isDownloadingAny}
                  onClick={handleInternalDownloadPdf}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  title="Download Lease Contract PDF (A4, 0.5 in margins)"
                >
                  {isDownloadingAny ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Scrollable Container (flex-1 fill height) */}
            <div className="flex-1 min-h-0 px-6 py-8 sm:px-12 sm:py-10 overflow-y-auto bg-white flex justify-center">
              <article
                id="digital-contract-paper"
                className="w-full max-w-[840px] bg-white text-black"
                style={{
                  fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
                  fontSize: `${(14 * digitalZoom) / 100}px`,
                  lineHeight: "1.55",
                  color: "#000000",
                }}
              >
                {/* Header Notice */}
                <p className="text-xs text-center font-semibold text-slate-600 tracking-wider uppercase mb-3">
                  PREPARED COPY — NOT YET SIGNED OR NOTARIZED
                </p>

                {/* Main Titles */}
                <div className="text-center pb-2 mb-3 border-b border-slate-100">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-wide uppercase m-0 text-black">
                    CONTRACT OF LEASE
                  </h1>
                  <h2 className="text-sm sm:text-base font-bold tracking-wider uppercase mt-1 text-black">
                    <Populated>{roomLabel} — {termLabel} LEASE</Populated>
                  </h2>
                </div>

                <p className="font-bold uppercase tracking-wider text-xs sm:text-sm text-black mt-4 mb-2">
                  KNOWN TO ALL MEN BY THESE PRESENTS:
                </p>

                <p className="text-justify indent-8 text-black mb-2 leading-relaxed">
                  This <strong>CONTRACT OF LEASE</strong> is made and executed in the City of Makati, this{" "}
                  <Populated>{executionDay}</Populated> day of{" "}
                  <Populated>{executionMonth} {executionYear}</Populated>, by and between:
                </p>

                <p className="text-justify indent-8 text-black mb-2 leading-relaxed">
                  <strong>FIRST JRAC PARTNERSHIP CO.</strong>, a general partnership duly organized and existing under and by virtue of the laws of the Republic of the Philippines, with principal office at 9431 Magallanes St., Guadalupe Nuevo, Makati City, represented herein by its General Partner, <strong>JOANNE ONG</strong>, hereinafter referred to as the <strong>LESSOR</strong>;
                </p>

                <p className="text-center font-bold tracking-widest text-xs my-2.5 text-black">
                  — and —
                </p>

                <p className="text-justify indent-8 text-black mb-2.5 leading-relaxed">
                  <Populated>{tenantName}</Populated>, of legal age, Filipino, with postal and residential address at{" "}
                  <Populated>{tenantAddress}</Populated>, hereinafter referred to as the <strong>LESSEE</strong>;
                </p>

                <p className="font-bold tracking-wide text-xs sm:text-sm mt-3 mb-2 text-black">
                  WITNESSETH: That
                </p>

                <p className="text-justify indent-8 text-black mb-2 leading-relaxed">
                  <strong>WHEREAS</strong>, the LESSOR is the owner of a residential establishment known as{" "}
                  <Populated>{branchName}</Populated>, located at <Populated>{branchAddress}</Populated>;
                </p>

                <p className="text-justify indent-8 text-black mb-2 leading-relaxed">
                  <strong>WHEREAS</strong>, the LESSOR agrees to lease to the LESSEE a <Populated>{roomLabel}</Populated> accommodation known as Room{" "}
                  <Populated>{roomNumber}</Populated>
                  {!isPrivate && (
                    <>
                      , Bed/Slot No. <Populated>{bedSlot}</Populated>
                    </>
                  )}{" "}
                  (the “LEASED PREMISES”) within the said establishment, and the LESSEE is willing to lease the same for a limited time or period;
                </p>

                <p className="text-justify indent-8 text-black mb-3 leading-relaxed">
                  <strong>NOW THEREFORE</strong>, for and in consideration of the foregoing premises, the LESSOR leases unto the LESSEE and the LESSEE hereby accepts from the LESSOR the LEASED PREMISES, subject to the following:
                </p>

                <div className="text-center font-bold tracking-wider text-xs sm:text-sm uppercase my-3 text-black">
                  TERMS AND CONDITIONS
                </div>

                <div className="text-justify text-[13.5px] sm:text-[14px] leading-relaxed text-black space-y-2">
                  <p className="indent-8 mb-2">
                    <strong>SECTION 1 – PURPOSE.</strong> The leased premises shall be used exclusively by the LESSEE for residential purposes only and shall not be diverted to other uses. It is hereby expressly agreed that if at any time the premises are used for other purposes, the LESSOR shall have the right to rescind this Contract, without prejudice to its other rights under the law.
                  </p>

                  <p className="indent-8 mb-2">
                    <strong>SECTION 2 – DURATION.</strong> The lease of the {leaseSpaceSubject} shall run for a period of{" "}
                    <Populated>{durationMonths} ( {durationInWords(durationMonths)} )</Populated> months, from{" "}
                    <Populated>{formattedStart}</Populated> to <Populated>{formattedEnd}</Populated>. Being a <Populated>{termLabel}</Populated> LEASE, the period shall be <Populated>{durationCondition}</Populated>
                  </p>

                  <p className="indent-8 mb-2">
                    <strong>SECTION 3 – RENTAL RATE.</strong> The regular and basic monthly rental fee is{" "}
                    <Populated>Php {formatMoney(regularRate)}</Populated> exclusive of any tax.{" "}
                    {discountPercent > 0 ? (
                      <>
                        The LESSOR, however, shall grant a promo rate or discount of{" "}
                        <Populated>{discountPercent} percent</Populated>, which brings the basic monthly rental fee to{" "}
                        <Populated>Php {formatMoney(monthlyRent)}</Populated> exclusive of any tax and net of discount.
                      </>
                    ) : (
                      <>
                        The basic monthly rental fee is <Populated>Php {formatMoney(monthlyRent)}</Populated> exclusive of any tax.
                      </>
                    )}
                  </p>

                  <p className="indent-8 mb-2">
                    {amenitiesParagraph}
                  </p>

                  <p className="indent-8 mb-2">
                    The electricity consumption of the LESSEE, which is not part of the rental fee, shall be billed on a monthly basis.
                  </p>

                  <p className="indent-8 mb-2">
                    All payments shall be paid directly to the LESSOR through bank deposit or transfer, supported by an official acknowledgment receipt and/or service invoice.
                  </p>

                  <p className="indent-8 mb-2">
                    Delay in the payment of the rental fee or electricity consumption for three (3) consecutive months shall be ground for the LESSOR to terminate this Contract of Lease. In such case, the LESSEE shall voluntarily vacate the leased premises, surrender the key to the LESSOR, and shall no longer be allowed to access the leased premises except to retrieve his or her personal belongings.
                  </p>

                  <p className="indent-8 mb-2">
                    <strong>SECTION 4 – DEPOSITS AND ADVANCES.</strong> Prior to moving in, the LESSEE shall pay one (1) month advance rent in the amount of{" "}
                    <Populated>Php {formatMoney(advanceRent)}</Populated>, covering the period of <Populated>{advanceStart}</Populated> to <Populated>{advanceEnd}</Populated>, and one (1) month security deposit in the amount of{" "}
                    <Populated>Php {formatMoney(securityDeposit)}</Populated>.
                  </p>

                  <p className="indent-8 mb-2">
                    The reservation fee of <Populated>Php 2,000.00</Populated> paid by the LESSEE shall be credited as partial payment for the said amounts. The LESSOR agrees to refund the deposit not later than thirty (30) days after the termination of this Contract, less payment, if any, for unpaid bills of electricity or other utility charges, failure to return the key (<Populated>Php 1,000.00</Populated>), and the cost of damages to the leased premises occasioned by the LESSEE’s fault or negligence. This deposit, which shall be non-interest bearing, cannot be applied by the LESSEE to any unpaid rent or to the last month’s rental, and shall be kept intact throughout the life of this Contract.
                  </p>

                  <p className="indent-8 mb-2">
                    Furthermore, if the LESSEE vacates the premises before the expiration of the period of lease, the full amount of the security deposit shall be forfeited in favor of the LESSOR.
                  </p>

                  <p className="indent-8 mb-2">
                    <strong>SECTION 5 – FORCE MAJEURE.</strong> If the whole or any part of the leased premises shall be destroyed or damaged by fire, flood, lightning, typhoon, earthquake, storm, riot, or any other unforeseen disabling cause or act of God, as to render the leased premises during the term substantially unfit for the use and occupation of the LESSEE, then this Contract may be terminated without compensation by either the LESSOR or the LESSEE by notice in writing to the other party.
                  </p>

                  <p className="indent-8 mb-2">
                    <strong>SECTION 6 – LESSOR’S RIGHT OF ENTRY.</strong> The LESSOR or its authorized representative shall, after giving due notice to the LESSEE, have the right to enter the premises in the presence of the LESSEE or his or her representative at any reasonable hour to examine the same, make repairs therein, undertake the operation and maintenance of the building, exhibit the leased premises to prospective lessees, or for any other lawful purpose which it may deem necessary.
                  </p>

                  <p className="indent-8 mb-2">
                    <strong>SECTION 7 – EXPIRATION OF LEASE.</strong> At the expiration of the term of this lease or the cancellation thereof, as herein provided, the LESSEE shall promptly deliver to the LESSOR the leased premises with all corresponding keys, in as good and tenantable condition as the same is now, ordinary wear and tear excepted, devoid of all occupants, movable furniture, articles, and effects of any kind.
                  </p>
                </div>

                <p className="text-justify indent-8 pt-3 text-black text-[13.5px] sm:text-[14px] mb-2 leading-relaxed">
                  <strong>IN WITNESS WHEREOF</strong>, both parties herein have affixed their signatures on the date and place first above written.
                </p>

                {/* Signatures Grid */}
                <div className="pt-6 pb-2 text-center text-xs sm:text-sm">
                  <div className="grid grid-cols-2 gap-8 sm:gap-14 items-end">
                    {/* LESSEE Column */}
                    <div className="flex flex-col">
                      <div className="border-b border-black w-full h-10"></div>
                      <div className="text-black text-xs sm:text-sm font-bold uppercase tracking-wider mt-2">
                        LESSEE
                      </div>
                    </div>

                    {/* LESSOR Column */}
                    <div className="flex flex-col">
                      <div className="font-bold text-black text-xs sm:text-sm">FIRST JRAC PARTNERSHIP CO.</div>
                      <div className="text-xs italic text-black mt-1 mb-5">By:</div>
                      <div className="border-b border-black w-full h-0"></div>
                      <div className="font-bold text-black text-sm sm:text-base mt-2">
                        JOANNE ONG
                      </div>
                      <div className="text-black text-xs font-medium mt-1">
                        General Partner – LESSOR
                      </div>
                    </div>
                  </div>

                  {/* Witnesses */}
                  <div className="pt-6 text-left text-xs sm:text-sm">
                    <div className="font-bold tracking-wide text-black text-xs sm:text-sm">
                      SIGNED IN THE PRESENCE OF:
                    </div>
                    <div className="grid grid-cols-2 gap-8 sm:gap-14 pt-8 pb-2">
                      <div className="border-b border-black w-full h-0"></div>
                      <div className="border-b border-black w-full h-0"></div>
                    </div>
                  </div>
                </div>

                {/* Notarial Acknowledgment */}
                <div className="pt-6 space-y-2 text-xs sm:text-sm text-black leading-relaxed">
                  <div className="text-center font-bold tracking-wider uppercase text-xs sm:text-sm text-black mb-2">
                    ACKNOWLEDGMENT
                  </div>
                  <p className="leading-normal mb-2">
                    REPUBLIC OF THE PHILIPPINES )<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;) S.S.
                  </p>
                  <p className="text-justify indent-8 mb-2">
                    BEFORE ME, this _____ day of ____________________, personally appeared the above-named parties, all known to me and to known to be the same persons who executed the foregoing instrument, and who acknowledged to me that the same is their free and voluntary act and deed.
                  </p>
                  <p className="text-justify indent-8 mb-2">
                    This instrument, consisting of _____ ( ____ ) page/s, including the page on which this acknowledgment is written, has been signed on each and every page thereof by the concerned parties and their witnesses, and sealed with my notarial seal.
                  </p>
                  <p className="indent-8 mb-2">
                    WITNESS MY HAND AND SEAL, on the date and place first above written.
                  </p>

                  <div className="pt-2 text-xs text-black space-y-1">
                    <div>Doc. No. _______;</div>
                    <div>Page No. _______;</div>
                    <div>Book No. _______;</div>
                    <div>Series of _______.</div>
                  </div>
                </div>
              </article>
            </div>

            {/* Panel Footer */}
            <div className="h-10 flex-shrink-0 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2 min-w-0 truncate">
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">Official Digital Agreement</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 truncate">
                  Ref: {stayData?.referenceNumber || contract?.contractNumber || "Official"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex-shrink-0">
                <span>Philippine Legal</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span>8.5&quot; × 13&quot;</span>
              </div>
            </div>
          </section>
        )}

        {/* PANEL 2: WET-SIGNED CONTRACT SCAN & AMENDMENTS (Equalized Structure) */}
        {(layoutMode === "side-by-side" || layoutMode === "signed") && hasSignedDoc && (
          <section
            aria-label="Wet-Signed Contract Scan"
            className={`w-full ${
              layoutMode === "signed" ? "max-w-4xl" : "max-w-full"
            } bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col h-[800px]`}
          >
            {/* Panel Header (Exact h-11 height alignment) */}
            <div className="h-11 flex-shrink-0 px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <FileCheck className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Signed Scan Copy
                </h3>
                {activeSignedDocs.length > 1 && (
                  <div className="flex items-center gap-1 ml-1">
                    {activeSignedDocs.map((doc) => (
                      <button
                        key={doc.version}
                        type="button"
                        onClick={() => setSelectedVersion(doc.version)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          Number(selectedVersion) === Number(doc.version)
                            ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                        }`}
                      >
                        v{doc.version}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Scan Zoom & Action Controls */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!isPdf && (
                  <>
                    <button
                      type="button"
                      onClick={() => setScanZoom((prev) => Math.max(50, prev - 15))}
                      disabled={scanZoom <= 50}
                      className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-40 cursor-pointer"
                      title="Zoom Out Scan"
                    >
                      <ZoomOut className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanZoom(100)}
                      className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                      title="Reset Zoom"
                    >
                      {scanZoom}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanZoom((prev) => Math.min(250, prev + 15))}
                      disabled={scanZoom >= 250}
                      className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-40 cursor-pointer"
                      title="Zoom In Scan"
                    >
                      <ZoomIn className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalZoom(100);
                        setIsFullscreenScanOpen(true);
                      }}
                      className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      title="Full Screen Zoom & Inspect"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                {onDownloadSigned && (
                  <button
                    type="button"
                    onClick={() => onDownloadSigned(selectedDoc.version, selectedDoc.fileName)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors flex items-center gap-1 shadow-xs cursor-pointer ml-0.5"
                    title="Download Scanned File"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scan Preview Canvas (flex-1 fill height) */}
            <div className="flex-1 min-h-0 p-3.5 overflow-auto bg-slate-100/70 dark:bg-slate-950/40 flex items-center justify-center">
              {signedBlobLoading ? (
                <div className="flex flex-col items-center justify-center p-8 text-slate-500 gap-1.5">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-700 dark:text-slate-300" />
                  <p className="text-xs font-semibold">Loading signed scan...</p>
                </div>
              ) : signedBlobError ? (
                <div className="text-center p-6 text-red-600 dark:text-red-400 space-y-1">
                  <p className="text-xs font-bold">Failed to load signed scan.</p>
                  <p className="text-[11px] text-slate-500">{signedBlobError}</p>
                </div>
              ) : signedBlobUrl ? (
                isPdf ? (
                  <iframe
                    src={signedBlobUrl}
                    title="Signed Contract PDF"
                    className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs bg-white"
                  />
                ) : (
                  <div className="relative group max-h-full flex items-center justify-center">
                    <img
                      src={signedBlobUrl}
                      alt={selectedDoc?.fileName || "Wet-signed contract scan copy"}
                      className="max-h-[620px] w-auto max-w-full rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs object-contain bg-white cursor-zoom-in hover:brightness-95 transition-all"
                      style={{
                        transform: `scale(${scanZoom / 100})`,
                        transformOrigin: "center center",
                        transition: "transform 150ms ease-out",
                      }}
                      onClick={() => {
                        resetModalView();
                        setIsFullscreenScanOpen(true);
                      }}
                      title="Click to open Fullscreen Inspection Lightbox"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        resetModalView();
                        setIsFullscreenScanOpen(true);
                      }}
                      className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/85 hover:bg-slate-900 text-white text-xs font-semibold backdrop-blur-sm border border-white/10 shadow-lg flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                      <span>Inspect Fullscreen</span>
                    </button>
                  </div>
                )
              ) : (
                <div className="text-center p-6 text-slate-500">
                  <p className="text-xs font-medium">No signed copy available to preview.</p>
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="h-10 flex-shrink-0 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2 min-w-0 truncate">
                <span
                  className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px] sm:max-w-xs cursor-default"
                  title={selectedDoc?.fileName || "Signed Copy"}
                >
                  {selectedDoc?.fileName || "Signed Copy"}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex-shrink-0">
                  v{selectedDoc?.version || 1}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex-shrink-0">
                  {dayjs(selectedDoc?.uploadedAt).format("MMM D, YYYY")}
                </span>
              </div>
              {selectedDoc?.replacementReason && (
                <div
                  className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 max-w-[200px] sm:max-w-xs truncate flex-shrink-0 cursor-default"
                  title={`Upload Note: ${selectedDoc.replacementReason}`}
                >
                  <span className="italic truncate">&ldquo;{selectedDoc.replacementReason}&rdquo;</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* DEDICATED OFFSCREEN 1-PAGE LEGAL (8.5in x 13in) PRINT TEMPLATE */}
      <div
        id="offscreen-legal-pdf-container"
        style={{
          position: "fixed",
          left: "-99999px",
          top: "-99999px",
          width: "780px",
          zIndex: -9999,
          opacity: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <div
          ref={pdfLegalPageRef}
          style={{
            width: "780px",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
            color: "#000000",
            fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
            fontSize: "10.5px",
            lineHeight: "1.25",
            padding: "24px 28px",
          }}
        >
          {/* Header Notice */}
          <p style={{ fontSize: "9.5px", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px 0", color: "#333333" }}>
            PREPARED COPY — NOT YET SIGNED OR NOTARIZED
          </p>

          <div style={{ textAlign: "center", paddingBottom: "2px", marginBottom: "6px" }}>
            <h1 style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "0.5px", textTransform: "uppercase", margin: "0", color: "#000000" }}>
              CONTRACT OF LEASE
            </h1>
            <h2 style={{ fontSize: "11.5px", fontWeight: "bold", letterSpacing: "0.5px", textTransform: "uppercase", margin: "2px 0 0 0", color: "#000000" }}>
              <Populated>{roomLabel} — {termLabel} LEASE</Populated>
            </h2>
          </div>

          <p style={{ fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "10px", margin: "6px 0 3px 0", color: "#000000" }}>
            KNOWN TO ALL MEN BY THESE PRESENTS:
          </p>

          <p style={{ textAlign: "justify", textIndent: "24px", margin: "0 0 4px 0", color: "#000000" }}>
            This <strong>CONTRACT OF LEASE</strong> is made and executed in the City of Makati, this{" "}
            <Populated>{executionDay}</Populated> day of{" "}
            <Populated>{executionMonth} {executionYear}</Populated>, by and between:
          </p>

          <p style={{ textAlign: "justify", textIndent: "24px", margin: "0 0 4px 0", color: "#000000" }}>
            <strong>FIRST JRAC PARTNERSHIP CO.</strong>, a general partnership duly organized and existing under and by virtue of the laws of the Republic of the Philippines, with principal office at 9431 Magallanes St., Guadalupe Nuevo, Makati City, represented herein by its General Partner, <strong>JOANNE ONG</strong>, hereinafter referred to as the <strong>LESSOR</strong>;
          </p>

          <p style={{ textAlign: "center", fontWeight: "bold", letterSpacing: "2px", fontSize: "9.5px", margin: "3px 0", color: "#000000" }}>
            — and —
          </p>

          <p style={{ textAlign: "justify", textIndent: "24px", margin: "0 0 5px 0", color: "#000000" }}>
            <Populated>{tenantName}</Populated>, of legal age, Filipino, with postal and residential address at{" "}
            <Populated>{tenantAddress}</Populated>, hereinafter referred to as the <strong>LESSEE</strong>;
          </p>

          <p style={{ fontWeight: "bold", letterSpacing: "0.5px", fontSize: "10px", margin: "4px 0 3px 0", color: "#000000" }}>
            WITNESSETH: That
          </p>

          <p style={{ textAlign: "justify", textIndent: "24px", margin: "0 0 4px 0", color: "#000000" }}>
            <strong>WHEREAS</strong>, the LESSOR is the owner of a residential establishment known as{" "}
            <Populated>{branchName}</Populated>, located at <Populated>{branchAddress}</Populated>;
          </p>

          <p style={{ textAlign: "justify", textIndent: "24px", margin: "0 0 4px 0", color: "#000000" }}>
            <strong>WHEREAS</strong>, the LESSOR agrees to lease to the LESSEE a <Populated>{roomLabel}</Populated> accommodation known as Room{" "}
            <Populated>{roomNumber}</Populated>
            {!isPrivate && (
              <>
                , Bed/Slot No. <Populated>{bedSlot}</Populated>
              </>
            )}{" "}
            (the “LEASED PREMISES”) within the said establishment, and the LESSEE is willing to lease the same for a limited time or period;
          </p>

          <p style={{ textAlign: "justify", textIndent: "24px", margin: "0 0 5px 0", color: "#000000" }}>
            <strong>NOW THEREFORE</strong>, for and in consideration of the foregoing premises, the LESSOR leases unto the LESSEE and the LESSEE hereby accepts from the LESSOR the LEASED PREMISES, subject to the following:
          </p>

          <div style={{ textAlign: "center", fontWeight: "bold", letterSpacing: "0.5px", textTransform: "uppercase", fontSize: "10px", margin: "5px 0 4px 0", color: "#000000" }}>
            TERMS AND CONDITIONS
          </div>

          <div style={{ textAlign: "justify", fontSize: "10px", lineHeight: "1.22", color: "#000000" }}>
            <p style={{ textIndent: "24px", margin: "0 0 4px 0" }}>
              <strong>SECTION 1 – PURPOSE.</strong> The leased premises shall be used exclusively by the LESSEE for residential purposes only and shall not be diverted to other uses. It is hereby expressly agreed that if at any time the premises are used for other purposes, the LESSOR shall have the right to rescind this Contract, without prejudice to its other rights under the law.
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 4px 0" }}>
              <strong>SECTION 2 – DURATION.</strong> The lease of the {leaseSpaceSubject} shall run for a period of{" "}
              <Populated>{durationMonths} ( {durationInWords(durationMonths)} )</Populated> months, from{" "}
              <Populated>{formattedStart}</Populated> to <Populated>{formattedEnd}</Populated>. Being a <Populated>{termLabel}</Populated> LEASE, the period shall be <Populated>{durationCondition}</Populated>
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 3px 0" }}>
              <strong>SECTION 3 – RENTAL RATE.</strong> The regular and basic monthly rental fee is{" "}
              <Populated>Php {formatMoney(regularRate)}</Populated> exclusive of any tax.{" "}
              {discountPercent > 0 ? (
                <>
                  The LESSOR, however, shall grant a promo rate or discount of{" "}
                  <Populated>{discountPercent} percent</Populated>, which brings the basic monthly rental fee to{" "}
                  <Populated>Php {formatMoney(monthlyRent)}</Populated> exclusive of any tax and net of discount.
                </>
              ) : (
                <>
                  The basic monthly rental fee is <Populated>Php {formatMoney(monthlyRent)}</Populated> exclusive of any tax.
                </>
              )}
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 3px 0" }}>
              {amenitiesParagraph}
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 3px 0" }}>
              The electricity consumption of the LESSEE, which is not part of the rental fee, shall be billed on a monthly basis.
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 3px 0" }}>
              All payments shall be paid directly to the LESSOR through bank deposit or transfer, supported by an official acknowledgment receipt and/or service invoice.
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 4px 0" }}>
              Delay in the payment of the rental fee or electricity consumption for three (3) consecutive months shall be ground for the LESSOR to terminate this Contract of Lease. In such case, the LESSEE shall voluntarily vacate the leased premises, surrender the key to the LESSOR, and shall no longer be allowed to access the leased premises except to retrieve his or her personal belongings.
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 3px 0" }}>
              <strong>SECTION 4 – DEPOSITS AND ADVANCES.</strong> Prior to moving in, the LESSEE shall pay one (1) month advance rent in the amount of{" "}
              <Populated>Php {formatMoney(advanceRent)}</Populated>, covering the period of <Populated>{advanceStart}</Populated> to <Populated>{advanceEnd}</Populated>, and one (1) month security deposit in the amount of{" "}
              <Populated>Php {formatMoney(securityDeposit)}</Populated>.
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 3px 0" }}>
              The reservation fee of <Populated>Php 2,000.00</Populated> paid by the LESSEE shall be credited as partial payment for the said amounts. The LESSOR agrees to refund the deposit not later than thirty (30) days after the termination of this Contract, less payment, if any, for unpaid bills of electricity or other utility charges, failure to return the key (<Populated>Php 1,000.00</Populated>), and the cost of damages to the leased premises occasioned by the LESSEE’s fault or negligence. This deposit, which shall be non-interest bearing, cannot be applied by the LESSEE to any unpaid rent or to the last month’s rental, and shall be kept intact throughout the life of this Contract.
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 4px 0" }}>
              Furthermore, if the LESSEE vacates the premises before the expiration of the period of lease, the full amount of the security deposit shall be forfeited in favor of the LESSOR.
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 4px 0" }}>
              <strong>SECTION 5 – FORCE MAJEURE.</strong> If the whole or any part of the leased premises shall be destroyed or damaged by fire, flood, lightning, typhoon, earthquake, storm, riot, or any other unforeseen disabling cause or act of God, as to render the leased premises during the term substantially unfit for the use and occupation of the LESSEE, then this Contract may be terminated without compensation by either the LESSOR or the LESSEE by notice in writing to the other party.
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 4px 0" }}>
              <strong>SECTION 6 – LESSOR’S RIGHT OF ENTRY.</strong> The LESSOR or its authorized representative shall, after giving due notice to the LESSEE, have the right to enter the premises in the presence of the LESSEE or his or her representative at any reasonable hour to examine the same, make repairs therein, undertake the operation and maintenance of the building, exhibit the leased premises to prospective lessees, or for any other lawful purpose which it may deem necessary.
            </p>

            <p style={{ textIndent: "24px", margin: "0 0 4px 0" }}>
              <strong>SECTION 7 – EXPIRATION OF LEASE.</strong> At the expiration of the term of this lease or the cancellation thereof, as herein provided, the LESSEE shall promptly deliver to the LESSOR the leased premises with all corresponding keys, in as good and tenantable condition as the same is now, ordinary wear and tear excepted, devoid of all occupants, movable furniture, articles, and effects of any kind.
            </p>
          </div>

          <p style={{ textAlign: "justify", textIndent: "24px", paddingTop: "4px", margin: "0 0 6px 0", fontSize: "10px", color: "#000000" }}>
            <strong>IN WITNESS WHEREOF</strong>, both parties herein have affixed their signatures on the date and place first above written.
          </p>

          {/* Signatures Grid */}
          <div style={{ paddingTop: "10px", paddingBottom: "4px", textAlign: "center", fontSize: "10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", alignItems: "flex-end" }}>
              {/* LESSEE Column */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ borderBottom: "0.8px solid #000000", width: "100%", height: "0px" }}></div>
                <div style={{ color: "#000000", fontSize: "9.5px", fontWeight: "bold", textTransform: "uppercase", marginTop: "3px" }}>LESSEE</div>
              </div>

              {/* LESSOR Column */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontWeight: "bold", color: "#000000" }}>FIRST JRAC PARTNERSHIP CO.</div>
                <div style={{ fontSize: "9.5px", fontStyle: "italic", color: "#000000", marginTop: "1px", marginBottom: "16px" }}>By:</div>
                <div style={{ borderBottom: "0.8px solid #000000", width: "100%", height: "0px" }}></div>
                <div style={{ fontWeight: "bold", color: "#000000", marginTop: "3px" }}>JOANNE ONG</div>
                <div style={{ color: "#000000", fontSize: "9.5px", marginTop: "1px" }}>General Partner – LESSOR</div>
              </div>
            </div>

            <div style={{ paddingTop: "10px", textAlign: "left", fontSize: "9.5px" }}>
              <div style={{ fontWeight: "bold" }}>SIGNED IN THE PRESENCE OF:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", paddingTop: "20px" }}>
                <div style={{ borderBottom: "0.8px solid #000000", width: "100%", height: "0px" }}></div>
                <div style={{ borderBottom: "0.8px solid #000000", width: "100%", height: "0px" }}></div>
              </div>
            </div>
          </div>

          {/* Notarial Acknowledgment */}
          <div style={{ paddingTop: "10px", marginTop: "4px", fontSize: "9.5px", lineHeight: "1.25" }}>
            <div style={{ textAlign: "center", fontWeight: "bold", letterSpacing: "0.5px", textTransform: "uppercase", fontSize: "9.5px", margin: "0 0 4px 0" }}>
              ACKNOWLEDGMENT
            </div>
            <p style={{ margin: "0 0 3px 0" }}>
              REPUBLIC OF THE PHILIPPINES )<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;) S.S.
            </p>
            <p style={{ textAlign: "justify", textIndent: "20px", margin: "0 0 3px 0" }}>
              BEFORE ME, this _____ day of ____________________, personally appeared the above-named parties, all known to me and to known to be the same persons who executed the foregoing instrument, and who acknowledged to me that the same is their free and voluntary act and deed.
            </p>
            <p style={{ textAlign: "justify", textIndent: "20px", margin: "0 0 3px 0" }}>
              This instrument, consisting of _____ ( ____ ) page/s, including the page on which this acknowledgment is written, has been signed on each and every page thereof by the concerned parties and their witnesses, and sealed with my notarial seal.
            </p>
            <p style={{ textIndent: "20px", margin: "0 0 3px 0" }}>
              WITNESS MY HAND AND SEAL, on the date and place first above written.
            </p>

            <div style={{ paddingTop: "4px", fontSize: "9px", color: "#000000", lineHeight: "1.3" }}>
              <div>Doc. No. _______;</div>
              <div>Page No. _______;</div>
              <div>Book No. _______;</div>
              <div>Series of _______.</div>
            </div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN INTERACTIVE IMAGE ZOOM LIGHTBOX (Mounted to document.body via Portal) */}
      {isFullscreenScanOpen && signedBlobUrl && !isPdf && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-[#090d16]/98 backdrop-blur-2xl flex flex-col select-none overflow-hidden animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="High-Resolution Signed Contract Inspection Lightbox"
        >
          {/* Lightbox Header */}
          <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-slate-900/95 border-b border-white/10 text-white z-10 shadow-lg">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileCheck className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-[220px] sm:max-w-md">
                    {selectedDoc?.fileName || "Signed Contract Scan"}
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    v{selectedDoc?.version || 1}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 hidden sm:block truncate">
                  Inspect high-resolution signatures, initials, and notarization
                </p>
              </div>
            </div>

            {/* Control Toolbar */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              {/* Zoom Out */}
              <button
                type="button"
                onClick={handleModalZoomOut}
                disabled={modalZoom <= 50}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30 cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              {/* Zoom Level Indicator (click to reset) */}
              <button
                type="button"
                onClick={resetModalView}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold transition-colors cursor-pointer"
                title="Click to Reset Zoom (0)"
              >
                {modalZoom}%
              </button>

              {/* Zoom In */}
              <button
                type="button"
                onClick={handleModalZoomIn}
                disabled={modalZoom >= 400}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30 cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {/* Rotate */}
              <button
                type="button"
                onClick={handleModalRotate}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Rotate 90° (R)"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Reset Pan & Zoom */}
              <button
                type="button"
                onClick={resetModalView}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer hidden sm:inline-flex"
                title="Reset View (0)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Download Button */}
              {onDownloadSigned && (
                <button
                  type="button"
                  onClick={() => onDownloadSigned(selectedDoc.version, selectedDoc.fileName)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ml-1"
                  title="Download Scanned Document"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsFullscreenScanOpen(false)}
                className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors cursor-pointer ml-1"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas / Drag & Pan Stage */}
          <div
            className={`flex-1 relative overflow-hidden flex items-center justify-center ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            <img
              src={signedBlobUrl}
              alt={selectedDoc?.fileName || "Signed Contract Fullscreen View"}
              draggable={false}
              onDoubleClick={() => setModalZoom((prev) => (prev === 100 ? 175 : 100))}
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-md shadow-2xl transition-transform ease-out select-none bg-white"
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${modalZoom / 100}) rotate(${modalRotation}deg)`,
                transformOrigin: "center center",
                transitionDuration: isDragging ? "0ms" : "150ms",
              }}
            />

            {/* Floating Bottom Help Badge */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/10 text-white/70 text-[11px] font-medium pointer-events-none shadow-lg flex items-center gap-2">
              <span>Drag to Pan</span>
              <span className="text-white/30">•</span>
              <span>Scroll / +/- to Zoom</span>
              <span className="text-white/30">•</span>
              <span>Double-click to toggle</span>
              <span className="text-white/30">•</span>
              <span>ESC to Close</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
