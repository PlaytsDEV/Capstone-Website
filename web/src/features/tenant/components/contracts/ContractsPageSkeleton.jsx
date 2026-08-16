import React from "react";
import SkeletonPulse from "../../../../shared/components/SkeletonPulse";

/**
 * ContractsPageSkeleton — shimmer skeleton that mirrors the modern ContractsPage layout 1:1,
 * including the 4-card KPI summary banner, toolbar, and the digital legal contract paper sheet.
 */
export default function ContractsPageSkeleton() {
  return (
    <main aria-hidden="true" className="contracts-page tenant-contract-page animate-pulse-subtle">
      {/* Header */}
      <header className="contracts-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="w-full">
          <div className="flex items-center gap-2.5 flex-wrap">
            <SkeletonPulse width="220px" height="26px" borderRadius="6px" />
            <SkeletonPulse width="150px" height="22px" borderRadius="9999px" />
          </div>
          <div className="mt-2 max-w-xl">
            <SkeletonPulse width="85%" height="13px" borderRadius="4px" />
          </div>
        </div>
      </header>

      {/* 4-Card Summary Banner */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { labelWidth: "90px", valWidth: "140px", subWidth: "110px" },
          { labelWidth: "80px", valWidth: "130px", subWidth: "150px" },
          { labelWidth: "85px", valWidth: "110px", subWidth: "160px" },
          { labelWidth: "95px", valWidth: "125px", subWidth: "140px" },
        ].map((card, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex flex-col justify-between min-h-[96px]"
          >
            <div className="flex items-center justify-between gap-2">
              <SkeletonPulse width={card.labelWidth} height="11px" borderRadius="3px" />
              <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
            </div>
            <div className="mt-2.5">
              <SkeletonPulse width={card.valWidth} height="18px" borderRadius="4px" style={{ marginBottom: "5px" }} />
              <SkeletonPulse width={card.subWidth} height="12px" borderRadius="3px" />
            </div>
          </div>
        ))}
      </div>

      {/* Digital Contract Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl shadow-xs mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SkeletonPulse width="120px" height="22px" borderRadius="9999px" />
          <SkeletonPulse width="90px" height="22px" borderRadius="4px" />
          <SkeletonPulse width="160px" height="14px" borderRadius="3px" className="hidden md:inline-block" />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <SkeletonPulse width="80px" height="28px" borderRadius="8px" />
          <SkeletonPulse width="90px" height="28px" borderRadius="8px" />
        </div>
      </div>

      {/* Main Digital Contract Paper Sheet */}
      <div className="w-full flex justify-center">
        <section
          aria-label="Contract Skeleton Preview"
          className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col h-[740px]"
        >
          {/* Panel Top Header Bar */}
          <div className="h-11 flex-shrink-0 px-3.5 py-2 bg-muted/40 border-b border-border/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
              <SkeletonPulse width="110px" height="14px" borderRadius="4px" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonPulse width="74px" height="26px" borderRadius="6px" />
              <SkeletonPulse width="60px" height="26px" borderRadius="6px" />
              <SkeletonPulse width="84px" height="26px" borderRadius="6px" />
            </div>
          </div>

          {/* Paper Content Body */}
          <div className="flex-1 min-h-0 px-4 py-6 sm:px-8 sm:py-8 overflow-hidden bg-white dark:bg-slate-900/50 flex justify-center">
            <div className="w-full max-w-[720px] flex flex-col items-center">
              {/* Document Header Text */}
              <SkeletonPulse width="220px" height="10px" borderRadius="2px" style={{ marginBottom: "12px" }} />
              <SkeletonPulse width="180px" height="18px" borderRadius="3px" style={{ marginBottom: "6px" }} />
              <SkeletonPulse width="240px" height="13px" borderRadius="3px" style={{ marginBottom: "20px" }} />

              <div className="w-full text-left">
                <SkeletonPulse width="190px" height="11px" borderRadius="2px" style={{ marginBottom: "12px" }} />
              </div>

              {/* Preamble Clauses */}
              <div className="w-full space-y-2 mb-4">
                <SkeletonPulse width="100%" height="11px" borderRadius="2px" />
                <SkeletonPulse width="96%" height="11px" borderRadius="2px" />
                <SkeletonPulse width="92%" height="11px" borderRadius="2px" />
              </div>

              <div className="w-full space-y-2 mb-4">
                <SkeletonPulse width="98%" height="11px" borderRadius="2px" />
                <SkeletonPulse width="94%" height="11px" borderRadius="2px" />
              </div>

              {/* Sections */}
              <div className="w-full text-center my-2">
                <SkeletonPulse width="150px" height="12px" borderRadius="2px" style={{ margin: "0 auto 12px" }} />
              </div>

              <div className="w-full space-y-3 mb-6">
                <div>
                  <SkeletonPulse width="140px" height="12px" borderRadius="2px" style={{ marginBottom: "6px" }} />
                  <SkeletonPulse width="100%" height="11px" borderRadius="2px" />
                  <SkeletonPulse width="90%" height="11px" borderRadius="2px" style={{ marginTop: "4px" }} />
                </div>
                <div>
                  <SkeletonPulse width="150px" height="12px" borderRadius="2px" style={{ marginBottom: "6px" }} />
                  <SkeletonPulse width="98%" height="11px" borderRadius="2px" />
                  <SkeletonPulse width="94%" height="11px" borderRadius="2px" style={{ marginTop: "4px" }} />
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="w-full grid grid-cols-2 gap-8 sm:gap-12 pt-4 mt-auto">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-full border-b border-border/60 pb-1">
                    <SkeletonPulse width="100%" height="2px" borderRadius="1px" />
                  </div>
                  <SkeletonPulse width="70px" height="11px" borderRadius="2px" />
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <SkeletonPulse width="120px" height="12px" borderRadius="2px" />
                  <div className="w-full border-b border-border/60 pb-1">
                    <SkeletonPulse width="100%" height="2px" borderRadius="1px" />
                  </div>
                  <SkeletonPulse width="90px" height="11px" borderRadius="2px" />
                </div>
              </div>
            </div>
          </div>

          {/* Panel Bottom Footer Bar */}
          <div className="h-10 flex-shrink-0 px-4 py-2 bg-muted/30 border-t border-border flex items-center justify-between gap-3">
            <SkeletonPulse width="160px" height="12px" borderRadius="3px" />
            <SkeletonPulse width="120px" height="12px" borderRadius="3px" />
          </div>
        </section>
      </div>
    </main>
  );
}

