import { SummaryBar } from "../../../components/shared";

export function MaintenanceSummaryCards({
  summaryItems = [],
  activeSummaryIndex = -1,
  onSummaryFilter,
}) {
  return (
    <SummaryBar
      items={summaryItems}
      activeIndex={activeSummaryIndex}
      onItemClick={(index) => onSummaryFilter?.(index)}
    />
  );
}
