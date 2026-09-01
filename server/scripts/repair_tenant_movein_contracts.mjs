import "dotenv/config";
import mongoose from "mongoose";
import { autoGenerateMoveInContract } from "../services/autoContractOrchestratorService.js";
import { Reservation, Contract } from "../models/index.js";
import { readMoveInDate } from "../utils/lifecycleNaming.js";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI in environment.");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  const moveInReservations = await Reservation.find({
    status: "moveIn",
    isArchived: { $ne: true },
  }).lean();

  console.log(`Found ${moveInReservations.length} moveIn reservation(s).`);

  for (const res of moveInReservations) {
    const moveInDate = res.confirmedMoveInDate || res.moveInDate || readMoveInDate(res);
    console.log(`Processing reservation ${res.reservationCode || res._id} with moveInDate: ${moveInDate}`);
    try {
      const contract = await Contract.findOne({ reservationId: res._id, isCurrent: true });
      if (contract) {
        console.log(`Current contract ${contract.contractNumber} dates: ${contract.leaseStartDate} to ${contract.leaseEndDate}`);
      }
      const result = await autoGenerateMoveInContract({
        reservationId: res._id,
        actualMoveInDate: moveInDate,
        actorId: res.userId,
      });
      console.log(`Result for ${res.reservationCode}:`, result);
      const updatedContract = await Contract.findOne({ reservationId: res._id, isCurrent: true });
      if (updatedContract) {
        console.log(`Updated contract ${updatedContract.contractNumber} dates: ${updatedContract.leaseStartDate} to ${updatedContract.leaseEndDate}`);
        console.log(`Latest prepared document version: ${updatedContract.preparedDocuments?.at(-1)?.version}`);
      }
    } catch (err) {
      console.error(`Failed to realign contract for reservation ${res._id}:`, err);
    }
  }

  await mongoose.disconnect();
  console.log("Finished repair.");
}

main().catch(console.error);
