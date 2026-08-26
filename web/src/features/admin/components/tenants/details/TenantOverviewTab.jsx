import {
  ClipboardList,
  FileCheck,
  ChevronUp,
  ChevronDown,
  Eye,
  FileText,
  History,
} from "lucide-react";
import { formatCodedRoomAndBed } from "../../../../../shared/utils/bedIdentifier";
import { formatDate } from "./tenantDetailConstants";

export default function TenantOverviewTab({
  tenant,
  fetchedDetail,
  attachedDocs = [],
  extensionHistory = [],
  isDocsPanelOpen,
  setIsDocsPanelOpen,
  docsPanelRef,
  onPreviewDoc,
}) {
  return (
    <div className="space-y-4">
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
                  {extension.previousEnd} → {extension.newEnd}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
