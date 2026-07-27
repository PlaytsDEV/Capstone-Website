import mongoose from "mongoose";
import dotenv from "dotenv";
import { Contract } from "../models/index.js";
import { resolveCurrentPreparedDocument } from "../services/preparedContractDocumentService.js";

dotenv.config();

if (process.argv.some((argument) => ["--write", "--apply", "--delete", "--void"].includes(argument))) {
  throw new Error("This audit is dry-run only and never changes Contract records.");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const id = (value) => value ? String(value) : "";
const overlaps = (left, right) => {
  const leftStart = new Date(left.leaseStartDate).getTime();
  const leftEnd = new Date(left.leaseEndDate).getTime();
  const rightStart = new Date(right.leaseStartDate).getTime();
  const rightEnd = new Date(right.leaseEndDate).getTime();
  return [leftStart, leftEnd, rightStart, rightEnd].every(Number.isFinite)
    && leftStart <= rightEnd
    && leftEnd >= rightStart;
};
const legacyMatch = (left, right) =>
  id(left.tenantId) === id(right.tenantId)
  && left.branch === right.branch
  && id(left.roomId) === id(right.roomId)
  && String(left.bedId || left.bedLabel || "") === String(right.bedId || right.bedLabel || "")
  && overlaps(left, right);

await mongoose.connect(process.env.MONGODB_URI);
try {
  const contracts = await Contract.find({}).sort({ createdAt: 1 }).lean();
  const related = new Map(contracts.map((contract) => [id(contract._id), new Set()]));
  for (let leftIndex = 0; leftIndex < contracts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < contracts.length; rightIndex += 1) {
      const left = contracts[leftIndex];
      const right = contracts[rightIndex];
      const sameReservation = id(left.reservationId)
        && id(left.reservationId) === id(right.reservationId);
      const sameStay = id(left.stayId) && id(left.stayId) === id(right.stayId);
      if (sameReservation || sameStay || legacyMatch(left, right)) {
        related.get(id(left._id)).add(id(right._id));
        related.get(id(right._id)).add(id(left._id));
      }
    }
  }

  const visited = new Set();
  const groups = [];
  for (const contract of contracts) {
    const start = id(contract._id);
    if (visited.has(start) || related.get(start).size === 0) continue;
    const queue = [start];
    const groupIds = [];
    while (queue.length) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      groupIds.push(current);
      queue.push(...related.get(current));
    }
    const groupContracts = groupIds.map((contractId) =>
      contracts.find((entry) => id(entry._id) === contractId));
    const documents = await Promise.all(groupContracts.map(async (entry) => ({
      preparedPdfAvailable: await resolveCurrentPreparedDocument(entry)
        .then(() => true).catch(() => false),
      signedDocumentAvailable: Boolean(entry.signedDocuments?.length),
      notarizedDocumentAvailable: Boolean(entry.notarizedDocuments?.length),
    })));
    const canonicalIndex = groupContracts
      .map((entry, index) => ({
        index,
        score:
          (documents[index].preparedPdfAvailable ? 8 : 0)
          + (documents[index].notarizedDocumentAvailable ? 4 : 0)
          + (documents[index].signedDocumentAvailable ? 2 : 0)
          + (entry.validatedGenerationData ? 1 : 0),
        createdAt: new Date(entry.createdAt).getTime(),
      }))
      .sort((left, right) => right.score - left.score || left.createdAt - right.createdAt)[0].index;
    groups.push({
      recommendedCanonicalContractId: id(groupContracts[canonicalIndex]._id),
      proposedDuplicateAction:
        "Review audit history and approved snapshots; formally void confirmed duplicates without deleting them.",
      contracts: groupContracts.map((entry, index) => ({
        contractId: id(entry._id),
        contractNumber: entry.contractNumber,
        tenant: entry.tenantLegalName,
        reservationId: id(entry.reservationId),
        stayId: id(entry.stayId),
        branch: entry.branch,
        roomId: id(entry.roomId),
        roomNumber: entry.roomNumber,
        bed: entry.bedLabel || entry.bedId || "",
        contractPurpose: entry.contractPurpose || "legacy_initial",
        status: entry.status,
        leaseStartDate: entry.leaseStartDate,
        leaseEndDate: entry.leaseEndDate,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        ...documents[index],
      })),
    });
  }
  process.stdout.write(`${JSON.stringify({
    dryRun: true,
    scannedContracts: contracts.length,
    possibleDuplicateGroups: groups.length,
    groups,
  }, null, 2)}\n`);
} finally {
  await mongoose.disconnect();
}
