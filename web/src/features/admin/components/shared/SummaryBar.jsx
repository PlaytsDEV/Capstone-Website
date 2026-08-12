const COLOR_CLASSES = {
  blue: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border-blue-100 dark:border-blue-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-blue-500 ring-2 ring-inset ring-blue-500/20",
  },
  green: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-emerald-500 ring-2 ring-inset ring-emerald-500/20",
  },
  orange: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border-amber-100 dark:border-amber-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-amber-500 ring-2 ring-inset ring-amber-500/20",
  },
  red: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border-rose-100 dark:border-rose-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-rose-500 ring-2 ring-inset ring-rose-500/20",
  },
  purple: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-violet-50 text-violet-700 dark:bg-violet-950/70 dark:text-violet-400 border-violet-100 dark:border-violet-900/60",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-violet-500 ring-2 ring-inset ring-violet-500/20",
  },
  neutral: {
    value: "text-slate-900 dark:text-slate-100",
    icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    surface: "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-sm",
    active: "border-slate-400 ring-2 ring-inset ring-slate-400/20",
  },
};

/**
 * SummaryBar — A row of metric cards with icon, value, and label.
 */
export default function SummaryBar({ items = [], onItemClick, activeIndex }) {
  const gridColsClass =
    items.length <= 4
      ? `grid-cols-2 md:grid-cols-${Math.min(items.length, 4)}`
      : "grid-cols-2 md:grid-cols-4 lg:grid-cols-7";

  return (
    <div className="w-full">
      <div className={`grid gap-3 ${gridColsClass}`} role="list">
        {items.map((item, i) => {
          const palette =
            COLOR_CLASSES[item.color || "neutral"] || COLOR_CLASSES.neutral;
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={`flex flex-col justify-between gap-3 rounded-xl border p-4 transition-all duration-150 ${palette.surface} ${onItemClick ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700" : ""} ${activeIndex === i ? palette.active : ""}`}
              role="listitem"
              onClick={() => onItemClick?.(activeIndex === i ? -1 : i)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {item.label}
                </span>
                {Icon && (
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border ${palette.icon}`}
                  >
                    <Icon size={16} />
                  </div>
                )}
              </div>

              <div>
                <div
                  className={`text-2xl font-extrabold tracking-tight ${palette.value}`}
                >
                  {item.value ?? "—"}
                </div>
                {item.trend && (
                  <div className="mt-1 text-xs text-slate-500">
                    {item.trend}
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
