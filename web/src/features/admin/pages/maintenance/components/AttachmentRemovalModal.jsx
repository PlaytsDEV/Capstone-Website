import { ATTACHMENT_REMOVAL_REASONS } from "../maintenanceUtils";

export function AttachmentRemovalModal({
  open,
  scope,
  reason,
  customReason,
  error,
  isPending = false,
  onScopeChange,
  onReasonChange,
  onCustomReasonChange,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const hasScope = Boolean(scope);
  const hasReason = reason && (reason !== "Other" || Boolean(customReason.trim()));
  const canSubmit = hasScope && hasReason && !isPending;
  const options = [
    {
      value: "tenant_only",
      title: "Remove for Tenant",
      description:
        "The tenant will no longer be able to view or download this attachment. Admins can still see the removal record in the maintenance timeline.",
    },
    {
      value: "request",
      title: "Remove from Request",
      description:
        "This attachment will be hidden from normal admin and tenant attachment displays. A removal record will still remain in the admin timeline.",
    },
  ];

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-remove-attachment-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl"
      >
        <h2 id="maintenance-remove-attachment-title" className="text-lg font-semibold text-card-foreground">
          Who should no longer see this attachment?
        </h2>

        <div className="mt-4 grid gap-3">
          {options.map((option) => {
            const selected = scope === option.value;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition ${
                  selected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="attachment-removal-scope"
                  value={option.value}
                  checked={selected}
                  onChange={() => onScopeChange(option.value)}
                  className="mt-1 h-4 w-4 accent-primary"
                  disabled={isPending}
                />
                <span>
                  <span className="block text-sm font-semibold text-card-foreground">{option.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <label className="mt-5 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Reason for removal
          </span>
          <select
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            disabled={isPending}
            className="mt-2 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <option value="">Select a reason</option>
            {ATTACHMENT_REMOVAL_REASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {reason === "Other" ? (
          <label className="mt-4 block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Please specify reason
            </span>
            <textarea
              rows="3"
              value={customReason}
              onChange={(event) => onCustomReasonChange(event.target.value)}
              disabled={isPending}
              className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-100"
              placeholder="Enter a clear removal reason."
            />
          </label>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onConfirm}
            disabled={!canSubmit}
          >
            {isPending ? "Removing..." : "Remove Attachment"}
          </button>
        </div>
      </section>
    </div>
  );
}
