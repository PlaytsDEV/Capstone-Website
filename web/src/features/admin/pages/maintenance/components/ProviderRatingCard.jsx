import { useState } from "react";
import { Award, CheckCircle2, Star, ThumbsUp } from "lucide-react";
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
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <Award size={15} className="text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Contractor Performance Rating
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={11} />
            Rated
          </span>
        </div>

        <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-2 text-xs">
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
                      ? "fill-amber-400 text-amber-400"
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
            <p className="text-slate-600 dark:text-slate-300 text-xs italic bg-white dark:bg-slate-900 p-2 rounded border border-slate-200/60 dark:border-slate-800">
              "{existingRating.feedback}"
            </p>
          )}

          <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1">
            Recorded by {existingRating.ratedByName || "Admin"} • Trains AI ranking algorithm
          </div>
        </div>
      </div>
    );
  }

  const handleTagToggle = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!onSubmitRating) return;
    await onSubmitRating({
      rating: selectedRating,
      tags: selectedTags,
      feedback: feedback.trim() || undefined,
    });
  };

  const currentDisplayRating = hoverRating || selectedRating;

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Award size={15} className="text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Rate Contractor Performance
          </h3>
        </div>
        {isResolvedOrCompleted && (
          <span className="rounded bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Pending Feedback
          </span>
        )}
      </div>

      <div className="text-xs text-slate-600 dark:text-slate-400">
        Rate <span className="font-bold text-slate-900 dark:text-slate-100">{providerName}</span> on service quality, punctuality, and fair pricing to train future AI provider suggestions.
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        {/* Star Selector */}
        <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Quality & Reliability Score
            </span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
              {RATING_LABELS[currentDisplayRating] || `${currentDisplayRating} Stars`}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                disabled={disabled || isSubmitting}
                onClick={() => setSelectedRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                title={`Rate ${star} Stars`}
              >
                <Star
                  size={20}
                  className={
                    star <= currentDisplayRating
                      ? "fill-amber-400 text-amber-400 transition-transform scale-110"
                      : "text-slate-300 dark:text-slate-600 hover:text-slate-400"
                  }
                />
              </button>
            ))}
          </div>
        </div>

        {/* Quick Tag Chips */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Quick Performance Attributes
          </label>
          <div className="flex flex-wrap gap-1.5">
            {RATING_TAG_OPTIONS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  disabled={disabled || isSubmitting}
                  onClick={() => handleTagToggle(tag)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback Textarea */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Internal Contractor Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={disabled || isSubmitting}
            placeholder="e.g. Arrived on time with proper tools, cleanly sealed aircon drainage pipe."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition resize-none"
          />
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end pt-1">
          <button
            type="submit"
            disabled={disabled || isSubmitting}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
          >
            <ThumbsUp size={13} />
            <span>{isSubmitting ? "Recording..." : "Save Contractor Rating"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
