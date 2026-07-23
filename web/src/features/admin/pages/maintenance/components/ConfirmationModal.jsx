export function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel,
  confirmTone = "rose",
  isPending = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const confirmClassName =
    confirmTone === "emerald"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : "bg-rose-600 text-white hover:bg-rose-700";

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-confirm-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
      >
        <h2 id="maintenance-confirm-title" className="text-lg font-semibold text-card-foreground">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
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
            className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName}`}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Working..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
