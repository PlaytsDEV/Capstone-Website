import { useState } from "react";
import { Check, Copy, Lightbulb, PhoneCall } from "lucide-react";
import {
  buildFieldClassName,
  formatBranchLabel,
  formatContractorDispatchTicket,
  getAssignedProviderCategory,
  getAssignedProviderContact,
  getAssignedProviderName,
  getMaintenanceTypeMeta,
  getProviderBranchCoverageLabel,
  getProviderCategoryLabel,
  getProviderRateLabel,
  getRequestBranch,
  PROVIDER_MANUAL_CHOICE,
  PROVIDER_NONE_CHOICE,
} from "../maintenanceUtils";
import { showNotification } from "../../../../../shared/utils/notification";
import { DetailDrawer } from "../../../components/shared";
import { SectionBadge } from "./SectionBadge";

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
  const comparisonRows = Array.isArray(suggestion?.comparison)
    ? suggestion.comparison
    : [];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <DetailDrawer.Section
        label={(
          <>
            <PhoneCall size={14} />
            Assigned Service Provider
            <SectionBadge tone="amber">Admin Only</SectionBadge>
          </>
        )}
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Provider details are internal. Tenants only see updates that admins send manually.
        </p>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Current Assignment
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
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-card-foreground transition hover:bg-muted"
            >
              {isCopied ? <Check size={11} className="text-emerald-700 dark:text-emerald-400" /> : <Copy size={11} />}
              <span>{isCopied ? "Copied!" : "Copy Dispatch Info"}</span>
            </button>
          </div>
          {currentName ? (
            <div className="mt-2 space-y-1 text-card-foreground">
              <div className="font-semibold">{currentName}</div>
              {currentCategory ? <div className="text-xs text-muted-foreground">{currentCategory}</div> : null}
              {currentContact ? (
                <div className="text-xs text-muted-foreground">Contact: {currentContact}</div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">Not assigned yet</div>
          )}
        </div>

        {formMessage ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formMessage}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          <label id="maintenance-update-field-assigned_to" className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Choose Provider
            </span>
            <select
              value={selectedChoice}
              onChange={(event) => onChoiceChange(event.target.value)}
              disabled={disabled || isAssigning}
              aria-invalid={Boolean(fieldErrors.assigned_to)}
              className={buildFieldClassName(
                Boolean(fieldErrors.assigned_to),
                "mt-2 h-11 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
              )}
            >
              <option value={PROVIDER_NONE_CHOICE}>Not assigned yet</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.providerName}
                </option>
              ))}
              <option value={PROVIDER_MANUAL_CHOICE}>Other / Manual Entry</option>
            </select>
            {fieldErrors.assigned_to ? (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.assigned_to}</p>
            ) : null}
          </label>

          {isLoadingProviders ? (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Loading service providers...
            </div>
          ) : providers.length === 0 ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-warning-dark">
              {hasRequestBranch
                ? "No matching service providers found for this branch and request type. Use Manual Entry."
                : "This request is missing a branch. Repair the branch before choosing a saved provider."}
            </div>
          ) : null}

          {selectedProvider ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="font-semibold text-card-foreground">{selectedProvider.providerName}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Category: {getProviderCategoryLabel(selectedProvider)}
              </div>
              <div className="text-xs text-muted-foreground">
                Branches: {getProviderBranchCoverageLabel(selectedProvider)}
              </div>
              <div className="text-xs text-muted-foreground">
                Contact: {selectedProvider.contactNumber}
              </div>
              <div className="text-xs text-muted-foreground">
                Estimated rate: {getProviderRateLabel(selectedProvider)}
              </div>
              {selectedProvider.notes ? (
                <div className="mt-2 text-xs text-muted-foreground">{selectedProvider.notes}</div>
              ) : null}
            </div>
          ) : null}

          {showManualFields ? (
            <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Provider Name
                </span>
                <input
                  id="maintenance-provider-field-providerName"
                  value={manualProvider.providerName}
                  onChange={(event) => onManualChange("providerName", event.target.value)}
                  disabled={disabled || isAssigning}
                  className={buildFieldClassName(
                    Boolean(fieldErrors.providerName),
                    "mt-2 h-10 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
                  )}
                  placeholder="Provider or company name"
                />
                {fieldErrors.providerName ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.providerName}</p> : null}
              </label>
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Contact Number
                </span>
                <input
                  id="maintenance-provider-field-contactNumber"
                  inputMode="numeric"
                  maxLength={11}
                  value={manualProvider.contactNumber}
                  onChange={(event) => onManualChange("contactNumber", event.target.value)}
                  disabled={disabled || isAssigning}
                  className={buildFieldClassName(
                    Boolean(fieldErrors.contactNumber),
                    "mt-2 h-10 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
                  )}
                  placeholder="09XXXXXXXXX"
                />
                {fieldErrors.contactNumber ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.contactNumber}</p> : null}
              </label>
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Service Type
                </span>
                <input
                  id="maintenance-provider-field-serviceType"
                  value={manualProvider.serviceType}
                  onChange={(event) => onManualChange("serviceType", event.target.value)}
                  disabled={disabled || isAssigning}
                  className={buildFieldClassName(
                    Boolean(fieldErrors.serviceType),
                    "mt-2 h-10 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
                  )}
                  placeholder={requestCategory}
                />
                {fieldErrors.serviceType ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.serviceType}</p> : null}
              </label>
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Estimated Min Rate
                </span>
                <input
                  id="maintenance-provider-field-minRate"
                  inputMode="decimal"
                  value={manualProvider.minRate}
                  onChange={(event) => onManualChange("minRate", event.target.value)}
                  disabled={disabled || isAssigning}
                  className={buildFieldClassName(
                    Boolean(fieldErrors.minRate),
                    "mt-2 h-10 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
                  )}
                  placeholder="800"
                />
                {fieldErrors.minRate ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.minRate}</p> : null}
              </label>
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Estimated Max Rate
                </span>
                <input
                  id="maintenance-provider-field-maxRate"
                  inputMode="decimal"
                  value={manualProvider.maxRate}
                  onChange={(event) => onManualChange("maxRate", event.target.value)}
                  disabled={disabled || isAssigning}
                  className={buildFieldClassName(
                    Boolean(fieldErrors.maxRate),
                    "mt-2 h-10 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
                  )}
                  placeholder="1500"
                />
                {fieldErrors.maxRate ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.maxRate}</p> : null}
              </label>
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Notes
                </span>
                <textarea
                  id="maintenance-provider-field-notes"
                  rows="3"
                  value={manualProvider.notes}
                  onChange={(event) => onManualChange("notes", event.target.value)}
                  disabled={disabled || isAssigning}
                  aria-invalid={Boolean(fieldErrors.notes)}
                  className={buildFieldClassName(
                    Boolean(fieldErrors.notes),
                    "mt-2 w-full rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground focus:outline-none focus:ring-2",
                  )}
                  placeholder="Optional internal provider notes"
                />
                {fieldErrors.notes ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.notes}</p> : null}
              </label>
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveForFuture}
                  onChange={(event) => onSaveForFutureChange(event.target.checked)}
                  disabled={disabled || isAssigning || !hasRequestBranch}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  {hasRequestBranch
                    ? `Save this provider for future use in ${requestBranch} ${requestCategory} requests.`
                    : "Repair the request branch before saving this provider for future use."}
                </span>
              </label>
            </div>
          ) : null}

          {suggestion ? (
            <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-sky-800">
              {suggestion.recommendedProviderName ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold">Recommended: {suggestion.recommendedProviderName}</div>
                    {suggestion.bestOptionBadge ? (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-900">
                        {suggestion.bestOptionBadge}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-sky-900">
                    {suggestion.serviceType ? `${suggestion.serviceType} service` : "Maintenance service"}
                    {" - "}
                    {suggestion.estimatedRateLabel || "Rate not recorded"}
                  </div>
                  <div className="mt-2">{suggestion.reason}</div>
                  {comparisonRows.length ? (
                    <div className="mt-3 overflow-x-auto rounded-lg border border-sky-100 bg-white">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-sky-50 text-sky-900">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Provider</th>
                            <th className="px-3 py-2 font-semibold">Estimated Rate</th>
                            <th className="px-3 py-2 font-semibold">Strength</th>
                            <th className="px-3 py-2 font-semibold">AI Rating</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sky-100 text-sky-900">
                          {comparisonRows.map((row) => (
                            <tr key={row.providerId || row.providerName}>
                              <td className="px-3 py-2 font-medium">{row.providerName}</td>
                              <td className="px-3 py-2">{row.estimatedRateLabel || "Rate not recorded"}</td>
                              <td className="px-3 py-2">{row.strength || "Recommended option"}</td>
                              <td className="px-3 py-2">{row.aiRating ?? 0}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs text-sky-900">
                    Rates are estimated and may change depending on the actual repair scope.
                  </p>
                  <button
                    type="button"
                    className="mt-3 inline-flex h-8 items-center justify-center rounded-md bg-sky-900 px-3 text-xs font-semibold text-white hover:bg-sky-950 disabled:opacity-60"
                    onClick={() => onUseSuggestion(suggestion.recommendedProviderId)}
                    disabled={disabled || isAssigning}
                  >
                    Select Provider
                  </button>
                </>
              ) : (
                suggestion.message || "No matching saved providers found for this branch and request type."
              )}
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            AI suggestions are based on saved maintenance records and provider directory. Please review before confirming.
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-60"
              onClick={onSuggest}
              disabled={disabled || isSuggesting || isAssigning}
            >
              <Lightbulb size={14} />
              {isSuggesting ? "Suggesting..." : "Suggest Provider"}
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-60"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
              onClick={onAssign}
              disabled={disabled || assignmentDisabled || isAssigning || !hasAssignmentChanges || Object.keys(fieldErrors).some((key) => Boolean(fieldErrors[key]))}
              title={!hasAssignmentChanges ? "No assignment changes to save." : undefined}
            >
              {isAssigning ? "Saving..." : "Save Assignment"}
            </button>
          </div>
        </div>
      </DetailDrawer.Section>
    </div>
  );
}
