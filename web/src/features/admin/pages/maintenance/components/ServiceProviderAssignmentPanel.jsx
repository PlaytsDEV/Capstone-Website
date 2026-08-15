import { useState } from "react";
import { Check, Copy, Lightbulb, PhoneCall, Sparkles, UserCheck } from "lucide-react";
import {
  formatBranchLabel,
  formatContractorDispatchTicket,
  getAssignedProviderCategory,
  getAssignedProviderContact,
  getAssignedProviderName,
  getMaintenanceTypeMeta,
  getProviderCategoryLabel,
  getRequestBranch,
  PROVIDER_MANUAL_CHOICE,
  PROVIDER_NONE_CHOICE,
} from "../maintenanceUtils";
import { showNotification } from "../../../../../shared/utils/notification";

export function ServiceProviderAssignmentPanel({
  request,
  providers = [],
  isLoadingProviders = false,
  selectedChoice,
  manualProvider,
  saveForFuture,
  fieldErrors = {},
  formMessage = "",
  suggestion = null,
  isAssigning = false,
  isSuggesting = false,
  disabled = false,
  assignmentDisabled = false,
  onChoiceChange,
  onManualChange,
  onSaveForFutureChange,
  onAssign,
  onSuggest,
  onUseSuggestion,
}) {
  const [isCopied, setIsCopied] = useState(false);
  const currentName = getAssignedProviderName(request);
  const currentContact = getAssignedProviderContact(request);
  const currentCategory = getAssignedProviderCategory(request);
  const currentNotes =
    request?.assignedProvider?.notes ||
    request?.assignedProviderNotes ||
    "";
  const currentProviderId =
    request?.assignedProvider?.id ||
    request?.assignedProviderId ||
    "";
  const currentProviderSource =
    request?.assignedProvider?.source ||
    request?.assignedProviderSource ||
    (currentName ? (currentProviderId ? "directory" : "manual") : "none");
  const selectedProvider = providers.find((provider) => provider.id === selectedChoice);
  const showManualFields = selectedChoice === PROVIDER_MANUAL_CHOICE;
  const requestBranch = formatBranchLabel(getRequestBranch(request));
  const hasRequestBranch = Boolean(getRequestBranch(request));
  const requestCategory = request?.request_type
    ? getMaintenanceTypeMeta(request.request_type).label
    : "Maintenance";
  const manualValuesChanged =
    manualProvider.providerName.trim() !== String(currentName || "").trim() ||
    manualProvider.contactNumber.trim() !== String(currentContact || "").trim() ||
    manualProvider.serviceType.trim() !== String(currentCategory || "").trim() ||
    String(manualProvider.minRate || "").trim() ||
    String(manualProvider.maxRate || "").trim() ||
    manualProvider.notes.trim() !== String(currentNotes || "").trim();
  const hasAssignmentChanges =
    selectedChoice === PROVIDER_NONE_CHOICE
      ? Boolean(currentName || currentProviderId)
      : selectedChoice === PROVIDER_MANUAL_CHOICE
      ? currentProviderSource !== "manual" || manualValuesChanged || saveForFuture
      : selectedChoice !== currentProviderId ||
        currentProviderSource !== "directory" ||
        manualProvider.notes.trim() !== String(currentNotes || "").trim();

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <PhoneCall size={15} className="text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Contractor & Dispatch
          </h3>
        </div>
        <span className="rounded bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          Admin Only
        </span>
      </div>

      {/* Current Assignment Status Box */}
      <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Current Status
          </span>
          <button
            type="button"
            onClick={() => {
              const text = formatContractorDispatchTicket(request);
              navigator.clipboard?.writeText(text);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 2000);
              showNotification({
                title: "Dispatch Ticket Copied",
                message: "Formatted contractor dispatch instructions copied to clipboard.",
                type: "success",
              });
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            {isCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
            <span>{isCopied ? "Copied" : "Copy Dispatch"}</span>
          </button>
        </div>

        {currentName ? (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <UserCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {currentName}
              </span>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
              {currentContact || currentCategory || "Assigned"}
            </span>
          </div>
        ) : (
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium italic pt-0.5">
            Not assigned yet
          </div>
        )}
      </div>

      {disabled ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/60 p-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
          This ticket is marked as <span className="font-bold capitalize">{request?.status || "closed"}</span> and cannot be modified.
        </div>
      ) : formMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {formMessage}
        </div>
      ) : null}

      {/* Select Provider */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Choose Service Provider
        </label>
        <select
          value={selectedChoice}
          onChange={(event) => onChoiceChange(event.target.value)}
          disabled={disabled || isAssigning}
          className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition cursor-pointer"
        >
          <option value={PROVIDER_NONE_CHOICE}>Not assigned yet</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.providerName} ({getProviderCategoryLabel(provider)})
            </option>
          ))}
          <option value={PROVIDER_MANUAL_CHOICE}>Other / Manual Entry</option>
        </select>
      </div>

      {isLoadingProviders ? (
        <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 px-3 py-2 text-xs text-slate-400">
          Loading providers...
        </div>
      ) : providers.length === 0 && !showManualFields ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          No saved providers for this branch. Choose Manual Entry.
        </div>
      ) : null}

      {/* Manual Input Fields */}
      {showManualFields && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3 space-y-2.5 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Provider Name
              </label>
              <input
                value={manualProvider.providerName}
                onChange={(e) => onManualChange("providerName", e.target.value)}
                placeholder="e.g. QuickFix Plumbing"
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Contact Number
              </label>
              <input
                inputMode="numeric"
                maxLength={11}
                value={manualProvider.contactNumber}
                onChange={(e) => onManualChange("contactNumber", e.target.value)}
                placeholder="09XXXXXXXXX"
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer pt-0.5">
            <input
              type="checkbox"
              checked={saveForFuture}
              onChange={(e) => onSaveForFutureChange(e.target.checked)}
              disabled={!hasRequestBranch}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 accent-primary cursor-pointer"
            />
            <span>Save for future {requestBranch} {requestCategory} requests</span>
          </label>
        </div>
      )}

      {/* AI Recommendation Banner */}
      {suggestion && (
        <div className="rounded-lg border border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/30 p-3 text-xs text-sky-950 dark:text-sky-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles size={13} className="text-sky-600 dark:text-sky-400" />
              <span>AI Recommendation</span>
            </div>
            {suggestion.bestOptionBadge && (
              <span className="rounded bg-sky-200/80 dark:bg-sky-900/80 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-200">
                {suggestion.bestOptionBadge}
              </span>
            )}
          </div>
          <p className="text-xs text-sky-800 dark:text-sky-200 leading-relaxed">
            {suggestion.recommendedProviderName ? `${suggestion.recommendedProviderName} — ${suggestion.reason}` : suggestion.message}
          </p>
          {suggestion.recommendedProviderId && (
            <button
              type="button"
              onClick={() => onUseSuggestion(suggestion.recommendedProviderId)}
              className="inline-flex h-7.5 items-center rounded-md bg-sky-700 px-3 text-xs font-bold text-white shadow-sm hover:bg-sky-800 transition cursor-pointer"
            >
              Select Recommended Provider
            </button>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2.5 pt-1">
        <button
          type="button"
          onClick={onSuggest}
          disabled={disabled || isSuggesting || isAssigning}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          <Lightbulb size={13} className="text-amber-500" />
          <span>{isSuggesting ? "Suggesting..." : "Suggest AI"}</span>
        </button>

        <button
          type="button"
          onClick={onAssign}
          disabled={disabled || assignmentDisabled || isAssigning || !hasAssignmentChanges}
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
        >
          <span>{isAssigning ? "Saving..." : "Save Assignment"}</span>
        </button>
      </div>
    </div>
  );
}
