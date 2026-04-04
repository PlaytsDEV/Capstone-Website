import "./BillingShared.css";

export default function InlineRateEditor({
  editing,
  value,
  onChange,
  onSave,
  onCancel,
  onStartEdit,
  displayValue,
  disabled = false,
  editLabel = "Rate",
  renderActions,
  renderDisplay,
}) {
  if (editing) {
    return (
      <div className="billing-inline-rate">
        <input
          type="number"
          min="0"
          step="0.01"
          className="billing-inline-rate__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="billing-inline-rate__actions">
          {renderActions ? renderActions({ onSave, onCancel, disabled }) : (
            <>
              <button type="button" className="wb-inline-btn" onClick={onSave} disabled={disabled}>
                Save
              </button>
              <button type="button" className="wb-inline-btn" onClick={onCancel}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (renderDisplay) {
    return renderDisplay({ displayValue, onStartEdit });
  }

  return (
    <div className="billing-inline-rate">
      <span>{displayValue}</span>
      {onStartEdit ? (
        <button type="button" className="wb-inline-btn" onClick={onStartEdit}>
          {editLabel}
        </button>
      ) : null}
    </div>
  );
}
