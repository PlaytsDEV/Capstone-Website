import { formatBranchLabel } from "../maintenanceUtils";

export const BranchBadge = ({ branch }) => {
  const label = formatBranchLabel(branch);
  const isMissing = label === "Branch missing";

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isMissing
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-sky-200 bg-sky-50 text-sky-700"
      }`}
    >
      {label}
    </span>
  );
};

export const BranchTableText = ({ branch }) => {
  const label = formatBranchLabel(branch);
  const isMissing = label === "Branch missing";

  return (
    <span className={isMissing ? "text-sm font-medium text-amber-700" : "text-sm text-card-foreground"}>
      {label}
    </span>
  );
};
