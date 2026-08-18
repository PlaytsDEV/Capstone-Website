import { useState } from "react";

/**
 * FloatingTextarea — Material-style floating label textarea.
 *
 * Matches FloatingInput styling: border-on-focus, error/valid states,
 * floated label sits ON the border.
 *
 * Props:
 * - label (string) — The label text
 * - name (string) — Textarea name attribute
 * - value (string) — Controlled value
 * - onChange (fn) — Change handler
 * - rows (number) — Number of rows (default: 4)
 * - disabled (bool) — Disabled state
 * - error (string|null) — Validation error message
 * - valid (bool) — Show green valid state
 * - required (bool) — Required state
 * - maxLength (number) — Max character count
 * - showCounter (bool) — Show character counter
 */
const FloatingTextarea = ({
  label,
  name,
  value = "",
  onChange,
  onBlur: externalBlur,
  rows = 4,
  disabled = false,
  error = null,
  valid = false,
  required = false,
  maxLength,
  showCounter = false,
}) => {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;
  const showValid = valid && hasValue && !focused;

  const errorId = `${name}-error`;

  return (
    <div className="floating-field">
      <div
        className={`floating-field__wrapper ${hasValue || focused ? "active" : ""} ${focused ? "focused" : ""} ${error ? "has-error" : ""} ${showValid ? "is-valid" : ""}`}
      >
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            externalBlur?.(e);
          }}
          disabled={disabled}
          required={required}
          rows={rows}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="floating-field__input floating-field__textarea"
          placeholder=" "
          style={{ resize: "none" }}
        />
        <label htmlFor={name} className="floating-field__label floating-field__label--textarea">
          {label}
          {required && <span className="text-rose-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
        {error && (
          <span id={errorId} className="floating-field__error" role="alert">
            {error}
          </span>
        )}
        {showCounter && maxLength && (
          <span
            className="floating-field__counter"
            style={{
              marginLeft: "auto",
              fontSize: "12px",
              color: value.length > maxLength * 0.9 ? "var(--fi-error, #ef4444)" : "var(--fi-label, #94a3b8)",
            }}
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
};

export default FloatingTextarea;
