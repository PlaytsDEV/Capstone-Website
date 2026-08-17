import "./BillingShared.css";
import { formatStageStatus } from "../../../../../shared/utils/stageUtils.js";

export default function BillingStatusBadge({
  status,
  className = "",
  variantClassPrefix = "",
  showStage = true,
}) {
  const variantClass = variantClassPrefix ? `${variantClassPrefix}--${status}` : "";
  const displayLabel = showStage
    ? formatStageStatus("billing", status)
    : String(status || "")
        .replace(/_/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`billing-status-badge billing-status-badge--${status} ${variantClass} ${className}`.trim()}
    >
      <span className="billing-status-badge__dot" />
      {displayLabel || status}
    </span>
  );
}
