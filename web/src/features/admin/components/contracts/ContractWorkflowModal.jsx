import { useEffect, useState } from "react";

export default function ContractWorkflowModal({ dialog, busy, onCancel, onSubmit }) {
  const [values, setValues] = useState({});
  useEffect(() => setValues(dialog?.initialValues || {}), [dialog]);
  if (!dialog) return null;
  const fields = dialog.fields || [];
  const checks = dialog.checks || [];
  const valid = fields.every((field) => !field.required || String(values[field.key] || "").trim()) &&
    checks.every((check) => values[check.key] === true);
  return <div className="contract-confirm" role="dialog" aria-modal="true" aria-labelledby="contract-workflow-title">
    <h3 id="contract-workflow-title">{dialog.title}</h3>
    {dialog.message && <p>{dialog.message}</p>}
    {fields.map((field) => <label className="contract-field" key={field.key}><span>{field.label}</span>
      {field.type === "textarea"
        ? <textarea value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}/>
        : <input type={field.type || "text"} value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}/>}
    </label>)}
    {checks.map((check) => <label className="contract-check" key={check.key}>
      <input type="checkbox" checked={values[check.key] === true}
        onChange={(event) => setValues((current) => ({ ...current, [check.key]: event.target.checked }))}/>
      {check.label}
    </label>)}
    <div className="contract-action-row">
      <button className="contract-button contract-button--secondary" type="button" onClick={onCancel}>Cancel</button>
      {dialog.secondaryAction && <button className="contract-button contract-button--secondary"
        type="button" disabled={busy} onClick={dialog.secondaryAction.onClick}>
        {dialog.secondaryAction.label}
      </button>}
      <button className="contract-button" type="button" disabled={!valid || busy}
        onClick={() => onSubmit(values)}>{busy ? "Saving…" : dialog.submitLabel}</button>
    </div>
  </div>;
}
