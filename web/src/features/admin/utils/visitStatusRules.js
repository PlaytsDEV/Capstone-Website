// Statuses where the schedule needs admin approval before an outcome can be recorded.
// With auto-approved schedules, this set is effectively empty for new bookings.
// Kept for backward-compat with legacy records that may still lack scheduleApproved.
const SCHEDULE_PENDING_STATUSES = new Set([
  "",
]);

// Statuses where the schedule is approved and the visit is actively expected.
// Outcome actions (mark visited / no-show) ARE available here.
const SCHEDULE_ACTIVE_STATUSES = new Set([
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
    // Approve schedule: no longer needed — schedules are auto-approved at booking time
    canApproveSchedule: false,
    canRejectSchedule: !completed && hasVisitSchedule && (isPending || isActive),
    // Outcome recording: available once schedule exists (auto-approved)
    canMarkVisited: !completed && hasVisitSchedule && (isPending || isActive),
    canMarkNoShow: !completed && hasVisitSchedule && (isPending || isActive),
    canReschedule: !completed && reschedulable,
    canCancelVisit: !completed && hasVisitSchedule && (isPending || isActive),
    canAllowWithoutVisit: !completed && canProceedWithoutVisit,
  };
}
