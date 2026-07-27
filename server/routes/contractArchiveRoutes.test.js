import fs from "fs";

describe("Contract archive route authorization", () => {
  const source = fs.readFileSync(new URL("./contractRoutes.js", import.meta.url), "utf8");

  test("branch administrators may archive while owner verification guards restore and deletion", () => {
    expect(source).toContain('router.post("/:id/archive", archiveContract)');
    expect(source).toContain('router.post("/:id/restore", verifyOwner, restoreContract)');
    expect(source).toContain('router.get("/:id/deletion-eligibility", verifyOwner, getContractDeletionEligibility)');
    expect(source).toContain('router.delete("/:id/permanent", verifyOwner, permanentlyDeleteContract)');
  });
});
