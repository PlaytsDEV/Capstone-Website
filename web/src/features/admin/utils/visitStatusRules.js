// Statuses where the schedule needs admin approval before an outcome can be recorded.
// Outcome actions (mark visited / no-show) are NOT available here.
const SCHEDULE_PENDING_STATUSES = new Set([
  "",
  "physical_visit_scheduled",
  "rescheduled",   // reschedule resets scheduleApproved=false; needs re-approval first
]);

// Statuses where the schedule is approved and the visit is actively expected.
// Outcome actions (mark visited / no-show) ARE available here.
const SCHEDULE_ACTIVE_STATUSES = new Set([
  "schedule_approved",
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
  "This visit has been completed. Visit actions are no longer available.";

const VISIT_STATUS_ALIASES = Object.freeze({
  cancelled: "visit_cancelled",
  canceled: "visit_cancelled",
  completed: "visit_completed",
  approved: "visit_completed",
  not_required: "allowed_without_visit",
});

const normalizeVisitStatusKey = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return VISIT_STATUS_ALIASES[normalized] || normalized;
};

export function getVisitManagementAvailability({
  visitStatusKey = "",
  hasVisitSchedule = false,
} = {}) {
  const status = normalizeVisitStatusKey(visitStatusKey);
  const completed = status === "visit_completed";
  const isPending = SCHEDULE_PENDING_STATUSES.has(status);
  const isActive = SCHEDULE_ACTIVE_STATUSES.has(status);
  const reschedulable = RESCHEDULABLE_VISIT_STATUSES.has(status);
  const canProceedWithoutVisit = PROCEED_WITHOUT_VISIT_STATUSES.has(status);

  return {
    completed,
    helperMessage: completed ? VISIT_COMPLETED_LOCK_MESSAGE : "",
    // Approve/reject schedule: only while pending admin review
    canApproveSchedule: !completed && hasVisitSchedule && isPending,
    canRejectSchedule: !completed && hasVisitSchedule && isPending,
    // Outcome recording: only once schedule is approved (active)
    canMarkVisited: !completed && hasVisitSchedule && isActive,
    canMarkNoShow: !completed && hasVisitSchedule && isActive,
    canReschedule: !completed && reschedulable,
    canCancelVisit: !completed && hasVisitSchedule && (isPending || isActive),
    canAllowWithoutVisit: !completed && canProceedWithoutVisit,
  };
}
