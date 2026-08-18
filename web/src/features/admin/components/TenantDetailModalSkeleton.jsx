import React from "react";
import { X } from "lucide-react";
import SkeletonPulse from "../../../shared/components/SkeletonPulse";

export default function TenantDetailModalSkeleton({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER SKELETON */}
        <div className="px-6 py-4 border-b border-border bg-card flex-shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <SkeletonPulse variant="circle" width="44px" height="44px" />
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <SkeletonPulse variant="text" width="180px" height="18px" />
                <SkeletonPulse width="70px" height="20px" borderRadius="9999px" />
              </div>
              <div className="flex items-center gap-2">
                <SkeletonPulse variant="text" width="130px" height="12px" />
                <SkeletonPulse variant="text" width="90px" height="12px" />
                <SkeletonPulse variant="text" width="140px" height="12px" />
              </div>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* BODY - SPLIT PANEL LAYOUT (col-12) */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto bg-card grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT SIDEBAR (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Financial Standing Hero Card Skeleton */}
            <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
              <SkeletonPulse variant="text" width="110px" height="11px" />
              <div className="flex items-baseline justify-between pt-1">
                <SkeletonPulse variant="text" width="90px" height="12px" />
                <SkeletonPulse width="100px" height="24px" borderRadius="6px" />
              </div>
              <div className="flex justify-between pt-2 border-t border-border/40">
                <SkeletonPulse variant="text" width="80px" height="12px" />
                <SkeletonPulse variant="text" width="70px" height="12px" />
              </div>
              <div className="flex justify-between pt-1">
                <SkeletonPulse variant="text" width="90px" height="12px" />
                <SkeletonPulse width="60px" height="18px" borderRadius="9999px" />
              </div>
            </div>

            {/* Tenant & Room Details Card Skeleton */}
            <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
              <SkeletonPulse variant="text" width="140px" height="13px" />
              <div className="space-y-2.5 pt-1">
                <div className="flex justify-between">
                  <SkeletonPulse variant="text" width="60px" height="12px" />
                  <SkeletonPulse variant="text" width="110px" height="12px" />
                </div>
                <div className="flex justify-between">
                  <SkeletonPulse variant="text" width="50px" height="12px" />
                  <SkeletonPulse variant="text" width="80px" height="12px" />
                </div>
                <div className="flex justify-between">
                  <SkeletonPulse variant="text" width="80px" height="12px" />
                  <SkeletonPulse variant="text" width="90px" height="12px" />
                </div>
                <div className="flex justify-between">
                  <SkeletonPulse variant="text" width="75px" height="12px" />
                  <SkeletonPulse variant="text" width="85px" height="12px" />
                </div>
                <div className="pt-2 border-t border-border/40 space-y-2">
                  <div className="flex justify-between">
                    <SkeletonPulse variant="text" width="110px" height="12px" />
                    <SkeletonPulse variant="text" width="90px" height="12px" />
                  </div>
                  <div className="flex justify-between">
                    <SkeletonPulse variant="text" width="100px" height="12px" />
                    <SkeletonPulse variant="text" width="85px" height="12px" />
                  </div>
                </div>
                <div className="pt-2.5 border-t border-border/40">
                  <SkeletonPulse width="100%" height="34px" borderRadius="8px" />
                </div>
              </div>
            </div>

            {/* Quick Operations Panel Skeleton */}
            <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
              <SkeletonPulse variant="text" width="110px" height="12px" />
              <div className="grid grid-cols-3 gap-2">
                <SkeletonPulse width="100%" height="34px" borderRadius="8px" />
                <SkeletonPulse width="100%" height="34px" borderRadius="8px" />
                <SkeletonPulse width="100%" height="34px" borderRadius="8px" />
              </div>
            </div>
          </div>

          {/* RIGHT MAIN PANEL (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Tabs bar Skeleton */}
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <SkeletonPulse width="90px" height="32px" borderRadius="8px" />
              <SkeletonPulse width="140px" height="32px" borderRadius="8px" />
              <SkeletonPulse width="130px" height="32px" borderRadius="8px" />
            </div>

            {/* Primary Details Card Skeleton */}
            <div className="bg-muted/20 border border-border/60 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <SkeletonPulse variant="text" width="160px" height="14px" />
                <SkeletonPulse width="80px" height="24px" borderRadius="6px" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <SkeletonPulse variant="text" width="60%" height="11px" />
                    <SkeletonPulse variant="text" width="85%" height="13px" />
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline / Contract Card Skeleton */}
            <div className="bg-muted/20 border border-border/60 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <SkeletonPulse variant="text" width="140px" height="14px" />
                <SkeletonPulse width="110px" height="28px" borderRadius="6px" />
              </div>
              <div className="space-y-2 pt-2">
                <SkeletonPulse width="100%" height="48px" borderRadius="8px" />
                <SkeletonPulse width="100%" height="48px" borderRadius="8px" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
