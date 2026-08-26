import { X } from "lucide-react";
import ProfileAvatar from "../../../../../shared/components/ProfileAvatar";
import { getInitials } from "./tenantDetailConstants";

export default function TenantDetailModalHeader({
  tenant,
  headerIndicator,
  occupancyConfig,
  paymentStatus,
  onClose,
}) {
  return (
    <div className="px-6 py-4 border-b border-border bg-card flex-shrink-0 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <ProfileAvatar
            user={{ name: tenant.name, email: tenant.email }}
            initials={tenant.initials || getInitials(tenant.name)}
            size={42}
            defaultOnly
          />
          {headerIndicator && (
            <span
              className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center pointer-events-none"
              title={headerIndicator.tooltip}
            >
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${headerIndicator.pingClass} opacity-75`}
              />
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${headerIndicator.dotClass}`}
              />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base text-foreground truncate">{tenant.name}</h3>
            {occupancyConfig && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${occupancyConfig.color} bg-muted/60`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${occupancyConfig.dot}`} />
                {occupancyConfig.label}
              </span>
            )}
            {paymentStatus === "overdue" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 truncate flex-wrap">
            <span>{tenant.email || "N/A"}</span>
            <span>•</span>
            <span>{tenant.phone || "N/A"}</span>
            <span>•</span>
            <span className="font-medium text-foreground">
              {tenant.branch || "N/A"} — {tenant.room || "N/A"}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label="Close dialog"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
