import {
  X,
  Check,
  AlertTriangle,
  LoaderCircle,
  Send,
  Droplets,
  Zap,
  Home,
  Tag,
  Layers,
  User,
  Calendar,
  AlertCircle,
} from "lucide-react";

import { formatAdminPaymentMode } from "./paymentDisplay";

const BillingCycleDetailModal = ({
  isOpen,
  onClose,
  period,
  result,
  utilityType,
  statusLabel,
  isReadOnly,
  formatters,
  eventTypeLabels,
  onSendReminder,
  activeNoticeKey,
}) => {
  if (!isOpen || !period) return null;

  const { fmtCurrency, fmtNumber, fmtShortDate, getSegmentPeriodLabel } =
    formatters;
  const formatPaymentMethodLabel = (value) => {
    if (!value) return "-";
    return formatAdminPaymentMode({ paymentMethod: value });
  };
  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };
  const getPrimaryNoticeLabel = (tenant) =>
    tenant?.daysOverdue > 0 || tenant?.billStatus === "overdue"
      ? "Overdue Notice"
      : "Remind";

  const unitLabel = utilityType === "electricity" ? "kWh" : "cu.m.";
  const UtilityIcon = utilityType === "electricity" ? Zap : Droplets;
  const periodEnd = period.endDate || period.targetCloseDate;
  const rangeLabel = `${fmtShortDate(period.startDate)} - ${
    fmtShortDate(periodEnd) || "Ongoing"
  }`;
  const summaryTotalLabel =
    utilityType === "electricity" ? "TOTAL KWH" : "TOTAL CU.M.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity"
      style={{ background: "color-mix(in srgb, var(--background) 70%, transparent)" }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-card shadow-xl transition-all"
        style={{ boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4 sticky top-0 z-10">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Billing Cycle History
              </h2>
              {statusLabel && (
                <span className="rounded-md bg-info-light px-2.5 py-0.5 text-[11px] font-semibold text-info-dark border border-info-dark/20 uppercase tracking-wide">
                  {statusLabel}
                </span>
              )}
              {isReadOnly && (
                <span className="rounded-md bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground border border-border">
                  Read-only
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar size={13} className="text-muted-foreground" />
              Period Range: <span className="font-semibold text-foreground">{rangeLabel}</span>
            </p>
          </div>

          <button
            type="button"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Close billing cycle history"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 px-6 pb-6 pt-5">
          {/* Summary KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: summaryTotalLabel,
                value: result ? fmtNumber(result.computedTotalUsage, 2) : "-",
                sub: unitLabel,
                icon: UtilityIcon,
                badgeBg: "bg-primary-light",
                badgeText: "text-primary-dark",
              },
              {
                label: "ROOM COST",
                value: result
                  ? fmtCurrency(result.totalRoomCost || result.computedTotalCost)
                  : "-",
                sub: "total for cycle",
                icon: Home,
                badgeBg: "bg-info-light",
                badgeText: "text-info-dark",
              },
              {
                label: "CURRENT RATE",
                value: result ? fmtCurrency(result.ratePerUnit) : "-",
                sub: `per ${unitLabel}`,
                icon: Tag,
                badgeBg: "bg-warning-light",
                badgeText: "text-warning-dark",
              },
              {
                label: "SEGMENTS",
                value: result?.segments?.length ?? 0,
                sub: "active segments",
                icon: Layers,
                badgeBg: "bg-success-light",
                badgeText: "text-success-dark",
              },
            ].map(({ label, value, sub, icon: Icon, badgeBg, badgeText }) => (
              <div
                key={label}
                className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                    {label}
                  </span>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 ${badgeBg} ${badgeText}`}>
                    <Icon size={15} />
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {value}
                  </p>
                  {sub && (
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">{sub}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Segment Breakdown */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Layers size={15} className="text-muted-foreground" />
                <span>Segment Breakdown</span>
                {result?.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-0.5 text-[11px] font-semibold text-success-dark border border-success-dark/20">
                    <Check size={12} /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-light px-2.5 py-0.5 text-[11px] font-semibold text-warning-dark border border-warning-dark/20">
                    <AlertTriangle size={12} /> Unverified
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4 p-4">
              {(result?.segments || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                  <Layers size={18} className="text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Segment details are not available for this billing cycle yet.
                  </p>
                </div>
              ) : (
                (result?.segments || []).map((seg, index) => (
                  <div
                    key={`${period.id}-segment-${index}`}
                    className="overflow-hidden rounded-lg border border-border bg-card"
                  >
                    {/* Segment header */}
                    <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-foreground">
                      <div className="flex items-center gap-2">
                        <User size={13} className="text-muted-foreground" />
                        <span>Room Occupants:</span>
                      </div>
                      <span className="rounded-full bg-card px-2.5 py-0.5 font-bold text-foreground border border-border">
                        {seg.activeTenantCount ?? 0} {seg.activeTenantCount === 1 ? "tenant" : "tenants"}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            {["Item", "Date", unitLabel].map((h, i) => (
                              <th
                                key={h}
                                className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                                style={{
                                  textAlign:
                                    i === 0
                                      ? "left"
                                      : i === 1
                                        ? "center"
                                        : "right",
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-sm text-foreground">
                          {[
                            {
                              label: "1st reading",
                              date: seg.startDate
                                ? new Date(seg.startDate).toLocaleDateString()
                                : (seg.periodLabel || "").split(/\s*[-–]\s*/)[0] || "-",
                              value: fmtNumber(seg.readingFrom, 2),
                            },
                            {
                              label: "2nd reading",
                              date: seg.endDate
                                ? new Date(seg.endDate).toLocaleDateString()
                                : (seg.periodLabel || "").split(/\s*[-–]\s*/)[1] || "-",
                              value: fmtNumber(seg.readingTo, 2),
                            },
                          ].map((row) => (
                            <tr key={row.label} className="hover:bg-muted/30">
                              <td className="px-4 py-2.5 font-medium text-muted-foreground">
                                {row.label}
                              </td>
                              <td className="px-4 py-2.5 text-center font-medium">
                                {row.date}
                              </td>
                              <td className="px-4 py-2.5 text-right font-medium">
                                {row.value}
                              </td>
                            </tr>
                          ))}

                          {[
                            {
                              label: "Segment period",
                              content: getSegmentPeriodLabel(seg),
                            },
                            {
                              label: "Boundary events",
                              content:
                                (eventTypeLabels?.[seg.startEventType] ||
                                  seg.startEventType ||
                                  "Regular") +
                                " to " +
                                (eventTypeLabels?.[seg.endEventType] ||
                                  seg.endEventType ||
                                  "Regular"),
                            },
                          ].map((row) => (
                            <tr key={row.label} className="hover:bg-muted/30">
                              <td className="px-4 py-2.5 font-medium text-muted-foreground">
                                {row.label}
                              </td>
                              <td
                                className="px-4 py-2.5 text-center font-medium"
                                colSpan={2}
                              >
                                {row.content}
                              </td>
                            </tr>
                          ))}

                          <tr className="hover:bg-muted/30">
                            <td className="px-4 py-2.5 font-medium text-muted-foreground">
                              Total consumption
                            </td>
                            <td className="px-4 py-2.5" />
                            <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                              {fmtNumber(seg.unitsConsumed, 2)} {unitLabel}
                            </td>
                          </tr>

                          {[
                            {
                              label: "Segment total cost",
                              value: fmtCurrency(seg.totalCost),
                            },
                            {
                              label: `Amount due (${fmtCurrency(result?.ratePerUnit)} / ${unitLabel}) per person`,
                              value: fmtCurrency(seg.sharePerTenantCost),
                            },
                          ].map((row) => (
                            <tr key={row.label} className="hover:bg-muted/30">
                              <td
                                className="px-4 py-2.5 font-medium text-muted-foreground"
                                colSpan={2}
                              >
                                {row.label}
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-foreground">
                                {row.value}
                              </td>
                            </tr>
                          ))}

                          <tr className="hover:bg-muted/30">
                            <td className="px-4 py-2.5 font-medium text-muted-foreground">
                              Covered tenants
                            </td>
                            <td
                              className="px-4 py-2.5 text-center font-medium text-foreground"
                              colSpan={2}
                            >
                              {seg.coveredTenantNames?.length
                                ? seg.coveredTenantNames.join(", ")
                                : "No active tenant"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Covered Tenants */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <User size={15} className="text-muted-foreground" />
                <span>Covered Tenants</span>
              </p>
              <span className="text-xs font-medium text-muted-foreground">
                {(result?.tenantSummaries || []).length} tenant{(result?.tenantSummaries || []).length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {[
                      { label: "Tenant Name", align: "left" },
                      { label: "Duration Range", align: "left" },
                      { label: `Total ${unitLabel}`, align: "right" },
                      { label: "Bill Amount", align: "right" },
                      { label: "Balance", align: "right" },
                      { label: "Status", align: "left" },
                      { label: "Due Date", align: "left" },
                      { label: "Payment Info", align: "left" },
                      { label: "Action", align: "right" },
                    ].map(({ label, align }) => (
                      <th
                        key={label}
                        className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap"
                        style={{ textAlign: align }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm text-foreground">
                  {(result?.tenantSummaries || []).length === 0 ? (
                    <tr>
                      <td
                        className="px-4 py-8 text-center text-sm font-medium text-muted-foreground"
                        colSpan={9}
                      >
                        No covered tenants for this billing cycle.
                      </td>
                    </tr>
                  ) : (
                    (result?.tenantSummaries || []).map((tenant, index) => (
                      <tr
                        key={`${period.id}-tenant-${index}`}
                        className="transition-colors hover:bg-muted/30"
                      >
                        {/* Tenant Name & Email */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-semibold text-foreground">
                            {tenant.tenantName || "Unknown Tenant"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tenant.tenantEmail || "-"}
                          </p>
                        </td>

                        {/* Duration Range */}
                        <td className="px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">
                          {tenant.durationRange || "Ongoing"}
                        </td>

                        {/* Total Usage */}
                        <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                          {fmtNumber(tenant.totalUsage, 2)}
                        </td>

                        {/* Bill Amount */}
                        <td className="px-4 py-3 text-right font-bold text-foreground whitespace-nowrap">
                          {fmtCurrency(tenant.billAmount)}
                        </td>

                        {/* Balance */}
                        <td className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">
                          {fmtCurrency(tenant.remainingAmount)}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {tenant.billStatus ? (
                            <div className="space-y-0.5">
                              <span
                                className={`inline-block rounded-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  tenant.billStatus === "paid"
                                    ? "bg-success-light text-success-dark border border-success-dark/20"
                                    : tenant.daysOverdue > 0 || tenant.billStatus === "overdue"
                                      ? "bg-danger-light text-danger-dark border border-danger-dark/20"
                                      : tenant.billStatus === "partially-paid"
                                        ? "bg-warning-light text-warning-dark border border-warning-dark/20"
                                        : "bg-info-light text-info-dark border border-info-dark/20"
                                }`}
                              >
                                {String(tenant.billStatus).replace(/-/g, " ")}
                              </span>
                              {tenant.daysOverdue > 0 && (
                                <div className="text-[11px] font-semibold text-danger-dark flex items-center gap-1">
                                  <AlertCircle size={10} />
                                  {tenant.daysOverdue} day{tenant.daysOverdue === 1 ? "" : "s"} overdue
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* Due Date */}
                        <td className="px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">
                          {tenant.dueDate ? fmtShortDate(tenant.dueDate) : "-"}
                        </td>

                        {/* Payment Info */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-xs font-medium text-foreground">
                            {tenant.paymentFallbackLabel || formatPaymentMethodLabel(tenant.paymentMethod)}
                          </p>
                          {tenant.paymentReference && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[120px]" title={tenant.paymentReference}>
                              Ref: {tenant.paymentReference}
                            </p>
                          )}
                        </td>

                        {/* Action Button - Compact with short text */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {tenant.billId && (tenant.canSendPenaltyNotice || tenant.canSendReminder) && onSendReminder ? (
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                tenant.canSendPenaltyNotice
                                  ? "border border-danger-dark/30 bg-danger-light text-danger-dark hover:bg-danger-light/80"
                                  : "border border-info-dark/30 bg-info-light text-info-dark hover:bg-info-light/80"
                              }`}
                              onClick={() => onSendReminder(tenant.billId, tenant.canSendPenaltyNotice ? "penalty" : tenant.daysOverdue > 0 ? "overdue" : "reminder")}
                              disabled={activeNoticeKey?.startsWith(`${tenant.billId}:`)}
                              title={tenant.canSendPenaltyNotice ? (tenant.penaltyReason || "Send penalty notice") : undefined}
                            >
                              {activeNoticeKey?.startsWith(`${tenant.billId}:`) ? (
                                <LoaderCircle size={11} className="animate-spin" />
                              ) : (
                                <Send size={11} />
                              )}
                              <span>
                                {tenant.canSendPenaltyNotice
                                  ? "Penalty Notice"
                                  : getPrimaryNoticeLabel(tenant)}
                              </span>
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground">
                              {tenant.billStatus === "paid" ? "Paid" : "-"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer - Single clean close action */}
        <div className="flex items-center justify-end border-t border-border bg-card px-6 py-3.5 sticky bottom-0 z-10">
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-5 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BillingCycleDetailModal;


