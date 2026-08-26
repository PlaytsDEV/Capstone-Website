import {
  ShieldAlert,
  AlertTriangle,
  Calendar,
  MapPin,
  Eye,
  ArrowRight,
} from "lucide-react";
import WarningCard from "./WarningCard";
import {
  VIOLATION_CATEGORY_LABELS,
  getViolationStatusBadge,
  formatDate,
} from "./tenantDetailConstants";

export default function TenantViolationsTab({
  tenant,
  warnings = [],
  tenantViolations = [],
  loadingViolations = false,
  onRecordViolation,
  onSelectViolationForDetail,
  onPreviewDoc,
  onWarningAction,
}) {
  return (
    <div className="space-y-4">
      {/* Header Action Bar */}
      <div className="flex items-center justify-between bg-muted/30 border border-border/60 rounded-xl p-3.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
              Rule Compliance &amp; Account Safeguards
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {tenantViolations.length} infraction record(s) on file · {warnings.length} system alert(s)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRecordViolation && onRecordViolation()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer shadow-xs"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>+ Log Rule Infraction</span>
        </button>
      </div>

      {/* Section 1: House Rule Violations & Formal Warnings */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            House Rule Violations &amp; Written Warnings ({tenantViolations.length})
          </h4>
          <span className="text-[11px] text-muted-foreground">Formal strike tracking</span>
        </div>

        {loadingViolations ? (
          <div className="space-y-2">
            <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          </div>
        ) : tenantViolations.length > 0 ? (
          <div className="space-y-3">
            {tenantViolations.map((v) => {
              const badge = getViolationStatusBadge(v.status);
              const catLabel =
                VIOLATION_CATEGORY_LABELS[v.violationType] ||
                v.violationType ||
                "Rule Infraction";
              const hasPhoto =
                (v.evidenceUrls && v.evidenceUrls.length > 0) || v.evidenceUrl;
              const primaryPhoto =
                (v.evidenceUrls && v.evidenceUrls[0]) || v.evidenceUrl;

              return (
                <div
                  key={v._id || v.id}
                  className="bg-card border border-border rounded-xl p-3.5 space-y-2.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Warning #{v.warningNumber || 1}
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        {catLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <div className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      <span className={badge.color}>{badge.label}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {v.dateOfIncident ? formatDate(v.dateOfIncident) : "N/A"}
                        {v.timeOfIncident ? ` at ${v.timeOfIncident}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {v.locationOfIncident || "Assigned Room"}
                      </span>
                    </div>
                  </div>

                  {v.evidenceNotes && (
                    <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border border-border/50">
                      {v.evidenceNotes}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {Number(v.penaltyApplied) > 0 && (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold font-mono">
                          Penalty: ₱
                          {Number(v.penaltyApplied).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      )}
                      {hasPhoto && (
                        <button
                          type="button"
                          onClick={() =>
                            onPreviewDoc &&
                            onPreviewDoc({
                              url: primaryPhoto,
                              label: `Evidence: ${catLabel}`,
                              category: "photo",
                            })
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Evidence Photo</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onSelectViolationForDetail && onSelectViolationForDetail(v)
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground transition-colors cursor-pointer ml-auto"
                    >
                      <span>Review Infraction</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-center rounded-lg bg-card border border-border/50 text-xs text-muted-foreground">
            Zero house rule infractions on record for this tenant.
          </div>
        )}
      </div>

      {/* Section 2: Account & Financial System Warnings */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Account &amp; Financial Warnings ({warnings.length})
          </h4>
          <span className="text-[11px] text-muted-foreground">
            Overdue &amp; contract triggers
          </span>
        </div>

        {warnings.length > 0 ? (
          <div className="space-y-3">
            {warnings.map((warning) => (
              <WarningCard
                key={warning.id}
                warning={warning}
                onAction={onWarningAction}
                tenant={tenant}
              />
            ))}
          </div>
        ) : (
          <div className="p-4 text-center rounded-lg bg-card border border-border/50 text-xs text-muted-foreground">
            All account metrics, rent statements, and contract safeguards are clear.
          </div>
        )}
      </div>
    </div>
  );
}
