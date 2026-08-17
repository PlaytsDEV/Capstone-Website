import { useState } from "react";
import { AlertCircle, Award, CheckCircle2, Loader2, Star, ThumbsUp } from "lucide-react";
import { getAssignedProviderName } from "../maintenanceUtils";

const RATING_TAG_OPTIONS = [
  "Punctual",
  "Quality Repair",
  "Fair Pricing",
  "Cleaned Up Area",
  "Clear Communication",
  "Professional",
  "Delayed Arrival",
  "Required Follow-up",
];

const RATING_LABELS = {
  1: "1 - Unsatisfactory",
  2: "2 - Below Expectations",
  3: "3 - Satisfactory",
  4: "4 - Very Good",
  5: "5 - Excellent / Highly Recommended",
};

const MAX_FEEDBACK_LENGTH = 500;

export function ProviderRatingCard({
  request,
  isSubmitting = false,
  onSubmitRating,
  disabled = false,
}) {
  const [selectedRating, setSelectedRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState(["Quality Repair", "Punctual"]);
  const [feedback, setFeedback] = useState("");
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);

  const providerName = getAssignedProviderName(request);
  const existingRating = request?.providerRating;
  const isResolvedOrCompleted = ["completed", "resolved", "closed"].includes(
    String(request?.status || "").toLowerCase(),
  );

  // If no contractor is assigned, do not show the rating card
  if (!providerName) return null;

  // Already rated view
  if (existingRating?.rating) {
    const starCount = Number(existingRating.rating || 5);
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-slate-700 dark:text-slate-300" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Contractor Performance Rating
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded bg-transparent px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
            <span>Rated</span>
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {providerName}
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={13}
                  className={
                    star <= starCount
                      ? "fill-amber-400 text-amber-500"
                      : "text-slate-300 dark:text-slate-600"
                  }
                />
              ))}
              <span className="font-bold text-slate-700 dark:text-slate-300 ml-1">
                {starCount.toFixed(1)}
              </span>
            </div>
          </div>

          {Array.isArray(existingRating.tags) && existingRating.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {existingRating.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {existingRating.feedback && (
            <p className="text-slate-600 dark:text-slate-300 text-xs italic bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
              "{existingRating.feedback}"
            </p>
          )}

          <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1">
            Recorded by {existingRating.ratedByName || "Admin"} • Evaluates contractor performance history
          </div>
        </div>
      </div>
    );
  }

  const validate = (ratingVal, tagsVal, notesVal) => {
    const errs = {};
    if (!ratingVal || ratingVal < 1 || ratingVal > 5) {
      errs.rating = "Please select a valid rating from 1 to 5 stars.";
    }

    if (!Array.isArray(tagsVal) || tagsVal.length === 0) {
      errs.tags = "Please select at least 1 performance attribute.";
    }

    if (notesVal && notesVal.length > MAX_FEEDBACK_LENGTH) {
      errs.feedback = `Notes cannot exceed ${MAX_FEEDBACK_LENGTH} characters.`;
    }

    // Require an explanatory note or low-performance tag if 1 or 2 stars
    if (ratingVal <= 2) {
      const hasNegativeTag = tagsVal.some((t) =>
        ["Delayed Arrival", "Required Follow-up", "Unsatisfactory"].includes(t),
      );
      if (!hasNegativeTag && (!notesVal || notesVal.trim().length < 5)) {
        errs.feedback = "Please provide brief notes explaining the low rating (min 5 characters).";
      }
    }

    return errs;
  };

  const handleTagToggle = (tag) => {
    setSelectedTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      if (touched) {
        setErrors(validate(selectedRating, next, feedback));
      }
      return next;
    });
  };

  const handleRatingChange = (star) => {
    setSelectedRating(star);
    if (touched) {
      setErrors(validate(star, selectedTags, feedback));
    }
  };

  const handleFeedbackChange = (e) => {
    const val = e.target.value;
    setFeedback(val);
    if (touched) {
      setErrors(validate(selectedRating, selectedTags, val));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    const validationErrors = validate(selectedRating, selectedTags, feedback);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    if (!onSubmitRating) return;
    await onSubmitRating({
      rating: selectedRating,
      tags: selectedTags,
      feedback: feedback.trim() || undefined,
    });
  };

  const currentDisplayRating = hoverRating || selectedRating;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Award size={16} className="text-slate-700 dark:text-slate-300" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
            Rate Contractor Performance
          </h3>
        </div>
        {isResolvedOrCompleted && (
          <span className="rounded bg-transparent px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-300/80 dark:border-amber-700/60">
            Pending Feedback
          </span>
        )}
      </div>

      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
        Rate <span className="font-bold text-slate-900 dark:text-slate-100">{providerName}</span> on service quality, punctuality, and fair pricing to refine future contractor suggestions.
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        {/* Star Selector */}
        <div
          className={`rounded-lg border bg-slate-50/50 dark:bg-slate-800/30 p-3.5 space-y-2 transition-colors ${
            errors.rating
              ? "border-rose-300 dark:border-rose-700"
              : "border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Quality &amp; Reliability Score <span className="text-rose-500">*</span>
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
              {RATING_LABELS[currentDisplayRating] || `${currentDisplayRating} Stars`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                disabled={disabled || isSubmitting}
                onClick={() => handleRatingChange(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700 transition cursor-pointer"
                title={`Rate ${star} Stars`}
              >
                <Star
                  size={20}
                  className={
                    star <= currentDisplayRating
                      ? "fill-amber-400 text-amber-500 transition-transform scale-110"
                      : "text-slate-300 dark:text-slate-600 hover:text-slate-400"
                  }
                />
              </button>
            ))}
          </div>
          {errors.rating && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 pt-1">
              <AlertCircle size={12} /> {errors.rating}
            </p>
          )}
        </div>

        {/* Quick Tag Chips */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Performance Attributes <span className="text-rose-500">*</span>
            </label>
            <span className="text-[10px] text-slate-400">
              {selectedTags.length} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RATING_TAG_OPTIONS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  disabled={disabled || isSubmitting}
                  onClick={() => handleTagToggle(tag)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer active:scale-[0.98] ${
                    isSelected
                      ? "border-[#0A1628] bg-[#0A1628] text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 font-semibold"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          {errors.tags && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 pt-0.5">
              <AlertCircle size={12} /> {errors.tags}
            </p>
          )}
        </div>

        {/* Feedback Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Internal Contractor Notes {selectedRating <= 2 ? <span className="text-rose-500">*</span> : "(Optional)"}
            </label>
            <span
              className={`text-[10px] ${
                feedback.length > MAX_FEEDBACK_LENGTH
                  ? "text-rose-600 font-bold"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {feedback.length} / {MAX_FEEDBACK_LENGTH}
            </span>
          </div>
          <textarea
            rows={2}
            value={feedback}
            onChange={handleFeedbackChange}
            disabled={disabled || isSubmitting}
            placeholder={
              selectedRating <= 2
                ? "Please explain what went wrong with this contractor (e.g. late arrival, incomplete fix)..."
                : "e.g. Arrived on time with proper tools, cleanly sealed aircon drainage pipe."
            }
            style={{ outline: "none", boxShadow: "none" }}
            className={`w-full rounded-lg border bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition resize-none ${
              errors.feedback
                ? "border-rose-400 dark:border-rose-600 focus:border-rose-500"
                : "border-slate-200 dark:border-slate-700 focus:border-slate-400 dark:focus:border-slate-500"
            }`}
          />
          {errors.feedback && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 pt-0.5">
              <AlertCircle size={12} /> {errors.feedback}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end pt-1">
          <button
            type="submit"
            disabled={disabled || isSubmitting}
            title={
              disabled
                ? "Rating submission is locked"
                : isSubmitting
                  ? "Saving rating..."
                  : "Submit contractor rating and performance feedback"
            }
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-5 text-xs font-bold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer active:scale-[0.98]"
          >
            {isSubmitting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ThumbsUp size={13} />
            )}
            <span>{isSubmitting ? "Saving Rating..." : "Save Contractor Rating"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
