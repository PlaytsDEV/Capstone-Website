/**
 * Real end-to-end integration coverage for the tenant contract document
 * pipeline that is NOT covered anywhere else in this repo:
 *
 * Test 1 — the prepared-draft PDF bytes streamed to a tenant through the
 *   WEB route (GET /api/contracts/my/:contractId/documents/prepared) and
 *   through the MOBILE route (GET /api/m/contracts/:contractId/documents/
 *   prepared) are byte-identical to each other and to the Contract's
 *   stored preparedDocuments[].fileHash — i.e. both channels really do
 *   resolve to the SAME generated file, not two independently-rendered
 *   copies.
 *
 * APPROACH: real HTTP. This test mounts the actual `mobileContractRoutes.js`
 * router (only its `mobileTenantAuth` import is mocked, to inject
 * `req.mobileTenant`) and, for the web side, mounts the actual
 * `streamMyPreparedContract` handler exported by `contractController.js`
 * directly on a bare Express app (no mocking needed there —
 * `contractController.js` has no Firebase/auth import of its own;
 * `verifyToken`/`verifyApplicant` live in `routes/contractRoutes.js`, not in
 * the controller, so importing the controller function directly and
 * standing in a trivial middleware that sets `req.user = { uid }`
 * reproduces exactly what `verifyToken` would have produced without needing
 * to mock anything upstream). Everything below the auth boundary — resolver,
 * prepared-document service, generation, storage, streaming — runs for real
 * against a real (non-replset) MongoMemoryServer database and the real
 * on-disk template/generated-file storage under server/private/.
 *
 * A plain MongoMemoryServer (no replica set) is used because neither
 * `generatePreparedContractPdf` nor `createDraftContract` opens a Mongoose
 * session/transaction.
 *
 * Test 2 — the real notarization/publication pipeline persists
 *   `finalDocument` on an existing (non-new) Contract and the shared
 *   resolver flips Tier 2 (draft) -> Tier 1 (final) once it's refetched
 *   from Mongo, for BOTH finalize paths: the one-step
 *   `uploadAndFinalizeNotarizedContract` and the older manual
 *   verify -> ready -> publish pipeline. This was previously impossible —
 *   see "FIXED BUGS" below — and is now covered as regression protection.
 *
 * =============================================================================
 * FIXED BUGS (previously blocked this file's Test 3 entirely; now fixed and
 * covered by regression tests below).
 * =============================================================================
 * 1. `uploadAndFinalizeNotarizedContract` used to call
 *    `transitionContract(contract, "active", ...)` directly from whatever
 *    status the Contract was in (generated / awaiting_signatures /
 *    partially_signed / signed / awaiting_notarization). `CONTRACT_TRANSITIONS`
 *    (contractService.js) never permitted that — only "published" or
 *    "transfer_review_required" may transition to "active" — so this always
 *    threw `INVALID_CONTRACT_STATUS_TRANSITION`. Fixed by walking the
 *    canonical chain internally (current -> notarized -> ready_for_publication
 *    -> published -> active), which every status in
 *    `DIRECT_NOTARIZED_UPLOAD_STATUSES` can validly reach — no manual admin
 *    button clicks added, just internally-valid transitions.
 *
 * 2. `finalDocumentSchema` (models/Contract.js) declared every field
 *    `immutable: true`. Mongoose only allows writes to an immutable path
 *    when the *parent* document is new (`doc.isNew`) — but a Contract is
 *    never new by the time finalization legitimately runs. This made the
 *    very first authorized `finalDocument` write silently fail schema
 *    validation on every real Contract, via both finalize paths. Fixed by
 *    removing `immutable: true` from `finalDocumentSchema`'s fields; business-
 *    level immutability (first upload allowed, replacement rejected without
 *    a formal process) is enforced where it already was — in
 *    `contractNotarizationService.js`'s `assertDirectUploadAllowed` and
 *    `contractPublicationService.js`'s `assertNotPublished` — which are the
 *    only two authorized writers of this field.
 */
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import mongoose from "mongoose";
import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";

import fs from "fs/promises";
import path from "path";

import { Contract, BusinessSettings, Reservation, Room, User } from "../models/index.js";
import { createDraftContract, transitionContract } from "./contractService.js";
import { generatePreparedContractPdf } from "./contractPdfService.js";
import { streamMyPreparedContract, streamMyFinalContract } from "../controllers/contractController.js";
import { resolveTenantContractDocument } from "./tenantContractDocumentResolver.js";
import {
  uploadAndFinalizeNotarizedContract,
  uploadNotarizedContract,
  verifyNotarizedContract,
  NOTARIZATION_CHECKLIST_KEYS,
  NOTARIZED_CONTRACT_ROOT,
} from "./contractNotarizationService.js";
import { GENERATED_CONTRACT_ROOT } from "./contractPrivateStorageService.js";
import {
  markContractReadyForPublication,
  publishFinalContract,
  PUBLICATION_CHECKLIST_KEYS,
} from "./contractPublicationService.js";

const TENANT_FIREBASE_UID = "firebase-e2e-resolver-tenant";

await jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
  mobileTenantAuth: (req, _res, next) => {
    req.mobileTenant = { _id: req.headers["x-test-tenant-id"] };
    next();
  },
}));

const { default: mobileContractRoutes } = await import("../routes/mobileContractRoutes.js");

let mongod;
let webServer;
let webBaseUrl;
let mobileServer;
let mobileBaseUrl;

// Contract numbers restart from 00001 for every fresh in-memory Mongo
// instance (this file's own ContractCounter), but the on-disk storage
// roots are real, persistent local directories shared across every run of
// this suite — leftover files from a previous run collide with the "wx"
// (write, fail-if-exists) flag these storage services intentionally use as
// an anti-overwrite safety check. Since these tests always use branch
// "gil-puyat", wiping just that branch's subtree up front makes each run
// self-contained without touching any other suite's fixtures (which use
// different branch codes/keys).
const wipeBranchStorage = async () => {
  await Promise.all([
    fs.rm(path.join(NOTARIZED_CONTRACT_ROOT, "gil-puyat"), { recursive: true, force: true }),
    fs.rm(path.join(GENERATED_CONTRACT_ROOT, "gil-puyat"), { recursive: true, force: true }),
  ]);
};

beforeAll(async () => {
  await wipeBranchStorage();
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "tenant_contract_resolver_e2e" });
  await Contract.syncIndexes();

  const webApp = express();
  const injectWebUser = (req, _res, next) => {
    req.user = { uid: TENANT_FIREBASE_UID };
    next();
  };
  webApp.get(
    "/api/contracts/my/:contractId/documents/prepared/:version?",
    injectWebUser,
    streamMyPreparedContract,
  );
  webApp.get(
    "/api/contracts/my/:contractId/documents/final",
    injectWebUser,
    streamMyFinalContract,
  );
  await new Promise((resolve) => {
    webServer = webApp.listen(0, "127.0.0.1", resolve);
  });
  webBaseUrl = `http://127.0.0.1:${webServer.address().port}`;

  const mobileApp = express();
  mobileApp.use("/api/m", mobileContractRoutes);
  await new Promise((resolve) => {
    mobileServer = mobileApp.listen(0, "127.0.0.1", resolve);
  });
  mobileBaseUrl = `http://127.0.0.1:${mobileServer.address().port}`;
}, 120_000);

afterAll(async () => {
  await Promise.all([
    new Promise((resolve) => webServer.close(resolve)),
    new Promise((resolve) => mobileServer.close(resolve)),
  ]);
  await mongoose.disconnect();
  await mongod?.stop();
  await wipeBranchStorage();
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
 * Seeds a fully valid, generation-ready Contract (backed by a real
 * User/Room/Reservation) and drives it to "ready_for_generation", the
 * minimum status `generatePreparedContractPdf` requires. Every field this
 * touches was traced from `contractService.js`'s `getContractValidation`
 * (the required-field list), `validateContractForGeneration` (which adds
 * tenantNationality/tenantBirthDate and the initial-payment-summary check),
 * and `createDraftContract` (how each of those fields is actually populated
 * from the Reservation/Room), and from
 * `reservationContractEligibilityService.js` (the "explicit approval"
 * branch, which needs `status` + `applicationReviewedAt` +
 * `applicationReviewedBy` all set).
 */
async function seedGenerationReadyContract({ firebaseUid = TENANT_FIREBASE_UID } = {}) {
  const tenant = await User.create({
    firebaseUid,
    email: `${firebaseUid}@example.test`,
    username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
    firstName: "Test",
    lastName: "Tenant",
    role: "applicant",
  });
  const admin = await User.create({
    firebaseUid: `firebase-admin-${new mongoose.Types.ObjectId()}`,
    email: `admin-${new mongoose.Types.ObjectId()}@example.test`,
    username: `admin_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
    firstName: "Branch",
    lastName: "Admin",
    role: "branch_admin",
  });
  const room = await Room.create({
    name: "Room 301",
    roomNumber: "301",
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
    lastName: "Tenant",
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
    selectedBed: { id: "bed-1", code: "301-A-U" },
  });

  const draft = await createDraftContract({ reservationId: reservation._id, actorId: admin._id });
  await transitionContract(draft, "ready_for_generation", admin._id, "Ready for prepared PDF generation");

  return { tenant, admin, room, reservation, contract: draft };
}

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

describe("tenant contract document resolver — real pipeline", () => {
  test("the draft PDF streamed via web and mobile is byte-identical to the stored fileHash", async () => {
    const { contract, admin, tenant } = await seedGenerationReadyContract();

    const { contract: generatedContract, document } = await generatePreparedContractPdf({
      contractId: contract._id,
      actorId: admin._id,
    });
    expect(generatedContract.status).toBe("generated");
    expect(document.fileHash).toBeTruthy();

    const webResponse = await fetch(
      `${webBaseUrl}/api/contracts/my/${contract._id}/documents/prepared`,
    );
    expect(webResponse.status).toBe(200);
    expect(webResponse.headers.get("content-type")).toBe("application/pdf");
    const webBytes = Buffer.from(await webResponse.arrayBuffer());

    const mobileResponse = await fetch(
      `${mobileBaseUrl}/api/m/contracts/${contract._id}/documents/prepared`,
      { headers: { "x-test-tenant-id": String(tenant._id) } },
    );
    expect(mobileResponse.status).toBe(200);
    expect(mobileResponse.headers.get("content-type")).toBe("application/pdf");
    const mobileBytes = Buffer.from(await mobileResponse.arrayBuffer());

    const storedContract = await Contract.findById(contract._id).lean();
    const currentPrepared = storedContract.preparedDocuments.find(
      (entry) => !entry.superseded,
    );

    expect(sha256(webBytes)).toBe(currentPrepared.fileHash);
    expect(sha256(mobileBytes)).toBe(currentPrepared.fileHash);
    expect(sha256(webBytes)).toBe(sha256(mobileBytes));
    expect(webBytes.equals(mobileBytes)).toBe(true);
  });

  const buildNotarizedFile = async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 936]);
    const buffer = Buffer.from(await pdf.save());
    return { buffer, originalname: "final.pdf", mimetype: "application/pdf", size: buffer.length };
  };

  const fullVerificationChecklist = () =>
    Object.fromEntries(NOTARIZATION_CHECKLIST_KEYS.map((key) => [key, true]));
  const fullPublicationChecklist = () =>
    Object.fromEntries(PUBLICATION_CHECKLIST_KEYS.map((key) => [key, true]));

  test("Scenario D (one-step finalize) — final wet-signed upload persists finalDocument on a real Contract, flips the resolver Tier 2 -> Tier 1, and Web/Mobile stream the exact uploaded bytes; draft history is preserved", async () => {
    const { contract, admin, tenant } = await seedGenerationReadyContract();
    const { contract: generatedContract } = await generatePreparedContractPdf({
      contractId: contract._id,
      actorId: admin._id,
    });
    expect((await resolveTenantContractDocument(generatedContract)).type).toBe("generated_draft");

    const file = await buildNotarizedFile();
    const uploadedHash = sha256(file.buffer);
    const { contract: finalizedContract } = await uploadAndFinalizeNotarizedContract({
      contract: generatedContract,
      file,
      actorId: admin._id,
      preparedDocumentVersion: generatedContract.generatedVersion,
      notarialDetails: { notaryName: "Atty. Test Notary" },
      notes: "Scenario D — one-step finalize",
    });
    expect(finalizedContract.status).toBe("active");

    // Refetch from Mongo — do not trust the in-memory mutation.
    const reloaded = await Contract.findById(contract._id);
    expect(reloaded.finalDocument).toBeTruthy();
    expect(reloaded.finalDocument.fileHash).toBe(uploadedHash);
    expect(reloaded.status).toBe("active");
    // Draft history/metadata must survive finalization untouched.
    expect(reloaded.preparedDocuments).toHaveLength(1);
    expect(reloaded.preparedDocuments[0].superseded).toBe(false);

    const resolved = await resolveTenantContractDocument(reloaded);
    expect(resolved.type).toBe("final_notarized");
    expect(resolved.isFinal).toBe(true);

    const webResponse = await fetch(`${webBaseUrl}/api/contracts/my/${contract._id}/documents/final`);
    expect(webResponse.status).toBe(200);
    const webBytes = Buffer.from(await webResponse.arrayBuffer());

    const mobileResponse = await fetch(
      `${mobileBaseUrl}/api/m/contracts/${contract._id}/documents/final`,
      { headers: { "x-test-tenant-id": String(tenant._id) } },
    );
    expect(mobileResponse.status).toBe(200);
    const mobileBytes = Buffer.from(await mobileResponse.arrayBuffer());

    expect(sha256(webBytes)).toBe(uploadedHash);
    expect(sha256(mobileBytes)).toBe(uploadedHash);
    expect(webBytes.equals(mobileBytes)).toBe(true);
  });

  test("Scenario D (manual verify -> ready -> publish pipeline) — also persists finalDocument correctly on a real Contract and flips the resolver to Final", async () => {
    const { contract, admin } = await seedGenerationReadyContract();
    const { contract: generatedContract } = await generatePreparedContractPdf({
      contractId: contract._id,
      actorId: admin._id,
    });

    const file = await buildNotarizedFile();
    const uploadedHash = sha256(file.buffer);
    await uploadNotarizedContract({
      contract: generatedContract,
      file,
      actorId: admin._id,
      preparedDocumentVersion: generatedContract.generatedVersion,
      notarialDetails: { notaryName: "Atty. Test Notary" },
    });
    await verifyNotarizedContract({
      contract: generatedContract,
      actorId: admin._id,
      documentVersion: generatedContract.notarizedDocumentVersion,
      notes: "Looks correct",
      checklist: fullVerificationChecklist(),
    });
    expect(generatedContract.status).toBe("notarized");

    await markContractReadyForPublication({ contract: generatedContract, actorId: admin._id });
    expect(generatedContract.status).toBe("ready_for_publication");

    const { contract: publishedContract } = await publishFinalContract({
      contract: generatedContract,
      actorId: admin._id,
      checklist: fullPublicationChecklist(),
      notes: "Scenario D — manual publish pipeline",
    });
    expect(publishedContract.status).toBe("published");

    const reloaded = await Contract.findById(contract._id);
    expect(reloaded.finalDocument).toBeTruthy();
    expect(reloaded.finalDocument.fileHash).toBe(uploadedHash);
    expect((await resolveTenantContractDocument(reloaded)).type).toBe("final_notarized");
  });

  test("regression — an already-finalized Contract rejects a further direct notarized upload/replacement instead of silently overwriting finalDocument", async () => {
    const { contract, admin } = await seedGenerationReadyContract();
    const { contract: generatedContract } = await generatePreparedContractPdf({
      contractId: contract._id,
      actorId: admin._id,
    });
    const file = await buildNotarizedFile();
    const { contract: finalizedContract } = await uploadAndFinalizeNotarizedContract({
      contract: generatedContract,
      file,
      actorId: admin._id,
      preparedDocumentVersion: generatedContract.generatedVersion,
      notarialDetails: { notaryName: "Atty. Test Notary" },
    });
    const originalHash = (await Contract.findById(contract._id)).finalDocument.fileHash;

    const secondFile = await buildNotarizedFile();
    await expect(uploadAndFinalizeNotarizedContract({
      contract: finalizedContract,
      file: secondFile,
      actorId: admin._id,
      preparedDocumentVersion: finalizedContract.generatedVersion,
      notarialDetails: { notaryName: "Atty. Someone Else" },
    })).rejects.toMatchObject({ code: "FINAL_DOCUMENT_REPLACEMENT_REQUIRES_FORMAL_PROCESS" });

    const reloaded = await Contract.findById(contract._id);
    expect(reloaded.finalDocument.fileHash).toBe(originalHash);
  });

  test("regression — a failed finalization (invalid starting status) leaves no partially-persisted finalDocument", async () => {
    const { contract, admin } = await seedGenerationReadyContract();
    const { contract: generatedContract } = await generatePreparedContractPdf({
      contractId: contract._id,
      actorId: admin._id,
    });
    await uploadNotarizedContract({
      contract: generatedContract,
      file: await buildNotarizedFile(),
      actorId: admin._id,
      preparedDocumentVersion: generatedContract.generatedVersion,
      notarialDetails: { notaryName: "Atty. Test Notary" },
    });
    await verifyNotarizedContract({
      contract: generatedContract,
      actorId: admin._id,
      documentVersion: generatedContract.notarizedDocumentVersion,
      notes: "ok",
      checklist: fullVerificationChecklist(),
    });
    // Contract is now at status "notarized" — not in DIRECT_NOTARIZED_UPLOAD_STATUSES,
    // so the one-step finalize action must reject it before touching finalDocument.
    await expect(uploadAndFinalizeNotarizedContract({
      contract: generatedContract,
      file: await buildNotarizedFile(),
      actorId: admin._id,
      preparedDocumentVersion: generatedContract.generatedVersion,
      notarialDetails: { notaryName: "Atty. Test Notary" },
    })).rejects.toMatchObject({ code: "NOTARIZED_DOCUMENT_UPLOAD_NOT_ALLOWED" });

    const reloaded = await Contract.findById(contract._id);
    expect(reloaded.finalDocument).toBeNull();
    expect(reloaded.status).toBe("notarized");
  });
});
