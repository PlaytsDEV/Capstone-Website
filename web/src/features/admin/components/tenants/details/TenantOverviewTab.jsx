import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  FileCheck,
  ChevronUp,
  ChevronDown,
  Eye,
  FileText,
  History,
  Zap,
  Plus,
  Minus,
  Edit3,
  Check,
  X,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import { formatCodedRoomAndBed } from "../../../../../shared/utils/bedIdentifier";
import { formatDate, formatMoney } from "./tenantDetailConstants";
import ScheduledRoomTransferCard from "./ScheduledRoomTransferCard.jsx";
import TenantTransferRequestCard from "./TenantTransferRequestCard.jsx";
import { adminApi } from "../../../services/adminApi";
import { showNotification } from "../../../../../shared/utils/notification";
import getFriendlyError from "../../../../../shared/utils/friendlyError";
import { STANDARD_APPLIANCES_CATALOG as STANDARD_APPLIANCES } from "../../../../tenant/utils/roomDetailsPricing.js";

export default function TenantOverviewTab({
  tenant,
  fetchedDetail,
  attachedDocs = [],
  extensionHistory = [],
  isDocsPanelOpen,
  setIsDocsPanelOpen,
  docsPanelRef,
  onPreviewDoc,
  onOpenDigitalContract,
  onProceedTransferRequest,
  onDeclineTransferRequest,
  transferRequestLoading = false,
}) {
  const queryClient = useQueryClient();

  const isGuadalupe = useMemo(() => {
    const branchName = String(
      fetchedDetail?.branch ||
      tenant?.branch ||
      fetchedDetail?.roomId?.branch ||
      tenant?.roomId?.branch ||
      ""
    ).toLowerCase().trim();
    return branchName.includes("guadalupe");
  }, [fetchedDetail?.branch, tenant?.branch, fetchedDetail?.roomId, tenant?.roomId]);

  const initialAppliancesMap = useMemo(() => {
    const raw =
      fetchedDetail?.selectedAppliances ??
      tenant?.selectedAppliances ??
      [];

    const map = { fan: 0, ricecooker: 0, laptop: 0 };
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        if (!item) return;
        const rawId = String(item.id || item.applianceId || "").toLowerCase();
        const qty = Number(item.quantity) || 0;
        if (rawId) {
          map[rawId] = qty;
        }
      });
    } else if (typeof raw === "object" && raw !== null) {
      Object.entries(raw).forEach(([id, qty]) => {
        const rawId = String(id).toLowerCase();
        map[rawId] = Number(qty) || 0;
      });
    }
    return map;
  }, [fetchedDetail?.selectedAppliances, tenant?.selectedAppliances]);

  const [isEditingAppliances, setIsEditingAppliances] = useState(false);
  const [editedAppliances, setEditedAppliances] = useState(initialAppliancesMap);
  const [isSavingAppliances, setIsSavingAppliances] = useState(false);

  useEffect(() => {
    setEditedAppliances(initialAppliancesMap);
  }, [initialAppliancesMap]);

  const liveMonthlyTotal = useMemo(() => {
    return STANDARD_APPLIANCES.reduce((sum, app) => {
      const qty = Number(editedAppliances[app.id]) || 0;
      return sum + qty * app.unitPrice;
    }, 0);
  }, [editedAppliances]);

  const currentSavedMonthlyTotal = useMemo(() => {
    return STANDARD_APPLIANCES.reduce((sum, app) => {
      const qty = Number(initialAppliancesMap[app.id]) || 0;
      return sum + qty * app.unitPrice;
    }, 0);
  }, [initialAppliancesMap]);

  const hasAnyDeclaredAppliances = useMemo(() => {
    return Object.values(initialAppliancesMap).some((qty) => Number(qty) > 0);
  }, [initialAppliancesMap]);

  const handleStepperChange = (appId, delta) => {
    setEditedAppliances((prev) => {
      const current = Number(prev[appId]) || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [appId]: next };
    });
  };

  const handleSaveAppliances = async () => {
    const tenantId =
      tenant?.userId?._id ||
      tenant?.userId ||
      tenant?.tenantId?._id ||
      tenant?.tenantId ||
      tenant?._id ||
      tenant?.id ||
      fetchedDetail?.tenantId ||
      fetchedDetail?.userId;

    if (!tenantId) {
      showNotification("Unable to resolve tenant ID for appliance update.", "error");
      return;
    }

    const selectedAppliancesPayload = STANDARD_APPLIANCES.map((app) => ({
      id: app.id,
      name: app.name,
      quantity: Number(editedAppliances[app.id]) || 0,
      price: app.unitPrice,
    }));

    setIsSavingAppliances(true);
    try {
      await adminApi.updateTenantAppliances(tenantId, {
        selectedAppliances: selectedAppliancesPayload,
      });
      showNotification("Tenant appliance add-ons updated successfully", "success");
      setIsEditingAppliances(false);
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    } catch (err) {
      const msg = getFriendlyError(err) || "Failed to update declared appliances.";
      showNotification(msg, "error");
    } finally {
      setIsSavingAppliances(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedAppliances(initialAppliancesMap);
    setIsEditingAppliances(false);
  };

  const scheduledRoomTransfer =
    fetchedDetail?.scheduledRoomTransfer || tenant?.scheduledRoomTransfer || null;
  const tenantTransferRequest =
    fetchedDetail?.tenantTransferRequest || tenant?.tenantTransferRequest || null;

  return (
    <div className="space-y-4">
      <TenantTransferRequestCard
        request={tenantTransferRequest}
        onProceed={onProceedTransferRequest}
        onDecline={onDeclineTransferRequest}
        loading={transferRequestLoading}
      />
      {scheduledRoomTransfer ? (
        <ScheduledRoomTransferCard
          transfer={scheduledRoomTransfer}
          onOpenDigitalContract={onOpenDigitalContract}
        />
      ) : null}

      {/* Submitted Tenant Application Form Card */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-foreground flex items-center justify-between uppercase tracking-wide">
          <span className="flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Submitted Tenant Application Form
          </span>
          <span className="text-[11px] font-mono text-muted-foreground bg-card px-2 py-0.5 rounded border border-border/50">
            {fetchedDetail?.reservationCode ||
              tenant.reservationCode ||
              tenant.reservationId ||
              "RES-APP"}
          </span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
          {/* Demographics */}
          <div className="p-3 bg-card border border-border rounded-xl space-y-2.5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider border-b border-border/40 pb-1.5">
              Personal Demographics
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">Full Name</span>
                <span className="font-semibold text-foreground text-xs">
                  {fetchedDetail?.name || tenant.name || tenant.tenantName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">Gender</span>
                <span className="font-semibold text-foreground text-xs capitalize">
                  {fetchedDetail?.gender ||
                    tenant.gender ||
                    tenant.userId?.gender ||
                    "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Date of Birth
                </span>
                <span className="font-semibold text-foreground text-xs">
                  {formatDate(
                    fetchedDetail?.birthday || tenant.birthday || tenant.userId?.dateOfBirth,
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Civil / Marital Status
                </span>
                <span className="font-semibold text-foreground text-xs capitalize">
                  {fetchedDetail?.civilStatus ||
                    tenant.civilStatus ||
                    tenant.maritalStatus ||
                    tenant.userId?.civilStatus ||
                    "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Nationality
                </span>
                <span className="font-semibold text-foreground text-xs">
                  {fetchedDetail?.nationality ||
                    tenant.nationality ||
                    tenant.userId?.nationality ||
                    "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Occupation / Status
                </span>
                <span className="font-semibold text-foreground text-xs capitalize">
                  {fetchedDetail?.occupation ||
                    tenant.occupation ||
                    tenant.employment ||
                    tenant.userId?.occupation ||
                    "Not specified"}
                </span>
              </div>
            </div>
          </div>

          {/* Permanent Residential Address */}
          <div className="p-3 bg-card border border-border rounded-xl space-y-2.5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider border-b border-border/40 pb-1.5">
              Permanent Residential Address
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Street / House No.
                </span>
                <span className="font-semibold text-foreground text-xs">
                  {fetchedDetail?.address?.street ||
                    tenant.address?.street ||
                    tenant.address?.unitHouseNo ||
                    tenant.userId?.address?.street ||
                    "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Barangay
                </span>
                <span className="font-semibold text-foreground text-xs">
                  {fetchedDetail?.address?.barangay ||
                    tenant.address?.barangay ||
                    tenant.userId?.address?.barangay ||
                    "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  City / Municipality
                </span>
                <span className="font-semibold text-foreground text-xs">
                  {fetchedDetail?.address?.city ||
                    tenant.address?.city ||
                    tenant.userId?.city ||
                    tenant.city ||
                    "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Province / Region
                </span>
                <span className="font-semibold text-foreground text-xs">
                  {fetchedDetail?.address?.province ||
                    tenant.address?.province ||
                    tenant.userId?.province ||
                    tenant.province ||
                    "Not specified"}
                </span>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="p-3 bg-card border border-border rounded-xl space-y-2.5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider border-b border-border/40 pb-1.5">
              Emergency Contact Person
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2 sm:col-span-1">
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Contact Name
                </span>
                <span className="font-semibold text-foreground text-xs">
                  {fetchedDetail?.emergencyContact ||
                    tenant.emergencyContact ||
                    tenant.userId?.emergencyContact ||
                    "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Contact Phone
                </span>
                <span className="font-semibold text-foreground text-xs">
                  {fetchedDetail?.emergencyPhone ||
                    tenant.emergencyPhone ||
                    tenant.userId?.emergencyPhone ||
                    "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">
                  Relationship
                </span>
                <span className="font-semibold text-foreground text-xs capitalize">
                  {fetchedDetail?.emergencyRelationship ||
                    tenant.emergencyRelationship ||
                    tenant.userId?.emergencyRelationship ||
                    "Not specified"}
                </span>
              </div>
            </div>
          </div>

          {/* Application & Move-In Details */}
          <div className="p-3 bg-card border border-border rounded-xl space-y-2.5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider border-b border-border/40 pb-1.5">
              Application &amp; Move-in Details
            </span>
            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium">
                    Intended Move-in Date
                  </span>
                  <span className="font-semibold text-foreground text-xs">
                    {formatDate(
                      fetchedDetail?.intendedMoveInDate ||
                        tenant.moveInDate ||
                        tenant.intendedMoveInDate,
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium">
                    Selected Room &amp; Bed
                  </span>
                  <span className="font-semibold text-foreground text-xs leading-snug block">
                    {formatCodedRoomAndBed(tenant.room, tenant.bed, tenant.branch)}
                  </span>
                </div>
              </div>

              <div className="pt-1.5 border-t border-border/40">
                <span className="text-muted-foreground block text-[11px] font-medium mb-1">
                  Special Requests / Personal Notes
                </span>
                <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 text-foreground text-[11px] leading-relaxed">
                  {fetchedDetail?.notes ||
                    tenant.notes ||
                    tenant.personalNotes ||
                    "No special requests or additional notes submitted in the application form."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Declared Appliance Add-ons Card (Guadalupe Branch) */}
      {(isGuadalupe || hasAnyDeclaredAppliances) && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-sky-50 dark:bg-sky-950/40 border border-border flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Declared Appliance Add-ons
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Guadalupe fixed-rate electricity add-ons (billed on Cycle 2+ statements)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isEditingAppliances ? (
                <>
                  <span className="text-xs font-bold text-foreground tabular-nums">
                    ₱{currentSavedMonthlyTotal.toLocaleString()}/mo
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditedAppliances(initialAppliancesMap);
                      setIsEditingAppliances(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors cursor-pointer"
                    title="Edit tenant appliance declarations"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Edit Appliances</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSavingAppliances}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAppliances}
                    disabled={isSavingAppliances}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {isSavingAppliances ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Appliance Item Rows */}
          <div className="divide-y divide-border/40 text-xs">
            {STANDARD_APPLIANCES.map((app) => {
              const currentQty = isEditingAppliances
                ? Number(editedAppliances[app.id]) || 0
                : Number(initialAppliancesMap[app.id]) || 0;
              const subtotal = currentQty * app.unitPrice;

              return (
                <div
                  key={app.id}
                  className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground text-xs block truncate">
                      {app.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      ₱{app.unitPrice}/month each
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isEditingAppliances ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Decrease ${app.name} quantity`}
                          onClick={() => handleStepperChange(app.id, -1)}
                          disabled={currentQty === 0 || isSavingAppliances}
                          className="w-7 h-7 rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-foreground tabular-nums">
                          {currentQty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase ${app.name} quantity`}
                          onClick={() => handleStepperChange(app.id, 1)}
                          disabled={isSavingAppliances}
                          className="w-7 h-7 rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border/60 bg-muted/30 text-xs font-medium text-foreground">
                        Qty: <strong>{currentQty}</strong>
                      </span>
                    )}

                    <span className="w-20 text-right font-semibold text-foreground text-xs tabular-nums">
                      {currentQty > 0 ? `₱${subtotal.toLocaleString()}/mo` : "₱0/mo"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Subtotal & Recalculation Callout */}
          <div className="pt-2.5 border-t border-border/40 flex items-center justify-between text-xs">
            <span className="text-[11px] text-muted-foreground">
              {isEditingAppliances
                ? "Live recalculated monthly surcharge"
                : hasAnyDeclaredAppliances
                  ? "Recurring monthly surcharge added to statement"
                  : "No declared electric appliances"}
            </span>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground mr-1.5 font-medium">Monthly Add-on:</span>
              <span className="font-bold text-foreground tabular-nums">
                ₱{(isEditingAppliances ? liveMonthlyTotal : currentSavedMonthlyTotal).toLocaleString()}
                <span className="text-[11px] font-normal text-muted-foreground"> / mo</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Attached Verification Documents & Media Card */}
      <div
        ref={docsPanelRef}
        id="attached-verification-docs-panel"
        className="bg-muted/30 border border-border/60 rounded-xl overflow-hidden scroll-mt-6"
      >
        {/* Collapsible Header */}
        <button
          type="button"
          onClick={() => setIsDocsPanelOpen?.((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wide">
            <FileCheck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Attached Verification Documents &amp; Media ({attachedDocs.length})
          </span>
          <span className="flex items-center gap-2">
            {attachedDocs.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Documents Uploaded
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                No Files Attached
              </span>
            )}
            {isDocsPanelOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </span>
        </button>

        {/* Collapsible Body */}
        {isDocsPanelOpen && (
          <div className="px-4 pb-4">
            {attachedDocs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1 text-xs">
                {attachedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => onPreviewDoc && onPreviewDoc(doc)}
                    className="bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-md transition-all cursor-pointer group"
                    title={`Click to view: ${doc.label}`}
                  >
                    {/* Thumbnail or File Placeholder */}
                    {doc.url &&
                    (doc.url.match(/\.(jpeg|jpg|png|gif|webp)($|\?)/i) ||
                      doc.category === "photo" ||
                      doc.category === "identity") ? (
                      <div className="w-full h-32 bg-muted/40 overflow-hidden relative">
                        <img
                          src={doc.url}
                          alt={doc.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-semibold">
                          <Eye className="w-4 h-4" /> View Full
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-20 bg-muted/40 flex flex-col items-center justify-center text-muted-foreground gap-1.5 group-hover:bg-muted/60 transition-colors">
                        <FileText className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                        <span className="text-[11px] font-medium">Document File</span>
                      </div>
                    )}
                    {/* Label row */}
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-t border-border/40">
                      <span className="font-semibold text-foreground text-[11px] truncate">
                        {doc.label}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded flex-shrink-0">
                        {doc.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 bg-card border border-border rounded-lg text-center space-y-1">
                <p className="text-xs font-medium text-foreground">
                  No verification documents attached to this application.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  The tenant did not upload custom ID photos or clearance files during registration.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lease Extension History */}
      {extensionHistory.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-2xs">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
            <History className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Lease Extension History ({extensionHistory.length})
          </h4>
          <div className="divide-y divide-border/40 text-xs">
            {extensionHistory.map((extension) => (
              <div key={extension.id} className="py-2.5 first:pt-1 last:pb-0 text-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold text-foreground">{extension.duration}</span>
                  <span className="text-muted-foreground text-[11px]">{extension.date}</span>
                </div>
                <div className="text-muted-foreground text-[11px]">
                  {extension.dateRange ? (
                    extension.dateRange
                  ) : extension.previousEnd && extension.newEnd ? (
                    `${extension.previousEnd} → ${extension.newEnd}`
                  ) : (
                    extension.notes || "Lease term extended"
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
