import { formatBranchLabel } from "../maintenanceUtils";

export const BranchBadge = ({ branch }) => {
  const label = formatBranchLabel(branch);
  const isMissing = !branch || label === "Branch missing" || label === "Unassigned Branch";

  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-xs font-semibold bg-transparent ${
        isMissing
          ? "text-amber-700 dark:text-amber-400"
          : "text-slate-700 dark:text-slate-300"
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
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-transparent border border-slate-200 dark:border-slate-700 ${
        isMissing
          ? "text-amber-700 dark:text-amber-400"
          : "text-slate-700 dark:text-slate-200"
      }`}
    >
      {isMissing ? "Unassigned Branch" : label}
    </span>
  );
};
