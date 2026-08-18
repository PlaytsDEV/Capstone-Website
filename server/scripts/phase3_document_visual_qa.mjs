import path from "path";
import { fileURLToPath } from "url";
import { generateBillPdf, generateBillReceiptPdf } from "../utils/pdfGenerator.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");
const tenant = { firstName: "Ava", lastName: "Santos" };
const room = { roomNumber: "GP-202", branch: "gil-puyat" };
const guadalupeRoom = { roomNumber: "GUA-304", branch: "guadalupe" };
const period = {
  startDate: new Date("2026-08-01T00:00:00Z"),
  endDate: new Date("2026-09-01T00:00:00Z"),
  branch: "gil-puyat",
};

const baseBill = {
  userId: "64b000000000000000000001",
  billingMonth: new Date("2026-08-01T00:00:00Z"),
  issuedAt: new Date("2026-08-16T00:00:00Z"),
  dueDate: new Date("2026-08-23T00:00:00Z"),
  billReference: "LC-RB-202608-GP202",
  branch: "gil-puyat",
};

const outputs = [];
outputs.push(await generateBillPdf({
  bill: { ...baseBill, _id: "phase3-qa-rent-only", charges: { rent: 5400 }, totalAmount: 5400 },
  billingResult: null, period, room, tenant,
}));
outputs.push(await generateBillPdf({
  bill: {
    ...baseBill,
    _id: "phase3-qa-electricity",
    charges: { rent: 5400, electricity: 808 },
    totalAmount: 6208,
  },
  billingResult: null,
  electricityBreakdown: {
    ratePerKwh: 16,
    totalRoomKwh: 121.5,
    totalRoomCost: 1944,
    myTotalKwh: 50.5,
    myBillAmount: 808,
    segments: [
      {
        periodLabel: "August 1 - August 15",
        readingFrom: 1000,
        readingTo: 1060,
        segmentTotalKwh: 60,
        segmentTotalCost: 960,
        activeTenantCount: 2,
        sharePerTenantCost: 480,
      },
      {
        periodLabel: "August 15 - August 31",
        readingFrom: 1060,
        readingTo: 1121.5,
        segmentTotalKwh: 61.5,
        segmentTotalCost: 984,
        activeTenantCount: 3,
        sharePerTenantCost: 328,
      },
    ],
  },
  period, room, tenant,
}));
outputs.push(await generateBillPdf({
  bill: {
    ...baseBill,
    _id: "phase3-qa-penalty",
    charges: { rent: 5400, penalty: 250, applianceFees: 300 },
    totalAmount: 5950,
    isManuallyAdjusted: true,
  },
  billingResult: null, period, room, tenant,
}));
outputs.push(await generateBillReceiptPdf({
  bill: { ...baseBill, _id: "phase3-qa-receipt" },
  tenant,
  room,
  billReference: baseBill.billReference,
  payments: [{
    paymentId: "PAY-7F3A91C2",
    amount: 6208,
    method: "gcash",
    settlementTimestamp: new Date("2026-08-18T05:30:00Z"),
  }],
  remainingAmount: 0,
}));
outputs.push(await generateBillPdf({
  bill: {
    ...baseBill,
    _id: "phase3-qa-guadalupe-statement",
    billReference: "LC-RB-202608-GUA304",
    branch: "guadalupe",
    charges: { rent: 5400, water: 320 },
    totalAmount: 5720,
  },
  billingResult: null,
  period: { ...period, branch: "guadalupe" },
  room: guadalupeRoom,
  tenant,
}));
outputs.push(await generateBillReceiptPdf({
  bill: {
    ...baseBill,
    _id: "phase3-qa-guadalupe-receipt",
    billReference: "LC-RB-202608-GUA304",
    branch: "guadalupe",
  },
  tenant,
  room: guadalupeRoom,
  billReference: "LC-RB-202608-GUA304",
  payments: [{
    paymentId: "PAY-GUA-7F3A91C2",
    amount: 5720,
    method: "gcash",
    settlementTimestamp: new Date("2026-08-18T05:30:00Z"),
  }],
  remainingAmount: 0,
}));

console.log(JSON.stringify(outputs.map((output) => path.resolve(serverRoot, output)), null, 2));
