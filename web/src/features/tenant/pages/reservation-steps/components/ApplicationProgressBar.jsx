import React from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * Section progress bar showing completed section count, auto-save status,
 * and visual completion percentage.
 */
const ApplicationProgressBar = ({
  completedCount = 0,
  totalSections = 6,
  saveStatus = null,
}) => {
  const percentage = totalSections > 0 ? Math.min(100, Math.round((completedCount / totalSections) * 100)) : 0;
  const isAllComplete = completedCount === totalSections && totalSections > 0;

  return (
    <div className="rf-app-progress" aria-label="Application form progress">
      <div className="rf-app-progress__header">
        <div className="rf-app-progress__label-wrap">
          <span className="rf-app-progress__label">
            <strong>{completedCount}</strong> of <strong>{totalSections}</strong> sections completed
          </span>
        </div>

        <div className="rf-app-progress__meta">
          {saveStatus && (
            <span
              className={`rf-app-progress__save rf-app-progress__save--${saveStatus}`}
              aria-live="polite"
            >
              {saveStatus === "saving" && (
                <>
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  <span>Saving draft...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <span className="rf-app-progress__dot rf-app-progress__dot--success" aria-hidden="true" />
                  <span>Draft saved</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <span className="rf-app-progress__dot rf-app-progress__dot--error" aria-hidden="true" />
                  <span>Save failed</span>
                </>
              )}
            </span>
          )}

          <span
            className={`rf-app-progress__percentage${isAllComplete ? " rf-app-progress__percentage--complete" : ""}`}
          >
            {isAllComplete ? (
              <span className="rf-app-progress__ready">
                <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                <span>Ready to submit</span>
              </span>
            ) : (
              <span>{percentage}%</span>
            )}
          </span>
        </div>
      </div>

      <div
        className="rf-app-progress__track"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Application form completion progress"
      >
        <div
          className={`rf-app-progress__bar${isAllComplete ? " rf-app-progress__bar--complete" : ""}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ApplicationProgressBar;
