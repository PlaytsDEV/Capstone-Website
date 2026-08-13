import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
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

// Professional Deep Royal Blue highlight color matching the website
const POPULATED_COLOR = "#1d4ed8";

const Populated = ({ children, className = "" }) => (
  <span
    className={`font-bold ${className}`}
    style={{ color: POPULATED_COLOR }}
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
  const pdfPage1Ref = useRef(null);
  const pdfPage2Ref = useRef(null);

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

  const tenantName = stayData?.tenantLegalName || contract?.tenantLegalName || stayData?.tenantName || contract?.tenantName || "Resident Tenant";
  const tenantAddress = stayData?.tenantResidentialAddress || contract?.tenantResidentialAddress || "Metro Manila, Philippines";
  const roomNumber = stayData?.roomNumber || contract?.roomNumber || (isPrivate ? "GP-803" : "101");
  const bedSlot = isPrivate ? "Entire Room" : (stayData?.bedLabel || contract?.bedLabel || "1");

  const branchName = String(stayData?.branch || contract?.branch || "").toLowerCase().includes("guadalupe")
    ? "LILYCREST GUADALUPE"
    : "LILYCREST GIL-PUYAT";

  const branchAddress = stayData?.propertyAddress || (String(stayData?.branch || contract?.branch || "").toLowerCase().includes("guadalupe")
    ? "#9431 Magallanes St., Guadalupe Nuevo, Makati City"
    : "Lilycrest Dormitory Residence, Metro Manila");

  const leaseSpaceSubject = isPrivate ? "private room" : "bed space";
  const durationCondition = isShortTerm
    ? "not less than one (1) month and less than six (6) months."
    : "not less than six (6) months.";

  const amenitiesParagraph = isPrivate
    ? "The said rental fee is inclusive of the use of the leased premises and the room’s own private toilet and bath and kitchenette, as well as the common lounge area on the same floor, subject to the House Rules and Regulations (ANNEX “A”) provided by the LESSOR. The leased premises are fully furnished with a double-decked bed and mattress, an air conditioning unit, table, chair, cabinet, and shower water heater."
    : "The said rental fee is inclusive of the use of the leased premises and the common facilities provided on the same floor of the unit, such as the toilet and bath and the lounge area with kitchen appliances, subject to the House Rules and Regulations (ANNEX “A”) provided by the LESSOR. The leased premises are fully furnished with a double-decked bed and mattress, an air conditioning unit, table, chair, cabinet, and shower water heater.";

  const activeSignedDocs = (contract?.signedDocuments || []).filter((doc) => !doc.superseded);
  const hasSignedDoc = activeSignedDocs.length > 0;

  // View & Interactive State
  const [layoutMode, setLayoutMode] = useState(hasSignedDoc ? "side-by-side" : "digital");
  const [selectedVersion, setSelectedVersion] = useState(activeSignedDocs[0]?.version || 1);
  const [signedBlobUrl, setSignedBlobUrl] = useState(null);
  const [signedBlobLoading, setSignedBlobLoading] = useState(false);
  const [signedBlobError, setSignedBlobError] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isFullscreenScanOpen, handleModalZoomIn, handleModalZoomOut, resetModalView, handleModalRotate]);

  const selectedDoc = activeSignedDocs.find((d) => Number(d.version) === Number(selectedVersion)) || activeSignedDocs[0];

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

  const isPdf = selectedDoc?.mimeType === "application/pdf" || selectedDoc?.fileName?.toLowerCase().endsWith(".pdf");

  // Multi-Page 0.5-inch Margin A4 PDF Exporter (Guaranteed Content & Zero Line-Cutting)
  const handleInternalDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const page1 = pdfPage1Ref.current;
      const page2 = pdfPage2Ref.current;
      if (!page1 || !page2) {
        throw new Error("Contract PDF print template not mounted.");
      }

      // Capture Page 1 at 2x Retina Resolution
      const canvas1 = await html2canvas(page1, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      // Capture Page 2 at 2x Retina Resolution
      const canvas2 = await html2canvas(page2, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      // Create standard A4 document (210mm x 297mm)
      const DocClass = jsPDF.jsPDF || jsPDF;
      const pdf = new DocClass({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // 0.5-inch margin = 12.7 mm
      const marginMm = 12.7;
      const contentWidthMm = 210 - (marginMm * 2); // 184.6 mm

      // Add Page 1
      const p1HeightMm = (canvas1.height * contentWidthMm) / canvas1.width;
      pdf.addImage(canvas1.toDataURL("image/jpeg", 0.98), "JPEG", marginMm, marginMm, contentWidthMm, p1HeightMm, undefined, "FAST");

      // Add Page 2
      pdf.addPage();
      const p2HeightMm = (canvas2.height * contentWidthMm) / canvas2.width;
      pdf.addImage(canvas2.toDataURL("image/jpeg", 0.98), "JPEG", marginMm, marginMm, contentWidthMm, p2HeightMm, undefined, "FAST");

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
      {/* Dynamic Print Stylesheet for 0.5in margin and clean page breaks */}
      <style>{`
        @media print {
          @page {
            size: 8.5in 13in;
            margin: 0.35in 0.45in;
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
            font-size: 9.5pt !important;
            line-height: 1.25 !important;
          }
          #digital-contract-paper h1 {
            font-size: 13pt !important;
            margin: 0 0 2pt 0 !important;
          }
          #digital-contract-paper h2 {
            font-size: 10.5pt !important;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Digital Contract
          </span>
          <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {stayData?.referenceNumber || contract?.contractNumber || "LIL-CONTRACT"}
          </span>
          <span className="text-xs text-muted-foreground font-medium hidden md:inline">
            • {isPrivate ? "Private Room Accommodation" : "Dormitory Accommodation"}
          </span>
        </div>

        {/* Layout Switcher (When Signed Doc is Present) */}
        {hasSignedDoc && (
          <div className="inline-flex p-0.5 bg-muted/60 border border-border/80 rounded-lg gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setLayoutMode("side-by-side")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                layoutMode === "side-by-side"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Side-by-side comparison"
            >
              <Columns2 className="w-3.5 h-3.5 text-primary" />
              <span>Side-by-Side</span>
            </button>

            <button
              type="button"
              onClick={() => setLayoutMode("digital")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                layoutMode === "digital"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>Initial Lease</span>
            </button>

            <button
              type="button"
              onClick={() => setLayoutMode("signed")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                layoutMode === "signed"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-primary" />
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
              layoutMode === "digital" || !hasSignedDoc ? "max-w-3xl" : "max-w-full"
            } bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col h-[740px]`}
          >
            {/* Panel Header (Exact h-11 height alignment) */}
            <div className="h-11 flex-shrink-0 px-3.5 py-2 bg-muted/40 border-b border-border/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
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
                    className="p-1 rounded border border-border bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDigitalZoom(100)}
                    className="px-1.5 py-0.5 rounded border border-border bg-card hover:bg-muted text-[10px] font-mono font-semibold text-foreground transition-colors cursor-pointer"
                    title="Reset Zoom"
                  >
                    {digitalZoom}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setDigitalZoom((prev) => Math.min(130, prev + 10))}
                    disabled={digitalZoom >= 130}
                    className="p-1 rounded border border-border bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>

                {/* Print Button */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-xs cursor-pointer"
                  title="Print Digital Agreement (A4, 0.5 in margins)"
                >
                  <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Print</span>
                </button>

                {/* Download PDF Button */}
                <button
                  type="button"
                  disabled={isDownloadingAny}
                  onClick={handleInternalDownloadPdf}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  title="Download Lease Contract PDF (A4, 0.5 in margins)"
                >
                  {isDownloadingAny ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Scrollable Container (flex-1 fill height) */}
            <div className="flex-1 min-h-0 p-3.5 overflow-y-auto bg-muted/10 flex justify-center">
              <article
                id="digital-contract-paper"
                className="w-full bg-white text-black p-6 sm:p-8 rounded-lg border border-border/80 shadow-xs space-y-3.5 transition-transform duration-150"
                style={{
                  fontFamily: '"Times New Roman", Times, serif',
                  fontSize: "11.5px",
                  lineHeight: "1.4",
                  color: "#0f172a",
                  transform: `scale(${digitalZoom / 100})`,
                  transformOrigin: "top center",
                  marginBottom: digitalZoom > 100 ? `${(digitalZoom - 100) * 6}px` : "0px",
                }}
              >
                <div className="text-center pb-1">
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-0.5">
                    OFFICIAL DIGITAL AGREEMENT COPY
                  </p>
                  <h1 className="text-sm sm:text-base font-bold tracking-wide uppercase m-0">
                    CONTRACT OF LEASE
                  </h1>
                  <h2 className="text-[11px] sm:text-xs font-bold tracking-wider uppercase mt-0.5">
                    <Populated>{roomLabel} — {termLabel} LEASE</Populated>
                  </h2>
                </div>

                <p className="font-semibold uppercase tracking-wider text-[10px] text-slate-900 mt-2 mb-1">
                  KNOWN TO ALL MEN BY THESE PRESENTS:
                </p>

                <p className="text-justify indent-5">
                  This <strong>CONTRACT OF LEASE</strong> is made and executed in the City of Makati, this{" "}
                  <Populated>{executionDay}</Populated> day of{" "}
                  <Populated>{executionMonth} {executionYear}</Populated>, by and between:
                </p>

                <p className="text-justify indent-5">
                  <strong>FIRST JRAC PARTNERSHIP CO.</strong>, a general partnership duly organized and existing under and by virtue of the laws of the Republic of the Philippines, with principal office at 9431 Magallanes St., Guadalupe Nuevo, Makati City, represented herein by its General Partner, <strong>JOANNE ONG</strong>, hereinafter referred to as the <strong>LESSOR</strong>;
                </p>

                <p className="text-center font-bold tracking-widest text-[10px] my-0.5">
                  — and —
                </p>

                <p className="text-justify indent-5">
                  <Populated>{tenantName}</Populated>, of legal age, Filipino, with postal and residential address at{" "}
                  <Populated>{tenantAddress}</Populated>, hereinafter referred to as the <strong>LESSEE</strong>;
                </p>

                <p className="font-bold tracking-wide text-[10px] mt-1.5 mb-0.5">
                  WITNESSETH: That
                </p>

                <p className="text-justify indent-5">
                  <strong>WHEREAS</strong>, the LESSOR is the owner of a residential establishment known as{" "}
                  <Populated>{branchName}</Populated>, located at <Populated>{branchAddress}</Populated>;
                </p>

                <p className="text-justify indent-5">
                  <strong>WHEREAS</strong>, the LESSOR agrees to lease to the LESSEE a <Populated>{roomLabel}</Populated> accommodation known as Room{" "}
                  <Populated>{roomNumber}</Populated>
                  {!isPrivate && (
                    <>
                      , Bed/Slot No. <Populated>{bedSlot}</Populated>
                    </>
                  )}{" "}
                  (the “LEASED PREMISES”) within the said establishment, and the LESSEE is willing to lease the same for a limited time or period;
                </p>

                <p className="text-justify indent-5">
                  <strong>NOW THEREFORE</strong>, for and in consideration of the foregoing premises, the LESSOR leases unto the LESSEE and the LESSEE hereby accepts from the LESSOR the LEASED PREMISES, subject to the following:
                </p>

                <div className="text-center font-bold tracking-wider text-[10px] uppercase my-2 border-y border-slate-300 py-0.5">
                  TERMS AND CONDITIONS
                </div>

                <div className="space-y-2.5 text-justify text-[11px]">
                  <p>
                    <strong>SECTION 1 – PURPOSE.</strong> The leased premises shall be used exclusively by the LESSEE for residential purposes only and shall not be diverted to other uses. It is hereby expressly agreed that if at any time the premises are used for other purposes, the LESSOR shall have the right to rescind this Contract, without prejudice to its other rights under the law.
                  </p>

                  <p>
                    <strong>SECTION 2 – DURATION.</strong> The lease of the {leaseSpaceSubject} shall run for a period of{" "}
                    <Populated>{durationMonths} ( {durationInWords(durationMonths)} )</Populated> months, from{" "}
                    <Populated>{formattedStart}</Populated> to <Populated>{formattedEnd}</Populated>. Being a <Populated>{termLabel}</Populated> LEASE, the period shall be <Populated>{durationCondition}</Populated>
                  </p>

                  <p>
                    <strong>SECTION 3 – RENTAL RATE.</strong> The regular and basic monthly rental fee is{" "}
                    <Populated>Php {formatMoney(regularRate)}</Populated>, exclusive of any tax.{" "}
                    {discountPercent > 0 ? (
                      <>
                        The LESSOR, however, shall grant a promo rate or discount of{" "}
                        <Populated>{discountPercent}% percent</Populated>, which brings the basic monthly rental fee to{" "}
                        <Populated>Php {formatMoney(monthlyRent)}</Populated>, exclusive of any tax and net of discount.
                      </>
                    ) : (
                      <>
                        The basic monthly rental fee is <Populated>Php {formatMoney(monthlyRent)}</Populated>, exclusive of any tax.
                      </>
                    )}
                  </p>

                  <p>
                    {amenitiesParagraph}
                  </p>

                  <p>
                    The electricity consumption of the LESSEE, which is not part of the rental fee, shall be billed on a monthly basis.
                  </p>

                  <p>
                    All payments shall be paid directly to the LESSOR through bank deposit or transfer, supported by an official acknowledgment receipt and/or service invoice.
                  </p>

                  <p>
                    Delay in the payment of the rental fee or electricity consumption for three (3) consecutive months shall be ground for the LESSOR to terminate this Contract of Lease. In such case, the LESSEE shall voluntarily vacate the leased premises, surrender the key to the LESSOR, and shall no longer be allowed to access the leased premises except to retrieve his or her personal belongings.
                  </p>

                  <p>
                    <strong>SECTION 4 – DEPOSITS AND ADVANCES.</strong> Upon moving in, the LESSEE shall pay one (1) month advance rent in the amount of{" "}
                    <Populated>Php {formatMoney(advanceRent)}</Populated>, covering the period of <Populated>{advanceStart}</Populated> to <Populated>{advanceEnd}</Populated>, and one (1) month security deposit in the amount of{" "}
                    <Populated>Php {formatMoney(securityDeposit)}</Populated>. The reservation fee of <Populated>Php 2,000.00</Populated> paid by the LESSEE shall be credited as partial payment for the said amounts. The LESSOR agrees to refund the deposit not later than thirty (30) days after the termination of this Contract, less payment, if any, for unpaid bills of electricity or other utility charges, failure to return the key (<Populated>Php 1,000.00</Populated>), and the cost of damages to the leased premises occasioned by the LESSEE’s fault or negligence. This deposit, which shall be non-interest bearing, cannot be applied by the LESSEE to any unpaid rent or to the last month’s rental, and shall be kept intact throughout the life of this Contract.
                  </p>

                  <p>
                    Furthermore, if the LESSEE vacates the premises before the expiration of the period of lease, the full amount of the security deposit shall be forfeited in favor of the LESSOR.
                  </p>

                  <p>
                    <strong>SECTION 5 – FORCE MAJEURE.</strong> If the whole or any part of the leased premises shall be destroyed or damaged by fire, flood, lightning, typhoon, earthquake, storm, riot, or any other unforeseen disabling cause or act of God, as to render the leased premises during the term substantially unfit for the use and occupation of the LESSEE, then this Contract may be terminated without compensation by either the LESSOR or the LESSEE by notice in writing to the other party.
                  </p>

                  <p>
                    <strong>SECTION 6 – LESSOR’S RIGHT OF ENTRY.</strong> The LESSOR or its authorized representative shall, after giving due notice to the LESSEE, have the right to enter the premises in the presence of the LESSEE or his or her representative at any reasonable hour to examine the same, make repairs therein, undertake the operation and maintenance of the building, exhibit the leased premises to prospective lessees, or for any other lawful purpose which it may deem necessary.
                  </p>

                  <p>
                    <strong>SECTION 7 – EXPIRATION OF LEASE.</strong> At the expiration of the term of this lease or the cancellation thereof, as herein provided, the LESSEE shall promptly deliver to the LESSOR the leased premises with all corresponding keys, in as good and tenantable condition as the same is now, ordinary wear and tear excepted, devoid of all occupants, movable furniture, articles, and effects of any kind.
                  </p>
                </div>

                <p className="text-justify indent-5 pt-2">
                  <strong>IN WITNESS WHEREOF</strong>, both parties herein have affixed their signatures on the date and place first above written.
                </p>

                {/* Signatures Grid */}
                <div className="grid grid-cols-2 gap-8 pt-5 pb-2 text-center text-[10.5px]">
                  <div className="flex flex-col justify-end">
                    <div className="h-10"></div>
                    <div className="border-t border-slate-900 pt-1 font-bold text-slate-900">
                      <Populated className="block">{tenantName}</Populated>
                    </div>
                    <div className="text-slate-600 text-[10px] uppercase tracking-wider mt-0.5">LESSEE</div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <div className="font-bold text-slate-900">FIRST JRAC PARTNERSHIP CO.</div>
                    <div className="text-[10px] italic text-slate-600 mt-0.5 mb-5">By:</div>
                    <div className="border-t border-slate-900 pt-1 font-bold text-slate-900">
                      JOANNE ONG
                    </div>
                    <div className="text-slate-600 text-[10px] mt-0.5">General Partner – LESSOR</div>
                  </div>
                </div>

                <div className="pt-3 text-[10px]">
                  <span className="font-bold tracking-wide">SIGNED IN THE PRESENCE OF:</span>
                  <div className="grid grid-cols-2 gap-8 pt-6 pb-1">
                    <div className="border-b border-slate-900 h-0"></div>
                    <div className="border-b border-slate-900 h-0"></div>
                  </div>
                </div>

                {/* Notarial Acknowledgment */}
                <div className="pt-3 border-t border-slate-300 mt-3 space-y-1.5 text-[10px]">
                  <div className="text-center font-bold tracking-wider uppercase text-[9.5px]">
                    ACKNOWLEDGMENT
                  </div>
                  <p className="leading-tight">
                    REPUBLIC OF THE PHILIPPINES )<br />
                    CITY OF MAKATI &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;) S.S.
                  </p>
                  <p className="text-justify indent-5">
                    BEFORE ME, this ______ day of ____________________, personally appeared the above-named parties, all known to me and to me known to be the same persons who executed the foregoing instrument, and who acknowledged to me that the same is their free and voluntary act and deed.
                  </p>
                  <p className="text-justify indent-5">
                    This instrument, consisting of __________ ( ______ ) page/s, including the page on which this acknowledgment is written, has been signed on each and every page thereof by the concerned parties and their witnesses, and sealed with my notarial seal.
                  </p>
                  <p className="indent-5">
                    WITNESS MY HAND AND SEAL, on the date and place first above written.
                  </p>

                  <div className="grid grid-cols-2 max-w-xs pt-1 text-[9.5px] text-slate-700">
                    <div>Doc. No. ________;</div>
                    <div>Page No. ________;</div>
                    <div>Book No. ________;</div>
                    <div>Series of ________.</div>
                  </div>
                </div>
              </article>
            </div>

            {/* Panel Footer (Exact h-9 height alignment) */}
            <div className="h-9 flex-shrink-0 px-3.5 py-2 bg-muted/40 border-t border-border/80 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground truncate">Official Digital Agreement</span>
              <span>•</span>
              <span className="truncate">Ref: {stayData?.referenceNumber || contract?.contractNumber || "Official"}</span>
            </div>
          </section>
        )}

        {/* PANEL 2: WET-SIGNED CONTRACT SCAN & AMENDMENTS (Equalized Structure) */}
        {(layoutMode === "side-by-side" || layoutMode === "signed") && hasSignedDoc && (
          <section
            aria-label="Wet-Signed Contract Scan"
            className={`w-full ${
              layoutMode === "signed" ? "max-w-3xl" : "max-w-full"
            } bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col h-[740px]`}
          >
            {/* Panel Header (Exact h-11 height alignment) */}
            <div className="h-11 flex-shrink-0 px-3.5 py-2 bg-muted/40 border-b border-border/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <FileCheck className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Signed Scan Copy
                </h3>
                {activeSignedDocs.length > 1 && (
                  <div className="flex items-center gap-1 ml-1">
                    {activeSignedDocs.map((doc) => (
                      <button
                        key={doc.version}
                        type="button"
                        onClick={() => setSelectedVersion(doc.version)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                          Number(selectedVersion) === Number(doc.version)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
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
                      className="p-1 rounded border border-border bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
                      title="Zoom Out Scan"
                    >
                      <ZoomOut className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanZoom(100)}
                      className="px-1.5 py-0.5 rounded border border-border bg-card hover:bg-muted text-[10px] font-mono font-semibold text-foreground transition-colors cursor-pointer"
                      title="Reset Zoom"
                    >
                      {scanZoom}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanZoom((prev) => Math.min(250, prev + 15))}
                      disabled={scanZoom >= 250}
                      className="p-1 rounded border border-border bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-40 cursor-pointer"
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
                      className="p-1 rounded border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer"
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
                    className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1 shadow-xs cursor-pointer ml-0.5"
                    title="Download Scanned File"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scan Preview Canvas (flex-1 fill height) */}
            <div className="flex-1 min-h-0 p-3.5 overflow-auto bg-slate-950/5 flex items-center justify-center">
              {signedBlobLoading ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-1.5">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs font-semibold">Loading signed scan...</p>
                </div>
              ) : signedBlobError ? (
                <div className="text-center p-6 text-destructive space-y-1">
                  <p className="text-xs font-bold">Failed to load signed scan.</p>
                  <p className="text-[11px] text-muted-foreground">{signedBlobError}</p>
                </div>
              ) : signedBlobUrl ? (
                isPdf ? (
                  <iframe
                    src={signedBlobUrl}
                    title="Signed Contract PDF"
                    className="w-full h-full rounded-lg border border-border shadow-xs bg-white"
                  />
                ) : (
                  <div className="relative group max-h-full flex items-center justify-center">
                    <img
                      src={signedBlobUrl}
                      alt={selectedDoc?.fileName || "Wet-signed contract scan copy"}
                      className="max-h-[620px] w-auto max-w-full rounded-lg border border-border shadow-sm object-contain bg-white cursor-zoom-in hover:brightness-95 transition-all"
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
                      <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Inspect Fullscreen</span>
                    </button>
                  </div>
                )
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <p className="text-xs font-medium">No signed copy available to preview.</p>
                </div>
              )}
            </div>

            {/* Panel Footer (Exact h-9 height alignment) */}
            <div className="h-9 flex-shrink-0 px-3.5 py-2 bg-muted/40 border-t border-border/80 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-semibold text-foreground truncate">{selectedDoc?.fileName || "Signed Copy"}</span>
                <span>•</span>
                <span className="truncate">v{selectedDoc?.version || 1}</span>
                <span>•</span>
                <span className="truncate">{dayjs(selectedDoc?.uploadedAt).format("MMM D, YYYY")}</span>
              </div>
              {selectedDoc?.replacementReason && (
                <span className="italic text-foreground/80 truncate max-w-[120px]">
                  &ldquo;{selectedDoc.replacementReason}&rdquo;
                </span>
              )}
            </div>
          </section>
        )}
      </div>

      {/* DEDICATED OFFSCREEN 2-PAGE A4 PRINT TEMPLATE (Exact 0.5in Margin, High-Res, Zero-Cut) */}
      <div
        style={{
          position: "fixed",
          left: "0",
          top: "0",
          width: "700px",
          zIndex: -9999,
          opacity: 1,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        {/* PAGE 1: PREAMBLE TO SECTION 4 */}
        <div
          ref={pdfPage1Ref}
          style={{
            width: "700px",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
            color: "#0f172a",
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: "12px",
            lineHeight: "1.42",
            padding: "8px 0",
          }}
        >
          <div style={{ textAlign: "center", paddingBottom: "4px" }}>
            <p style={{ fontSize: "10px", fontWeight: "bold", color: "#b45309", letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 2px 0" }}>
              OFFICIAL DIGITAL AGREEMENT COPY
            </p>
            <h1 style={{ fontSize: "15px", fontWeight: "bold", letterSpacing: "0.5px", textTransform: "uppercase", margin: "0" }}>
              CONTRACT OF LEASE
            </h1>
            <h2 style={{ fontSize: "12px", fontWeight: "bold", letterSpacing: "0.5px", textTransform: "uppercase", margin: "2px 0 0 0" }}>
              <Populated>{roomLabel} — {termLabel} LEASE</Populated>
            </h2>
          </div>

          <p style={{ fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "10.5px", margin: "8px 0 4px 0" }}>
            KNOWN TO ALL MEN BY THESE PRESENTS:
          </p>

          <p style={{ textAlign: "justify", textIndent: "20px", margin: "0 0 6px 0" }}>
            This <strong>CONTRACT OF LEASE</strong> is made and executed in the City of Makati, this{" "}
            <Populated>{executionDay}</Populated> day of{" "}
            <Populated>{executionMonth} {executionYear}</Populated>, by and between:
          </p>

          <p style={{ textAlign: "justify", textIndent: "20px", margin: "0 0 6px 0" }}>
            <strong>FIRST JRAC PARTNERSHIP CO.</strong>, a general partnership duly organized and existing under and by virtue of the laws of the Republic of the Philippines, with principal office at 9431 Magallanes St., Guadalupe Nuevo, Makati City, represented herein by its General Partner, <strong>JOANNE ONG</strong>, hereinafter referred to as the <strong>LESSOR</strong>;
          </p>

          <p style={{ textAlign: "center", fontWeight: "bold", letterSpacing: "2px", fontSize: "10px", margin: "4px 0" }}>
            — and —
          </p>

          <p style={{ textAlign: "justify", textIndent: "20px", margin: "0 0 6px 0" }}>
            <Populated>{tenantName}</Populated>, of legal age, Filipino, with postal and residential address at{" "}
            <Populated>{tenantAddress}</Populated>, hereinafter referred to as the <strong>LESSEE</strong>;
          </p>

          <p style={{ fontWeight: "bold", letterSpacing: "0.5px", fontSize: "10.5px", margin: "6px 0 4px 0" }}>
            WITNESSETH: That
          </p>

          <p style={{ textAlign: "justify", textIndent: "20px", margin: "0 0 6px 0" }}>
            <strong>WHEREAS</strong>, the LESSOR is the owner of a residential establishment known as{" "}
            <Populated>{branchName}</Populated>, located at <Populated>{branchAddress}</Populated>;
          </p>

          <p style={{ textAlign: "justify", textIndent: "20px", margin: "0 0 6px 0" }}>
            <strong>WHEREAS</strong>, the LESSOR agrees to lease to the LESSEE a <Populated>{roomLabel}</Populated> accommodation known as Room{" "}
            <Populated>{roomNumber}</Populated>
            {!isPrivate && (
              <>
                , Bed/Slot No. <Populated>{bedSlot}</Populated>
              </>
            )}{" "}
            (the “LEASED PREMISES”) within the said establishment, and the LESSEE is willing to lease the same for a limited time or period;
          </p>

          <p style={{ textAlign: "justify", textIndent: "20px", margin: "0 0 6px 0" }}>
            <strong>NOW THEREFORE</strong>, for and in consideration of the foregoing premises, the LESSOR leases unto the LESSEE and the LESSEE hereby accepts from the LESSOR the LEASED PREMISES, subject to the following:
          </p>

          <div style={{ textAlign: "center", fontWeight: "bold", letterSpacing: "1px", textTransform: "uppercase", fontSize: "10.5px", margin: "8px 0 6px 0", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", padding: "2px 0" }}>
            TERMS AND CONDITIONS
          </div>

          <div style={{ textAlign: "justify", fontSize: "11px" }}>
            <p style={{ margin: "0 0 6px 0" }}>
              <strong>SECTION 1 – PURPOSE.</strong> The leased premises shall be used exclusively by the LESSEE for residential purposes only and shall not be diverted to other uses. It is hereby expressly agreed that if at any time the premises are used for other purposes, the LESSOR shall have the right to rescind this Contract, without prejudice to its other rights under the law.
            </p>

            <p style={{ margin: "0 0 6px 0" }}>
              <strong>SECTION 2 – DURATION.</strong> The lease of the {leaseSpaceSubject} shall run for a period of{" "}
              <Populated>{durationMonths} ( {durationInWords(durationMonths)} )</Populated> months, from{" "}
              <Populated>{formattedStart}</Populated> to <Populated>{formattedEnd}</Populated>. Being a <Populated>{termLabel}</Populated> LEASE, the period shall be <Populated>{durationCondition}</Populated>
            </p>

            <p style={{ margin: "0 0 6px 0" }}>
              <strong>SECTION 3 – RENTAL RATE.</strong> The regular and basic monthly rental fee is{" "}
              <Populated>Php {formatMoney(regularRate)}</Populated>, exclusive of any tax.{" "}
              {discountPercent > 0 ? (
                <>
                  The LESSOR, however, shall grant a promo rate or discount of{" "}
                  <Populated>{discountPercent}% percent</Populated>, which brings the basic monthly rental fee to{" "}
                  <Populated>Php {formatMoney(monthlyRent)}</Populated>, exclusive of any tax and net of discount.
                </>
              ) : (
                <>
                  The basic monthly rental fee is <Populated>Php {formatMoney(monthlyRent)}</Populated>, exclusive of any tax.
                </>
              )}
            </p>

            <p style={{ margin: "0 0 6px 0" }}>
              {amenitiesParagraph}
            </p>

            <p style={{ margin: "0 0 6px 0" }}>
              The electricity consumption of the LESSEE, which is not part of the rental fee, shall be billed on a monthly basis.
            </p>

            <p style={{ margin: "0 0 6px 0" }}>
              All payments shall be paid directly to the LESSOR through bank deposit or transfer, supported by an official acknowledgment receipt and/or service invoice.
            </p>

            <p style={{ margin: "0 0 6px 0" }}>
              Delay in the payment of the rental fee or electricity consumption for three (3) consecutive months shall be ground for the LESSOR to terminate this Contract of Lease. In such case, the LESSEE shall voluntarily vacate the leased premises, surrender the key to the LESSOR, and shall no longer be allowed to access the leased premises except to retrieve his or her personal belongings.
            </p>

            <p style={{ margin: "0 0 6px 0" }}>
              <strong>SECTION 4 – DEPOSITS AND ADVANCES.</strong> Upon moving in, the LESSEE shall pay one (1) month advance rent in the amount of{" "}
              <Populated>Php {formatMoney(advanceRent)}</Populated>, covering the period of <Populated>{advanceStart}</Populated> to <Populated>{advanceEnd}</Populated>, and one (1) month security deposit in the amount of{" "}
              <Populated>Php {formatMoney(securityDeposit)}</Populated>. The reservation fee of <Populated>Php 2,000.00</Populated> paid by the LESSEE shall be credited as partial payment for the said amounts. The LESSOR agrees to refund the deposit not later than thirty (30) days after the termination of this Contract, less payment, if any, for unpaid bills of electricity or other utility charges, failure to return the key (<Populated>Php 1,000.00</Populated>), and the cost of damages to the leased premises occasioned by the LESSEE’s fault or negligence. This deposit, which shall be non-interest bearing, cannot be applied by the LESSEE to any unpaid rent or to the last month’s rental, and shall be kept intact throughout the life of this Contract.
            </p>

            <p style={{ margin: "0 0 0 0" }}>
              Furthermore, if the LESSEE vacates the premises before the expiration of the period of lease, the full amount of the security deposit shall be forfeited in favor of the LESSOR.
            </p>
          </div>
        </div>

        {/* PAGE 2: SECTION 5 TO NOTARIAL ACKNOWLEDGMENT */}
        <div
          ref={pdfPage2Ref}
          style={{
            width: "700px",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
            color: "#0f172a",
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: "12px",
            lineHeight: "1.42",
            padding: "8px 0",
          }}
        >
          <div style={{ textAlign: "justify", fontSize: "11px" }}>
            <p style={{ margin: "0 0 6px 0" }}>
              <strong>SECTION 5 – FORCE MAJEURE.</strong> If the whole or any part of the leased premises shall be destroyed or damaged by fire, flood, lightning, typhoon, earthquake, storm, riot, or any other unforeseen disabling cause or act of God, as to render the leased premises during the term substantially unfit for the use and occupation of the LESSEE, then this Contract may be terminated without compensation by either the LESSOR or the LESSEE by notice in writing to the other party.
            </p>

            <p style={{ margin: "0 0 6px 0" }}>
              <strong>SECTION 6 – LESSOR’S RIGHT OF ENTRY.</strong> The LESSOR or its authorized representative shall, after giving due notice to the LESSEE, have the right to enter the premises in the presence of the LESSEE or his or her representative at any reasonable hour to examine the same, make repairs therein, undertake the operation and maintenance of the building, exhibit the leased premises to prospective lessees, or for any other lawful purpose which it may deem necessary.
            </p>

            <p style={{ margin: "0 0 6px 0" }}>
              <strong>SECTION 7 – EXPIRATION OF LEASE.</strong> At the expiration of the term of this lease or the cancellation thereof, as herein provided, the LESSEE shall promptly deliver to the LESSOR the leased premises with all corresponding keys, in as good and tenantable condition as the same is now, ordinary wear and tear excepted, devoid of all occupants, movable furniture, articles, and effects of any kind.
            </p>
          </div>

          <p style={{ textAlign: "justify", textIndent: "20px", paddingTop: "6px", margin: "0 0 10px 0" }}>
            <strong>IN WITNESS WHEREOF</strong>, both parties herein have affixed their signatures on the date and place first above written.
          </p>

          {/* Signatures Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", paddingTop: "16px", paddingBottom: "6px", textAlign: "center", fontSize: "11px" }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ height: "44px" }}></div>
              <div style={{ borderTop: "1px solid #0f172a", paddingTop: "4px", fontWeight: "bold", color: "#0f172a" }}>
                <Populated style={{ display: "block" }}>{tenantName}</Populated>
              </div>
              <div style={{ color: "#475569", fontSize: "10px", textTransform: "uppercase", marginTop: "2px" }}>LESSEE</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ fontWeight: "bold", color: "#0f172a" }}>FIRST JRAC PARTNERSHIP CO.</div>
              <div style={{ fontSize: "10px", fontStyle: "italic", color: "#475569", marginTop: "2px", marginBottom: "20px" }}>By:</div>
              <div style={{ borderTop: "1px solid #0f172a", paddingTop: "4px", fontWeight: "bold", color: "#0f172a" }}>JOANNE ONG</div>
              <div style={{ color: "#475569", fontSize: "10px", marginTop: "2px" }}>General Partner – LESSOR</div>
            </div>
          </div>

          <div style={{ paddingTop: "10px", fontSize: "10px" }}>
            <span style={{ fontWeight: "bold" }}>SIGNED IN THE PRESENCE OF:</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", paddingTop: "18px" }}>
              <div style={{ borderBottom: "1px solid #0f172a", height: "0px" }}></div>
              <div style={{ borderBottom: "1px solid #0f172a", height: "0px" }}></div>
            </div>
          </div>

          {/* Notarial Acknowledgment */}
          <div style={{ paddingTop: "10px", borderTop: "1px solid #cbd5e1", marginTop: "10px", fontSize: "10.5px" }}>
            <div style={{ textAlign: "center", fontWeight: "bold", letterSpacing: "1px", textTransform: "uppercase", fontSize: "10px", margin: "0 0 4px 0" }}>
              ACKNOWLEDGMENT
            </div>
            <p style={{ lineHeight: "1.25", margin: "0 0 4px 0" }}>
              REPUBLIC OF THE PHILIPPINES )<br />
              CITY OF MAKATI &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;) S.S.
            </p>
            <p style={{ textAlign: "justify", textIndent: "16px", margin: "0 0 4px 0" }}>
              BEFORE ME, this ______ day of ____________________, personally appeared the above-named parties, all known to me and to me known to be the same persons who executed the foregoing instrument, and who acknowledged to me that the same is their free and voluntary act and deed.
            </p>
            <p style={{ textAlign: "justify", textIndent: "16px", margin: "0 0 4px 0" }}>
              This instrument, consisting of __________ ( ______ ) page/s, including the page on which this acknowledgment is written, has been signed on each and every page thereof by the concerned parties and their witnesses, and sealed with my notarial seal.
            </p>
            <p style={{ textIndent: "16px", margin: "0 0 4px 0" }}>
              WITNESS MY HAND AND SEAL, on the date and place first above written.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: "260px", paddingTop: "4px", fontSize: "9.5px", color: "#334155" }}>
              <div>Doc. No. ________;</div>
              <div>Page No. ________;</div>
              <div>Book No. ________;</div>
              <div>Series of ________.</div>
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
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-400">
                <FileCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-[220px] sm:max-w-md">
                    {selectedDoc?.fileName || "Signed Contract Scan"}
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
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
