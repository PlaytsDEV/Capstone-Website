export const SectionBadge = ({ children, tone = "blue" }) => {
  const toneClass =
    tone === "amber"
      ? "text-amber-700 dark:text-amber-400"
      : "text-sky-700 dark:text-sky-400";

  return (
    <span
      className={`ml-auto inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${toneClass}`}
    >
      {children}
    </span>
  );
};
