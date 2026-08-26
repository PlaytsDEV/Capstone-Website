import {
  AlertTriangle,
  CircleAlert,
  MessageSquareText,
  UserCheck,
} from "lucide-react";

export default function AdminChatMetricsOverview({
  totalThreads = 0,
  unreadTotal = 0,
  urgentTotal = 0,
  assignedToMeTotal = 0,
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
      <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            Total Threads
          </span>
          <div className="flex shrink-0 items-center justify-center text-slate-500 dark:text-slate-400">
            <MessageSquareText size={18} />
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
          {totalThreads}
        </div>
      </div>

      <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            Unread
          </span>
          <div className="flex shrink-0 items-center justify-center text-sky-600 dark:text-sky-400">
            <CircleAlert size={18} />
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
          {unreadTotal}
        </div>
      </div>

      <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            Urgent Priority
          </span>
          <div className="flex shrink-0 items-center justify-center text-rose-600 dark:text-rose-400">
            <AlertTriangle size={18} />
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
          {urgentTotal}
        </div>
      </div>

      <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            Assigned to Me
          </span>
          <div className="flex shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400">
            <UserCheck size={18} />
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
          {assignedToMeTotal}
        </div>
      </div>
    </div>
  );
}
