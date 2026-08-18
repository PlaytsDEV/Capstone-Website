import { useState } from "react";

/**
 * FloatingSelect — Material-style floating label select dropdown.
 *
 * Matches FloatingInput styling: border-on-focus, error/valid states,
 * floated label sits ON the border.
 *
 * Props:
 * - label (string) — The label text
 * - name (string) — Select name attribute
 * - value (string) — Controlled value
 * - onChange (fn) — Change handler
 * - options (array) — [{ value, label }]
 * - disabled (bool) — Disabled state
 * - error (string|null) — Validation error message
 * - valid (bool) — Show green valid state
 * - required (bool) — Required state
 */
const FloatingSelect = ({
  label,
  name,
  value = "",
  onChange,
  onBlur: externalBlur,
  options = [],
  disabled = false,
  error = null,
  valid = false,
  required = false,
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
        <select
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
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="floating-field__input floating-field__select"
          style={{ cursor: disabled ? "not-allowed" : "pointer" }}
        >
          <option value="" disabled hidden> </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label htmlFor={name} className="floating-field__label">
          {label}
          {required && <span className="text-rose-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
        {/* Dropdown arrow */}
        <div className="floating-field__adornment" style={{ pointerEvents: "none" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--fi-label)" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
      {error && (
        <span id={errorId} className="floating-field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export default FloatingSelect;
