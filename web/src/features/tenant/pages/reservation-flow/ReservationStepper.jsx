import React from "react";
import { RESERVATION_STAGES } from "./reservationFlowConstants";
import { getReservationFlowStageState } from "../../utils/reservationFlowStageState";

const ReservationStepper = ({
  currentStage,
  reservation,
  applicationSubmitted,
  paymentSubmitted,
  paymentApproved,
  onStepClick,
}) => {
  const stageStates = RESERVATION_STAGES.map((stage) =>
    getReservationFlowStageState({
      stageId: stage.id,
      currentStage,
      reservation,
      applicationSubmitted,
      paymentSubmitted,
      paymentApproved,
    })
  );

  const totalSegments = Math.max(RESERVATION_STAGES.length - 1, 1);
  const activeIndex = Math.max(0, (Number(currentStage) || 1) - 1);
  const completedCount = stageStates.filter((s) => s.isComplete).length;
  const progressSegments = Math.max(
    0,
    Math.min(totalSegments, Math.max(activeIndex, completedCount >= totalSegments + 1 ? totalSegments : completedCount))
  );
  const stepperProgressPercent = (progressSegments / totalSegments) * 100;

  return (
    <div className="rf-stepper">
      <div className="rf-stepper-track">
        <div className="rf-stepper-progress-rail" aria-hidden="true">
          <div
            className="rf-stepper-track-progress"
            style={{ width: `${stepperProgressPercent}%` }}
          />
        </div>
        {RESERVATION_STAGES.map((stage, index) => {
          const stageState = stageStates[index];
          let stepClass = "";
          if (stageState.isComplete) stepClass = "complete";
          else if (stageState.isActive) stepClass = "active";
          else if (stageState.isReady) stepClass = "ready ongoing";
          else if (stageState.isLocked) stepClass = "locked";

          let icon;
          if (stageState.isComplete || stageState.showCheck) {
            icon = <CheckIcon />;
          } else if (stageState.isLocked) {
            icon = <LockIcon />;
          } else {
            icon = <span>{index + 1}</span>;
          }

          const isInteractive = Boolean(
            onStepClick &&
              (stageState.isActive || stageState.isComplete || stageState.isReady)
          );

          return (
            <div
              key={stage.id}
              className={`rf-stepper-step ${stepClass}`}
              aria-current={stageState.isActive ? "step" : undefined}
              onClick={() => {
                if (isInteractive) {
                  onStepClick(stage.id);
                }
              }}
              style={{
                cursor: isInteractive ? "pointer" : "default",
              }}
              title={
                stageState.helperLabel
                  ? `${stage.label} (${stageState.helperLabel})`
                  : stage.label
              }
            >
              <div className="rf-stepper-dot">{icon}</div>
              <span className="rf-stepper-label">
                {stage.label}
                {stageState.helperLabel && (
                  <span className="rf-stepper-helper">
                    {stageState.helperLabel}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const LockIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

export default ReservationStepper;
