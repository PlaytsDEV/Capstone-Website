import { formatBranchLabel } from "../maintenanceUtils";

export const BranchBadge = ({ branch }) => {
  const label = formatBranchLabel(branch);
  const isMissing = !branch || label === "Branch missing" || label === "Unassigned Branch";

  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
        isMissing
          ? "border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300"
      }`}
    >
      {isMissing ? "Unassigned Branch" : label}
    </span>
  );
};

export const BranchTableText = ({ branch }) => {
  const label = formatBranchLabel(branch);
  const isMissing = !branch || label === "Branch missing" || label === "Unassigned Branch";

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        isMissing
          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/60"
          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
      }`}
    >
      {isMissing ? "Unassigned Branch" : label}
    </span>
  );
};
