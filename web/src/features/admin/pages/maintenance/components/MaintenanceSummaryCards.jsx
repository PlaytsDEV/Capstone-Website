import { SummaryBar } from "../../../components/shared";

/**
 * MaintenanceSummaryCards — Informational overview cards for maintenance metrics with interactive stage filtering.
 */
export function MaintenanceSummaryCards({
  summaryItems = [],
  onItemClick,
  activeIndex = -1,
}) {
  return (
    <SummaryBar
      items={summaryItems}
      onItemClick={onItemClick}
      activeIndex={activeIndex}
    />
  );
}

