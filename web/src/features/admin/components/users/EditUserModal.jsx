import { useState, useRef, useEffect } from "react";
import BaseModal from "../../../../shared/components/BaseModal";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import {
  UserCredentialsSection,
  UserPersonalSection,
  UserRoleSection,
  UserExtendedSection,
} from "./edit";

const sectionHeaderStyle = {
  fontSize: "12px",
  fontWeight: 700,
  color: "var(--muted-foreground)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  margin: "10px 0 6px",
  paddingTop: "12px",
  borderTop: "1px solid var(--border)",
};

export default function EditUserModal({
  editForm,
  editFormErrors = {},
  isOwner = false,
  onFormChange,
  onSubmit,
  onClose,
  isUpdating = false,
}) {
  const [touched, setTouched] = useState({});
  const initialFormRef = useRef(JSON.stringify(editForm));
  const firstInputRef = useRef(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSafeClose = () => {
    const isDirty = JSON.stringify(editForm) !== initialFormRef.current;
    if (isDirty && !isUpdating) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      <BaseModal
        isOpen={true}
        onClose={handleSafeClose}
        title="Edit User Account"
        subtitle="Modify profile credentials, personal details, and role assignments"
        variant="primary"
        size="lg"
        onConfirm={onSubmit}
        confirmText={isUpdating ? "Saving Changes..." : "Save Changes"}
        cancelText="Cancel"
        loading={isUpdating}
      >
        <form
          onSubmit={onSubmit}
          className="modal-form"
          style={{ display: "grid", gap: 12, padding: "4px 0" }}
        >
          {/* 1. Account Credentials */}
          <UserCredentialsSection
            editForm={editForm}
            editFormErrors={editFormErrors}
            touched={touched}
            onFormChange={onFormChange}
            onBlur={handleBlur}
            firstInputRef={firstInputRef}
          />

          {/* 2. Personal Information */}
          <UserPersonalSection
            editForm={editForm}
            editFormErrors={editFormErrors}
            touched={touched}
            onFormChange={onFormChange}
            onBlur={handleBlur}
          />

          {/* 3. Role & Branch Assignment */}
          <UserRoleSection
            editForm={editForm}
            editFormErrors={editFormErrors}
            isOwner={isOwner}
            onFormChange={onFormChange}
            sectionHeaderStyle={sectionHeaderStyle}
          />

          {/* 4. Extended Profile Details & Academic info */}
          <UserExtendedSection
            editForm={editForm}
            editFormErrors={editFormErrors}
            touched={touched}
            onFormChange={onFormChange}
            onBlur={handleBlur}
            sectionHeaderStyle={sectionHeaderStyle}
          />
        </form>
      </BaseModal>

      <ConfirmModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
        title="Discard Changes"
        message="You have unsaved changes. Are you sure you want to discard them and close this form?"
        confirmText="Discard"
        cancelText="Keep Editing"
        variant="warning"
      />
    </>
  );
}
