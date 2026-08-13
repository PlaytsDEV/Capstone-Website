import React from "react";
import BaseModal from "../../../../shared/components/BaseModal";

/**
 * Standard confirmation modals for the reservation flow:
 * - LoginConfirmModal — prompts unauthenticated users to sign in
 * - CancelConfirmModal — confirms discard of unsaved changes
 * - StageConfirmModal — confirms room selection / reservation submission
 */

// ── Login Confirm ────────────────────────────────────────────
export const LoginConfirmModal = ({ show, onLogin, onDismiss }) => {
  return (
    <BaseModal
      isOpen={show}
      onClose={onDismiss}
      title="Login Required"
      subtitle="Sign in to save and complete your reservation draft"
      variant="success"
      size="sm"
      cancelText="Cancel"
      confirmText="Go to Login"
      onConfirm={onLogin}
    >
      <p style={{ margin: 0, color: "var(--text-secondary, var(--muted-foreground))", lineHeight: 1.5 }}>
        You need to be logged in to complete your reservation. Your reservation choices will be saved.
      </p>
    </BaseModal>
  );
};

// ── Cancel Confirm ───────────────────────────────────────────
export const CancelConfirmModal = ({ show, onConfirm, onDismiss }) => {
  return (
    <BaseModal
      isOpen={show}
      onClose={onDismiss}
      title="Discard Changes?"
      subtitle="Exiting will discard your current reservation progress"
      variant="warning"
      size="sm"
      cancelText="Keep Editing"
      confirmText="Discard Changes"
      onConfirm={onConfirm}
    >
      <p style={{ margin: 0, color: "var(--text-secondary, var(--muted-foreground))", lineHeight: 1.5 }}>
        Are you sure you want to exit? Your current progress will be lost and you will need to start over.
      </p>
    </BaseModal>
  );
};

// ── Stage Confirm ────────────────────────────────────────────
export const StageConfirmModal = ({
  show,
  pendingAction,
  onConfirm,
  onCancel,
}) => {
  const isStage1 = pendingAction === "stage1";
  const title = isStage1
    ? "Confirm Room Selection"
    : "Confirm Reservation Submission";
  const message = isStage1
    ? "Are you sure you want to proceed with this room selection? A reservation draft will be created."
    : "Are you sure you want to submit your reservation? Once submitted, you will need to wait for admin confirmation.";

  return (
    <BaseModal
      isOpen={show}
      onClose={onCancel}
      title={title}
      variant="success"
      size="sm"
      cancelText="Cancel"
      confirmText="Proceed"
      onConfirm={onConfirm}
    >
      <p style={{ margin: 0, color: "var(--text-secondary, var(--muted-foreground))", lineHeight: 1.5 }}>
        {message}
      </p>
    </BaseModal>
  );
};
