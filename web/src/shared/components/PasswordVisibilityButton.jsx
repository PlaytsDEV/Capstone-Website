import { Eye, EyeOff } from "lucide-react";

const PasswordVisibilityButton = ({ visible, onToggle, className, style }) => {
  const label = visible ? "Hide password" : "Show password";

  return (
    <button
      type="button"
      className={className}
      style={{
        minWidth: "44px",
        minHeight: "44px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        ...style,
      }}
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-pressed={visible}
    >
      {visible ? (
        <Eye aria-hidden="true" data-password-visibility-icon="visible" />
      ) : (
        <EyeOff aria-hidden="true" data-password-visibility-icon="hidden" />
      )}
    </button>
  );
};

export default PasswordVisibilityButton;
