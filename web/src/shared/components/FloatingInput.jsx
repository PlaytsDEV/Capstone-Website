import { useState, useCallback, useMemo } from "react";

/**
 * FloatingInput — Material-style floating label input.
 *
 * When empty + not focused: label sits inside the field as placeholder.
 * When focused or has value: label animates up to the top border.
 *
 * Props:
 * - label (string) — The label / placeholder text
 * - name (string) — Input name attribute
 * - type (string) — Input type (default: "text")
 * - value (string) — Controlled value
 * - onChange (fn) — Change handler
 * - disabled (bool) — Disabled state
 * - error (string|null) — Validation error message
 * - valid (bool) — Show green valid state
 * - autoComplete (str) — autoComplete attribute
 * - endAdornment (node) — Element rendered at end (e.g. eye toggle)
 * - inputMode (string) — inputMode attribute
 * - maxLength (number) — maxLength attribute
 */
const FloatingInput = ({
 label,
 name,
 type = "text",
 value = "",
 onChange,
 onBlur: externalBlur,
 onPaste,
 onKeyDown,
 onKeyUp,
 disabled = false,
 error = null,
 valid = false,
 autoComplete,
 endAdornment,
 inputMode,
 maxLength,
 ...rest
}) => {
 const [focused, setFocused] = useState(false);
 const hasValue = value.length > 0;
 const showValid = valid && hasValue && !focused;

 const wrapperClass = useMemo(() => [
 "floating-field__wrapper",
 hasValue || focused ? "active" : "",
 focused ? "focused" : "",
 error ? "has-error" : "",
 showValid ? "is-valid" : "",
 ].filter(Boolean).join(" "), [hasValue, focused, error, showValid]);

 const handleBlur = useCallback(() => {
 setFocused(false);
 externalBlur?.();
 }, [externalBlur]);

 const errorId = `${name}-error`;

 return (
 <div className="floating-field">
 <div className={wrapperClass}>
 <input
 id={name}
 name={name}
 type={type}
 value={value}
 onChange={onChange}
 onFocus={() => setFocused(true)}
 onBlur={handleBlur}
 onPaste={onPaste}
 onKeyDown={onKeyDown}
 onKeyUp={onKeyUp}
 disabled={disabled}
 autoComplete={autoComplete}
 inputMode={inputMode}
 maxLength={maxLength}
 {...rest}
 className="floating-field__input"
 placeholder=" "
 aria-invalid={!!error}
 aria-describedby={error ? errorId : undefined}
 />
 <label htmlFor={name} className="floating-field__label">
 {label}
 </label>
 {endAdornment && (
 <div className="floating-field__adornment">{endAdornment}</div>
 )}
 </div>
 {error && (
 <span id={errorId} className="floating-field__error" role="alert">
 {error}
 </span>
 )}
 </div>
 );
};

export default FloatingInput;
