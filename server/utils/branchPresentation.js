const BRANCH_ALIASES = Object.freeze({
  "gil-puyat": "gil-puyat",
  gil_puyat: "gil-puyat",
  "gil puyat": "gil-puyat",
  "gil puyat branch": "gil-puyat",
  gp: "gil-puyat",
  guadalupe: "guadalupe",
  "guadalupe branch": "guadalupe",
  gua: "guadalupe",
});

const DISPLAY_NAMES = Object.freeze({
  "gil-puyat": "Gil Puyat",
  guadalupe: "Guadalupe",
});

export const GENERIC_BRANCH_LABEL = "Lilycrest Dormitory";

export const normalizeBranchKey = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return BRANCH_ALIASES[normalized] || null;
};

export const formatBranchName = (value, fallback = GENERIC_BRANCH_LABEL) => {
  const key = normalizeBranchKey(value);
  return key ? DISPLAY_NAMES[key] : fallback;
};

export const formatBranchSubtitle = (value) => {
  const key = normalizeBranchKey(value);
  return key ? `${DISPLAY_NAMES[key]} Branch` : GENERIC_BRANCH_LABEL;
};

export const formatDocumentBranch = (value) => {
  const key = normalizeBranchKey(value);
  return key
    ? `Lilycrest — ${DISPLAY_NAMES[key]} Branch`
    : GENERIC_BRANCH_LABEL;
};

export default formatBranchName;
