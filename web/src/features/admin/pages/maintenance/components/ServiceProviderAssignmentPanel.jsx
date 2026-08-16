import { useState } from "react";
import {
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  DollarSign,
  Lightbulb,
  MapPin,
  PhoneCall,
  Sparkles,
  Star,
  UserCheck,
} from "lucide-react";
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

const getStrengthBadgeStyle = (strength = "") => {
  const s = String(strength).toLowerCase();
  if (s.includes("top match") || s.includes("best overall")) {
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700";
  }
  if (s.includes("frequent") || s.includes("preferred")) {
    return "bg-purple-100 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200 border-purple-300 dark:border-purple-700";
  }
  if (s.includes("closest")) {
    return "bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200 border-blue-300 dark:border-blue-700";
  }
  if (s.includes("top rated") || s.includes("rated")) {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-700";
  }
  if (s.includes("price") || s.includes("value")) {
    return "bg-teal-100 text-teal-900 dark:bg-teal-950/80 dark:text-teal-200 border-teal-300 dark:border-teal-700";
  }
  return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700";
};

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
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [isDeckCollapsed, setIsDeckCollapsed] = useState(false);

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

  // Top 5 candidates array from AI suggestion
  const candidateList =
    suggestion?.topProviders ||
    suggestion?.comparison ||
    (suggestion?.recommendedProviderName
      ? [
          {
            rank: 1,
            providerId: suggestion.recommendedProviderId || null,
            providerName: suggestion.recommendedProviderName,
            contactNumber: suggestion.recommendedProviderContact || "",
            location: suggestion.location || `${requestBranch} Area`,
            serviceType: suggestion.serviceType || requestCategory,
            estimatedRateLabel: suggestion.estimatedRateLabel || "Standard Market Rate",
            rating: suggestion.rating || 4.8,
            averageResponseTime: suggestion.averageResponseTime || "1 hour",
            strength: suggestion.bestOptionBadge || "Top Match",
            aiRating: suggestion.aiRating || 95,
            reason: suggestion.reason || "Recommended by Lilycrest AI.",
            source: suggestion.recommendedProviderId ? "directory" : "ai_discovered",
          },
        ]
      : []);

  const displayedCandidates = showAllCandidates
    ? candidateList
    : candidateList.slice(0, 3);

  const handleSelectCandidate = (candidate) => {
    if (candidate.providerId) {
      onChoiceChange(candidate.providerId);
      if (onUseSuggestion) onUseSuggestion(candidate.providerId);
      showNotification({
        title: "Provider Selected",
        message: `Selected ${candidate.providerName} from saved directory.`,
        type: "info",
      });
    } else {
      onChoiceChange(PROVIDER_MANUAL_CHOICE);
      onManualChange("providerName", candidate.providerName || "");
      onManualChange("contactNumber", candidate.contactNumber || "");
      onManualChange("serviceType", candidate.serviceType || requestCategory);
      onManualChange(
        "minRate",
        candidate.minRate != null ? String(candidate.minRate) : "",
      );
      onManualChange(
        "maxRate",
        candidate.maxRate != null ? String(candidate.maxRate) : "",
      );
      onManualChange(
        "notes",
        candidate.notes || candidate.reason || `Discovered via AI Geo-Search for ${requestBranch}.`,
      );
      onSaveForFutureChange(true);
      showNotification({
        title: "Contractor Auto-Filled",
        message: `Auto-filled details for ${candidate.providerName}. Click Save Assignment to confirm.`,
        type: "info",
      });
    }
  };

  const isCandidateCurrentlySelected = (candidate) => {
    if (candidate.providerId && selectedChoice === candidate.providerId) return true;
    if (
      selectedChoice === PROVIDER_MANUAL_CHOICE &&
      manualProvider.providerName.trim().toLowerCase() ===
        String(candidate.providerName || "").trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  };

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3.5">
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
            Current Assigned Contractor
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
            No contractor assigned yet
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

      {/* AI RECOMMENDATION / TOP 5 RANKED DECK */}
      {candidateList.length > 0 && (
        <div className="rounded-xl border border-sky-200/90 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/20 p-3.5 space-y-3">
          <button
            type="button"
            onClick={() => setIsDeckCollapsed((prev) => !prev)}
            className="flex w-full items-center justify-between text-left transition cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
              <h4 className="text-xs font-bold text-sky-950 dark:text-sky-100 group-hover:text-sky-800 dark:group-hover:text-sky-200 transition truncate">
                Top Ranked Nearby Services ({requestBranch})
              </h4>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <span className="rounded bg-sky-100 dark:bg-sky-900/80 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-700">
                {candidateList.length} Found
              </span>
              {isDeckCollapsed ? (
                <ChevronDown size={14} className="text-sky-700 dark:text-sky-300" />
              ) : (
                <ChevronUp size={14} className="text-sky-700 dark:text-sky-300" />
              )}
            </div>
          </button>

          {isDeckCollapsed ? (
            <div
              onClick={() => setIsDeckCollapsed(false)}
              className="rounded-lg border border-sky-200/60 dark:border-sky-800/60 bg-white/70 dark:bg-slate-900/70 p-2 text-xs text-sky-900 dark:text-sky-200 flex items-center justify-between cursor-pointer hover:bg-white dark:hover:bg-slate-900 transition"
            >
              <span className="truncate text-[11px]">
                <span className="font-bold">#1 Top Pick:</span> {candidateList[0]?.providerName} ({candidateList[0]?.location || "Nearby"})
              </span>
              <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 shrink-0 ml-2">
                Click to expand ▾
              </span>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {displayedCandidates.map((candidate, idx) => {
                  const isSelected = isCandidateCurrentlySelected(candidate);
                  return (
                    <div
                      key={candidate.providerId || `${candidate.providerName}-${idx}`}
                      className={`rounded-lg border p-3 text-xs transition space-y-2 ${
                        isSelected
                          ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary"
                          : "border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      {/* Card Top: Rank, Name, Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-bold">
                            #{candidate.rank || idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs">
                              {candidate.providerName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {candidate.serviceType}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {candidate.strength && (
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getStrengthBadgeStyle(
                                candidate.strength,
                              )}`}
                            >
                              {candidate.strength}
                            </span>
                          )}
                          {candidate.aiRating && (
                            <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300">
                              {candidate.aiRating}% Match
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Middle: Key Metrics Row */}
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1 truncate">
                          <MapPin size={11} className="text-rose-500 shrink-0" />
                          <span className="truncate">{candidate.location || "Nearby Branch"}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Star size={11} className="fill-amber-400 text-amber-400 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {candidate.rating ? Number(candidate.rating).toFixed(1) : "4.8"}
                          </span>
                          {candidate.reviewCount ? (
                            <span className="text-slate-400 text-[10px]">({candidate.reviewCount} rev)</span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1">
                          <DollarSign size={11} className="text-emerald-600 shrink-0" />
                          <span className="truncate">{candidate.estimatedRateLabel || "Market Rate"}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Clock size={11} className="text-indigo-500 shrink-0" />
                          <span className="truncate">{candidate.averageResponseTime || "1 hr"}</span>
                        </div>
                      </div>

                      {/* Contact and Action */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                          📞 {candidate.contactNumber || "Contact available upon dispatch"}
                        </div>

                        <button
                          type="button"
                          disabled={disabled || isAssigning}
                          onClick={() => handleSelectCandidate(candidate)}
                          className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition cursor-pointer ${
                            isSelected
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check size={12} />
                              <span>Selected</span>
                            </>
                          ) : (
                            <span>Select & Auto-Fill</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Toggle View More/Less */}
              {candidateList.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllCandidates(!showAllCandidates)}
                  className="w-full py-1.5 text-center text-xs font-semibold text-sky-800 dark:text-sky-200 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>{showAllCandidates ? "Show Top 3 Only" : `Show All ${candidateList.length} Ranked Services`}</span>
                  {showAllCandidates ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Select From Saved Directory Dropdown */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Saved Provider Directory
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
      ) : providers.length === 0 && !showManualFields && candidateList.length === 0 ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          No saved providers for this branch. Click "Suggest AI" to discover nearby services.
        </div>
      ) : null}

      {/* Manual Input Fields */}
      {showManualFields && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3 space-y-2.5 text-xs">
          <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
            Contractor Details
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
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
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
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

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2.5 pt-1">
        <button
          type="button"
          onClick={onSuggest}
          disabled={disabled || isSuggesting || isAssigning}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          <Lightbulb size={13} className="text-amber-500" />
          <span>{isSuggesting ? "Discovering..." : "Suggest AI (Nearby)"}</span>
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

