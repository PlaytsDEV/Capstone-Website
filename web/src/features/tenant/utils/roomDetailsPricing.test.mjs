import assert from "node:assert/strict";
import {
  calculateRoomDetailsCost,
  calculatePaymentBreakdown,
  resolveApplianceBreakdown,
  APPLIANCE_DEFAULT_PRICE,
  STANDARD_APPLIANCES_CATALOG,
} from "./roomDetailsPricing.js";

// ── 0. Standard Catalog & Default Pricing Exports ────────────
assert.equal(APPLIANCE_DEFAULT_PRICE, 200, "APPLIANCE_DEFAULT_PRICE must be 200");
assert.equal(Array.isArray(STANDARD_APPLIANCES_CATALOG), true, "STANDARD_APPLIANCES_CATALOG must be an array");
assert.equal(STANDARD_APPLIANCES_CATALOG.length, 3, "STANDARD_APPLIANCES_CATALOG must contain 3 default items");
assert.deepEqual(
  STANDARD_APPLIANCES_CATALOG.map((a) => a.id),
  ["fan", "ricecooker", "laptop"],
  "STANDARD_APPLIANCES_CATALOG must contain fan, ricecooker, and laptop",
);
STANDARD_APPLIANCES_CATALOG.forEach((item) => {
  assert.equal(item.unitPrice, 200, `${item.name} unit price must be 200`);
});

// ── 1. Quadruple Sharing Room Tests ─────────────────────────
const quadRoom = {
  type: "Quadruple",
  regularLongRate: 6000,
  regularShortRate: 7000,
  monthlyPrice: 5400,
  shortTermRate: 6300,
  isDiscountEnabled: true,
  quadrupleDiscountPercent: 10,
  longTermDiscountPercent: 10,
};

// 1-5 months must be Short-Term with 7000 regular rate and 6300 monthly rate
for (let m = 1; m <= 5; m++) {
  const cost = calculateRoomDetailsCost({
    room: quadRoom,
    roomType: "Quadruple",
    activeLeaseDuration: String(m),
  });

  assert.equal(cost.isLongTerm, false, `Duration ${m} months should be Short-Term`);
  assert.equal(cost.leaseMonths, m);
  assert.equal(cost.activeRegularRate, 7000);
  assert.equal(cost.activeMonthlyRate, 6300);
  assert.equal(cost.activeFlyerDiscount, 700);
  assert.equal(cost.discountPercent, 10);
  assert.equal(cost.securityDepositAmount, 6300);
  assert.equal(cost.calculatedUpfrontTotal, 12600);
  assert.equal(cost.totalSavingsAmount, 700 * m);
}

// 6 months MUST be Long-Term with 6000 regular rate and 5400 monthly rate
const cost6 = calculateRoomDetailsCost({
  room: quadRoom,
  roomType: "Quadruple",
  activeLeaseDuration: "6",
});
assert.equal(cost6.isLongTerm, true, "6 months MUST be Long-Term");
assert.equal(cost6.leaseMonths, 6);
assert.equal(cost6.activeRegularRate, 6000);
assert.equal(cost6.activeMonthlyRate, 5400);
assert.equal(cost6.activeFlyerDiscount, 600);
assert.equal(cost6.discountPercent, 10);
assert.equal(cost6.securityDepositAmount, 5400);
assert.equal(cost6.calculatedUpfrontTotal, 10800);
assert.equal(cost6.totalSavingsAmount, 3600);

// 10 and 12 months MUST be Long-Term
for (const m of [10, 12]) {
  const costLong = calculateRoomDetailsCost({
    room: quadRoom,
    roomType: "Quadruple",
    activeLeaseDuration: String(m),
  });
  assert.equal(costLong.isLongTerm, true, `${m} months MUST be Long-Term`);
  assert.equal(costLong.activeRegularRate, 6000);
  assert.equal(costLong.activeMonthlyRate, 5400);
  assert.equal(costLong.calculatedUpfrontTotal, 10800);
  assert.equal(costLong.totalSavingsAmount, 600 * m);
}

// ── 2. Double Sharing Room Tests ─────────────────────────────
const doubleRoom = {
  type: "Double",
  regularLongRate: 9000,
  regularShortRate: 10000,
  monthlyPrice: 7200,
  shortTermRate: 8000,
  isDiscountEnabled: true,
  doubleDiscountPercent: 20,
  longTermDiscountPercent: 20,
};

const doubleShort = calculateRoomDetailsCost({
  room: doubleRoom,
  roomType: "Double",
  activeLeaseDuration: "3",
});
assert.equal(doubleShort.isLongTerm, false);
assert.equal(doubleShort.activeRegularRate, 10000);
assert.equal(doubleShort.activeMonthlyRate, 8000);
assert.equal(doubleShort.calculatedUpfrontTotal, 16000);

const doubleLong = calculateRoomDetailsCost({
  room: doubleRoom,
  roomType: "Double",
  activeLeaseDuration: "6",
});
assert.equal(doubleLong.isLongTerm, true);
assert.equal(doubleLong.activeRegularRate, 9000);
assert.equal(doubleLong.activeMonthlyRate, 7200);
assert.equal(doubleLong.calculatedUpfrontTotal, 14400);

// ── 3. Private Room Tests ────────────────────────────────────
const privateRoom = {
  type: "Private",
  regularLongRate: 15000,
  regularShortRate: 16000,
  monthlyPrice: 13500,
  shortTermRate: 14400,
  isDiscountEnabled: true,
  privateDiscountPercent: 10,
  longTermDiscountPercent: 10,
};

const privateShort = calculateRoomDetailsCost({
  room: privateRoom,
  roomType: "Private",
  activeLeaseDuration: "5",
});
assert.equal(privateShort.isLongTerm, false);
assert.equal(privateShort.activeRegularRate, 16000);
assert.equal(privateShort.activeMonthlyRate, 14400);
assert.equal(privateShort.calculatedUpfrontTotal, 28800);

const privateLong = calculateRoomDetailsCost({
  room: privateRoom,
  roomType: "Private",
  activeLeaseDuration: "6",
});
assert.equal(privateLong.isLongTerm, true);
assert.equal(privateLong.activeRegularRate, 15000);
assert.equal(privateLong.activeMonthlyRate, 13500);
assert.equal(privateLong.calculatedUpfrontTotal, 27000);

// ── 4. calculatePaymentBreakdown Tests (3-Stage Roadmap) ───────
const breakdown = calculatePaymentBreakdown({
  monthlyRent: 6300,
  applianceFees: 200,
  reservationFeeAmount: 2000,
});

assert.equal(breakdown.reservationDeposit, 2000, "Reservation deposit should be 2000");
assert.equal(breakdown.advanceRent, 6300, "Advance rent should equal 1 month rent");
assert.equal(breakdown.securityDeposit, 6300, "Security deposit should equal 1 month rent");
assert.equal(breakdown.preMoveInGross, 12600, "Gross pre-move-in requirements should be 12600");
assert.equal(breakdown.preMoveInNetCashout, 10600, "Net pre-move-in cashout should be 10600 (12600 - 2000)");
assert.equal(breakdown.baseMonthlyRent, 6300, "Base monthly rent should be 6300");
assert.equal(breakdown.applianceFees, 200, "Appliance fees should be 200");
assert.equal(breakdown.monthlyStayRate, 6500, "Monthly stay rate should be 6500 (6300 + 200)");

// Zero appliance fees test
const breakdownZeroAppliances = calculatePaymentBreakdown({
  monthlyRent: 5400,
  applianceFees: 0,
});
assert.equal(breakdownZeroAppliances.reservationDeposit, 2000);
assert.equal(breakdownZeroAppliances.advanceRent, 5400);
assert.equal(breakdownZeroAppliances.securityDeposit, 5400);
assert.equal(breakdownZeroAppliances.preMoveInGross, 10800);
assert.equal(breakdownZeroAppliances.preMoveInNetCashout, 8800);
// ── 5. resolveApplianceBreakdown & selectedAppliances Tests ───────

// Test array input with 2 Laptops @ ₱200 each
const applianceArray = [{ id: "laptop", name: "Laptop", quantity: 2 }];
const resolvedArray = resolveApplianceBreakdown(applianceArray, 0);

assert.equal(resolvedArray.totalApplianceFees, 400, "2 Laptops @ ₱200 each should equal ₱400");
assert.equal(resolvedArray.items.length, 1);
assert.equal(resolvedArray.items[0].unitPrice, 200);
assert.equal(resolvedArray.items[0].subtotal, 400);
assert.equal(resolvedArray.items[0].displayLabel, "Laptop (2x) · ₱200/mo each (+₱400/mo)");

// Test object input (e.g. from CheckAvailabilityPage state { laptop: 2, fan: 1 })
const applianceObject = { laptop: 2, fan: 1 };
const resolvedObject = resolveApplianceBreakdown(applianceObject, 0);

assert.equal(resolvedObject.totalApplianceFees, 600, "2 Laptops (400) + 1 Fan (200) should equal ₱600");
assert.equal(resolvedObject.items.length, 2);

// Test calculatePaymentBreakdown with selectedAppliances
const breakdownWithAppliances = calculatePaymentBreakdown({
  monthlyRent: 6300,
  selectedAppliances: applianceArray,
  reservationFeeAmount: 2000,
});
assert.equal(breakdownWithAppliances.applianceFees, 400, "Should resolve 400 from appliance list");
assert.equal(breakdownWithAppliances.monthlyStayRate, 6700, "₱6,300 base + ₱400 appliances = ₱6,700/mo");
assert.equal(breakdownWithAppliances.applianceBreakdown.items.length, 1);
assert.equal(breakdownWithAppliances.applianceBreakdown.items[0].displayLabel, "Laptop (2x) · ₱200/mo each (+₱400/mo)");

console.log("✔ roomDetailsPricing.test.mjs passed all lease duration, payment breakdown, and appliance resolver tests");

