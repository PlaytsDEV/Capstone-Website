import React from "react";
import { RESERVATION_STAGES } from "./reservationFlowConstants";
import { getReservationFlowStageState } from "../../utils/reservationFlowStageState";

const ReservationStepper = ({
  currentStage,
  reservation,
  applicationSubmitted,
  paymentSubmitted,
  paymentApproved,
}) => (
  <div className="rf-stepper">
    <div className="rf-stepper-track">
      {RESERVATION_STAGES.map((stage, index) => {
        const stageState = getReservationFlowStageState({
          stageId: stage.id,
          currentStage,
          reservation,
          applicationSubmitted,
          paymentSubmitted,
          paymentApproved,
        });
        const isLast = index === RESERVATION_STAGES.length - 1;

        let stepClass = "";
        if (stageState.isComplete) stepClass = "complete";
        else if (stageState.isActive) stepClass = "active";
        else if (stageState.isReady) stepClass = "ongoing";

        let icon;
        if (stageState.isComplete || stageState.showCheck) {
          icon = <CheckIcon />;
        } else if (stageState.isLocked) {
          icon = <LockIcon />;
        } else {
          icon = <span>{index + 1}</span>;
        }

        return (
          <div key={stage.id} style={{ display: "contents" }}>
            <div
              className={`rf-stepper-step ${stepClass}`}
              style={{
                cursor: "default",
                opacity:
                  stageState.isActive || stageState.isComplete || stageState.isReady
                    ? 1
                    : 0.4,
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
                  <span
                    style={{
                      fontSize: "10px",
                      display: "block",
                    }}
                  >
                    {stageState.helperLabel}
                  </span>
                )}
              </span>
            </div>
            {!isLast && (
              <div
                className={`rf-stepper-line ${
                  stageState.isComplete ? "complete" : ""
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  </div>
);

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
