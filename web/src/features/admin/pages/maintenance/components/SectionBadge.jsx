export const SectionBadge = ({ children, tone = "blue" }) => {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <span
      className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${toneClass}`}
    >
      {children}
    </span>
  );
};
