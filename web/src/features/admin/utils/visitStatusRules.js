const SCHEDULED_VISIT_STATUSES = new Set([
  "",
  "physical_visit_scheduled",
  "schedule_approved",
  "rescheduled",
]);

const RESCHEDULABLE_VISIT_STATUSES = new Set([
  "",
  "physical_visit_scheduled",
  "schedule_approved",
  "rescheduled",
  "no_show",
  "visit_cancelled",
]);

const PROCEED_WITHOUT_VISIT_STATUSES = new Set([
  "",
  "physical_visit_scheduled",
  "schedule_approved",
  "rescheduled",
  "no_show",
  "visit_cancelled",
]);

export const VISIT_COMPLETED_LOCK_MESSAGE =
  "This visit has already been completed. Visit actions are no longer available.";

export function getVisitManagementAvailability({
  visitStatusKey = "",
  hasVisitSchedule = false,
} = {}) {
  const status = String(visitStatusKey || "").trim();
  const completed = status === "visit_completed";
  const scheduled = SCHEDULED_VISIT_STATUSES.has(status);
  const reschedulable = RESCHEDULABLE_VISIT_STATUSES.has(status);
  const canProceedWithoutVisit = PROCEED_WITHOUT_VISIT_STATUSES.has(status);

  return {
    completed,
    helperMessage: completed ? VISIT_COMPLETED_LOCK_MESSAGE : "",
    canMarkVisited: !completed && hasVisitSchedule && scheduled,
    canMarkNoShow: !completed && hasVisitSchedule && scheduled,
    canReschedule: !completed && reschedulable,
    canCancelVisit: !completed && hasVisitSchedule && scheduled,
    canAllowWithoutVisit: !completed && canProceedWithoutVisit,
  };
}
