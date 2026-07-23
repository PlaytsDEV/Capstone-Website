import { ASSIGN_BRANCH_OPTIONS } from "../maintenanceUtils";

export function AssignBranchModal({
  open,
  branch,
  error = "",
  isPending = false,
  onBranchChange,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;
  const canSubmit = Boolean(branch) && !isPending;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-assign-branch-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
      >
        <h2 id="maintenance-assign-branch-title" className="text-lg font-semibold text-card-foreground">
          Assign Branch
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This request has no branch assigned. Please select the correct branch so it can be managed properly.
        </p>

        <label className="mt-5 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Branch
          </span>
          <select
            value={branch}
            onChange={(event) => onBranchChange(event.target.value)}
            disabled={isPending}
            className="mt-2 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <option value="">Select branch</option>
            {ASSIGN_BRANCH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

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
            className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onConfirm}
            disabled={!canSubmit}
          >
            {isPending ? "Saving..." : "Save Branch"}
          </button>
        </div>
      </section>
    </div>
  );
}
