/**
 * Real integration coverage proving mobile prepared and final-document
 * tenant isolation: tenant B cannot pull tenant A's Contract PDF by
 * guessing/reusing tenant A's Contract id at either lifecycle tier.
 *
 * Real (non-replset) MongoMemoryServer database, real `generatePreparedContractPdf`
 * generation/storage pipeline, real `mobileContractRoutes.js` router mounted
 * on a bare Express app and hit with real HTTP (global `fetch`, no
 * supertest — this repo has none). Only `mobileTenantAuth` is mocked, to let
 * each request assert an arbitrary tenant identity the same way a verified
 * mobile JWT would; `tenantContractSelectionService`,
 * `preparedContractDocumentService`, `contractPublicationService`, and
 * everything downstream run unmocked.
 *
 * A plain MongoMemoryServer (no replica set) is used because neither
 * `generatePreparedContractPdf` nor `createDraftContract` opens a Mongoose
 * session/transaction.
 *
 * The final-document test uses the same production one-step wet-signed
 * upload/finalization service as the admin flow. Both tenants receive real,
 * distinct final PDFs so the negative assertions cannot pass because final
 * delivery is globally unavailable.
 */
import mongoose from "mongoose";
import express from "express";
import { PDFDocument } from "pdf-lib";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";

import { Contract, BusinessSettings, Reservation, Room, User } from "../models/index.js";
import { createDraftContract, transitionContract } from "../services/contractService.js";
import { generatePreparedContractPdf } from "../services/contractPdfService.js";
import { uploadAndFinalizeNotarizedContract } from "../services/contractNotarizationService.js";

await jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
  mobileTenantAuth: (req, _res, next) => {
    req.mobileTenant = { _id: req.headers["x-test-tenant-id"] };
    next();
  },
}));

const { default: mobileContractRoutes } = await import("./mobileContractRoutes.js");

let mongod;
let server;
let baseUrl;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "mobile_contract_tenant_isolation" });
  await Contract.syncIndexes();

  const app = express();
  app.use("/api/m", mobileContractRoutes);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}, 120_000);

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongod?.stop();
}, 120_000);

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(async () => {
  await Promise.all([
    Reservation.deleteMany({}),
    Room.deleteMany({}),
    User.deleteMany({}),
    Contract.deleteMany({}),
    BusinessSettings.deleteMany({}),
  ]);
  await BusinessSettings.create({
    key: "global",
    quadrupleDiscountPercent: 10,
    isDiscountEnabled: true,
    longTermLeaseMinMonths: 6,
  });
});

/**
 * Seeds a fully valid, generation-ready Contract for a distinct tenant
 * (identified by `label`, so two calls in the same test produce two
 * non-colliding tenants/rooms/reservations) and drives it to
 * "ready_for_generation". Field derivation mirrors the seed helper in
 * services/tenantContractDocumentResolver.e2e.integration.test.js — this
 * repo's convention is to duplicate rather than cross-import test setup
 * across independent test files, so it is intentionally repeated here
 * rather than imported.
 */
async function seedGenerationReadyContract(label) {
  const firebaseUid = `firebase-isolation-${label}`;
  const tenant = await User.create({
    firebaseUid,
    email: `${firebaseUid}@example.test`,
    username: `tenant_${label}_${new mongoose.Types.ObjectId().toString().slice(-8)}`,
    firstName: "Test",
    lastName: `Tenant${label}`,
    role: "applicant",
  });
  const admin = await User.create({
    firebaseUid: `firebase-admin-${label}-${new mongoose.Types.ObjectId()}`,
    email: `admin-${label}-${new mongoose.Types.ObjectId()}@example.test`,
    username: `admin_${label}_${new mongoose.Types.ObjectId().toString().slice(-8)}`,
    firstName: "Branch",
    lastName: "Admin",
    role: "branch_admin",
  });
  const room = await Room.create({
    name: `Room ${label}`,
    roomNumber: `30${label === "A" ? 1 : 2}`,
    branch: "gil-puyat",
    type: "quadruple-sharing",
    capacity: 4,
    price: 6300,
  });
  const reservation = await Reservation.create({
    userId: tenant._id,
    roomId: room._id,
    status: "approved_for_payment",
    applicationReviewedAt: new Date("2026-07-01T00:00:00.000Z"),
    applicationReviewedBy: admin._id,
    approvedForPaymentAt: new Date("2026-07-02T00:00:00.000Z"),
    paymentStatus: "paid",
    leaseDuration: 12,
    monthlyRent: 5400,
    reservationFeeAmount: 2000,
    preferredRoomType: "quadruple-sharing",
    agreedToPrivacy: true,
    agreedToCertification: true,
    totalPrice: 6300,
    moveInDate: new Date("2026-09-01T00:00:00.000Z"),
    firstName: "Test",
    lastName: `Tenant${label}`,
    mobileNumber: "09171234567",
    email: `${firebaseUid}@example.test`,
    nationality: "Filipino",
    birthday: new Date("1995-05-05T00:00:00.000Z"),
    address: {
      unitHouseNo: "12",
      street: "Main St",
      barangay: "Barangay Uno",
      city: "Makati",
      province: "Metro Manila",
      region: "NCR",
    },
    selectedBed: { id: `bed-${label}`, code: `30${label === "A" ? 1 : 2}-A-U` },
  });

  const draft = await createDraftContract({ reservationId: reservation._id, actorId: admin._id });
  await transitionContract(draft, "ready_for_generation", admin._id, "Ready for prepared PDF generation");

  return { tenant, admin, room, reservation, contract: draft };
}

async function generateAndFinalizeContract(data, label) {
  const { contract: generatedContract } = await generatePreparedContractPdf({
    contractId: data.contract._id,
    actorId: data.admin._id,
  });
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Final Contract ${label}`);
  pdf.addPage([612, 936]);
  const buffer = Buffer.from(await pdf.save());
  const file = {
    buffer,
    originalname: `final-${label}.pdf`,
    mimetype: "application/pdf",
    size: buffer.length,
  };
  const { contract } = await uploadAndFinalizeNotarizedContract({
    contract: generatedContract,
    file,
    actorId: data.admin._id,
    preparedDocumentVersion: generatedContract.generatedVersion,
    notarialDetails: { notaryName: `Atty. Isolation ${label}` },
    notes: `Two-tenant isolation verification ${label}`,
  });
  return { contract, buffer };
}

describe("mobile contract routes — tenant isolation", () => {
  test("tenant B cannot fetch tenant A's generated draft PDF by requesting tenant A's Contract id", async () => {
    const tenantAData = await seedGenerationReadyContract("A");
    const tenantBData = await seedGenerationReadyContract("B");

    const { document: tenantADocument } = await generatePreparedContractPdf({
      contractId: tenantAData.contract._id,
      actorId: tenantAData.admin._id,
    });
    await generatePreparedContractPdf({
      contractId: tenantBData.contract._id,
      actorId: tenantBData.admin._id,
    });

    // Sanity check: tenant A really does own a real, fetchable draft.
    const ownResponse = await fetch(
      `${baseUrl}/api/m/contracts/${tenantAData.contract._id}/documents/prepared`,
      { headers: { "x-test-tenant-id": String(tenantAData.tenant._id) } },
    );
    expect(ownResponse.status).toBe(200);
    expect(ownResponse.headers.get("content-type")).toBe("application/pdf");
    const ownBytes = Buffer.from(await ownResponse.arrayBuffer());
    expect(ownBytes.length).toBe(tenantADocument.fileSize);

    // The actual isolation assertion: authenticate as tenant B, but request
    // tenant A's Contract id.
    const crossTenantResponse = await fetch(
      `${baseUrl}/api/m/contracts/${tenantAData.contract._id}/documents/prepared`,
      { headers: { "x-test-tenant-id": String(tenantBData.tenant._id) } },
    );
    expect(crossTenantResponse.status).toBe(404);
    const crossTenantBody = await crossTenantResponse.json();
    expect(crossTenantBody).toMatchObject({
      detail: "Contract not found.",
      code: "CONTRACT_NOT_FOUND",
    });
    // Confirm no PDF bytes of any kind leaked through on the 404 path.
    expect(crossTenantResponse.headers.get("content-type")).not.toBe("application/pdf");

    // And the reverse direction: tenant A must not be able to pull tenant
    // B's draft either — isolation is symmetric, not a one-off fluke of
    // which id happened to be requested first.
    const reverseCrossTenantResponse = await fetch(
      `${baseUrl}/api/m/contracts/${tenantBData.contract._id}/documents/prepared`,
      { headers: { "x-test-tenant-id": String(tenantAData.tenant._id) } },
    );
    expect(reverseCrossTenantResponse.status).toBe(404);
    const reverseBody = await reverseCrossTenantResponse.json();
    expect(reverseBody.code).toBe("CONTRACT_NOT_FOUND");

    // Tenant B's own document must still be independently fetchable and
    // correct — isolation must not be an accidental global block.
    const tenantBOwnResponse = await fetch(
      `${baseUrl}/api/m/contracts/${tenantBData.contract._id}/documents/prepared`,
      { headers: { "x-test-tenant-id": String(tenantBData.tenant._id) } },
    );
    expect(tenantBOwnResponse.status).toBe(200);
  });

  test("final wet-signed documents remain symmetrically isolated between two tenants", async () => {
    const tenantAData = await seedGenerationReadyContract("A");
    const tenantBData = await seedGenerationReadyContract("B");
    const tenantAFinal = await generateAndFinalizeContract(tenantAData, "A");
    const tenantBFinal = await generateAndFinalizeContract(tenantBData, "B");

    expect(tenantAFinal.buffer.equals(tenantBFinal.buffer)).toBe(false);
    expect(tenantAFinal.contract.status).toBe("active");
    expect(tenantBFinal.contract.status).toBe("active");

    const tenantAOwnResponse = await fetch(
      `${baseUrl}/api/m/contracts/${tenantAData.contract._id}/documents/final`,
      { headers: { "x-test-tenant-id": String(tenantAData.tenant._id) } },
    );
    expect(tenantAOwnResponse.status).toBe(200);
    expect(tenantAOwnResponse.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await tenantAOwnResponse.arrayBuffer()).equals(tenantAFinal.buffer)).toBe(true);

    const tenantBCrossResponse = await fetch(
      `${baseUrl}/api/m/contracts/${tenantAData.contract._id}/documents/final`,
      { headers: { "x-test-tenant-id": String(tenantBData.tenant._id) } },
    );
    expect(tenantBCrossResponse.status).toBe(404);
    expect(tenantBCrossResponse.headers.get("content-type")).not.toBe("application/pdf");
    expect(await tenantBCrossResponse.json()).toEqual({ detail: "Final Contract is not available" });

    const tenantACrossResponse = await fetch(
      `${baseUrl}/api/m/contracts/${tenantBData.contract._id}/documents/final`,
      { headers: { "x-test-tenant-id": String(tenantAData.tenant._id) } },
    );
    expect(tenantACrossResponse.status).toBe(404);
    expect(tenantACrossResponse.headers.get("content-type")).not.toBe("application/pdf");
    expect(await tenantACrossResponse.json()).toEqual({ detail: "Final Contract is not available" });

    const tenantBOwnResponse = await fetch(
      `${baseUrl}/api/m/contracts/${tenantBData.contract._id}/documents/final`,
      { headers: { "x-test-tenant-id": String(tenantBData.tenant._id) } },
    );
    expect(tenantBOwnResponse.status).toBe(200);
    expect(Buffer.from(await tenantBOwnResponse.arrayBuffer()).equals(tenantBFinal.buffer)).toBe(true);

    // No mobile-side record mutation or manual refresh endpoint is required:
    // the canonical current-contract read immediately resolves each newly
    // finalized document, and it keeps identity/room/pricing/term snapshots
    // scoped to the authenticated tenant.
    const tenantACurrent = await fetch(`${baseUrl}/api/m/contracts/current`, {
      headers: { "x-test-tenant-id": String(tenantAData.tenant._id) },
    });
    const tenantBCurrent = await fetch(`${baseUrl}/api/m/contracts/current`, {
      headers: { "x-test-tenant-id": String(tenantBData.tenant._id) },
    });
    expect(tenantACurrent.status).toBe(200);
    expect(tenantBCurrent.status).toBe(200);
    const tenantABody = await tenantACurrent.json();
    const tenantBBody = await tenantBCurrent.json();

    expect(tenantABody.contract).toMatchObject({
      id: String(tenantAData.contract._id),
      tenantLegalName: "Test TenantA",
      roomNumber: "301",
      approvedMonthlyRate: 5400,
      tenantDocument: { available: true, type: "final_notarized", isFinal: true },
    });
    expect(tenantBBody.contract).toMatchObject({
      id: String(tenantBData.contract._id),
      tenantLegalName: "Test TenantB",
      roomNumber: "302",
      approvedMonthlyRate: 5400,
      tenantDocument: { available: true, type: "final_notarized", isFinal: true },
    });
    expect(tenantABody.contract.tenantDocument.viewUrl).toContain(String(tenantAData.contract._id));
    expect(tenantABody.contract.tenantDocument.viewUrl).not.toContain(String(tenantBData.contract._id));
    expect(tenantBBody.contract.tenantDocument.viewUrl).toContain(String(tenantBData.contract._id));
    expect(tenantBBody.contract.tenantDocument.viewUrl).not.toContain(String(tenantAData.contract._id));
  });

  test("the current-contract summary route also stays scoped per tenant", async () => {
    const tenantAData = await seedGenerationReadyContract("A");
    const tenantBData = await seedGenerationReadyContract("B");
    await generatePreparedContractPdf({
      contractId: tenantAData.contract._id,
      actorId: tenantAData.admin._id,
    });

    const tenantBCurrentResponse = await fetch(`${baseUrl}/api/m/contracts/current`, {
      headers: { "x-test-tenant-id": String(tenantBData.tenant._id) },
    });
    expect(tenantBCurrentResponse.status).toBe(200);
    const tenantBBody = await tenantBCurrentResponse.json();
    // Tenant B's own Contract exists (draft/early-stage, no generated PDF
    // yet) but must never resolve to tenant A's contract id or document.
    expect(String(tenantBBody.contract?.id)).not.toBe(String(tenantAData.contract._id));
    expect(tenantBBody.contract?.preparedDocument?.viewUrl || "").not.toContain(
      String(tenantAData.contract._id),
    );
  });
});
