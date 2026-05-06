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
  className={`bg-card rounded-2xl border border-border/80 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)] p-6 hover:shadow-[0_6px_24px_-8px_rgba(15,23,42,0.1)] transition-all duration-300 flex flex-col justify-between group ${clickable ? "cursor-pointer hover:border-blue-300 active:scale-[0.98]" : ""}`}
  onClick={clickable ? onClick : undefined}
  role={clickable ? "button" : undefined}
  tabIndex={clickable ? 0 : undefined}
  onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
 >
 <div className="flex items-center gap-2 mb-3">
 <div className={`w-2 h-2 rounded-full ${style.dot} opacity-80 group-hover:opacity-100 transition-opacity`} />
 <span className="text-[0.8rem] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
 {clickable && (
  <span className="ml-auto text-[0.65rem] font-medium text-muted-foreground/60 group-hover:text-muted-foreground transition-colors uppercase tracking-wide">View list →</span>
 )}
 </div>
 <div>
 <strong className={`text-[2rem] leading-none font-bold tracking-tight ${style.text}`}>{value}</strong>
 {trend ? (
 <div className="text-sm font-medium text-muted-foreground mt-3 pt-3 border-t border-slate-50 flex items-center gap-1.5">
 {trend}
 </div>
 ) : null}
 </div>
 </article>
 );
}

