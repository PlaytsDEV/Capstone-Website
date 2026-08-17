import { describe, expect, test } from "@jest/globals";
import fs from "fs";

describe("canonical bill presentation consistency", () => {
  const helpers = fs.readFileSync(new URL("../../controllers/billing/_helpers.js", import.meta.url), "utf8");
  const bridge = fs.readFileSync(new URL("../mobileBillingBridge.js", import.meta.url), "utf8");

  test("notifications use the same tenant-visible total and due date as mobile and Statement", () => {
    const delivery = helpers.split("export async function deliverBillNotification")[1]
      ?.split("export async function deliverBillReminder")[0] || "";
    expect(delivery).toContain("getVisibleBillSnapshot(bill)");
    expect(delivery).toContain("totalAmount: visible.totalAmount");
    expect(delivery).toMatch(/notify\.billGenerated\([\s\S]*visible\.totalAmount/);
    expect(delivery).toContain("visible.dueDate");
    expect(bridge).toContain("const visible = getVisibleBillSnapshot(bill)");
  });

  test("Statement regeneration replaces raw charges and total with the visible snapshot", () => {
    const generation = helpers.split("export async function generateRentBillPdf")[1]
      ?.split("export async function loadSettledBillPayments")[0] || "";
    expect(generation).toContain("charges: visible.charges");
    expect(generation).toContain("totalAmount: visible.totalAmount");
    expect(generation).toContain("buildTenantUtilityBreakdown");
  });
});
