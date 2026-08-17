import { useState } from "react";
import {
  Building2,
  Check,
  Clock,
  Copy,
  DollarSign,
  Lightbulb,
  MapPin,
  PhoneCall,
  Sparkles,
  Star,
  UserCheck,
  Wrench,
  BookOpen,
  X,
  ChevronDown,
  ChevronUp,
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

const IN_HOUSE_TEAM_NAME = "Lilycrest Facilities Team";
const IN_HOUSE_TEAM_PHONE = "09171234567";

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
  embedded = false,
  hideActions = false,
}) {
  const [isCopied, setIsCopied] = useState(false);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [isDeckCollapsed, setIsDeckCollapsed] = useState(false);

  // Determine active dispatch mode: 'in_house' | 'manual' | 'directory'
  const [dispatchMode, setDispatchMode] = useState(() => {
    if (selectedChoice && selectedChoice !== PROVIDER_NONE_CHOICE && selectedChoice !== PROVIDER_MANUAL_CHOICE) {
      return "directory";
    }
    if (manualProvider?.providerName === IN_HOUSE_TEAM_NAME) {
      return "in_house";
    }
    if (selectedChoice === PROVIDER_MANUAL_CHOICE || manualProvider?.providerName) {
      return "manual";
    }
    return "in_house";
  });

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
  const requestBranch = formatBranchLabel(getRequestBranch(request));
  const hasRequestBranch = Boolean(getRequestBranch(request));
  const requestCategory = request?.request_type
    ? getMaintenanceTypeMeta(request.request_type).label
    : "Maintenance";

  const manualValuesChanged =
    Boolean(manualProvider?.providerName?.trim()) ||
    Boolean(manualProvider?.contactNumber?.trim()) ||
    Boolean(manualProvider?.serviceType?.trim()) ||
    Boolean(manualProvider?.notes?.trim());

  const hasAssignmentChanges =
    selectedChoice === PROVIDER_NONE_CHOICE
      ? Boolean(currentName || currentProviderId)
      : selectedChoice === PROVIDER_MANUAL_CHOICE
      ? currentProviderSource !== "manual" || manualValuesChanged || saveForFuture
      : selectedChoice !== currentProviderId ||
        currentProviderSource !== "directory" ||
        manualProvider.notes.trim() !== String(currentNotes || "").trim();

  // Mode Selection Handlers
  const handleSelectInHouse = () => {
    setDispatchMode("in_house");
    onChoiceChange(PROVIDER_MANUAL_CHOICE);
    onManualChange("providerName", IN_HOUSE_TEAM_NAME);
    onManualChange("contactNumber", IN_HOUSE_TEAM_PHONE);
    onManualChange("serviceType", requestCategory);
    onManualChange("notes", `Assigned to in-house Lilycrest ${requestBranch} facilities staff.`);
    onSaveForFutureChange(false);
  };

  const handleSelectManual = () => {
    setDispatchMode("manual");
    onChoiceChange(PROVIDER_MANUAL_CHOICE);
    if (manualProvider?.providerName === IN_HOUSE_TEAM_NAME) {
      onManualChange("providerName", "");
      onManualChange("contactNumber", "");
      onManualChange("notes", "");
    }
  };

  const handleSelectDirectoryMode = () => {
    setDispatchMode("directory");
    if (providers.length > 0) {
      const isCurrentInList = providers.some((p) => p.id === selectedChoice);
      if (!isCurrentInList) {
        onChoiceChange(providers[0].id);
      }
    } else {
      onChoiceChange(PROVIDER_NONE_CHOICE);
    }
  };

  // Top candidates array from AI suggestion (Empty at first until searched)
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
    setDispatchMode("manual");
    if (candidate.providerId) {
      onChoiceChange(candidate.providerId);
      if (onUseSuggestion) onUseSuggestion(candidate.providerId);
      showNotification({
        title: "Provider Selected",
        message: `Selected ${candidate.providerName} from saved directory.`,
        type: "success",
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
        message: `Auto-filled details for ${candidate.providerName}.`,
        type: "success",
      });
    }
    setIsDeckCollapsed(true);
  };

  const isCandidateCurrentlySelected = (candidate) => {
    if (candidate.providerId && selectedChoice === candidate.providerId) return true;
    if (
      selectedChoice === PROVIDER_MANUAL_CHOICE &&
      manualProvider?.providerName?.trim().toLowerCase() ===
        String(candidate.providerName || "").trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  };

  const activeAssignedName =
    dispatchMode === "in_house"
      ? manualProvider?.providerName?.trim() || IN_HOUSE_TEAM_NAME
      : selectedChoice === PROVIDER_MANUAL_CHOICE
      ? manualProvider?.providerName?.trim()
      : selectedProvider
      ? selectedProvider.providerName
      : currentName;

  const activeAssignedContact =
    dispatchMode === "in_house"
      ? manualProvider?.contactNumber?.trim() || IN_HOUSE_TEAM_PHONE
      : selectedChoice === PROVIDER_MANUAL_CHOICE
      ? manualProvider?.contactNumber?.trim()
      : selectedProvider
      ? selectedProvider.contactNumber
      : currentContact;

  const activeAssignedCategory =
    dispatchMode === "in_house"
      ? manualProvider?.serviceType?.trim() || requestCategory
      : selectedChoice === PROVIDER_MANUAL_CHOICE
      ? manualProvider?.serviceType?.trim() || requestCategory
      : selectedProvider
      ? getProviderCategoryLabel(selectedProvider)
      : currentCategory || requestCategory;

  const handleCopyDispatchText = async () => {
    const text = formatContractorDispatchTicket(request, {
      providerName: activeAssignedName,
      providerContact: activeAssignedContact,
      category: activeAssignedCategory,
      notes: manualProvider?.notes || currentNotes,
      dispatchMode,
    });

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      showNotification({
        title: "Dispatch Ticket Copied",
        message: "Formatted contractor dispatch instructions copied to clipboard.",
        type: "success",
      });
    } catch {
      showNotification({
        title: "Copy Failed",
        message: "Could not automatically copy text to clipboard.",
        type: "error",
      });
    }
  };

  return (
    <div className={embedded ? "space-y-3.5" : "rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3.5"}>
      {/* Step 1 Header */}
      {!embedded ? (
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <PhoneCall size={16} className="text-slate-700 dark:text-slate-300" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Contractor &amp; Dispatch
            </h3>
          </div>
          <span className="rounded bg-transparent px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Admin Only
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0A1628] text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-bold shadow-2xs">
              1
            </span>
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
              Assign Service Contractor
            </h4>
          </div>

          <span className="rounded bg-transparent px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Required *
          </span>
        </div>
      )}

      {disabled ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/60 p-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
          This ticket is marked as <span className="font-bold capitalize">{request?.status || "closed"}</span> and cannot be modified.
        </div>
      ) : formMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {formMessage}
        </div>
      ) : null}

      {/* 1. SEGMENTED DISPATCH MODE SWITCHER */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700">
          {/* Option 1: In-House Staff */}
          <button
            type="button"
            disabled={disabled || isAssigning}
            onClick={handleSelectInHouse}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer active:scale-[0.98] ${
              dispatchMode === "in_house"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/90 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Building2 size={13} className={dispatchMode === "in_house" ? "text-slate-900 dark:text-slate-100" : "text-slate-400"} />
            <span className="truncate">In-House Staff</span>
          </button>

          {/* Option 2: AI & External Contractor */}
          <button
            type="button"
            disabled={disabled || isAssigning}
            onClick={handleSelectManual}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer active:scale-[0.98] ${
              dispatchMode === "manual"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/90 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Sparkles size={13} className={dispatchMode === "manual" ? "text-amber-500" : "text-slate-400"} />
            <span className="truncate">AI &amp; External Contractor</span>
          </button>

          {/* Option 3: Saved Services */}
          <button
            type="button"
            disabled={disabled || isAssigning}
            onClick={handleSelectDirectoryMode}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer active:scale-[0.98] ${
              dispatchMode === "directory"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/90 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <BookOpen size={13} className={dispatchMode === "directory" ? "text-slate-900 dark:text-slate-100" : "text-slate-400"} />
            <span className="truncate">Saved Services</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                dispatchMode === "directory"
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
              }`}
            >
              {providers.length}
            </span>
          </button>
        </div>
      </div>

      {/* 2. UNIFIED HARMONIOUS CARD BODY */}

      {/* Mode A: In-House Staff Single Card with Editable Staff Information */}
      {dispatchMode === "in_house" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3.5 shadow-2xs text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-slate-700 dark:text-slate-300 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block">
                  In-House Facilities Staff
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  On-site internal dormitory maintenance for {requestBranch}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSelectInHouse}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 active:scale-[0.98] cursor-pointer"
              title="Reset to standard facilities team defaults"
            >
              Reset to Defaults
            </button>
          </div>

          {/* Form Inputs Grid for In-House Staff */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Staff Name */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Staff / Technician Name *
                </label>
                <span className="text-[10px] text-slate-400">
                  {manualProvider?.providerName?.length || 0}/80
                </span>
              </div>
              <input
                maxLength={80}
                value={manualProvider?.providerName || ""}
                onChange={(e) => onManualChange("providerName", e.target.value)}
                placeholder="e.g. Lilycrest Facilities Team / Kuya Jun"
                className={`h-9 w-full rounded-lg border bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition ${
                  fieldErrors?.providerName || (manualProvider?.providerName && manualProvider.providerName.trim().length < 3)
                    ? "border-rose-500 ring-1 ring-rose-500/20"
                    : "border-slate-300 dark:border-slate-700 focus:border-slate-900 dark:focus:border-slate-100 focus:ring-1 focus:ring-slate-900/10"
                }`}
              />
              {(fieldErrors?.providerName || (manualProvider?.providerName && manualProvider.providerName.trim().length < 3)) && (
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  {fieldErrors?.providerName || "Staff name must be at least 3 characters."}
                </p>
              )}
            </div>

            {/* Contact Number */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Contact Number *
                </label>
                <span className="text-[10px] text-slate-400">
                  {manualProvider?.contactNumber?.length || 0}/11
                </span>
              </div>
              <input
                inputMode="numeric"
                maxLength={11}
                value={manualProvider?.contactNumber || ""}
                onChange={(e) => onManualChange("contactNumber", e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="09XXXXXXXXX"
                className={`h-9 w-full rounded-lg border bg-white dark:bg-slate-900 px-3 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition ${
                  fieldErrors?.contactNumber || (manualProvider?.contactNumber && (!manualProvider.contactNumber.startsWith("09") || manualProvider.contactNumber.length !== 11))
                    ? "border-rose-500 ring-1 ring-rose-500/20"
                    : "border-slate-300 dark:border-slate-700 focus:border-slate-900 dark:focus:border-slate-100 focus:ring-1 focus:ring-slate-900/10"
                }`}
              />
              {(fieldErrors?.contactNumber || (manualProvider?.contactNumber && (!manualProvider.contactNumber.startsWith("09") || manualProvider.contactNumber.length !== 11))) && (
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  {fieldErrors?.contactNumber || "Must be an 11-digit Philippine mobile starting with 09."}
                </p>
              )}
            </div>
          </div>

          {/* Integrated Tenant Preview & Copy Dispatch Footer */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 min-w-0">
              <span className="font-semibold text-slate-500">Tenant sees:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                Authorized {requestCategory} Specialist
              </span>
              <span className="text-[10px] text-slate-400 italic shrink-0">
                (On-site facilities dispatch)
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyDispatchText}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs shrink-0 active:scale-[0.98]"
            >
              {isCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
              <span>{isCopied ? "Copied" : "Copy Dispatch"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode B: AI & External Contractor Unified Card */}
      {dispatchMode === "manual" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3.5 text-xs shadow-2xs">
          {/* Card Header with Integrated AI Discover Action */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block">
                External Contractor &amp; AI Match
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Discover nearby verified providers with AI or enter external technician details
              </span>
            </div>

            <button
              type="button"
              onClick={onSuggest}
              disabled={disabled || isSuggesting || isAssigning}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs active:scale-[0.98]"
            >
              <Sparkles size={12} className="text-amber-500" />
              <span>{isSuggesting ? "Searching Nearby..." : "Suggest AI (Nearby)"}</span>
            </button>
          </div>

          {/* AI Search Results List (Empty at first, populated upon clicking Suggest AI) */}
          {candidateList.length > 0 && (
            isDeckCollapsed ? (
              <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/50 p-3 border border-slate-200/90 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-500" />
                    <span>AI Selected Service ({requestBranch})</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDeckCollapsed(false)}
                      className="text-[11px] text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                    >
                      <span>Change / View {candidateList.length} Options</span>
                      <ChevronDown size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onUseSuggestion) onUseSuggestion(null);
                      }}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-0.5 cursor-pointer font-medium"
                      title="Clear search results"
                    >
                      <X size={12} />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

                {/* Display Chosen Candidate Card */}
                {(() => {
                  const selectedCandidate =
                    candidateList.find((c) => isCandidateCurrentlySelected(c)) || candidateList[0];
                  return (
                    <div className="rounded-lg border border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 transition space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-bold">
                            #{selectedCandidate.rank || 1}
                          </span>
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {selectedCandidate.providerName}
                          </span>
                          {selectedCandidate.strength && (
                            <span className="rounded bg-transparent text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[9px] font-bold shrink-0">
                              {selectedCandidate.strength}
                            </span>
                          )}
                        </div>

                        {selectedCandidate.rating && (
                          <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            <Star size={11} className="fill-amber-500 text-amber-500" />
                            <span>{selectedCandidate.rating}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {selectedCandidate.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} className="text-slate-400" />
                            <span>{selectedCandidate.location}</span>
                          </span>
                        )}
                        {selectedCandidate.averageResponseTime && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-slate-400" />
                            <span>{selectedCandidate.averageResponseTime} response</span>
                          </span>
                        )}
                        {selectedCandidate.estimatedRateLabel && (
                          <span className="flex items-center gap-1">
                            <DollarSign size={11} className="text-slate-400" />
                            <span>{selectedCandidate.estimatedRateLabel}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                          📞 {selectedCandidate.contactNumber || "Available upon assignment"}
                        </span>

                        <span className="inline-flex h-6 items-center gap-1 rounded-md px-2.5 text-[11px] font-bold bg-emerald-600 text-white shadow-xs">
                          <Check size={11} />
                          <span>Selected</span>
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/50 p-3 border border-slate-200/90 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-500" />
                    <span>AI Ranked Nearby Services ({requestBranch})</span>
                    <span className="rounded bg-slate-200/80 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      {candidateList.length} Found
                    </span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDeckCollapsed(true)}
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-0.5 cursor-pointer font-medium"
                      title="Minimize options"
                    >
                      <ChevronUp size={12} />
                      <span>Minimize</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onUseSuggestion) onUseSuggestion(null);
                      }}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-0.5 cursor-pointer font-medium"
                      title="Clear search results"
                    >
                      <X size={12} />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                {displayedCandidates.map((candidate, idx) => {
                  const isSelected = isCandidateCurrentlySelected(candidate);
                  return (
                    <div
                      key={candidate.providerId || `${candidate.providerName}-${idx}`}
                      className={`rounded-lg border p-2.5 transition space-y-1.5 ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
                          : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-bold">
                            #{candidate.rank || idx + 1}
                          </span>
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {candidate.providerName}
                          </span>
                          {candidate.strength && (
                            <span className="rounded bg-transparent text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[9px] font-bold shrink-0">
                              {candidate.strength}
                            </span>
                          )}
                        </div>

                        {candidate.rating && (
                          <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            <Star size={11} className="fill-amber-500 text-amber-500" />
                            <span>{candidate.rating}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {candidate.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} className="text-slate-400" />
                            <span>{candidate.location}</span>
                          </span>
                        )}
                        {candidate.averageResponseTime && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-slate-400" />
                            <span>{candidate.averageResponseTime} response</span>
                          </span>
                        )}
                        {candidate.estimatedRateLabel && (
                          <span className="flex items-center gap-1">
                            <DollarSign size={11} className="text-slate-400" />
                            <span>{candidate.estimatedRateLabel}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                          📞 {candidate.contactNumber || "Available upon assignment"}
                        </span>

                        <button
                          type="button"
                          disabled={disabled || isAssigning}
                          onClick={() => handleSelectCandidate(candidate)}
                          className={`inline-flex h-6 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition cursor-pointer active:scale-[0.98] ${
                            isSelected
                              ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold shadow-xs"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check size={11} />
                              <span>Selected</span>
                            </>
                          ) : (
                            <span>Select &amp; Auto-Fill</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {candidateList.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllCandidates(!showAllCandidates)}
                  className="w-full py-1 text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                >
                  {showAllCandidates ? (
                    <>
                      <span>Show Top 3 Only</span>
                      <ChevronUp size={12} />
                    </>
                  ) : (
                    <>
                      <span>View All {candidateList.length} Recommendations</span>
                      <ChevronDown size={12} />
                    </>
                  )}
                </button>
              )}
            </div>
          ))}

          {/* Form Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Provider Name */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Provider / Technician Name *
                </label>
                <span className="text-[10px] text-slate-400">
                  {manualProvider?.providerName?.length || 0}/80
                </span>
              </div>
              <input
                maxLength={80}
                value={manualProvider?.providerName || ""}
                onChange={(e) => onManualChange("providerName", e.target.value)}
                placeholder="e.g. QuickFix Services"
                className={`h-9 w-full rounded-lg border bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition ${
                  fieldErrors?.providerName || (manualProvider?.providerName && manualProvider.providerName.trim().length < 3)
                    ? "border-rose-500 ring-1 ring-rose-500/20"
                    : "border-slate-300 dark:border-slate-700 focus:border-slate-900 dark:focus:border-slate-100 focus:ring-1 focus:ring-slate-900/10"
                }`}
              />
              {(fieldErrors?.providerName || (manualProvider?.providerName && manualProvider.providerName.trim().length < 3)) && (
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  {fieldErrors?.providerName || "Provider name must be at least 3 characters."}
                </p>
              )}
            </div>

            {/* Contact Number */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Contact Number *
                </label>
                <span className="text-[10px] text-slate-400">
                  {manualProvider?.contactNumber?.length || 0}/11
                </span>
              </div>
              <input
                inputMode="numeric"
                maxLength={11}
                value={manualProvider?.contactNumber || ""}
                onChange={(e) => onManualChange("contactNumber", e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="09XXXXXXXXX"
                className={`h-9 w-full rounded-lg border bg-white dark:bg-slate-900 px-3 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition ${
                  fieldErrors?.contactNumber || (manualProvider?.contactNumber && (!manualProvider.contactNumber.startsWith("09") || manualProvider.contactNumber.length !== 11))
                    ? "border-rose-500 ring-1 ring-rose-500/20"
                    : "border-slate-300 dark:border-slate-700 focus:border-slate-900 dark:focus:border-slate-100 focus:ring-1 focus:ring-slate-900/10"
                }`}
              />
              {(fieldErrors?.contactNumber || (manualProvider?.contactNumber && (!manualProvider.contactNumber.startsWith("09") || manualProvider.contactNumber.length !== 11))) && (
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  {fieldErrors?.contactNumber || "Must be an 11-digit Philippine mobile starting with 09."}
                </p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer pt-0.5">
            <input
              type="checkbox"
              checked={saveForFuture}
              onChange={(e) => onSaveForFutureChange(e.target.checked)}
              disabled={!hasRequestBranch}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-slate-900 focus:ring-slate-900/10 cursor-pointer"
            />
            <span>Save contractor to directory for future {requestBranch} {requestCategory} requests</span>
          </label>

          {/* Integrated Tenant Preview & Copy Dispatch Footer */}
          {activeAssignedName && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 min-w-0">
                <span className="font-semibold text-slate-500">Tenant sees:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                  Authorized {activeAssignedCategory} Specialist
                </span>
                <span className="text-[10px] text-slate-400 italic shrink-0">
                  (Phone private)
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyDispatchText}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs shrink-0 active:scale-[0.98]"
              >
                {isCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                <span>{isCopied ? "Copied" : "Copy Dispatch"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode C: Saved Services Single Card */}
      {dispatchMode === "directory" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3.5 text-xs shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block">
                Saved Service Providers
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Select a previously saved contractor for {requestBranch}
              </span>
            </div>
            <span className="rounded bg-transparent px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {providers.length} Saved
            </span>
          </div>

          {isLoadingProviders ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800 dark:border-slate-700 dark:border-t-slate-200" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Loading saved services for {requestBranch}...
              </span>
            </div>
          ) : providers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-5 text-center space-y-3">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <BookOpen size={16} />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  No Saved Services Found
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  No registered service providers have been saved for <span className="font-semibold text-slate-700 dark:text-slate-300">{requestBranch}</span> yet.
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  You can discover or enter external contractors in the <strong>AI &amp; External Contractor</strong> tab and check <em>&quot;Save contractor to directory&quot;</em> to register them here.
                </p>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSelectManual}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs active:scale-[0.98]"
                >
                  <Sparkles size={12} className="text-amber-500" />
                  <span>Go to AI &amp; External Contractor</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Select Contractor from Directory *
                </label>
                <select
                  value={selectedChoice}
                  onChange={(event) => onChoiceChange(event.target.value)}
                  disabled={disabled || isAssigning}
                  className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:border-slate-900 dark:focus:border-slate-100 focus:ring-1 focus:ring-slate-900/10 focus:outline-none transition cursor-pointer"
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.providerName} ({getProviderCategoryLabel(provider)}) — 📞 {provider.contactNumber || "No phone"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProvider && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {selectedProvider.providerName}
                    </span>
                    <span className="rounded bg-slate-200/80 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                      {getProviderCategoryLabel(selectedProvider)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-mono">📞 {selectedProvider.contactNumber || "N/A"}</span>
                    {selectedProvider.email && <span>✉️ {selectedProvider.email}</span>}
                  </div>
                </div>
              )}

              {/* Integrated Tenant Preview & Copy Dispatch Footer */}
              {activeAssignedName && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 min-w-0">
                    <span className="font-semibold text-slate-500">Tenant sees:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      Authorized {activeAssignedCategory} Specialist
                    </span>
                    <span className="text-[10px] text-slate-400 italic shrink-0">
                      (Phone private)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyDispatchText}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs shrink-0 active:scale-[0.98]"
                  >
                    {isCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    <span>{isCopied ? "Copied" : "Copy Dispatch"}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Action Buttons (Only shown in standalone mode) */}
      {!embedded && !hideActions && (
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onSuggest}
            disabled={disabled || isSuggesting || isAssigning}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs"
          >
            <Lightbulb size={13} className="text-amber-500" />
            <span>{isSuggesting ? "Discovering..." : "Suggest AI (Nearby)"}</span>
          </button>

          <button
            type="button"
            onClick={onAssign}
            disabled={disabled || !hasAssignmentChanges || isAssigning}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 text-xs font-bold shadow-sm disabled:opacity-40 transition cursor-pointer active:scale-[0.98]"
          >
            <UserCheck size={13} />
            <span>{isAssigning ? "Assigning..." : "Save Assignment"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
