import {
  formatBranchName,
  formatBranchSubtitle,
  formatDocumentBranch,
  normalizeBranchKey,
} from "./branchPresentation.js";

describe("canonical branch presentation", () => {
  test.each(["gil-puyat", "gil_puyat", "Gil Puyat", "GP"])(
    "%s resolves to Gil Puyat",
    (value) => {
      expect(normalizeBranchKey(value)).toBe("gil-puyat");
      expect(formatBranchName(value)).toBe("Gil Puyat");
      expect(formatBranchSubtitle(value)).toBe("Gil Puyat Branch");
      expect(formatDocumentBranch(value)).toBe("Lilycrest — Gil Puyat Branch");
    },
  );

  test.each(["guadalupe", "Guadalupe", "GUA"])(
    "%s resolves to Guadalupe",
    (value) => {
      expect(normalizeBranchKey(value)).toBe("guadalupe");
      expect(formatBranchName(value)).toBe("Guadalupe");
      expect(formatBranchSubtitle(value)).toBe("Guadalupe Branch");
      expect(formatDocumentBranch(value)).toBe("Lilycrest — Guadalupe Branch");
    },
  );

  test.each([undefined, null, "", "Main Branch", "client supplied branch"])(
    "unknown value %p uses the safe generic fallback",
    (value) => {
      expect(normalizeBranchKey(value)).toBeNull();
      expect(formatBranchName(value)).toBe("Lilycrest Dormitory");
      expect(formatBranchSubtitle(value)).toBe("Lilycrest Dormitory");
      expect(formatDocumentBranch(value)).toBe("Lilycrest Dormitory");
    },
  );
});
