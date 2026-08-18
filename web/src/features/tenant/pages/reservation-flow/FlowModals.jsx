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
  applicationSubmitted = false,
  loading = false,
}) => {
  const isStage1 = pendingAction === "stage1";
  const isApplicationSubmit =
    pendingAction === "stage3" || pendingAction === "submit_application";

  let title = "Confirm Reservation Submission";
  let subtitle = "";
  let message =
    "Are you sure you want to submit your reservation? Once submitted, you will need to wait for admin confirmation.";
  let confirmText = "Proceed";
  let cancelText = "Cancel";

  if (isStage1) {
    title = "Confirm Room Selection";
    message =
      "Are you sure you want to proceed with this room selection? A reservation draft will be created.";
    confirmText = "Proceed";
    cancelText = "Cancel";
  } else if (isApplicationSubmit) {
    title = applicationSubmitted ? "Save Application Changes" : "Submit Application";
    subtitle = applicationSubmitted
      ? "Review your updated details before submitting"
      : "Review your details before submitting";
    message = applicationSubmitted
      ? "Are you sure you want to save the changes made to your application? Your updated information and documents will be reviewed."
      : "Are you sure you want to submit your tenant application? Please verify that all personal details and uploaded verification documents are accurate and complete.";
    confirmText = applicationSubmitted ? "Save Changes" : "Submit Application";
    cancelText = "Keep Editing";
  }

  return (
    <BaseModal
      isOpen={show}
      onClose={onCancel}
      title={title}
      subtitle={subtitle}
      variant="success"
      size="sm"
      cancelText={cancelText}
      confirmText={confirmText}
      onConfirm={onConfirm}
      loading={loading}
    >
      <p style={{ margin: 0, color: "var(--text-secondary, var(--muted-foreground))", lineHeight: 1.5 }}>
        {message}
      </p>
    </BaseModal>
  );
};
