const COLOR_CLASSES = {
  blue: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border-blue-200/80 dark:border-blue-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-blue-500 ring-2 ring-inset ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20",
  },
  green: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-emerald-500 ring-2 ring-inset ring-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20",
  },
  emerald: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-emerald-500 ring-2 ring-inset ring-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20",
  },
  orange: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border-amber-200/80 dark:border-amber-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-amber-500 ring-2 ring-inset ring-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20",
  },
  amber: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border-amber-200/80 dark:border-amber-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-amber-500 ring-2 ring-inset ring-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20",
  },
  yellow: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border-amber-200/80 dark:border-amber-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-amber-500 ring-2 ring-inset ring-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20",
  },
  red: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border-rose-200/80 dark:border-rose-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-rose-500 ring-2 ring-inset ring-rose-500/20 bg-rose-50/40 dark:bg-rose-950/20",
  },
  rose: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border-rose-200/80 dark:border-rose-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-rose-500 ring-2 ring-inset ring-rose-500/20 bg-rose-50/40 dark:bg-rose-950/20",
  },
  purple: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-slate-500 ring-2 ring-inset ring-slate-500/20 bg-slate-50/40 dark:bg-slate-950/20",
  },
  violet: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-slate-500 ring-2 ring-inset ring-slate-500/20 bg-slate-50/40 dark:bg-slate-950/20",
  },
  indigo: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-400 border-sky-200/80 dark:border-sky-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-sky-500 ring-2 ring-inset ring-sky-500/20 bg-sky-50/40 dark:bg-sky-950/20",
  },
  teal: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-400 border-teal-200/80 dark:border-teal-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-teal-500 ring-2 ring-inset ring-teal-500/20 bg-teal-50/40 dark:bg-teal-950/20",
  },
  neutral: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-slate-500 dark:border-slate-400 ring-2 ring-inset ring-slate-400/20 bg-slate-50 dark:bg-slate-800/40",
  },
};

const GRID_COLUMNS_BY_COUNT = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  7: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7",
  8: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8",
};

/**
 * SummaryBar — A responsive row of metric cards with icon, value, label, and interactive filter support.
 */
export default function SummaryBar({
  items = [],
  onItemClick,
  activeIndex = -1,
  className = "",
}) {
  const count = items.length;
  const gridColsClass =
    GRID_COLUMNS_BY_COUNT[count] ||
    (count > 8
      ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8"
      : "grid-cols-2 md:grid-cols-4");

  if (!items || items.length === 0) return null;

  return (
    <div className={`w-full ${className}`}>
      <div className={`grid gap-3.5 ${gridColsClass}`} role="list">
        {items.map((item, i) => {
          const palette =
            COLOR_CLASSES[item.color || "neutral"] || COLOR_CLASSES.neutral;
          const Icon = item.icon;
          const isActive = activeIndex === i;
          const isClickable = typeof onItemClick === "function";

          return (
            <div
              key={item.key || item.label || i}
              className={`group relative flex flex-col justify-between min-h-[112px] rounded-xl border p-4 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 ${palette.surface} ${
                isClickable
                  ? "cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  : "cursor-default"
              } ${isActive ? palette.active : ""}`}
              role={isClickable ? "button" : "listitem"}
              tabIndex={isClickable ? 0 : undefined}
              aria-pressed={isClickable ? isActive : undefined}
              title={
                isClickable
                  ? isActive
                    ? `Active filter: ${item.label}. Click to clear filter.`
                    : `Click to filter by ${item.label}`
                  : item.trend || item.description || undefined
              }
              onClick={isClickable ? () => onItemClick?.(i) : undefined}
              onKeyDown={
                isClickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onItemClick(i);
                      }
                    }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate"
                  title={item.label}
                >
                  {item.label}
                </span>
                {Icon && (
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors ${palette.icon}`}
                  >
                    <Icon size={16} />
                  </div>
                )}
              </div>

              <div className="mt-2">
                <div
                  className={`text-2xl sm:text-[28px] font-bold tracking-tight leading-none tabular-nums ${palette.value}`}
                >
                  {item.value ?? "—"}
                </div>
                {(item.trend || item.description) && (
                  <div
                    className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-normal"
                    title={item.trend || item.description}
                  >
                    {item.trend || item.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
