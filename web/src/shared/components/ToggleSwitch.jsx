import React from "react";
import "./ToggleSwitch.css";

/**
 * ToggleSwitch — Accessible, animated On/Off toggle switch.
 *
 * @param {Object} props
 * @param {boolean} props.checked - Current checked state
 * @param {Function} props.onChange - Handler called when toggled, receives next boolean state
 * @param {boolean} [props.disabled=false] - Whether toggle is disabled/read-only
 * @param {string} [props.id] - Optional HTML id for input linking
 * @param {string} [props.label] - Optional text label beside switch
 * @param {string} [props.ariaLabel] - ARIA label for screen readers
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Switch size variant
 * @param {string} [props.className=''] - Additional CSS classes
 */
export default function ToggleSwitch({
  checked = false,
  onChange,
  disabled = false,
  id,
  label,
  ariaLabel,
  size = "md",
  className = "",
}) {
  const handleClick = (e) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    onChange(!checked);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (onChange) onChange(!checked);
    }
  };

  return (
    <div className={`ts-wrapper ts-${size} ${disabled ? "ts-disabled" : ""} ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label || "Toggle switch"}
        id={id}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`ts-track ${checked ? "ts-checked" : ""}`}
      >
        <span className="ts-thumb">
          {checked ? (
            <svg
              className="ts-thumb-icon ts-icon-check"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="2.5 6 5 8.5 9.5 3.5" />
            </svg>
          ) : (
            <svg
              className="ts-thumb-icon ts-icon-x"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="3" x2="9" y2="9" />
              <line x1="9" y1="3" x2="3" y2="9" />
            </svg>
          )}
        </span>
      </button>
      {label && <span className="ts-label" onClick={handleClick}>{label}</span>}
    </div>
  );
}
