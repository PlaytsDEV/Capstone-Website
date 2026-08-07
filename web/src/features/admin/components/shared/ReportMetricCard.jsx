export default function ReportMetricCard({
 label,
 value,
 trend = null,
 tone = "blue",
 onClick = null,
}) {
 const toneStyles = {
 blue: { text: "text-blue-600", dot: "bg-blue-500" },
 green: { text: "text-emerald-600", dot: "bg-emerald-500" },
 violet: { text: "text-violet-600", dot: "bg-violet-500" },
 amber: { text: "text-amber-500", dot: "bg-amber-500" },
 rose: { text: "text-rose-500", dot: "bg-rose-500" },
 };

 const style = toneStyles[tone] || { text: "text-foreground", dot: "bg-slate-300" };
 const clickable = typeof onClick === "function";

 return (
    <article
      className={`bg-card rounded-xl border border-border/80 shadow-sm p-4 hover:shadow-md transition-all duration-200 flex flex-col justify-between group ${clickable ? "cursor-pointer hover:border-primary/50 active:scale-[0.98]" : ""}`}
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${style.dot} opacity-80 group-hover:opacity-100 transition-opacity`} />
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">{label}</span>
        {clickable && (
          <span className="ml-auto text-[11px] font-medium text-muted-foreground/60 group-hover:text-primary transition-colors uppercase tracking-wide">View list →</span>
        )}
      </div>
      <div>
        <strong className={`text-[24px] leading-none font-medium text-foreground tracking-tight`}>{value}</strong>
        {trend ? (
          <div className="text-[11px] font-normal text-muted-foreground mt-2 pt-2 border-t border-border/40 flex items-center gap-1.5">
            {trend}
          </div>
        ) : null}
      </div>
    </article>
 );
}
