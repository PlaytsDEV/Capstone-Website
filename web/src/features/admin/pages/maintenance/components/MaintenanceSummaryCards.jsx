import { PageShell, SummaryBar } from "../../../components/shared";

export function MaintenanceSummaryCards({
  summaryItems = [],
  activeSummaryIndex = -1,
  onSummaryFilter,
}) {
  return (
    <PageShell.Summary>
      <SummaryBar
        items={summaryItems}
        activeIndex={activeSummaryIndex}
        onItemClick={(index) => onSummaryFilter?.(index)}
      />
    </PageShell.Summary>
  );
}
